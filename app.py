from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from datetime import datetime, timedelta
import uuid
import os
import logging
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configure scheduler
jobstores = {
    'default': MemoryJobStore()
}
scheduler = BackgroundScheduler(jobstores=jobstores, timezone='UTC')
scheduler.start()

# In-memory storage for posts and accounts (in production, use a database)
posts_db = {}
accounts_db = {}  # Stores platform accounts with credentials
oauth_states = {}  # Stores OAuth state tokens temporarily
shortened_urls = {}  # Stores shortened URLs with click tracking
url_clicks = {}  # Stores click data for URLs
social_monitors = {}  # Stores social listening monitors
monitor_results = {}  # Stores results from social monitoring
post_analytics = {}  # Stores analytics data for published posts
bulk_imports = {}  # Stores bulk import job information
templates_db = {}  # Stores post templates
post_versions = {}  # Stores A/B test versions for posts
ab_test_results = {}  # Stores A/B test performance data
response_templates = {}  # Stores automated response templates
chatbot_interactions = {}  # Stores chatbot conversation history


class PlatformAdapter:
    """Base adapter for social media platforms"""
    
    def __init__(self, platform_name, supported_post_types=None):
        self.platform_name = platform_name
        self.supported_post_types = supported_post_types or ['standard']
        
    def validate_credentials(self, credentials):
        """Validate platform credentials"""
        return True
    
    def get_supported_post_types(self):
        """Get list of supported post types for this platform"""
        return self.supported_post_types
    
    def format_post(self, content, media=None, post_type='standard', **kwargs):
        """Format post content for specific platform"""
        return {
            'platform': self.platform_name,
            'content': content,
            'media': media,
            'post_type': post_type
        }
    
    def publish(self, post_data, credentials):
        """Publish post to platform"""
        # In a real implementation, this would call the platform's API
        # Note: credentials are not logged to avoid exposing sensitive data
        post_type = post_data.get('post_type', 'standard')
        logger.info(f"Publishing {post_type} to {self.platform_name}")
        return {
            'success': True,
            'platform': self.platform_name,
            'post_id': str(uuid.uuid4()),
            'post_type': post_type,
            'message': f'Post published to {self.platform_name}'
        }


class TwitterAdapter(PlatformAdapter):
    """Twitter/X adapter supporting standard posts and threads"""
    def __init__(self):
        super().__init__('twitter', supported_post_types=['standard', 'thread'])
    
    def format_post(self, content, media=None, post_type='standard', **kwargs):
        # Twitter has 280 character limit per tweet
        if post_type == 'thread':
            # Split content into tweets for threads
            tweets = []
            remaining = content
            while remaining:
                chunk = remaining[:280]
                tweets.append(chunk)
                remaining = remaining[280:]
            
            return {
                'platform': self.platform_name,
                'content': content,
                'tweets': tweets,
                'media': media,
                'post_type': post_type,
                'thread_length': len(tweets)
            }
        else:
            # Standard tweet
            truncated_content = content[:280] if len(content) > 280 else content
            return {
                'platform': self.platform_name,
                'content': truncated_content,
                'media': media,
                'post_type': post_type
            }


class FacebookAdapter(PlatformAdapter):
    """Facebook adapter supporting Page posts and Reels (Pages only, not personal profiles or groups)"""
    def __init__(self):
        super().__init__('facebook', supported_post_types=['feed_post', 'reel'])
    
    def format_post(self, content, media=None, post_type='feed_post', **kwargs):
        page_id = kwargs.get('page_id')
        
        formatted = {
            'platform': self.platform_name,
            'content': content,
            'media': media,
            'post_type': post_type,
            'target_type': 'page'  # Pages only
        }
        
        if page_id:
            formatted['page_id'] = page_id
            
        if post_type == 'reel':
            formatted['requires_video'] = True
            formatted['reel_specs'] = {
                'min_duration': 3,
                'max_duration': 90,
                'aspect_ratio': '9:16'
            }
        
        return formatted


class InstagramAdapter(PlatformAdapter):
    """Instagram adapter supporting Feed posts, Reels, Stories, and Carousels"""
    def __init__(self):
        super().__init__('instagram', supported_post_types=['feed_post', 'reel', 'story', 'carousel'])
    
    def format_post(self, content, media=None, post_type='feed_post', **kwargs):
        # Instagram requires media for all post types
        formatted = {
            'platform': self.platform_name,
            'content': content,
            'media': media,
            'post_type': post_type,
            'requires_media': True
        }
        
        if post_type == 'reel':
            formatted['requires_video'] = True
            formatted['reel_specs'] = {
                'min_duration': 3,
                'max_duration': 90,
                'aspect_ratio': '9:16'
            }
        elif post_type == 'story':
            formatted['story_specs'] = {
                'duration': 15,
                'aspect_ratio': '9:16',
                'ephemeral': True
            }
        elif post_type == 'carousel':
            formatted['carousel_specs'] = {
                'min_items': 2,
                'max_items': 10,
                'supports_mixed_media': True
            }
        
        return formatted


class LinkedInAdapter(PlatformAdapter):
    """LinkedIn adapter supporting personal profiles and company pages"""
    def __init__(self):
        super().__init__('linkedin', supported_post_types=['personal_profile', 'company_page'])
    
    def format_post(self, content, media=None, post_type='personal_profile', **kwargs):
        formatted = {
            'platform': self.platform_name,
            'content': content,
            'media': media,
            'post_type': post_type
        }
        
        if post_type == 'company_page':
            company_id = kwargs.get('company_id')
            if company_id:
                formatted['company_id'] = company_id
        
        # LinkedIn supports up to 3000 characters
        if len(content) > 3000:
            formatted['content'] = content[:3000]
            formatted['truncated'] = True
        
        return formatted


class ThreadsAdapter(PlatformAdapter):
    """Threads adapter supporting single posts and thread-style posts"""
    def __init__(self):
        super().__init__('threads', supported_post_types=['standard', 'thread'])
    
    def format_post(self, content, media=None, post_type='standard', **kwargs):
        formatted = {
            'platform': self.platform_name,
            'content': content,
            'media': media,
            'post_type': post_type
        }
        
        if post_type == 'thread':
            # Threads has 500 character limit per post
            posts = []
            remaining = content
            while remaining:
                chunk = remaining[:500]
                posts.append(chunk)
                remaining = remaining[500:]
            
            formatted['posts'] = posts
            formatted['thread_length'] = len(posts)
        else:
            # Single post with 500 character limit
            if len(content) > 500:
                formatted['content'] = content[:500]
                formatted['truncated'] = True
        
        return formatted


class BlueskyAdapter(PlatformAdapter):
    """Bluesky adapter supporting single posts and thread-style posts"""
    def __init__(self):
        super().__init__('bluesky', supported_post_types=['standard', 'thread'])
    
    def format_post(self, content, media=None, post_type='standard', **kwargs):
        formatted = {
            'platform': self.platform_name,
            'content': content,
            'media': media,
            'post_type': post_type
        }
        
        if post_type == 'thread':
            # Bluesky has 300 character limit per post
            posts = []
            remaining = content
            while remaining:
                chunk = remaining[:300]
                posts.append(chunk)
                remaining = remaining[300:]
            
            formatted['posts'] = posts
            formatted['thread_length'] = len(posts)
        else:
            # Single post with 300 character limit
            if len(content) > 300:
                formatted['content'] = content[:300]
                formatted['truncated'] = True
        
        return formatted


class YouTubeAdapter(PlatformAdapter):
    """YouTube adapter supporting long-form videos and Shorts"""
    def __init__(self):
        super().__init__('youtube', supported_post_types=['video', 'short'])
    
    def format_post(self, content, media=None, post_type='video', **kwargs):
        formatted = {
            'platform': self.platform_name,
            'content': content,  # Used as video title/description
            'media': media,
            'post_type': post_type,
            'requires_video': True
        }
        
        if post_type == 'short':
            formatted['short_specs'] = {
                'max_duration': 60,
                'aspect_ratio': '9:16',
                'vertical_only': True
            }
        else:
            # Long-form video
            formatted['video_specs'] = {
                'min_duration': 1,
                'max_duration': 43200,  # 12 hours
                'supports_chapters': True,
                'supports_end_screens': True
            }
        
        return formatted


class PinterestAdapter(PlatformAdapter):
    """Pinterest adapter supporting Pins and Video Pins"""
    def __init__(self):
        super().__init__('pinterest', supported_post_types=['pin', 'video_pin'])
    
    def format_post(self, content, media=None, post_type='pin', **kwargs):
        formatted = {
            'platform': self.platform_name,
            'content': content,  # Used as pin description
            'media': media,
            'post_type': post_type,
            'requires_media': True
        }
        
        board_id = kwargs.get('board_id')
        if board_id:
            formatted['board_id'] = board_id
        
        if post_type == 'video_pin':
            formatted['requires_video'] = True
            formatted['video_specs'] = {
                'min_duration': 4,
                'max_duration': 15 * 60,  # 15 minutes
                'recommended_aspect_ratio': '2:3'
            }
        else:
            formatted['pin_specs'] = {
                'recommended_aspect_ratio': '2:3',
                'supports_carousel': True
            }
        
        return formatted


class TikTokAdapter(PlatformAdapter):
    """TikTok adapter supporting videos and slideshows"""
    def __init__(self):
        super().__init__('tiktok', supported_post_types=['video', 'slideshow'])
    
    def format_post(self, content, media=None, post_type='video', **kwargs):
        formatted = {
            'platform': self.platform_name,
            'content': content,  # Used as video caption
            'media': media,
            'post_type': post_type,
            'requires_media': True
        }
        
        if post_type == 'slideshow':
            formatted['slideshow_specs'] = {
                'min_images': 1,
                'max_images': 35,
                'aspect_ratio': '9:16',
                'supports_music': True
            }
        else:
            # Video
            formatted['requires_video'] = True
            formatted['video_specs'] = {
                'min_duration': 3,
                'max_duration': 10 * 60,  # 10 minutes
                'aspect_ratio': '9:16',
                'vertical_only': True
            }
        
        # TikTok caption limit
        if len(content) > 2200:
            formatted['content'] = content[:2200]
            formatted['truncated'] = True
        
        return formatted


# Initialize platform adapters
PLATFORM_ADAPTERS = {
    'twitter': TwitterAdapter(),
    'facebook': FacebookAdapter(),
    'instagram': InstagramAdapter(),
    'linkedin': LinkedInAdapter(),
    'threads': ThreadsAdapter(),
    'bluesky': BlueskyAdapter(),
    'youtube': YouTubeAdapter(),
    'pinterest': PinterestAdapter(),
    'tiktok': TikTokAdapter(),
}


def publish_to_platforms(post_id, platforms, content, media, credentials_dict, post_type='standard', post_options=None):
    """Background task to publish to multiple platforms"""
    results = []
    post_options = post_options or {}
    
    for platform in platforms:
        if platform in PLATFORM_ADAPTERS:
            adapter = PLATFORM_ADAPTERS[platform]
            credentials = credentials_dict.get(platform, {})
            
            try:
                # Get platform-specific options
                platform_options = post_options.get(platform, {})
                formatted_post = adapter.format_post(
                    content, 
                    media, 
                    post_type=post_type,
                    **platform_options
                )
                result = adapter.publish(formatted_post, credentials)
                results.append(result)
                logger.info(f"Successfully posted to {platform}")
            except Exception as e:
                logger.error(f"Error posting to {platform}: {str(e)}")
                results.append({
                    'success': False,
                    'platform': platform,
                    'error': str(e)
                })
    
    # Update post status
    if post_id in posts_db:
        posts_db[post_id]['status'] = 'published'
        posts_db[post_id]['results'] = results
        posts_db[post_id]['published_at'] = datetime.utcnow().isoformat()


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'MastaBlasta',
        'version': '1.0.0',
        'timestamp': datetime.utcnow().isoformat()
    })


@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    """Get all configured platform accounts"""
    accounts = []
    for account_id, account in accounts_db.items():
        # Return account info without sensitive credentials
        accounts.append({
            'id': account_id,
            'platform': account['platform'],
            'name': account['name'],
            'username': account.get('username', ''),
            'enabled': account.get('enabled', True),
            'created_at': account.get('created_at', '')
        })
    
    return jsonify({
        'accounts': accounts,
        'count': len(accounts)
    })


@app.route('/api/accounts', methods=['POST'])
def add_account():
    """Add a new platform account"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    platform = data.get('platform', '')
    name = data.get('name', '')
    username = data.get('username', '')
    credentials = data.get('credentials', {})
    
    if not platform:
        return jsonify({'error': 'Platform is required'}), 400
    
    if platform not in PLATFORM_ADAPTERS:
        return jsonify({'error': f'Invalid platform: {platform}'}), 400
    
    if not name:
        return jsonify({'error': 'Account name is required'}), 400
    
    # Create account record
    account_id = str(uuid.uuid4())
    account_record = {
        'id': account_id,
        'platform': platform,
        'name': name,
        'username': username,
        'credentials': credentials,
        'enabled': True,
        'created_at': datetime.utcnow().isoformat()
    }
    
    accounts_db[account_id] = account_record
    
    return jsonify({
        'success': True,
        'account_id': account_id,
        'message': 'Account added successfully',
        'account': {
            'id': account_id,
            'platform': platform,
            'name': name,
            'username': username,
            'enabled': True
        }
    }), 201


@app.route('/api/accounts/<account_id>', methods=['GET'])
def get_account(account_id):
    """Get a specific account"""
    account = accounts_db.get(account_id)
    
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    # Return without sensitive credentials
    return jsonify({
        'account': {
            'id': account_id,
            'platform': account['platform'],
            'name': account['name'],
            'username': account.get('username', ''),
            'enabled': account.get('enabled', True),
            'created_at': account.get('created_at', '')
        }
    })


@app.route('/api/accounts/<account_id>', methods=['PUT'])
def update_account(account_id):
    """Update an existing account"""
    account = accounts_db.get(account_id)
    
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    # Update fields
    if 'name' in data:
        account['name'] = data['name']
    if 'username' in data:
        account['username'] = data['username']
    if 'credentials' in data:
        account['credentials'] = data['credentials']
    if 'enabled' in data:
        account['enabled'] = data['enabled']
    
    account['updated_at'] = datetime.utcnow().isoformat()
    
    return jsonify({
        'success': True,
        'message': 'Account updated successfully',
        'account': {
            'id': account_id,
            'platform': account['platform'],
            'name': account['name'],
            'username': account.get('username', ''),
            'enabled': account.get('enabled', True)
        }
    })


@app.route('/api/accounts/<account_id>', methods=['DELETE'])
def delete_account(account_id):
    """Delete an account"""
    account = accounts_db.get(account_id)
    
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    del accounts_db[account_id]
    
    return jsonify({
        'success': True,
        'message': 'Account deleted successfully'
    })


@app.route('/api/accounts/<account_id>/test', methods=['POST'])
def test_account(account_id):
    """Test account credentials"""
    account = accounts_db.get(account_id)
    
    if not account:
        return jsonify({'error': 'Account not found'}), 404
    
    platform = account['platform']
    credentials = account.get('credentials', {})
    
    if platform not in PLATFORM_ADAPTERS:
        return jsonify({
            'success': False,
            'error': f'Platform {platform} not supported'
        }), 400
    
    adapter = PLATFORM_ADAPTERS[platform]
    
    try:
        # Validate credentials using the adapter
        is_valid = adapter.validate_credentials(credentials)
        
        return jsonify({
            'success': is_valid,
            'message': 'Credentials are valid' if is_valid else 'Invalid credentials',
            'platform': platform,
            'account_name': account['name']
        })
    except Exception as e:
        logger.error(f"Error testing credentials for {account_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/platforms', methods=['GET'])
def get_platforms():
    """Get list of supported platforms"""
    platforms = []
    for name, adapter in PLATFORM_ADAPTERS.items():
        platforms.append({
            'name': name,
            'display_name': name.replace('_', ' ').title(),
            'available': True,
            'supports_oauth': True,  # All platforms now support OAuth
            'supported_post_types': adapter.get_supported_post_types()
        })
    
    return jsonify({
        'platforms': platforms,
        'count': len(platforms)
    })


@app.route('/api/platforms/<platform>/post-types', methods=['GET'])
def get_platform_post_types(platform):
    """Get supported post types for a specific platform"""
    if platform not in PLATFORM_ADAPTERS:
        return jsonify({'error': f'Invalid platform: {platform}'}), 404
    
    adapter = PLATFORM_ADAPTERS[platform]
    return jsonify({
        'platform': platform,
        'supported_post_types': adapter.get_supported_post_types()
    })


@app.route('/api/oauth/init/<platform>', methods=['GET'])
def oauth_init(platform):
    """Initialize OAuth flow for a platform"""
    if platform not in PLATFORM_ADAPTERS:
        return jsonify({'error': f'Invalid platform: {platform}'}), 400
    
    # In a real implementation, this would:
    # 1. Generate a state token for CSRF protection
    # 2. Build the OAuth authorization URL with client_id, redirect_uri, scope
    # 3. Return the URL to redirect the user to
    # 4. Use environment variables for client IDs and redirect URIs
    
    # For demo purposes, we'll simulate the OAuth flow
    state_token = str(uuid.uuid4())
    
    # Store state token temporarily (in production, use a database or cache with expiration)
    # TODO: Implement token expiration and cleanup mechanism
    oauth_states[state_token] = {
        'platform': platform,
        'created_at': datetime.utcnow().isoformat()
    }
    
    # Simulated OAuth URLs for each platform
    # TODO: Move to environment variables for different deployment environments
    oauth_urls = {
        'twitter': f'https://twitter.com/i/oauth2/authorize?client_id=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/twitter&state={state_token}',
        'facebook': f'https://www.facebook.com/v18.0/dialog/oauth?client_id=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/facebook&state={state_token}',
        'instagram': f'https://api.instagram.com/oauth/authorize?client_id=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/instagram&state={state_token}',
        'linkedin': f'https://www.linkedin.com/oauth/v2/authorization?client_id=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/linkedin&state={state_token}',
        'threads': f'https://threads.net/oauth/authorize?client_id=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/threads&state={state_token}',
        'bluesky': f'https://bsky.app/oauth/authorize?client_id=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/bluesky&state={state_token}',
        'youtube': f'https://accounts.google.com/o/oauth2/v2/auth?client_id=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/youtube&state={state_token}&scope=https://www.googleapis.com/auth/youtube.upload',
        'pinterest': f'https://www.pinterest.com/oauth/?client_id=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/pinterest&state={state_token}',
        'tiktok': f'https://www.tiktok.com/auth/authorize?client_key=DEMO&redirect_uri=http://localhost:33766/api/oauth/callback/tiktok&state={state_token}',
    }
    
    return jsonify({
        'oauth_url': oauth_urls.get(platform, ''),
        'state': state_token,
        'platform': platform
    })


@app.route('/api/oauth/callback/<platform>', methods=['GET'])
def oauth_callback(platform):
    """Handle OAuth callback from platform"""
    if platform not in PLATFORM_ADAPTERS:
        return jsonify({'error': f'Invalid platform: {platform}'}), 400
    
    # Get authorization code and state from query parameters
    code = request.args.get('code')
    state = request.args.get('state')
    
    if not code:
        error = request.args.get('error', 'Authorization failed')
        return f"""
        <html>
            <body>
                <script>
                    window.opener.postMessage({{
                        type: 'oauth_error',
                        platform: '{platform}',
                        error: '{error}'
                    }}, '*');
                    window.close();
                </script>
                <p>Authorization failed. This window should close automatically.</p>
            </body>
        </html>
        """
    
    # In a real implementation, this would:
    # 1. Verify the state token
    # 2. Exchange the code for an access token
    # 3. Fetch user profile information
    # 4. Store the credentials securely
    
    # For demo purposes, simulate successful OAuth
    account_data = {
        'code': code,
        'state': state,
        'platform': platform,
        'username': f'demo_user_{platform}',
        'access_token': f'demo_token_{uuid.uuid4()}',
        'token_type': 'Bearer'
    }
    
    # Return HTML that posts message to opener window and closes popup
    # TODO: In production, specify exact frontend origin instead of '*' for security
    return f"""
    <html>
        <head><title>Authorization Successful</title></head>
        <body>
            <script>
                window.opener.postMessage({{
                    type: 'oauth_success',
                    platform: '{platform}',
                    data: {json.dumps(account_data)}
                }}, '*');
                window.close();
            </script>
            <p>Authorization successful! This window should close automatically.</p>
            <p>If it doesn't, you can close it manually.</p>
        </body>
    </html>
    """


@app.route('/api/oauth/connect', methods=['POST'])
def oauth_connect():
    """Complete OAuth connection and create account"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    platform = data.get('platform', '')
    oauth_data = data.get('oauth_data', {})
    account_name = data.get('account_name', '') or f'{platform.capitalize()} Account'
    
    if not platform or platform not in PLATFORM_ADAPTERS:
        return jsonify({'error': 'Invalid platform'}), 400
    
    # Create account record with OAuth credentials
    account_id = str(uuid.uuid4())
    account_record = {
        'id': account_id,
        'platform': platform,
        'name': account_name,
        'username': oauth_data.get('username', ''),
        'credentials': {
            'access_token': oauth_data.get('access_token', ''),
            'token_type': oauth_data.get('token_type', 'Bearer'),
            'oauth': True
        },
        'enabled': True,
        'created_at': datetime.utcnow().isoformat(),
        'auth_method': 'oauth'
    }
    
    accounts_db[account_id] = account_record
    
    return jsonify({
        'success': True,
        'account_id': account_id,
        'message': 'Account connected successfully via OAuth',
        'account': {
            'id': account_id,
            'platform': platform,
            'name': account_name,
            'username': oauth_data.get('username', ''),
            'enabled': True,
            'auth_method': 'oauth'
        }
    }), 201



@app.route('/api/post', methods=['POST'])
def create_post():
    """Create and publish a post to multiple platforms"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    media = data.get('media', [])
    account_ids = data.get('account_ids', [])
    post_type = data.get('post_type', 'standard')
    post_options = data.get('post_options', {})
    # Legacy support: allow platforms + credentials
    platforms = data.get('platforms', [])
    credentials = data.get('credentials', {})
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    # Use account_ids if provided, otherwise fall back to platforms
    if account_ids:
        # Validate account IDs and build credentials dict
        credentials = {}
        platforms = []
        for account_id in account_ids:
            account = accounts_db.get(account_id)
            if not account:
                return jsonify({'error': f'Account {account_id} not found'}), 404
            if not account.get('enabled', True):
                return jsonify({'error': f'Account {account["name"]} is disabled'}), 400
            platforms.append(account['platform'])
            credentials[account['platform']] = account.get('credentials', {})
    elif not platforms:
        return jsonify({'error': 'At least one account or platform must be specified'}), 400
    
    # Validate platforms
    invalid_platforms = [p for p in platforms if p not in PLATFORM_ADAPTERS]
    if invalid_platforms:
        return jsonify({
            'error': f'Invalid platforms: {", ".join(invalid_platforms)}'
        }), 400
    
    # Create post record
    post_id = str(uuid.uuid4())
    post_record = {
        'id': post_id,
        'content': content,
        'media': media,
        'platforms': platforms,
        'account_ids': account_ids,
        'post_type': post_type,
        'post_options': post_options,
        'status': 'publishing',
        'created_at': datetime.utcnow().isoformat(),
        'scheduled_for': None
    }
    
    posts_db[post_id] = post_record
    
    # Publish immediately
    publish_to_platforms(post_id, platforms, content, media, credentials, post_type, post_options)
    
    return jsonify({
        'success': True,
        'post_id': post_id,
        'message': 'Post is being published',
        'post': post_record
    }), 201


@app.route('/api/schedule', methods=['POST'])
def schedule_post():
    """Schedule a post for future publishing"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    media = data.get('media', [])
    account_ids = data.get('account_ids', [])
    post_type = data.get('post_type', 'standard')
    post_options = data.get('post_options', {})
    # Legacy support
    platforms = data.get('platforms', [])
    credentials = data.get('credentials', {})
    scheduled_time = data.get('scheduled_time')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    # Use account_ids if provided, otherwise fall back to platforms
    if account_ids:
        # Validate account IDs and build credentials dict
        credentials = {}
        platforms = []
        for account_id in account_ids:
            account = accounts_db.get(account_id)
            if not account:
                return jsonify({'error': f'Account {account_id} not found'}), 404
            if not account.get('enabled', True):
                return jsonify({'error': f'Account {account["name"]} is disabled'}), 400
            platforms.append(account['platform'])
            credentials[account['platform']] = account.get('credentials', {})
    elif not platforms:
        return jsonify({'error': 'At least one account or platform must be specified'}), 400
    
    if not scheduled_time:
        return jsonify({'error': 'Scheduled time is required'}), 400
    
    # Validate platforms
    invalid_platforms = [p for p in platforms if p not in PLATFORM_ADAPTERS]
    if invalid_platforms:
        return jsonify({
            'error': f'Invalid platforms: {", ".join(invalid_platforms)}'
        }), 400
    
    # Parse scheduled time
    try:
        # Handle both 'Z' suffix and explicit timezone formats
        scheduled_time_normalized = scheduled_time.replace('Z', '+00:00')
        scheduled_dt = datetime.fromisoformat(scheduled_time_normalized)
    except ValueError:
        return jsonify({'error': 'Invalid scheduled_time format. Use ISO 8601 format (e.g., 2026-01-08T10:00:00Z)'}), 400
    
    if scheduled_dt <= datetime.now(scheduled_dt.tzinfo):
        return jsonify({'error': 'Scheduled time must be in the future'}), 400
    
    # Create post record
    post_id = str(uuid.uuid4())
    post_record = {
        'id': post_id,
        'content': content,
        'media': media,
        'platforms': platforms,
        'account_ids': account_ids,
        'post_type': post_type,
        'post_options': post_options,
        'status': 'scheduled',
        'created_at': datetime.utcnow().isoformat(),
        'scheduled_for': scheduled_time
    }
    
    posts_db[post_id] = post_record
    
    # Schedule the job
    scheduler.add_job(
        publish_to_platforms,
        'date',
        run_date=scheduled_dt,
        args=[post_id, platforms, content, media, credentials, post_type, post_options],
        id=post_id
    )
    
    return jsonify({
        'success': True,
        'post_id': post_id,
        'message': 'Post scheduled successfully',
        'post': post_record
    }), 201


@app.route('/api/posts', methods=['GET'])
def get_posts():
    """Get all posts"""
    status_filter = request.args.get('status')
    
    posts = list(posts_db.values())
    
    if status_filter:
        posts = [p for p in posts if p['status'] == status_filter]
    
    # Sort by creation time (newest first)
    posts.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify({
        'posts': posts,
        'count': len(posts)
    })


@app.route('/api/posts/<post_id>', methods=['GET'])
def get_post(post_id):
    """Get a specific post"""
    post = posts_db.get(post_id)
    
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    
    return jsonify({'post': post})


@app.route('/api/posts/<post_id>', methods=['DELETE'])
def delete_post(post_id):
    """Delete/cancel a scheduled post"""
    post = posts_db.get(post_id)
    
    if not post:
        return jsonify({'error': 'Post not found'}), 404
    
    if post['status'] == 'scheduled':
        # Remove scheduled job
        try:
            scheduler.remove_job(post_id)
        except Exception as e:
            logger.warning(f"Could not remove job {post_id}: {e}")
    
    # Remove from database
    del posts_db[post_id]
    
    return jsonify({
        'success': True,
        'message': 'Post deleted successfully'
    })


@app.route('/', methods=['GET'])
def index():
    """Serve the frontend or API information"""
    # Check if frontend build exists
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')
    if os.path.exists(os.path.join(frontend_path, 'index.html')):
        return send_from_directory(frontend_path, 'index.html')
    
    # Fallback to API information if no frontend
    return jsonify({
        'name': 'MastaBlasta API',
        'version': '1.0.0',
        'description': 'Multi-platform social media posting service',
        'endpoints': {
            'health': '/api/health',
            'accounts': '/api/accounts',
            'platforms': '/api/platforms',
            'post': '/api/post',
            'schedule': '/api/schedule',
            'posts': '/api/posts',
            'delete_post': '/api/posts/:id',
            'test_account': '/api/accounts/:id/test',
            'shorten_url': '/api/urls/shorten',
            'url_stats': '/api/urls/:short_code/stats',
            'social_monitors': '/api/social-monitors',
            'monitor_results': '/api/social-monitors/:id/results'
        }
    })


# URL Shortening & Tracking Endpoints

def generate_short_code():
    """Generate a unique short code for URLs"""
    import random
    import string
    chars = string.ascii_letters + string.digits
    while True:
        code = ''.join(random.choice(chars) for _ in range(6))
        if code not in shortened_urls:
            return code


@app.route('/api/urls/shorten', methods=['POST'])
def shorten_url():
    """Shorten a URL with tracking capabilities"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    original_url = data.get('url', '')
    utm_source = data.get('utm_source', '')
    utm_medium = data.get('utm_medium', '')
    utm_campaign = data.get('utm_campaign', '')
    custom_code = data.get('custom_code', '')
    
    if not original_url:
        return jsonify({'error': 'URL is required'}), 400
    
    # Check if custom code is already taken
    if custom_code and custom_code in shortened_urls:
        return jsonify({'error': 'Custom code already exists'}), 400
    
    # Generate or use custom code
    short_code = custom_code if custom_code else generate_short_code()
    
    # Build URL with UTM parameters
    final_url = original_url
    utm_params = []
    if utm_source:
        utm_params.append(f'utm_source={utm_source}')
    if utm_medium:
        utm_params.append(f'utm_medium={utm_medium}')
    if utm_campaign:
        utm_params.append(f'utm_campaign={utm_campaign}')
    
    if utm_params:
        separator = '&' if '?' in original_url else '?'
        final_url = f"{original_url}{separator}{'&'.join(utm_params)}"
    
    # Store shortened URL
    url_id = str(uuid.uuid4())
    shortened_urls[short_code] = {
        'id': url_id,
        'short_code': short_code,
        'original_url': original_url,
        'final_url': final_url,
        'utm_source': utm_source,
        'utm_medium': utm_medium,
        'utm_campaign': utm_campaign,
        'created_at': datetime.utcnow().isoformat(),
        'clicks': 0
    }
    
    # Initialize click tracking
    url_clicks[short_code] = []
    
    base_url = request.host_url.rstrip('/')
    short_url = f"{base_url}/u/{short_code}"
    
    return jsonify({
        'success': True,
        'id': url_id,
        'short_code': short_code,
        'short_url': short_url,
        'original_url': original_url,
        'final_url': final_url,
        'created_at': shortened_urls[short_code]['created_at']
    }), 201


@app.route('/u/<short_code>', methods=['GET'])
def redirect_short_url(short_code):
    """Redirect short URL and track click"""
    if short_code not in shortened_urls:
        return jsonify({'error': 'Short URL not found'}), 404
    
    url_data = shortened_urls[short_code]
    
    # Track click
    click_data = {
        'timestamp': datetime.utcnow().isoformat(),
        'user_agent': request.headers.get('User-Agent', ''),
        'referer': request.headers.get('Referer', ''),
        'ip': request.remote_addr
    }
    url_clicks[short_code].append(click_data)
    shortened_urls[short_code]['clicks'] += 1
    
    # Redirect to final URL
    from flask import redirect
    return redirect(url_data['final_url'], code=302)


@app.route('/api/urls', methods=['GET'])
def get_shortened_urls():
    """Get all shortened URLs"""
    urls = []
    for short_code, url_data in shortened_urls.items():
        urls.append({
            'id': url_data['id'],
            'short_code': short_code,
            'original_url': url_data['original_url'],
            'final_url': url_data['final_url'],
            'clicks': url_data['clicks'],
            'created_at': url_data['created_at'],
            'utm_source': url_data.get('utm_source', ''),
            'utm_medium': url_data.get('utm_medium', ''),
            'utm_campaign': url_data.get('utm_campaign', '')
        })
    
    # Sort by creation time (newest first)
    urls.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify({
        'urls': urls,
        'count': len(urls)
    })


@app.route('/api/urls/<short_code>', methods=['DELETE'])
def delete_shortened_url(short_code):
    """Delete a shortened URL"""
    if short_code not in shortened_urls:
        return jsonify({'error': 'Short URL not found'}), 404
    
    del shortened_urls[short_code]
    if short_code in url_clicks:
        del url_clicks[short_code]
    
    return jsonify({
        'success': True,
        'message': 'Shortened URL deleted successfully'
    })


@app.route('/api/urls/<short_code>/stats', methods=['GET'])
def get_url_stats(short_code):
    """Get click statistics for a shortened URL"""
    if short_code not in shortened_urls:
        return jsonify({'error': 'Short URL not found'}), 404
    
    url_data = shortened_urls[short_code]
    clicks = url_clicks.get(short_code, [])
    
    # Aggregate stats
    total_clicks = len(clicks)
    unique_ips = len(set(click['ip'] for click in clicks))
    
    # Group clicks by date
    clicks_by_date = {}
    for click in clicks:
        date = click['timestamp'][:10]  # YYYY-MM-DD
        clicks_by_date[date] = clicks_by_date.get(date, 0) + 1
    
    # Get top referers
    referers = {}
    for click in clicks:
        ref = click['referer'] or 'Direct'
        referers[ref] = referers.get(ref, 0) + 1
    
    return jsonify({
        'short_code': short_code,
        'original_url': url_data['original_url'],
        'created_at': url_data['created_at'],
        'total_clicks': total_clicks,
        'unique_visitors': unique_ips,
        'clicks_by_date': clicks_by_date,
        'top_referers': sorted(referers.items(), key=lambda x: x[1], reverse=True)[:5],
        'recent_clicks': clicks[-10:][::-1]  # Last 10 clicks, most recent first
    })


# Social Listening & Monitoring Endpoints

@app.route('/api/social-monitors', methods=['GET'])
def get_social_monitors():
    """Get all social listening monitors"""
    monitors = []
    for monitor_id, monitor in social_monitors.items():
        result_count = len(monitor_results.get(monitor_id, []))
        monitors.append({
            'id': monitor_id,
            'name': monitor['name'],
            'keywords': monitor['keywords'],
            'platforms': monitor['platforms'],
            'active': monitor['active'],
            'created_at': monitor['created_at'],
            'result_count': result_count
        })
    
    # Sort by creation time (newest first)
    monitors.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify({
        'monitors': monitors,
        'count': len(monitors)
    })


@app.route('/api/social-monitors', methods=['POST'])
def create_social_monitor():
    """Create a new social listening monitor"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    name = data.get('name', '')
    keywords = data.get('keywords', [])
    platforms = data.get('platforms', [])
    
    if not name:
        return jsonify({'error': 'Monitor name is required'}), 400
    
    if not keywords:
        return jsonify({'error': 'At least one keyword is required'}), 400
    
    if not platforms:
        return jsonify({'error': 'At least one platform is required'}), 400
    
    # Create monitor
    monitor_id = str(uuid.uuid4())
    social_monitors[monitor_id] = {
        'id': monitor_id,
        'name': name,
        'keywords': keywords,
        'platforms': platforms,
        'active': True,
        'created_at': datetime.utcnow().isoformat()
    }
    
    # Initialize results storage
    monitor_results[monitor_id] = []
    
    # Simulate initial scan results
    _simulate_monitor_scan(monitor_id)
    
    return jsonify({
        'success': True,
        'monitor_id': monitor_id,
        'message': 'Social monitor created successfully',
        'monitor': social_monitors[monitor_id]
    }), 201


def _simulate_monitor_scan(monitor_id):
    """Simulate social media monitoring scan (demo data)"""
    monitor = social_monitors.get(monitor_id)
    if not monitor:
        return
    
    # Generate some demo results
    import random
    from datetime import timedelta
    
    demo_users = ['@user1', '@user2', '@company_x', '@influencer', '@brand_y']
    demo_sentiments = ['positive', 'neutral', 'negative']
    
    for keyword in monitor['keywords']:
        for platform in monitor['platforms']:
            # Generate 3-5 demo mentions per keyword/platform
            num_mentions = random.randint(3, 5)
            for _ in range(num_mentions):
                result = {
                    'id': str(uuid.uuid4()),
                    'platform': platform,
                    'keyword': keyword,
                    'author': random.choice(demo_users),
                    'content': f"Demo mention of '{keyword}' on {platform}",
                    'url': f'https://{platform}.com/post/{random.randint(100000, 999999)}',
                    'sentiment': random.choice(demo_sentiments),
                    'engagement': {
                        'likes': random.randint(0, 500),
                        'shares': random.randint(0, 100),
                        'comments': random.randint(0, 50)
                    },
                    'timestamp': (datetime.utcnow() - timedelta(hours=random.randint(0, 48))).isoformat(),
                    'read': False
                }
                monitor_results[monitor_id].append(result)


@app.route('/api/social-monitors/<monitor_id>', methods=['PUT'])
def update_social_monitor(monitor_id):
    """Update a social monitor"""
    if monitor_id not in social_monitors:
        return jsonify({'error': 'Monitor not found'}), 404
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    monitor = social_monitors[monitor_id]
    
    if 'name' in data:
        monitor['name'] = data['name']
    if 'keywords' in data:
        monitor['keywords'] = data['keywords']
    if 'platforms' in data:
        monitor['platforms'] = data['platforms']
    if 'active' in data:
        monitor['active'] = data['active']
    
    monitor['updated_at'] = datetime.utcnow().isoformat()
    
    return jsonify({
        'success': True,
        'message': 'Monitor updated successfully',
        'monitor': monitor
    })


@app.route('/api/social-monitors/<monitor_id>', methods=['DELETE'])
def delete_social_monitor(monitor_id):
    """Delete a social monitor"""
    if monitor_id not in social_monitors:
        return jsonify({'error': 'Monitor not found'}), 404
    
    del social_monitors[monitor_id]
    if monitor_id in monitor_results:
        del monitor_results[monitor_id]
    
    return jsonify({
        'success': True,
        'message': 'Monitor deleted successfully'
    })


@app.route('/api/social-monitors/<monitor_id>/results', methods=['GET'])
def get_monitor_results(monitor_id):
    """Get results for a specific monitor"""
    if monitor_id not in social_monitors:
        return jsonify({'error': 'Monitor not found'}), 404
    
    results = monitor_results.get(monitor_id, [])
    
    # Filter parameters
    platform = request.args.get('platform')
    sentiment = request.args.get('sentiment')
    unread_only = request.args.get('unread_only', 'false').lower() == 'true'
    
    filtered_results = results
    if platform:
        filtered_results = [r for r in filtered_results if r['platform'] == platform]
    if sentiment:
        filtered_results = [r for r in filtered_results if r['sentiment'] == sentiment]
    if unread_only:
        filtered_results = [r for r in filtered_results if not r['read']]
    
    # Sort by timestamp (newest first)
    filtered_results.sort(key=lambda x: x['timestamp'], reverse=True)
    
    return jsonify({
        'monitor_id': monitor_id,
        'results': filtered_results,
        'count': len(filtered_results),
        'total_count': len(results)
    })


@app.route('/api/social-monitors/<monitor_id>/results/<result_id>/mark-read', methods=['POST'])
def mark_result_read(monitor_id, result_id):
    """Mark a monitoring result as read"""
    if monitor_id not in social_monitors:
        return jsonify({'error': 'Monitor not found'}), 404
    
    results = monitor_results.get(monitor_id, [])
    for result in results:
        if result['id'] == result_id:
            result['read'] = True
            return jsonify({
                'success': True,
                'message': 'Result marked as read'
            })
    
    return jsonify({'error': 'Result not found'}), 404


@app.route('/api/social-monitors/<monitor_id>/refresh', methods=['POST'])
def refresh_monitor(monitor_id):
    """Manually refresh a monitor to fetch new results"""
    if monitor_id not in social_monitors:
        return jsonify({'error': 'Monitor not found'}), 404
    
    _simulate_monitor_scan(monitor_id)
    
    return jsonify({
        'success': True,
        'message': 'Monitor refreshed successfully',
        'result_count': len(monitor_results.get(monitor_id, []))
    })


# ==================== POST ANALYTICS ENDPOINTS ====================

def _simulate_post_analytics(post_id):
    """Simulate analytics data for a post (in production, fetch from platform APIs)"""
    import random
    from datetime import timedelta
    
    if post_id not in posts_db:
        return None
    
    post = posts_db[post_id]
    
    # Only generate analytics for published posts
    if post['status'] != 'published':
        return None
    
    # Simulate analytics if not already generated
    if post_id not in post_analytics:
        platforms_data = {}
        
        for platform in post.get('platforms', []):
            base_impressions = random.randint(500, 10000)
            base_engagement = int(base_impressions * random.uniform(0.02, 0.10))
            
            platforms_data[platform] = {
                'impressions': base_impressions,
                'reach': int(base_impressions * random.uniform(0.7, 0.9)),
                'likes': random.randint(int(base_engagement * 0.4), int(base_engagement * 0.6)),
                'comments': random.randint(int(base_engagement * 0.1), int(base_engagement * 0.2)),
                'shares': random.randint(int(base_engagement * 0.1), int(base_engagement * 0.2)),
                'clicks': random.randint(int(base_engagement * 0.2), int(base_engagement * 0.4)),
                'engagement_rate': round(random.uniform(2.0, 8.0), 2)
            }
        
        # Calculate totals
        total_impressions = sum(p['impressions'] for p in platforms_data.values())
        total_engagement = sum(p['likes'] + p['comments'] + p['shares'] for p in platforms_data.values())
        
        # Generate hourly data for the past 7 days
        hourly_data = []
        created_dt = datetime.fromisoformat(post['created_at'].replace('Z', '+00:00'))
        for i in range(168):  # 7 days * 24 hours
            hour_dt = created_dt + timedelta(hours=i)
            hourly_data.append({
                'timestamp': hour_dt.isoformat(),
                'impressions': random.randint(10, 200),
                'engagement': random.randint(1, 20)
            })
        
        # Generate audience demographics
        demographics = {
            'age_groups': {
                '18-24': random.randint(10, 30),
                '25-34': random.randint(20, 40),
                '35-44': random.randint(15, 30),
                '45-54': random.randint(10, 20),
                '55+': random.randint(5, 15)
            },
            'gender': {
                'male': random.randint(40, 60),
                'female': random.randint(40, 60)
            },
            'top_locations': [
                {'country': 'United States', 'percentage': random.randint(30, 50)},
                {'country': 'United Kingdom', 'percentage': random.randint(10, 20)},
                {'country': 'Canada', 'percentage': random.randint(5, 15)},
                {'country': 'Australia', 'percentage': random.randint(5, 10)},
                {'country': 'Germany', 'percentage': random.randint(3, 8)}
            ]
        }
        
        post_analytics[post_id] = {
            'post_id': post_id,
            'platforms': platforms_data,
            'totals': {
                'impressions': total_impressions,
                'engagement': total_engagement,
                'engagement_rate': round((total_engagement / total_impressions * 100) if total_impressions > 0 else 0, 2)
            },
            'hourly_data': hourly_data,
            'demographics': demographics,
            'last_updated': datetime.utcnow().isoformat()
        }
    
    return post_analytics[post_id]


@app.route('/api/analytics/posts/<post_id>', methods=['GET'])
def get_post_analytics(post_id):
    """Get analytics for a specific post"""
    if post_id not in posts_db:
        return jsonify({'error': 'Post not found'}), 404
    
    analytics = _simulate_post_analytics(post_id)
    
    if not analytics:
        return jsonify({'error': 'Analytics not available for this post'}), 404
    
    return jsonify(analytics)


@app.route('/api/analytics/dashboard', methods=['GET'])
def get_analytics_dashboard():
    """Get overall analytics dashboard data"""
    # Get date range from query params
    days = int(request.args.get('days', 30))
    
    # Get all published posts
    published_posts = [p for p in posts_db.values() if p['status'] == 'published']
    
    # Generate analytics for all published posts
    all_analytics = []
    for post in published_posts:
        analytics = _simulate_post_analytics(post['id'])
        if analytics:
            all_analytics.append(analytics)
    
    # Calculate totals
    total_impressions = sum(a['totals']['impressions'] for a in all_analytics)
    total_engagement = sum(a['totals']['engagement'] for a in all_analytics)
    avg_engagement_rate = sum(a['totals']['engagement_rate'] for a in all_analytics) / len(all_analytics) if all_analytics else 0
    
    # Platform breakdown
    platform_totals = {}
    for analytics in all_analytics:
        for platform, data in analytics['platforms'].items():
            if platform not in platform_totals:
                platform_totals[platform] = {
                    'impressions': 0,
                    'engagement': 0,
                    'posts': 0
                }
            platform_totals[platform]['impressions'] += data['impressions']
            platform_totals[platform]['engagement'] += data['likes'] + data['comments'] + data['shares']
            platform_totals[platform]['posts'] += 1
    
    # Top performing posts
    top_posts = sorted(
        [{'post_id': a['post_id'], 'engagement': a['totals']['engagement'], 
          'impressions': a['totals']['impressions'], 'engagement_rate': a['totals']['engagement_rate']} 
         for a in all_analytics],
        key=lambda x: x['engagement'],
        reverse=True
    )[:10]
    
    # Engagement trends (aggregate hourly data)
    trend_data = []
    if all_analytics:
        # Get the most recent analytics hourly data as template
        for i in range(min(168, len(all_analytics[0]['hourly_data']))):
            total_imp = sum(a['hourly_data'][i]['impressions'] for a in all_analytics if i < len(a['hourly_data']))
            total_eng = sum(a['hourly_data'][i]['engagement'] for a in all_analytics if i < len(a['hourly_data']))
            trend_data.append({
                'timestamp': all_analytics[0]['hourly_data'][i]['timestamp'],
                'impressions': total_imp,
                'engagement': total_eng
            })
    
    return jsonify({
        'summary': {
            'total_posts': len(published_posts),
            'total_impressions': total_impressions,
            'total_engagement': total_engagement,
            'avg_engagement_rate': round(avg_engagement_rate, 2)
        },
        'platform_breakdown': platform_totals,
        'top_posts': top_posts,
        'engagement_trends': trend_data[-168:]  # Last 7 days
    })


@app.route('/api/analytics/compare', methods=['POST'])
def compare_posts():
    """Compare analytics between multiple posts"""
    data = request.get_json()
    post_ids = data.get('post_ids', [])
    
    if not post_ids:
        return jsonify({'error': 'No post IDs provided'}), 400
    
    comparison_data = []
    for post_id in post_ids:
        if post_id in posts_db:
            analytics = _simulate_post_analytics(post_id)
            if analytics:
                post = posts_db[post_id]
                comparison_data.append({
                    'post_id': post_id,
                    'content': post['content'][:100] + '...' if len(post['content']) > 100 else post['content'],
                    'platforms': list(analytics['platforms'].keys()),
                    'metrics': analytics['totals'],
                    'created_at': post['created_at']
                })
    
    return jsonify({
        'posts': comparison_data,
        'count': len(comparison_data)
    })


# ==================== BULK IMPORT ENDPOINTS ====================

@app.route('/api/bulk-import/validate', methods=['POST'])
def validate_bulk_import():
    """Validate CSV data before importing"""
    data = request.get_json()
    rows = data.get('rows', [])
    
    if not rows:
        return jsonify({'error': 'No data provided'}), 400
    
    # Validate each row
    errors = []
    warnings = []
    valid_rows = []
    
    required_fields = ['content']
    
    for i, row in enumerate(rows):
        row_errors = []
        row_warnings = []
        
        # Check required fields
        if 'content' not in row or not row['content'].strip():
            row_errors.append('Content is required')
        
        # Validate platforms if provided
        if 'platforms' in row:
            platforms = row['platforms'] if isinstance(row['platforms'], list) else [p.strip() for p in row['platforms'].split(',')]
            invalid_platforms = [p for p in platforms if p not in PLATFORM_ADAPTERS]
            if invalid_platforms:
                row_errors.append(f'Invalid platforms: {", ".join(invalid_platforms)}')
        
        # Validate scheduled_time if provided
        if 'scheduled_time' in row and row['scheduled_time']:
            try:
                scheduled_dt = datetime.fromisoformat(row['scheduled_time'].replace('Z', '+00:00'))
                if scheduled_dt <= datetime.now(scheduled_dt.tzinfo):
                    row_warnings.append('Scheduled time is in the past')
            except ValueError:
                row_errors.append('Invalid scheduled_time format')
        
        # Validate account_ids if provided
        if 'account_ids' in row and row['account_ids']:
            account_ids = row['account_ids'] if isinstance(row['account_ids'], list) else [a.strip() for a in row['account_ids'].split(',')]
            missing_accounts = [aid for aid in account_ids if aid not in accounts_db]
            if missing_accounts:
                row_errors.append(f'Accounts not found: {", ".join(missing_accounts)}')
        
        if row_errors:
            errors.append({
                'row': i + 1,
                'errors': row_errors
            })
        elif row_warnings:
            warnings.append({
                'row': i + 1,
                'warnings': row_warnings
            })
            valid_rows.append(i)
        else:
            valid_rows.append(i)
    
    return jsonify({
        'valid': len(errors) == 0,
        'total_rows': len(rows),
        'valid_rows': len(valid_rows),
        'errors': errors,
        'warnings': warnings
    })


@app.route('/api/bulk-import/execute', methods=['POST'])
def execute_bulk_import():
    """Execute bulk import of posts from CSV data"""
    data = request.get_json()
    rows = data.get('rows', [])
    schedule_all = data.get('schedule_all', False)
    
    if not rows:
        return jsonify({'error': 'No data provided'}), 400
    
    import_id = str(uuid.uuid4())
    created_posts = []
    failed_posts = []
    
    for i, row in enumerate(rows):
        try:
            content = row.get('content', '').strip()
            if not content:
                failed_posts.append({
                    'row': i + 1,
                    'error': 'Content is required'
                })
                continue
            
            # Parse platforms
            platforms = []
            if 'platforms' in row and row['platforms']:
                platforms = row['platforms'] if isinstance(row['platforms'], list) else [p.strip() for p in row['platforms'].split(',')]
            
            # Parse account_ids
            account_ids = []
            if 'account_ids' in row and row['account_ids']:
                account_ids = row['account_ids'] if isinstance(row['account_ids'], list) else [a.strip() for a in row['account_ids'].split(',')]
            
            # If no platforms or accounts specified, skip
            if not platforms and not account_ids:
                failed_posts.append({
                    'row': i + 1,
                    'error': 'Either platforms or account_ids must be specified'
                })
                continue
            
            # Get credentials from accounts
            credentials = {}
            if account_ids:
                for account_id in account_ids:
                    account = accounts_db.get(account_id)
                    if account:
                        platforms.append(account['platform'])
                        credentials[account['platform']] = account.get('credentials', {})
            
            # Parse scheduled_time
            scheduled_time = row.get('scheduled_time')
            
            # Get post type and options
            post_type = row.get('post_type', 'standard')
            post_options = row.get('post_options', {})
            
            # Create post
            post_id = str(uuid.uuid4())
            
            if scheduled_time or schedule_all:
                # Schedule the post
                if not scheduled_time:
                    # Auto-schedule at intervals
                    scheduled_dt = datetime.utcnow() + timedelta(minutes=len(created_posts) * 5)
                    scheduled_time = scheduled_dt.isoformat() + 'Z'
                
                scheduled_dt = datetime.fromisoformat(scheduled_time.replace('Z', '+00:00'))
                
                post_record = {
                    'id': post_id,
                    'content': content,
                    'media': row.get('media'),
                    'platforms': list(set(platforms)),  # Remove duplicates
                    'account_ids': account_ids,
                    'post_type': post_type,
                    'post_options': post_options,
                    'status': 'scheduled',
                    'created_at': datetime.utcnow().isoformat(),
                    'scheduled_for': scheduled_time,
                    'bulk_import_id': import_id
                }
                
                posts_db[post_id] = post_record
                
                # Schedule the job
                scheduler.add_job(
                    publish_to_platforms,
                    'date',
                    run_date=scheduled_dt,
                    args=[post_id, list(set(platforms)), content, row.get('media'), credentials, post_type, post_options],
                    id=post_id
                )
            else:
                # Publish immediately
                post_record = {
                    'id': post_id,
                    'content': content,
                    'media': row.get('media'),
                    'platforms': list(set(platforms)),
                    'account_ids': account_ids,
                    'post_type': post_type,
                    'post_options': post_options,
                    'status': 'publishing',
                    'created_at': datetime.utcnow().isoformat(),
                    'bulk_import_id': import_id
                }
                
                posts_db[post_id] = post_record
                
                # Publish immediately
                results = publish_to_platforms(post_id, list(set(platforms)), content, row.get('media'), credentials, post_type, post_options)
            
            created_posts.append({
                'row': i + 1,
                'post_id': post_id,
                'status': post_record['status']
            })
            
        except Exception as e:
            logger.error(f"Error importing row {i + 1}: {str(e)}")
            failed_posts.append({
                'row': i + 1,
                'error': str(e)
            })
    
    # Store import job info
    bulk_imports[import_id] = {
        'id': import_id,
        'created_at': datetime.utcnow().isoformat(),
        'total_rows': len(rows),
        'successful': len(created_posts),
        'failed': len(failed_posts),
        'created_posts': created_posts,
        'failed_posts': failed_posts
    }
    
    return jsonify({
        'success': True,
        'import_id': import_id,
        'summary': {
            'total': len(rows),
            'successful': len(created_posts),
            'failed': len(failed_posts)
        },
        'created_posts': created_posts,
        'failed_posts': failed_posts
    }), 201


@app.route('/api/bulk-import/<import_id>', methods=['GET'])
def get_bulk_import_status(import_id):
    """Get status of a bulk import job"""
    import_job = bulk_imports.get(import_id)
    
    if not import_job:
        return jsonify({'error': 'Import job not found'}), 404
    
    return jsonify(import_job)


@app.route('/api/bulk-import', methods=['GET'])
def list_bulk_imports():
    """List all bulk import jobs"""
    imports = list(bulk_imports.values())
    imports.sort(key=lambda x: x['created_at'], reverse=True)
    
    return jsonify({
        'imports': imports,
        'count': len(imports)
    })


@app.route('/', methods=['GET'])
def index():
    """Serve the frontend or API information"""
    # Check if frontend build exists
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')
    if os.path.exists(os.path.join(frontend_path, 'index.html')):
        return send_from_directory(frontend_path, 'index.html')
    
    # Fallback to API information if no frontend
    return jsonify({
        'name': 'MastaBlasta API',
        'version': '1.0.0',
        'description': 'Multi-platform social media posting service',
        'endpoints': {
            'health': '/api/health',
            'accounts': '/api/accounts',
            'platforms': '/api/platforms',
            'post': '/api/post',
            'schedule': '/api/schedule',
            'posts': '/api/posts',
            'delete_post': '/api/posts/:id',
            'test_account': '/api/accounts/:id/test'
        }
    })


# ==================== Google Calendar Integration ====================

@app.route('/api/google-calendar/auth', methods=['POST'])
def google_calendar_auth():
    """Exchange authorization code for tokens"""
    data = request.json
    code = data.get('code')
    
    # TODO: In production, exchange code for tokens with Google OAuth2
    # This is a simplified mock response
    return jsonify({
        'access_token': f'mock_access_token_{uuid.uuid4()}',
        'refresh_token': f'mock_refresh_token_{uuid.uuid4()}',
        'expires_in': 3600
    })


@app.route('/api/google-calendar/sync', methods=['POST'])
def sync_google_calendar():
    """Sync posts with Google Calendar"""
    data = request.json
    access_token = data.get('access_token')
    calendar_id = data.get('calendar_id', 'primary')
    events = data.get('events', [])
    
    # TODO: In production, use Google Calendar API to create/update events
    # This is a mock implementation
    logger.info(f"Syncing {len(events)} events to Google Calendar {calendar_id}")
    
    return jsonify({
        'success': True,
        'synced_count': len(events),
        'message': f'Successfully synced {len(events)} events to Google Calendar'
    })


# ==================== Google Drive Integration ====================

@app.route('/api/google-drive/auth', methods=['POST'])
def google_drive_auth():
    """Exchange authorization code for tokens"""
    data = request.json
    code = data.get('code')
    
    # TODO: In production, exchange code for tokens with Google OAuth2
    # This is a simplified mock response
    return jsonify({
        'access_token': f'mock_drive_access_token_{uuid.uuid4()}',
        'refresh_token': f'mock_drive_refresh_token_{uuid.uuid4()}',
        'expires_in': 3600
    })


@app.route('/api/google-drive/list', methods=['POST'])
def list_drive_files():
    """List files from Google Drive folder"""
    data = request.json
    access_token = data.get('access_token')
    folder_id = data.get('folder_id', 'root')
    
    # TODO: In production, use Google Drive API to list files
    # This is a mock implementation with sample files
    import random
    
    mock_files = [
        {
            'id': str(uuid.uuid4()),
            'name': 'Campaign Banner.jpg',
            'mimeType': 'image/jpeg',
            'type': 'file',
            'size': '2458624',
            'createdTime': '2026-01-01T12:00:00Z',
            'thumbnailLink': 'https://via.placeholder.com/150',
            'webViewLink': 'https://drive.google.com/file/d/sample'
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Product Video.mp4',
            'mimeType': 'video/mp4',
            'type': 'file',
            'size': '15728640',
            'createdTime': '2026-01-02T14:30:00Z',
            'webViewLink': 'https://drive.google.com/file/d/sample'
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Press Release.pdf',
            'mimeType': 'application/pdf',
            'type': 'file',
            'size': '524288',
            'createdTime': '2026-01-03T09:15:00Z',
            'webViewLink': 'https://drive.google.com/file/d/sample'
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Templates',
            'mimeType': 'application/vnd.google-apps.folder',
            'type': 'folder',
            'createdTime': '2026-01-04T10:00:00Z',
            'webViewLink': 'https://drive.google.com/drive/folders/sample'
        },
        {
            'id': str(uuid.uuid4()),
            'name': 'Social Media Images',
            'mimeType': 'application/vnd.google-apps.folder',
            'type': 'folder',
            'createdTime': '2026-01-05T11:00:00Z',
            'webViewLink': 'https://drive.google.com/drive/folders/sample'
        }
    ]
    
    # Add more random image files
    for i in range(5):
        mock_files.append({
            'id': str(uuid.uuid4()),
            'name': f'Image_{i+1}.png',
            'mimeType': 'image/png',
            'type': 'file',
            'size': str(random.randint(500000, 3000000)),
            'createdTime': f'2026-01-0{i+1}T15:00:00Z',
            'thumbnailLink': 'https://via.placeholder.com/150',
            'webViewLink': 'https://drive.google.com/file/d/sample'
        })
    
    logger.info(f"Listing files from Google Drive folder {folder_id}")
    
    return jsonify(mock_files)


# ==================== Templates API ====================

@app.route('/api/templates', methods=['GET', 'POST'])
def templates():
    """Get all templates or create a new one"""
    if request.method == 'GET':
        return jsonify(list(templates_db.values()))
    
    elif request.method == 'POST':
        data = request.json
        template_id = str(uuid.uuid4())
        
        # Extract variables from content
        import re
        content = data.get('content', '')
        variables = list(set(re.findall(r'\{\{(\w+)\}\}', content)))
        
        template = {
            'id': template_id,
            'name': data.get('name'),
            'content': content,
            'platforms': data.get('platforms', []),
            'variables': variables,
            'createdAt': datetime.utcnow().isoformat() + 'Z'
        }
        
        templates_db[template_id] = template
        logger.info(f"Created template {template_id}: {template['name']}")
        
        return jsonify(template), 201


@app.route('/api/templates/<template_id>', methods=['GET', 'DELETE'])
def template_detail(template_id):
    """Get or delete a specific template"""
    if template_id not in templates_db:
        return jsonify({'error': 'Template not found'}), 404
    
    if request.method == 'GET':
        return jsonify(templates_db[template_id])
    
    elif request.method == 'DELETE':
        del templates_db[template_id]
        logger.info(f"Deleted template {template_id}")
        return jsonify({'message': 'Template deleted successfully'})


###############################################################################
# A/B TESTING & POST VERSIONING API ENDPOINTS
###############################################################################

@app.route('/api/post-versions', methods=['POST'])
def create_post_version():
    """Create a new version for A/B testing"""
    data = request.json
    
    # Validate required fields
    required_fields = ['original_post_id', 'version_name', 'content', 'platforms']
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Missing required fields'}), 400
    
    version_id = str(uuid.uuid4())
    version = {
        'id': version_id,
        'original_post_id': data['original_post_id'],
        'version_name': data['version_name'],
        'content': data['content'],
        'platforms': data['platforms'],
        'hashtags': data.get('hashtags', []),
        'cta': data.get('cta', ''),
        'created_at': datetime.utcnow().isoformat(),
        'status': 'draft'  # draft, testing, winner, archived
    }
    
    # Store version
    if data['original_post_id'] not in post_versions:
        post_versions[data['original_post_id']] = []
    
    post_versions[data['original_post_id']].append(version)
    
    # Initialize test results
    ab_test_results[version_id] = {
        'impressions': 0,
        'engagement': 0,
        'clicks': 0,
        'shares': 0,
        'comments': 0,
        'likes': 0,
        'engagement_rate': 0.0,
        'winner': False
    }
    
    logger.info(f"Created post version {version_id} for post {data['original_post_id']}")
    return jsonify(version), 201


@app.route('/api/post-versions/<post_id>', methods=['GET'])
def get_post_versions(post_id):
    """Get all versions of a post"""
    versions = post_versions.get(post_id, [])
    
    # Enhance with test results
    enhanced_versions = []
    for version in versions:
        version_data = version.copy()
        version_data['results'] = ab_test_results.get(version['id'], {})
        enhanced_versions.append(version_data)
    
    return jsonify(enhanced_versions)


@app.route('/api/post-versions/<version_id>/publish', methods=['POST'])
def publish_version(version_id):
    """Publish a specific version for A/B testing"""
    # Find the version
    version = None
    for post_id, versions in post_versions.items():
        for v in versions:
            if v['id'] == version_id:
                version = v
                break
    
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    # Update status
    version['status'] = 'testing'
    version['published_at'] = datetime.utcnow().isoformat()
    
    # Simulate initial analytics (in production, integrate with platform APIs)
    import random
    ab_test_results[version_id] = {
        'impressions': random.randint(1000, 5000),
        'engagement': random.randint(50, 300),
        'clicks': random.randint(20, 150),
        'shares': random.randint(5, 50),
        'comments': random.randint(3, 30),
        'likes': random.randint(30, 200),
        'engagement_rate': round(random.uniform(2.0, 8.0), 2),
        'winner': False
    }
    
    logger.info(f"Published version {version_id} for testing")
    return jsonify({
        'message': 'Version published for testing',
        'version': version,
        'results': ab_test_results[version_id]
    })


@app.route('/api/post-versions/<version_id>/winner', methods=['POST'])
def mark_winner(version_id):
    """Mark a version as the winner"""
    # Find the version
    version = None
    post_id = None
    for pid, versions in post_versions.items():
        for v in versions:
            if v['id'] == version_id:
                version = v
                post_id = pid
                break
    
    if not version:
        return jsonify({'error': 'Version not found'}), 404
    
    # Update all versions for this post
    for v in post_versions[post_id]:
        if v['id'] == version_id:
            v['status'] = 'winner'
            ab_test_results[v['id']]['winner'] = True
        else:
            v['status'] = 'archived'
            ab_test_results[v['id']]['winner'] = False
    
    logger.info(f"Marked version {version_id} as winner")
    return jsonify({
        'message': 'Version marked as winner',
        'version': version
    })


@app.route('/api/ab-tests/compare', methods=['POST'])
def compare_versions():
    """Compare multiple versions side-by-side"""
    data = request.json
    version_ids = data.get('version_ids', [])
    
    comparison = []
    for version_id in version_ids:
        # Find version
        version = None
        for post_id, versions in post_versions.items():
            for v in versions:
                if v['id'] == version_id:
                    version = v
                    break
        
        if version:
            comparison.append({
                'version': version,
                'results': ab_test_results.get(version_id, {})
            })
    
    return jsonify(comparison)


###############################################################################
# AUTOMATED RESPONSE TEMPLATES & CHATBOT API ENDPOINTS
###############################################################################

@app.route('/api/response-templates', methods=['GET', 'POST'])
def response_templates_list():
    """List or create response templates"""
    if request.method == 'GET':
        # Get query parameters for filtering
        platform = request.args.get('platform')
        category = request.args.get('category')
        
        templates = list(response_templates.values())
        
        # Apply filters
        if platform:
            templates = [t for t in templates if platform in t.get('platforms', [])]
        if category:
            templates = [t for t in templates if t.get('category') == category]
        
        return jsonify(templates)
    
    elif request.method == 'POST':
        data = request.json
        
        # Validate required fields
        if 'name' not in data or 'template' not in data:
            return jsonify({'error': 'Missing required fields'}), 400
        
        template_id = str(uuid.uuid4())
        template = {
            'id': template_id,
            'name': data['name'],
            'template': data['template'],
            'category': data.get('category', 'general'),
            'platforms': data.get('platforms', ['twitter', 'facebook', 'instagram', 'linkedin']),
            'sentiment': data.get('sentiment', 'neutral'),  # positive, neutral, negative, urgent
            'keywords': data.get('keywords', []),
            'auto_reply': data.get('auto_reply', False),
            'created_at': datetime.utcnow().isoformat()
        }
        
        response_templates[template_id] = template
        logger.info(f"Created response template {template_id}")
        return jsonify(template), 201


@app.route('/api/response-templates/<template_id>', methods=['GET', 'PUT', 'DELETE'])
def response_template_detail(template_id):
    """Get, update, or delete a response template"""
    if template_id not in response_templates:
        return jsonify({'error': 'Template not found'}), 404
    
    if request.method == 'GET':
        return jsonify(response_templates[template_id])
    
    elif request.method == 'PUT':
        data = request.json
        template = response_templates[template_id]
        
        # Update fields
        template['name'] = data.get('name', template['name'])
        template['template'] = data.get('template', template['template'])
        template['category'] = data.get('category', template['category'])
        template['platforms'] = data.get('platforms', template['platforms'])
        template['sentiment'] = data.get('sentiment', template['sentiment'])
        template['keywords'] = data.get('keywords', template['keywords'])
        template['auto_reply'] = data.get('auto_reply', template['auto_reply'])
        template['updated_at'] = datetime.utcnow().isoformat()
        
        logger.info(f"Updated response template {template_id}")
        return jsonify(template)
    
    elif request.method == 'DELETE':
        del response_templates[template_id]
        logger.info(f"Deleted response template {template_id}")
        return jsonify({'message': 'Template deleted successfully'})


@app.route('/api/chatbot/suggest-response', methods=['POST'])
def suggest_response():
    """AI-powered response suggestion based on incoming message"""
    data = request.json
    
    message = data.get('message', '')
    platform = data.get('platform', 'twitter')
    sentiment = data.get('sentiment', 'neutral')
    
    # Find matching templates based on keywords and sentiment
    matching_templates = []
    message_lower = message.lower()
    
    for template in response_templates.values():
        # Check platform match
        if platform not in template['platforms']:
            continue
        
        # Check sentiment match
        if sentiment != 'neutral' and template['sentiment'] == sentiment:
            matching_templates.append(template)
            continue
        
        # Check keyword match
        for keyword in template['keywords']:
            if keyword.lower() in message_lower:
                matching_templates.append(template)
                break
    
    # If no specific match, return general templates
    if not matching_templates:
        matching_templates = [t for t in response_templates.values() 
                            if t['category'] == 'general' and platform in t['platforms']]
    
    # Return top 3 suggestions
    suggestions = matching_templates[:3]
    
    return jsonify({
        'message': message,
        'platform': platform,
        'sentiment': sentiment,
        'suggestions': suggestions
    })


@app.route('/api/chatbot/interactions', methods=['GET', 'POST'])
def chatbot_interactions_list():
    """List or record chatbot interactions"""
    if request.method == 'GET':
        # Get query parameters
        platform = request.args.get('platform')
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 20))
        
        interactions = list(chatbot_interactions.values())
        
        # Apply filters
        if platform:
            interactions = [i for i in interactions if i.get('platform') == platform]
        
        # Sort by timestamp (newest first)
        interactions.sort(key=lambda x: x.get('timestamp', ''), reverse=True)
        
        # Paginate
        start = (page - 1) * per_page
        end = start + per_page
        paginated = interactions[start:end]
        
        return jsonify({
            'interactions': paginated,
            'total': len(interactions),
            'page': page,
            'per_page': per_page
        })
    
    elif request.method == 'POST':
        data = request.json
        
        interaction_id = str(uuid.uuid4())
        interaction = {
            'id': interaction_id,
            'platform': data.get('platform', 'twitter'),
            'message': data.get('message', ''),
            'response': data.get('response', ''),
            'sentiment': data.get('sentiment', 'neutral'),
            'auto_replied': data.get('auto_replied', False),
            'template_used': data.get('template_used'),
            'timestamp': datetime.utcnow().isoformat(),
            'user': data.get('user', 'Unknown')
        }
        
        chatbot_interactions[interaction_id] = interaction
        logger.info(f"Recorded chatbot interaction {interaction_id}")
        return jsonify(interaction), 201


@app.route('/api/chatbot/stats', methods=['GET'])
def chatbot_stats():
    """Get chatbot statistics"""
    total_interactions = len(chatbot_interactions)
    auto_replies = sum(1 for i in chatbot_interactions.values() if i.get('auto_replied', False))
    
    # Count by platform
    platform_counts = {}
    for interaction in chatbot_interactions.values():
        platform = interaction.get('platform', 'unknown')
        platform_counts[platform] = platform_counts.get(platform, 0) + 1
    
    # Count by sentiment
    sentiment_counts = {}
    for interaction in chatbot_interactions.values():
        sentiment = interaction.get('sentiment', 'neutral')
        sentiment_counts[sentiment] = sentiment_counts.get(sentiment, 0) + 1
    
    # Average response time (simulated - in production, track actual times)
    avg_response_time = 2.5  # seconds
    
    return jsonify({
        'total_interactions': total_interactions,
        'auto_replies': auto_replies,
        'manual_replies': total_interactions - auto_replies,
        'auto_reply_rate': round((auto_replies / total_interactions * 100), 2) if total_interactions > 0 else 0,
        'platform_breakdown': platform_counts,
        'sentiment_breakdown': sentiment_counts,
        'avg_response_time_seconds': avg_response_time
    })


@app.route('/<path:path>')
def serve_frontend(path):
    """Serve frontend static files"""
    frontend_path = os.path.join(os.path.dirname(__file__), 'frontend', 'dist')
    if os.path.exists(os.path.join(frontend_path, path)):
        return send_from_directory(frontend_path, path)
    # For SPA routing, return index.html for non-API routes
    if os.path.exists(os.path.join(frontend_path, 'index.html')) and not path.startswith('api/'):
        return send_from_directory(frontend_path, 'index.html')
    return jsonify({'error': 'Not found'}), 404


if __name__ == '__main__':
    # Development server - for production use gunicorn (see Dockerfile)
    port = int(os.environ.get('PORT', 33766))
    app.run(host='0.0.0.0', port=port, debug=False)
