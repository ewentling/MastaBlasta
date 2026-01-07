from flask import Flask, request, jsonify
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from datetime import datetime
import uuid
import os
import logging

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

# In-memory storage for posts (in production, use a database)
posts_db = {}


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


@app.route('/api/platforms', methods=['GET'])
def get_platforms():
    """Get list of supported platforms"""
    platforms = []
    for name, adapter in PLATFORM_ADAPTERS.items():
        platforms.append({
            'name': name,
            'display_name': name.capitalize(),
            'available': True
        })
    
    return jsonify({
        'platforms': platforms,
        'count': len(platforms)
    })


@app.route('/api/post', methods=['POST'])
def create_post():
    """Create and publish a post to multiple platforms"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    media = data.get('media', [])
    platforms = data.get('platforms', [])
    credentials = data.get('credentials', {})
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    if not platforms:
        return jsonify({'error': 'At least one platform must be specified'}), 400
    
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
    platforms = data.get('platforms', [])
    credentials = data.get('credentials', {})
    scheduled_time = data.get('scheduled_time')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    if not platforms:
        return jsonify({'error': 'At least one platform must be specified'}), 400
    
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
    """Root endpoint with API information"""
    return jsonify({
        'name': 'MastaBlasta API',
        'version': '1.0.0',
        'description': 'Multi-platform social media posting service',
        'endpoints': {
            'health': '/api/health',
            'platforms': '/api/platforms',
            'post': '/api/post',
            'schedule': '/api/schedule',
            'posts': '/api/posts',
            'delete_post': '/api/posts/:id'
        }
    })


if __name__ == '__main__':
    # Development server - for production use gunicorn (see Dockerfile)
    port = int(os.environ.get('PORT', 33766))
    app.run(host='0.0.0.0', port=port, debug=False)
