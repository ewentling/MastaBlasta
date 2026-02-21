"""
Integrated Routes for MastaBlasta
New endpoints that use production infrastructure

These routes implement the 9 improvements by using the managers from app_extensions.py
"""

from flask import Blueprint, request, jsonify, g, send_file, session
from datetime import datetime, timezone
import logging
import os

from app_extensions import (
    db_manager, oauth_manager, media_manager, analytics_collector,
    webhook_manager, search_manager, bulk_ops_manager, retry_manager,
    auth_required, role_required, DB_ENABLED
)

logger = logging.getLogger(__name__)

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

            return jsonify({
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.full_name,
                    'role': user.role.value
                },
                'access_token': access_token,
                'refresh_token': refresh_token,
                'api_key': user.api_key
            }), 201

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

            return jsonify({
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'name': user.full_name,
                    'role': user.role.value
                },
                'access_token': access_token,
                'refresh_token': refresh_token,
                'password_must_change': user.password_must_change  # Include password change requirement
            })

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

            return jsonify({
                'access_token': new_access_token,
                'refresh_token': new_refresh_token,
            })

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

                return jsonify({
                    'user': {
                        'id': user.id,
                        'email': user.email,
                        'name': user.full_name,
                        'role': user.role.value
                    },
                    'access_token': access_token,
                    'refresh_token': refresh_token,
                    'api_key': user.api_key
                }), 200

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
    result = oauth_manager.get_authorization_url(platform, g.current_user['id'])

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
        return jsonify(result), 400

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
    limit = min(100, max(1, int(request.args.get('limit', 50))))
    offset = max(0, int(request.args.get('offset', 0)))

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
        if not str(resolved).startswith(str(media_root)):
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

    limit = min(100, max(1, int(request.args.get('limit', 50))))
    offset = max(0, int(request.args.get('offset', 0)))

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

    limit = min(100, max(1, int(request.args.get('limit', 50))))
    offset = max(0, int(request.args.get('offset', 0)))

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

    # Validate webhook URL to prevent SSRF attacks
    if not InputSanitizer.validate_url(url):
        return jsonify({'error': 'Invalid webhook URL. Must be a public https:// URL.'}), 400

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
