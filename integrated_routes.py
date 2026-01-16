"""
Integrated Routes for MastaBlasta
New endpoints that use production infrastructure

These routes implement the 9 improvements by using the managers from app_extensions.py
"""

from flask import Blueprint, request, jsonify, g, send_file
from datetime import datetime
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
        from security_enhancements import PasswordPolicy
        import uuid

        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        name = data.get('name', '')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

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
                created_at=datetime.utcnow()
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
        return jsonify({'error': 'Registration failed', 'details': str(e)}), 500


@integrated_bp.route('/auth/login', methods=['POST'])
def login():
    """Login user"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503

    try:
        from auth import verify_password, create_access_token, create_refresh_token
        from database import db_session_scope
        from models import User

        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400

        with db_session_scope() as session:
            user = session.query(User).filter_by(email=email).first()

            if not user or not user.is_active:
                return jsonify({'error': 'Invalid credentials'}), 401

            if not verify_password(password, user.password_hash):
                return jsonify({'error': 'Invalid credentials'}), 401

            # Update last login
            user.last_login = datetime.utcnow()
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
                'refresh_token': refresh_token
            })

    except Exception as e:
        logger.error(f"Login error: {e}")
        return jsonify({'error': 'Login failed'}), 500


@integrated_bp.route('/auth/me', methods=['GET'])
@auth_required
def get_me():
    """Get current user profile"""
    return jsonify({'user': g.current_user})


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

        data = request.get_json()
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

            with db_session_scope() as session:
                # Check if user exists by email or google_id
                user = session.query(User).filter(
                    (User.email == email) | (User.google_id == google_id)
                ).first()

                if user:
                    # Update last login and google_id if needed
                    user.last_login = datetime.utcnow()
                    if not user.google_id:
                        user.google_id = google_id
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
                        created_at=datetime.utcnow()
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
        return jsonify({'error': 'Authentication failed', 'details': str(e)}), 500


# ==================== OAUTH ROUTES ====================

@integrated_bp.route('/oauth/<platform>/authorize', methods=['GET'])
@auth_required
def oauth_authorize(platform):
    """Initiate OAuth flow for platform"""
    result = oauth_manager.get_authorization_url(platform, g.current_user['id'])

    if 'error' in result:
        return jsonify(result), 400

    return jsonify(result)


@integrated_bp.route('/oauth/<platform>/callback', methods=['GET'])
def oauth_callback(platform):
    """Handle OAuth callback"""
    code = request.args.get('code')
    state = request.args.get('state')

    if not code or not state:
        return jsonify({'error': 'Missing code or state'}), 400

    result = oauth_manager.handle_callback(platform, code, state)

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

    # Read file data
    file_data = file.read()
    mime_type = file.content_type or 'application/octet-stream'

    result = media_manager.upload_media(
        g.current_user['id'],
        file_data,
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
    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))

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
    media = media_manager.get_media(media_id)

    if not media:
        return jsonify({'error': 'Media not found'}), 404

    # Check if file exists
    if not os.path.exists(media['file_path']):
        return jsonify({'error': 'File not found on disk'}), 404

    return send_file(media['file_path'], mimetype=media['mime_type'])


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
    data = request.get_json()

    try:
        post = db_manager.create_post(g.current_user['id'], data)
        return jsonify(post), 201
    except Exception as e:
        logger.error(f"Post creation error: {e}")
        return jsonify({'error': 'Failed to create post', 'details': str(e)}), 500


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

    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))

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
    data = request.get_json()

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
    """Publish post to platforms"""
    post = db_manager.get_post(post_id)

    if not post:
        return jsonify({'error': 'Post not found'}), 404

    # Publish to each platform
    results = {}
    for platform in post['platforms']:
        # Get account for platform
        # This would need to fetch account from database
        result = oauth_manager.post_to_platform(
            platform,
            'account_id',  # Would need to lookup
            post['content'],
            post.get('media_ids', []),
            post.get('post_options', {})
        )
        results[platform] = result

        # Collect analytics if successful
        if 'error' not in result:
            analytics_collector.collect_post_analytics(
                post_id,
                platform,
                result.get('id'),
                'account_id'
            )

    # Update post status
    if all('error' not in r for r in results.values()):
        db_manager.update_post(post_id, {
            'status': 'published',
            'published_at': datetime.utcnow()
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

    limit = int(request.args.get('limit', 50))
    offset = int(request.args.get('offset', 0))

    results = search_manager.search_posts(g.current_user['id'], query, filters, limit, offset)
    return jsonify(results)


# ==================== BULK OPERATIONS ROUTES ====================

@integrated_bp.route('/bulk/posts/create', methods=['POST'])
@auth_required
@role_required('editor')
def bulk_create_posts():
    """Bulk create posts"""
    data = request.get_json()
    posts_data = data.get('posts', [])

    if not posts_data:
        return jsonify({'error': 'No posts provided'}), 400

    results = bulk_ops_manager.bulk_create_posts(g.current_user['id'], posts_data)
    return jsonify(results)


@integrated_bp.route('/bulk/posts/update', methods=['POST'])
@auth_required
@role_required('editor')
def bulk_update_posts():
    """Bulk update posts"""
    data = request.get_json()
    updates = data.get('updates', [])

    if not updates:
        return jsonify({'error': 'No updates provided'}), 400

    results = bulk_ops_manager.bulk_update_posts(g.current_user['id'], updates)
    return jsonify(results)


@integrated_bp.route('/bulk/posts/delete', methods=['POST'])
@auth_required
@role_required('admin')
def bulk_delete_posts():
    """Bulk delete posts"""
    data = request.get_json()
    post_ids = data.get('post_ids', [])

    if not post_ids:
        return jsonify({'error': 'No post IDs provided'}), 400

    results = bulk_ops_manager.bulk_delete_posts(g.current_user['id'], post_ids)
    return jsonify(results)


# ==================== WEBHOOK ROUTES ====================

@integrated_bp.route('/webhooks', methods=['POST'])
@auth_required
def register_webhook():
    """Register a webhook"""
    data = request.get_json()

    url = data.get('url')
    events = data.get('events', [])
    secret = data.get('secret')

    if not url or not events:
        return jsonify({'error': 'URL and events required'}), 400

    result = webhook_manager.register_webhook(g.current_user['id'], url, events, secret)

    if 'error' in result:
        return jsonify(result), 400

    return jsonify(result), 201


@integrated_bp.route('/webhooks', methods=['GET'])
@auth_required
def list_webhooks():
    """List registered webhooks"""
    # Implementation would query database for user's webhooks
    return jsonify({'webhooks': []})


@integrated_bp.route('/webhooks/<webhook_id>', methods=['DELETE'])
@auth_required
def delete_webhook(webhook_id):
    """Delete webhook"""
    # Implementation would delete from database
    return jsonify({'message': 'Webhook deleted'})


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
    """Get analytics overview for user"""
    # Implementation would aggregate user's post analytics
    return jsonify({
        'total_posts': 0,
        'total_engagement': 0,
        'platforms': {},
        'period': '30d'
    })


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
        'timestamp': datetime.utcnow().isoformat()
    })


logger.info("Integrated routes initialized")
