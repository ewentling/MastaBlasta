"""
Integrated Routes for MastaBlasta
New endpoints that use production infrastructure

These routes implement the 9 improvements by using the managers from app_extensions.py
"""

from flask import Blueprint, request, jsonify, g, send_file, session
from datetime import datetime, timezone, timedelta
import logging
import os

from app_extensions import (
    db_manager, oauth_manager, media_manager, analytics_collector,
    webhook_manager, search_manager, bulk_ops_manager, retry_manager,
    audit_manager, video_manager, auth_required, role_required, DB_ENABLED
)

logger = logging.getLogger(__name__)

# Constants
MAX_BULK_OPERATION_SIZE = 100

# Create blueprint
integrated_bp = Blueprint('integrated', __name__, url_prefix='/api/v2')

# Auth responses must never be cached by intermediaries
_AUTH_ENDPOINTS = {'integrated.login', 'integrated.register', 'integrated.refresh_access_token', 'integrated.google_auth'}

@integrated_bp.after_request
def set_no_store_on_auth(response):
    """Prevent caching of auth responses that contain tokens"""
    if request.endpoint in _AUTH_ENDPOINTS:
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
        response.headers['Pragma'] = 'no-cache'
    return response

def _is_secure_request() -> bool:
    """Return True when the current request is over HTTPS (directly or via reverse proxy)."""
    return request.is_secure or request.headers.get('X-Forwarded-Proto', '') == 'https'


def _build_auth_response(user_data, access_token, refresh_token, status_code=200):
    from flask import make_response
    response = make_response(jsonify(user_data))

    secure = _is_secure_request()
    samesite = 'None' if secure else 'Lax'
    response.set_cookie(
        'accessToken', access_token,
        httponly=True, secure=secure, samesite=samesite, max_age=15*60,
        path='/'
    )
    response.set_cookie(
        'refreshToken', refresh_token,
        httponly=True, secure=secure, samesite=samesite, max_age=30*24*60*60,
        path='/'
    )
    return response, status_code


# ==================== AUTHENTICATION ROUTES ====================

@integrated_bp.route('/auth/register', methods=['POST'])
def register():
    """Register a new user"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503

    try:
        from auth import hash_password, generate_api_key, create_access_token, create_refresh_token
        from database import db_session_scope
        from models import User, UserRole
        from security_enhancements import PasswordPolicy, InputSanitizer
        import uuid

        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        password = data.get('password')
        name = data.get('name', '').strip()

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        # Validate email format
        if not InputSanitizer.validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400

        # Validate password policy
        is_valid, message = PasswordPolicy.validate(password)
        if not is_valid:
            return jsonify({'error': message}), 400

        with db_session_scope() as session:
            # Check if user exists
            existing = session.query(User).filter_by(email=email).first()
            if existing:
                return jsonify({'error': 'User already exists'}), 409

            # Create user
            user = User(
                id=str(uuid.uuid4()),
                email=email,
                password_hash=hash_password(password),
                full_name=name,
                role=UserRole.EDITOR,
                api_key=generate_api_key(),
                is_active=True,
                auth_provider='email',
                created_at=datetime.now(timezone.utc)
            )
            session.add(user)
            session.flush()

            # Generate tokens
            access_token = create_access_token(user.id, user.role.value)
            refresh_token = create_refresh_token(user.id)

            return _build_auth_response({
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.full_name,
                    'role': user.role.value
                },
                'api_key': user.api_key
            }, access_token, refresh_token, 201)

    except Exception as e:
        logger.error(f"Registration error: {e}")
        return jsonify({'error': 'Registration failed'}), 500


@integrated_bp.route('/auth/login', methods=['POST'])
def login():
    """Login user"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503

    try:
        from auth import verify_password, create_access_token, create_refresh_token
        from database import db_session_scope
        from models import User
        from security_enhancements import AccountSecurity, SecurityLogger

        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        # Check account lockout before hitting the DB
        if AccountSecurity.is_account_locked(email):
            remaining = AccountSecurity.get_lockout_remaining(email)
            return jsonify({
                'error': 'Account temporarily locked due to too many failed attempts',
                'retry_after': remaining
            }), 429

        with db_session_scope() as session:
            user = session.query(User).filter_by(email=email).first()

            # Always call verify_password (even for missing/inactive users) to equalise
            # timing and prevent user-enumeration via response-time side-channel.
            # The dummy hash is a real bcrypt digest so the work-factor is identical.
            _DUMMY_HASH = '$2b$12$PBf5rMQEidQ2ftUyPNeg.OJnMKvkOT98PCYwwMtbPm2.1s00LQeyK'
            candidate_hash = user.password_hash if (user and user.password_hash) else _DUMMY_HASH
            password_ok = verify_password(password, candidate_hash)

            if not user or not user.is_active or not password_ok:
                locked = AccountSecurity.record_login_attempt(email, success=False)
                SecurityLogger.log_failed_login(email)
                if locked:
                    SecurityLogger.log_account_lockout(email)
                    return jsonify({'error': 'Account temporarily locked due to too many failed attempts'}), 429
                return jsonify({'error': 'Invalid credentials'}), 401

            # Successful login – clear failure counters
            AccountSecurity.record_login_attempt(email, success=True)

            # Update last login
            user.last_login = datetime.now(timezone.utc)
            session.flush()

            # Generate tokens
            access_token = create_access_token(user.id, user.role.value)
            refresh_token = create_refresh_token(user.id)

            return _build_auth_response({
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.full_name,
                    'role': user.role.value
                },
                'password_must_change': user.password_must_change
            }, access_token, refresh_token, 200)

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500


@integrated_bp.route('/auth/change-password', methods=['POST'])
@auth_required
def change_password():
    """Change user password (required for default admin on first login)"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503

    try:
        from auth import verify_password, hash_password
        from database import db_session_scope
        from models import User
        from security_enhancements import PasswordPolicy

        data = request.get_json() or {}
        old_password = data.get('old_password')
        new_password = data.get('new_password')

        if not old_password or not new_password:
            return jsonify({'error': 'Old and new passwords required'}), 400

        is_valid, message = PasswordPolicy.validate(new_password)
        if not is_valid:
            return jsonify({'error': message}), 400

        with db_session_scope() as session:
            user = session.query(User).filter_by(id=g.current_user['id']).first()

            if not user:
                return jsonify({'error': 'User not found'}), 404

            # Verify old password
            if not verify_password(old_password, user.password_hash):
                return jsonify({'error': 'Current password is incorrect'}), 401

            # Update password
            user.password_hash = hash_password(new_password)
            user.password_must_change = False  # Clear the flag
            # Commit will happen automatically when context exits

            logger.info(f"Password changed for user {user.email}")

            return jsonify({'message': 'Password changed successfully'})

    except Exception as e:
        logger.error(f"Password change error: {e}")
        return jsonify({'error': 'Password change failed'}), 500


@integrated_bp.route('/auth/me', methods=['GET'])
@auth_required
def get_me():
    """Get current user profile"""
    return jsonify({'user': g.current_user})

@integrated_bp.route('/auth/logout', methods=['POST'])
def logout():
    """Logout by clearing HttpOnly cookies"""
    from flask import make_response
    secure = _is_secure_request()
    samesite = 'None' if secure else 'Lax'
    response = make_response(jsonify({'message': 'Logged out successfully'}))
    response.set_cookie('accessToken', '', expires=0, httponly=True, secure=secure, samesite=samesite, path='/')
    response.set_cookie('refreshToken', '', expires=0, httponly=True, secure=secure, samesite=samesite, path='/')
    return response, 200


@integrated_bp.route('/auth/refresh', methods=['POST'])
def refresh_access_token():
    """Use a refresh token to obtain a new access token"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503

    try:
        from auth import decode_token, create_access_token, create_refresh_token
        from database import db_session_scope
        from models import User
        from security_enhancements import RefreshTokenRotation

        data = request.get_json() or {}
        refresh_token = data.get('refresh_token')
        
        if not refresh_token:
            # Check HttpOnly cookie
            refresh_token = request.cookies.get('refreshToken')
            
        if not refresh_token:
            # Also accept from Authorization header (Bearer <refresh_token>)
            auth_header = request.headers.get('Authorization', '')
            if auth_header.startswith('Bearer '):
                refresh_token = auth_header.split(' ', 1)[1]

        if not refresh_token:
            return jsonify({'error': 'Refresh token required'}), 400

        # Reject already-used tokens (rotation)
        if RefreshTokenRotation.is_token_used(refresh_token):
            return jsonify({'error': 'Refresh token has already been used'}), 401

        payload = decode_token(refresh_token)
        if not payload or payload.get('type') != 'refresh':
            return jsonify({'error': 'Invalid or expired refresh token'}), 401

        user_id = payload['user_id']

        with db_session_scope() as session:
            user = session.query(User).filter_by(id=user_id, is_active=True).first()
            if not user:
                return jsonify({'error': 'User not found or inactive'}), 401

            # Mark old refresh token as used and issue new pair
            RefreshTokenRotation.mark_token_used(refresh_token)
            new_access_token = create_access_token(user.id, user.role.value)
            new_refresh_token = create_refresh_token(user.id)

            return _build_auth_response({
                'message': 'Token refreshed successfully'
            }, new_access_token, new_refresh_token, 200)

    except Exception:
        logger.error("Token refresh error")
        return jsonify({'error': 'Token refresh failed'}), 500


@integrated_bp.route('/auth/google', methods=['POST'])
def google_auth():
    """Authenticate user with Google One Tap"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503

    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as google_requests
        from auth import create_access_token, create_refresh_token, generate_api_key
        from database import db_session_scope
        from models import User, UserRole
        import uuid
        import os

        data = request.get_json() or {}
        credential = data.get('credential')

        if not credential:
            return jsonify({'error': 'Missing credential'}), 400

        # Verify the Google ID token
        google_client_id = os.getenv('GOOGLE_CLIENT_ID')
        if not google_client_id:
            return jsonify({'error': 'Google Client ID not configured'}), 500

        try:
            idinfo = id_token.verify_oauth2_token(
                credential, 
                google_requests.Request(), 
                google_client_id
            )

            # Extract user info from token
            email = idinfo.get('email')
            name = idinfo.get('name', '')
            google_id = idinfo.get('sub')

            if not email:
                return jsonify({'error': 'Email not provided by Google'}), 400

            if not idinfo.get('email_verified'):
                return jsonify({'error': 'Google email address is not verified'}), 400

            with db_session_scope() as session:
                # Look up user by google_id first (if present), then fall back to email
                user = None
                if google_id:
                    # First, try to find a user already linked to this Google account
                    user = session.query(User).filter(User.google_id == google_id).first()
                    if not user:
                        # If no user is linked by google_id, fall back to email, but only
                        # for accounts that are not yet associated with any google_id
                        user = session.query(User).filter(
                            User.email == email,
                            User.google_id == None  # noqa: E711 - SQLAlchemy IS NULL
                        ).first()
                else:
                    user = session.query(User).filter(User.email == email).first()

                if user:
                    # Update last login and google_id if needed
                    user.last_login = datetime.now(timezone.utc)
                    if google_id and not user.google_id:
                        user.google_id = google_id
                        user.auth_provider = 'google'
                    if not user.is_active:
                        return jsonify({'error': 'Account is deactivated'}), 403
                else:
                    # Create new user
                    user = User(
                        id=str(uuid.uuid4()),
                        email=email,
                        password_hash=None,  # No password for Google auth users
                        full_name=name,
                        role=UserRole.EDITOR,
                        api_key=generate_api_key(),
                        is_active=True,
                        auth_provider='google',
                        google_id=google_id,
                        created_at=datetime.now(timezone.utc)
                    )
                    session.add(user)

                session.flush()

                # Generate tokens
                access_token = create_access_token(user.id, user.role.value)
                refresh_token = create_refresh_token(user.id)

                return _build_auth_response({
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'name': user.full_name,
                        'role': user.role.value
                    },
                    'api_key': user.api_key
                }, access_token, refresh_token, 200)

        except ValueError as e:
            logger.error(f"Google token verification failed: {e}")
            return jsonify({'error': 'Invalid Google token'}), 401

    except Exception as e:
        logger.error(f"Google authentication error: {e}")
        return jsonify({'error': 'Authentication failed'}), 500


# ==================== OAUTH ROUTES ====================

@integrated_bp.route('/oauth/<platform>/authorize', methods=['GET'])
@auth_required
def oauth_authorize(platform):
    """Initiate OAuth flow for platform"""
    scopes_str = request.args.get('scopes')
    requested_scopes = scopes_str.split(',') if scopes_str else None
    
    result = oauth_manager.get_authorization_url(platform, g.current_user['id'], requested_scopes=requested_scopes)

    if 'error' in result:
        return jsonify(result), 400
    
    # Store code_verifier in session for Twitter PKCE flow
    if platform == 'twitter' and 'code_verifier' in result:
        session[f'twitter_code_verifier_{g.current_user["id"]}'] = result['code_verifier']
        logger.info(f"Stored code_verifier in session for user {g.current_user['id']}")

    return jsonify(result)


@integrated_bp.route('/oauth/<platform>/callback', methods=['GET'])
def oauth_callback(platform):
    """Handle OAuth callback"""
    code = request.args.get('code')
    state = request.args.get('state')

    if not code or not state:
        return jsonify({'error': 'Missing code or state'}), 400
    
    # For Twitter, retrieve code_verifier from session
    code_verifier = None
    if platform == 'twitter':
        # Extract user_id from state to get the right code_verifier
        parts = state.split(':')
        if len(parts) >= 1:
            user_id = parts[0]
            session_key = f'twitter_code_verifier_{user_id}'
            code_verifier = session.get(session_key)
            
            if code_verifier:
                logger.info(f"Retrieved code_verifier from session for user {user_id}")
                # Clean up the session after use
                session.pop(session_key, None)
            else:
                logger.warning(f"No code_verifier found in session for user {user_id}")
                return jsonify({
                    'error': 'Session expired or invalid',
                    'details': 'Please try connecting your Twitter account again'
                }), 400

    result = oauth_manager.handle_callback(platform, code, state, code_verifier=code_verifier)

    if 'error' in result:
        # Record failed connection
        parts = state.split(':')
        user_id = parts[0] if len(parts) >= 1 else None
        if user_id:
            audit_manager.record_event(
                user_id=user_id,
                platform=platform,
                action='connect',
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent'),
                status='failed',
                error_message=result['error']
            )
        return jsonify(result), 400

    # Record successful connection
    audit_manager.record_event(
        user_id=result.get('user_id', g.current_user['id'] if hasattr(g, 'current_user') else None),
        platform=platform,
        action='connect',
        account_id=result.get('account_id'),
        ip_address=request.remote_addr,
        user_agent=request.headers.get('User-Agent'),
        status='success'
    )

    return jsonify(result)


# ==================== MEDIA ROUTES ====================

@integrated_bp.route('/media/upload', methods=['POST'])
@auth_required
def upload_media():
    """Upload media file"""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Empty filename'}), 400

    # Pass file object directly (not bytes)
    mime_type = file.content_type or 'application/octet-stream'

    result = media_manager.upload_media(
        g.current_user['id'],
        file,  # Pass file object, not file.read()
        file.filename,
        mime_type
    )

    if 'error' in result:
        return jsonify(result), 400

    return jsonify(result), 201


@integrated_bp.route('/media', methods=['GET'])
@auth_required
def list_media():
    """List user's media library"""
    try:
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid pagination parameters; limit and offset must be integers'}), 400
    limit = min(100, max(1, limit))
    offset = max(0, offset)

    media_list = media_manager.list_media(g.current_user['id'], limit, offset)
    return jsonify({'media': media_list, 'limit': limit, 'offset': offset})


@integrated_bp.route('/media/<media_id>', methods=['GET'])
@auth_required
def get_media(media_id):
    """Get media details"""
    media = media_manager.get_media(media_id)

    if not media:
        return jsonify({'error': 'Media not found'}), 404

    return jsonify(media)


@integrated_bp.route('/media/<media_id>/file', methods=['GET'])
@auth_required
def download_media(media_id):
    """Download media file"""
    from media_utils import MEDIA_DIR
    from pathlib import Path

    media = media_manager.get_media(media_id)

    if not media:
        return jsonify({'error': 'Media not found'}), 404

    # Resolve and validate path to prevent path traversal attacks
    try:
        resolved = Path(media['file_path']).resolve()
        media_root = MEDIA_DIR.resolve()
        # resolved.relative_to() raises ValueError if resolved is not inside media_root
        resolved.relative_to(media_root)
    except ValueError:
        logger.warning(f"Path traversal attempt blocked: {media['file_path']}")
        return jsonify({'error': 'Access denied'}), 403
    except Exception:
        return jsonify({'error': 'Invalid file path'}), 400

    if not resolved.exists():
        return jsonify({'error': 'File not found on disk'}), 404

    return send_file(str(resolved), mimetype=media['mime_type'])


@integrated_bp.route('/media/<media_id>', methods=['DELETE'])
@auth_required
def delete_media(media_id):
    """Delete media file"""
    media = media_manager.get_media(media_id)

    if not media:
        return jsonify({'error': 'Media not found'}), 404

    # Delete from filesystem
    if os.path.exists(media['file_path']):
        os.remove(media['file_path'])

    # Delete from database
    from database import db_session_scope
    from models import Media

    with db_session_scope() as session:
        media_obj = session.query(Media).filter_by(id=media_id).first()
        if media_obj:
            session.delete(media_obj)

    return jsonify({'message': 'Media deleted successfully'})


# ==================== POST ROUTES (Database-backed) ====================

@integrated_bp.route('/posts', methods=['POST'])
@auth_required
def create_post():
    """Create a new post"""
    data = request.get_json() or {}

    try:
        post = db_manager.create_post(g.current_user['id'], data)
        return jsonify(post), 201
    except Exception as e:
        logger.error(f"Post creation error: {e}")
        return jsonify({'error': 'Failed to create post'}), 500


@integrated_bp.route('/posts', methods=['GET'])
@auth_required
def list_posts():
    """List posts with filtering"""
    filters = {
        'status': request.args.get('status'),
        'platform': request.args.get('platform'),
        'start_date': request.args.get('start_date'),
        'end_date': request.args.get('end_date'),
        'search': request.args.get('search')
    }
    filters = {k: v for k, v in filters.items() if v}

    try:
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid pagination parameters; limit and offset must be integers'}), 400
    limit = min(100, max(1, limit))
    offset = max(0, offset)

    posts = db_manager.list_posts(g.current_user['id'], filters, limit, offset)
    return jsonify({'posts': posts, 'limit': limit, 'offset': offset})


@integrated_bp.route('/posts/<post_id>', methods=['GET'])
@auth_required
def get_post(post_id):
    """Get post details"""
    post = db_manager.get_post(post_id)

    if not post:
        return jsonify({'error': 'Post not found'}), 404

    return jsonify(post)


@integrated_bp.route('/posts/<post_id>', methods=['PUT'])
@auth_required
def update_post(post_id):
    """Update post"""
    data = request.get_json() or {}

    post = db_manager.update_post(post_id, data)

    if not post:
        return jsonify({'error': 'Post not found'}), 404

    return jsonify(post)


@integrated_bp.route('/posts/<post_id>', methods=['DELETE'])
@auth_required
def delete_post(post_id):
    """Delete post"""
    success = db_manager.delete_post(post_id)

    if not success:
        return jsonify({'error': 'Post not found'}), 404

    return jsonify({'message': 'Post deleted successfully'})


@integrated_bp.route('/posts/<post_id>/publish', methods=['POST'])
@auth_required
def publish_post(post_id):
    """Publish post to platforms
    
    Supports selecting specific accounts by friendly name (display_name).
    Request body can include:
    {
        "account_names": {
            "platform": "display_name",
            ...
        }
    }
    """
    post = db_manager.get_post(post_id)

    if not post:
        return jsonify({'error': 'Post not found'}), 404
    
    # Security check: Ensure user owns this post
    if post['user_id'] != g.current_user['id']:
        return jsonify({'error': 'Unauthorized: You can only publish your own posts'}), 403

    # Import required modules
    from database import db_session_scope
    from models import Account
    
    # Get account_names mapping from request body if provided
    request_data = request.get_json() or {}
    account_names = request_data.get('account_names', {})
    
    # Publish to each platform
    results = {}
    for platform in post['platforms']:
        # Get account for platform from database
        with db_session_scope() as session:
            # Build query for user's accounts on this platform
            query = session.query(Account).filter_by(
                user_id=post['user_id'],
                platform=platform,
                is_active=True
            )
            
            # If account_names specified for this platform, filter by display_name
            if platform in account_names:
                display_name = account_names[platform]
                query = query.filter_by(display_name=display_name)
                account = query.first()
                
                if not account:
                    results[platform] = {
                        'error': f'No active {platform} account found with display name "{display_name}"'
                    }
                    continue
            else:
                # No specific account requested, use most recent
                account = query.order_by(Account.created_at.desc()).first()
                
                if not account:
                    results[platform] = {'error': f'No active {platform} account found for user'}
                    continue
            
            account_id = account.id
            
            # Get page_id from metadata for Facebook posting if available
            # Extract metadata before session closes to avoid detached instance issues
            post_options = post.get('post_options', {}).copy()
            if platform == 'facebook' and account.platform_metadata:
                pages = account.platform_metadata.get('pages', [])
                if pages and 'page_id' not in post_options:
                    # Use first page by default
                    post_options['page_id'] = pages[0]['page_id']
        
        # Post to platform (outside session context)
        # Security: oauth_manager will verify user owns the account_id
        result = oauth_manager.post_to_platform(
            platform,
            account_id,
            post['content'],
            post.get('media_ids', []),
            post_options,
            g.current_user['id']  # Pass user_id for security check
        )
        results[platform] = result

        # Collect analytics if successful
        if 'error' not in result:
            analytics_collector.collect_post_analytics(
                post_id,
                platform,
                result.get('id'),
                account_id
            )

    # Update post status
    if all('error' not in r for r in results.values()):
        db_manager.update_post(post_id, {
            'status': 'published',
            'published_at': datetime.now(timezone.utc)
        })
    else:
        db_manager.update_post(post_id, {'status': 'failed'})

    return jsonify({'results': results})


# ==================== SEARCH ROUTES ====================

@integrated_bp.route('/search/posts', methods=['GET'])
@auth_required
def search_posts():
    """Advanced post search"""
    query = request.args.get('q', '')

    filters = {
        'platforms': request.args.getlist('platform'),
        'status': request.args.get('status'),
        'post_type': request.args.get('post_type'),
        'date_from': request.args.get('date_from'),
        'date_to': request.args.get('date_to'),
        'has_media': request.args.get('has_media') == 'true'
    }
    filters = {k: v for k, v in filters.items() if v is not None}

    try:
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
    except (TypeError, ValueError):
        return jsonify({'error': 'Invalid pagination parameters; limit and offset must be integers'}), 400
    limit = min(100, max(1, limit))
    offset = max(0, offset)

    results = search_manager.search_posts(g.current_user['id'], query, filters, limit, offset)
    return jsonify(results)


# ==================== BULK OPERATIONS ROUTES ====================

@integrated_bp.route('/bulk/posts/create', methods=['POST'])
@auth_required
@role_required('editor')
def bulk_create_posts():
    """Bulk create posts"""
    data = request.get_json() or {}
    posts_data = data.get('posts', [])

    if not posts_data:
        return jsonify({'error': 'No posts provided'}), 400

    if len(posts_data) > 100:
        return jsonify({'error': 'Maximum 100 posts per bulk operation'}), 400

    results = bulk_ops_manager.bulk_create_posts(g.current_user['id'], posts_data)
    return jsonify(results)


@integrated_bp.route('/bulk/posts/update', methods=['POST'])
@auth_required
@role_required('editor')
def bulk_update_posts():
    """Bulk update posts"""
    data = request.get_json() or {}
    updates = data.get('updates', [])

    if not updates:
        return jsonify({'error': 'No updates provided'}), 400

    if len(updates) > 100:
        return jsonify({'error': 'Maximum 100 updates per bulk operation'}), 400

    results = bulk_ops_manager.bulk_update_posts(g.current_user['id'], updates)
    return jsonify(results)


@integrated_bp.route('/bulk/posts/delete', methods=['POST'])
@auth_required
@role_required('admin')
def bulk_delete_posts():
    """Bulk delete posts"""
    data = request.get_json() or {}
    post_ids = data.get('post_ids', [])

    if not post_ids:
        return jsonify({'error': 'No post IDs provided'}), 400

    if len(post_ids) > 100:
        return jsonify({'error': 'Maximum 100 IDs per bulk operation'}), 400

    results = bulk_ops_manager.bulk_delete_posts(g.current_user['id'], post_ids)
    return jsonify(results)


# ==================== WEBHOOK ROUTES ====================

@integrated_bp.route('/webhooks', methods=['POST'])
@auth_required
def register_webhook():
    """Register a webhook"""
    from security_enhancements import InputSanitizer
    data = request.get_json() or {}

    url = data.get('url')
    events = data.get('events', [])
    secret = data.get('secret')

    if not url or not events:
        return jsonify({'error': 'URL and events required'}), 400

    # Validate webhook URL: must be a public HTTPS URL to prevent SSRF and MITM
    if not InputSanitizer.validate_url(url, https_only=True):
        return jsonify({'error': 'Webhook URL must be a public https:// URL'}), 400

    result = webhook_manager.register_webhook(g.current_user['id'], url, events, secret)

    if 'error' in result:
        return jsonify(result), 400

    return jsonify(result), 201


@integrated_bp.route('/webhooks', methods=['GET'])
@auth_required
def list_webhooks():
    """List registered webhooks for the authenticated user"""
    try:
        # Get webhooks from webhook manager
        webhooks = webhook_manager.get_webhooks(g.current_user['id'])
        
        if isinstance(webhooks, dict) and 'error' in webhooks:
            return jsonify(webhooks), 500
        
        return jsonify({
            'webhooks': webhooks,
            'count': len(webhooks)
        })
    except Exception as e:
        logger.error(f"Error listing webhooks: {e}", exc_info=True)
        return jsonify({
            'error': 'Failed to list webhooks',
        }), 500


@integrated_bp.route('/webhooks/<webhook_id>', methods=['DELETE'])
@auth_required
def delete_webhook(webhook_id):
    """Delete a webhook (with authorization check)"""
    try:
        # Delete webhook with authorization check
        result = webhook_manager.delete_webhook(webhook_id, g.current_user['id'])
        
        if 'error' in result:
            status_code = 404 if 'not found' in result['error'].lower() else 400
            return jsonify(result), status_code
        
        return jsonify({
            'success': True,
            'message': 'Webhook deleted successfully'
        })
    except Exception as e:
        logger.error(f"Error deleting webhook {webhook_id}: {e}", exc_info=True)
        return jsonify({
            'error': 'Failed to delete webhook',
        }), 500


# ==================== ANALYTICS ROUTES ====================

@integrated_bp.route('/analytics/posts/<post_id>', methods=['GET'])
@auth_required
def get_post_analytics(post_id):
    """Get analytics for a specific post"""
    if not DB_ENABLED:
        return jsonify({'error': 'Analytics not available'}), 503

    from database import db_session_scope
    from models import PostAnalytics

    with db_session_scope() as session:
        analytics = session.query(PostAnalytics).filter_by(post_id=post_id).all()

        result = []
        for a in analytics:
            result.append({
                'platform': a.platform,
                'views': a.views,
                'likes': a.likes,
                'shares': a.shares,
                'comments': a.comments,
                'reach': a.reach,
                'engagement_rate': a.engagement_rate,
                'collected_at': a.collected_at.isoformat()
            })

        return jsonify({'analytics': result})


@integrated_bp.route('/analytics/overview', methods=['GET'])
@auth_required
def get_analytics_overview():
    """Get analytics overview for user with real data aggregation"""
    if not DB_ENABLED:
        return jsonify({
            'error': 'Analytics not available',
            'details': 'Database not enabled'
        }), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostAnalytics, PostAccount
        from sqlalchemy import func
        
        with db_session_scope() as session:
            # Get posts for the user
            posts = session.query(Post).filter_by(user_id=g.current_user['id']).all()
            post_ids = [p.id for p in posts]
            
            if not post_ids:
                # User has no posts yet
                return jsonify({
                    'total_posts': 0,
                    'total_engagement': 0,
                    'platforms': {},
                    'period': '30d',
                    'message': 'No posts yet'
                })
            
            # Get analytics for user's posts
            analytics = session.query(PostAnalytics).filter(
                PostAnalytics.post_id.in_(post_ids)
            ).all()
            
            # Calculate total engagement
            total_engagement = sum(
                (a.likes or 0) + (a.comments or 0) + (a.shares or 0) 
                for a in analytics
            )
            
            # Calculate per-platform metrics
            platforms = {}
            for post in posts:
                # Get accounts used for this post
                post_accounts = session.query(PostAccount).filter_by(post_id=post.id).all()
                
                for pa in post_accounts:
                    platform = pa.platform
                    if platform not in platforms:
                        platforms[platform] = {
                            'posts': 0,
                            'engagement': 0,
                            'status': {}
                        }
                    
                    platforms[platform]['posts'] += 1
                    
                    # Track post statuses
                    status = pa.status
                    if status not in platforms[platform]['status']:
                        platforms[platform]['status'][status] = 0
                    platforms[platform]['status'][status] += 1
            
            # Add engagement per platform from analytics
            for a in analytics:
                platform = a.platform
                if platform in platforms:
                    platforms[platform]['engagement'] += (
                        (a.likes or 0) + (a.comments or 0) + (a.shares or 0)
                    )
            
            return jsonify({
                'total_posts': len(posts),
                'total_engagement': total_engagement,
                'platforms': platforms,
                'period': '30d',
                'analytics_count': len(analytics)
            })
    
    except Exception as e:
        logger.error(f"Error getting analytics overview: {e}", exc_info=True)
        return jsonify({
            'error': 'Failed to get analytics overview',
        }), 500


# ==================== RETRY & RECOVERY ROUTES ====================

@integrated_bp.route('/posts/retry-failed', methods=['POST'])
@auth_required
def retry_failed_posts():
    """Retry all failed posts"""
    results = retry_manager.retry_failed_posts(g.current_user['id'])
    return jsonify(results)


@integrated_bp.route('/posts/<post_id>/retry', methods=['POST'])
@auth_required
def retry_single_post(post_id):
    """Retry a single failed post"""
    post = db_manager.get_post(post_id)

    if not post:
        return jsonify({'error': 'Post not found'}), 404

    if post['status'] != 'failed':
        return jsonify({'error': 'Post is not in failed state'}), 400

    # Update status to scheduled to trigger retry
    db_manager.update_post(post_id, {'status': 'scheduled'})

    return jsonify({'message': 'Post scheduled for retry'})


# ==================== ACCOUNTS ROUTES ====================

@integrated_bp.route('/accounts', methods=['GET'])
@auth_required
def list_accounts():
    """List all accounts for the authenticated user
    
    Returns account information including display_name (friendly name)
    that can be used to select specific accounts when posting.
    
    Response includes:
    - id: Account ID
    - platform: Platform name (twitter, facebook, etc.)
    - display_name: Friendly name for the account
    - platform_username: Username on the platform
    - is_active: Whether account is active
    """
    from database import db_session_scope
    from models import Account
    
    try:
        with db_session_scope() as session:
            accounts = session.query(Account).filter_by(
                user_id=g.current_user['id'],
                is_active=True
            ).order_by(Account.platform, Account.created_at.desc()).all()
            
            account_list = [{
                'id': acc.id,
                'platform': acc.platform,
                'display_name': acc.display_name,
                'platform_username': acc.platform_username,
                'platform_user_id': acc.platform_user_id,
                'is_active': acc.is_active,
                'created_at': acc.created_at.isoformat() if acc.created_at else None
            } for acc in accounts]
            
        return jsonify({
            'accounts': account_list,
            'count': len(account_list)
        })
    except Exception as e:
        logger.error(f"Error listing accounts: {e}")
        return jsonify({'error': 'Failed to list accounts'}), 500


@integrated_bp.route('/accounts/<account_id>', methods=['GET'])
@auth_required
def get_account_details(account_id):
    """Get details for a specific account
    
    Security: Only returns account if it belongs to the authenticated user
    """
    from database import db_session_scope
    from models import Account
    
    try:
        with db_session_scope() as session:
            account = session.query(Account).filter_by(
                id=account_id,
                user_id=g.current_user['id']  # Security: user can only access their own accounts
            ).first()
            
            if not account:
                return jsonify({'error': 'Account not found or unauthorized'}), 404
            
            account_data = {
                'id': account.id,
                'platform': account.platform,
                'display_name': account.display_name,
                'platform_username': account.platform_username,
                'platform_user_id': account.platform_user_id,
                'is_active': account.is_active,
                'token_expires_at': account.token_expires_at.isoformat() if account.token_expires_at else None,
                'created_at': account.created_at.isoformat() if account.created_at else None,
                'updated_at': account.updated_at.isoformat() if account.updated_at else None
            }
            
            # Include platform metadata (without sensitive tokens)
            if account.platform_metadata:
                account_data['platform_metadata'] = account.platform_metadata
                
        return jsonify({'account': account_data})
    except Exception as e:
        logger.error(f"Error getting account details: {e}")
        return jsonify({'error': 'Failed to get account details'}), 500


@integrated_bp.route('/accounts/<account_id>', methods=['PATCH'])
@auth_required
def update_account_display_name(account_id):
    """Update account display name (friendly name)
    
    Request body:
    {
        "display_name": "New Friendly Name"
    }
    
    Security: Only allows updating accounts owned by authenticated user
    """
    from database import db_session_scope
    from models import Account
    
    data = request.get_json() or {}
    if not data or 'display_name' not in data:
        return jsonify({'error': 'display_name is required'}), 400
    
    try:
        with db_session_scope() as session:
            account = session.query(Account).filter_by(
                id=account_id,
                user_id=g.current_user['id']  # Security: user can only update their own accounts
            ).first()
            
            if not account:
                return jsonify({'error': 'Account not found or unauthorized'}), 404
            
            account.display_name = data['display_name']
            session.flush()
            
            account_data = {
                'id': account.id,
                'platform': account.platform,
                'display_name': account.display_name,
                'platform_username': account.platform_username
            }
            
        return jsonify({
            'success': True,
            'account': account_data,
            'message': 'Account display name updated successfully'
        })
    except Exception as e:
        logger.error(f"Error updating account: {e}")
        return jsonify({'error': 'Failed to update account'}), 500


@integrated_bp.route('/accounts/<account_id>', methods=['DELETE'])
@auth_required
def delete_account(account_id):
    """Delete an account and revoke its tokens
    
    Security: Only allows deleting accounts owned by authenticated user
    """
    from database import db_session_scope
    from models import Account
    from auth import decrypt_token
    
    try:
        with db_session_scope() as session:
            account = session.query(Account).filter_by(
                id=account_id,
                user_id=g.current_user['id']
            ).first()
            
            if not account:
                return jsonify({'error': 'Account not found or unauthorized'}), 404
            
            platform = account.platform
            oauth_token_encrypted = account.oauth_token
            
            # Attempt to revoke token if we have one
            if oauth_token_encrypted:
                try:
                    access_token = decrypt_token(oauth_token_encrypted)
                    if access_token:
                        # We'll implement this method in OAuthManager next
                        if hasattr(oauth_manager, 'revoke_token'):
                            oauth_manager.revoke_token(platform, access_token)
                except Exception as e:
                    logger.warning(f"Failed to revoke token during account deletion: {e}")
            
            # Record disconnect event
            audit_manager.record_event(
                user_id=g.current_user['id'],
                platform=platform,
                action='disconnect',
                account_id=account.id,
                ip_address=request.remote_addr,
                user_agent=request.headers.get('User-Agent'),
                status='success'
            )
            
            # Delete from database
            session.delete(account)
            
        return jsonify({
            'success': True,
            'message': 'Account deleted successfully'
        })
    except Exception as e:
        logger.error(f"Error deleting account: {e}")
        return jsonify({'error': 'Failed to delete account'}), 500


@integrated_bp.route('/accounts/<account_id>/logs', methods=['GET'])
@auth_required
def get_account_logs(account_id):
    """Get connection audit logs for an account
    
    Security: Only allows viewing logs for accounts owned by authenticated user
    """
    from database import db_session_scope
    from models import Account, ConnectionAuditLog
    
    try:
        with db_session_scope() as session:
            # First verify ownership
            account = session.query(Account).filter_by(
                id=account_id,
                user_id=g.current_user['id']
            ).first()
            
            if not account:
                return jsonify({'error': 'Account not found or unauthorized'}), 404
            
            # Fetch logs
            limit = int(request.args.get('limit', 50))
            offset = int(request.args.get('offset', 0))
            
            logs = session.query(ConnectionAuditLog).filter_by(
                account_id=account_id
            ).order_by(ConnectionAuditLog.created_at.desc()).limit(limit).offset(offset).all()
            
            log_entries = [{
                'id': log.id,
                'action': log.action,
                'platform': log.platform,
                'scopes': log.scopes,
                'ip_address': log.ip_address,
                'status': log.status,
                'error_message': log.error_message,
                'created_at': log.created_at.isoformat() if log.created_at else None
            } for log in logs]
            
            return jsonify({
                'logs': log_entries,
                'limit': limit,
                'offset': offset,
                'count': len(log_entries)
            })
    except Exception as e:
        logger.error(f"Error fetching account logs: {e}")
        return jsonify({'error': 'Failed to fetch account logs'}), 500


# ==================== VIDEO GENERATOR ROUTES ====================

@integrated_bp.route('/video/generate', methods=['POST'])
@auth_required
def generate_video():
    """Start a new long-form video generation job"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Invalid or missing JSON payload'}), 400

        job_id = video_manager.start_video_generation(data)
        
        return jsonify({
            'message': 'Video generation started successfully',
            'job_id': job_id,
            'status': 'processing'
        }), 202
        
    except Exception as e:
        logger.error(f"Error starting video generation: {e}")
        return jsonify({'error': str(e)}), 500

@integrated_bp.route('/video/status/<job_id>', methods=['GET'])
@auth_required
def get_video_status(job_id):
    """Get the status of a video generation job"""
    try:
        status = video_manager.get_job_status(job_id)
        if status.get('status') == 'not_found':
            return jsonify({'error': 'Job not found'}), 404
            
        return jsonify(status)
        
    except Exception as e:
        logger.error(f"Error checking video status: {e}")
        return jsonify({'error': str(e)}), 500

@integrated_bp.route('/video/generate-music', methods=['POST'])
@auth_required
def generate_music_preview():
    """Generates an AI background music track and returns the temporary URL"""
    try:
        data = request.get_json()
        prompt = data.get('prompt')
        if not prompt:
            return jsonify({'error': 'No prompt provided'}), 400
            
        import uuid
        from media_utils import MEDIA_DIR
        from ai_audio import generate_ai_music
        
        filename = f"bgm_{uuid.uuid4().hex[:8]}.wav"
        output_path = globals()['os'].path.join(MEDIA_DIR, filename)
        
        success = generate_ai_music(prompt, output_path)
        if success:
            return jsonify({'url': f"/api/v2/media/generated/{filename}"}), 200
        else:
            return jsonify({'error': 'Failed to generate music'}), 500
    except Exception as e:
        logger.error(f"Error generating music: {e}")
        return jsonify({'error': str(e)}), 500

@integrated_bp.route('/media/generated/<filename>', methods=['GET'])
@auth_required
def get_generated_video(filename):
    """Serve generated video files securely"""
    from media_utils import MEDIA_DIR
    from pathlib import Path
    import os
    
    try:
        # Validate filename to prevent directory traversal
        allowed_exts = ('.mp4', '.srt', '.wav', '.mp3')
        if not any(filename.endswith(ext) for ext in allowed_exts) or '/' in filename or '\\' in filename:
            return jsonify({'error': 'Invalid filename'}), 400
            
        file_path = MEDIA_DIR / filename
        
        if not file_path.exists():
            return jsonify({'error': 'File not found'}), 404
            
        mimetype = 'video/mp4' 
        if filename.endswith('.srt'): mimetype = 'text/plain'
        elif filename.endswith('.wav'): mimetype = 'audio/wav'
        elif filename.endswith('.mp3'): mimetype = 'audio/mpeg'
        
        return send_file(str(file_path), mimetype=mimetype)
        
    except Exception as e:
        logger.error(f"Error serving generated video: {e}")
        return jsonify({'error': 'Failed to serve video'}), 500


# ==================== WORKSPACE ROUTES ====================

@integrated_bp.route('/workspaces', methods=['GET'])
@auth_required
def get_workspaces():
    """Get all workspaces for current user (owned + member of)"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Workspace, WorkspaceMember
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            # Get owned workspaces
            owned = session.query(Workspace).filter_by(owner_id=user_id, is_active=True).all()
            
            # Get workspaces user is member of
            memberships = session.query(WorkspaceMember).filter_by(user_id=user_id).all()
            member_workspace_ids = [m.workspace_id for m in memberships]
            member_workspaces = session.query(Workspace).filter(
                Workspace.id.in_(member_workspace_ids), 
                Workspace.is_active == True
            ).all() if member_workspace_ids else []
            
            workspaces = []
            seen_ids = set()
            
            for ws in owned:
                if ws.id not in seen_ids:
                    workspaces.append({
                        'id': ws.id,
                        'name': ws.name,
                        'description': ws.description,
                        'logo_url': ws.logo_url,
                        'role': 'owner',
                        'created_at': ws.created_at.isoformat() if ws.created_at else None
                    })
                    seen_ids.add(ws.id)
            
            for ws in member_workspaces:
                if ws.id not in seen_ids:
                    membership = next((m for m in memberships if m.workspace_id == ws.id), None)
                    workspaces.append({
                        'id': ws.id,
                        'name': ws.name,
                        'description': ws.description,
                        'logo_url': ws.logo_url,
                        'role': membership.role if membership else 'member',
                        'created_at': ws.created_at.isoformat() if ws.created_at else None
                    })
                    seen_ids.add(ws.id)
            
            return jsonify({'workspaces': workspaces})
    except Exception as e:
        logger.error(f"Error fetching workspaces: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/workspaces', methods=['POST'])
@auth_required
def create_workspace():
    """Create a new workspace"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Workspace
        import uuid
        
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        
        if not name:
            return jsonify({'error': 'Workspace name is required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            workspace = Workspace(
                id=str(uuid.uuid4()),
                owner_id=user_id,
                name=name,
                description=description or None,
                settings=data.get('settings')
            )
            session.add(workspace)
            session.flush()
            
            return jsonify({
                'id': workspace.id,
                'name': workspace.name,
                'description': workspace.description,
                'message': 'Workspace created successfully'
            }), 201
    except Exception as e:
        logger.error(f"Error creating workspace: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/workspaces/<workspace_id>/members', methods=['GET'])
@auth_required
def get_workspace_members(workspace_id):
    """Get members of a workspace"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Workspace, WorkspaceMember, User
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            workspace = session.query(Workspace).filter_by(id=workspace_id).first()
            if not workspace:
                return jsonify({'error': 'Workspace not found'}), 404
            
            # Check access
            is_member = session.query(WorkspaceMember).filter_by(
                workspace_id=workspace_id, user_id=user_id
            ).first()
            if workspace.owner_id != user_id and not is_member:
                return jsonify({'error': 'Access denied'}), 403
            
            members = []
            # Add owner
            owner = session.query(User).filter_by(id=workspace.owner_id).first()
            if owner:
                members.append({
                    'user_id': owner.id,
                    'email': owner.email,
                    'name': owner.full_name,
                    'role': 'owner',
                    'can_approve': True,
                    'can_publish': True
                })
            
            # Add members
            workspace_members = session.query(WorkspaceMember).filter_by(workspace_id=workspace_id).all()
            for m in workspace_members:
                member_user = session.query(User).filter_by(id=m.user_id).first()
                if member_user:
                    members.append({
                        'user_id': member_user.id,
                        'email': member_user.email,
                        'name': member_user.full_name,
                        'role': m.role,
                        'can_approve': m.can_approve,
                        'can_publish': m.can_publish
                    })
            
            return jsonify({'members': members})
    except Exception as e:
        logger.error(f"Error fetching workspace members: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/workspaces/<workspace_id>/members', methods=['POST'])
@auth_required
def add_workspace_member(workspace_id):
    """Add a member to a workspace"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Workspace, WorkspaceMember, User
        import uuid
        
        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        role = data.get('role', 'member')
        
        if not email:
            return jsonify({'error': 'Email is required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            workspace = session.query(Workspace).filter_by(id=workspace_id).first()
            if not workspace:
                return jsonify({'error': 'Workspace not found'}), 404
            
            # Only owner or admin can add members
            if workspace.owner_id != user_id:
                member = session.query(WorkspaceMember).filter_by(
                    workspace_id=workspace_id, user_id=user_id, role='admin'
                ).first()
                if not member:
                    return jsonify({'error': 'Only owner or admin can add members'}), 403
            
            # Find user to add
            new_user = session.query(User).filter_by(email=email).first()
            if not new_user:
                return jsonify({'error': 'User not found'}), 404
            
            # Check if already member
            existing = session.query(WorkspaceMember).filter_by(
                workspace_id=workspace_id, user_id=new_user.id
            ).first()
            if existing:
                return jsonify({'error': 'User is already a member'}), 409
            
            member = WorkspaceMember(
                id=str(uuid.uuid4()),
                workspace_id=workspace_id,
                user_id=new_user.id,
                role=role,
                can_approve=data.get('can_approve', False),
                can_publish=data.get('can_publish', True),
                invited_by=user_id
            )
            session.add(member)
            
            return jsonify({'message': 'Member added successfully'}), 201
    except Exception as e:
        logger.error(f"Error adding workspace member: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/workspaces/<workspace_id>', methods=['PUT'])
@auth_required
def update_workspace(workspace_id):
    """Update a workspace"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Workspace
        
        data = request.get_json() or {}
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            workspace = session.query(Workspace).filter_by(id=workspace_id, owner_id=user_id).first()
            if not workspace:
                return jsonify({'error': 'Workspace not found or access denied'}), 404
            
            if 'name' in data:
                workspace.name = data['name']
            if 'description' in data:
                workspace.description = data['description']
            if 'logo_url' in data:
                workspace.logo_url = data['logo_url']
            if 'settings' in data:
                workspace.settings = data['settings']
            
            return jsonify({'message': 'Workspace updated successfully'})
    except Exception as e:
        logger.error(f"Error updating workspace: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/workspaces/<workspace_id>', methods=['DELETE'])
@auth_required
def delete_workspace(workspace_id):
    """Delete a workspace (owner only)"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Workspace, WorkspaceMember
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            workspace = session.query(Workspace).filter_by(id=workspace_id, owner_id=user_id).first()
            if not workspace:
                return jsonify({'error': 'Workspace not found or access denied'}), 404
            
            # Delete all members first
            session.query(WorkspaceMember).filter_by(workspace_id=workspace_id).delete()
            
            # Delete the workspace
            session.delete(workspace)
            return jsonify({'message': 'Workspace deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting workspace: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/workspaces/<workspace_id>/members/<member_user_id>', methods=['DELETE'])
@auth_required
def remove_workspace_member(workspace_id, member_user_id):
    """Remove a member from a workspace"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Workspace, WorkspaceMember
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            workspace = session.query(Workspace).filter_by(id=workspace_id).first()
            if not workspace:
                return jsonify({'error': 'Workspace not found'}), 404
            
            # Only owner or admin can remove members
            if workspace.owner_id != user_id:
                member_check = session.query(WorkspaceMember).filter_by(
                    workspace_id=workspace_id, user_id=user_id, role='admin'
                ).first()
                if not member_check:
                    return jsonify({'error': 'Only owner or admin can remove members'}), 403
            
            # Can't remove the owner
            if member_user_id == workspace.owner_id:
                return jsonify({'error': 'Cannot remove workspace owner'}), 400
            
            member = session.query(WorkspaceMember).filter_by(
                workspace_id=workspace_id, user_id=member_user_id
            ).first()
            if not member:
                return jsonify({'error': 'Member not found'}), 404
            
            session.delete(member)
            return jsonify({'message': 'Member removed successfully'})
    except Exception as e:
        logger.error(f"Error removing workspace member: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== CAMPAIGN ROUTES ====================

@integrated_bp.route('/campaigns', methods=['GET'])
@auth_required
def get_campaigns():
    """Get all campaigns for current user"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Campaign, Post
        from sqlalchemy import func
        
        user_id = g.current_user['id']
        workspace_id = request.args.get('workspace_id')
        
        with db_session_scope() as session:
            query = session.query(Campaign).filter_by(user_id=user_id)
            if workspace_id:
                query = query.filter_by(workspace_id=workspace_id)
            
            campaigns = query.order_by(Campaign.created_at.desc()).all()
            
            result = []
            for c in campaigns:
                post_count = session.query(func.count(Post.id)).filter_by(campaign_id=c.id).scalar()
                result.append({
                    'id': c.id,
                    'name': c.name,
                    'description': c.description,
                    'status': c.status,
                    'start_date': c.start_date.isoformat() if c.start_date else None,
                    'end_date': c.end_date.isoformat() if c.end_date else None,
                    'goals': c.goals,
                    'tags': c.tags,
                    'color': c.color,
                    'post_count': post_count,
                    'created_at': c.created_at.isoformat() if c.created_at else None
                })
            
            return jsonify({'campaigns': result})
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/campaigns', methods=['POST'])
@auth_required
def create_campaign():
    """Create a new campaign"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Campaign
        import uuid
        
        data = request.get_json() or {}
        name = data.get('name', '').strip()
        
        if not name:
            return jsonify({'error': 'Campaign name is required'}), 400
        
        user_id = g.current_user['id']
        
        # Parse dates safely
        start_date = None
        end_date = None
        try:
            if data.get('start_date'):
                start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
            if data.get('end_date'):
                end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
        except ValueError as e:
            return jsonify({'error': f'Invalid date format: {e}'}), 400
        
        with db_session_scope() as session:
            campaign = Campaign(
                id=str(uuid.uuid4()),
                user_id=user_id,
                workspace_id=data.get('workspace_id'),
                name=name,
                description=data.get('description'),
                status=data.get('status', 'active'),
                start_date=start_date,
                end_date=end_date,
                goals=data.get('goals'),
                tags=data.get('tags'),
                color=data.get('color')
            )
            session.add(campaign)
            session.flush()
            
            return jsonify({
                'id': campaign.id,
                'name': campaign.name,
                'message': 'Campaign created successfully'
            }), 201
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/campaigns/<campaign_id>', methods=['PUT'])
@auth_required
def update_campaign(campaign_id):
    """Update a campaign"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Campaign
        
        data = request.get_json() or {}
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            campaign = session.query(Campaign).filter_by(id=campaign_id, user_id=user_id).first()
            if not campaign:
                return jsonify({'error': 'Campaign not found'}), 404
            
            if 'name' in data:
                campaign.name = data['name']
            if 'description' in data:
                campaign.description = data['description']
            if 'status' in data:
                campaign.status = data['status']
            
            # Parse dates safely
            try:
                if 'start_date' in data:
                    if data['start_date']:
                        campaign.start_date = datetime.fromisoformat(data['start_date'].replace('Z', '+00:00'))
                    else:
                        campaign.start_date = None
                if 'end_date' in data:
                    if data['end_date']:
                        campaign.end_date = datetime.fromisoformat(data['end_date'].replace('Z', '+00:00'))
                    else:
                        campaign.end_date = None
            except ValueError as e:
                return jsonify({'error': f'Invalid date format: {e}'}), 400
            
            if 'goals' in data:
                campaign.goals = data['goals']
            if 'tags' in data:
                campaign.tags = data['tags']
            if 'color' in data:
                campaign.color = data['color']
            
            return jsonify({'message': 'Campaign updated successfully'})
    except Exception as e:
        logger.error(f"Error updating campaign: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/campaigns/<campaign_id>', methods=['DELETE'])
@auth_required
def delete_campaign(campaign_id):
    """Delete a campaign"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Campaign, Post
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            campaign = session.query(Campaign).filter_by(id=campaign_id, user_id=user_id).first()
            if not campaign:
                return jsonify({'error': 'Campaign not found'}), 404
            
            # Unlink posts from this campaign (don't delete them)
            session.query(Post).filter_by(campaign_id=campaign_id).update({'campaign_id': None})
            
            session.delete(campaign)
            return jsonify({'message': 'Campaign deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting campaign: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/campaigns/<campaign_id>/posts', methods=['GET'])
@auth_required
def get_campaign_posts(campaign_id):
    """Get all posts in a campaign"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Campaign, Post
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            campaign = session.query(Campaign).filter_by(id=campaign_id, user_id=user_id).first()
            if not campaign:
                return jsonify({'error': 'Campaign not found'}), 404
            
            posts = session.query(Post).filter_by(campaign_id=campaign_id).order_by(Post.created_at.desc()).all()
            
            result = []
            for p in posts:
                result.append({
                    'id': p.id,
                    'content': p.content[:100] + ('...' if len(p.content) > 100 else ''),
                    'status': p.status.value if hasattr(p.status, 'value') else p.status,
                    'scheduled_time': p.scheduled_time.isoformat() if p.scheduled_time else None,
                    'published_at': p.published_at.isoformat() if p.published_at else None,
                    'created_at': p.created_at.isoformat() if p.created_at else None
                })
            
            return jsonify({'posts': result, 'count': len(result)})
    except Exception as e:
        logger.error(f"Error fetching campaign posts: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== POST COMMENT ROUTES ====================

@integrated_bp.route('/posts/<post_id>/comments', methods=['GET'])
@auth_required
def get_post_comments(post_id):
    """Get all comments on a post"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostComment, User
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            # Check access (user owns post or is in same workspace)
            if post.user_id != user_id:
                # TODO: Check workspace membership
                pass
            
            comments = session.query(PostComment).filter_by(
                post_id=post_id, parent_id=None
            ).order_by(PostComment.created_at.asc()).all()
            
            def serialize_comment(c):
                author = session.query(User).filter_by(id=c.user_id).first()
                replies = session.query(PostComment).filter_by(parent_id=c.id).all()
                return {
                    'id': c.id,
                    'content': c.content,
                    'is_resolved': c.is_resolved,
                    'author': {
                        'id': author.id if author else None,
                        'name': author.full_name if author else 'Unknown',
                        'email': author.email if author else None
                    },
                    'replies': [serialize_comment(r) for r in replies],
                    'created_at': c.created_at.isoformat() if c.created_at else None
                }
            
            return jsonify({
                'comments': [serialize_comment(c) for c in comments]
            })
    except Exception as e:
        logger.error(f"Error fetching comments: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/posts/<post_id>/comments', methods=['POST'])
@auth_required
def add_post_comment(post_id):
    """Add a comment to a post"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostComment
        import uuid
        
        data = request.get_json() or {}
        content = data.get('content', '').strip()
        
        if not content:
            return jsonify({'error': 'Comment content is required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            comment = PostComment(
                id=str(uuid.uuid4()),
                post_id=post_id,
                user_id=user_id,
                content=content,
                parent_id=data.get('parent_id')
            )
            session.add(comment)
            session.flush()
            
            return jsonify({
                'id': comment.id,
                'message': 'Comment added successfully'
            }), 201
    except Exception as e:
        logger.error(f"Error adding comment: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/posts/<post_id>/comments/<comment_id>/resolve', methods=['POST'])
@auth_required
def resolve_comment(post_id, comment_id):
    """Mark a comment as resolved"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import PostComment
        
        with db_session_scope() as session:
            comment = session.query(PostComment).filter_by(id=comment_id, post_id=post_id).first()
            if not comment:
                return jsonify({'error': 'Comment not found'}), 404
            
            comment.is_resolved = True
            return jsonify({'message': 'Comment resolved'})
    except Exception as e:
        logger.error(f"Error resolving comment: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== APPROVAL WORKFLOW ROUTES ====================

@integrated_bp.route('/posts/<post_id>/submit-for-approval', methods=['POST'])
@auth_required
def submit_for_approval(post_id):
    """Submit a post for approval"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostStatus
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id, user_id=user_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            if post.status not in [PostStatus.DRAFT]:
                return jsonify({'error': 'Only draft posts can be submitted for approval'}), 400
            
            post.status = PostStatus.PENDING_APPROVAL
            post.approval_status = None
            post.approved_by = None
            post.approved_at = None
            post.rejection_reason = None
            
            return jsonify({'message': 'Post submitted for approval'})
    except Exception as e:
        logger.error(f"Error submitting for approval: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/posts/<post_id>/approve', methods=['POST'])
@auth_required
def approve_post(post_id):
    """Approve a post (requires approval permission)"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostStatus
        
        user_id = g.current_user['id']
        data = request.get_json() or {}
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            if post.status != PostStatus.PENDING_APPROVAL:
                return jsonify({'error': 'Post is not pending approval'}), 400
            
            # Check if user has approval permission (admin or workspace approval rights)
            # For now, allow any user to approve any pending post
            
            post.status = PostStatus.SCHEDULED if post.scheduled_time else PostStatus.DRAFT
            post.approval_status = 'approved'
            post.approved_by = user_id
            post.approved_at = datetime.now(timezone.utc)
            
            return jsonify({'message': 'Post approved successfully'})
    except Exception as e:
        logger.error(f"Error approving post: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/posts/<post_id>/reject', methods=['POST'])
@auth_required
def reject_post(post_id):
    """Reject a post"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostStatus
        
        user_id = g.current_user['id']
        data = request.get_json() or {}
        reason = data.get('reason', '').strip()
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            if post.status != PostStatus.PENDING_APPROVAL:
                return jsonify({'error': 'Post is not pending approval'}), 400
            
            post.status = PostStatus.DRAFT
            post.approval_status = 'rejected'
            post.approved_by = user_id
            post.approved_at = datetime.now(timezone.utc)
            post.rejection_reason = reason
            
            return jsonify({'message': 'Post rejected'})
    except Exception as e:
        logger.error(f"Error rejecting post: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/posts/pending-approval', methods=['GET'])
@auth_required
def get_pending_approval_posts():
    """Get posts pending approval"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostStatus, User
        
        with db_session_scope() as session:
            posts = session.query(Post).filter_by(
                status=PostStatus.PENDING_APPROVAL
            ).order_by(Post.created_at.desc()).all()
            
            result = []
            for p in posts:
                author = session.query(User).filter_by(id=p.user_id).first()
                result.append({
                    'id': p.id,
                    'content': p.content,
                    'post_type': p.post_type,
                    'scheduled_time': p.scheduled_time.isoformat() if p.scheduled_time else None,
                    'author': {
                        'id': author.id if author else None,
                        'name': author.full_name if author else 'Unknown'
                    },
                    'created_at': p.created_at.isoformat() if p.created_at else None
                })
            
            return jsonify({'posts': result})
    except Exception as e:
        logger.error(f"Error fetching pending posts: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== CONTENT RECYCLING ROUTES ====================

@integrated_bp.route('/posts/<post_id>/mark-evergreen', methods=['POST'])
@auth_required
def mark_post_evergreen(post_id):
    """Mark a post as evergreen for recycling"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post
        
        user_id = g.current_user['id']
        data = request.get_json() or {}
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id, user_id=user_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            post.is_evergreen = data.get('is_evergreen', True)
            
            return jsonify({'message': 'Post updated successfully'})
    except Exception as e:
        logger.error(f"Error marking post evergreen: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/recycle-schedules', methods=['GET'])
@auth_required
def get_recycle_schedules():
    """Get all content recycle schedules"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import ContentRecycleSchedule, Post
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            schedules = session.query(ContentRecycleSchedule).filter_by(
                user_id=user_id
            ).all()
            
            result = []
            for s in schedules:
                post = session.query(Post).filter_by(id=s.post_id).first()
                result.append({
                    'id': s.id,
                    'post_id': s.post_id,
                    'post_content': post.content[:100] if post else None,
                    'recycle_interval_days': s.recycle_interval_days,
                    'next_recycle_at': s.next_recycle_at.isoformat() if s.next_recycle_at else None,
                    'max_recycles': s.max_recycles,
                    'current_recycle_count': s.current_recycle_count,
                    'modify_content': s.modify_content,
                    'modification_type': s.modification_type,
                    'is_active': s.is_active
                })
            
            return jsonify({'schedules': result})
    except Exception as e:
        logger.error(f"Error fetching recycle schedules: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/recycle-schedules', methods=['POST'])
@auth_required
def create_recycle_schedule():
    """Create a content recycle schedule"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import ContentRecycleSchedule, Post
        import uuid
        
        data = request.get_json() or {}
        post_id = data.get('post_id')
        
        if not post_id:
            return jsonify({'error': 'Post ID is required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id, user_id=user_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            # Mark post as evergreen
            post.is_evergreen = True
            
            interval_days = data.get('recycle_interval_days', 30)
            next_recycle = datetime.now(timezone.utc) + timedelta(days=interval_days)
            
            schedule = ContentRecycleSchedule(
                id=str(uuid.uuid4()),
                user_id=user_id,
                post_id=post_id,
                recycle_interval_days=interval_days,
                next_recycle_at=next_recycle,
                max_recycles=data.get('max_recycles', 0),
                modify_content=data.get('modify_content', True),
                modification_type=data.get('modification_type', 'ai_rewrite'),
                target_platforms=data.get('target_platforms')
            )
            session.add(schedule)
            session.flush()
            
            return jsonify({
                'id': schedule.id,
                'message': 'Recycle schedule created'
            }), 201
    except Exception as e:
        logger.error(f"Error creating recycle schedule: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/recycle-schedules/<schedule_id>', methods=['DELETE'])
@auth_required
def delete_recycle_schedule(schedule_id):
    """Delete a content recycle schedule"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import ContentRecycleSchedule
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            schedule = session.query(ContentRecycleSchedule).filter_by(
                id=schedule_id, user_id=user_id
            ).first()
            if not schedule:
                return jsonify({'error': 'Schedule not found'}), 404
            
            session.delete(schedule)
            return jsonify({'message': 'Schedule deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting recycle schedule: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== AUTO-ENGAGEMENT ROUTES ====================

@integrated_bp.route('/auto-engagements', methods=['GET'])
@auth_required
def get_auto_engagements():
    """Get all auto-engagement rules"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import AutoEngagement
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            rules = session.query(AutoEngagement).filter_by(user_id=user_id).all()
            
            result = []
            for r in rules:
                result.append({
                    'id': r.id,
                    'name': r.name,
                    'is_active': r.is_active,
                    'trigger_type': r.trigger_type,
                    'trigger_threshold': r.trigger_threshold,
                    'trigger_platform': r.trigger_platform,
                    'action_type': r.action_type,
                    'action_content': r.action_content,
                    'times_triggered': r.times_triggered,
                    'last_triggered_at': r.last_triggered_at.isoformat() if r.last_triggered_at else None
                })
            
            return jsonify({'rules': result})
    except Exception as e:
        logger.error(f"Error fetching auto-engagements: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/auto-engagements', methods=['POST'])
@auth_required
def create_auto_engagement():
    """Create an auto-engagement rule"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import AutoEngagement
        import uuid
        
        data = request.get_json() or {}
        
        required = ['name', 'trigger_type', 'trigger_threshold', 'action_type']
        for field in required:
            if not data.get(field):
                return jsonify({'error': f'{field} is required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            rule = AutoEngagement(
                id=str(uuid.uuid4()),
                user_id=user_id,
                name=data['name'],
                trigger_type=data['trigger_type'],
                trigger_threshold=int(data['trigger_threshold']),
                trigger_platform=data.get('trigger_platform'),
                action_type=data['action_type'],
                action_content=data.get('action_content'),
                action_options=data.get('action_options')
            )
            session.add(rule)
            session.flush()
            
            return jsonify({
                'id': rule.id,
                'message': 'Auto-engagement rule created'
            }), 201
    except Exception as e:
        logger.error(f"Error creating auto-engagement: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/auto-engagements/<rule_id>', methods=['DELETE'])
@auth_required
def delete_auto_engagement(rule_id):
    """Delete an auto-engagement rule"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import AutoEngagement
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            rule = session.query(AutoEngagement).filter_by(id=rule_id, user_id=user_id).first()
            if not rule:
                return jsonify({'error': 'Rule not found'}), 404
            
            session.delete(rule)
            return jsonify({'message': 'Rule deleted'})
    except Exception as e:
        logger.error(f"Error deleting auto-engagement: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== AI POST IDEAS GENERATION ====================

@integrated_bp.route('/ai/generate-post-ideas', methods=['POST'])
@auth_required
def generate_post_ideas():
    """Generate AI-powered post ideas from scratch"""
    try:
        import google.generativeai as genai
        
        data = request.get_json() or {}
        topic = data.get('topic', '').strip()
        industry = data.get('industry', '').strip()
        platform = data.get('platform', 'general')
        count = min(int(data.get('count', 5)), 10)  # Max 10 ideas
        tone = data.get('tone', 'professional')
        
        if not topic and not industry:
            return jsonify({'error': 'Either topic or industry is required'}), 400
        
        # Configure Gemini
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            return jsonify({'error': 'AI service not configured'}), 503
        
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""Generate {count} creative social media post ideas for the following:
Topic/Subject: {topic or 'General content'}
Industry: {industry or 'Not specified'}
Platform: {platform}
Tone: {tone}

For each idea, provide:
1. A catchy headline/hook
2. The full post content (ready to publish)
3. Suggested hashtags (5-10)
4. Best time to post (morning/afternoon/evening)
5. Content type suggestion (image, video, carousel, text-only)

Format your response as a JSON array with objects containing: headline, content, hashtags (array), best_time, content_type"""

        response = model.generate_content(prompt)
        response_text = response.text
        
        # Try to parse JSON from response
        import json
        try:
            # Clean up the response
            if '```json' in response_text:
                response_text = response_text.split('```json')[1].split('```')[0]
            elif '```' in response_text:
                response_text = response_text.split('```')[1].split('```')[0]
            
            ideas = json.loads(response_text)
        except:
            # If JSON parsing fails, return as structured text
            ideas = [{
                'headline': 'Generated Content',
                'content': response_text,
                'hashtags': [],
                'best_time': 'afternoon',
                'content_type': 'text-only'
            }]
        
        return jsonify({
            'ideas': ideas,
            'topic': topic,
            'industry': industry
        })
    except Exception as e:
        logger.error(f"Error generating post ideas: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== DRAG-AND-DROP CALENDAR RESCHEDULE ====================

@integrated_bp.route('/posts/<post_id>/reschedule', methods=['POST'])
@auth_required
def reschedule_post(post_id):
    """Reschedule a post (for drag-and-drop calendar)"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostStatus
        
        data = request.get_json() or {}
        new_time = data.get('scheduled_time')
        
        if not new_time:
            return jsonify({'error': 'scheduled_time is required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id, user_id=user_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            if post.status == PostStatus.PUBLISHED:
                return jsonify({'error': 'Cannot reschedule published posts'}), 400
            
            try:
                post.scheduled_time = datetime.fromisoformat(new_time.replace('Z', '+00:00'))
            except ValueError as e:
                return jsonify({'error': f'Invalid datetime format: {e}'}), 400
            
            # If draft and now has scheduled time, mark as scheduled
            if post.status == PostStatus.DRAFT and post.scheduled_time:
                post.status = PostStatus.SCHEDULED
            
            return jsonify({
                'message': 'Post rescheduled successfully',
                'new_time': post.scheduled_time.isoformat()
            })
    except Exception as e:
        logger.error(f"Error rescheduling post: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== POST TAGS MANAGEMENT ====================

@integrated_bp.route('/posts/<post_id>/tags', methods=['PUT'])
@auth_required
def update_post_tags(post_id):
    """Update tags on a post"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post
        
        data = request.get_json() or {}
        tags = data.get('tags', [])
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id, user_id=user_id).first()
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            post.tags = tags
            
            return jsonify({'message': 'Tags updated successfully'})
    except Exception as e:
        logger.error(f"Error updating tags: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/tags', methods=['GET'])
@auth_required
def get_all_tags():
    """Get all unique tags used by the user"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            posts = session.query(Post).filter_by(user_id=user_id).all()
            
            all_tags = set()
            for p in posts:
                if p.tags:
                    all_tags.update(p.tags)
            
            return jsonify({'tags': sorted(list(all_tags))})
    except Exception as e:
        logger.error(f"Error fetching tags: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== SMART QUEUE ROUTES ====================

@integrated_bp.route('/smart-queue/slots', methods=['GET'])
@auth_required
def get_queue_slots():
    """Get all smart queue time slots"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import SmartQueueSlot
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            slots = session.query(SmartQueueSlot).filter_by(
                user_id=user_id
            ).order_by(SmartQueueSlot.day_of_week, SmartQueueSlot.time_slot).all()
            
            result = []
            for s in slots:
                result.append({
                    'id': s.id,
                    'day_of_week': s.day_of_week,
                    'time_slot': s.time_slot,
                    'platform': s.platform,
                    'timezone': s.timezone,
                    'is_active': s.is_active
                })
            
            return jsonify({'slots': result})
    except Exception as e:
        logger.error(f"Error fetching queue slots: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/smart-queue/slots', methods=['POST'])
@auth_required
def create_queue_slot():
    """Create a smart queue time slot"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import SmartQueueSlot
        import uuid
        
        data = request.get_json() or {}
        
        if 'day_of_week' not in data or 'time_slot' not in data:
            return jsonify({'error': 'day_of_week and time_slot are required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            slot = SmartQueueSlot(
                id=str(uuid.uuid4()),
                user_id=user_id,
                day_of_week=int(data['day_of_week']),
                time_slot=data['time_slot'],
                platform=data.get('platform'),
                timezone=data.get('timezone', 'UTC'),
                is_active=data.get('is_active', True)
            )
            session.add(slot)
            session.flush()
            
            return jsonify({
                'id': slot.id,
                'message': 'Time slot created'
            }), 201
    except Exception as e:
        logger.error(f"Error creating queue slot: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/smart-queue/slots/<slot_id>', methods=['DELETE'])
@auth_required
def delete_queue_slot(slot_id):
    """Delete a smart queue time slot"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import SmartQueueSlot
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            slot = session.query(SmartQueueSlot).filter_by(
                id=slot_id, user_id=user_id
            ).first()
            if not slot:
                return jsonify({'error': 'Slot not found'}), 404
            
            session.delete(slot)
            return jsonify({'message': 'Slot deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting queue slot: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/smart-queue/items', methods=['GET'])
@auth_required
def get_queue_items():
    """Get all items in the smart queue"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import SmartQueueItem
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            items = session.query(SmartQueueItem).filter_by(
                user_id=user_id
            ).order_by(SmartQueueItem.position).all()
            
            result = []
            for item in items:
                result.append({
                    'id': item.id,
                    'content': item.content,
                    'media_urls': item.media_urls,
                    'platforms': item.platforms,
                    'post_type': item.post_type,
                    'position': item.position,
                    'scheduled_time': item.scheduled_time.isoformat() if item.scheduled_time else None,
                    'status': item.status,
                    'created_at': item.created_at.isoformat()
                })
            
            return jsonify({'items': result})
    except Exception as e:
        logger.error(f"Error fetching queue items: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/smart-queue/items', methods=['POST'])
@auth_required
def add_queue_item():
    """Add an item to the smart queue"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import SmartQueueItem
        import uuid
        
        data = request.get_json() or {}
        
        if not data.get('content') or not data.get('platforms'):
            return jsonify({'error': 'content and platforms are required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            # Get next position
            max_pos = session.query(SmartQueueItem).filter_by(
                user_id=user_id
            ).order_by(SmartQueueItem.position.desc()).first()
            next_pos = (max_pos.position + 1) if max_pos else 1
            
            item = SmartQueueItem(
                id=str(uuid.uuid4()),
                user_id=user_id,
                content=data['content'],
                media_urls=data.get('media_urls'),
                platforms=data['platforms'],
                post_type=data.get('post_type', 'standard'),
                position=next_pos,
                status='queued'
            )
            session.add(item)
            session.flush()
            
            return jsonify({
                'id': item.id,
                'position': item.position,
                'message': 'Item added to queue'
            }), 201
    except Exception as e:
        logger.error(f"Error adding queue item: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/smart-queue/items/<item_id>', methods=['DELETE'])
@auth_required
def remove_queue_item(item_id):
    """Remove an item from the smart queue"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import SmartQueueItem
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            item = session.query(SmartQueueItem).filter_by(
                id=item_id, user_id=user_id
            ).first()
            if not item:
                return jsonify({'error': 'Item not found'}), 404
            
            session.delete(item)
            return jsonify({'message': 'Item removed from queue'})
    except Exception as e:
        logger.error(f"Error removing queue item: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/smart-queue/items/reorder', methods=['POST'])
@auth_required
def reorder_queue_items():
    """Reorder items in the smart queue"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import SmartQueueItem
        
        data = request.get_json() or {}
        item_ids = data.get('item_ids', [])
        
        if not item_ids:
            return jsonify({'error': 'item_ids array is required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            for position, item_id in enumerate(item_ids, start=1):
                item = session.query(SmartQueueItem).filter_by(
                    id=item_id, user_id=user_id
                ).first()
                if item:
                    item.position = position
            
            return jsonify({'message': 'Queue reordered successfully'})
    except Exception as e:
        logger.error(f"Error reordering queue: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/smart-queue/schedule', methods=['POST'])
@auth_required
def schedule_queue():
    """Auto-schedule all queued items to available slots"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import SmartQueueItem, SmartQueueSlot, Post, PostStatus
        import uuid
        import pytz
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            # Get queued items
            items = session.query(SmartQueueItem).filter_by(
                user_id=user_id, status='queued'
            ).order_by(SmartQueueItem.position).all()
            
            if not items:
                return jsonify({'message': 'No items to schedule', 'scheduled': 0})
            
            # Get active time slots
            slots = session.query(SmartQueueSlot).filter_by(
                user_id=user_id, is_active=True
            ).order_by(SmartQueueSlot.day_of_week, SmartQueueSlot.time_slot).all()
            
            if not slots:
                return jsonify({'error': 'No active time slots configured'}), 400
            
            scheduled_count = 0
            now = datetime.now(timezone.utc)
            
            # Pre-calculate all available slot times for the next 4 weeks
            available_times = []
            for weeks_ahead in range(4):  # Look 4 weeks ahead
                for slot in slots:
                    days_ahead = slot.day_of_week - now.weekday()
                    if days_ahead < 0:
                        days_ahead += 7
                    days_ahead += (weeks_ahead * 7)
                    
                    slot_time = datetime.strptime(slot.time_slot, '%H:%M').time()
                    next_date = now.date() + timedelta(days=days_ahead)
                    
                    try:
                        tz = pytz.timezone(slot.timezone)
                        scheduled_dt = tz.localize(datetime.combine(next_date, slot_time))
                        scheduled_utc = scheduled_dt.astimezone(pytz.UTC)
                    except Exception:
                        scheduled_utc = datetime.combine(next_date, slot_time).replace(tzinfo=timezone.utc)
                    
                    # Only add if in the future
                    if scheduled_utc > now:
                        available_times.append((scheduled_utc, slot.id))
            
            # Sort by time
            available_times.sort(key=lambda x: x[0])
            
            # Assign items to slots in order
            slot_index = 0
            for item in items:
                if slot_index >= len(available_times):
                    break  # No more available slots
                
                scheduled_utc, slot_id = available_times[slot_index]
                slot_index += 1
                
                # Create post from queue item
                post = Post(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    content=item.content,
                    platforms=item.platforms,
                    status=PostStatus.SCHEDULED,
                    scheduled_time=scheduled_utc
                )
                session.add(post)
                
                # Update queue item
                item.status = 'scheduled'
                item.scheduled_time = scheduled_utc
                item.assigned_slot_id = slot_id
                
                scheduled_count += 1
            
            return jsonify({
                'message': f'Scheduled {scheduled_count} items',
                'scheduled': scheduled_count
            })
    except Exception as e:
        logger.error(f"Error scheduling queue: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== LINK-IN-BIO ROUTES ====================

@integrated_bp.route('/link-in-bio/pages', methods=['GET'])
@auth_required
def get_bio_pages():
    """Get all link-in-bio pages for the user"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage, LinkInBioLink
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            pages = session.query(LinkInBioPage).filter_by(user_id=user_id).all()
            
            result = []
            for page in pages:
                links = session.query(LinkInBioLink).filter_by(
                    page_id=page.id
                ).order_by(LinkInBioLink.position).all()
                
                result.append({
                    'id': page.id,
                    'slug': page.slug,
                    'title': page.title,
                    'bio': page.bio,
                    'avatar_url': page.avatar_url,
                    'theme': page.theme,
                    'background_color': page.background_color,
                    'button_style': page.button_style,
                    'social_links': page.social_links,
                    'total_views': page.total_views,
                    'total_clicks': page.total_clicks,
                    'is_active': page.is_active,
                    'links': [{
                        'id': l.id,
                        'title': l.title,
                        'url': l.url,
                        'icon': l.icon,
                        'thumbnail_url': l.thumbnail_url,
                        'position': l.position,
                        'click_count': l.click_count,
                        'is_active': l.is_active
                    } for l in links]
                })
            
            return jsonify({'pages': result})
    except Exception as e:
        logger.error(f"Error fetching bio pages: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/link-in-bio/pages', methods=['POST'])
@auth_required
def create_bio_page():
    """Create a new link-in-bio page"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage
        import uuid
        import re
        
        data = request.get_json() or {}
        
        if not data.get('title'):
            return jsonify({'error': 'title is required'}), 400
        
        # Generate slug from title if not provided
        slug = data.get('slug') or re.sub(r'[^a-z0-9]+', '-', data['title'].lower()).strip('-')
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            # Check if slug exists
            existing = session.query(LinkInBioPage).filter_by(slug=slug).first()
            if existing:
                slug = f"{slug}-{str(uuid.uuid4())[:8]}"
            
            page = LinkInBioPage(
                id=str(uuid.uuid4()),
                user_id=user_id,
                slug=slug,
                title=data['title'],
                bio=data.get('bio'),
                avatar_url=data.get('avatar_url'),
                theme=data.get('theme', 'default'),
                background_color=data.get('background_color', '#1a1a2e'),
                button_style=data.get('button_style', 'rounded'),
                social_links=data.get('social_links')
            )
            session.add(page)
            session.flush()
            
            return jsonify({
                'id': page.id,
                'slug': page.slug,
                'message': 'Page created successfully'
            }), 201
    except Exception as e:
        logger.error(f"Error creating bio page: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/link-in-bio/pages/<page_id>', methods=['PUT'])
@auth_required
def update_bio_page(page_id):
    """Update a link-in-bio page"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage
        
        data = request.get_json() or {}
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            page = session.query(LinkInBioPage).filter_by(
                id=page_id, user_id=user_id
            ).first()
            if not page:
                return jsonify({'error': 'Page not found'}), 404
            
            if 'title' in data:
                page.title = data['title']
            if 'bio' in data:
                page.bio = data['bio']
            if 'avatar_url' in data:
                page.avatar_url = data['avatar_url']
            if 'theme' in data:
                page.theme = data['theme']
            if 'background_color' in data:
                page.background_color = data['background_color']
            if 'button_style' in data:
                page.button_style = data['button_style']
            if 'social_links' in data:
                page.social_links = data['social_links']
            if 'is_active' in data:
                page.is_active = data['is_active']
            
            return jsonify({'message': 'Page updated successfully'})
    except Exception as e:
        logger.error(f"Error updating bio page: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/link-in-bio/pages/<page_id>', methods=['DELETE'])
@auth_required
def delete_bio_page(page_id):
    """Delete a link-in-bio page"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            page = session.query(LinkInBioPage).filter_by(
                id=page_id, user_id=user_id
            ).first()
            if not page:
                return jsonify({'error': 'Page not found'}), 404
            
            session.delete(page)
            return jsonify({'message': 'Page deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting bio page: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/link-in-bio/pages/<page_id>/links', methods=['POST'])
@auth_required
def add_bio_link(page_id):
    """Add a link to a bio page"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage, LinkInBioLink
        import uuid
        
        data = request.get_json() or {}
        
        if not data.get('title') or not data.get('url'):
            return jsonify({'error': 'title and url are required'}), 400
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            page = session.query(LinkInBioPage).filter_by(
                id=page_id, user_id=user_id
            ).first()
            if not page:
                return jsonify({'error': 'Page not found'}), 404
            
            # Get next position
            max_pos = session.query(LinkInBioLink).filter_by(
                page_id=page_id
            ).order_by(LinkInBioLink.position.desc()).first()
            next_pos = (max_pos.position + 1) if max_pos else 1
            
            link = LinkInBioLink(
                id=str(uuid.uuid4()),
                page_id=page_id,
                title=data['title'],
                url=data['url'],
                icon=data.get('icon'),
                thumbnail_url=data.get('thumbnail_url'),
                position=next_pos
            )
            session.add(link)
            session.flush()
            
            return jsonify({
                'id': link.id,
                'position': link.position,
                'message': 'Link added successfully'
            }), 201
    except Exception as e:
        logger.error(f"Error adding bio link: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/link-in-bio/links/<link_id>', methods=['PUT'])
@auth_required
def update_bio_link(link_id):
    """Update a bio link"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage, LinkInBioLink
        
        data = request.get_json() or {}
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            link = session.query(LinkInBioLink).join(LinkInBioPage).filter(
                LinkInBioLink.id == link_id,
                LinkInBioPage.user_id == user_id
            ).first()
            if not link:
                return jsonify({'error': 'Link not found'}), 404
            
            if 'title' in data:
                link.title = data['title']
            if 'url' in data:
                link.url = data['url']
            if 'icon' in data:
                link.icon = data['icon']
            if 'thumbnail_url' in data:
                link.thumbnail_url = data['thumbnail_url']
            if 'is_active' in data:
                link.is_active = data['is_active']
            
            return jsonify({'message': 'Link updated successfully'})
    except Exception as e:
        logger.error(f"Error updating bio link: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/link-in-bio/links/<link_id>', methods=['DELETE'])
@auth_required
def delete_bio_link(link_id):
    """Delete a bio link"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage, LinkInBioLink
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            link = session.query(LinkInBioLink).join(LinkInBioPage).filter(
                LinkInBioLink.id == link_id,
                LinkInBioPage.user_id == user_id
            ).first()
            if not link:
                return jsonify({'error': 'Link not found'}), 404
            
            session.delete(link)
            return jsonify({'message': 'Link deleted successfully'})
    except Exception as e:
        logger.error(f"Error deleting bio link: {e}")
        return jsonify({'error': str(e)}), 500


# Public bio page view (no auth required)
@integrated_bp.route('/bio/<slug>', methods=['GET'])
def view_bio_page(slug):
    """View a public link-in-bio page"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage, LinkInBioLink
        
        with db_session_scope() as session:
            page = session.query(LinkInBioPage).filter_by(
                slug=slug, is_active=True
            ).first()
            if not page:
                return jsonify({'error': 'Page not found'}), 404
            
            # Increment view count
            page.total_views += 1
            
            links = session.query(LinkInBioLink).filter_by(
                page_id=page.id, is_active=True
            ).order_by(LinkInBioLink.position).all()
            
            return jsonify({
                'title': page.title,
                'bio': page.bio,
                'avatar_url': page.avatar_url,
                'theme': page.theme,
                'background_color': page.background_color,
                'button_style': page.button_style,
                'social_links': page.social_links,
                'links': [{
                    'id': l.id,
                    'title': l.title,
                    'url': l.url,
                    'icon': l.icon,
                    'thumbnail_url': l.thumbnail_url
                } for l in links]
            })
    except Exception as e:
        logger.error(f"Error viewing bio page: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/bio/<slug>/click/<link_id>', methods=['POST'])
def track_bio_click(slug, link_id):
    """Track a click on a bio link"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import LinkInBioPage, LinkInBioLink
        
        with db_session_scope() as session:
            page = session.query(LinkInBioPage).filter_by(
                slug=slug, is_active=True
            ).first()
            if not page:
                return jsonify({'error': 'Page not found'}), 404
            
            link = session.query(LinkInBioLink).filter_by(
                id=link_id, page_id=page.id
            ).first()
            if not link:
                return jsonify({'error': 'Link not found'}), 404
            
            link.click_count += 1
            page.total_clicks += 1
            
            return jsonify({
                'url': link.url,
                'tracked': True
            })
    except Exception as e:
        logger.error(f"Error tracking bio click: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== UNIFIED INBOX ROUTES ====================

@integrated_bp.route('/inbox', methods=['GET'])
@auth_required
def get_inbox():
    """Get unified inbox items"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import UnifiedInboxItem, Account
        
        user_id = g.current_user['id']
        item_type = request.args.get('type')  # comment, dm, mention
        platform = request.args.get('platform')
        is_read = request.args.get('is_read')
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 50)), 100)
        
        with db_session_scope() as session:
            query = session.query(UnifiedInboxItem).filter_by(
                user_id=user_id, is_archived=False
            )
            
            if item_type:
                query = query.filter(UnifiedInboxItem.item_type == item_type)
            if platform:
                query = query.filter(UnifiedInboxItem.platform == platform)
            if is_read is not None:
                query = query.filter(UnifiedInboxItem.is_read == (is_read.lower() == 'true'))
            
            total = query.count()
            items = query.order_by(UnifiedInboxItem.received_at.desc())\
                         .offset((page - 1) * per_page)\
                         .limit(per_page).all()
            
            result = []
            for item in items:
                account = session.query(Account).filter_by(id=item.account_id).first()
                result.append({
                    'id': item.id,
                    'item_type': item.item_type,
                    'platform': item.platform,
                    'account_name': account.display_name if account else None,
                    'content': item.content,
                    'author_name': item.author_name,
                    'author_username': item.author_username,
                    'author_avatar': item.author_avatar,
                    'related_post_id': item.related_post_id,
                    'is_read': item.is_read,
                    'is_replied': item.is_replied,
                    'sentiment': item.sentiment,
                    'received_at': item.received_at.isoformat()
                })
            
            return jsonify({
                'items': result,
                'total': total,
                'page': page,
                'per_page': per_page,
                'pages': (total + per_page - 1) // per_page
            })
    except Exception as e:
        logger.error(f"Error fetching inbox: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/inbox/<item_id>/read', methods=['POST'])
@auth_required
def mark_inbox_read(item_id):
    """Mark inbox item as read"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import UnifiedInboxItem
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            item = session.query(UnifiedInboxItem).filter_by(
                id=item_id, user_id=user_id
            ).first()
            if not item:
                return jsonify({'error': 'Item not found'}), 404
            
            item.is_read = True
            return jsonify({'message': 'Marked as read'})
    except Exception as e:
        logger.error(f"Error marking inbox read: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/inbox/<item_id>/archive', methods=['POST'])
@auth_required
def archive_inbox_item(item_id):
    """Archive inbox item"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import UnifiedInboxItem
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            item = session.query(UnifiedInboxItem).filter_by(
                id=item_id, user_id=user_id
            ).first()
            if not item:
                return jsonify({'error': 'Item not found'}), 404
            
            item.is_archived = True
            return jsonify({'message': 'Item archived'})
    except Exception as e:
        logger.error(f"Error archiving inbox item: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/inbox/mark-all-read', methods=['POST'])
@auth_required
def mark_all_inbox_read():
    """Mark all inbox items as read"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import UnifiedInboxItem
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            session.query(UnifiedInboxItem).filter_by(
                user_id=user_id, is_read=False
            ).update({'is_read': True})
            
            return jsonify({'message': 'All items marked as read'})
    except Exception as e:
        logger.error(f"Error marking all read: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/inbox/stats', methods=['GET'])
@auth_required
def get_inbox_stats():
    """Get inbox statistics"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import UnifiedInboxItem
        from sqlalchemy import func
        
        user_id = g.current_user['id']
        
        with db_session_scope() as session:
            total = session.query(UnifiedInboxItem).filter_by(
                user_id=user_id, is_archived=False
            ).count()
            
            unread = session.query(UnifiedInboxItem).filter_by(
                user_id=user_id, is_archived=False, is_read=False
            ).count()
            
            by_type = session.query(
                UnifiedInboxItem.item_type,
                func.count(UnifiedInboxItem.id)
            ).filter_by(
                user_id=user_id, is_archived=False
            ).group_by(UnifiedInboxItem.item_type).all()
            
            by_platform = session.query(
                UnifiedInboxItem.platform,
                func.count(UnifiedInboxItem.id)
            ).filter_by(
                user_id=user_id, is_archived=False
            ).group_by(UnifiedInboxItem.platform).all()
            
            return jsonify({
                'total': total,
                'unread': unread,
                'by_type': dict(by_type),
                'by_platform': dict(by_platform)
            })
    except Exception as e:
        logger.error(f"Error fetching inbox stats: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== TRENDING KEYWORDS ROUTES ====================

@integrated_bp.route('/trending', methods=['GET'])
@auth_required
def get_trending():
    """Get trending keywords/hashtags"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import TrendingKeyword
        
        platform = request.args.get('platform')
        location = request.args.get('location', 'worldwide')
        category = request.args.get('category')
        limit = min(int(request.args.get('limit', 50)), 100)
        
        now = datetime.now(timezone.utc)
        
        with db_session_scope() as session:
            query = session.query(TrendingKeyword).filter(
                TrendingKeyword.expires_at > now
            )
            
            if platform:
                query = query.filter(TrendingKeyword.platform == platform)
            if location:
                query = query.filter(TrendingKeyword.location == location)
            if category:
                query = query.filter(TrendingKeyword.category == category)
            
            trends = query.order_by(TrendingKeyword.trend_rank).limit(limit).all()
            
            result = []
            for t in trends:
                result.append({
                    'keyword': t.keyword,
                    'hashtag': t.hashtag,
                    'platform': t.platform,
                    'volume': t.trend_volume,
                    'rank': t.trend_rank,
                    'category': t.category,
                    'location': t.location
                })
            
            return jsonify({'trends': result})
    except Exception as e:
        logger.error(f"Error fetching trends: {e}")
        return jsonify({'error': str(e)}), 500


@integrated_bp.route('/trending/refresh', methods=['POST'])
@auth_required
def refresh_trending():
    """Refresh trending data from platforms (simulated)"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import TrendingKeyword
        import uuid
        import random
        
        # Simulated trending data - in production this would fetch from APIs
        platforms = ['twitter', 'instagram', 'tiktok', 'linkedin']
        sample_trends = [
            {'keyword': 'AI', 'hashtag': '#AI', 'category': 'Technology'},
            {'keyword': 'Marketing', 'hashtag': '#Marketing', 'category': 'Business'},
            {'keyword': 'Startup', 'hashtag': '#Startup', 'category': 'Business'},
            {'keyword': 'ContentCreator', 'hashtag': '#ContentCreator', 'category': 'Social'},
            {'keyword': 'SocialMedia', 'hashtag': '#SocialMedia', 'category': 'Technology'},
            {'keyword': 'DigitalMarketing', 'hashtag': '#DigitalMarketing', 'category': 'Business'},
            {'keyword': 'Influencer', 'hashtag': '#Influencer', 'category': 'Social'},
            {'keyword': 'Growth', 'hashtag': '#Growth', 'category': 'Business'},
            {'keyword': 'Innovation', 'hashtag': '#Innovation', 'category': 'Technology'},
            {'keyword': 'Productivity', 'hashtag': '#Productivity', 'category': 'Lifestyle'},
        ]
        
        now = datetime.now(timezone.utc)
        expires = now + timedelta(hours=1)
        
        with db_session_scope() as session:
            # Clear old trends
            session.query(TrendingKeyword).filter(
                TrendingKeyword.expires_at < now
            ).delete()
            
            created = 0
            for platform in platforms:
                for rank, trend in enumerate(sample_trends, start=1):
                    existing = session.query(TrendingKeyword).filter_by(
                        platform=platform,
                        keyword=trend['keyword']
                    ).first()
                    
                    if not existing:
                        t = TrendingKeyword(
                            id=str(uuid.uuid4()),
                            platform=platform,
                            keyword=trend['keyword'],
                            hashtag=trend['hashtag'],
                            trend_volume=random.randint(1000, 100000),
                            trend_rank=rank,
                            category=trend['category'],
                            location='worldwide',
                            fetched_at=now,
                            expires_at=expires
                        )
                        session.add(t)
                        created += 1
            
            return jsonify({
                'message': 'Trends refreshed',
                'created': created
            })
    except Exception as e:
        logger.error(f"Error refreshing trends: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== BULK RESCHEDULE ROUTE ====================

@integrated_bp.route('/bulk/posts/reschedule', methods=['POST'])
@auth_required
@role_required('editor')
def bulk_reschedule_posts():
    """Bulk reschedule posts"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from models import Post, PostStatus
        
        data = request.get_json() or {}
        reschedules = data.get('reschedules', [])  # [{id: post_id, scheduled_time: ISO string}]
        
        if not reschedules:
            return jsonify({'error': 'No reschedules provided'}), 400
        
        if len(reschedules) > MAX_BULK_OPERATION_SIZE:
            return jsonify({'error': f'Maximum {MAX_BULK_OPERATION_SIZE} reschedules per operation'}), 400
        
        user_id = g.current_user['id']
        
        results = {'successful': [], 'failed': []}
        
        with db_session_scope() as session:
            for item in reschedules:
                post_id = item.get('id')
                new_time = item.get('scheduled_time')
                
                if not post_id or not new_time:
                    results['failed'].append({'id': post_id, 'error': 'Missing id or scheduled_time'})
                    continue
                
                post = session.query(Post).filter_by(id=post_id, user_id=user_id).first()
                if not post:
                    results['failed'].append({'id': post_id, 'error': 'Post not found'})
                    continue
                
                if post.status not in [PostStatus.DRAFT, PostStatus.SCHEDULED, PostStatus.PENDING_APPROVAL]:
                    results['failed'].append({'id': post_id, 'error': 'Cannot reschedule this post'})
                    continue
                
                try:
                    post.scheduled_time = datetime.fromisoformat(new_time.replace('Z', '+00:00'))
                    post.status = PostStatus.SCHEDULED
                    results['successful'].append({'id': post_id, 'new_time': post.scheduled_time.isoformat()})
                except Exception as e:
                    results['failed'].append({'id': post_id, 'error': str(e)})
        
        return jsonify(results)
    except Exception as e:
        logger.error(f"Error bulk rescheduling: {e}")
        return jsonify({'error': str(e)}), 500


# ==================== STATUS & HEALTH ROUTES ====================

@integrated_bp.route('/status', methods=['GET'])
def get_status():
    """Get system status"""
    return jsonify({
        'database': DB_ENABLED,
        'oauth': oauth_manager.enabled,
        'media': media_manager.enabled,
        'analytics': analytics_collector.enabled,
        'webhooks': webhook_manager.enabled,
        'timestamp': datetime.now(timezone.utc).isoformat()
    })


logger.info("Integrated routes initialized")
