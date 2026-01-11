# Quick Start Guide - Production Features

## 🚀 Get Started in 5 Minutes

### Development Mode (No Setup Required)

```bash
# Clone repository
git clone https://github.com/ewentling/MastaBlasta.git
cd MastaBlasta

# Install basic dependencies (if not already installed)
pip install flask flask-cors apscheduler

# Run application
python3 app.py

# Access at http://localhost:33766
```

**You're done!** Development mode uses in-memory storage and simulated OAuth.

---

### Production Mode (Full Features)

```bash
# 1. Install all dependencies
pip install -r requirements.txt

# 2. Set up PostgreSQL
createdb mastablasta
export DATABASE_URL="postgresql://localhost/mastablasta"
python3 -c "from database import init_db; init_db()"

# 3. Configure security
export JWT_SECRET_KEY="$(openssl rand -hex 32)"
export ENCRYPTION_KEY="$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')"

# 4. Create media directory
mkdir -p media/thumbnails

# 5. Run application
python3 app.py
```

**You're done!** Production mode is now active with all 9 improvements.

---

## Verify Installation

```bash
# Check status
curl http://localhost:33766/api/v2/status

# Should return:
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

## Test API

```bash
# Register a user
curl -X POST http://localhost:33766/api/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"demo123","name":"Demo User"}'

# Response includes access_token - use it for authenticated requests
curl -X GET http://localhost:33766/api/v2/posts \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

---

## What You Get

### Development Mode (`/api/*`)
- ✓ Original endpoints
- ✓ In-memory storage
- ✓ Simulated OAuth
- ✓ No authentication required

### Production Mode (`/api/v2/*`)
- ✓ Database persistence
- ✓ Real OAuth (Twitter, Facebook, Instagram, LinkedIn, YouTube)
- ✓ JWT authentication
- ✓ Media uploads
- ✓ Real analytics
- ✓ Webhooks
- ✓ Advanced search
- ✓ Bulk operations
- ✓ Retry logic

**Both modes work simultaneously** - choose which one to use!

---

## Need Help?

- **Full Documentation**: See [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md)
- **Setup Details**: See [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)
- **Implementation Details**: See [IMPLEMENTATION_COMPLETE.md](IMPLEMENTATION_COMPLETE.md)
- **Main README**: See [README.md](README.md)

---

## What's New in This PR

**All 9 Production Improvements Implemented:**

1. ✅ PostgreSQL Database Integration
2. ✅ Real OAuth (Twitter, Facebook, Instagram, LinkedIn, YouTube)
3. ✅ Media Upload System (images & videos)
4. ✅ JWT Authentication & Role-Based Access
5. ✅ Real Analytics Collection from Platform APIs
6. ✅ Webhook System with Retry Logic
7. ✅ Advanced Search & Filtering
8. ✅ Bulk Operations (Create, Update, Delete)
9. ✅ Error Recovery & Retry Logic

**New API Endpoints**: 28 endpoints at `/api/v2/*`

**New Files**: 
- `app_extensions.py` (826 lines) - Core managers
- `integrated_routes.py` (587 lines) - API endpoints
- `IMPLEMENTATION_GUIDE.md` (781 lines) - Full documentation

**Total New Code**: 2,194 lines

---

## Quick Reference

### Development Mode
```bash
python3 app.py
# Uses /api/* endpoints
# No setup required
```

### Production Mode
```bash
export DATABASE_URL="postgresql://localhost/mastablasta"
python3 app.py
# Uses /api/v2/* endpoints
# Full features enabled
```

### Check Which Mode
```bash
curl http://localhost:33766/api/v2/status
```

---

**Ready to go? Start with Development Mode and upgrade to Production when ready!**
