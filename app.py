from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from datetime import datetime
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


class PlatformAdapter:
    """Base adapter for social media platforms"""
    
    def __init__(self, platform_name):
        self.platform_name = platform_name
        
    def validate_credentials(self, credentials):
        """Validate platform credentials"""
        return True
    
    def format_post(self, content, media=None):
        """Format post content for specific platform"""
        return {
            'platform': self.platform_name,
            'content': content,
            'media': media
        }
    
    def publish(self, post_data, credentials):
        """Publish post to platform"""
        # In a real implementation, this would call the platform's API
        # Note: credentials are not logged to avoid exposing sensitive data
        logger.info(f"Publishing to {self.platform_name}")
        return {
            'success': True,
            'platform': self.platform_name,
            'post_id': str(uuid.uuid4()),
            'message': f'Post published to {self.platform_name}'
        }


class TwitterAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('twitter')
    
    def format_post(self, content, media=None):
        # Twitter has 280 character limit
        truncated_content = content[:280] if len(content) > 280 else content
        return {
            'platform': self.platform_name,
            'content': truncated_content,
            'media': media
        }


class FacebookAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('facebook')


class InstagramAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('instagram')
    
    def format_post(self, content, media=None):
        # Instagram requires media
        return {
            'platform': self.platform_name,
            'content': content,
            'media': media,
            'requires_media': True
        }


class LinkedInAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('linkedin')


# Initialize platform adapters
PLATFORM_ADAPTERS = {
    'twitter': TwitterAdapter(),
    'facebook': FacebookAdapter(),
    'instagram': InstagramAdapter(),
    'linkedin': LinkedInAdapter(),
}


def publish_to_platforms(post_id, platforms, content, media, credentials_dict):
    """Background task to publish to multiple platforms"""
    results = []
    
    for platform in platforms:
        if platform in PLATFORM_ADAPTERS:
            adapter = PLATFORM_ADAPTERS[platform]
            credentials = credentials_dict.get(platform, {})
            
            try:
                formatted_post = adapter.format_post(content, media)
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
            'display_name': name.capitalize(),
            'available': True,
            'supports_oauth': True  # All platforms now support OAuth
        })
    
    return jsonify({
        'platforms': platforms,
        'count': len(platforms)
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
        'status': 'publishing',
        'created_at': datetime.utcnow().isoformat(),
        'scheduled_for': None
    }
    
    posts_db[post_id] = post_record
    
    # Publish immediately
    publish_to_platforms(post_id, platforms, content, media, credentials)
    
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
        args=[post_id, platforms, content, media, credentials],
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
