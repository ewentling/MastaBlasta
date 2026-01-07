# MastaBlasta
A multi-platform social media posting service that allows easy posting to multiple social media platforms at once.

## Features

- **Multi-Platform Support**: Post to Twitter, Facebook, Instagram, and LinkedIn from a single API call
- **Scheduling**: Schedule posts for future publishing
- **REST API**: Simple REST API for integration with other services
- **Docker Support**: Run in Docker containers for easy deployment
- **Platform Adapters**: Automatic content formatting for each platform's requirements
- **Background Processing**: Asynchronous post publishing with APScheduler

## Supported Platforms

- Twitter/X (280 character limit enforced)
- Facebook
- Instagram (requires media)
- LinkedIn

## Quick Start

### Using Docker Compose (Recommended)

```bash
docker-compose up -d
```

The API will be available at `http://localhost:33766`

### Using Docker

```bash
# Build the image
docker build -t mastablasta .

# Run the container
docker run -p 33766:33766 mastablasta
```

### Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run the application
python app.py
```

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
      "available": true
    }
  ],
  "count": 4
}
```

### Post Immediately
```bash
POST /api/post
Content-Type: application/json

{
  "content": "Your post content here",
  "media": ["https://example.com/image.jpg"],
  "platforms": ["twitter", "facebook", "linkedin"],
  "credentials": {
    "twitter": {"api_key": "...", "api_secret": "..."},
    "facebook": {"access_token": "..."}
  }
}
```

**Parameters:**
- `content` (required): The text content of the post
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
