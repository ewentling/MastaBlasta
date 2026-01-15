from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_cors import CORS
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.jobstores.memory import MemoryJobStore
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import uuid
import os
import logging
import json
import time
import re
from typing import List, Dict, Any, Optional, Tuple

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

try:
    import openai
    from PIL import Image, ImageEnhance, ImageFilter
    import io
    import base64
    from sklearn.linear_model import LinearRegression
    from sklearn.preprocessing import StandardScaler
    import numpy as np
    import pandas as pd
    AI_ENABLED = True
except ImportError:
    AI_ENABLED = False
    logger.warning("AI libraries not installed. AI features will be disabled.")

app = Flask(__name__)
CORS(app)

# ==================== Production Infrastructure Integration ====================
# Load production infrastructure if available
try:
    from app_extensions import (
        db_manager, oauth_manager, media_manager, analytics_collector,
        webhook_manager, search_manager, bulk_ops_manager, retry_manager,
        auth_required, role_required, get_current_user, DB_ENABLED
    )
    from integrated_routes import integrated_bp
    PRODUCTION_MODE = True
    logger.info("✓ Production infrastructure loaded successfully")
except ImportError as e:
    PRODUCTION_MODE = False
    DB_ENABLED = False
    logger.warning(f"⚠ Running in development mode (in-memory storage): {e}")

# Register integrated routes if production mode is enabled
if PRODUCTION_MODE:
    app.register_blueprint(integrated_bp)
    logger.info("✓ Integrated routes registered at /api/v2/*")
    logger.info("  - /api/v2/auth/* - Authentication endpoints")
    logger.info("  - /api/v2/oauth/* - Real OAuth implementations")
    logger.info("  - /api/v2/media/* - Media upload and management")
    logger.info("  - /api/v2/posts/* - Database-backed posts")
    logger.info("  - /api/v2/search/* - Advanced search")
    logger.info("  - /api/v2/bulk/* - Bulk operations")
    logger.info("  - /api/v2/webhooks/* - Webhook system")
    logger.info("  - /api/v2/analytics/* - Real analytics")
else:
    logger.info("ℹ Using in-memory storage (development mode)")
    logger.info("  Set DATABASE_URL to enable production features")

# Register advanced features (TTS, Social Listening, AI Training)
try:
    from advanced_features import advanced_bp
    app.register_blueprint(advanced_bp)
    logger.info("✓ Advanced features registered at /api/advanced/*")
    logger.info("  - /api/advanced/tts/* - Real TTS provider integrations")
    logger.info("  - /api/advanced/social-listening/* - Social monitoring dashboard")
    logger.info("  - /api/advanced/ai-training/* - Custom AI model training")
except ImportError as e:
    logger.warning(f"⚠ Advanced features not available: {e}")

# Helper functions
def use_database():
    """Check if database should be used"""
    return PRODUCTION_MODE and DB_ENABLED

def get_user_from_request():
    """Get current user from request if authenticated"""
    if PRODUCTION_MODE:
        return get_current_user()
    return None
# ==================== End Production Integration ====================

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
ai_content_cache = {}  # Stores AI-generated content suggestions
scheduling_analytics = {}  # Stores historical posting performance
image_enhancements = {}  # Stores image enhancement metadata
engagement_predictions = {}  # Stores predicted engagement scores

# OAuth configuration constants
OAUTH_REQUIRED_ENV_VARS = {
    'twitter': ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'],
    'facebook': ['META_APP_ID', 'META_APP_SECRET'],
    'instagram': ['META_APP_ID', 'META_APP_SECRET'],
    'linkedin': ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'],
    'youtube': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']
}


# ==================== AI Services ====================

class AIContentGenerator:
    """AI-powered content generation service"""
    
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY', '')
        self.enabled = AI_ENABLED and bool(self.api_key)
        if self.enabled:
            openai.api_key = self.api_key
    
    def generate_caption(self, topic: str, platform: str, tone: str = "professional") -> Dict[str, Any]:
        """Generate optimized caption for a specific platform"""
        if not self.enabled:
            return {'error': 'AI content generation not enabled', 'enabled': False}
        
        try:
            # Platform-specific character limits
            limits = {
                'twitter': 280,
                'instagram': 2200,
                'facebook': 63206,
                'linkedin': 3000,
                'threads': 500,
                'bluesky': 300,
                'youtube': 5000,
                'pinterest': 500,
                'tiktok': 2200
            }
            
            max_length = limits.get(platform, 500)
            
            prompt = f"""Generate an engaging {tone} social media caption for {platform} about: {topic}

Requirements:
- Maximum {max_length} characters
- Platform: {platform}
- Tone: {tone}
- Include relevant emojis if appropriate
- Make it engaging and shareable
- For Twitter/Threads: can include relevant hashtags

Return only the caption text, no explanations."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a social media expert who creates engaging content."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            generated_caption = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'caption': generated_caption,
                'character_count': len(generated_caption),
                'character_limit': max_length,
                'platform': platform,
                'tone': tone
            }
        except Exception as e:
            logger.error(f"AI content generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def suggest_hashtags(self, content: str, platform: str, count: int = 5) -> Dict[str, Any]:
        """Suggest relevant hashtags for content"""
        if not self.enabled:
            return {'error': 'AI hashtag generation not enabled', 'enabled': False}
        
        try:
            prompt = f"""Suggest {count} relevant and trending hashtags for this {platform} post:

"{content}"

Requirements:
- Return exactly {count} hashtags
- Make them relevant to the content
- Consider platform trends
- Format: #hashtag (one per line)

Return only the hashtags, no explanations."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a social media hashtag expert."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=150,
                temperature=0.7
            )
            
            hashtags_text = response.choices[0].message.content.strip()
            hashtags = [h.strip() for h in hashtags_text.split('\n') if h.strip().startswith('#')]
            
            return {
                'success': True,
                'hashtags': hashtags[:count],
                'platform': platform,
                'original_content_length': len(content)
            }
        except Exception as e:
            logger.error(f"AI hashtag generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def rewrite_for_platform(self, content: str, source_platform: str, target_platform: str) -> Dict[str, Any]:
        """Rewrite content to be optimized for a different platform"""
        if not self.enabled:
            return {'error': 'AI content rewriting not enabled', 'enabled': False}
        
        try:
            platform_styles = {
                'twitter': 'concise and witty',
                'instagram': 'visual and emoji-rich',
                'facebook': 'conversational and detailed',
                'linkedin': 'professional and informative',
                'threads': 'casual and engaging',
                'bluesky': 'thoughtful and concise',
                'youtube': 'descriptive with timestamps',
                'pinterest': 'inspirational and actionable',
                'tiktok': 'fun and trendy'
            }
            
            style = platform_styles.get(target_platform, 'engaging')
            
            prompt = f"""Rewrite this {source_platform} post for {target_platform}:

Original: "{content}"

Make it {style} and optimized for {target_platform}'s audience.
Keep the core message but adapt the style and format.

Return only the rewritten content, no explanations."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a social media content adapter."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            rewritten = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'original': content,
                'rewritten': rewritten,
                'source_platform': source_platform,
                'target_platform': target_platform,
                'character_count': len(rewritten)
            }
        except Exception as e:
            logger.error(f"AI content rewriting error: {str(e)}")
            return {'error': str(e), 'success': False}


class IntelligentScheduler:
    """AI-powered scheduling optimization"""
    
    def __init__(self):
        self.enabled = AI_ENABLED
        self.model = LinearRegression() if self.enabled else None
        self.scaler = StandardScaler() if self.enabled else None
        self.trained = False
    
    def analyze_best_times(self, platform: str, historical_data: List[Dict] = None) -> Dict[str, Any]:
        """Analyze best times to post based on historical data"""
        if not self.enabled:
            return {'error': 'AI scheduling not enabled', 'enabled': False}
        
        # Use default best times based on research if no historical data
        default_times = {
            'twitter': ['09:00', '12:00', '17:00', '18:00'],
            'instagram': ['11:00', '13:00', '19:00', '21:00'],
            'facebook': ['13:00', '15:00', '19:00', '21:00'],
            'linkedin': ['08:00', '12:00', '17:00', '18:00'],
            'threads': ['12:00', '17:00', '20:00'],
            'bluesky': ['09:00', '12:00', '18:00'],
            'youtube': ['14:00', '17:00', '20:00'],
            'pinterest': ['20:00', '21:00', '23:00'],
            'tiktok': ['06:00', '10:00', '19:00', '22:00']
        }
        
        best_times = default_times.get(platform, ['09:00', '12:00', '17:00'])
        
        # If historical data is provided, analyze it
        if historical_data and len(historical_data) > 10:
            try:
                df = pd.DataFrame(historical_data)
                if 'posted_at' in df.columns and 'engagement' in df.columns:
                    df['hour'] = pd.to_datetime(df['posted_at']).dt.hour
                    hourly_engagement = df.groupby('hour')['engagement'].mean().sort_values(ascending=False)
                    top_hours = hourly_engagement.head(4).index.tolist()
                    best_times = [f"{hour:02d}:00" for hour in top_hours]
            except Exception as e:
                logger.error(f"Historical analysis error: {str(e)}")
        
        return {
            'success': True,
            'platform': platform,
            'best_times': best_times,
            'timezone': 'UTC',
            'recommendation': f'Post between {best_times[0]} and {best_times[-1]} UTC for best engagement',
            'based_on': 'historical_data' if historical_data else 'industry_research'
        }
    
    def predict_engagement(self, content: str, platform: str, scheduled_time: str) -> Dict[str, Any]:
        """Predict expected engagement for a post"""
        if not self.enabled:
            return {'error': 'AI prediction not enabled', 'enabled': False}
        
        # Simple heuristic-based prediction
        score = 50  # Base score
        
        # Content length analysis
        content_length = len(content)
        if platform == 'twitter' and 100 <= content_length <= 200:
            score += 15
        elif platform == 'instagram' and content_length >= 500:
            score += 10
        elif platform == 'linkedin' and 300 <= content_length <= 1000:
            score += 15
        
        # Time-based scoring
        try:
            hour = int(scheduled_time.split(':')[0]) if ':' in scheduled_time else int(scheduled_time.split('T')[1][:2])
            if 8 <= hour <= 20:
                score += 10
            if 12 <= hour <= 14 or 17 <= hour <= 19:
                score += 15
        except:
            pass
        
        # Hashtag analysis
        hashtag_count = len(re.findall(r'#\w+', content))
        if 1 <= hashtag_count <= 5:
            score += 10
        elif hashtag_count > 10:
            score -= 10
        
        # Emoji analysis
        emoji_count = len(re.findall(r'[\U0001F300-\U0001F9FF]', content))
        if 1 <= emoji_count <= 3:
            score += 5
        
        # Cap score at 100
        score = min(score, 100)
        
        # Estimate metrics
        estimated_likes = int(score * 2.5)
        estimated_shares = int(score * 0.5)
        estimated_comments = int(score * 0.3)
        
        return {
            'success': True,
            'engagement_score': score,
            'confidence': 'medium',
            'estimated_metrics': {
                'likes': estimated_likes,
                'shares': estimated_shares,
                'comments': estimated_comments,
                'total_engagement': estimated_likes + estimated_shares + estimated_comments
            },
            'factors': {
                'content_length': 'optimal' if score >= 70 else 'suboptimal',
                'posting_time': 'good' if 8 <= (hour if 'hour' in locals() else 12) <= 20 else 'fair',
                'hashtag_usage': 'optimal' if 1 <= hashtag_count <= 5 else 'needs_improvement'
            },
            'platform': platform
        }
    
    def suggest_frequency(self, platform: str, content_type: str = 'standard') -> Dict[str, Any]:
        """Suggest posting frequency for a platform"""
        if not self.enabled:
            return {'error': 'AI scheduling not enabled', 'enabled': False}
        
        # Research-based recommendations
        frequencies = {
            'twitter': {'posts_per_day': '3-5', 'posts_per_week': '15-35'},
            'instagram': {'posts_per_day': '1-2', 'posts_per_week': '7-14'},
            'facebook': {'posts_per_day': '1-2', 'posts_per_week': '5-10'},
            'linkedin': {'posts_per_day': '1', 'posts_per_week': '5-7'},
            'threads': {'posts_per_day': '2-4', 'posts_per_week': '10-25'},
            'bluesky': {'posts_per_day': '2-3', 'posts_per_week': '10-20'},
            'youtube': {'posts_per_week': '3-4', 'posts_per_month': '12-16'},
            'pinterest': {'posts_per_day': '5-10', 'posts_per_week': '30-50'},
            'tiktok': {'posts_per_day': '1-3', 'posts_per_week': '7-20'}
        }
        
        freq = frequencies.get(platform, {'posts_per_day': '1-2', 'posts_per_week': '7-10'})
        
        return {
            'success': True,
            'platform': platform,
            'recommendations': freq,
            'best_practice': f'Maintain consistent posting schedule for {platform}',
            'avoid_spam': 'Don\'t post more than recommended to avoid audience fatigue'
        }


class ImageEnhancer:
    """AI-powered image enhancement and optimization"""
    
    def __init__(self):
        self.enabled = AI_ENABLED
    
    def optimize_for_platform(self, image_data: str, platform: str) -> Dict[str, Any]:
        """Optimize image dimensions and quality for specific platform"""
        if not self.enabled:
            return {'error': 'Image enhancement not enabled', 'enabled': False}
        
        # Platform-specific optimal dimensions
        dimensions = {
            'twitter': {'width': 1200, 'height': 675, 'aspect': '16:9'},
            'instagram': {'width': 1080, 'height': 1080, 'aspect': '1:1'},
            'facebook': {'width': 1200, 'height': 630, 'aspect': '1.91:1'},
            'linkedin': {'width': 1200, 'height': 627, 'aspect': '1.91:1'},
            'threads': {'width': 1080, 'height': 1080, 'aspect': '1:1'},
            'bluesky': {'width': 1200, 'height': 675, 'aspect': '16:9'},
            'youtube': {'width': 1280, 'height': 720, 'aspect': '16:9'},
            'pinterest': {'width': 1000, 'height': 1500, 'aspect': '2:3'},
            'tiktok': {'width': 1080, 'height': 1920, 'aspect': '9:16'}
        }
        
        specs = dimensions.get(platform, {'width': 1200, 'height': 675, 'aspect': '16:9'})
        
        try:
            # Decode base64 image if needed
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            img = Image.open(io.BytesIO(image_bytes))
            
            # Get original dimensions
            orig_width, orig_height = img.size
            
            # Calculate new dimensions
            target_width = specs['width']
            target_height = specs['height']
            
            # Resize maintaining aspect ratio, then crop
            img.thumbnail((target_width, target_height), Image.Resampling.LANCZOS)
            
            # Convert to RGB if needed
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Save optimized image
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=85, optimize=True)
            optimized_data = base64.b64encode(output.getvalue()).decode()
            
            return {
                'success': True,
                'platform': platform,
                'optimized_image': f'data:image/jpeg;base64,{optimized_data}',
                'original_dimensions': {'width': orig_width, 'height': orig_height},
                'new_dimensions': {'width': img.size[0], 'height': img.size[1]},
                'recommended_aspect': specs['aspect'],
                'file_size_reduced': True
            }
        except Exception as e:
            logger.error(f"Image optimization error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def get_platform_dimensions(self, platform: str) -> Dict[str, int]:
        """Get optimal dimensions for a specific platform"""
        dimensions = {
            'twitter': {'width': 1200, 'height': 675},
            'instagram': {'width': 1080, 'height': 1080},
            'facebook': {'width': 1200, 'height': 630},
            'linkedin': {'width': 1200, 'height': 627},
            'threads': {'width': 1080, 'height': 1080},
            'bluesky': {'width': 1200, 'height': 675},
            'youtube': {'width': 1280, 'height': 720},
            'pinterest': {'width': 1000, 'height': 1500},
            'tiktok': {'width': 1080, 'height': 1920}
        }
        return dimensions.get(platform, {'width': 1200, 'height': 675})
    
    def enhance_quality(self, image_data: str, enhancement_level: str = 'medium') -> Dict[str, Any]:
        """Enhance image quality (brightness, contrast, sharpness)"""
        if not self.enabled:
            return {'error': 'Image enhancement not enabled', 'enabled': False}
        
        try:
            # Decode base64 image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            img = Image.open(io.BytesIO(image_bytes))
            
            # Enhancement factors based on level
            factors = {
                'low': {'brightness': 1.1, 'contrast': 1.1, 'sharpness': 1.1},
                'medium': {'brightness': 1.2, 'contrast': 1.3, 'sharpness': 1.2},
                'high': {'brightness': 1.3, 'contrast': 1.5, 'sharpness': 1.3}
            }
            
            factor = factors.get(enhancement_level, factors['medium'])
            
            # Apply enhancements
            enhancer = ImageEnhance.Brightness(img)
            img = enhancer.enhance(factor['brightness'])
            
            enhancer = ImageEnhance.Contrast(img)
            img = enhancer.enhance(factor['contrast'])
            
            enhancer = ImageEnhance.Sharpness(img)
            img = enhancer.enhance(factor['sharpness'])
            
            # Save enhanced image
            output = io.BytesIO()
            img.save(output, format='JPEG', quality=90)
            enhanced_data = base64.b64encode(output.getvalue()).decode()
            
            return {
                'success': True,
                'enhanced_image': f'data:image/jpeg;base64,{enhanced_data}',
                'enhancement_level': enhancement_level,
                'applied_enhancements': {
                    'brightness': f'+{int((factor["brightness"] - 1) * 100)}%',
                    'contrast': f'+{int((factor["contrast"] - 1) * 100)}%',
                    'sharpness': f'+{int((factor["sharpness"] - 1) * 100)}%'
                }
            }
        except Exception as e:
            logger.error(f"Image enhancement error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_alt_text(self, image_data: str) -> Dict[str, Any]:
        """Generate alt text for accessibility (placeholder - would use vision API)"""
        if not self.enabled:
            return {'error': 'Alt text generation not enabled', 'enabled': False}
        
        # Placeholder implementation
        # In production, would use GPT-4V or similar vision API
        return {
            'success': True,
            'alt_text': 'Image description (Vision API integration required for automatic generation)',
            'note': 'Integrate OpenAI Vision API or similar for automatic alt text generation',
            'manual_recommended': True
        }


class AIImageGenerator:
    """AI-powered image generation for posts, video thumbnails, and video content"""
    
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY', '')
        self.enabled = AI_ENABLED and bool(self.api_key)
        if self.enabled:
            openai.api_key = self.api_key
        
        # Image generation presets
        self.IMAGE_STYLES = {
            'photorealistic': 'Photorealistic, high quality, professional photography',
            'illustration': 'Digital illustration, vibrant colors, artistic style',
            'minimalist': 'Minimalist design, clean lines, simple composition',
            'abstract': 'Abstract art, creative, modern design',
            'cinematic': 'Cinematic style, dramatic lighting, movie poster aesthetic',
            'vintage': 'Vintage style, retro aesthetic, nostalgic feel',
            'modern': 'Modern design, contemporary aesthetic, sleek and professional',
            'cartoon': 'Cartoon style, playful, colorful and fun',
            'corporate': 'Professional corporate style, business appropriate, clean design'
        }
        
        # Thumbnail templates for different video types
        self.THUMBNAIL_TEMPLATES = {
            'product_showcase': 'Eye-catching product photo with dramatic lighting',
            'tutorial': 'Clear step-by-step visual with numbered elements',
            'testimonial': 'Friendly portrait with quote overlay space',
            'announcement': 'Bold text-ready background with exciting colors',
            'behind_the_scenes': 'Candid workplace or process scene',
            'story': 'Cinematic scene with narrative visual elements'
        }
    
    def generate_image(self, prompt: str, style: str = 'photorealistic', 
                      size: str = '1024x1024', platform: str = None) -> Dict[str, Any]:
        """Generate an AI image using DALL-E"""
        if not self.enabled:
            return {'error': 'AI image generation not enabled', 'enabled': False}
        
        try:
            # Add style to prompt
            style_desc = self.IMAGE_STYLES.get(style, self.IMAGE_STYLES['photorealistic'])
            enhanced_prompt = f"{prompt}. Style: {style_desc}"
            
            # Platform-specific size adjustments
            if platform:
                if platform in ['instagram', 'facebook', 'threads']:
                    size = '1024x1024'  # Square
                elif platform in ['twitter', 'linkedin']:
                    size = '1792x1024'  # Landscape
                elif platform in ['tiktok', 'pinterest']:
                    size = '1024x1792'  # Portrait
            
            # Generate image with DALL-E
            response = openai.images.generate(
                model="dall-e-3",
                prompt=enhanced_prompt,
                size=size,
                quality="standard",
                n=1
            )
            
            image_url = response.data[0].url
            revised_prompt = response.data[0].revised_prompt
            
            # Download image and convert to base64
            import requests
            img_response = requests.get(image_url, timeout=30)
            img_data = base64.b64encode(img_response.content).decode()
            
            return {
                'success': True,
                'image_url': image_url,
                'image_data': f'data:image/png;base64,{img_data}',
                'size': size,
                'style': style,
                'platform': platform,
                'original_prompt': prompt,
                'revised_prompt': revised_prompt
            }
        except Exception as e:
            logger.error(f"Image generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_video_thumbnail(self, video_topic: str, video_type: str = 'product_showcase',
                                 platform: str = 'youtube', style: str = 'cinematic') -> Dict[str, Any]:
        """Generate a thumbnail image for video content"""
        if not self.enabled:
            return {'error': 'AI thumbnail generation not enabled', 'enabled': False}
        
        # Get template description
        template_desc = self.THUMBNAIL_TEMPLATES.get(video_type, 'Engaging video thumbnail')
        
        # Build thumbnail prompt
        prompt = f"Create a compelling video thumbnail for: {video_topic}. {template_desc}. Include bold text overlay space. High contrast, eye-catching, professional quality."
        
        # Determine size based on platform
        size_map = {
            'youtube': '1792x1024',  # 16:9
            'instagram': '1024x1024',  # 1:1
            'tiktok': '1024x1792',  # 9:16
            'facebook': '1792x1024',  # 16:9
            'twitter': '1792x1024'  # 16:9
        }
        size = size_map.get(platform, '1792x1024')
        
        result = self.generate_image(prompt, style, size, platform)
        
        if result.get('success'):
            result['thumbnail_type'] = video_type
            result['optimized_for'] = f'{platform} video thumbnail'
        
        return result
    
    def generate_images_for_video(self, video_script: str, num_images: int = 4,
                                  style: str = 'cinematic', platform: str = 'instagram') -> Dict[str, Any]:
        """Generate multiple images for video creation based on script"""
        if not self.enabled:
            return {'error': 'AI image generation not enabled', 'enabled': False}
        
        try:
            # Parse scenes from script or split into segments
            scenes = []
            script_lines = video_script.split('\n')
            
            for line in script_lines:
                if line.strip() and any(word in line.lower() for word in ['scene', 'shot', 'visual', ':']):
                    scenes.append(line.strip())
            
            # If no clear scenes, split script into segments
            if not scenes:
                words = video_script.split()
                chunk_size = max(len(words) // num_images, 10)
                for i in range(0, len(words), chunk_size):
                    chunk = ' '.join(words[i:i+chunk_size])
                    if chunk:
                        scenes.append(chunk)
            
            # Limit to requested number
            scenes = scenes[:num_images]
            
            # Generate image for each scene
            generated_images = []
            for i, scene in enumerate(scenes, 1):
                # Extract visual description
                visual_prompt = scene
                if ':' in scene:
                    visual_prompt = scene.split(':', 1)[1].strip()
                
                prompt = f"Scene {i}: {visual_prompt}. Consistent style, high quality."
                
                result = self.generate_image(
                    prompt,
                    style=style,
                    size='1024x1024' if platform == 'instagram' else '1024x1792',
                    platform=platform
                )
                
                if result.get('success'):
                    generated_images.append({
                        'scene_number': i,
                        'scene_description': scene,
                        'image_url': result['image_url'],
                        'image_data': result['image_data'],
                        'prompt': result['original_prompt']
                    })
                else:
                    logger.warning(f"Failed to generate image for scene {i}: {result.get('error')}")
            
            return {
                'success': True,
                'images': generated_images,
                'count': len(generated_images),
                'style': style,
                'platform': platform,
                'video_ready': True
            }
        except Exception as e:
            logger.error(f"Video image generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_post_image(self, post_content: str, platform: str = 'instagram',
                           style: str = 'modern', include_text_space: bool = True) -> Dict[str, Any]:
        """Generate an image optimized for social media post"""
        if not self.enabled:
            return {'error': 'AI image generation not enabled', 'enabled': False}
        
        # Build prompt based on post content
        text_space_note = "with space for text overlay" if include_text_space else ""
        prompt = f"Create a social media image for this post: '{post_content}'. Platform: {platform}. Professional, engaging, {text_space_note}"
        
        result = self.generate_image(prompt, style, platform=platform)
        
        if result.get('success'):
            result['post_optimized'] = True
            result['text_overlay_ready'] = include_text_space
        
        return result
    
    def create_image_variations(self, image_data: str, num_variations: int = 3) -> Dict[str, Any]:
        """Create variations of an existing image"""
        if not self.enabled:
            return {'error': 'AI image generation not enabled', 'enabled': False}
        
        try:
            # Decode base64 image
            if image_data.startswith('data:image'):
                image_data = image_data.split(',')[1]
            
            image_bytes = base64.b64decode(image_data)
            
            # Save to temporary file
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp_file:
                tmp_file.write(image_bytes)
                tmp_path = tmp_file.name
            
            try:
                # Create variations using DALL-E
                with open(tmp_path, 'rb') as image_file:
                    response = openai.images.create_variation(
                        image=image_file,
                        n=min(num_variations, 3),  # DALL-E limit
                        size="1024x1024"
                    )
                
                variations = []
                for img in response.data:
                    # Download variation
                    import requests
                    img_response = requests.get(img.url, timeout=30)
                    var_data = base64.b64encode(img_response.content).decode()
                    
                    variations.append({
                        'image_url': img.url,
                        'image_data': f'data:image/png;base64,{var_data}'
                    })
                
                return {
                    'success': True,
                    'variations': variations,
                    'count': len(variations)
                }
            finally:
                # Clean up temp file
                os.unlink(tmp_path)
        
        except Exception as e:
            logger.error(f"Image variation error: {str(e)}")
            return {'error': str(e), 'success': False}


class EngagementPredictor:
    """Predictive analytics for engagement forecasting"""
    
    def __init__(self):
        self.enabled = AI_ENABLED
        self.model = LinearRegression() if self.enabled else None
        self.trained = False
    
    def train_model(self, historical_posts: List[Dict]) -> Dict[str, Any]:
        """Train engagement prediction model on historical data"""
        if not self.enabled:
            return {'error': 'Predictive analytics not enabled', 'enabled': False}
        
        if len(historical_posts) < 20:
            return {'error': 'Need at least 20 historical posts to train model', 'success': False}
        
        try:
            # Extract features
            df = pd.DataFrame(historical_posts)
            
            # Feature engineering
            features = []
            targets = []
            
            for _, post in df.iterrows():
                feature_vec = [
                    len(post.get('content', '')),
                    len(re.findall(r'#\w+', post.get('content', ''))),
                    len(re.findall(r'[\U0001F300-\U0001F9FF]', post.get('content', ''))),
                    len(post.get('media', [])),
                    pd.to_datetime(post.get('posted_at')).hour if post.get('posted_at') else 12
                ]
                features.append(feature_vec)
                targets.append(post.get('engagement', 0))
            
            X = np.array(features)
            y = np.array(targets)
            
            # Train model
            self.model.fit(X, y)
            self.trained = True
            
            # Calculate accuracy
            predictions = self.model.predict(X)
            mae = np.mean(np.abs(predictions - y))
            
            return {
                'success': True,
                'trained': True,
                'training_samples': len(historical_posts),
                'mean_absolute_error': float(mae),
                'model_ready': True
            }
        except Exception as e:
            logger.error(f"Model training error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def predict_performance(self, content: str, media: List, scheduled_time: str, platform: str) -> Dict[str, Any]:
        """Predict post performance before publishing"""
        if not self.enabled:
            return {'error': 'Predictive analytics not enabled', 'enabled': False}
        
        # Use heuristic-based prediction
        base_score = 50
        
        # Content analysis
        content_length = len(content)
        hashtags = len(re.findall(r'#\w+', content))
        emojis = len(re.findall(r'[\U0001F300-\U0001F9FF]', content))
        media_count = len(media) if media else 0
        
        # Scoring
        if 50 <= content_length <= 300:
            base_score += 15
        if 1 <= hashtags <= 5:
            base_score += 10
        if 1 <= emojis <= 3:
            base_score += 5
        if media_count > 0:
            base_score += 15
        
        # Time scoring
        try:
            if 'T' in scheduled_time:
                hour = int(scheduled_time.split('T')[1][:2])
            else:
                hour = int(scheduled_time.split(':')[0])
            
            if 8 <= hour <= 20:
                base_score += 10
        except:
            hour = 12
        
        score = min(base_score, 100)
        
        # Generate predictions
        predicted_engagement = {
            'score': score,
            'likes': int(score * 3),
            'comments': int(score * 0.4),
            'shares': int(score * 0.6),
            'reach': int(score * 10)
        }
        
        # Recommendations
        recommendations = []
        if content_length > 500:
            recommendations.append("Consider shortening content for better engagement")
        if hashtags == 0:
            recommendations.append("Add 2-3 relevant hashtags")
        if media_count == 0:
            recommendations.append("Add an image or video to boost engagement")
        if not (8 <= hour <= 20):
            recommendations.append("Consider posting during peak hours (8 AM - 8 PM)")
        
        return {
            'success': True,
            'engagement_score': score,
            'predicted_metrics': predicted_engagement,
            'confidence_level': 'medium',
            'recommendations': recommendations if recommendations else ['Post looks good!'],
            'platform': platform,
            'optimal': score >= 75
        }
    
    def compare_variations(self, variations: List[Dict]) -> Dict[str, Any]:
        """Compare predicted performance of different post variations"""
        if not self.enabled:
            return {'error': 'Predictive analytics not enabled', 'enabled': False}
        
        results = []
        for i, var in enumerate(variations):
            prediction = self.predict_performance(
                var.get('content', ''),
                var.get('media', []),
                var.get('scheduled_time', '12:00'),
                var.get('platform', 'twitter')
            )
            prediction['variation_id'] = i
            prediction['variation_name'] = var.get('name', f'Variation {i+1}')
            results.append(prediction)
        
        # Sort by score
        results.sort(key=lambda x: x.get('engagement_score', 0), reverse=True)
        
        return {
            'success': True,
            'variations_analyzed': len(variations),
            'results': results,
            'best_variation': results[0] if results else None,
            'recommendation': f"Use {results[0].get('variation_name', 'first variation')} for best results" if results else None
        }


class ViralContentIntelligence:
    """Viral content intelligence engine for trending topics and content analysis"""
    
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY', '')
        self.enabled = AI_ENABLED and bool(self.api_key)
        if self.enabled:
            openai.api_key = self.api_key
        
        # Viral hooks library
        self.VIRAL_HOOKS = {
            'curiosity': [
                "You won't believe what happened when...",
                "The secret nobody tells you about...",
                "What they don't want you to know about...",
                "I discovered something shocking about...",
                "This changes everything about..."
            ],
            'urgency': [
                "Stop doing this immediately if you...",
                "You have 24 hours to...",
                "Last chance to...",
                "Don't miss out on...",
                "Time is running out for..."
            ],
            'controversy': [
                "Unpopular opinion:",
                "Hot take:",
                "Let's talk about the elephant in the room:",
                "Nobody wants to admit this, but...",
                "I'm going to say what everyone's thinking:"
            ],
            'storytelling': [
                "Here's what happened when I...",
                "Let me tell you a story about...",
                "It all started when...",
                "I'll never forget the day...",
                "This is how I went from X to Y:"
            ],
            'value': [
                "Here's exactly how to...",
                "The complete guide to...",
                "5 steps to...",
                "Everything you need to know about...",
                "Master this in 10 minutes:"
            ]
        }
        
        # Platform-specific viral patterns
        self.VIRAL_PATTERNS = {
            'twitter': {
                'thread_starter': 'A thread 🧵',
                'optimal_length': '100-280 characters',
                'best_time': 'Morning (8-10 AM)',
                'engagement_triggers': ['questions', 'threads', 'controversial takes']
            },
            'instagram': {
                'caption_style': 'Story-driven with line breaks',
                'optimal_hashtags': '10-15',
                'best_time': 'Lunch (11 AM-1 PM) or Evening (7-9 PM)',
                'engagement_triggers': ['carousels', 'reels', 'behind-the-scenes']
            },
            'tiktok': {
                'hook_duration': 'First 3 seconds',
                'optimal_length': '15-30 seconds',
                'best_time': 'Evening (6-10 PM)',
                'engagement_triggers': ['trending sounds', 'duets', 'challenges']
            },
            'linkedin': {
                'post_style': 'Professional storytelling',
                'optimal_length': '1,300-1,500 characters',
                'best_time': 'Business hours (9 AM-5 PM)',
                'engagement_triggers': ['personal stories', 'industry insights', 'data-driven']
            }
        }
    
    def get_viral_hooks(self, category: str = None, count: int = 5) -> Dict[str, Any]:
        """Get viral hooks from library"""
        if category and category not in self.VIRAL_HOOKS:
            return {
                'error': f'Category {category} not found',
                'success': False,
                'available_categories': list(self.VIRAL_HOOKS.keys())
            }
        
        if category:
            hooks = self.VIRAL_HOOKS[category][:count]
            return {
                'success': True,
                'category': category,
                'hooks': hooks,
                'count': len(hooks)
            }
        
        # Return all categories
        all_hooks = {}
        for cat, hooks_list in self.VIRAL_HOOKS.items():
            all_hooks[cat] = hooks_list[:count]
        
        return {
            'success': True,
            'hooks_by_category': all_hooks,
            'total_categories': len(all_hooks)
        }
    
    def predict_virality_score(self, content: str, platform: str) -> Dict[str, Any]:
        """Predict viral potential of content (0-100 score)"""
        score = 50  # Base score
        factors = []
        
        # Length analysis
        content_length = len(content)
        optimal_ranges = {
            'twitter': (100, 280),
            'instagram': (500, 2200),
            'tiktok': (50, 300),
            'linkedin': (1300, 1500),
            'facebook': (100, 250)
        }
        
        optimal = optimal_ranges.get(platform, (100, 500))
        if optimal[0] <= content_length <= optimal[1]:
            score += 15
            factors.append("Optimal length")
        elif content_length < optimal[0]:
            score -= 10
            factors.append("Too short")
        else:
            score -= 5
            factors.append("Too long")
        
        # Hook analysis
        first_line = content.split('\n')[0] if '\n' in content else content[:100]
        for category, hooks in self.VIRAL_HOOKS.items():
            if any(hook.lower()[:20] in first_line.lower() for hook in hooks):
                score += 20
                factors.append(f"Strong {category} hook")
                break
        
        # Emoji analysis
        emoji_count = len(re.findall(r'[\U0001F300-\U0001F9FF]', content))
        if 2 <= emoji_count <= 5:
            score += 10
            factors.append("Good emoji usage")
        elif emoji_count > 10:
            score -= 5
            factors.append("Too many emojis")
        
        # Question marks (engagement trigger)
        if '?' in content:
            score += 10
            factors.append("Includes question (engagement)")
        
        # Hashtags
        hashtag_count = len(re.findall(r'#[a-zA-Z0-9_]+', content))
        if platform == 'instagram' and 10 <= hashtag_count <= 15:
            score += 10
            factors.append("Optimal hashtags")
        elif platform in ['twitter', 'linkedin'] and 1 <= hashtag_count <= 3:
            score += 10
            factors.append("Good hashtag usage")
        
        # Cap score
        score = max(0, min(100, score))
        
        # Determine rating
        if score >= 80:
            rating = "Highly Viral Potential"
        elif score >= 60:
            rating = "Good Viral Potential"
        elif score >= 40:
            rating = "Moderate Potential"
        else:
            rating = "Low Viral Potential"
        
        return {
            'success': True,
            'virality_score': score,
            'rating': rating,
            'platform': platform,
            'factors': factors,
            'recommendations': self._get_viral_recommendations(score, platform, content)
        }
    
    def _get_viral_recommendations(self, score: int, platform: str, content: str) -> List[str]:
        """Get recommendations to improve virality"""
        recommendations = []
        
        if score < 60:
            recommendations.append("Add a stronger hook in the first line")
        
        if '?' not in content:
            recommendations.append("Include a question to boost engagement")
        
        emoji_count = len(re.findall(r'[\U0001F300-\U0001F9FF]', content))
        if emoji_count == 0:
            recommendations.append("Add 2-3 relevant emojis")
        
        if platform == 'instagram' and len(re.findall(r'#[a-zA-Z0-9_]+', content)) < 10:
            recommendations.append("Add more hashtags (10-15 optimal for Instagram)")
        
        if len(content) < 100:
            recommendations.append("Expand your content for better context")
        
        return recommendations if recommendations else ["Content looks great!"]
    
    def get_platform_best_practices(self, platform: str) -> Dict[str, Any]:
        """Get viral best practices for a platform"""
        if platform not in self.VIRAL_PATTERNS:
            return {
                'error': f'Platform {platform} not found',
                'success': False,
                'available_platforms': list(self.VIRAL_PATTERNS.keys())
            }
        
        return {
            'success': True,
            'platform': platform,
            'best_practices': self.VIRAL_PATTERNS[platform]
        }


class ContentMultiplier:
    """Transform one piece of content into multiple platform-specific formats"""
    
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY', '')
        self.enabled = AI_ENABLED and bool(self.api_key)
        if self.enabled:
            openai.api_key = self.api_key
    
    def multiply_content(self, source_content: str, source_type: str, target_platforms: List[str], 
                        brand_voice: str = 'professional') -> Dict[str, Any]:
        """Convert one piece of content into multiple platform-specific posts"""
        if not self.enabled:
            return {'error': 'Content multiplier not enabled', 'enabled': False}
        
        try:
            outputs = {}
            
            for platform in target_platforms:
                # Generate platform-specific content
                prompt = f"""Transform this {source_type} into an engaging {platform} post:

Source content: "{source_content}"

Requirements:
- Platform: {platform}
- Brand voice: {brand_voice}
- Optimize for {platform}'s audience and format
- Maintain key messages
- Include relevant emojis and hashtags for {platform}
- Make it native to the platform

Return only the {platform} post, no explanations."""

                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": f"You are a social media expert specializing in {platform} content."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=500,
                    temperature=0.7
                )
                
                platform_content = response.choices[0].message.content.strip()
                
                outputs[platform] = {
                    'content': platform_content,
                    'character_count': len(platform_content),
                    'hashtags': re.findall(r'#[a-zA-Z0-9_]+', platform_content),
                    'platform': platform
                }
            
            return {
                'success': True,
                'source_type': source_type,
                'outputs': outputs,
                'platforms_generated': len(outputs),
                'brand_voice': brand_voice
            }
        
        except Exception as e:
            logger.error(f"Content multiplication error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_content_variations(self, content: str, num_variations: int = 3, 
                                   platform: str = 'twitter') -> Dict[str, Any]:
        """Generate multiple variations of the same content for A/B testing"""
        if not self.enabled:
            return {'error': 'Content multiplier not enabled', 'enabled': False}
        
        try:
            variations = []
            
            for i in range(num_variations):
                prompt = f"""Create variation #{i+1} of this {platform} post with a different angle:

Original: "{content}"

Requirements:
- Keep the core message
- Use a different hook or approach
- Maintain platform style
- Make it equally engaging
- Add relevant emojis

Return only the variation, no explanations."""

                response = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "You are a social media copywriter."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=300,
                    temperature=0.8
                )
                
                variation = response.choices[0].message.content.strip()
                
                variations.append({
                    'variation_number': i + 1,
                    'content': variation,
                    'character_count': len(variation),
                    'hashtags': re.findall(r'#[a-zA-Z0-9_]+', variation)
                })
            
            return {
                'success': True,
                'original': content,
                'variations': variations,
                'count': len(variations),
                'platform': platform
            }
        
        except Exception as e:
            logger.error(f"Variation generation error: {str(e)}")
            return {'error': str(e), 'success': False}


class AIVideoGenerator:
    """AI-powered video generation and editing service"""
    
    # Video encoding constants
    HIGH_RESOLUTION_THRESHOLD = 1920
    HIGH_BITRATE = '5000k'
    STANDARD_BITRATE = '3000k'
    AUDIO_CODEC = 'aac'
    AUDIO_BITRATE = '192k'
    
    # Video template library
    VIDEO_TEMPLATES = {
        'product_showcase': {
            'name': 'Product Showcase',
            'description': 'Professional product demonstration',
            'scenes': 4,
            'duration': 30,
            'style': 'professional',
            'transitions': ['fade', 'slide'],
            'script_template': 'Scene 1: Product intro\nScene 2: Key features\nScene 3: Benefits\nScene 4: Call to action'
        },
        'behind_the_scenes': {
            'name': 'Behind the Scenes',
            'description': 'Show your process and team',
            'scenes': 3,
            'duration': 20,
            'style': 'casual',
            'transitions': ['fade', 'crossfade'],
            'script_template': 'Scene 1: Setting the stage\nScene 2: The process\nScene 3: Final result'
        },
        'tutorial': {
            'name': 'Tutorial',
            'description': 'Step-by-step instructional video',
            'scenes': 5,
            'duration': 45,
            'style': 'educational',
            'transitions': ['slide', 'wipe'],
            'script_template': 'Scene 1: Introduction\nScene 2: Step 1\nScene 3: Step 2\nScene 4: Step 3\nScene 5: Summary'
        },
        'testimonial': {
            'name': 'Testimonial',
            'description': 'Customer success story',
            'scenes': 3,
            'duration': 25,
            'style': 'emotional',
            'transitions': ['fade', 'dissolve'],
            'script_template': 'Scene 1: The problem\nScene 2: The solution\nScene 3: The results'
        },
        'announcement': {
            'name': 'Announcement',
            'description': 'Quick exciting news or update',
            'scenes': 2,
            'duration': 15,
            'style': 'energetic',
            'transitions': ['zoom', 'fade'],
            'script_template': 'Scene 1: The big reveal\nScene 2: What it means'
        },
        'story': {
            'name': 'Story',
            'description': 'Narrative-driven content',
            'scenes': 4,
            'duration': 40,
            'style': 'cinematic',
            'transitions': ['fade', 'crossfade', 'slide'],
            'script_template': 'Scene 1: Setup\nScene 2: Conflict\nScene 3: Resolution\nScene 4: Conclusion'
        }
    }
    
    def __init__(self):
        self.api_key = os.getenv('OPENAI_API_KEY', '')
        self.enabled = AI_ENABLED and bool(self.api_key)
        if self.enabled:
            openai.api_key = self.api_key
        
        # Platform-specific video requirements
        self.platform_specs = {
            'instagram': {
                'reel': {'aspect_ratio': '9:16', 'min_duration': 3, 'max_duration': 90, 'width': 1080, 'height': 1920},
                'story': {'aspect_ratio': '9:16', 'min_duration': 1, 'max_duration': 60, 'width': 1080, 'height': 1920},
                'feed': {'aspect_ratio': '1:1', 'min_duration': 3, 'max_duration': 60, 'width': 1080, 'height': 1080}
            },
            'youtube': {
                'short': {'aspect_ratio': '9:16', 'min_duration': 1, 'max_duration': 60, 'width': 1080, 'height': 1920},
                'video': {'aspect_ratio': '16:9', 'min_duration': 1, 'max_duration': 43200, 'width': 1920, 'height': 1080}
            },
            'tiktok': {
                'video': {'aspect_ratio': '9:16', 'min_duration': 3, 'max_duration': 600, 'width': 1080, 'height': 1920}
            },
            'facebook': {
                'reel': {'aspect_ratio': '9:16', 'min_duration': 3, 'max_duration': 90, 'width': 1080, 'height': 1920},
                'feed': {'aspect_ratio': '16:9', 'min_duration': 1, 'max_duration': 240, 'width': 1280, 'height': 720}
            },
            'pinterest': {
                'video_pin': {'aspect_ratio': '2:3', 'min_duration': 4, 'max_duration': 900, 'width': 1000, 'height': 1500}
            },
            'twitter': {
                'video': {'aspect_ratio': '16:9', 'min_duration': 0.5, 'max_duration': 140, 'width': 1280, 'height': 720}
            }
        }
    
    def generate_video_script(self, topic: str, platform: str, duration: int, style: str = 'engaging') -> Dict[str, Any]:
        """Generate a video script optimized for the platform and duration"""
        if not self.enabled:
            return {'error': 'AI video script generation not enabled', 'enabled': False}
        
        try:
            prompt = f"""Create a compelling {duration}-second video script for {platform} about: {topic}

Style: {style}
Platform: {platform}
Duration: {duration} seconds

Requirements:
- Break down into scenes with timing
- Include visual descriptions
- Add text overlay suggestions
- Include hook in first 3 seconds
- Call-to-action at the end
- Platform-optimized pacing

Format the response as:
Scene 1 (0-X seconds): [Visual description] | Text: [text overlay]
Scene 2 (X-Y seconds): [Visual description] | Text: [text overlay]
..."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a professional video script writer specializing in social media content."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.7
            )
            
            script = response.choices[0].message.content.strip()
            
            # Parse scenes
            scenes = []
            for line in script.split('\n'):
                if line.strip() and ('Scene' in line or 'scene' in line):
                    scenes.append(line.strip())
            
            return {
                'success': True,
                'script': script,
                'scenes': scenes,
                'platform': platform,
                'duration': duration,
                'style': style,
                'scene_count': len(scenes)
            }
        except Exception as e:
            logger.error(f"Video script generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def create_slideshow_video(self, images: List[str], duration_per_image: float, platform: str, 
                               post_type: str = 'video', transition: str = 'fade') -> Dict[str, Any]:
        """Create a slideshow video from images with transitions"""
        if not self.enabled:
            return {'error': 'Video generation not enabled', 'enabled': False}
        
        if not images or len(images) == 0:
            return {'error': 'At least one image is required', 'success': False}
        
        try:
            # Get platform specs
            specs = self.platform_specs.get(platform, {}).get(post_type, {
                'aspect_ratio': '16:9', 'width': 1280, 'height': 720
            })
            
            total_duration = len(images) * duration_per_image
            
            # Validate against platform requirements
            min_dur = specs.get('min_duration', 0)
            max_dur = specs.get('max_duration', 600)
            
            if total_duration < min_dur:
                return {
                    'error': f'Video too short. Minimum {min_dur} seconds required for {platform}',
                    'success': False
                }
            
            if total_duration > max_dur:
                return {
                    'error': f'Video too long. Maximum {max_dur} seconds allowed for {platform}',
                    'success': False
                }
            
            # Video generation metadata (actual video generation would require ffmpeg)
            video_metadata = {
                'success': True,
                'format': 'slideshow',
                'image_count': len(images),
                'duration_per_image': duration_per_image,
                'total_duration': total_duration,
                'transition': transition,
                'platform': platform,
                'post_type': post_type,
                'dimensions': {
                    'width': specs.get('width'),
                    'height': specs.get('height'),
                    'aspect_ratio': specs.get('aspect_ratio')
                },
                'status': 'ready_for_generation',
                'note': 'Video will be generated using ffmpeg with specified parameters',
                'ffmpeg_command_template': f"ffmpeg -framerate 1/{duration_per_image} -pattern_type glob -i 'image*.jpg' -vf scale={specs.get('width')}:{specs.get('height')} -c:v libx264 -pix_fmt yuv420p output.mp4"
            }
            
            return video_metadata
            
        except Exception as e:
            logger.error(f"Slideshow video creation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_text_to_video_prompt(self, text: str, platform: str, post_type: str = 'video', 
                                      style: str = 'professional') -> Dict[str, Any]:
        """Generate optimized prompts for text-to-video AI models (like Runway, Pika, etc.)"""
        if not self.enabled:
            return {'error': 'AI prompt generation not enabled', 'enabled': False}
        
        try:
            specs = self.platform_specs.get(platform, {}).get(post_type, {})
            aspect_ratio = specs.get('aspect_ratio', '16:9')
            duration = specs.get('max_duration', 30)
            
            prompt = f"""Create a detailed video generation prompt for text-to-video AI models based on this content:

"{text}"

Requirements:
- Platform: {platform}
- Aspect ratio: {aspect_ratio}
- Style: {style}
- Duration: {min(duration, 30)} seconds

Generate a clear, detailed prompt that includes:
1. Visual style and aesthetics
2. Camera movements
3. Scene composition
4. Color palette
5. Mood and atmosphere
6. Key visual elements

Make it suitable for AI video generators like Runway, Pika, or Stable Video."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an expert at creating prompts for AI video generation models."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=400,
                temperature=0.7
            )
            
            video_prompt = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'original_text': text,
                'video_prompt': video_prompt,
                'platform': platform,
                'post_type': post_type,
                'aspect_ratio': aspect_ratio,
                'recommended_duration': min(duration, 30),
                'style': style,
                'note': 'Use this prompt with AI video generation tools like Runway ML, Pika Labs, or Stable Video Diffusion'
            }
        except Exception as e:
            logger.error(f"Text-to-video prompt generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_video_captions(self, video_content: str, platform: str, language: str = 'en') -> Dict[str, Any]:
        """Generate optimized captions/subtitles for video content"""
        if not self.enabled:
            return {'error': 'AI caption generation not enabled', 'enabled': False}
        
        try:
            prompt = f"""Generate optimized video captions for {platform}:

Content: "{video_content}"

Create:
1. Main caption (description)
2. Hashtags (3-5 relevant)
3. Call-to-action
4. Accessibility description

Make it engaging and platform-optimized."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a social media caption expert."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=300,
                temperature=0.7
            )
            
            caption_text = response.choices[0].message.content.strip()
            
            # Parse hashtags - support alphanumeric and underscores
            hashtags = re.findall(r'#[a-zA-Z0-9_]+', caption_text)
            
            return {
                'success': True,
                'caption': caption_text,
                'hashtags': hashtags,
                'platform': platform,
                'language': language,
                'character_count': len(caption_text)
            }
        except Exception as e:
            logger.error(f"Video caption generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def optimize_video_for_platform(self, video_path: str, platform: str, post_type: str = 'video') -> Dict[str, Any]:
        """Provide optimization specifications for video based on platform requirements"""
        if not self.enabled:
            return {'error': 'Video optimization not enabled', 'enabled': False}
        
        specs = self.platform_specs.get(platform, {}).get(post_type)
        
        if not specs:
            return {
                'error': f'Unknown platform/post type combination: {platform}/{post_type}',
                'success': False
            }
        
        return {
            'success': True,
            'platform': platform,
            'post_type': post_type,
            'specifications': specs,
            'optimization_settings': {
                'resolution': f"{specs['width']}x{specs['height']}",
                'aspect_ratio': specs['aspect_ratio'],
                'duration_range': f"{specs['min_duration']}-{specs['max_duration']} seconds",
                'recommended_format': 'mp4',
                'recommended_codec': 'h264',
                'recommended_bitrate': self.HIGH_BITRATE if specs['width'] >= self.HIGH_RESOLUTION_THRESHOLD else self.STANDARD_BITRATE,
                'audio_codec': self.AUDIO_CODEC,
                'audio_bitrate': self.AUDIO_BITRATE
            },
            'ffmpeg_command': self._generate_ffmpeg_command(specs, video_path)
        }
    
    def _generate_ffmpeg_command(self, specs: Dict, input_path: str) -> str:
        """Generate ffmpeg command for video optimization"""
        return (
            f"ffmpeg -i {input_path} "
            f"-vf \"scale={specs['width']}:{specs['height']}:force_original_aspect_ratio=decrease,pad={specs['width']}:{specs['height']}:(ow-iw)/2:(oh-ih)/2\" "
            f"-c:v libx264 -preset medium -crf 23 "
            f"-c:a aac -b:a 192k "
            f"-movflags +faststart "
            f"-t {specs['max_duration']} "
            f"output.mp4"
        )
    
    def get_video_templates(self) -> Dict[str, Any]:
        """Get all available video templates"""
        return {
            'success': True,
            'templates': self.VIDEO_TEMPLATES,
            'count': len(self.VIDEO_TEMPLATES)
        }
    
    def get_template(self, template_id: str) -> Dict[str, Any]:
        """Get a specific video template"""
        template = self.VIDEO_TEMPLATES.get(template_id)
        
        if not template:
            return {
                'error': f'Template {template_id} not found',
                'success': False,
                'available_templates': list(self.VIDEO_TEMPLATES.keys())
            }
        
        return {
            'success': True,
            'template_id': template_id,
            'template': template
        }
    
    def generate_from_template(self, template_id: str, topic: str, platform: str) -> Dict[str, Any]:
        """Generate video script using a template"""
        if not self.enabled:
            return {'error': 'AI video generation not enabled', 'enabled': False}
        
        template = self.VIDEO_TEMPLATES.get(template_id)
        if not template:
            return {
                'error': f'Template {template_id} not found',
                'success': False,
                'available_templates': list(self.VIDEO_TEMPLATES.keys())
            }
        
        try:
            prompt = f"""Create a {template['duration']}-second {template['style']} video script for {platform} about: {topic}

Use this template structure:
{template['script_template']}

Requirements:
- {template['scenes']} scenes total
- Duration: {template['duration']} seconds
- Style: {template['style']}
- Transitions: {', '.join(template['transitions'])}
- Include timing for each scene
- Add visual descriptions
- Platform: {platform}

Return a detailed scene-by-scene breakdown."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": f"You are a professional video script writer specializing in {template['style']} content."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.7
            )
            
            script = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'template_id': template_id,
                'template_name': template['name'],
                'script': script,
                'platform': platform,
                'duration': template['duration'],
                'style': template['style'],
                'scenes': template['scenes'],
                'transitions': template['transitions']
            }
        except Exception as e:
            logger.error(f"Template-based script generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def render_slideshow_with_ffmpeg(self, images: List[str], duration_per_image: float, 
                                    output_path: str, specs: Dict, transition: str = 'fade') -> Dict[str, Any]:
        """Actually render video using FFmpeg (requires ffmpeg installed)"""
        if not images:
            return {'error': 'At least one image is required', 'success': False}
        
        try:
            import subprocess
            import tempfile
            
            # Create temporary directory for processing
            with tempfile.TemporaryDirectory() as temp_dir:
                # Create input file list for FFmpeg
                input_list_path = os.path.join(temp_dir, 'inputs.txt')
                with open(input_list_path, 'w') as f:
                    for img in images:
                        f.write(f"file '{img}'\n")
                        f.write(f"duration {duration_per_image}\n")
                    # Add last image one more time for proper ending
                    if images:
                        f.write(f"file '{images[-1]}'\n")
                
                # Build FFmpeg command
                width = specs['width']
                height = specs['height']
                
                cmd = [
                    'ffmpeg',
                    '-f', 'concat',
                    '-safe', '0',
                    '-i', input_list_path,
                    '-vf', f"scale={width}:{height}:force_original_aspect_ratio=decrease,pad={width}:{height}:(ow-iw)/2:(oh-ih)/2",
                    '-c:v', 'libx264',
                    '-preset', 'medium',
                    '-crf', '23',
                    '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart',
                    '-y',  # Overwrite output
                    output_path
                ]
                
                # Execute FFmpeg
                result = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=300  # 5 minute timeout
                )
                
                if result.returncode == 0:
                    # Get video file size
                    file_size = os.path.getsize(output_path) if os.path.exists(output_path) else 0
                    
                    return {
                        'success': True,
                        'output_path': output_path,
                        'file_size': file_size,
                        'dimensions': {'width': width, 'height': height},
                        'duration': len(images) * duration_per_image,
                        'image_count': len(images),
                        'format': 'mp4',
                        'codec': 'h264'
                    }
                else:
                    return {
                        'error': 'FFmpeg rendering failed',
                        'success': False,
                        'stderr': result.stderr[:500]  # First 500 chars of error
                    }
        
        except subprocess.TimeoutExpired:
            return {'error': 'Video rendering timeout (exceeded 5 minutes)', 'success': False}
        except FileNotFoundError:
            return {
                'error': 'FFmpeg not installed. Install with: apt-get install ffmpeg',
                'success': False,
                'fallback': 'Use create_slideshow_video for command generation'
            }
        except Exception as e:
            logger.error(f"Video rendering error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def get_platform_video_specs(self, platform: str) -> Dict[str, Any]:
        """Get all video specifications for a platform"""
        specs = self.platform_specs.get(platform, {})
        
        if not specs:
            return {
                'error': f'Platform {platform} not found or does not support video',
                'success': False
            }
        
        return {
            'success': True,
            'platform': platform,
            'video_types': list(specs.keys()),
            'specifications': specs
        }
    
    def generate_subtitle_file(self, script: str, duration: int, output_format: str = 'srt') -> Dict[str, Any]:
        """Generate subtitle file from script with timestamps (Improvement #1: Auto-subtitle generation)"""
        if not self.enabled:
            return {'error': 'Subtitle generation not enabled', 'enabled': False}
        
        try:
            # Split script into segments
            lines = [line.strip() for line in script.split('\n') if line.strip()]
            
            # Calculate timing for each line
            time_per_line = duration / max(len(lines), 1)
            
            subtitles = []
            for i, line in enumerate(lines):
                start_time = i * time_per_line
                end_time = (i + 1) * time_per_line
                
                # Format timestamps
                start_formatted = self._format_srt_time(start_time)
                end_formatted = self._format_srt_time(end_time)
                
                subtitles.append({
                    'index': i + 1,
                    'start': start_formatted,
                    'end': end_formatted,
                    'text': line
                })
            
            # Generate SRT or VTT content
            if output_format.lower() == 'srt':
                content = self._generate_srt_content(subtitles)
            elif output_format.lower() == 'vtt':
                content = self._generate_vtt_content(subtitles)
            else:
                return {'error': f'Unsupported format: {output_format}', 'success': False}
            
            return {
                'success': True,
                'format': output_format,
                'subtitle_count': len(subtitles),
                'duration': duration,
                'content': content,
                'subtitles': subtitles
            }
        except Exception as e:
            logger.error(f"Subtitle generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def _format_srt_time(self, seconds: float) -> str:
        """Format time for SRT format (HH:MM:SS,mmm)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        millisecs = int((seconds % 1) * 1000)
        return f"{hours:02d}:{minutes:02d}:{secs:02d},{millisecs:03d}"
    
    def _generate_srt_content(self, subtitles: List[Dict]) -> str:
        """Generate SRT file content"""
        lines = []
        for sub in subtitles:
            lines.append(str(sub['index']))
            lines.append(f"{sub['start']} --> {sub['end']}")
            lines.append(sub['text'])
            lines.append('')  # Empty line between subtitles
        return '\n'.join(lines)
    
    def _generate_vtt_content(self, subtitles: List[Dict]) -> str:
        """Generate WebVTT file content"""
        lines = ['WEBVTT', '']
        for sub in subtitles:
            # VTT uses dots instead of commas for milliseconds
            start = sub['start'].replace(',', '.')
            end = sub['end'].replace(',', '.')
            lines.append(f"{start} --> {end}")
            lines.append(sub['text'])
            lines.append('')
        return '\n'.join(lines)
    
    def convert_aspect_ratio(self, input_specs: Dict, target_ratio: str) -> Dict[str, Any]:
        """Convert video aspect ratio specifications (Improvement #2: Automatic aspect ratio conversion)"""
        ratio_specs = {
            '16:9': {'width': 1920, 'height': 1080, 'description': 'Landscape (YouTube, Facebook)'},
            '9:16': {'width': 1080, 'height': 1920, 'description': 'Portrait (Instagram Reels, TikTok, Stories)'},
            '1:1': {'width': 1080, 'height': 1080, 'description': 'Square (Instagram Feed)'},
            '4:5': {'width': 1080, 'height': 1350, 'description': 'Portrait (Instagram Feed)'},
            '2:3': {'width': 1000, 'height': 1500, 'description': 'Vertical (Pinterest)'}
        }
        
        if target_ratio not in ratio_specs:
            return {
                'error': f'Unsupported aspect ratio: {target_ratio}',
                'success': False,
                'supported_ratios': list(ratio_specs.keys())
            }
        
        target = ratio_specs[target_ratio]
        
        # Generate FFmpeg command for conversion
        ffmpeg_cmd = (
            f"ffmpeg -i input.mp4 "
            f"-vf \"scale={target['width']}:{target['height']}:force_original_aspect_ratio=decrease,"
            f"pad={target['width']}:{target['height']}:(ow-iw)/2:(oh-ih)/2:black\" "
            f"-c:v libx264 -preset medium -crf 23 "
            f"-c:a copy "
            f"output_{target_ratio.replace(':', 'x')}.mp4"
        )
        
        return {
            'success': True,
            'target_ratio': target_ratio,
            'target_dimensions': {'width': target['width'], 'height': target['height']},
            'description': target['description'],
            'ffmpeg_command': ffmpeg_cmd,
            'all_ratios': ratio_specs
        }
    
    def generate_voiceover_script(self, script: str, language: str = 'en', voice_style: str = 'professional') -> Dict[str, Any]:
        """Generate voiceover-ready script with timing and emphasis (Improvement #3: AI voiceover preparation)"""
        if not self.enabled:
            return {'error': 'Voiceover script generation not enabled', 'enabled': False}
        
        try:
            prompt = f"""Convert this script into a voiceover-ready format with timing markers and emphasis:

Script: {script}
Language: {language}
Voice Style: {voice_style}

Requirements:
- Add [PAUSE] markers for natural breaks
- Mark [EMPHASIS] on key words
- Include [SLOW] for important points
- Add timing suggestions in seconds
- Optimize for {voice_style} delivery
- Make it sound natural and engaging

Return formatted voiceover script."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a professional voiceover script writer."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.7
            )
            
            voiceover_script = response.choices[0].message.content.strip()
            
            # Parse timing markers
            pause_count = voiceover_script.count('[PAUSE]')
            emphasis_count = voiceover_script.count('[EMPHASIS]')
            
            return {
                'success': True,
                'voiceover_script': voiceover_script,
                'language': language,
                'voice_style': voice_style,
                'markers': {
                    'pauses': pause_count,
                    'emphasis': emphasis_count
                },
                'note': 'Use with ElevenLabs, Azure TTS, or Google Cloud Text-to-Speech'
            }
        except Exception as e:
            logger.error(f"Voiceover script generation error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    # ===== AI VOICEOVER IMPROVEMENTS (10 Features) =====
    
    def get_supported_languages(self) -> Dict[str, Any]:
        """Get list of 60 supported languages for voiceover (Voiceover Improvement #1)"""
        languages = {
            # Major World Languages
            'en': {'name': 'English', 'region': 'Global', 'tts_providers': ['ElevenLabs', 'Azure', 'Google', 'Amazon']},
            'es': {'name': 'Spanish', 'region': 'Europe/Americas', 'tts_providers': ['ElevenLabs', 'Azure', 'Google', 'Amazon']},
            'fr': {'name': 'French', 'region': 'Europe/Africa', 'tts_providers': ['ElevenLabs', 'Azure', 'Google', 'Amazon']},
            'de': {'name': 'German', 'region': 'Europe', 'tts_providers': ['ElevenLabs', 'Azure', 'Google', 'Amazon']},
            'it': {'name': 'Italian', 'region': 'Europe', 'tts_providers': ['ElevenLabs', 'Azure', 'Google', 'Amazon']},
            'pt': {'name': 'Portuguese', 'region': 'Europe/Americas/Africa', 'tts_providers': ['ElevenLabs', 'Azure', 'Google', 'Amazon']},
            'ru': {'name': 'Russian', 'region': 'Europe/Asia', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'ja': {'name': 'Japanese', 'region': 'Asia', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'ko': {'name': 'Korean', 'region': 'Asia', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'zh': {'name': 'Chinese (Mandarin)', 'region': 'Asia', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            
            # European Languages
            'nl': {'name': 'Dutch', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'pl': {'name': 'Polish', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'sv': {'name': 'Swedish', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'no': {'name': 'Norwegian', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'da': {'name': 'Danish', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'fi': {'name': 'Finnish', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'cs': {'name': 'Czech', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'ro': {'name': 'Romanian', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'hu': {'name': 'Hungarian', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'el': {'name': 'Greek', 'region': 'Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            
            # Middle Eastern & African Languages
            'ar': {'name': 'Arabic', 'region': 'Middle East/Africa', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'he': {'name': 'Hebrew', 'region': 'Middle East', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'tr': {'name': 'Turkish', 'region': 'Middle East/Europe', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'fa': {'name': 'Persian (Farsi)', 'region': 'Middle East', 'tts_providers': ['Google', 'Amazon']},
            'sw': {'name': 'Swahili', 'region': 'Africa', 'tts_providers': ['Google', 'Amazon']},
            'zu': {'name': 'Zulu', 'region': 'Africa', 'tts_providers': ['Google']},
            'am': {'name': 'Amharic', 'region': 'Africa', 'tts_providers': ['Google']},
            
            # Asian Languages
            'hi': {'name': 'Hindi', 'region': 'Asia', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'bn': {'name': 'Bengali', 'region': 'Asia', 'tts_providers': ['Google', 'Amazon']},
            'ur': {'name': 'Urdu', 'region': 'Asia', 'tts_providers': ['Google', 'Amazon']},
            'th': {'name': 'Thai', 'region': 'Asia', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'vi': {'name': 'Vietnamese', 'region': 'Asia', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'id': {'name': 'Indonesian', 'region': 'Asia', 'tts_providers': ['Azure', 'Google', 'Amazon']},
            'ms': {'name': 'Malay', 'region': 'Asia', 'tts_providers': ['Google', 'Amazon']},
            'tl': {'name': 'Filipino (Tagalog)', 'region': 'Asia', 'tts_providers': ['Google', 'Amazon']},
            'ta': {'name': 'Tamil', 'region': 'Asia', 'tts_providers': ['Google', 'Amazon']},
            'te': {'name': 'Telugu', 'region': 'Asia', 'tts_providers': ['Google', 'Amazon']},
            'ml': {'name': 'Malayalam', 'region': 'Asia', 'tts_providers': ['Google']},
            'kn': {'name': 'Kannada', 'region': 'Asia', 'tts_providers': ['Google']},
            'mr': {'name': 'Marathi', 'region': 'Asia', 'tts_providers': ['Google']},
            'gu': {'name': 'Gujarati', 'region': 'Asia', 'tts_providers': ['Google']},
            
            # More European Languages
            'uk': {'name': 'Ukrainian', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            'bg': {'name': 'Bulgarian', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            'sk': {'name': 'Slovak', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            'hr': {'name': 'Croatian', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            'sr': {'name': 'Serbian', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            'sl': {'name': 'Slovenian', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            'lt': {'name': 'Lithuanian', 'region': 'Europe', 'tts_providers': ['Google']},
            'lv': {'name': 'Latvian', 'region': 'Europe', 'tts_providers': ['Google']},
            'et': {'name': 'Estonian', 'region': 'Europe', 'tts_providers': ['Google']},
            'is': {'name': 'Icelandic', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            
            # Additional Languages
            'ca': {'name': 'Catalan', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            'gl': {'name': 'Galician', 'region': 'Europe', 'tts_providers': ['Google']},
            'eu': {'name': 'Basque', 'region': 'Europe', 'tts_providers': ['Google']},
            'cy': {'name': 'Welsh', 'region': 'Europe', 'tts_providers': ['Azure', 'Google']},
            'ga': {'name': 'Irish', 'region': 'Europe', 'tts_providers': ['Google']},
            'mt': {'name': 'Maltese', 'region': 'Europe', 'tts_providers': ['Google']},
            'sq': {'name': 'Albanian', 'region': 'Europe', 'tts_providers': ['Google']},
            'mk': {'name': 'Macedonian', 'region': 'Europe', 'tts_providers': ['Google']},
            'af': {'name': 'Afrikaans', 'region': 'Africa', 'tts_providers': ['Azure', 'Google']},
            'ne': {'name': 'Nepali', 'region': 'Asia', 'tts_providers': ['Google']},
            'si': {'name': 'Sinhala', 'region': 'Asia', 'tts_providers': ['Google']},
        }
        
        return {
            'success': True,
            'total_languages': len(languages),
            'languages': languages,
            'regions': ['Europe', 'Asia', 'Americas', 'Middle East', 'Africa', 'Global'],
            'tts_providers': ['ElevenLabs', 'Azure', 'Google', 'Amazon']
        }
    
    def generate_pronunciation_guide(self, script: str, language: str = 'en') -> Dict[str, Any]:
        """Generate pronunciation guide for difficult words (Voiceover Improvement #2)"""
        if not self.enabled:
            return {'error': 'Pronunciation guide not enabled', 'enabled': False}
        
        try:
            prompt = f"""Analyze this script and provide pronunciation guidance for difficult or ambiguous words:

Script: {script}
Language: {language}

Identify:
1. Technical terms that need pronunciation guidance
2. Proper nouns (names, brands, places)
3. Acronyms and how to pronounce them
4. Words with multiple pronunciations
5. Foreign words or phrases

For each word, provide:
- The word
- Phonetic spelling
- Audio guidance (e.g., "sounds like...")
- Context notes

Return as structured pronunciation guide."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a professional pronunciation coach and linguist."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.5
            )
            
            guide = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'pronunciation_guide': guide,
                'language': language,
                'script_length': len(script),
                'note': 'Use this guide with voice actors or TTS systems for accurate pronunciation'
            }
        except Exception as e:
            logger.error(f"Pronunciation guide error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_emotion_markers(self, script: str, video_type: str = 'general') -> Dict[str, Any]:
        """Add emotion and tone markers to script (Voiceover Improvement #3)"""
        if not self.enabled:
            return {'error': 'Emotion markers not enabled', 'enabled': False}
        
        try:
            prompt = f"""Add detailed emotion and tone markers to this voiceover script:

Script: {script}
Video Type: {video_type}

Add markers for:
- [EXCITED] - High energy, enthusiastic
- [CALM] - Peaceful, soothing tone
- [SERIOUS] - Formal, authoritative
- [FRIENDLY] - Warm, conversational
- [URGENT] - Quick, pressing tone
- [QUESTIONING] - Curious, inquisitive
- [CONFIDENT] - Strong, assured
- [EMPATHETIC] - Understanding, compassionate

Also add:
- [SMILE] - Voice should sound like smiling
- [WHISPER] - Soft, intimate delivery
- Volume markers: [LOUDER] [SOFTER]
- Pace markers: [FASTER] [SLOWER]

Return the script with emotion markers inserted naturally."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a voice direction expert for professional voiceover work."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.7
            )
            
            marked_script = response.choices[0].message.content.strip()
            
            # Count emotion markers
            emotion_types = ['EXCITED', 'CALM', 'SERIOUS', 'FRIENDLY', 'URGENT', 'QUESTIONING', 'CONFIDENT', 'EMPATHETIC']
            emotion_counts = {emotion: marked_script.count(f'[{emotion}]') for emotion in emotion_types}
            
            return {
                'success': True,
                'marked_script': marked_script,
                'video_type': video_type,
                'emotion_markers': emotion_counts,
                'total_markers': sum(emotion_counts.values()),
                'note': 'Use with emotion-capable TTS or provide to voice actors'
            }
        except Exception as e:
            logger.error(f"Emotion markers error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_multi_voice_script(self, script: str, num_voices: int = 2) -> Dict[str, Any]:
        """Split script for multiple voice actors/personas (Voiceover Improvement #4)"""
        if not self.enabled:
            return {'error': 'Multi-voice script not enabled', 'enabled': False}
        
        try:
            prompt = f"""Convert this script into a multi-voice conversation or narration:

Script: {script}
Number of Voices: {num_voices}

Create a natural dialogue or narration that uses {num_voices} distinct voices:
- Voice 1: [V1] tags
- Voice 2: [V2] tags
- Voice 3: [V3] tags (if applicable)

For each voice, suggest:
- Character/persona (e.g., narrator, expert, customer, host)
- Voice characteristics (age, gender, tone)
- Accent/dialect suggestions

Make the conversation natural and engaging. Return formatted multi-voice script."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a professional scriptwriter specializing in dialogue and voice direction."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=900,
                temperature=0.8
            )
            
            multi_voice_script = response.choices[0].message.content.strip()
            
            # Count voice tags
            voice_tags = {f'V{i+1}': multi_voice_script.count(f'[V{i+1}]') for i in range(num_voices)}
            
            return {
                'success': True,
                'multi_voice_script': multi_voice_script,
                'num_voices': num_voices,
                'voice_line_counts': voice_tags,
                'note': 'Assign different voice actors or TTS voices to each [V#] tag'
            }
        except Exception as e:
            logger.error(f"Multi-voice script error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_breath_marks(self, script: str, style: str = 'natural') -> Dict[str, Any]:
        """Add breath marks and pacing guidance (Voiceover Improvement #5)"""
        if not self.enabled:
            return {'error': 'Breath marks not enabled', 'enabled': False}
        
        try:
            breath_styles = {
                'natural': 'Natural breathing patterns, breath every 8-12 words',
                'fast_paced': 'Quick delivery, shorter breath intervals',
                'dramatic': 'Strategic pauses for dramatic effect',
                'conversational': 'Casual, frequent breaths like normal speech'
            }
            
            style_guide = breath_styles.get(style, breath_styles['natural'])
            
            prompt = f"""Add breath marks and pacing guidance to this voiceover script:

Script: {script}
Style: {style} - {style_guide}

Add markers:
- [BREATH] - Take a breath
- [SHORT_PAUSE] - 0.5 second pause
- [MEDIUM_PAUSE] - 1 second pause
- [LONG_PAUSE] - 2+ second pause
- [NO_BREATH] - Continue without breath (for impact)

Consider:
- Sentence structure and natural breaks
- Punctuation cues
- Emotional beats
- Narrative flow

Return script with breathing and pacing markers."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a professional voice coach specializing in breath control and pacing."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=800,
                temperature=0.6
            )
            
            marked_script = response.choices[0].message.content.strip()
            
            # Count markers
            breath_count = marked_script.count('[BREATH]')
            pause_count = marked_script.count('PAUSE')
            
            return {
                'success': True,
                'marked_script': marked_script,
                'style': style,
                'breath_marks': breath_count,
                'pause_marks': pause_count,
                'note': 'Follow breath marks for natural, professional delivery'
            }
        except Exception as e:
            logger.error(f"Breath marks error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def estimate_voiceover_duration(self, script: str, language: str = 'en', speech_rate: str = 'normal') -> Dict[str, Any]:
        """Estimate voiceover duration with timing breakdown (Voiceover Improvement #6)"""
        
        speech_rates = {
            'slow': 100,      # words per minute
            'normal': 150,    # words per minute
            'fast': 180,      # words per minute
            'very_fast': 200  # words per minute
        }
        
        wpm = speech_rates.get(speech_rate, 150)
        
        # Count words
        words = len(script.split())
        
        # Base duration in seconds
        base_duration = (words / wpm) * 60
        
        # Add pause time (estimate 0.5s per sentence)
        sentences = script.count('.') + script.count('!') + script.count('?')
        pause_time = sentences * 0.5
        
        # Total duration
        total_duration = base_duration + pause_time
        
        # Calculate per-segment timing if script has line breaks
        segments = script.split('\n')
        segment_timings = []
        cumulative_time = 0
        
        for i, segment in enumerate(segments):
            if segment.strip():
                seg_words = len(segment.split())
                seg_duration = (seg_words / wpm) * 60 + 0.5
                segment_timings.append({
                    'segment': i + 1,
                    'text': segment[:50] + '...' if len(segment) > 50 else segment,
                    'duration': round(seg_duration, 2),
                    'start_time': round(cumulative_time, 2),
                    'end_time': round(cumulative_time + seg_duration, 2)
                })
                cumulative_time += seg_duration
        
        return {
            'success': True,
            'total_duration_seconds': round(total_duration, 2),
            'total_duration_minutes': round(total_duration / 60, 2),
            'word_count': words,
            'speech_rate': speech_rate,
            'words_per_minute': wpm,
            'estimated_pauses': sentences,
            'segment_count': len([s for s in segments if s.strip()]),
            'segment_timings': segment_timings,
            'language': language,
            'note': 'Actual duration may vary by ±15% based on delivery style'
        }
    
    def generate_accent_guidance(self, script: str, target_accent: str = 'neutral') -> Dict[str, Any]:
        """Generate accent and dialect guidance (Voiceover Improvement #7)"""
        if not self.enabled:
            return {'error': 'Accent guidance not enabled', 'enabled': False}
        
        try:
            accents = {
                'neutral': 'Standard neutral accent, clear and universally understood',
                'american': 'General American English (TV/radio standard)',
                'british': 'Received Pronunciation (BBC English)',
                'australian': 'General Australian English',
                'scottish': 'Scottish English accent',
                'irish': 'Irish English accent',
                'southern': 'Southern US accent',
                'new_york': 'New York City accent',
                'california': 'California/West Coast accent',
                'canadian': 'Canadian English accent'
            }
            
            accent_info = accents.get(target_accent, accents['neutral'])
            
            prompt = f"""Provide accent and dialect guidance for this voiceover script:

Script: {script}
Target Accent: {target_accent} - {accent_info}

Provide guidance on:
1. Key vowel sounds specific to this accent
2. Consonant pronunciations that differ
3. Intonation patterns
4. Stress patterns
5. Common phrases that need special attention
6. Words to avoid or replace for this accent
7. Rhythm and cadence notes

Make it practical and easy to follow for voice actors."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a dialect coach with expertise in accents and regional speech patterns."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=700,
                temperature=0.6
            )
            
            guidance = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'accent_guidance': guidance,
                'target_accent': target_accent,
                'accent_description': accent_info,
                'available_accents': list(accents.keys()),
                'note': 'Use with professional voice actors familiar with the target accent'
            }
        except Exception as e:
            logger.error(f"Accent guidance error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_tts_config(self, script: str, language: str = 'en', provider: str = 'elevenlabs') -> Dict[str, Any]:
        """Generate TTS provider-specific configuration (Voiceover Improvement #8)"""
        
        # TTS provider configurations
        configs = {
            'elevenlabs': {
                'api_endpoint': 'https://api.elevenlabs.io/v1/text-to-speech',
                'recommended_voices': {
                    'male': ['Adam', 'Antoni', 'Arnold', 'Callum', 'Charlie'],
                    'female': ['Bella', 'Domi', 'Elli', 'Emily', 'Rachel']
                },
                'parameters': {
                    'stability': 0.75,
                    'similarity_boost': 0.75,
                    'model_id': 'eleven_monolingual_v1'
                },
                'features': ['Voice cloning', 'Emotion control', 'Multi-lingual', '60+ languages'],
                'pricing': 'Starts at $5/month for 30,000 characters'
            },
            'azure': {
                'api_endpoint': 'https://[region].tts.speech.microsoft.com/cognitiveservices/v1',
                'recommended_voices': {
                    'male': ['en-US-GuyNeural', 'en-US-DavisNeural', 'en-GB-RyanNeural'],
                    'female': ['en-US-JennyNeural', 'en-US-AriaNeural', 'en-GB-SoniaNeural']
                },
                'parameters': {
                    'rate': '0%',
                    'pitch': '0%',
                    'volume': '0%'
                },
                'ssml_support': True,
                'features': ['Neural voices', '110+ languages', 'SSML tags', 'Custom neural voice'],
                'pricing': 'Pay-as-you-go, $15 per 1M characters'
            },
            'google': {
                'api_endpoint': 'https://texttospeech.googleapis.com/v1/text:synthesize',
                'recommended_voices': {
                    'male': ['en-US-Neural2-D', 'en-US-Neural2-A', 'en-GB-Neural2-B'],
                    'female': ['en-US-Neural2-C', 'en-US-Neural2-E', 'en-US-Neural2-F']
                },
                'parameters': {
                    'speakingRate': 1.0,
                    'pitch': 0.0,
                    'volumeGainDb': 0.0
                },
                'ssml_support': True,
                'features': ['WaveNet voices', '40+ languages', 'SSML support', 'Custom voice'],
                'pricing': 'Free tier: 1M characters/month, then $4 per 1M'
            },
            'amazon': {
                'api_endpoint': 'Amazon Polly API',
                'recommended_voices': {
                    'male': ['Matthew', 'Joey', 'Justin', 'Kevin'],
                    'female': ['Joanna', 'Kendra', 'Kimberly', 'Salli']
                },
                'parameters': {
                    'Engine': 'neural',
                    'SampleRate': '24000',
                    'OutputFormat': 'mp3'
                },
                'ssml_support': True,
                'features': ['Neural voices', '60+ languages', 'Newscaster style', 'Conversational style'],
                'pricing': 'Free tier: 5M characters/month (12 months), then $16 per 1M'
            }
        }
        
        config = configs.get(provider, configs['elevenlabs'])
        
        # Calculate character count and estimate cost
        char_count = len(script)
        
        # Estimate cost per provider (simplified)
        cost_estimates = {
            'elevenlabs': (char_count / 30000) * 5,  # Rough monthly cost
            'azure': (char_count / 1000000) * 15,
            'google': max(0, (char_count / 1000000 - 1) * 4),  # Free tier included
            'amazon': max(0, (char_count / 1000000) * 16)
        }
        
        return {
            'success': True,
            'provider': provider,
            'language': language,
            'character_count': char_count,
            'estimated_cost_usd': round(cost_estimates.get(provider, 0), 2),
            'configuration': config,
            'ssml_enabled': config.get('ssml_support', False),
            'all_providers': list(configs.keys()),
            'note': 'Configure API keys in your environment before use'
        }
    
    def generate_background_music_sync(self, script: str, music_style: str = 'corporate') -> Dict[str, Any]:
        """Generate background music sync points (Voiceover Improvement #9)"""
        if not self.enabled:
            return {'error': 'Music sync not enabled', 'enabled': False}
        
        try:
            music_styles = {
                'corporate': 'Professional, uplifting, motivational',
                'energetic': 'Fast-paced, exciting, high-energy',
                'calm': 'Peaceful, soothing, ambient',
                'dramatic': 'Intense, suspenseful, emotional',
                'upbeat': 'Happy, cheerful, positive',
                'cinematic': 'Epic, orchestral, grand'
            }
            
            style_desc = music_styles.get(music_style, music_styles['corporate'])
            
            prompt = f"""Analyze this voiceover script and suggest background music sync points:

Script: {script}
Music Style: {music_style} - {style_desc}

Provide:
1. Music cue points (when to start, stop, fade in/out)
2. Volume levels relative to voice (e.g., -20dB, -15dB)
3. Music change suggestions for different sections
4. Emotional sync points where music should match content
5. Silence points where music should drop out
6. Build/crescendo points

Format as timestamp-based music direction."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are an audio engineer specializing in music and voiceover mixing."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=700,
                temperature=0.7
            )
            
            music_sync = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'music_sync_guide': music_sync,
                'music_style': music_style,
                'style_description': style_desc,
                'available_styles': list(music_styles.keys()),
                'note': 'Adjust music volume to ensure voiceover remains clear (-15dB to -20dB is typical)'
            }
        except Exception as e:
            logger.error(f"Music sync error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_voiceover_quality_check(self, script: str, language: str = 'en') -> Dict[str, Any]:
        """Analyze script for voiceover quality issues (Voiceover Improvement #10)"""
        if not self.enabled:
            return {'error': 'Quality check not enabled', 'enabled': False}
        
        try:
            # Automated checks
            quality_issues = []
            warnings = []
            suggestions = []
            
            # Check 1: Script length
            word_count = len(script.split())
            if word_count < 20:
                warnings.append('Script is very short (< 20 words). Consider expanding.')
            elif word_count > 500:
                warnings.append('Script is very long (> 500 words). Consider breaking into segments.')
            
            # Check 2: Sentence length
            sentences = [s.strip() for s in script.replace('!', '.').replace('?', '.').split('.') if s.strip()]
            avg_sentence_length = sum(len(s.split()) for s in sentences) / max(len(sentences), 1)
            if avg_sentence_length > 25:
                quality_issues.append('Sentences are too long (avg > 25 words). Voice actors may struggle with breath control.')
            
            # Check 3: Difficult consonant clusters
            difficult_patterns = ['str', 'spr', 'thr', 'scr', 'spl']
            difficult_words = [word for word in script.split() if any(pattern in word.lower() for pattern in difficult_patterns)]
            if len(difficult_words) > 10:
                warnings.append(f'Script contains many words with difficult consonant clusters: {", ".join(difficult_words[:5])}...')
            
            # Check 4: Punctuation
            if script.count(',') + script.count('.') + script.count('!') + script.count('?') < word_count / 20:
                quality_issues.append('Insufficient punctuation. Add commas and periods for natural pacing.')
            
            # Check 5: Acronyms without periods
            import re
            acronyms = re.findall(r'\b[A-Z]{2,}\b', script)
            if acronyms:
                suggestions.append(f'Found acronyms: {", ".join(set(acronyms))}. Clarify pronunciation in notes.')
            
            # AI-powered analysis
            prompt = f"""Analyze this voiceover script for quality and readability:

Script: {script}
Language: {language}

Check for:
1. Tongue twisters or difficult phrases
2. Ambiguous pronunciations
3. Awkward phrasing that sounds unnatural when spoken
4. Missing punctuation that affects pacing
5. Words that might be misread
6. Overall flow and rhythm

Provide specific, actionable feedback."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a voiceover director with expertise in script quality assurance."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.5
            )
            
            ai_analysis = response.choices[0].message.content.strip()
            
            # Calculate quality score
            quality_score = 100
            quality_score -= len(quality_issues) * 15
            quality_score -= len(warnings) * 5
            quality_score = max(0, quality_score)
            
            return {
                'success': True,
                'quality_score': quality_score,
                'quality_rating': 'Excellent' if quality_score >= 90 else 'Good' if quality_score >= 70 else 'Fair' if quality_score >= 50 else 'Needs Improvement',
                'quality_issues': quality_issues,
                'warnings': warnings,
                'suggestions': suggestions,
                'ai_analysis': ai_analysis,
                'statistics': {
                    'word_count': word_count,
                    'sentence_count': len(sentences),
                    'avg_sentence_length': round(avg_sentence_length, 1),
                    'difficult_words': len(difficult_words),
                    'acronyms': len(acronyms)
                },
                'language': language,
                'note': 'Address quality issues before recording for best results'
            }
        except Exception as e:
            logger.error(f"Quality check error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def generate_broll_suggestions(self, script: str, video_type: str) -> Dict[str, Any]:
        """Generate B-roll footage suggestions (Improvement #4: B-roll integration)"""
        if not self.enabled:
            return {'error': 'B-roll suggestions not enabled', 'enabled': False}
        
        try:
            prompt = f"""Suggest B-roll footage for this {video_type} video script:

Script: {script}

For each scene, suggest:
- Type of B-roll footage needed
- Keywords for stock footage search
- Duration recommendation
- Transition style

Return structured B-roll suggestions."""

            response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a professional video editor specializing in B-roll selection."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=600,
                temperature=0.7
            )
            
            suggestions = response.choices[0].message.content.strip()
            
            return {
                'success': True,
                'broll_suggestions': suggestions,
                'video_type': video_type,
                'stock_sources': ['Pexels', 'Pixabay', 'Unsplash', 'Videvo', 'Coverr'],
                'note': 'Use suggested keywords to search stock footage libraries'
            }
        except Exception as e:
            logger.error(f"B-roll suggestion error: {str(e)}")
            return {'error': str(e), 'success': False}
    
    def create_batch_videos(self, batch_data: List[Dict], template_id: str, platform: str) -> Dict[str, Any]:
        """Batch video creation from CSV data (Improvement #5: Batch video creation)"""
        if not self.enabled:
            return {'error': 'Batch video creation not enabled', 'enabled': False}
        
        results = []
        successful = 0
        failed = 0
        
        for i, data in enumerate(batch_data):
            topic = data.get('topic', '')
            if not topic:
                failed += 1
                continue
            
            try:
                # Generate script for each topic
                result = self.generate_from_template(template_id, topic, platform)
                
                if result.get('success'):
                    results.append({
                        'index': i + 1,
                        'topic': topic,
                        'status': 'success',
                        'script': result.get('script', '')[:200] + '...'  # Truncate for summary
                    })
                    successful += 1
                else:
                    results.append({
                        'index': i + 1,
                        'topic': topic,
                        'status': 'failed',
                        'error': result.get('error', 'Unknown error')
                    })
                    failed += 1
            except Exception as e:
                results.append({
                    'index': i + 1,
                    'topic': topic,
                    'status': 'failed',
                    'error': str(e)
                })
                failed += 1
        
        return {
            'success': True,
            'total_processed': len(batch_data),
            'successful': successful,
            'failed': failed,
            'results': results,
            'template_id': template_id,
            'platform': platform
        }
    
    def add_brand_watermark(self, video_specs: Dict, watermark_config: Dict) -> Dict[str, Any]:
        """Add brand watermark/logo to video (Improvement #6: Brand kit integration)"""
        position = watermark_config.get('position', 'bottom-right')
        opacity = watermark_config.get('opacity', 0.8)
        logo_path = watermark_config.get('logo_path', 'logo.png')
        
        # Position mappings for FFmpeg
        positions = {
            'top-left': '10:10',
            'top-right': 'W-w-10:10',
            'bottom-left': '10:H-h-10',
            'bottom-right': 'W-w-10:H-h-10',
            'center': '(W-w)/2:(H-h)/2'
        }
        
        overlay_position = positions.get(position, positions['bottom-right'])
        
        ffmpeg_cmd = (
            f"ffmpeg -i input.mp4 -i {logo_path} "
            f"-filter_complex \"[1:v]format=rgba,colorchannelmixer=aa={opacity}[logo];"
            f"[0:v][logo]overlay={overlay_position}\" "
            f"-c:a copy output_branded.mp4"
        )
        
        return {
            'success': True,
            'position': position,
            'opacity': opacity,
            'logo_path': logo_path,
            'ffmpeg_command': ffmpeg_cmd,
            'note': 'Watermark will be added to all frames'
        }
    
    def generate_intro_outro(self, brand_name: str, style: str = 'modern') -> Dict[str, Any]:
        """Generate intro/outro templates (Improvement #7: Viral hooks, intros, outros)"""
        if not self.enabled:
            return {'error': 'Intro/outro generation not enabled', 'enabled': False}
        
        intros = {
            'modern': f"🎬 {brand_name} Presents",
            'energetic': f"🚀 Welcome to {brand_name}!",
            'professional': f"Hello and welcome to {brand_name}",
            'casual': f"Hey there! {brand_name} here 👋",
            'dramatic': f"Get ready... {brand_name} is about to blow your mind! 🤯"
        }
        
        outros = {
            'modern': f"Thanks for watching! Subscribe for more from {brand_name}",
            'energetic': f"🔥 That's it! Hit that subscribe button for more {brand_name} content!",
            'professional': f"Thank you for watching. Follow {brand_name} for more insights.",
            'casual': f"See you next time! Don't forget to follow {brand_name} 😊",
            'dramatic': f"Mind = Blown! 💥 Follow {brand_name} for more game-changers!"
        }
        
        intro_text = intros.get(style, intros['modern'])
        outro_text = outros.get(style, outros['modern'])
        
        return {
            'success': True,
            'brand_name': brand_name,
            'style': style,
            'intro': {
                'text': intro_text,
                'duration': 3,
                'animation': 'fade-in'
            },
            'outro': {
                'text': outro_text,
                'duration': 5,
                'animation': 'fade-out',
                'cta': 'Subscribe/Follow'
            },
            'available_styles': list(intros.keys())
        }
    
    def generate_text_overlay_sequence(self, key_points: List[str], style: str = 'bold') -> Dict[str, Any]:
        """Generate animated text overlay sequence (Improvement #8: Timeline editor capabilities)"""
        overlay_styles = {
            'bold': {'font': 'Arial-Bold', 'size': 48, 'color': 'white', 'background': 'black'},
            'minimal': {'font': 'Helvetica', 'size': 36, 'color': 'white', 'background': 'transparent'},
            'colorful': {'font': 'Arial-Bold', 'size': 52, 'color': 'yellow', 'background': 'purple'},
            'elegant': {'font': 'Georgia', 'size': 40, 'color': 'gold', 'background': 'navy'}
        }
        
        selected_style = overlay_styles.get(style, overlay_styles['bold'])
        
        overlays = []
        for i, point in enumerate(key_points):
            overlays.append({
                'index': i + 1,
                'text': point,
                'start_time': i * 3,
                'duration': 3,
                'style': selected_style,
                'animation': 'fade-in-out',
                'position': 'center'
            })
        
        # Generate FFmpeg drawtext filter
        drawtext_filters = []
        for overlay in overlays:
            filter_cmd = (
                f"drawtext=text='{overlay['text']}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:"
                f"fontsize={selected_style['size']}:fontcolor={selected_style['color']}:"
                f"x=(w-text_w)/2:y=(h-text_h)/2:"
                f"enable='between(t,{overlay['start_time']},{overlay['start_time'] + overlay['duration']})'"
            )
            drawtext_filters.append(filter_cmd)
        
        return {
            'success': True,
            'overlay_count': len(overlays),
            'style': style,
            'overlays': overlays,
            'ffmpeg_filter': ','.join(drawtext_filters),
            'available_styles': list(overlay_styles.keys())
        }
    
    def optimize_for_multiple_platforms(self, source_video_specs: Dict) -> Dict[str, Any]:
        """Generate optimization specs for all platforms (Improvement #9: Multi-platform export)"""
        optimizations = {}
        
        for platform, specs_dict in self.platform_specs.items():
            platform_outputs = {}
            for video_type, specs in specs_dict.items():
                platform_outputs[video_type] = {
                    'dimensions': f"{specs['width']}x{specs['height']}",
                    'aspect_ratio': specs['aspect_ratio'],
                    'duration_range': f"{specs['min_duration']}-{specs['max_duration']}s",
                    'bitrate': self.HIGH_BITRATE if specs['width'] >= self.HIGH_RESOLUTION_THRESHOLD else self.STANDARD_BITRATE,
                    'ffmpeg_command': self._generate_ffmpeg_command(specs, 'input.mp4')
                }
            optimizations[platform] = platform_outputs
        
        return {
            'success': True,
            'platforms_count': len(optimizations),
            'optimizations': optimizations,
            'note': 'Generate platform-specific versions from single source video'
        }
    
    def generate_video_analytics_metadata(self, script: str, platform: str) -> Dict[str, Any]:
        """Generate metadata for video analytics (Improvement #10: Analytics integration)"""
        if not self.enabled:
            return {'error': 'Analytics metadata generation not enabled', 'enabled': False}
        
        try:
            # Extract key information
            word_count = len(script.split())
            scene_count = script.count('Scene')
            
            # Estimate engagement metrics
            hook_present = any(hook in script.lower() for hook in ['you won\'t believe', 'secret', 'discover', 'amazing'])
            cta_present = any(cta in script.lower() for cta in ['subscribe', 'follow', 'like', 'comment', 'share'])
            
            engagement_score = 50
            if hook_present:
                engagement_score += 20
            if cta_present:
                engagement_score += 15
            if 100 <= word_count <= 300:
                engagement_score += 10
            if scene_count >= 3:
                engagement_score += 5
            
            return {
                'success': True,
                'script_analysis': {
                    'word_count': word_count,
                    'scene_count': scene_count,
                    'has_hook': hook_present,
                    'has_cta': cta_present
                },
                'predicted_engagement_score': min(engagement_score, 100),
                'platform': platform,
                'recommendations': [
                    'Add strong hook in first 3 seconds' if not hook_present else 'Strong hook detected ✓',
                    'Include clear call-to-action' if not cta_present else 'CTA present ✓',
                    'Optimal script length' if 100 <= word_count <= 300 else 'Consider adjusting script length'
                ],
                'metadata_tags': {
                    'content_type': 'faceless_video',
                    'script_quality': 'high' if engagement_score >= 70 else 'medium',
                    'platform_optimized': True
                }
            }
        except Exception as e:
            logger.error(f"Analytics metadata generation error: {str(e)}")
            return {'error': str(e), 'success': False}


# Initialize AI services
ai_content_generator = AIContentGenerator()
intelligent_scheduler = IntelligentScheduler()
image_enhancer = ImageEnhancer()
ai_image_generator = AIImageGenerator()
engagement_predictor = EngagementPredictor()
viral_intelligence = ViralContentIntelligence()
content_multiplier = ContentMultiplier()
ai_video_generator = AIVideoGenerator()


class PlatformAdapter:
    """Base adapter for social media platforms"""
    
    def __init__(self, platform_name, supported_post_types=None, post_type_descriptions=None, rate_limits=None):
        self.platform_name = platform_name
        self.supported_post_types = supported_post_types or ['standard']
        self.post_type_descriptions = post_type_descriptions or {}
        # Rate limits: {post_type: {'requests_per_hour': X, 'requests_per_day': Y}}
        self.rate_limits = rate_limits or {}
    
    def split_text_at_word_boundaries(self, text, max_length):
        """Split text into chunks at word boundaries"""
        chunks = []
        remaining = text
        
        while remaining:
            if len(remaining) <= max_length:
                chunks.append(remaining)
                break
            
            # Find the last space within max_length
            chunk = remaining[:max_length]
            last_space = chunk.rfind(' ')
            
            if last_space > 0:
                # Split at the last space
                chunks.append(remaining[:last_space])
                remaining = remaining[last_space + 1:]
            else:
                # No space found, split at max_length
                chunks.append(remaining[:max_length])
                remaining = remaining[max_length:]
        
        return chunks
        
    def validate_credentials(self, credentials):
        """Validate platform credentials"""
        return True
    
    def validate_post_type(self, post_type):
        """Validate if post type is supported by this platform"""
        return post_type in self.supported_post_types
    
    def get_supported_post_types(self):
        """Get list of supported post types for this platform"""
        return self.supported_post_types
    
    def get_rate_limits(self):
        """Get rate limit information for this platform"""
        return self.rate_limits
    
    def get_post_type_info(self):
        """Get detailed information about supported post types"""
        return [
            {
                'type': post_type,
                'description': self.post_type_descriptions.get(post_type, ''),
                'requirements': self.get_post_type_requirements(post_type),
                'rate_limits': self.rate_limits.get(post_type, {})
            }
            for post_type in self.supported_post_types
        ]
    
    def get_post_type_requirements(self, post_type):
        """Get requirements for a specific post type (can be overridden by subclasses)"""
        return {}
    
    def validate_media_requirements(self, post_type, media):
        """Validate media requirements for post type (can be overridden by subclasses)"""
        return True, None  # Returns (is_valid, error_message)
    
    def optimize_content(self, content, post_type='standard'):
        """Provide content optimization suggestions for the platform"""
        suggestions = []
        requirements = self.get_post_type_requirements(post_type)
        
        # Check length
        if 'max_length' in requirements:
            max_len = requirements['max_length']
            if len(content) > max_len:
                suggestions.append({
                    'type': 'length',
                    'severity': 'error',
                    'message': f'Content exceeds {max_len} character limit ({len(content)} chars)',
                    'suggestion': f'Shorten content by {len(content) - max_len} characters'
                })
            elif len(content) > max_len * 0.9:
                suggestions.append({
                    'type': 'length',
                    'severity': 'warning',
                    'message': f'Content is close to {max_len} character limit ({len(content)} chars)',
                    'suggestion': 'Consider shortening for better readability'
                })
        
        return suggestions
    
    def generate_preview(self, content, media=None, post_type='standard'):
        """Generate a preview of how the post will appear on the platform"""
        preview = {
            'platform': self.platform_name,
            'post_type': post_type,
            'content': content,
            'media_count': len(media) if media else 0,
            'character_count': len(content),
            'estimated_display': content[:100] + '...' if len(content) > 100 else content
        }
        
        requirements = self.get_post_type_requirements(post_type)
        if 'max_length' in requirements:
            preview['character_limit'] = requirements['max_length']
            preview['characters_remaining'] = requirements['max_length'] - len(content)
        
        return preview
    
    def format_post(self, content, media=None, post_type='standard', **kwargs):
        """Format post content for specific platform"""
        # Validate post type
        if not self.validate_post_type(post_type):
            raise ValueError(
                f"Unsupported post type '{post_type}' for {self.platform_name}. "
                f"Supported types: {', '.join(self.supported_post_types)}"
            )
        
        # Validate media requirements
        is_valid, error_msg = self.validate_media_requirements(post_type, media)
        if not is_valid:
            raise ValueError(error_msg)
        
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
    TWEET_MAX_LENGTH = 280
    
    def __init__(self):
        descriptions = {
            'standard': 'Regular tweet with 280 character limit',
            'thread': 'Multi-tweet thread for longer content, automatically split at word boundaries'
        }
        rate_limits = {
            'standard': {'requests_per_hour': 50, 'requests_per_day': 500},
            'thread': {'requests_per_hour': 30, 'requests_per_day': 300}
        }
        super().__init__('twitter', 
                        supported_post_types=['standard', 'thread'],
                        post_type_descriptions=descriptions,
                        rate_limits=rate_limits)
    
    def get_post_type_requirements(self, post_type):
        """Get requirements for Twitter post types"""
        if post_type == 'standard':
            return {
                'max_length': self.TWEET_MAX_LENGTH,
                'media_optional': True,
                'max_media': 4
            }
        elif post_type == 'thread':
            return {
                'max_length_per_tweet': self.TWEET_MAX_LENGTH,
                'auto_split': True,
                'media_optional': True
            }
        return {}
    
    def format_post(self, content, media=None, post_type='standard', **kwargs):
        # Validate post type first
        if not self.validate_post_type(post_type):
            raise ValueError(
                f"Unsupported post type '{post_type}' for {self.platform_name}. "
                f"Supported types: {', '.join(self.supported_post_types)}"
            )
        
        if post_type == 'thread':
            # Split content into tweets for threads at word boundaries
            tweets = self.split_text_at_word_boundaries(content, self.TWEET_MAX_LENGTH)
            
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
            truncated_content = content[:self.TWEET_MAX_LENGTH] if len(content) > self.TWEET_MAX_LENGTH else content
            return {
                'platform': self.platform_name,
                'content': truncated_content,
                'media': media,
                'post_type': post_type
            }


class FacebookAdapter(PlatformAdapter):
    """Facebook adapter supporting Page posts and Reels (Pages only, not personal profiles or groups)"""
    def __init__(self):
        descriptions = {
            'feed_post': 'Standard Facebook Page post (text, images, or videos)',
            'reel': 'Facebook Reel - short-form vertical video (3-90 seconds, 9:16 aspect ratio)'
        }
        rate_limits = {
            'feed_post': {'requests_per_hour': 100, 'requests_per_day': 2000},
            'reel': {'requests_per_hour': 50, 'requests_per_day': 500}
        }
        super().__init__('facebook', 
                        supported_post_types=['feed_post', 'reel'],
                        post_type_descriptions=descriptions,
                        rate_limits=rate_limits)
    
    def get_post_type_requirements(self, post_type):
        """Get requirements for Facebook post types"""
        if post_type == 'feed_post':
            return {
                'target': 'pages_only',
                'media_optional': True,
                'max_text_length': 63206
            }
        elif post_type == 'reel':
            return {
                'target': 'pages_only',
                'media_required': True,
                'media_types': ['video'],
                'min_duration': 3,
                'max_duration': 90,
                'aspect_ratio': '9:16',
                'vertical_only': True
            }
        return {}
    
    def validate_media_requirements(self, post_type, media):
        """Validate media requirements for Facebook post types"""
        if post_type == 'reel':
            if not media or len(media) == 0:
                return False, "Facebook Reels require a video"
            # In a real implementation, would check if media is actually a video
        return True, None
    
    def format_post(self, content, media=None, post_type='feed_post', **kwargs):
        # Validate post type and media
        if not self.validate_post_type(post_type):
            raise ValueError(
                f"Unsupported post type '{post_type}' for {self.platform_name}. "
                f"Supported types: {', '.join(self.supported_post_types)}"
            )
        
        is_valid, error_msg = self.validate_media_requirements(post_type, media)
        if not is_valid:
            raise ValueError(error_msg)
        
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
                'aspect_ratio': '9:16',
                'vertical_only': True
            }
        
        return formatted


class InstagramAdapter(PlatformAdapter):
    """Instagram adapter supporting Feed posts, Reels, Stories, and Carousels"""
    def __init__(self):
        descriptions = {
            'feed_post': 'Standard Instagram post (requires image or video)',
            'reel': 'Short-form vertical video (3-90 seconds, 9:16 aspect ratio)',
            'story': 'Ephemeral 24-hour content (15 seconds, 9:16 aspect ratio)',
            'carousel': 'Multi-image or video post (2-10 items)'
        }
        super().__init__('instagram', 
                        supported_post_types=['feed_post', 'reel', 'story', 'carousel'],
                        post_type_descriptions=descriptions)
    
    def get_post_type_requirements(self, post_type):
        """Get requirements for Instagram post types"""
        base_req = {'media_required': True}
        
        if post_type == 'feed_post':
            return {**base_req, 'media_types': ['image', 'video']}
        elif post_type == 'reel':
            return {
                **base_req,
                'media_types': ['video'],
                'min_duration': 3,
                'max_duration': 90,
                'aspect_ratio': '9:16'
            }
        elif post_type == 'story':
            return {
                **base_req,
                'media_types': ['image', 'video'],
                'duration': 15,
                'aspect_ratio': '9:16',
                'ephemeral': True
            }
        elif post_type == 'carousel':
            return {
                **base_req,
                'media_types': ['image', 'video'],
                'min_items': 2,
                'max_items': 10,
                'mixed_media': True
            }
        return base_req
    
    def validate_media_requirements(self, post_type, media):
        """Validate media requirements for Instagram"""
        if not media or len(media) == 0:
            return False, f"Instagram {post_type} requires media"
        
        if post_type == 'carousel' and len(media) < 2:
            return False, "Instagram carousel requires at least 2 media items"
        
        if post_type == 'carousel' and len(media) > 10:
            return False, "Instagram carousel supports maximum 10 media items"
        
        return True, None
    
    def format_post(self, content, media=None, post_type='feed_post', **kwargs):
        # Validate post type and media
        if not self.validate_post_type(post_type):
            raise ValueError(
                f"Unsupported post type '{post_type}' for {self.platform_name}. "
                f"Supported types: {', '.join(self.supported_post_types)}"
            )
        
        is_valid, error_msg = self.validate_media_requirements(post_type, media)
        if not is_valid:
            raise ValueError(error_msg)
        
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
    MAX_CONTENT_LENGTH = 3000
    
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
        if len(content) > self.MAX_CONTENT_LENGTH:
            formatted['content'] = content[:self.MAX_CONTENT_LENGTH]
            formatted['truncated'] = True
        
        return formatted


class ThreadsAdapter(PlatformAdapter):
    """Threads adapter supporting single posts and thread-style posts"""
    MAX_POST_LENGTH = 500
    
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
            posts = self.split_text_at_word_boundaries(content, self.MAX_POST_LENGTH)
            
            formatted['posts'] = posts
            formatted['thread_length'] = len(posts)
        else:
            # Single post with 500 character limit
            if len(content) > self.MAX_POST_LENGTH:
                formatted['content'] = content[:self.MAX_POST_LENGTH]
                formatted['truncated'] = True
        
        return formatted


class BlueskyAdapter(PlatformAdapter):
    """Bluesky adapter supporting single posts and thread-style posts"""
    MAX_POST_LENGTH = 300
    
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
            posts = self.split_text_at_word_boundaries(content, self.MAX_POST_LENGTH)
            
            formatted['posts'] = posts
            formatted['thread_length'] = len(posts)
        else:
            # Single post with 300 character limit
            if len(content) > self.MAX_POST_LENGTH:
                formatted['content'] = content[:self.MAX_POST_LENGTH]
                formatted['truncated'] = True
        
        return formatted


class YouTubeAdapter(PlatformAdapter):
    """YouTube adapter supporting long-form videos and Shorts"""
    MAX_VIDEO_DURATION = 12 * 60 * 60  # 12 hours in seconds
    
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
                'max_duration': self.MAX_VIDEO_DURATION,
                'supports_chapters': True,
                'supports_end_screens': True
            }
        
        return formatted


class PinterestAdapter(PlatformAdapter):
    """Pinterest adapter supporting Pins and Video Pins"""
    MAX_VIDEO_DURATION = 15 * 60  # 15 minutes in seconds
    
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
                'max_duration': self.MAX_VIDEO_DURATION,
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
    MAX_CAPTION_LENGTH = 2200
    MAX_VIDEO_DURATION = 10 * 60  # 10 minutes in seconds
    
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
                'max_duration': self.MAX_VIDEO_DURATION,
                'aspect_ratio': '9:16',
                'vertical_only': True
            }
        
        # TikTok caption limit
        if len(content) > self.MAX_CAPTION_LENGTH:
            formatted['content'] = content[:self.MAX_CAPTION_LENGTH]
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


def publish_to_single_platform(platform, content, media, credentials, post_type, platform_options):
    """Publish to a single platform (used for parallel execution)"""
    if platform not in PLATFORM_ADAPTERS:
        return {
            'success': False,
            'platform': platform,
            'error': 'Platform adapter not found'
        }
    
    adapter = PLATFORM_ADAPTERS[platform]
    
    try:
        formatted_post = adapter.format_post(
            content, 
            media, 
            post_type=post_type,
            **platform_options
        )
        result = adapter.publish(formatted_post, credentials)
        logger.info(f"Successfully posted to {platform}")
        return result
    except Exception as e:
        logger.error(f"Error posting to {platform}: {str(e)}")
        return {
            'success': False,
            'platform': platform,
            'error': str(e)
        }


def publish_to_platforms(post_id, platforms, content, media, credentials_dict, post_type='standard', post_options=None, parallel=True):
    """Background task to publish to multiple platforms
    
    Args:
        parallel: If True, publish to platforms concurrently for faster execution
    """
    results = []
    post_options = post_options or {}
    start_time = time.time()
    
    if parallel and len(platforms) > 1:
        # Use ThreadPoolExecutor for concurrent publishing
        with ThreadPoolExecutor(max_workers=min(len(platforms), 5)) as executor:
            # Submit all publishing tasks
            future_to_platform = {}
            for platform in platforms:
                if platform in PLATFORM_ADAPTERS:
                    credentials = credentials_dict.get(platform, {})
                    platform_options_dict = post_options.get(platform, {})
                    
                    future = executor.submit(
                        publish_to_single_platform,
                        platform,
                        content,
                        media,
                        credentials,
                        post_type,
                        platform_options_dict
                    )
                    future_to_platform[future] = platform
            
            # Collect results as they complete
            for future in as_completed(future_to_platform):
                platform = future_to_platform[future]
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    logger.error(f"Error in concurrent publishing to {platform}: {str(e)}")
                    results.append({
                        'success': False,
                        'platform': platform,
                        'error': str(e)
                    })
    else:
        # Sequential publishing (original behavior)
        for platform in platforms:
            if platform in PLATFORM_ADAPTERS:
                adapter = PLATFORM_ADAPTERS[platform]
                credentials = credentials_dict.get(platform, {})
                
                try:
                    # Get platform-specific options
                    platform_options_dict = post_options.get(platform, {})
                    formatted_post = adapter.format_post(
                        content, 
                        media, 
                        post_type=post_type,
                        **platform_options_dict
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
    
    execution_time = time.time() - start_time
    
    # Update post status
    if post_id in posts_db:
        posts_db[post_id]['status'] = 'published'
        posts_db[post_id]['results'] = results
        posts_db[post_id]['published_at'] = datetime.now(timezone.utc).isoformat()
        posts_db[post_id]['execution_time_seconds'] = round(execution_time, 2)
        posts_db[post_id]['parallel_execution'] = parallel


@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'service': 'MastaBlasta',
        'version': '1.0.0',
        'timestamp': datetime.now(timezone.utc).isoformat()
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
        'created_at': datetime.now(timezone.utc).isoformat()
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
    
    account['updated_at'] = datetime.now(timezone.utc).isoformat()
    
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
    # Define proper display names for platforms
    display_names = {
        'twitter': 'Twitter/X',
        'facebook': 'Facebook',
        'instagram': 'Instagram',
        'linkedin': 'LinkedIn',
        'threads': 'Threads',
        'bluesky': 'Bluesky',
        'youtube': 'YouTube',
        'pinterest': 'Pinterest',
        'tiktok': 'TikTok'
    }
    
    platforms = []
    for name, adapter in PLATFORM_ADAPTERS.items():
        platforms.append({
            'name': name,
            'display_name': display_names.get(name, name.capitalize()),
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


@app.route('/api/platforms/<platform>/post-types/details', methods=['GET'])
def get_platform_post_types_details(platform):
    """Get detailed information about post types for a specific platform"""
    if platform not in PLATFORM_ADAPTERS:
        return jsonify({'error': f'Invalid platform: {platform}'}), 404
    
    adapter = PLATFORM_ADAPTERS[platform]
    return jsonify({
        'platform': platform,
        'post_types': adapter.get_post_type_info(),
        'rate_limits': adapter.get_rate_limits()
    })


@app.route('/api/post/preview', methods=['POST'])
def preview_post():
    """Generate preview of how post will appear across platforms"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    media = data.get('media', [])
    platforms = data.get('platforms', [])
    post_type = data.get('post_type', 'standard')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    if not platforms:
        return jsonify({'error': 'At least one platform must be specified'}), 400
    
    previews = []
    for platform in platforms:
        if platform in PLATFORM_ADAPTERS:
            adapter = PLATFORM_ADAPTERS[platform]
            try:
                preview = adapter.generate_preview(content, media, post_type)
                previews.append(preview)
            except Exception as e:
                previews.append({
                    'platform': platform,
                    'error': str(e)
                })
    
    return jsonify({
        'previews': previews,
        'count': len(previews)
    })


@app.route('/api/post/optimize', methods=['POST'])
def optimize_post():
    """Get content optimization suggestions for platforms"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    platforms = data.get('platforms', [])
    post_type = data.get('post_type', 'standard')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    if not platforms:
        return jsonify({'error': 'At least one platform must be specified'}), 400
    
    optimizations = {}
    for platform in platforms:
        if platform in PLATFORM_ADAPTERS:
            adapter = PLATFORM_ADAPTERS[platform]
            try:
                suggestions = adapter.optimize_content(content, post_type)
                optimizations[platform] = {
                    'suggestions': suggestions,
                    'has_errors': any(s['severity'] == 'error' for s in suggestions),
                    'has_warnings': any(s['severity'] == 'warning' for s in suggestions)
                }
            except Exception as e:
                optimizations[platform] = {
                    'error': str(e)
                }
    
    return jsonify({
        'optimizations': optimizations,
        'overall_status': 'error' if any(o.get('has_errors') for o in optimizations.values()) else 'ok'
    })


@app.route('/api/schedule/conflicts', methods=['POST'])
def check_schedule_conflicts():
    """Check for scheduling conflicts and optimal posting times"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    scheduled_time = data.get('scheduled_time')
    platforms = data.get('platforms', [])
    
    if not scheduled_time:
        return jsonify({'error': 'Scheduled time is required'}), 400
    
    if not platforms:
        return jsonify({'error': 'At least one platform must be specified'}), 400
    
    # Parse scheduled time
    try:
        scheduled_time_normalized = scheduled_time.replace('Z', '+00:00')
        scheduled_dt = datetime.fromisoformat(scheduled_time_normalized)
    except ValueError:
        return jsonify({'error': 'Invalid scheduled_time format'}), 400
    
    # Check for conflicts with existing scheduled posts
    conflicts = []
    time_window = timedelta(minutes=5)
    
    for post_id, post in posts_db.items():
        if post.get('status') == 'scheduled' and post.get('scheduled_for'):
            existing_time = datetime.fromisoformat(post['scheduled_for'].replace('Z', '+00:00'))
            time_diff = abs((scheduled_dt - existing_time).total_seconds())
            
            # Check if within 5 minute window and shares platforms
            if time_diff < time_window.total_seconds():
                shared_platforms = set(platforms) & set(post.get('platforms', []))
                if shared_platforms:
                    conflicts.append({
                        'post_id': post_id,
                        'scheduled_for': post['scheduled_for'],
                        'shared_platforms': list(shared_platforms),
                        'time_difference_seconds': time_diff
                    })
    
    # Generate optimal time suggestions (simple heuristic)
    suggestions = []
    if conflicts:
        # Suggest times around the conflicts
        suggestions.append({
            'time': (scheduled_dt + timedelta(minutes=10)).isoformat(),
            'reason': 'Avoids scheduling conflicts'
        })
        suggestions.append({
            'time': (scheduled_dt - timedelta(minutes=10)).isoformat(),
            'reason': 'Avoids scheduling conflicts (earlier)'
        })
    
    return jsonify({
        'has_conflicts': len(conflicts) > 0,
        'conflicts': conflicts,
        'conflict_count': len(conflicts),
        'suggestions': suggestions
    })


# ==================== AI-Enhanced Endpoints ====================

@app.route('/api/ai/generate-caption', methods=['POST'])
def ai_generate_caption():
    """Generate AI-powered caption for a topic and platform"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    topic = data.get('topic', '')
    platform = data.get('platform', 'twitter')
    tone = data.get('tone', 'professional')
    
    if not topic:
        return jsonify({'error': 'Topic is required'}), 400
    
    result = ai_content_generator.generate_caption(topic, platform, tone)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/suggest-hashtags', methods=['POST'])
def ai_suggest_hashtags():
    """Generate AI-powered hashtag suggestions"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    platform = data.get('platform', 'twitter')
    count = data.get('count', 5)
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    result = ai_content_generator.suggest_hashtags(content, platform, count)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/rewrite-content', methods=['POST'])
def ai_rewrite_content():
    """Rewrite content for a different platform using AI"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    source_platform = data.get('source_platform', 'twitter')
    target_platform = data.get('target_platform', 'instagram')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    result = ai_content_generator.rewrite_for_platform(content, source_platform, target_platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/best-times', methods=['POST'])
def ai_best_posting_times():
    """Get AI-powered best posting times for a platform"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    platform = data.get('platform', 'twitter')
    historical_data = data.get('historical_data', [])
    
    result = intelligent_scheduler.analyze_best_times(platform, historical_data)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/predict-engagement', methods=['POST'])
def ai_predict_engagement():
    """Predict engagement for a post using AI"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    platform = data.get('platform', 'twitter')
    scheduled_time = data.get('scheduled_time', '12:00')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    result = intelligent_scheduler.predict_engagement(content, platform, scheduled_time)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/posting-frequency', methods=['POST'])
def ai_posting_frequency():
    """Get AI-powered posting frequency recommendations"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    platform = data.get('platform', 'twitter')
    content_type = data.get('content_type', 'standard')
    
    result = intelligent_scheduler.suggest_frequency(platform, content_type)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/optimize-image', methods=['POST'])
def ai_optimize_image():
    """Optimize image for specific platform using AI"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    image_data = data.get('image_data', '')
    platform = data.get('platform', 'instagram')
    
    if not image_data:
        return jsonify({'error': 'Image data is required'}), 400
    
    result = image_enhancer.optimize_for_platform(image_data, platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/enhance-image', methods=['POST'])
def ai_enhance_image():
    """Enhance image quality using AI"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    image_data = data.get('image_data', '')
    enhancement_level = data.get('enhancement_level', 'medium')
    
    if not image_data:
        return jsonify({'error': 'Image data is required'}), 400
    
    result = image_enhancer.enhance_quality(image_data, enhancement_level)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/generate-alt-text', methods=['POST'])
def ai_generate_alt_text():
    """Generate alt text for image accessibility"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    image_data = data.get('image_data', '')
    
    if not image_data:
        return jsonify({'error': 'Image data is required'}), 400
    
    result = image_enhancer.generate_alt_text(image_data)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/predict-performance', methods=['POST'])
def ai_predict_performance():
    """Predict post performance before publishing"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    media = data.get('media', [])
    scheduled_time = data.get('scheduled_time', '12:00')
    platform = data.get('platform', 'twitter')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    result = engagement_predictor.predict_performance(content, media, scheduled_time, platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/compare-variations', methods=['POST'])
def ai_compare_variations():
    """Compare predicted performance of multiple post variations"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    variations = data.get('variations', [])
    
    if not variations or len(variations) < 2:
        return jsonify({'error': 'At least 2 variations are required'}), 400
    
    result = engagement_predictor.compare_variations(variations)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/train-model', methods=['POST'])
def ai_train_model():
    """Train engagement prediction model on historical data"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    historical_posts = data.get('historical_posts', [])
    
    if not historical_posts or len(historical_posts) < 20:
        return jsonify({'error': 'At least 20 historical posts required for training'}), 400
    
    result = engagement_predictor.train_model(historical_posts)
    
    if not result.get('success'):
        return jsonify(result), 500
    
    return jsonify(result)


@app.route('/api/ai/status', methods=['GET'])
def ai_status():
    """Get status of AI services"""
    return jsonify({
        'ai_enabled': AI_ENABLED,
        # Legacy fields for backwards compatibility
        'openai': AI_ENABLED,
        'pillow': True,  # PIL/Pillow is always available
        'sklearn': AI_ENABLED,
        'services': {
            'content_generation': {
                'enabled': ai_content_generator.enabled,
                'features': ['caption_generation', 'hashtag_suggestions', 'content_rewriting']
            },
            'intelligent_scheduling': {
                'enabled': intelligent_scheduler.enabled,
                'features': ['best_times', 'engagement_prediction', 'frequency_recommendations']
            },
            'image_enhancement': {
                'enabled': image_enhancer.enabled,
                'features': ['platform_optimization', 'quality_enhancement', 'alt_text_generation']
            },
            'image_generation': {
                'enabled': ai_image_generator.enabled,
                'features': ['post_images', 'video_thumbnails', 'video_content_images', 'image_variations'],
                'styles': list(ai_image_generator.IMAGE_STYLES.keys())
            },
            'predictive_analytics': {
                'enabled': engagement_predictor.enabled,
                'trained': engagement_predictor.trained,
                'features': ['performance_prediction', 'variation_comparison', 'model_training']
            },
            'viral_intelligence': {
                'enabled': viral_intelligence.enabled,
                'features': ['viral_hooks', 'virality_score', 'platform_best_practices', 'trending_analysis'],
                'hook_categories': list(viral_intelligence.VIRAL_HOOKS.keys())
            },
            'content_multiplier': {
                'enabled': content_multiplier.enabled,
                'features': ['multi_platform_generation', 'content_variations', 'brand_voice_adaptation']
            },
            'video_generation': {
                'enabled': ai_video_generator.enabled,
                'features': ['script_generation', 'slideshow_creation', 'text_to_video_prompts', 'caption_generation', 'platform_optimization', 'template_library', 'ffmpeg_rendering'],
                'templates': list(ai_video_generator.VIDEO_TEMPLATES.keys())
            }
        },
        'setup_required': not ai_content_generator.enabled and AI_ENABLED,
        'api_key_status': 'configured' if os.getenv('OPENAI_API_KEY') else 'not_configured'
    })


@app.route('/api/viral/hooks', methods=['GET'])
def viral_get_hooks():
    """Get viral hooks library"""
    category = request.args.get('category')
    count = int(request.args.get('count', 5))
    
    result = viral_intelligence.get_viral_hooks(category, count)
    
    if not result.get('success'):
        return jsonify(result), 404
    
    return jsonify(result)


@app.route('/api/viral/predict-score', methods=['POST'])
def viral_predict_score():
    """Predict virality score for content"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    platform = data.get('platform', 'instagram')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    result = viral_intelligence.predict_virality_score(content, platform)
    
    return jsonify(result)


@app.route('/api/viral/best-practices/<platform>', methods=['GET'])
def viral_best_practices(platform):
    """Get platform-specific viral best practices"""
    result = viral_intelligence.get_platform_best_practices(platform)
    
    if not result.get('success'):
        return jsonify(result), 404
    
    return jsonify(result)


@app.route('/api/content/multiply', methods=['POST'])
def content_multiply():
    """Multiply content across platforms"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    source_content = data.get('source_content', '')
    source_type = data.get('source_type', 'text')
    target_platforms = data.get('target_platforms', ['twitter', 'linkedin', 'instagram'])
    brand_voice = data.get('brand_voice', 'professional')
    
    if not source_content:
        return jsonify({'error': 'Source content is required'}), 400
    
    result = content_multiplier.multiply_content(source_content, source_type, target_platforms, brand_voice)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/content/variations', methods=['POST'])
def content_variations():
    """Generate content variations for A/B testing"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    content = data.get('content', '')
    num_variations = data.get('num_variations', 3)
    platform = data.get('platform', 'twitter')
    
    if not content:
        return jsonify({'error': 'Content is required'}), 400
    
    result = content_multiplier.generate_content_variations(content, num_variations, platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/generate-image', methods=['POST'])
def ai_generate_image():
    """Generate an AI image using DALL-E"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    prompt = data.get('prompt', '')
    style = data.get('style', 'photorealistic')
    size = data.get('size', '1024x1024')
    platform = data.get('platform')
    
    if not prompt:
        return jsonify({'error': 'Prompt is required'}), 400
    
    result = ai_image_generator.generate_image(prompt, style, size, platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/generate-post-image', methods=['POST'])
def ai_generate_post_image():
    """Generate an image optimized for social media post"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    post_content = data.get('content', '')
    platform = data.get('platform', 'instagram')
    style = data.get('style', 'modern')
    include_text_space = data.get('include_text_space', True)
    
    if not post_content:
        return jsonify({'error': 'Post content is required'}), 400
    
    result = ai_image_generator.generate_post_image(post_content, platform, style, include_text_space)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/generate-video-thumbnail', methods=['POST'])
def ai_generate_video_thumbnail():
    """Generate a thumbnail image for video content"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_topic = data.get('topic', '')
    video_type = data.get('video_type', 'product_showcase')
    platform = data.get('platform', 'youtube')
    style = data.get('style', 'cinematic')
    
    if not video_topic:
        return jsonify({'error': 'Video topic is required'}), 400
    
    result = ai_image_generator.generate_video_thumbnail(video_topic, video_type, platform, style)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/generate-video-images', methods=['POST'])
def ai_generate_video_images():
    """Generate multiple images for video creation based on script"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_script = data.get('script', '')
    num_images = data.get('num_images', 4)
    style = data.get('style', 'cinematic')
    platform = data.get('platform', 'instagram')
    
    if not video_script:
        return jsonify({'error': 'Video script is required'}), 400
    
    result = ai_image_generator.generate_images_for_video(video_script, num_images, style, platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/create-image-variations', methods=['POST'])
def ai_create_image_variations():
    """Create variations of an existing image"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    image_data = data.get('image_data', '')
    num_variations = data.get('num_variations', 3)
    
    if not image_data:
        return jsonify({'error': 'Image data is required'}), 400
    
    result = ai_image_generator.create_image_variations(image_data, num_variations)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/generate-video-script', methods=['POST'])
def ai_generate_video_script():
    """Generate a video script optimized for platform and duration"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    topic = data.get('topic', '')
    platform = data.get('platform', 'instagram')
    duration = data.get('duration', 30)
    style = data.get('style', 'engaging')
    
    if not topic:
        return jsonify({'error': 'Topic is required'}), 400
    
    result = ai_video_generator.generate_video_script(topic, platform, duration, style)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/create-slideshow', methods=['POST'])
def ai_create_slideshow():
    """Create a slideshow video from images"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    images = data.get('images', [])
    duration_per_image = data.get('duration_per_image', 3.0)
    platform = data.get('platform', 'instagram')
    post_type = data.get('post_type', 'reel')
    transition = data.get('transition', 'fade')
    
    if not images:
        return jsonify({'error': 'At least one image is required'}), 400
    
    result = ai_video_generator.create_slideshow_video(
        images, duration_per_image, platform, post_type, transition
    )
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 400
    
    return jsonify(result)


@app.route('/api/ai/generate-video-prompt', methods=['POST'])
def ai_generate_video_prompt():
    """Generate text-to-video prompt for AI video generation tools"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    text = data.get('text', '')
    platform = data.get('platform', 'instagram')
    post_type = data.get('post_type', 'reel')
    style = data.get('style', 'professional')
    
    if not text:
        return jsonify({'error': 'Text is required'}), 400
    
    result = ai_video_generator.generate_text_to_video_prompt(text, platform, post_type, style)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/generate-video-captions', methods=['POST'])
def ai_generate_video_captions():
    """Generate optimized captions for video content"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_content = data.get('content', '')
    platform = data.get('platform', 'instagram')
    language = data.get('language', 'en')
    
    if not video_content:
        return jsonify({'error': 'Video content is required'}), 400
    
    result = ai_video_generator.generate_video_captions(video_content, platform, language)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/ai/optimize-video', methods=['POST'])
def ai_optimize_video():
    """Get optimization specifications for video based on platform"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_path = data.get('video_path', 'input.mp4')
    platform = data.get('platform', 'instagram')
    post_type = data.get('post_type', 'reel')
    
    result = ai_video_generator.optimize_video_for_platform(video_path, platform, post_type)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 400
    
    return jsonify(result)


@app.route('/api/ai/video-specs/<platform>', methods=['GET'])
def ai_video_specs(platform):
    """Get all video specifications for a platform"""
    result = ai_video_generator.get_platform_video_specs(platform)
    
    if not result.get('success'):
        return jsonify(result), 404
    
    return jsonify(result)


@app.route('/api/ai/video-templates', methods=['GET'])
def ai_video_templates():
    """Get all available video templates"""
    result = ai_video_generator.get_video_templates()
    return jsonify(result)


@app.route('/api/ai/video-templates/<template_id>', methods=['GET'])
def ai_get_video_template(template_id):
    """Get a specific video template"""
    result = ai_video_generator.get_template(template_id)
    
    if not result.get('success'):
        return jsonify(result), 404
    
    return jsonify(result)


@app.route('/api/ai/generate-from-template', methods=['POST'])
def ai_generate_from_template():
    """Generate video script using a template"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    template_id = data.get('template_id', '')
    topic = data.get('topic', '')
    platform = data.get('platform', 'instagram')
    
    if not template_id:
        return jsonify({'error': 'template_id is required'}), 400
    
    if not topic:
        return jsonify({'error': 'topic is required'}), 400
    
    result = ai_video_generator.generate_from_template(template_id, topic, platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 400
    
    return jsonify(result)


@app.route('/api/ai/render-slideshow', methods=['POST'])
def ai_render_slideshow():
    """Render slideshow video with FFmpeg (actual video file generation)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    images = data.get('images', [])
    duration_per_image = data.get('duration_per_image', 3.0)
    platform = data.get('platform', 'instagram')
    post_type = data.get('post_type', 'reel')
    transition = data.get('transition', 'fade')
    output_path = data.get('output_path', '/tmp/output_video.mp4')
    
    if not images:
        return jsonify({'error': 'At least one image is required'}), 400
    
    # Get platform specs
    specs = ai_video_generator.platform_specs.get(platform, {}).get(post_type)
    
    if not specs:
        return jsonify({
            'error': f'Unknown platform/post type: {platform}/{post_type}',
            'success': False
        }), 400
    
    result = ai_video_generator.render_slideshow_with_ffmpeg(
        images, duration_per_image, output_path, specs, transition
    )
    
    if not result.get('success'):
        return jsonify(result), 503 if 'FFmpeg not installed' in result.get('error', '') else 500
    
    return jsonify(result)


@app.route('/api/video/generate-subtitles', methods=['POST'])
def video_generate_subtitles():
    """Generate subtitle file from script (Faceless Video #1)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    duration = data.get('duration', 30)
    output_format = data.get('format', 'srt')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_subtitle_file(script, duration, output_format)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/video/convert-aspect-ratio', methods=['POST'])
def video_convert_aspect_ratio():
    """Convert video aspect ratio (Faceless Video #2)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    input_specs = data.get('input_specs', {})
    target_ratio = data.get('target_ratio', '16:9')
    
    result = ai_video_generator.convert_aspect_ratio(input_specs, target_ratio)
    
    if not result.get('success'):
        return jsonify(result), 400
    
    return jsonify(result)


@app.route('/api/video/generate-voiceover-script', methods=['POST'])
def video_generate_voiceover_script():
    """Generate voiceover-ready script (Faceless Video #3)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    language = data.get('language', 'en')
    voice_style = data.get('voice_style', 'professional')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_voiceover_script(script, language, voice_style)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


# ===== AI VOICEOVER IMPROVEMENTS API ENDPOINTS (10 Features) =====

@app.route('/api/voiceover/supported-languages', methods=['GET'])
def voiceover_supported_languages():
    """Get list of 60 supported languages (Voiceover Improvement #1)"""
    result = ai_video_generator.get_supported_languages()
    return jsonify(result)


@app.route('/api/voiceover/pronunciation-guide', methods=['POST'])
def voiceover_pronunciation_guide():
    """Generate pronunciation guide (Voiceover Improvement #2)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    language = data.get('language', 'en')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_pronunciation_guide(script, language)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/voiceover/emotion-markers', methods=['POST'])
def voiceover_emotion_markers():
    """Add emotion and tone markers (Voiceover Improvement #3)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    video_type = data.get('video_type', 'general')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_emotion_markers(script, video_type)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/voiceover/multi-voice-script', methods=['POST'])
def voiceover_multi_voice_script():
    """Generate multi-voice script (Voiceover Improvement #4)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    num_voices = data.get('num_voices', 2)
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    if num_voices < 2 or num_voices > 5:
        return jsonify({'error': 'Number of voices must be between 2 and 5'}), 400
    
    result = ai_video_generator.generate_multi_voice_script(script, num_voices)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/voiceover/breath-marks', methods=['POST'])
def voiceover_breath_marks():
    """Add breath marks and pacing (Voiceover Improvement #5)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    style = data.get('style', 'natural')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_breath_marks(script, style)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/voiceover/duration-estimate', methods=['POST'])
def voiceover_duration_estimate():
    """Estimate voiceover duration (Voiceover Improvement #6)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    language = data.get('language', 'en')
    speech_rate = data.get('speech_rate', 'normal')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.estimate_voiceover_duration(script, language, speech_rate)
    
    return jsonify(result)


@app.route('/api/voiceover/accent-guidance', methods=['POST'])
def voiceover_accent_guidance():
    """Generate accent guidance (Voiceover Improvement #7)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    target_accent = data.get('target_accent', 'neutral')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_accent_guidance(script, target_accent)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/voiceover/tts-config', methods=['POST'])
def voiceover_tts_config():
    """Generate TTS provider config (Voiceover Improvement #8)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    language = data.get('language', 'en')
    provider = data.get('provider', 'elevenlabs')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_tts_config(script, language, provider)
    
    return jsonify(result)


@app.route('/api/voiceover/music-sync', methods=['POST'])
def voiceover_music_sync():
    """Generate background music sync (Voiceover Improvement #9)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    music_style = data.get('music_style', 'corporate')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_background_music_sync(script, music_style)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/voiceover/quality-check', methods=['POST'])
def voiceover_quality_check():
    """Analyze script quality (Voiceover Improvement #10)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    language = data.get('language', 'en')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_voiceover_quality_check(script, language)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/video/broll-suggestions', methods=['POST'])
def video_broll_suggestions():
    """Generate B-roll footage suggestions (Faceless Video #4)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    video_type = data.get('video_type', 'general')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_broll_suggestions(script, video_type)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/video/batch-create', methods=['POST'])
def video_batch_create():
    """Batch video creation from data (Faceless Video #5)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    batch_data = data.get('batch_data', [])
    template_id = data.get('template_id', 'product_showcase')
    platform = data.get('platform', 'instagram')
    
    if not batch_data:
        return jsonify({'error': 'Batch data is required'}), 400
    
    result = ai_video_generator.create_batch_videos(batch_data, template_id, platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/video/add-watermark', methods=['POST'])
def video_add_watermark():
    """Add brand watermark to video (Faceless Video #6)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    video_specs = data.get('video_specs', {})
    watermark_config = data.get('watermark_config', {})
    
    result = ai_video_generator.add_brand_watermark(video_specs, watermark_config)
    
    return jsonify(result)


@app.route('/api/video/generate-intro-outro', methods=['POST'])
def video_generate_intro_outro():
    """Generate intro/outro templates (Faceless Video #7)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    brand_name = data.get('brand_name', '')
    style = data.get('style', 'modern')
    
    if not brand_name:
        return jsonify({'error': 'Brand name is required'}), 400
    
    result = ai_video_generator.generate_intro_outro(brand_name, style)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/video/text-overlays', methods=['POST'])
def video_text_overlays():
    """Generate text overlay sequence (Faceless Video #8)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    key_points = data.get('key_points', [])
    style = data.get('style', 'bold')
    
    if not key_points:
        return jsonify({'error': 'Key points are required'}), 400
    
    result = ai_video_generator.generate_text_overlay_sequence(key_points, style)
    
    return jsonify(result)


@app.route('/api/video/multi-platform-export', methods=['POST'])
def video_multi_platform_export():
    """Generate multi-platform export specs (Faceless Video #9)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    source_video_specs = data.get('source_video_specs', {})
    
    result = ai_video_generator.optimize_for_multiple_platforms(source_video_specs)
    
    return jsonify(result)


@app.route('/api/video/analytics-metadata', methods=['POST'])
def video_analytics_metadata():
    """Generate analytics metadata for video (Faceless Video #10)"""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    script = data.get('script', '')
    platform = data.get('platform', 'youtube')
    
    if not script:
        return jsonify({'error': 'Script is required'}), 400
    
    result = ai_video_generator.generate_video_analytics_metadata(script, platform)
    
    if not result.get('success'):
        return jsonify(result), 503 if 'enabled' in result else 500
    
    return jsonify(result)


@app.route('/api/oauth/init/<platform>', methods=['GET'])
def oauth_init(platform):
    """Initialize OAuth flow for a platform"""
    if platform not in PLATFORM_ADAPTERS:
        return jsonify({'error': f'Invalid platform: {platform}'}), 400
    
    # Try to use real OAuth implementation from oauth.py
    try:
        from oauth import (
            TwitterOAuth, MetaOAuth, LinkedInOAuth, GoogleOAuth,
            TWITTER_CLIENT_ID, META_APP_ID, LINKEDIN_CLIENT_ID, GOOGLE_CLIENT_ID
        )
        
        state_token = str(uuid.uuid4())
        oauth_states[state_token] = {
            'platform': platform,
            'created_at': datetime.now(timezone.utc).isoformat()
        }
        
        # Map platform names to OAuth classes and check if credentials are configured
        oauth_config = {
            'twitter': (TwitterOAuth, TWITTER_CLIENT_ID),
            'facebook': (MetaOAuth, META_APP_ID),
            'instagram': (MetaOAuth, META_APP_ID),
            'linkedin': (LinkedInOAuth, LINKEDIN_CLIENT_ID),
            'youtube': (GoogleOAuth, GOOGLE_CLIENT_ID),
        }
        
        if platform in oauth_config:
            oauth_class, client_id = oauth_config[platform]
            
            if client_id:
                # Real OAuth is configured
                if platform == 'twitter':
                    auth_data = oauth_class.get_authorization_url(state_token)
                    oauth_url = auth_data['authorization_url']
                    oauth_states[state_token]['code_verifier'] = auth_data['code_verifier']
                elif platform in ['facebook', 'instagram']:
                    oauth_url = oauth_class.get_authorization_url(state_token)
                elif platform == 'linkedin':
                    oauth_url = oauth_class.get_authorization_url(state_token)
                elif platform == 'youtube':
                    oauth_url = oauth_class.get_authorization_url(state_token)
                
                return jsonify({
                    'oauth_url': oauth_url,
                    'state': state_token,
                    'platform': platform,
                    'mode': 'real'
                })
    except Exception as e:
        logger.warning(f"Real OAuth not available for {platform}: {e}")
    
    # Fallback to demo mode with helpful error message
    return jsonify({
        'error': 'OAuth not configured',
        'message': f'Please configure OAuth credentials for {platform}. See PLATFORM_SETUP.md for instructions.',
        'platform': platform,
        'mode': 'demo',
        'required_env_vars': OAUTH_REQUIRED_ENV_VARS.get(platform, [])
    }), 400


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
        error_description = request.args.get('error_description', '')
        return f"""
        <html>
            <body>
                <script>
                    window.opener.postMessage({{
                        type: 'oauth_error',
                        platform: '{platform}',
                        error: '{error}: {error_description}'
                    }}, '*');
                    window.close();
                </script>
                <p>Authorization failed: {error}. This window should close automatically.</p>
            </body>
        </html>
        """
    
    # Try to use real OAuth token exchange
    account_data = None
    try:
        from oauth import TwitterOAuth, MetaOAuth, LinkedInOAuth, GoogleOAuth
        
        # Verify state token
        state_data = oauth_states.get(state)
        if not state_data or state_data['platform'] != platform:
            raise ValueError('Invalid state token')
        
        # Exchange code for token based on platform
        if platform == 'twitter':
            code_verifier = state_data.get('code_verifier')
            if code_verifier:
                token_data = TwitterOAuth.exchange_code_for_token(code, code_verifier)
                if token_data:
                    account_data = {
                        'code': code,
                        'state': state,
                        'platform': platform,
                        'username': 'twitter_user',
                        'access_token': token_data['access_token'],
                        'refresh_token': token_data.get('refresh_token'),
                        'token_type': 'Bearer'
                    }
        elif platform in ['facebook', 'instagram']:
            token_data = MetaOAuth.exchange_code_for_token(code)
            if token_data:
                account_data = {
                    'code': code,
                    'state': state,
                    'platform': platform,
                    'username': f'{platform}_user',
                    'access_token': token_data['access_token'],
                    'token_type': 'Bearer'
                }
        elif platform == 'linkedin':
            token_data = LinkedInOAuth.exchange_code_for_token(code)
            if token_data:
                account_data = {
                    'code': code,
                    'state': state,
                    'platform': platform,
                    'username': 'linkedin_user',
                    'access_token': token_data['access_token'],
                    'token_type': 'Bearer'
                }
        elif platform == 'youtube':
            token_data = GoogleOAuth.exchange_code_for_token(code)
            if token_data:
                account_data = {
                    'code': code,
                    'state': state,
                    'platform': platform,
                    'username': 'youtube_user',
                    'access_token': token_data['access_token'],
                    'refresh_token': token_data.get('refresh_token'),
                    'token_type': 'Bearer'
                }
        
        # Clean up state token
        if state in oauth_states:
            del oauth_states[state]
            
    except Exception as e:
        logger.error(f"OAuth token exchange failed for {platform}: {e}")
    
    # Fallback to demo mode if real OAuth failed
    if not account_data:
        logger.warning(f"Using demo OAuth for {platform}")
        account_data = {
            'code': code,
            'state': state,
            'platform': platform,
            'username': f'demo_user_{platform}',
            'access_token': f'demo_token_{uuid.uuid4()}',
            'token_type': 'Bearer',
            'demo_mode': True
        }
    
    # Return HTML that posts message to opener window and closes popup
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
        'created_at': datetime.now(timezone.utc).isoformat(),
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


@app.route('/api/connection/health/<account_id>', methods=['GET'])
def check_connection_health(account_id):
    """Check the health status of a platform connection"""
    try:
        from oauth import ConnectionHealthMonitor
        
        account = accounts_db.get(account_id)
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        platform = account.get('platform', '')
        credentials = account.get('credentials', {})
        access_token = credentials.get('access_token', '')
        
        # Get token expiration if available
        expires_at = account.get('token_expires_at')
        if expires_at and isinstance(expires_at, str):
            try:
                # Handle both with and without timezone info
                if expires_at.endswith('Z'):
                    expires_at = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
                else:
                    expires_at = datetime.fromisoformat(expires_at)
            except ValueError:
                expires_at = None  # If parsing fails, set to None
        
        status = ConnectionHealthMonitor.check_connection_status(platform, access_token, expires_at)
        
        return jsonify(status)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/reconnect-instructions/<platform>', methods=['GET'])
def get_reconnection_instructions(platform):
    """Get instructions for reconnecting a platform"""
    try:
        from oauth import ConnectionHealthMonitor
        
        instructions = ConnectionHealthMonitor.get_reconnection_instructions(platform)
        return jsonify(instructions)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/validate/<account_id>', methods=['POST'])
def validate_account(account_id):
    """Validate account setup and permissions"""
    try:
        from oauth import PlatformAccountValidator
        
        account = accounts_db.get(account_id)
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        platform = account.get('platform', '')
        credentials = account.get('credentials', {})
        access_token = credentials.get('access_token', '')
        
        validation = PlatformAccountValidator.validate_account_setup(platform, access_token)
        return jsonify(validation)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/check-permissions/<account_id>', methods=['GET'])
def check_permissions(account_id):
    """Check what permissions are granted for an account"""
    try:
        from oauth import PlatformAccountValidator
        
        account = accounts_db.get(account_id)
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        platform = account.get('platform', '')
        credentials = account.get('credentials', {})
        access_token = credentials.get('access_token', '')
        
        permissions = PlatformAccountValidator.check_permissions(platform, access_token)
        return jsonify(permissions)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/quick-connect/options', methods=['GET'])
def get_quick_connect_options():
    """Get all available quick connect platform options"""
    try:
        from oauth import QuickConnectWizard
        
        options = QuickConnectWizard.get_quick_connect_options()
        return jsonify(options)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/quick-connect/<platform>', methods=['POST'])
def quick_connect_platform(platform):
    """Start quick connect flow for a platform"""
    try:
        from oauth import QuickConnectWizard
        import secrets
        
        user_id = request.json.get('user_id', 'default_user')
        state = secrets.token_urlsafe(32)
        
        wizard = QuickConnectWizard()
        connection_data = wizard.generate_connection_url(platform, state, user_id)
        
        return jsonify(connection_data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/troubleshoot', methods=['POST'])
def troubleshoot_connection():
    """Diagnose connection issues and provide solutions"""
    try:
        from oauth import ConnectionTroubleshooter
        
        data = request.get_json()
        platform = data.get('platform', '')
        error_code = data.get('error_code')
        error_message = data.get('error_message')
        
        if not platform:
            return jsonify({'error': 'Platform is required'}), 400
        
        diagnosis = ConnectionTroubleshooter.diagnose_connection_issue(platform, error_code, error_message)
        return jsonify(diagnosis)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/test-prerequisites/<platform>', methods=['GET'])
def test_connection_prerequisites(platform):
    """Test if all prerequisites are met for connecting a platform"""
    try:
        from oauth import ConnectionTroubleshooter
        
        test_results = ConnectionTroubleshooter.test_connection_prerequisites(platform)
        return jsonify(test_results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/bulk-connect/prepare', methods=['POST'])
def prepare_bulk_connection():
    """Prepare to connect multiple platforms in sequence"""
    try:
        from oauth import BulkConnectionManager
        
        data = request.get_json()
        platforms = data.get('platforms', [])
        user_id = data.get('user_id', 'default_user')
        
        if not platforms:
            return jsonify({'error': 'Platforms list is required'}), 400
        
        result = BulkConnectionManager.prepare_bulk_connection(platforms, user_id)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/connection/auto-refresh/<account_id>', methods=['POST'])
def auto_refresh_token(account_id):
    """Automatically refresh token if needed"""
    try:
        from oauth import AutoReconnectionService
        
        account = accounts_db.get(account_id)
        if not account:
            return jsonify({'error': 'Account not found'}), 404
        
        platform = account.get('platform', '')
        
        account_data = {
            'token_expires_at': account.get('token_expires_at'),
            'refresh_token': account.get('refresh_token')
        }
        
        result = AutoReconnectionService.auto_refresh_if_needed(platform, account_data)
        
        # If token was refreshed, update the account
        if result['refreshed'] and result.get('expires_at'):
            account['credentials']['access_token'] = result['new_token']
            account['token_expires_at'] = result['expires_at'].isoformat()
            accounts_db[account_id] = account
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
    
    # Validate post type for each platform
    validation_errors = []
    for platform in set(platforms):  # Use set to check unique platforms
        adapter = PLATFORM_ADAPTERS[platform]
        if not adapter.validate_post_type(post_type):
            validation_errors.append(
                f"{platform}: unsupported post type '{post_type}' "
                f"(supported: {', '.join(adapter.get_supported_post_types())})"
            )
    
    if validation_errors:
        return jsonify({
            'error': 'Post type validation failed',
            'details': validation_errors
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
        'created_at': datetime.now(timezone.utc).isoformat(),
        'scheduled_for': None
    }
    
    posts_db[post_id] = post_record
    
    # Publish immediately (use parallel execution if multiple platforms)
    parallel = data.get('parallel_execution', True)  # Enable by default
    publish_to_platforms(post_id, platforms, content, media, credentials, post_type, post_options, parallel=parallel)
    
    return jsonify({
        'success': True,
        'post_id': post_id,
        'message': 'Post is being published',
        'parallel_execution': parallel,
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
    
    # Validate post type for each platform
    validation_errors = []
    for platform in set(platforms):  # Use set to check unique platforms
        adapter = PLATFORM_ADAPTERS[platform]
        if not adapter.validate_post_type(post_type):
            validation_errors.append(
                f"{platform}: unsupported post type '{post_type}' "
                f"(supported: {', '.join(adapter.get_supported_post_types())})"
            )
    
    if validation_errors:
        return jsonify({
            'error': 'Post type validation failed',
            'details': validation_errors
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
        'created_at': datetime.now(timezone.utc).isoformat(),
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
        'created_at': datetime.now(timezone.utc).isoformat(),
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
        'timestamp': datetime.now(timezone.utc).isoformat(),
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
        'created_at': datetime.now(timezone.utc).isoformat()
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
                    'timestamp': (datetime.now(timezone.utc) - timedelta(hours=random.randint(0, 48))).isoformat(),
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
    
    monitor['updated_at'] = datetime.now(timezone.utc).isoformat()
    
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
            'last_updated': datetime.now(timezone.utc).isoformat()
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
                    scheduled_dt = datetime.now(timezone.utc) + timedelta(minutes=len(created_posts) * 5)
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
                    'created_at': datetime.now(timezone.utc).isoformat(),
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
                    'created_at': datetime.now(timezone.utc).isoformat(),
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
        'created_at': datetime.now(timezone.utc).isoformat(),
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
            'createdAt': datetime.now(timezone.utc).isoformat() + 'Z'
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
        'created_at': datetime.now(timezone.utc).isoformat(),
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
    version['published_at'] = datetime.now(timezone.utc).isoformat()
    
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
            'created_at': datetime.now(timezone.utc).isoformat()
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
        template['updated_at'] = datetime.now(timezone.utc).isoformat()
        
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
            'timestamp': datetime.now(timezone.utc).isoformat(),
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
