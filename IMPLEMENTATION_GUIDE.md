# Production Infrastructure Implementation Guide

## Overview

This document describes the 9 major improvements implemented to transform MastaBlasta into a production-ready social media management platform.

## Architecture

The application now supports **dual-mode operation**:

1. **Development Mode** (Default): Uses in-memory storage, simulated OAuth
2. **Production Mode**: Uses PostgreSQL database, real OAuth, full feature set

### Automatic Mode Detection

The application automatically detects which mode to run based on available dependencies and configuration:

```python
# Development mode active when:
- DATABASE_URL not set
- Production dependencies not installed

# Production mode active when:
- DATABASE_URL configured
- All dependencies installed (see requirements.txt)
```

## The 9 Improvements

### 1. ✅ Database Integration

**What Changed:**
- Replaced all in-memory dictionaries with PostgreSQL database
- 15+ SQLAlchemy models for data persistence
- Connection pooling for performance
- Transaction management

**New Capabilities:**
- Data survives application restarts
- Concurrent access support
- Advanced querying and indexing
- Database migrations with Alembic

**API Endpoints:**
```
POST   /api/v2/posts          # Create post (database-backed)
GET    /api/v2/posts          # List posts with filters
GET    /api/v2/posts/{id}     # Get specific post
PUT    /api/v2/posts/{id}     # Update post
DELETE /api/v2/posts/{id}     # Delete post
POST   /api/v2/posts/{id}/publish  # Publish to platforms
```

**Configuration:**
```bash
export DATABASE_URL="postgresql://user:pass@localhost/mastablasta"
python3 -c "from database import init_db; init_db()"
```

---

### 2. ✅ Real OAuth Implementation

**What Changed:**
- Replaced simulated OAuth with actual platform integrations
- Real API calls to Twitter, Facebook, Instagram, LinkedIn, YouTube
- Secure token encryption and storage
- Automatic token refresh

**Supported Platforms:**
- **Twitter/X**: OAuth 2.0 PKCE + API v2
- **Facebook/Instagram**: Graph API v18.0
- **LinkedIn**: OAuth 2.0 + API v2
- **YouTube**: OAuth 2.0 + Data API v3

**API Endpoints:**
```
GET /api/v2/oauth/{platform}/authorize  # Start OAuth flow
GET /api/v2/oauth/{platform}/callback   # Handle callback
```

**Configuration:**
```bash
# Twitter
export TWITTER_CLIENT_ID="your_id"
export TWITTER_CLIENT_SECRET="your_secret"

# Facebook/Instagram
export META_APP_ID="your_id"
export META_APP_SECRET="your_secret"

# LinkedIn
export LINKEDIN_CLIENT_ID="your_id"
export LINKEDIN_CLIENT_SECRET="your_secret"

# YouTube
export GOOGLE_CLIENT_ID="your_id"
export GOOGLE_CLIENT_SECRET="your_secret"

# Token encryption
export ENCRYPTION_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
```

**Usage Example:**
```python
# 1. Get authorization URL
GET /api/v2/oauth/twitter/authorize
# Returns: {"url": "https://twitter.com/i/oauth2/authorize?..."}

# 2. User authorizes on platform

# 3. Platform redirects to callback
GET /api/v2/oauth/twitter/callback?code=xxx&state=xxx
# Returns: {"success": true, "account_id": "..."}
```

---

### 3. ✅ Media Upload System

**What Changed:**
- Direct file uploads (images and videos)
- File validation (type, size, MIME)
- Automatic thumbnail generation
- Platform-specific optimization
- Media library for reuse

**Supported Formats:**
- Images: JPEG, PNG, GIF, WebP (max 10MB)
- Videos: MP4, MOV, AVI (max 500MB)

**API Endpoints:**
```
POST   /api/v2/media/upload       # Upload file
GET    /api/v2/media              # List media library
GET    /api/v2/media/{id}         # Get media details
GET    /api/v2/media/{id}/file    # Download file
DELETE /api/v2/media/{id}         # Delete media
```

**Usage Example:**
```bash
# Upload image
curl -X POST http://localhost:33766/api/v2/media/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg"

# Response:
{
  "id": "abc-123",
  "filename": "image.jpg",
  "url": "/api/v2/media/abc-123/file",
  "thumbnail_url": "/api/v2/media/abc-123/thumbnail",
  "mime_type": "image/jpeg",
  "size": 245678,
  "dimensions": {"width": 1920, "height": 1080}
}
```

**Storage Structure:**
```
/media/
├── {user_id}/
│   ├── abc123.jpg
│   ├── def456.mp4
└── thumbnails/
    └── {user_id}/
        └── thumb_abc123.jpg
```

---

### 4. ✅ Authentication Middleware

**What Changed:**
- JWT-based authentication (access + refresh tokens)
- bcrypt password hashing
- Role-based access control (Admin, Editor, Viewer)
- API key authentication
- Protected endpoints

**Roles:**
- **Admin**: Full access (user management, settings)
- **Editor**: Create, edit, publish posts
- **Viewer**: Read-only access

**API Endpoints:**
```
POST /api/v2/auth/register   # Register new user
POST /api/v2/auth/login      # Login user
GET  /api/v2/auth/me         # Get current user
POST /api/v2/auth/refresh    # Refresh access token
```

**Token Lifetimes:**
- Access token: 15 minutes
- Refresh token: 30 days

**Configuration:**
```bash
export JWT_SECRET_KEY="$(openssl rand -hex 32)"
```

**Usage Example:**
```bash
# Register
curl -X POST http://localhost:33766/api/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure123","name":"John Doe"}'

# Response:
{
  "user": {"id": "...", "email": "...", "role": "editor"},
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "api_key": "mb_..."
}

# Use token
curl -X GET http://localhost:33766/api/v2/posts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"

# Or use API key
curl -X GET http://localhost:33766/api/v2/posts \
  -H "X-API-Key: YOUR_API_KEY"
```

---

### 5. ✅ Real Analytics Collection

**What Changed:**
- Automatic metrics collection from platform APIs
- Real-time post performance tracking
- Platform-specific metrics (views, likes, shares, comments, reach)
- Historical data storage
- Engagement rate calculations

**Metrics Collected:**
- Views/Impressions
- Likes/Reactions
- Shares/Retweets
- Comments/Replies
- Reach
- Engagement rate

**API Endpoints:**
```
GET /api/v2/analytics/posts/{id}  # Post-specific analytics
GET /api/v2/analytics/overview    # Dashboard overview
```

**How It Works:**
1. Post published to platform → Platform returns post ID
2. Background job collects metrics from platform API
3. Metrics stored in PostAnalytics table
4. Periodic updates (every hour) collect fresh data

**Usage Example:**
```bash
GET /api/v2/analytics/posts/abc-123

# Response:
{
  "analytics": [
    {
      "platform": "twitter",
      "views": 1250,
      "likes": 45,
      "shares": 12,
      "comments": 8,
      "reach": 1250,
      "engagement_rate": 5.2,
      "collected_at": "2026-01-11T10:30:00Z"
    }
  ]
}
```

---

### 6. ✅ Webhook System

**What Changed:**
- Register webhooks to receive event notifications
- Automatic retry with exponential backoff
- HMAC signature verification
- Event types: post.published, post.failed, analytics.updated

**API Endpoints:**
```
POST   /api/v2/webhooks           # Register webhook
GET    /api/v2/webhooks           # List webhooks
DELETE /api/v2/webhooks/{id}      # Delete webhook
```

**Usage Example:**
```bash
# Register webhook
curl -X POST http://localhost:33766/api/v2/webhooks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks",
    "events": ["post.published", "post.failed"],
    "secret": "your_webhook_secret"
  }'

# Your endpoint receives:
{
  "event": "post.published",
  "data": {
    "post_id": "abc-123",
    "platforms": ["twitter", "instagram"],
    "published_at": "2026-01-11T10:00:00Z"
  },
  "timestamp": "2026-01-11T10:00:01Z"
}
```

**Security:**
- HMAC-SHA256 signature in `X-Webhook-Signature` header
- Verify signature to ensure authenticity

---

### 7. ✅ Advanced Search & Filtering

**What Changed:**
- Full-text search across post content
- Multiple filter options
- Efficient database queries with indexing
- Pagination support

**Search Capabilities:**
- Content search (full-text)
- Platform filtering (single or multiple)
- Status filtering (draft, scheduled, published, failed)
- Date range filtering
- Post type filtering
- Media presence filtering

**API Endpoints:**
```
GET /api/v2/search/posts?q=keyword&platform=twitter&status=published
```

**Query Parameters:**
```
q          - Search query (searches content)
platform   - Filter by platform (can be multiple)
status     - Filter by status (draft|scheduled|published|failed)
post_type  - Filter by post type (standard|thread|reel|etc)
date_from  - Start date (ISO 8601)
date_to    - End date (ISO 8601)
has_media  - Filter by media presence (true|false)
limit      - Results per page (default: 50)
offset     - Pagination offset (default: 0)
```

**Usage Example:**
```bash
# Find all published Twitter threads from last 7 days
GET /api/v2/search/posts?q=&platform=twitter&post_type=thread&status=published&date_from=2026-01-04

# Response:
{
  "posts": [...],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

---

### 8. ✅ Bulk Operations

**What Changed:**
- Batch create, update, delete operations
- Efficient database operations
- Partial success handling
- Progress reporting

**API Endpoints:**
```
POST /api/v2/bulk/posts/create   # Bulk create posts
POST /api/v2/bulk/posts/update   # Bulk update posts
POST /api/v2/bulk/posts/delete   # Bulk delete posts
```

**Usage Example:**
```bash
# Bulk create posts
curl -X POST http://localhost:33766/api/v2/bulk/posts/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "posts": [
      {
        "content": "Post 1",
        "platforms": ["twitter"],
        "scheduled_time": "2026-01-12T10:00:00Z"
      },
      {
        "content": "Post 2",
        "platforms": ["instagram"],
        "media": ["media-id-1"]
      }
    ]
  }'

# Response:
{
  "successful": [
    {"id": "post-1", "content": "Post 1"},
    {"id": "post-2", "content": "Post 2"}
  ],
  "failed": []
}
```

**Benefits:**
- Single API call instead of multiple
- Atomic operations where possible
- Clear success/failure tracking
- Improved performance

---

### 9. ✅ Error Recovery & Retry Logic

**What Changed:**
- Automatic retry with exponential backoff
- Failed post tracking
- Retry queue management
- Configurable retry limits

**Retry Strategy:**
1. First attempt: Immediate
2. Second attempt: Wait 1 second
3. Third attempt: Wait 2 seconds
4. Fourth attempt: Wait 4 seconds
5. Max attempts: 3 (configurable)
6. Max backoff: 60 seconds

**API Endpoints:**
```
POST /api/v2/posts/retry-failed      # Retry all failed posts
POST /api/v2/posts/{id}/retry        # Retry specific post
```

**Usage Example:**
```bash
# Retry all failed posts
POST /api/v2/posts/retry-failed

# Response:
{
  "retried": ["post-1", "post-2", "post-3"],
  "still_failed": [
    {"id": "post-4", "error": "Invalid credentials"}
  ]
}

# Retry specific post
POST /api/v2/posts/abc-123/retry

# Response:
{
  "message": "Post scheduled for retry"
}
```

**Retryable Errors:**
- Network timeouts
- Rate limit errors (429)
- Server errors (500, 502, 503, 504)
- Temporary connection issues

**Non-Retryable Errors:**
- Invalid credentials (401)
- Missing permissions (403)
- Invalid request (400)
- Resource not found (404)

---

## Complete Setup Guide

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Set Up Database

```bash
# Install PostgreSQL
sudo apt-get install postgresql postgresql-contrib

# Create database
createdb mastablasta

# Set environment variable
export DATABASE_URL="postgresql://localhost/mastablasta"

# Initialize schema
python3 -c "from database import init_db; init_db()"
```

### 3. Configure Authentication

```bash
# Generate JWT secret
export JWT_SECRET_KEY="$(openssl rand -hex 32)"

# Generate encryption key
export ENCRYPTION_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
```

### 4. Configure OAuth (Optional)

Follow platform-specific guides to obtain credentials:

**Twitter:** https://developer.twitter.com/en/apps
**Facebook/Instagram:** https://developers.facebook.com/apps
**LinkedIn:** https://www.linkedin.com/developers/apps
**YouTube:** https://console.cloud.google.com/

```bash
export TWITTER_CLIENT_ID="your_id"
export TWITTER_CLIENT_SECRET="your_secret"
export META_APP_ID="your_id"
export META_APP_SECRET="your_secret"
export LINKEDIN_CLIENT_ID="your_id"
export LINKEDIN_CLIENT_SECRET="your_secret"
export GOOGLE_CLIENT_ID="your_id"
export GOOGLE_CLIENT_SECRET="your_secret"
```

### 5. Create Media Directories

```bash
mkdir -p media/thumbnails
chmod 755 media
```

### 6. Start Application

```bash
python3 app.py
```

### 7. Verify Installation

```bash
# Check status
curl http://localhost:33766/api/v2/status

# Expected response:
{
  "database": true,
  "oauth": true,
  "media": true,
  "analytics": true,
  "webhooks": true,
  "timestamp": "2026-01-11T20:00:00Z"
}
```

---

## API Version Comparison

### V1 (Original) - `/api/*`
- In-memory storage
- Simulated OAuth
- No authentication required
- Demo/testing purposes

### V2 (Production) - `/api/v2/*`
- Database-backed
- Real OAuth implementations
- Authentication required
- Production-ready

**Both versions coexist** - V1 for backward compatibility, V2 for new features.

---

## Migration Path

### From Development to Production

1. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

2. **Configure database**
   ```bash
   export DATABASE_URL="postgresql://localhost/mastablasta"
   python3 -c "from database import init_db; init_db()"
   ```

3. **Configure authentication**
   ```bash
   export JWT_SECRET_KEY="$(openssl rand -hex 32)"
   export ENCRYPTION_KEY="..."
   ```

4. **Restart application**
   - Application automatically detects production mode
   - V2 endpoints become available
   - V1 endpoints continue working

5. **Migrate data** (optional)
   - Export from V1 in-memory storage
   - Import into V2 database using bulk operations

---

## Testing

### Unit Tests
```bash
pytest tests/test_database.py
pytest tests/test_oauth.py
pytest tests/test_media.py
pytest tests/test_auth.py
```

### Integration Tests
```bash
pytest tests/test_integration.py
```

### Load Tests
```bash
locust -f tests/load_test.py
```

---

## Monitoring & Logging

All operations are logged with appropriate levels:

```
INFO  - Successful operations
WARN  - Recoverable issues (retries)
ERROR - Failed operations (with details)
```

View logs:
```bash
tail -f app.log
```

---

## Troubleshooting

### Database Connection Issues
```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Reinitialize database
python3 -c "from database import init_db; init_db()"
```

### OAuth Issues
```bash
# Check credentials
echo $TWITTER_CLIENT_ID
echo $META_APP_ID

# Verify redirect URLs in platform settings
# Should match: http://your-domain/api/v2/oauth/{platform}/callback
```

### Media Upload Issues
```bash
# Check permissions
ls -la media/
chmod 755 media/
mkdir -p media/thumbnails

# Check disk space
df -h
```

### Authentication Issues
```bash
# Generate new JWT secret
export JWT_SECRET_KEY="$(openssl rand -hex 32)"

# Check token in request
curl -H "Authorization: Bearer TOKEN" http://localhost:33766/api/v2/auth/me
```

---

## Performance Optimization

### Database
- Connection pooling (10 connections, 20 max overflow)
- Indexes on frequently queried fields
- Query optimization with EXPLAIN ANALYZE

### API
- Response caching where appropriate
- Pagination for large result sets
- Async operations for long-running tasks

### Media
- Thumbnail generation for fast previews
- Image compression for web delivery
- CDN integration (optional)

---

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Rotate JWT secrets** regularly
3. **Use HTTPS** in production
4. **Enable rate limiting** on API endpoints
5. **Validate all inputs** (already implemented)
6. **Encrypt OAuth tokens** (already implemented)
7. **Use strong passwords** (bcrypt with 12 rounds)
8. **Verify webhook signatures** before processing

---

## Support & Documentation

- **Main README**: `/README.md`
- **Production Setup**: `/PRODUCTION_SETUP.md`
- **API Documentation**: Auto-generated from OpenAPI spec
- **Database Schema**: See `/models.py`
- **OAuth Guide**: See `/oauth.py` docstrings

---

## Next Steps

With these 9 improvements implemented, the application is production-ready. Consider:

1. **Deploy to production server**
2. **Set up monitoring** (Prometheus, Grafana)
3. **Configure backups** (automated database backups)
4. **Set up CI/CD** (GitHub Actions, Jenkins)
5. **Add more platforms** (Mastodon, Reddit, etc.)
6. **Implement caching** (Redis for session/cache)
7. **Add queue system** (Celery for background tasks)
8. **Set up load balancing** (nginx, HAProxy)

---

## Summary

The 9 improvements transform MastaBlasta from a demo application into a production-ready SaaS platform:

✅ **Database** - Data persistence and scalability
✅ **OAuth** - Real platform integrations
✅ **Media** - Professional asset management
✅ **Auth** - Enterprise-grade security
✅ **Analytics** - Real performance data
✅ **Webhooks** - System integrations
✅ **Search** - Advanced filtering
✅ **Bulk Ops** - Operational efficiency
✅ **Retry** - Reliability and resilience

**All 9 improvements are fully implemented and ready for production use.**
