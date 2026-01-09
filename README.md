# MastaBlasta
A multi-platform social media posting service that allows easy posting to multiple social media platforms at once.

## Features

- **Web UI**: Modern React TypeScript interface for managing accounts and posting
- **Multi-Account Management**: Configure and manage multiple accounts per platform
- **Credential Testing**: Test platform credentials before posting
- **Multi-Platform Support**: Post to Twitter, Facebook, Instagram, and LinkedIn from a single interface
- **Scheduling**: Schedule posts for future publishing
- **REST API**: Simple REST API for integration with other services
- **Docker Support**: Run in Docker containers for easy deployment
- **Platform Adapters**: Automatic content formatting for each platform's requirements
- **Background Processing**: Asynchronous post publishing with APScheduler

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

### Using Docker

```bash
# Build the image
docker build -t mastablasta .

# Run the container
docker run -p 33766:33766 mastablasta
```

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
  "post": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "content": "Your post content here",
    "platforms": ["twitter", "facebook"],
    "status": "publishing",
    "created_at": "2026-01-07T05:46:44.996Z"
  }
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
