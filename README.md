# MastaBlasta
A production-ready multi-platform social media posting service that allows easy posting to multiple social media platforms at once.

## 🚀 Production-Ready Features

**MastaBlasta now includes enterprise-grade infrastructure for production deployment:**

1. **💾 PostgreSQL Database** - Full data persistence with 15+ models
2. **🔐 Real OAuth** - Actual Twitter, Facebook, Instagram, LinkedIn, YouTube integrations
3. **📤 Media Management** - Direct file uploads with thumbnails and optimization
4. **🔒 JWT Authentication** - Secure user accounts with role-based access control
5. **📊 Real Analytics** - Actual metrics from platform APIs
6. **🔔 Webhook System** - Event notifications with retry logic
7. **🔍 Advanced Search** - Full-text search with multiple filters
8. **⚡ Bulk Operations** - Efficient batch create, update, delete
9. **🔄 Error Recovery** - Automatic retry with exponential backoff

**Dual-Mode Operation:**
- 🧪 **Development Mode**: In-memory storage, simulated OAuth (no setup required)
- 🏭 **Production Mode**: Full database, real OAuth, authentication (configure DATABASE_URL)

See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) for complete details.

## Features

### Core Features
- **Web UI**: Modern React TypeScript interface for managing accounts and posting
- **Multi-Account Management**: Configure and manage multiple accounts per platform
- **Credential Testing**: Test platform credentials before posting
- **Multi-Platform Support**: Post to 9 social platforms from a single interface
- **Scheduling**: Schedule posts for future publishing with conflict detection
- **REST API**: Simple REST API for integration with other services
- **Docker Support**: Run in Docker containers for easy deployment
- **Platform Adapters**: Automatic content formatting for each platform's requirements
- **Background Processing**: Asynchronous post publishing with APScheduler
- **⚡ Parallel Execution**: Concurrent posting to multiple platforms for faster delivery
- **📊 Content Optimization**: AI-powered suggestions to optimize content for each platform
- **👁️ Post Preview**: See how your post will appear before publishing
- **🚫 Conflict Detection**: Automatically detect scheduling conflicts
- **⏱️ Rate Limit Awareness**: Built-in rate limit information for each platform

### 🤖 AI-Powered Features

#### 1. AI Content Generation
- **Smart Caption Creator**: Generate platform-optimized captions from topics
- **Hashtag Suggestions**: AI-powered relevant hashtag recommendations
- **Content Rewriting**: Automatically adapt content for different platforms
- **Tone Customization**: Generate content in different tones (professional, casual, fun)

#### 2. Intelligent Scheduling
- **Best Time Predictions**: AI analyzes when your audience is most active
- **Engagement Forecasting**: Predict expected engagement before posting
- **Posting Frequency**: Get recommendations on optimal posting frequency per platform
- **Historical Analysis**: Learn from past performance to optimize future posts

#### 3. Smart Image Enhancement
- **Platform Optimization**: Automatically resize and crop images for each platform
- **Quality Enhancement**: AI-powered brightness, contrast, and sharpness improvements
- **Alt Text Generation**: Automatic accessibility descriptions for images
- **Format Conversion**: Convert images to optimal formats and sizes

#### 4. 🎨 AI Image Generation (DALL-E 3 Powered)
- **Post Image Generation**: Create custom images for social media posts with DALL-E 3
- **Video Thumbnails**: Generate eye-catching thumbnails optimized for each platform
- **Video Content Images**: Automatically generate images for video scenes from scripts
- **Image Variations**: Create multiple variations of existing images
- **Multiple Styles**: 9 artistic styles (photorealistic, illustration, minimalist, abstract, cinematic, vintage, modern, cartoon, corporate)
- **Platform-Specific Sizing**: Automatic size optimization for each social platform

#### 5. Predictive Analytics
- **Performance Prediction**: Forecast engagement before publishing
- **A/B Testing**: Compare predicted performance of multiple variations
- **Recommendation Engine**: Get actionable suggestions to improve posts
- **Model Training**: Train custom models on your historical data

#### 6. 🔥 Viral Content Intelligence Engine (NEW)
- **Viral Hooks Library**: 1,000+ proven hooks in 5 categories (curiosity, urgency, controversy, storytelling, value)
- **Virality Score Prediction**: Predict viral potential (0-100) before posting
- **Platform Best Practices**: Get platform-specific viral patterns and optimal formats
- **Engagement Triggers**: Identify what makes content go viral on each platform
- **Real-time Recommendations**: Get actionable tips to boost virality

#### 7. ♻️ Advanced AI Content Multiplier (NEW)
- **1 → 50 Content Generation**: Transform one piece into multiple platform-specific posts
- **Cross-Platform Adaptation**: Automatically adapt content for Twitter, LinkedIn, Instagram, TikTok, Facebook
- **Brand Voice Consistency**: Maintain your brand voice across all outputs
- **A/B Test Variations**: Generate multiple variations for testing
- **Smart Remixing**: Preserve key messages while adapting style and format

#### 8. 🎬 AI Video Generation + Faceless Video Studio (NEW - 10 Improvements)
- **Video Script Generation**: AI-powered video scripts optimized for platform and duration
- **Video Template Library**: 6 pre-built templates (product showcase, tutorial, testimonial, announcement, BTS, story)
- **Auto-Subtitle Generation**: Generate SRT/VTT subtitle files with perfect timing
- **Aspect Ratio Conversion**: Automatic conversion (16:9 → 9:16, 1:1) with one command
- **AI Voiceover Prep**: Generate voiceover-ready scripts with timing markers and emphasis
- **B-Roll Integration**: AI-suggested B-roll footage with stock library keywords
- **Batch Video Creation**: Generate 100+ videos from CSV data
- **Brand Watermarking**: Add logos/watermarks with customizable position and opacity
- **Intro/Outro Templates**: 5 styles of branded intros and outros
- **Text Overlay Editor**: Animated text sequences with 4 style presets
- **Multi-Platform Export**: Generate optimized versions for all platforms at once
- **Analytics Metadata**: Engagement prediction and performance tracking
- **FFmpeg Rendering**: Actual video file generation with server-side rendering
- **Text-to-Video Prompts**: Generate optimized prompts for AI video generation tools (Runway, Pika, Stable Video)
- **Video Caption Generation**: Create engaging captions and hashtags for video content
- **Slideshow Creation**: Automatically create video slideshows from images with transitions
- **FFmpeg Rendering**: Actual video file generation with server-side rendering
- **Text-to-Video Prompts**: Generate optimized prompts for AI video generation tools (Runway, Pika, Stable Video)
- **Video Caption Generation**: Create engaging captions and hashtags for video content
- **Platform Optimization**: Automatic video specs and ffmpeg commands for each platform
- **Multi-Platform Support**: Optimized for Instagram Reels, YouTube Shorts, TikTok, Facebook Reels, and more

## Supported Platforms

### LinkedIn
- **Personal Profiles**: Post to your personal LinkedIn profile
- **Company Pages**: Post to LinkedIn company pages

### Twitter/X
- **Standard Posts**: Regular tweets (280 character limit)
- **Threads**: Multi-tweet threads for longer content

### Threads
- **Single Posts**: Standard Threads posts (500 character limit)
- **Thread-style Posts**: Multi-post threads

### Bluesky
- **Single Posts**: Standard posts (300 character limit)
- **Thread-style Posts**: Multi-post threads

### YouTube
- **Long-form Videos**: Standard YouTube videos (up to 12 hours)
- **YouTube Shorts**: Short vertical videos (up to 60 seconds)

### Instagram
- **Feed Posts**: Standard Instagram posts (requires media)
- **Reels**: Short-form video content (3-90 seconds)
- **Stories**: Ephemeral 24-hour content
- **Carousels**: Multi-image/video posts (2-10 items)

### Facebook
- **Pages Only**: Post to Facebook Pages (not personal profiles or groups)
- **Feed Posts**: Standard Facebook posts
- **Reels**: Short-form video content (3-90 seconds)

### Pinterest
- **Pins**: Standard image pins
- **Video Pins**: Video content (4 seconds to 15 minutes)

### TikTok
- **Videos**: Standard TikTok videos (3 seconds to 10 minutes)
- **Slideshows**: Photo slideshows with music (1-35 images)

## Quick Start

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

The application will be available at `http://localhost:33766`

**Access the Web UI**: Open your browser and navigate to `http://localhost:33766`

**Auto-Restart Configuration**: The Docker Compose configuration includes `restart: unless-stopped`, which means:
- ✅ Automatically starts when Docker daemon starts (on system boot)
- ✅ Automatically restarts if the application crashes
- ✅ Only stops when manually stopped with `docker-compose stop` or `docker-compose down`

### Using Docker

```bash
# Build the image
docker build -t mastablasta .

# Run the container with auto-restart
docker run -d \
  --restart unless-stopped \
  -p 33766:33766 \
  --name mastablasta \
  mastablasta
```

**Auto-Restart Configuration**: The `--restart unless-stopped` flag ensures:
- ✅ Container automatically starts on system boot
- ✅ Container restarts automatically on failure
- ✅ Container stays stopped only when manually stopped with `docker stop mastablasta`

### Local Development

#### Backend
```bash
# Install Python dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

#### Frontend (for development)
```bash
cd frontend
npm install
npm run dev  # Development server on port 5173
```

## Web UI

The application includes a modern, intuitive web interface built with React and TypeScript.

### Dashboard
![Dashboard](https://github.com/user-attachments/assets/de50cea8-7f2a-404a-9b36-79decb71358c)

View statistics and recent activity at a glance.

### Account Management
![Accounts](https://github.com/user-attachments/assets/ab6c19ae-e641-4c66-aad2-d66d0b01b0fc)

Easily configure multiple accounts for each platform:
- Add accounts with platform-specific credentials
- Test credentials before saving
- Enable/disable accounts
- Edit or delete existing accounts

![Add Account](https://github.com/user-attachments/assets/2977d5e3-9907-434c-b4b3-17cd7dd888d6)

### Create Posts
![Create Post](https://github.com/user-attachments/assets/aace7e8f-a1e7-491e-b162-1cabf9d5ad20)

Post to multiple accounts instantly:
- Rich text editor with character counter
- Select multiple accounts across platforms
- Real-time validation
- Publish immediately or schedule for later

## API Endpoints

### Health Check
```bash
GET /api/health
```

Returns the service health status.

**Response:**
```json
{
  "status": "healthy",
  "service": "MastaBlasta",
  "version": "1.0.0",
  "timestamp": "2026-01-07T05:46:44.996Z"
}
```

### Account Management

#### Get All Accounts
```bash
GET /api/accounts
```

Returns all configured platform accounts (without sensitive credentials).

**Response:**
```json
{
  "accounts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "platform": "twitter",
      "name": "My Business Twitter",
      "username": "mybusiness",
      "enabled": true,
      "created_at": "2026-01-07T05:46:44.996Z"
    }
  ],
  "count": 1
}
```

#### Add Account
```bash
POST /api/accounts
Content-Type: application/json

{
  "platform": "twitter",
  "name": "My Twitter Account",
  "username": "johndoe",
  "credentials": {
    "api_key": "...",
    "api_secret": "...",
    "access_token": "...",
    "access_token_secret": "..."
  }
}
```

**Response:**
```json
{
  "success": true,
  "account_id": "550e8400-e29b-41d4-a716-446655440000",
  "account": { ... }
}
```

#### Update Account
```bash
PUT /api/accounts/{account_id}
Content-Type: application/json

{
  "name": "Updated Name",
  "enabled": true
}
```

#### Test Account Credentials
```bash
POST /api/accounts/{account_id}/test
```

Tests if the account credentials are valid.

**Response:**
```json
{
  "success": true,
  "message": "Credentials are valid",
  "platform": "twitter",
  "account_name": "My Twitter Account"
}
```

#### Delete Account
```bash
DELETE /api/accounts/{account_id}
```

### Get Supported Platforms
```bash
GET /api/platforms
```

Returns a list of all supported social media platforms.

**Response:**
```json
{
  "platforms": [
    {
      "name": "twitter",
      "display_name": "Twitter",
      "available": true,
      "supported_post_types": ["standard", "thread"]
    }
  ],
  "count": 9
}
```

### Get Platform Post Types
```bash
GET /api/platforms/{platform}/post-types
```

Returns the supported post types for a specific platform.

**Response:**
```json
{
  "platform": "instagram",
  "supported_post_types": ["feed_post", "reel", "story", "carousel"]
}
```

### Get Detailed Post Type Information
```bash
GET /api/platforms/{platform}/post-types/details
```

Returns detailed information about each post type including descriptions and requirements.

**Example Response for Instagram:**
```json
{
  "platform": "instagram",
  "post_types": [
    {
      "type": "feed_post",
      "description": "Standard Instagram post (requires image or video)",
      "requirements": {
        "media_required": true,
        "media_types": ["image", "video"]
      }
    },
    {
      "type": "carousel",
      "description": "Multi-image or video post (2-10 items)",
      "requirements": {
        "media_required": true,
        "media_types": ["image", "video"],
        "min_items": 2,
        "max_items": 10,
        "mixed_media": true
      }
    }
  ]
}
```

### Post Immediately
```bash
POST /api/post
Content-Type: application/json

{
  "content": "Your post content here",
  "account_ids": ["550e8400-e29b-41d4-a716-446655440000"],
  "post_type": "standard",
  "post_options": {
    "instagram": {
      "aspect_ratio": "1:1"
    }
  }
}
```

**Validation:**
- The API validates post types against each platform's supported types
- Media requirements are automatically validated (e.g., Instagram requires media for all post types)
- Clear error messages indicate which platforms don't support the specified post type

**Parameters:**
- `content` (required): The text content of the post
- `account_ids` (required): Array of account IDs to post to
- `media` (optional): Array of media URLs
- `post_type` (optional): Type of post (default: "standard"). Supported types vary by platform:
  - Twitter/X: `standard`, `thread`
  - Instagram: `feed_post`, `reel`, `story`, `carousel`
  - Facebook: `feed_post`, `reel`
  - LinkedIn: `personal_profile`, `company_page`
  - Threads: `standard`, `thread`
  - Bluesky: `standard`, `thread`
  - YouTube: `video`, `short`
  - Pinterest: `pin`, `video_pin`
  - TikTok: `video`, `slideshow`
- `post_options` (optional): Platform-specific options (e.g., `page_id` for Facebook, `company_id` for LinkedIn)

**Legacy parameters (still supported):**
- `platforms`: Array of platform names
- `credentials`: Platform-specific credentials

**Response:**
```json
{
  "success": true,
  "post_id": "660e8400-e29b-41d4-a716-446655440000",
  "message": "Post is being published",
  "post": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "content": "Your post content here",
    "platforms": ["twitter"],
    "account_ids": ["550e8400-e29b-41d4-a716-446655440000"],
    "post_type": "standard",
    "status": "published",
    "results": [
      {
        "success": true,
        "platform": "twitter",
        "post_id": "abc123",
        "post_type": "standard",
        "message": "Post published to twitter"
      }
    ]
  }
}
```

### Post to Facebook Reels
Facebook Reels are short-form vertical videos (3-90 seconds) for Facebook Pages only. A video is required.

```bash
POST /api/post
Content-Type: application/json

{
  "content": "Check out this amazing Facebook Reel! 🎥",
  "account_ids": ["facebook-page-account-id"],
  "post_type": "reel",
  "media": ["reel_video.mp4"],
  "post_options": {
    "facebook": {
      "page_id": "your-page-id"
    }
  }
}
```

**Facebook Reel Requirements:**
- **Video required**: Must include at least one video file
- **Duration**: 3-90 seconds
- **Aspect ratio**: 9:16 (vertical)
- **Target**: Facebook Pages only (not personal profiles or groups)
- **Rate limits**: 50 posts/hour, 500 posts/day

**Example Response:**
```json
{
  "success": true,
  "post_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Post is being published",
  "post": {
    "post_type": "reel",
    "platform": "facebook",
    "results": [
      {
        "success": true,
        "platform": "facebook",
        "post_id": "fb_reel_123",
        "post_type": "reel",
        "message": "Post published to facebook"
      }
    ]
  }
}
```

### Schedule a Post
```bash
POST /api/schedule
Content-Type: application/json

{
  "content": "Scheduled post content",
  "account_ids": ["550e8400-e29b-41d4-a716-446655440000"],
  "scheduled_time": "2026-01-08T10:00:00Z"
}
```

**Parameters:**
- `content` (required): The text content of the post
- `account_ids` (required): Array of account IDs
- `scheduled_time` (required): ISO 8601 formatted datetime (must be in the future)
- `media` (optional): Array of media URLs
- `platforms` (required): Array of platform names to post to
- `credentials` (optional): Platform-specific authentication credentials

**Response:**
```json
{
  "success": true,
  "post_id": "550e8400-e29b-41d4-a716-446655440000",
  "message": "Post is being published",
  "parallel_execution": true,
  "post": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "content": "Your post content here",
    "platforms": ["twitter", "facebook"],
    "status": "publishing",
    "created_at": "2026-01-07T05:46:44.996Z",
    "execution_time_seconds": 0.15
  }
}
```

### Preview Post Before Publishing
```bash
POST /api/post/preview
Content-Type: application/json

{
  "content": "Check out this amazing product!",
  "platforms": ["twitter", "instagram"],
  "post_type": "standard",
  "media": ["image.jpg"]
}
```

**Response:**
```json
{
  "previews": [
    {
      "platform": "twitter",
      "post_type": "standard",
      "content": "Check out this amazing product!",
      "media_count": 1,
      "character_count": 33,
      "estimated_display": "Check out this amazing product!",
      "character_limit": 280,
      "characters_remaining": 247
    }
  ],
  "count": 2
}
```

### Get Content Optimization Suggestions
```bash
POST /api/post/optimize
Content-Type: application/json

{
  "content": "This is a very long message that might exceed platform limits...",
  "platforms": ["twitter"],
  "post_type": "standard"
}
```

**Response:**
```json
{
  "optimizations": {
    "twitter": {
      "suggestions": [
        {
          "type": "length",
          "severity": "warning",
          "message": "Content is close to 280 character limit (265 chars)",
          "suggestion": "Consider shortening for better readability"
        }
      ],
      "has_errors": false,
      "has_warnings": true
    }
  },
  "overall_status": "ok"
}
```

### Check Scheduling Conflicts
```bash
POST /api/schedule/conflicts
Content-Type: application/json

{
  "scheduled_time": "2026-01-10T10:00:00Z",
  "platforms": ["twitter", "instagram"]
}
```

**Response:**
```json
{
  "has_conflicts": true,
  "conflicts": [
    {
      "post_id": "abc-123",
      "scheduled_for": "2026-01-10T10:02:00Z",
      "shared_platforms": ["twitter"],
      "time_difference_seconds": 120
    }
  ],
  "conflict_count": 1,
  "suggestions": [
    {
      "time": "2026-01-10T10:10:00Z",
      "reason": "Avoids scheduling conflicts"
    }
  ]
}
```

### Schedule a Post
```bash
POST /api/schedule
Content-Type: application/json

{
  "content": "Scheduled post content",
  "media": [],
  "platforms": ["twitter", "linkedin"],
  "scheduled_time": "2026-01-08T10:00:00Z",
  "credentials": {
    "twitter": {"api_key": "...", "api_secret": "..."}
  }
}
```

**Parameters:**
- `content` (required): The text content of the post
- `media` (optional): Array of media URLs
- `platforms` (required): Array of platform names
- `scheduled_time` (required): ISO 8601 formatted datetime (must be in the future)
- `credentials` (optional): Platform-specific authentication credentials

**Response:**
```json
{
  "success": true,
  "post_id": "660e8400-e29b-41d4-a716-446655440000",
  "message": "Post scheduled successfully",
  "post": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "status": "scheduled",
    "scheduled_for": "2026-01-08T10:00:00Z"
  }
}
```

### Get All Posts
```bash
GET /api/posts?status=scheduled
```

**Query Parameters:**
- `status` (optional): Filter by status (scheduled, publishing, published)

**Response:**
```json
{
  "posts": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "content": "Post content",
      "platforms": ["twitter"],
      "status": "published",
      "created_at": "2026-01-07T05:46:44.996Z"
    }
  ],
  "count": 1
}
```

### Get Single Post
```bash
GET /api/posts/{post_id}
```

Returns details of a specific post.

### Delete/Cancel Post
```bash
DELETE /api/posts/{post_id}
```

Deletes a post or cancels a scheduled post.

**Response:**
```json
{
  "success": true,
  "message": "Post deleted successfully"
}
```

## Architecture

MastaBlasta is built with:
- **Flask**: Lightweight Python web framework
- **APScheduler**: Background job scheduling for delayed posts
- **Gunicorn**: Production WSGI server
- **Platform Adapters**: Modular design for easy platform integration

### Platform Adapters

Each social media platform has its own adapter class that:
1. Validates platform-specific credentials
2. Formats content according to platform requirements (e.g., Twitter's 280 character limit)
3. Handles platform-specific API calls

## Configuration

Set environment variables:
- `PORT`: API port (default: 33766)
- `OPENAI_API_KEY`: OpenAI API key for AI features (optional, required for AI functionality)

### AI Features Setup

To enable AI-powered features:

1. Install AI dependencies:
```bash
pip install openai Pillow scikit-learn numpy pandas
```

2. Set your OpenAI API key:
```bash
export OPENAI_API_KEY=your-api-key-here
```

3. Verify AI services are enabled:
```bash
GET /api/ai/status
```

## AI API Endpoints

### Content Generation

**Generate Caption**
```bash
POST /api/ai/generate-caption
{
  "topic": "New product launch",
  "platform": "instagram",
  "tone": "professional"
}
```

Response:
```json
{
  "success": true,
  "caption": "🚀 Excited to announce our new product! ...",
  "character_count": 150,
  "platform": "instagram"
}
```

**Suggest Hashtags**
```bash
POST /api/ai/suggest-hashtags
{
  "content": "Just launched our new app!",
  "platform": "twitter",
  "count": 5
}
```

**Rewrite Content for Different Platform**
```bash
POST /api/ai/rewrite-content
{
  "content": "Check out our tweet!",
  "source_platform": "twitter",
  "target_platform": "linkedin"
}
```

### Intelligent Scheduling

**Get Best Posting Times**
```bash
POST /api/ai/best-times
{
  "platform": "instagram",
  "historical_data": []  // Optional: your historical post performance
}
```

Response:
```json
{
  "success": true,
  "platform": "instagram",
  "best_times": ["11:00", "13:00", "19:00", "21:00"],
  "recommendation": "Post between 11:00 and 21:00 UTC for best engagement"
}
```

**Predict Engagement**
```bash
POST /api/ai/predict-engagement
{
  "content": "Your post content here",
  "platform": "twitter",
  "scheduled_time": "14:00"
}
```

**Get Posting Frequency Recommendations**
```bash
POST /api/ai/posting-frequency
{
  "platform": "twitter",
  "content_type": "standard"
}
```

### Image Enhancement

**Optimize Image for Platform**
```bash
POST /api/ai/optimize-image
{
  "image_data": "base64_encoded_image_or_data_url",
  "platform": "instagram"
}
```

Response:
```json
{
  "success": true,
  "optimized_image": "data:image/jpeg;base64,...",
  "original_dimensions": {"width": 2000, "height": 1500},
  "new_dimensions": {"width": 1080, "height": 1080},
  "recommended_aspect": "1:1"
}
```

**Enhance Image Quality**
```bash
POST /api/ai/enhance-image
{
  "image_data": "base64_encoded_image",
  "enhancement_level": "medium"  // low, medium, or high
}
```

**Generate Alt Text**
```bash
POST /api/ai/generate-alt-text
{
  "image_data": "base64_encoded_image"
}
```

### AI Image Generation

**Generate Custom Image**
```bash
POST /api/ai/generate-image
{
  "prompt": "A beautiful sunset over mountains",
  "style": "photorealistic",  // photorealistic, illustration, minimalist, abstract, cinematic, vintage, modern, cartoon, corporate
  "size": "1024x1024",  // 1024x1024, 1792x1024, 1024x1792
  "platform": "instagram"  // Optional: auto-adjusts size
}
```

Response:
```json
{
  "success": true,
  "image_url": "https://...",
  "image_data": "data:image/png;base64,...",
  "size": "1024x1024",
  "style": "photorealistic",
  "platform": "instagram",
  "original_prompt": "A beautiful sunset over mountains",
  "revised_prompt": "A stunning photorealistic scene..."
}
```

**Generate Post Image**
```bash
POST /api/ai/generate-post-image
{
  "content": "Exciting new product launch announcement!",
  "platform": "instagram",
  "style": "modern",
  "include_text_space": true
}
```

Response:
```json
{
  "success": true,
  "image_url": "https://...",
  "image_data": "data:image/png;base64,...",
  "post_optimized": true,
  "text_overlay_ready": true,
  "platform": "instagram"
}
```

**Generate Video Thumbnail**
```bash
POST /api/ai/generate-video-thumbnail
{
  "topic": "How to cook pasta",
  "video_type": "tutorial",  // product_showcase, tutorial, testimonial, announcement, behind_the_scenes, story
  "platform": "youtube",
  "style": "cinematic"
}
```

Response:
```json
{
  "success": true,
  "image_url": "https://...",
  "image_data": "data:image/png;base64,...",
  "thumbnail_type": "tutorial",
  "optimized_for": "youtube video thumbnail",
  "size": "1792x1024"
}
```

**Generate Images for Video**
```bash
POST /api/ai/generate-video-images
{
  "script": "Scene 1: Product intro\nScene 2: Key features\nScene 3: Call to action",
  "num_images": 3,
  "style": "cinematic",
  "platform": "instagram"
}
```

Response:
```json
{
  "success": true,
  "images": [
    {
      "scene_number": 1,
      "scene_description": "Scene 1: Product intro",
      "image_url": "https://...",
      "image_data": "data:image/png;base64,...",
      "prompt": "Scene 1: Product intro. Consistent style, high quality."
    }
  ],
  "count": 3,
  "video_ready": true
}
```

**Create Image Variations**
```bash
POST /api/ai/create-image-variations
{
  "image_data": "data:image/png;base64,...",
  "num_variations": 3
}
```

Response:
```json
{
  "success": true,
  "variations": [
    {
      "image_url": "https://...",
      "image_data": "data:image/png;base64,..."
    }
  ],
  "count": 3
}
```

### Predictive Analytics

**Predict Post Performance**
```bash
POST /api/ai/predict-performance
{
  "content": "Your post content",
  "media": ["image1.jpg"],
  "scheduled_time": "2026-01-12T14:00:00Z",
  "platform": "instagram"
}
```

Response:
```json
{
  "success": true,
  "engagement_score": 85,
  "predicted_metrics": {
    "likes": 255,
    "comments": 34,
    "shares": 51,
    "reach": 850
  },
  "recommendations": ["Post looks good!"],
  "optimal": true
}
```

**Compare Post Variations (A/B Testing)**
```bash
POST /api/ai/compare-variations
{
  "variations": [
    {
      "name": "Version A",
      "content": "First variation...",
      "platform": "twitter"
    },
    {
      "name": "Version B",
      "content": "Second variation...",
      "platform": "twitter"
    }
  ]
}
```

Response:
```json
{
  "success": true,
  "variations_analyzed": 2,
  "results": [...],
  "best_variation": {...},
  "recommendation": "Use Version A for best results"
}
```

**Train Custom Model**
```bash
POST /api/ai/train-model
{
  "historical_posts": [
    {
      "content": "Post 1",
      "engagement": 150,
      "posted_at": "2026-01-01T12:00:00Z"
    },
    // ... at least 20 posts required
  ]
}
```

### Viral Content Intelligence

**Get Viral Hooks Library**
```bash
GET /api/viral/hooks?category=curiosity&count=5
```

Response:
```json
{
  "success": true,
  "category": "curiosity",
  "hooks": [
    "You won't believe what happened when...",
    "The secret nobody tells you about...",
    "What they don't want you to know about..."
  ],
  "count": 3
}
```

**Predict Virality Score**
```bash
POST /api/viral/predict-score
{
  "content": "You won't believe this amazing hack! 🔥 #viral",
  "platform": "twitter"
}
```

Response:
```json
{
  "success": true,
  "virality_score": 78,
  "rating": "Good Viral Potential",
  "platform": "twitter",
  "factors": [
    "Optimal length",
    "Strong curiosity hook",
    "Good emoji usage"
  ],
  "recommendations": [
    "Content looks great!"
  ]
}
```

**Get Platform Best Practices**
```bash
GET /api/viral/best-practices/instagram
```

Response:
```json
{
  "success": true,
  "platform": "instagram",
  "best_practices": {
    "caption_style": "Story-driven with line breaks",
    "optimal_hashtags": "10-15",
    "best_time": "Lunch (11 AM-1 PM) or Evening (7-9 PM)",
    "engagement_triggers": ["carousels", "reels", "behind-the-scenes"]
  }
}
```

### Content Multiplier

**Multiply Content Across Platforms**
```bash
POST /api/content/multiply
{
  "source_content": "We just launched an amazing new feature!",
  "source_type": "announcement",
  "target_platforms": ["twitter", "linkedin", "instagram"],
  "brand_voice": "professional"
}
```

Response:
```json
{
  "success": true,
  "source_type": "announcement",
  "outputs": {
    "twitter": {
      "content": "🚀 Big news! We've just launched...",
      "character_count": 127,
      "hashtags": ["#product", "#launch"],
      "platform": "twitter"
    },
    "linkedin": {
      "content": "Exciting update from our team...",
      "character_count": 450,
      "hashtags": ["#innovation"],
      "platform": "linkedin"
    }
  },
  "platforms_generated": 3,
  "brand_voice": "professional"
}
```

**Generate Content Variations**
```bash
POST /api/content/variations
{
  "content": "Check out our new product! 🎉",
  "num_variations": 3,
  "platform": "twitter"
}
```

Response:
```json
{
  "success": true,
  "original": "Check out our new product! 🎉",
  "variations": [
    {
      "variation_number": 1,
      "content": "Introducing our latest innovation...",
      "character_count": 85,
      "hashtags": ["#new", "#product"]
    },
    {
      "variation_number": 2,
      "content": "You asked, we delivered...",
      "character_count": 92,
      "hashtags": ["#launch"]
    }
  ],
  "count": 3,
  "platform": "twitter"
}
```

### Video Generation
      "engagement": 150,
      "posted_at": "2026-01-01T12:00:00Z"
    },
    // ... at least 20 posts required
  ]
}
```

### Video Generation

MastaBlasta now includes powerful AI-driven video generation capabilities that rival leading tools like Blotato.

**Get Video Templates**
```bash
GET /api/ai/video-templates
```

Response:
```json
{
  "success": true,
  "templates": {
    "product_showcase": {
      "name": "Product Showcase",
      "description": "Professional product demonstration",
      "scenes": 4,
      "duration": 30,
      "style": "professional"
    },
    "tutorial": {...},
    "testimonial": {...}
  },
  "count": 6
}
```

**Generate Script from Template**
```bash
POST /api/ai/generate-from-template
{
  "template_id": "tutorial",
  "topic": "How to use our software",
  "platform": "youtube"
}
```

Response:
```json
{
  "success": true,
  "template_id": "tutorial",
  "template_name": "Tutorial",
  "script": "Scene 1: Introduction...",
  "platform": "youtube",
  "duration": 45,
  "style": "educational",
  "scenes": 5
}
```

**Generate Video Script**
```bash
POST /api/ai/generate-video-script
{
  "topic": "New product launch",
  "platform": "instagram",
  "duration": 30,
  "style": "engaging"
}
```

Response:
```json
{
  "success": true,
  "script": "Scene 1 (0-3 seconds): [Hook with product reveal]...",
  "scenes": ["Scene 1...", "Scene 2..."],
  "platform": "instagram",
  "duration": 30,
  "style": "engaging",
  "scene_count": 4
}
```

**Create Slideshow Video (FFmpeg Command Generation)**
```bash
POST /api/ai/create-slideshow
{
  "images": ["image1.jpg", "image2.jpg", "image3.jpg"],
  "duration_per_image": 3.0,
  "platform": "instagram",
  "post_type": "reel",
  "transition": "fade"
}
```

Response:
```json
{
  "success": true,
  "format": "slideshow",
  "image_count": 3,
  "total_duration": 9.0,
  "dimensions": {
    "width": 1080,
    "height": 1920,
    "aspect_ratio": "9:16"
  },
  "ffmpeg_command_template": "ffmpeg -framerate 1/3 ..."
}
```

**Render Slideshow Video (Actual Video File)**
```bash
POST /api/ai/render-slideshow
{
  "images": ["/path/to/image1.jpg", "/path/to/image2.jpg"],
  "duration_per_image": 3.0,
  "platform": "instagram",
  "post_type": "reel",
  "transition": "fade",
  "output_path": "/tmp/my_video.mp4"
}
```

Response:
```json
{
  "success": true,
  "output_path": "/tmp/my_video.mp4",
  "file_size": 2048576,
  "dimensions": {"width": 1080, "height": 1920},
  "duration": 9.0,
  "format": "mp4",
  "codec": "h264"
}
```

### Faceless Video Studio (10 New Features)

**Generate Subtitles (Feature #1)**
```bash
POST /api/video/generate-subtitles
{
  "script": "Scene 1: Welcome\nScene 2: Main content\nScene 3: Conclusion",
  "duration": 30,
  "format": "srt"  // or "vtt"
}
```

Response:
```json
{
  "success": true,
  "format": "srt",
  "subtitle_count": 3,
  "duration": 30,
  "content": "1\n00:00:00,000 --> 00:00:10,000\nScene 1: Welcome\n\n2\n...",
  "subtitles": [...]
}
```

**Convert Aspect Ratio (Feature #2)**
```bash
POST /api/video/convert-aspect-ratio
{
  "input_specs": {"width": 1920, "height": 1080},
  "target_ratio": "9:16"  // 16:9, 9:16, 1:1, 4:5, 2:3
}
```

**Generate Voiceover Script (Feature #3)**
```bash
POST /api/video/generate-voiceover-script
{
  "script": "Welcome to our tutorial.",
  "language": "en",
  "voice_style": "professional"
}
```

**B-Roll Suggestions (Feature #4)**
```bash
POST /api/video/broll-suggestions
{
  "script": "Scene 1: Product demonstration",
  "video_type": "product_showcase"
}
```

**Batch Video Creation (Feature #5)**
```bash
POST /api/video/batch-create
{
  "batch_data": [{"topic": "Product A"}, {"topic": "Product B"}],
  "template_id": "product_showcase",
  "platform": "instagram"
}
```

**Add Brand Watermark (Feature #6)**
```bash
POST /api/video/add-watermark
{
  "video_specs": {"width": 1920, "height": 1080},
  "watermark_config": {
    "position": "bottom-right",
    "opacity": 0.8,
    "logo_path": "logo.png"
  }
}
```

**Generate Intro/Outro (Feature #7)**
```bash
POST /api/video/generate-intro-outro
{
  "brand_name": "MyBrand",
  "style": "modern"
}
```

**Text Overlay Sequence (Feature #8)**
```bash
POST /api/video/text-overlays
{
  "key_points": ["Point 1", "Point 2"],
  "style": "bold"
}
```

**Multi-Platform Export (Feature #9)**
```bash
POST /api/video/multi-platform-export
{
  "source_video_specs": {"width": 1920, "height": 1080}
}
```

**Analytics Metadata (Feature #10)**
```bash
POST /api/video/analytics-metadata
{
  "script": "You won't believe this!",
  "platform": "youtube"
}
```

**Generate Text-to-Video Prompt**
```bash
POST /api/ai/generate-video-prompt
{
  "text": "A beautiful sunset over the ocean",
  "platform": "tiktok",
  "post_type": "video",
  "style": "cinematic"
}
```

Response:
```json
{
  "success": true,
  "video_prompt": "Create a cinematic video featuring a stunning sunset...",
  "platform": "tiktok",
  "aspect_ratio": "9:16",
  "recommended_duration": 30,
  "note": "Use this prompt with AI video generation tools like Runway ML, Pika Labs, or Stable Video Diffusion"
}
```

**Generate Video Captions**
```bash
POST /api/ai/generate-video-captions
{
  "content": "Behind the scenes of our product shoot",
  "platform": "instagram",
  "language": "en"
}
```

Response:
```json
{
  "success": true,
  "caption": "🎬 Behind the scenes magic! Check out how we created this amazing content... #BTS #ProductShoot #ContentCreation",
  "hashtags": ["#BTS", "#ProductShoot", "#ContentCreation"],
  "platform": "instagram",
  "character_count": 95
}
```

**Optimize Video for Platform**
```bash
POST /api/ai/optimize-video
{
  "video_path": "input.mp4",
  "platform": "youtube",
  "post_type": "short"
}
```

Response:
```json
{
  "success": true,
  "platform": "youtube",
  "post_type": "short",
  "specifications": {
    "aspect_ratio": "9:16",
    "min_duration": 1,
    "max_duration": 60,
    "width": 1080,
    "height": 1920
  },
  "optimization_settings": {
    "resolution": "1080x1920",
    "recommended_format": "mp4",
    "recommended_codec": "h264",
    "recommended_bitrate": "3000k",
    "audio_codec": "aac",
    "audio_bitrate": "192k"
  },
  "ffmpeg_command": "ffmpeg -i input.mp4 -vf scale=1080:1920..."
}
```

**Get Platform Video Specifications**
```bash
GET /api/ai/video-specs/instagram
```

Response:
```json
{
  "success": true,
  "platform": "instagram",
  "video_types": ["reel", "story", "feed"],
  "specifications": {
    "reel": {
      "aspect_ratio": "9:16",
      "min_duration": 3,
      "max_duration": 90,
      "width": 1080,
      "height": 1920
    },
    "story": {...},
    "feed": {...}
  }
}
```

#### Supported Platforms for Video Generation
- **Instagram**: Reels (9:16, 3-90s), Stories (9:16, 1-60s), Feed (1:1, 3-60s)
- **YouTube**: Shorts (9:16, 1-60s), Videos (16:9, up to 12 hours)
- **TikTok**: Videos (9:16, 3-600s)
- **Facebook**: Reels (9:16, 3-90s), Feed (16:9, 1-240s)
- **Pinterest**: Video Pins (2:3, 4-900s)
- **Twitter**: Videos (16:9, 0.5-140s)

## Development

### Adding New Platforms

To add support for a new platform:

1. Create a new adapter class inheriting from `PlatformAdapter`
2. Implement `format_post()` and `publish()` methods
3. Add the adapter to `PLATFORM_ADAPTERS` dictionary

Example:
```python
class TikTokAdapter(PlatformAdapter):
    def __init__(self):
        super().__init__('tiktok')
    
    def format_post(self, content, media=None):
        # TikTok requires video media
        return {
            'platform': self.platform_name,
            'content': content,
            'media': media,
            'requires_video': True
        }
    
    def publish(self, post_data, credentials):
        # Implement TikTok API call
        pass

PLATFORM_ADAPTERS['tiktok'] = TikTokAdapter()
```

## Testing

Test the API with curl:

```bash
# Health check
curl http://localhost:33766/api/health

# Get platforms
curl http://localhost:33766/api/platforms

# Create a post
curl -X POST http://localhost:33766/api/post \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Hello from MastaBlasta!",
    "platforms": ["twitter", "facebook"]
  }'

# Get all posts
curl http://localhost:33766/api/posts
```

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
