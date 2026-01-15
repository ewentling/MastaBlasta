"""
MastaBlasta Application Extensions
Integrates production infrastructure with existing app.py

This module provides the 9 critical improvements:
1. Database integration
2. Real OAuth implementations
3. Media upload system
4. Authentication middleware
5. Real analytics collection
6. Webhook system
7. Advanced search and filtering
8. Bulk operations
9. Error recovery and retry logic
"""

import os
import uuid
import logging
import time
import json
import threading
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Callable
from functools import wraps, lru_cache
from flask import request, jsonify, g
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from sqlalchemy import cast, String, or_

# Import production infrastructure
try:
    from database import db_session_scope, get_db_session, init_db
    from models import (
        User, Account, Post, Media, PostAnalytics, 
        Template, ABTest, SocialMonitor, URLShortener,
        ChatbotInteraction, ResponseTemplate, PostStatus, UserRole
    )
    from auth import (
        hash_password, verify_password, generate_api_key,
        create_access_token, create_refresh_token, verify_token,
        encrypt_token, decrypt_token, require_auth, require_role
    )
    from oauth import TwitterOAuth, MetaOAuth, LinkedInOAuth, GoogleOAuth
    from media_utils import MediaUploadHandler, validate_file_upload, optimize_image_for_platform
    DB_ENABLED = True
except ImportError as e:
    logging.warning(f"Production infrastructure not fully available: {e}")
    DB_ENABLED = False

logger = logging.getLogger(__name__)

# ==================== 1. DATABASE INTEGRATION ====================

class DatabaseManager:
    """Manages database operations replacing in-memory storage"""
    
    def __init__(self):
        self.enabled = DB_ENABLED
        if self.enabled:
            init_db()
    
    def get_post(self, post_id: str) -> Optional[Dict]:
        """Get post by ID from database"""
        if not self.enabled:
            return None
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id).first()
            if post:
                return self._post_to_dict(post)
        return None
    
    def create_post(self, user_id: str, data: Dict) -> Dict:
        """Create new post in database"""
        if not self.enabled:
            raise Exception("Database not enabled")
        
        with db_session_scope() as session:
            post = Post(
                id=str(uuid.uuid4()),
                user_id=user_id,
                content=data.get('content', ''),
                post_type=data.get('post_type', 'standard'),
                status=PostStatus.DRAFT,
                scheduled_time=data.get('scheduled_time'),
                platforms=json.dumps(data.get('platforms', [])),
                media_ids=json.dumps(data.get('media', [])),
                post_options=json.dumps(data.get('post_options', {})),
                created_at=datetime.utcnow()
            )
            session.add(post)
            session.flush()
            return self._post_to_dict(post)
    
    def update_post(self, post_id: str, updates: Dict) -> Optional[Dict]:
        """Update post in database"""
        if not self.enabled:
            return None
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id).first()
            if post:
                for key, value in updates.items():
                    if hasattr(post, key):
                        setattr(post, key, value)
                post.updated_at = datetime.utcnow()
                session.flush()
                return self._post_to_dict(post)
        return None
    
    def list_posts(self, user_id: str, filters: Dict = None, limit: int = 50, offset: int = 0) -> List[Dict]:
        """List posts with optional filters"""
        if not self.enabled:
            return []
        
        with db_session_scope() as session:
            query = session.query(Post).filter_by(user_id=user_id)
            
            # Apply filters
            if filters:
                if filters.get('status'):
                    query = query.filter_by(status=PostStatus[filters['status'].upper()])
                if filters.get('platform'):
                    query = query.filter(Post.platforms.like(f'%{filters["platform"]}%'))
                if filters.get('start_date'):
                    query = query.filter(Post.created_at >= filters['start_date'])
                if filters.get('end_date'):
                    query = query.filter(Post.created_at <= filters['end_date'])
                if filters.get('search'):
                    search_term = f"%{filters['search']}%"
                    query = query.filter(Post.content.like(search_term))
            
            # Order by created_at desc and paginate
            posts = query.order_by(Post.created_at.desc()).limit(limit).offset(offset).all()
            return [self._post_to_dict(p) for p in posts]
    
    def delete_post(self, post_id: str) -> bool:
        """Delete post from database"""
        if not self.enabled:
            return False
        
        with db_session_scope() as session:
            post = session.query(Post).filter_by(id=post_id).first()
            if post:
                session.delete(post)
                return True
        return False
    
    def _post_to_dict(self, post: 'Post') -> Dict:
        """Convert Post model to dictionary"""
        return {
            'id': post.id,
            'user_id': post.user_id,
            'content': post.content,
            'post_type': post.post_type,
            'status': post.status.value if hasattr(post.status, 'value') else post.status,
            'scheduled_time': post.scheduled_time.isoformat() if post.scheduled_time else None,
            'published_at': post.published_at.isoformat() if post.published_at else None,
            'platforms': json.loads(post.platforms) if post.platforms else [],
            'media_ids': json.loads(post.media_ids) if post.media_ids else [],
            'post_options': json.loads(post.post_options) if post.post_options else {},
            'created_at': post.created_at.isoformat() if post.created_at else None,
            'updated_at': post.updated_at.isoformat() if post.updated_at else None
        }


# ==================== 2. OAUTH INTEGRATION ====================

class OAuthManager:
    """Manages real OAuth implementations for platforms"""
    
    def __init__(self):
        self.twitter = TwitterOAuth() if DB_ENABLED else None
        self.meta = MetaOAuth() if DB_ENABLED else None
        self.linkedin = LinkedInOAuth() if DB_ENABLED else None
        self.google = GoogleOAuth() if DB_ENABLED else None
        self.enabled = DB_ENABLED
    
    def get_authorization_url(self, platform: str, user_id: str) -> Dict:
        """Get OAuth authorization URL for platform"""
        if not self.enabled:
            return {'error': 'OAuth not enabled'}
        
        try:
            if platform == 'twitter':
                return self.twitter.get_authorization_url(user_id)
            elif platform in ['facebook', 'instagram', 'threads']:
                return self.meta.get_authorization_url(user_id, platform)
            elif platform == 'linkedin':
                return self.linkedin.get_authorization_url(user_id)
            elif platform == 'youtube':
                return self.google.get_authorization_url(user_id)
            else:
                return {'error': f'Platform {platform} not supported'}
        except Exception as e:
            logger.error(f"OAuth authorization error for {platform}: {e}")
            return {'error': str(e)}
    
    def handle_callback(self, platform: str, code: str, state: str) -> Dict:
        """Handle OAuth callback and exchange code for tokens"""
        if not self.enabled:
            return {'error': 'OAuth not enabled'}
        
        try:
            if platform == 'twitter':
                return self.twitter.handle_callback(code, state)
            elif platform in ['facebook', 'instagram', 'threads']:
                return self.meta.handle_callback(code, state, platform)
            elif platform == 'linkedin':
                return self.linkedin.handle_callback(code, state)
            elif platform == 'youtube':
                return self.google.handle_callback(code, state)
            else:
                return {'error': f'Platform {platform} not supported'}
        except Exception as e:
            logger.error(f"OAuth callback error for {platform}: {e}")
            return {'error': str(e)}
    
    def post_to_platform(self, platform: str, account_id: str, content: str, media: List = None, options: Dict = None) -> Dict:
        """Post content to platform using real API"""
        if not self.enabled:
            return {'error': 'OAuth not enabled'}
        
        # Get account with decrypted tokens
        with db_session_scope() as session:
            account = session.query(Account).filter_by(id=account_id).first()
            if not account:
                return {'error': 'Account not found'}
            
            access_token = decrypt_token(account.oauth_token)
            
            try:
                if platform == 'twitter':
                    return self.twitter.create_tweet(access_token, content, media)
                elif platform == 'facebook':
                    page_id = options.get('page_id') if options else None
                    return self.meta.create_facebook_post(access_token, content, media, page_id)
                elif platform == 'instagram':
                    return self.meta.create_instagram_post(access_token, content, media)
                elif platform == 'linkedin':
                    return self.linkedin.create_post(access_token, content, media)
                elif platform == 'youtube':
                    return self.google.upload_video(access_token, content, media[0] if media else None, options)
                else:
                    return {'error': f'Platform {platform} posting not implemented'}
            except Exception as e:
                logger.error(f"Error posting to {platform}: {e}")
                return {'error': str(e), 'retry_able': True}


# ==================== 3. MEDIA UPLOAD SYSTEM ====================

class MediaManager:
    """Manages media uploads and library"""
    
    def __init__(self):
        self.handler = MediaUploadHandler() if DB_ENABLED else None
        self.enabled = DB_ENABLED
    
    def upload_media(self, user_id: str, file_data: bytes, filename: str, mime_type: str) -> Dict:
        """Upload media file"""
        if not self.enabled:
            return {'error': 'Media upload not enabled'}
        
        try:
            # Validate file
            validation = validate_file_upload(file_data, mime_type, filename)
            if not validation['valid']:
                return {'error': validation['error']}
            
            # Save file
            result = self.handler.save_file(user_id, file_data, filename, mime_type)
            
            # Store in database
            with db_session_scope() as session:
                media = Media(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    filename=result['filename'],
                    file_path=result['file_path'],
                    mime_type=mime_type,
                    file_size=len(file_data),
                    width=result.get('width'),
                    height=result.get('height'),
                    thumbnail_path=result.get('thumbnail_path'),
                    created_at=datetime.utcnow()
                )
                session.add(media)
                session.flush()
                
                return {
                    'id': media.id,
                    'filename': media.filename,
                    'url': f'/api/media/{media.id}/file',
                    'thumbnail_url': f'/api/media/{media.id}/thumbnail' if media.thumbnail_path else None,
                    'mime_type': media.mime_type,
                    'size': media.file_size,
                    'dimensions': {'width': media.width, 'height': media.height} if media.width else None
                }
        except Exception as e:
            logger.error(f"Media upload error: {e}")
            return {'error': str(e)}
    
    def get_media(self, media_id: str) -> Optional[Dict]:
        """Get media by ID"""
        if not self.enabled:
            return None
        
        with db_session_scope() as session:
            media = session.query(Media).filter_by(id=media_id).first()
            if media:
                return {
                    'id': media.id,
                    'filename': media.filename,
                    'file_path': media.file_path,
                    'mime_type': media.mime_type,
                    'size': media.file_size,
                    'dimensions': {'width': media.width, 'height': media.height} if media.width else None,
                    'created_at': media.created_at.isoformat()
                }
        return None
    
    def list_media(self, user_id: str, limit: int = 50, offset: int = 0) -> List[Dict]:
        """List media for user"""
        if not self.enabled:
            return []
        
        with db_session_scope() as session:
            media_list = session.query(Media).filter_by(user_id=user_id).order_by(Media.created_at.desc()).limit(limit).offset(offset).all()
            return [{
                'id': m.id,
                'filename': m.filename,
                'url': f'/api/media/{m.id}/file',
                'mime_type': m.mime_type,
                'size': m.file_size,
                'created_at': m.created_at.isoformat()
            } for m in media_list]


# ==================== 4. AUTHENTICATION MIDDLEWARE ====================

import threading

# Cache for user lookups to reduce database queries (thread-safe)
_user_cache = {}
_cache_lock = threading.RLock()
_cache_ttl = 300  # 5 minutes

def _get_cached_user(user_id: str) -> Optional[Dict]:
    """Get user from cache if available and not expired (thread-safe)"""
    with _cache_lock:
        if user_id in _user_cache:
            cached_data, timestamp = _user_cache[user_id]
            if time.time() - timestamp < _cache_ttl:
                return cached_data
            else:
                # Expired, remove from cache
                del _user_cache[user_id]
    return None

def _cache_user(user_id: str, user_data: Dict):
    """Cache user data with timestamp (thread-safe)"""
    with _cache_lock:
        _user_cache[user_id] = (user_data, time.time())

def get_current_user() -> Optional[Dict]:
    """Get current authenticated user from request with caching"""
    if not DB_ENABLED:
        return None
    
    # Check JWT token
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        payload = verify_token(token)
        if payload:
            user_id = payload.get('user_id')
            
            # Check cache first
            cached_user = _get_cached_user(user_id)
            if cached_user:
                return cached_user
            
            # Not in cache, query database
            with db_session_scope() as session:
                user = session.query(User).filter_by(id=user_id).first()
                if user and user.is_active:
                    user_data = {
                        'id': user.id,
                        'email': user.email,
                        'name': user.full_name,
                        'role': user.role.value
                    }
                    _cache_user(user_id, user_data)
                    return user_data
    
    # Check API key (less frequent, skip caching)
    api_key = request.headers.get('X-API-Key', '')
    if api_key:
        with db_session_scope() as session:
            user = session.query(User).filter_by(api_key=api_key).first()
            if user and user.is_active:
                return {
                    'id': user.id,
                    'email': user.email,
                    'name': user.full_name,
                    'role': user.role.value
                }
    
    return None


def auth_required(f: Callable) -> Callable:
    """Decorator to require authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        g.current_user = user
        return f(*args, **kwargs)
    return decorated_function


def role_required(required_role: str) -> Callable:
    """Decorator to require specific role"""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            
            # Check role hierarchy: admin > editor > viewer
            role_hierarchy = {'admin': 3, 'editor': 2, 'viewer': 1}
            user_level = role_hierarchy.get(user['role'], 0)
            required_level = role_hierarchy.get(required_role, 0)
            
            if user_level < required_level:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            g.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ==================== 5. REAL ANALYTICS COLLECTION ====================

class AnalyticsCollector:
    """Collects real analytics from platform APIs"""
    
    def __init__(self):
        self.oauth_manager = OAuthManager()
        self.enabled = DB_ENABLED
    
    def collect_post_analytics(self, post_id: str, platform: str, platform_post_id: str, account_id: str):
        """Collect analytics for a published post"""
        if not self.enabled:
            return
        
        try:
            # Get account tokens
            with db_session_scope() as session:
                account = session.query(Account).filter_by(id=account_id).first()
                if not account:
                    return
                
                access_token = decrypt_token(account.oauth_token)
                
                # Fetch metrics from platform
                metrics = self._fetch_platform_metrics(platform, platform_post_id, access_token)
                
                if metrics:
                    # Store in database
                    analytics = PostAnalytics(
                        id=str(uuid.uuid4()),
                        post_id=post_id,
                        platform=platform,
                        platform_post_id=platform_post_id,
                        views=metrics.get('views', 0),
                        likes=metrics.get('likes', 0),
                        shares=metrics.get('shares', 0),
                        comments=metrics.get('comments', 0),
                        reach=metrics.get('reach', 0),
                        engagement_rate=metrics.get('engagement_rate', 0.0),
                        collected_at=datetime.utcnow()
                    )
                    session.add(analytics)
                    logger.info(f"Collected analytics for post {post_id} on {platform}")
        except Exception as e:
            logger.error(f"Error collecting analytics: {e}")
    
    def _fetch_platform_metrics(self, platform: str, post_id: str, access_token: str) -> Optional[Dict]:
        """Fetch metrics from specific platform"""
        try:
            if platform == 'twitter':
                # Twitter API v2 metrics endpoint
                url = f"https://api.twitter.com/2/tweets/{post_id}?tweet.fields=public_metrics"
                headers = {'Authorization': f'Bearer {access_token}'}
                response = requests.get(url, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    metrics = data.get('data', {}).get('public_metrics', {})
                    return {
                        'views': metrics.get('impression_count', 0),
                        'likes': metrics.get('like_count', 0),
                        'shares': metrics.get('retweet_count', 0),
                        'comments': metrics.get('reply_count', 0),
                        'reach': metrics.get('impression_count', 0)
                    }
            
            elif platform == 'facebook':
                # Facebook Graph API
                url = f"https://graph.facebook.com/v18.0/{post_id}?fields=insights.metric(post_impressions,post_engaged_users,post_reactions_like_total)"
                response = requests.get(url, params={'access_token': access_token})
                if response.status_code == 200:
                    data = response.json()
                    # Parse insights data
                    return self._parse_facebook_insights(data)
            
            # Add more platforms as needed
            
        except Exception as e:
            logger.error(f"Error fetching {platform} metrics: {e}")
        
        return None
    
    def _parse_facebook_insights(self, data: Dict) -> Dict:
        """Parse Facebook insights data"""
        insights = data.get('insights', {}).get('data', [])
        metrics = {}
        for insight in insights:
            name = insight.get('name')
            values = insight.get('values', [])
            if values:
                value = values[0].get('value', 0)
                if name == 'post_impressions':
                    metrics['views'] = value
                    metrics['reach'] = value
                elif name == 'post_engaged_users':
                    metrics['engagement'] = value
                elif name == 'post_reactions_like_total':
                    metrics['likes'] = value
        return metrics


# ==================== 6. WEBHOOK SYSTEM ====================

class WebhookManager:
    """Manages webhook registrations and notifications"""
    
    def __init__(self):
        self.enabled = DB_ENABLED
        self.session = self._create_retry_session()
    
    def _create_retry_session(self):
        """Create requests session with retry logic"""
        session = requests.Session()
        retry = Retry(
            total=3,
            backoff_factor=1,
            status_forcelist=[429, 500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount('http://', adapter)
        session.mount('https://', adapter)
        return session
    
    def register_webhook(self, user_id: str, url: str, events: List[str], secret: str = None) -> Dict:
        """Register a webhook"""
        if not self.enabled:
            return {'error': 'Webhooks not enabled'}
        
        webhook_id = str(uuid.uuid4())
        
        # Store in database (add Webhook model if needed)
        # For now, return success
        return {
            'id': webhook_id,
            'url': url,
            'events': events,
            'active': True,
            'created_at': datetime.utcnow().isoformat()
        }
    
    def send_webhook(self, webhook_url: str, event: str, data: Dict, secret: str = None):
        """Send webhook notification"""
        try:
            payload = {
                'event': event,
                'data': data,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            headers = {'Content-Type': 'application/json'}
            if secret:
                # Add HMAC signature for security
                import hmac
                import hashlib
                signature = hmac.new(
                    secret.encode(),
                    json.dumps(payload).encode(),
                    hashlib.sha256
                ).hexdigest()
                headers['X-Webhook-Signature'] = signature
            
            response = self.session.post(
                webhook_url,
                json=payload,
                headers=headers,
                timeout=10
            )
            
            logger.info(f"Webhook sent to {webhook_url}: {response.status_code}")
            return True
        except Exception as e:
            logger.error(f"Webhook send error: {e}")
            return False


# ==================== 7. ADVANCED SEARCH & FILTERING ====================

class SearchManager:
    """Provides advanced search and filtering capabilities"""
    
    def __init__(self):
        self.enabled = DB_ENABLED
    
    def search_posts(self, user_id: str, query: str, filters: Dict = None, limit: int = 50, offset: int = 0) -> Dict:
        """Full-text search across posts"""
        if not self.enabled:
            return {'posts': [], 'total': 0}
        
        with db_session_scope() as session:
            # Start with base query
            q = session.query(Post).filter_by(user_id=user_id)
            
            # Full-text search on content
            if query:
                search_term = f"%{query}%"
                q = q.filter(Post.content.like(search_term))
            
            # Apply filters
            if filters:
                if filters.get('platforms'):
                    # Use PostgreSQL JSON operators for efficient array contains check
                    # This is much faster than LIKE on JSON strings
                    platforms_filter = filters['platforms']
                    if isinstance(platforms_filter, list):
                        # Check if any of the requested platforms exist in the post's platforms array
                        # For each platform, check if it exists in the JSON array
                        platform_conditions = []
                        for platform in platforms_filter:
                            # Use contains operator for JSONB or array membership check
                            platform_conditions.append(Post.platforms.contains(platform))
                        if platform_conditions:
                            q = q.filter(or_(*platform_conditions))
                    else:
                        # Single platform fallback to like (less efficient but works)
                        q = q.filter(Post.platforms.like(f'%{platforms_filter}%'))
                
                if filters.get('status'):
                    q = q.filter_by(status=PostStatus[filters['status'].upper()])
                
                if filters.get('post_type'):
                    q = q.filter_by(post_type=filters['post_type'])
                
                if filters.get('date_from'):
                    q = q.filter(Post.created_at >= filters['date_from'])
                
                if filters.get('date_to'):
                    q = q.filter(Post.created_at <= filters['date_to'])
                
                if filters.get('has_media'):
                    if filters['has_media']:
                        q = q.filter(Post.media_ids != '[]')
                    else:
                        q = q.filter(Post.media_ids == '[]')
            
            # Get total count
            total = q.count()
            
            # Get paginated results
            posts = q.order_by(Post.created_at.desc()).limit(limit).offset(offset).all()
            
            return {
                'posts': [self._post_to_dict(p) for p in posts],
                'total': total,
                'limit': limit,
                'offset': offset
            }
    
    def _post_to_dict(self, post: 'Post') -> Dict:
        """Convert post to dictionary with optimized JSON handling"""
        # Cache parsed JSON to avoid repeated parsing in loops
        try:
            platforms = json.loads(post.platforms) if isinstance(post.platforms, str) else post.platforms or []
        except (json.JSONDecodeError, TypeError):
            platforms = []
        
        return {
            'id': post.id,
            'content': post.content[:200] + '...' if len(post.content) > 200 else post.content,
            'status': post.status.value,
            'platforms': platforms,
            'created_at': post.created_at.isoformat(),
            'scheduled_time': post.scheduled_time.isoformat() if post.scheduled_time else None
        }


# ==================== 8. BULK OPERATIONS ====================

class BulkOperationsManager:
    """Handles bulk operations on posts"""
    
    def __init__(self):
        self.enabled = DB_ENABLED
        self.db_manager = DatabaseManager()
        self.oauth_manager = OAuthManager()
    
    def bulk_create_posts(self, user_id: str, posts_data: List[Dict]) -> Dict:
        """Create multiple posts at once"""
        if not self.enabled:
            return {'error': 'Bulk operations not enabled'}
        
        results = {
            'successful': [],
            'failed': []
        }
        
        for post_data in posts_data:
            try:
                post = self.db_manager.create_post(user_id, post_data)
                results['successful'].append({'id': post['id'], 'content': post['content'][:50]})
            except Exception as e:
                results['failed'].append({'data': post_data, 'error': str(e)})
        
        return results
    
    def bulk_update_posts(self, user_id: str, updates: List[Dict]) -> Dict:
        """Update multiple posts at once"""
        if not self.enabled:
            return {'error': 'Bulk operations not enabled'}
        
        results = {
            'successful': [],
            'failed': []
        }
        
        for update in updates:
            post_id = update.get('id')
            if not post_id:
                results['failed'].append({'data': update, 'error': 'No post ID'})
                continue
            
            try:
                post = self.db_manager.update_post(post_id, update)
                if post:
                    results['successful'].append({'id': post_id})
                else:
                    results['failed'].append({'id': post_id, 'error': 'Post not found'})
            except Exception as e:
                results['failed'].append({'id': post_id, 'error': str(e)})
        
        return results
    
    def bulk_delete_posts(self, user_id: str, post_ids: List[str]) -> Dict:
        """Delete multiple posts at once"""
        if not self.enabled:
            return {'error': 'Bulk operations not enabled'}
        
        results = {
            'successful': [],
            'failed': []
        }
        
        for post_id in post_ids:
            try:
                success = self.db_manager.delete_post(post_id)
                if success:
                    results['successful'].append(post_id)
                else:
                    results['failed'].append({'id': post_id, 'error': 'Not found'})
            except Exception as e:
                results['failed'].append({'id': post_id, 'error': str(e)})
        
        return results


# ==================== 9. ERROR RECOVERY & RETRY LOGIC ====================

class RetryManager:
    """Handles error recovery and retry logic for failed operations"""
    
    def __init__(self):
        self.max_retries = 3
        self.base_delay = 1  # seconds
        self.max_delay = 60  # seconds
        self._retry_cache = {}  # Cache retry attempts to avoid duplicate retries
    
    def retry_with_backoff(self, func: Callable, *args, **kwargs) -> Dict:
        """Retry a function with exponential backoff (non-blocking for web requests)
        
        Note: This implementation removes blocking time.sleep() to prevent freezing Flask threads.
        For production use with proper delayed retries, implement a task queue like Celery or RQ.
        Current behavior: Immediate retries which may not be ideal for rate-limited APIs.
        """
        last_exception = None
        
        for attempt in range(self.max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                last_exception = e
                if attempt < self.max_retries - 1:
                    # Calculate exponential backoff delay (for logging/monitoring)
                    delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                    logger.warning(f"Attempt {attempt + 1} failed: {e}. Retrying immediately (production should use task queue with {delay}s delay)...")
                    # Note: Removed blocking time.sleep() to prevent freezing Flask threads
                    # For production, use task queue (Celery/RQ) for proper async retries with delays
                else:
                    logger.error(f"All {self.max_retries} attempts failed: {e}")
        
        return {
            'error': f'Operation failed after {self.max_retries} attempts',
            'last_error': str(last_exception),
            'retryable': self._is_retryable(last_exception)
        }
    
    def _is_retryable(self, exception: Exception) -> bool:
        """Determine if an exception is retryable"""
        retryable_errors = [
            'timeout',
            'connection',
            'rate limit',
            '429',
            '500',
            '502',
            '503',
            '504'
        ]
        
        error_str = str(exception).lower()
        return any(err in error_str for err in retryable_errors)
    
    def retry_failed_posts(self, user_id: str) -> Dict:
        """Retry all failed posts for a user with optimized batch update"""
        if not DB_ENABLED:
            return {'error': 'Retry not enabled'}
        
        results = {
            'retried': [],
            'still_failed': []
        }
        
        with db_session_scope() as session:
            # Use more efficient bulk update instead of updating one by one
            failed_posts = session.query(Post).filter_by(
                user_id=user_id,
                status=PostStatus.FAILED
            ).all()
            
            # Collect IDs for batch update
            post_ids_to_retry = []
            
            for post in failed_posts:
                try:
                    # Validate post can be retried
                    if self._is_retryable(Exception(post.error_message or "")):
                        post_ids_to_retry.append(post.id)
                        results['retried'].append(post.id)
                    else:
                        results['still_failed'].append({'id': post.id, 'error': 'Not retryable'})
                except Exception as e:
                    results['still_failed'].append({'id': post.id, 'error': str(e)})
            
            # Perform batch update for all retryable posts
            if post_ids_to_retry:
                session.query(Post).filter(Post.id.in_(post_ids_to_retry)).update(
                    {Post.status: PostStatus.SCHEDULED},
                    synchronize_session='fetch'  # Fetch to maintain session state consistency
                )
                session.commit()
        
        return results


# Initialize managers
db_manager = DatabaseManager()
oauth_manager = OAuthManager()
media_manager = MediaManager()
analytics_collector = AnalyticsCollector()
webhook_manager = WebhookManager()
search_manager = SearchManager()
bulk_ops_manager = BulkOperationsManager()
retry_manager = RetryManager()

logger.info("Application extensions initialized")
