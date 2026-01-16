# MastaBlasta Production Deployment Checklist

Use this checklist before deploying MastaBlasta to production or for personal use.

## ✅ Prerequisites

### 1. System Requirements
- [ ] Python 3.9+ installed
- [ ] Node.js 18+ installed (for frontend development)
- [ ] PostgreSQL 13+ database
- [ ] FFmpeg installed (for video clipping features)
- [ ] Redis installed (optional, recommended for production)

### 2. API Keys & Credentials

#### Required (Core Features)
- [ ] `DATABASE_URL` - PostgreSQL connection string
- [ ] `JWT_SECRET_KEY` - Secure random string for JWT signing
- [ ] `ENCRYPTION_KEY` - Fernet encryption key (generate with `from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())`)
- [ ] `SECRET_KEY` - Flask secret key

#### AI Features (Required for AI functionality)
- [ ] `OPENAI_API_KEY` - OpenAI API key from platform.openai.com
  - Used for: Content generation, hashtags, translation, alt text (GPT-4V)
  - Test with: `curl -H "Authorization: Bearer YOUR_KEY" https://api.openai.com/v1/models`

#### Google Services (Optional)
- [ ] `GOOGLE_CLIENT_ID` - From Google Cloud Console
- [ ] `GOOGLE_CLIENT_SECRET` - From Google Cloud Console
- [ ] `GOOGLE_REDIRECT_URI` - Your callback URL (e.g., https://yourdomain.com/api/oauth/google/callback)
- [ ] `GEMINI_API_KEY` or `GOOGLE_API_KEY` - For video clipper feature from makersuite.google.com/app/apikey

**Google Cloud Console Setup:**
1. Go to https://console.cloud.google.com/
2. Create a new project
3. Enable APIs:
   - [ ] Google Calendar API
   - [ ] Google Drive API
   - [ ] YouTube Data API v3 (if using YouTube)
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - [ ] `{YOUR_DOMAIN}/api/oauth/google/callback`
   - [ ] `{YOUR_DOMAIN}/api/google-calendar/callback`
   - [ ] `{YOUR_DOMAIN}/api/google-drive/callback`

#### Platform OAuth (Optional - per platform)
- [ ] **Twitter:**
  - `TWITTER_CLIENT_ID`
  - `TWITTER_CLIENT_SECRET`
  - `TWITTER_BEARER_TOKEN` (for social monitoring)
- [ ] **Meta (Facebook/Instagram):**
  - `META_APP_ID`
  - `META_APP_SECRET`
- [ ] **LinkedIn:**
  - `LINKEDIN_CLIENT_ID`
  - `LINKEDIN_CLIENT_SECRET`
- [ ] **Reddit (Social Monitoring):**
  - `REDDIT_CLIENT_ID`
  - `REDDIT_CLIENT_SECRET`

#### Optional Enhancements
- [ ] `REDIS_URL` - For distributed rate limiting (e.g., redis://localhost:6379/0)
- [ ] `FRONTEND_URL` - Your frontend URL (e.g., https://yourdomain.com)

## 📦 Installation Steps

### 1. Clone and Setup
```bash
# Clone repository
git clone https://github.com/ewentling/MastaBlasta.git
cd MastaBlasta

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Database Setup
```bash
# Set DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@localhost:5432/mastablasta"

# Run database migrations
alembic upgrade head
```

### 3. Environment Configuration
```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API keys
nano .env  # or use your preferred editor
```

### 4. Frontend Build (for production)
```bash
cd frontend
npm install
npm run build
cd ..
```

## 🔒 Security Checklist

- [ ] All API keys are set in environment variables (not hardcoded)
- [ ] `SECRET_KEY` and `JWT_SECRET_KEY` are strong random strings
- [ ] Database uses SSL/TLS in production
- [ ] CORS is properly configured for your domain
- [ ] Rate limiting is enabled (use Redis for multi-instance deployments)
- [ ] HTTPS is enabled for all endpoints
- [ ] Environment variables are not committed to git
- [ ] `.env` file is in `.gitignore`

## ✅ Feature Validation

### Core Features
- [ ] **Authentication**
  - [ ] Email/password registration works
  - [ ] Email/password login works
  - [ ] Google One Tap login works
  - [ ] Password policy is enforced (8+ chars, mixed case, digit, special char)
  - [ ] JWT tokens are generated and validated

### AI Features (if OPENAI_API_KEY configured)
- [ ] Content generation works (`/api/ai/generate-caption`)
- [ ] Hashtag suggestions work (`/api/ai/suggest-hashtags`)
- [ ] Content improvement/rewriting works (`/api/ai/rewrite-content`)
- [ ] Translation works (`/api/ai/translate-content`)
- [ ] Alt text generation works (GPT-4 Vision)

### Google Services (if configured)
- [ ] Google Calendar OAuth flow works
- [ ] Calendar sync creates real events
- [ ] Google Drive OAuth flow works
- [ ] Drive file listing shows real files

### Video Clipper (if GEMINI_API_KEY configured)
- [ ] Video URL analysis works
- [ ] Viral clip suggestions are generated
- [ ] Proper error messages for invalid URLs
- [ ] Timeout handling works

### Social Monitoring (if Twitter/Reddit APIs configured)
- [ ] Twitter mentions are fetched (real data)
- [ ] Reddit mentions are fetched (real data)
- [ ] Sentiment analysis works
- [ ] Falls back to demo data if APIs not configured

### Platform Publishing
- [ ] Twitter OAuth works
- [ ] Meta (Facebook/Instagram) OAuth works
- [ ] LinkedIn OAuth works
- [ ] YouTube OAuth works

## 🚀 Deployment Steps

### Option 1: Docker Deployment (Recommended)
```bash
# Build and run with Docker
docker-compose up -d

# Check logs
docker-compose logs -f
```

### Option 2: Manual Deployment
```bash
# Set all environment variables
source .env  # or export manually

# Run with Gunicorn (production)
gunicorn -w 4 -b 0.0.0.0:33766 app:app

# Or use the startup script
python app.py
```

### Option 3: Cloud Platform
- **Heroku**: Use provided `Procfile` and set environment variables
- **AWS/GCP/Azure**: Use container deployment or VM with above setup
- **Vercel/Netlify**: Frontend only, point to your backend API

## 🧪 Testing Checklist

### Pre-Deployment Testing
- [ ] Run Python tests: `python -m pytest test_suite.py -v`
- [ ] Check Python syntax: `python -m py_compile app.py`
- [ ] Test frontend build: `cd frontend && npm run build`
- [ ] Test API health: `curl http://localhost:33766/api/health`

### Post-Deployment Testing
- [ ] Access the application in browser
- [ ] Register a new account
- [ ] Login with email/password
- [ ] Login with Google One Tap
- [ ] Create a test post
- [ ] Schedule a post
- [ ] Test AI content generation
- [ ] Test platform connections (if configured)
- [ ] Check error handling (try invalid inputs)

## 📊 Monitoring

### Health Checks
- [ ] `/api/health` endpoint returns 200
- [ ] Database connection is healthy
- [ ] All required APIs respond (OpenAI, Google, etc.)

### Logs
- [ ] Application logs are being captured
- [ ] Error logs are monitored
- [ ] API rate limits are tracked

### Metrics (Optional)
- [ ] Request/response times
- [ ] Error rates
- [ ] API usage costs
- [ ] Database performance

## 🔧 Troubleshooting

### Common Issues

**Issue: "Video clipper service not enabled"**
- Solution: Set `GEMINI_API_KEY` or `GOOGLE_API_KEY` and install `yt-dlp`

**Issue: "AI content generation not enabled"**
- Solution: Set `OPENAI_API_KEY` in environment

**Issue: "Database connection failed"**
- Solution: Verify `DATABASE_URL` is correct and PostgreSQL is running

**Issue: "Google OAuth fails"**
- Solution: Check redirect URIs in Google Cloud Console match your deployment URLs

**Issue: "Port 33766 already in use"**
- Solution: Change port with `PORT` environment variable or stop conflicting service

**Issue: "Frontend can't connect to backend"**
- Solution: Set `VITE_API_BASE_URL` environment variable for frontend build

## 📱 Production Best Practices

### Performance
- [ ] Use Redis for caching and rate limiting
- [ ] Enable database connection pooling
- [ ] Use CDN for static assets
- [ ] Implement request/response compression

### Backup & Recovery
- [ ] Database backups are scheduled
- [ ] Backup retention policy is defined
- [ ] Recovery procedure is documented and tested

### Scaling
- [ ] Consider load balancer for multiple instances
- [ ] Use managed database service
- [ ] Implement horizontal scaling strategy

### Cost Management
- [ ] Monitor OpenAI API usage (costs per request)
- [ ] Set API usage limits if needed
- [ ] Track cloud infrastructure costs

## ✅ Final Checklist

Before going live:
- [ ] All environment variables are set
- [ ] Database migrations are applied
- [ ] SSL/TLS certificates are installed
- [ ] Domain DNS is configured
- [ ] Firewall rules are set
- [ ] Monitoring is enabled
- [ ] Backup system is active
- [ ] Team has access credentials
- [ ] Documentation is up to date

## 🎉 You're Ready!

Once all items are checked, your MastaBlasta instance is production-ready and safe to use for personal or business purposes.

For issues or questions:
- Check `PRODUCTION_READY.md` for feature status
- Review `README.md` for detailed setup instructions
- Check application logs for error details
