# Production Setup Guide

This guide covers setting up the MastaBlasta application with all production-ready features including database persistence, media management, real OAuth, analytics, and user authentication.

## Architecture Overview

The application now includes:
1. **PostgreSQL Database** - Persistent data storage with SQLAlchemy ORM
2. **Media Management System** - File uploads, storage, and optimization
3. **Real OAuth Integration** - Twitter, Meta (Facebook/Instagram), LinkedIn, Google (YouTube)
4. **Analytics Dashboard** - Real metrics collection and reporting
5. **User Authentication** - JWT-based auth with role-based access control

## Database Setup

### Prerequisites
- PostgreSQL 12+ installed
- Python 3.9+ installed

### Installation

```bash
# Install PostgreSQL (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database
sudo -u postgres createdb mastablasta

# Create user (optional)
sudo -u postgres psql
CREATE USER mastablasta_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE mastablasta TO mastablasta_user;
\q
```

### Configuration

Set the `DATABASE_URL` environment variable:

```bash
# For local development
export DATABASE_URL="postgresql://localhost/mastablasta"

# For production with credentials
export DATABASE_URL="postgresql://username:password@localhost/mastablasta"

# For Docker/remote database
export DATABASE_URL="postgresql://username:password@hostname:5432/mastablasta"
```

### Initialize Database

```bash
# Install dependencies
pip install -r requirements.txt

# Initialize database schema
python3 -c "from database import init_db; init_db()"

# Or use migrations (recommended for production)
alembic upgrade head
```

## Media Management Setup

### Directory Structure

The media system requires specific directories:

```
/media/
├── {user_id}/
│   ├── file1.jpg
│   ├── file2.mp4
│   └── ...
└── thumbnails/
    └── {user_id}/
        ├── thumb_file1.jpg
        └── ...
```

### Configuration

```bash
# Create media directory
mkdir -p /home/runner/work/MastaBlasta/MastaBlasta/media
mkdir -p /home/runner/work/MastaBlasta/MastaBlasta/media/thumbnails

# Set permissions
chmod 755 /home/runner/work/MastaBlasta/MastaBlasta/media
```

### File Limits

- Images: 10 MB maximum
- Videos: 500 MB maximum
- Supported formats:
  - Images: JPG, PNG, GIF, WebP
  - Videos: MP4, MOV, AVI, MKV, WebM

## OAuth Setup

### Twitter/X Configuration

1. Create app at https://developer.twitter.com/
2. Enable OAuth 2.0 with PKCE
3. Set redirect URI: `http://localhost:33766/api/oauth/twitter/callback`
4. Configure environment variables:

```bash
export TWITTER_CLIENT_ID="your_client_id"
export TWITTER_CLIENT_SECRET="your_client_secret"
export TWITTER_REDIRECT_URI="http://localhost:33766/api/oauth/twitter/callback"
```

### Meta (Facebook/Instagram) Configuration

1. Create app at https://developers.facebook.com/
2. Add Facebook Login and Instagram Basic Display products
3. Set OAuth redirect URI: `http://localhost:33766/api/oauth/meta/callback`
4. Request required permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic`
   - `instagram_content_publish`

```bash
export META_APP_ID="your_app_id"
export META_APP_SECRET="your_app_secret"
export META_REDIRECT_URI="http://localhost:33766/api/oauth/meta/callback"
```

### LinkedIn Configuration

1. Create app at https://www.linkedin.com/developers/
2. Request API access with required scopes
3. Set redirect URI: `http://localhost:33766/api/oauth/linkedin/callback`

```bash
export LINKEDIN_CLIENT_ID="your_client_id"
export LINKEDIN_CLIENT_SECRET="your_client_secret"
export LINKEDIN_REDIRECT_URI="http://localhost:33766/api/oauth/linkedin/callback"
```

### Google (YouTube) Configuration

1. Create project at https://console.cloud.google.com/
2. Enable YouTube Data API v3
3. Create OAuth 2.0 credentials
4. Set redirect URI: `http://localhost:33766/api/oauth/google/callback"

```bash
export GOOGLE_CLIENT_ID="your_client_id"
export GOOGLE_CLIENT_SECRET="your_client_secret"
export GOOGLE_REDIRECT_URI="http://localhost:33766/api/oauth/google/callback"
```

## Authentication Setup

### JWT Configuration

```bash
# Generate a secure secret key
export JWT_SECRET_KEY="$(openssl rand -hex 32)"

# Generate encryption key for OAuth tokens
export ENCRYPTION_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"
```

### User Roles

Three roles are available:
- **Admin**: Full access (manage users, settings, billing)
- **Editor**: Create, edit, and publish posts
- **Viewer**: Read-only access to analytics

### API Authentication

Two methods are supported:

1. **JWT Token** (recommended for web/mobile apps):
```bash
# Login to get token
curl -X POST http://localhost:33766/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Use token in requests
curl http://localhost:33766/api/posts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

2. **API Key** (for server-to-server integrations):
```bash
# Generate API key from user settings or admin panel
curl http://localhost:33766/api/posts \
  -H "X-API-Key: YOUR_API_KEY"
```

## Running the Application

### Development

```bash
# Set environment variables
export DATABASE_URL="postgresql://localhost/mastablasta"
export JWT_SECRET_KEY="your_secret_key"
export OPENAI_API_KEY="your_openai_key"  # Optional for AI features

# Run application
python3 app.py
```

### Production (with Gunicorn)

```bash
# Install gunicorn
pip install gunicorn

# Run with multiple workers
gunicorn -w 4 -b 0.0.0.0:33766 app:app

# With environment file
gunicorn -w 4 -b 0.0.0.0:33766 --env-file .env app:app
```

### Docker Deployment

```bash
# Build image
docker build -t mastablasta:latest .

# Run container with auto-restart and recovery
docker run -d \
  --restart unless-stopped \
  --name mastablasta-api \
  -p 33766:33766 \
  -e DATABASE_URL="postgresql://host.docker.internal/mastablasta" \
  -e JWT_SECRET_KEY="your_secret_key" \
  -e TWITTER_CLIENT_ID="your_id" \
  -e TWITTER_CLIENT_SECRET="your_secret" \
  -v $(pwd)/media:/app/media \
  mastablasta:latest
```

**Auto-Restart Configuration**:
- The `--restart unless-stopped` policy ensures the container:
  - ✅ Starts automatically on system boot
  - ✅ Restarts automatically on crashes or failures
  - ✅ Stays stopped only when manually stopped
- This provides high availability for production deployments

## API Endpoints

### Authentication

```
POST   /api/auth/register     - Register new user
POST   /api/auth/login        - Login user
POST   /api/auth/refresh      - Refresh access token
POST   /api/auth/logout       - Logout user
GET    /api/users/me          - Get current user
POST   /api/users/invite      - Invite team member (admin only)
GET    /api/users/team        - List team members
```

### OAuth

```
GET    /api/oauth/{platform}/authorize   - Start OAuth flow
GET    /api/oauth/{platform}/callback    - OAuth callback
GET    /api/accounts                     - List connected accounts
DELETE /api/accounts/{id}                - Disconnect account
```

### Media

```
POST   /api/media/upload      - Upload file
GET    /api/media             - List media
GET    /api/media/{id}        - Get media details
DELETE /api/media/{id}        - Delete media
GET    /api/media/{id}/file   - Download media file
```

### Analytics

```
GET    /api/analytics/overview           - Dashboard overview
GET    /api/analytics/posts/{id}         - Post-specific metrics
GET    /api/analytics/best-times         - Optimal posting times
GET    /api/analytics/platforms          - Platform comparison
GET    /api/analytics/export             - Export to CSV
```

### Posts (existing endpoints now use database)

All existing post endpoints remain the same but now persist to PostgreSQL instead of memory.

## Database Schema

### Core Tables

- **users** - User accounts and authentication
- **accounts** - Social media platform accounts
- **posts** - Posts and schedules
- **media** - Uploaded media files
- **post_analytics** - Performance metrics

### Supporting Tables

- **templates** - Post templates
- **ab_tests** - A/B testing experiments
- **social_monitors** - Social listening configuration
- **url_shortener** - URL shortening and tracking
- **response_templates** - Automated responses
- **chatbot_interactions** - Conversation history

## Monitoring and Maintenance

### Database Backups

```bash
# Backup database
pg_dump mastablasta > backup_$(date +%Y%m%d).sql

# Restore database
psql mastablasta < backup_20260111.sql
```

### Log Files

```bash
# View application logs
tail -f /var/log/mastablasta/app.log

# View database logs
tail -f /var/log/postgresql/postgresql-12-main.log
```

### Performance Monitoring

Monitor these metrics:
- Database connection pool usage
- API response times
- File storage usage
- OAuth token refresh failures
- Failed post attempts

## Security Considerations

1. **Environment Variables**: Never commit secrets to git
2. **HTTPS**: Use HTTPS in production for OAuth callbacks
3. **Password Policy**: Enforce strong passwords (min 8 chars, mixed case, numbers)
4. **Rate Limiting**: Implement rate limiting on auth endpoints
5. **File Validation**: Validate file types and scan for malware
6. **SQL Injection**: Use parameterized queries (SQLAlchemy handles this)
7. **XSS Protection**: Sanitize user input in frontend
8. **CORS**: Configure CORS properly for your domain

## Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql -d mastablasta -c "SELECT 1;"

# Check DATABASE_URL format
echo $DATABASE_URL
```

### OAuth Errors

- Verify redirect URIs match exactly (including http vs https)
- Check API credentials are correct
- Ensure required scopes are requested
- Verify app is not in development mode (for production)

### File Upload Issues

- Check directory permissions: `chmod 755 /path/to/media`
- Verify file size limits
- Check disk space: `df -h`
- Ensure PIL/Pillow is installed for image processing

## Support

For issues and questions:
- GitHub Issues: https://github.com/ewentling/MastaBlasta/issues
- Documentation: See README.md
- Email: support@mastablasta.com (if configured)
