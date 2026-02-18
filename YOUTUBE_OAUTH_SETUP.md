# YouTube OAuth Setup Guide for MastaBlasta

This guide will help you set up YouTube OAuth so users can connect their YouTube channels with a simple "Connect" button.

## Overview

MastaBlasta uses Google OAuth 2.0 to enable users to:
- Connect their YouTube channels
- Upload videos to YouTube
- Manage video metadata
- Integrate with n8n workflows via API

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Web Frontend  │────▶│  MastaBlasta    │◀────│      n8n        │
│  (React UI)     │     │   Backend       │     │   (Workflows)   │
│                 │     │  (Flask API)    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      ▼
         │              ┌─────────────────┐
         └─────────────▶│   YouTube API   │
                        │      v3         │
                        └─────────────────┘
```

## Prerequisites

1. **Google Account**
   - You need a Google account to use YouTube

2. **YouTube Channel**
   - Must have a YouTube channel created
   - Create one at [youtube.com](https://youtube.com) if needed

3. **Google Cloud Project**
   - Create a project in Google Cloud Console
   - Enable YouTube Data API v3

## Step 1: Create Google Cloud Project

### 1.1 Access Google Cloud Console

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click **"Select a project"** dropdown at the top
4. Click **"New Project"**

### 1.2 Create Project

1. **Project name**: "MastaBlasta YouTube Integration"
2. **Organization**: Leave as "No organization" (unless you have one)
3. **Location**: Leave as default
4. Click **"Create"**
5. Wait for project creation (takes a few seconds)
6. Select your new project from the dropdown

## Step 2: Enable YouTube Data API

### 2.1 Enable API

1. In Google Cloud Console, go to **"APIs & Services"** → **"Library"**
2. Search for **"YouTube Data API v3"**
3. Click on **"YouTube Data API v3"**
4. Click **"Enable"**
5. Wait for API to be enabled

### 2.2 Understand Quotas

YouTube API has daily quotas:
- **Free tier**: 10,000 units per day
- **Video upload**: 1,600 units per upload
- **~6 video uploads per day** with free quota

To increase quota:
- Request quota increase from Google
- Or upgrade to paid plan

## Step 3: Create OAuth Credentials

### 3.1 Configure OAuth Consent Screen

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **User Type**:
   - **Internal**: For Google Workspace users only
   - **External**: For any Google account (choose this)
3. Click **"Create"**

### 3.2 Fill in App Information

**App information:**
- **App name**: "MastaBlasta"
- **User support email**: Your email
- **App logo**: Optional (upload if you have one)

**App domain:**
- **Application home page**: `http://localhost:33766` or your domain
- **Application privacy policy**: Your privacy policy URL
- **Application terms of service**: Your terms URL (optional)

**Authorized domains:**
- Add your domain (e.g., `yourdomain.com`)
- For development, you can skip this

**Developer contact information:**
- **Email addresses**: Your email

4. Click **"Save and Continue"**

### 3.3 Add Scopes

1. Click **"Add or Remove Scopes"**
2. Select these scopes:
   - `https://www.googleapis.com/auth/youtube.upload` - Upload videos
   - `https://www.googleapis.com/auth/youtube` - Manage YouTube account
3. Click **"Update"**
4. Click **"Save and Continue"**

### 3.4 Add Test Users (for testing)

1. Click **"Add Users"**
2. Add your email and any testers' emails
3. Click **"Add"**
4. Click **"Save and Continue"**

**Note**: In testing mode, only test users can authorize. To go public, submit for verification.

### 3.5 Review and Confirm

1. Review your OAuth consent screen settings
2. Click **"Back to Dashboard"**

## Step 4: Create OAuth Client ID

### 4.1 Create Credentials

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. **Application type**: Web application
4. **Name**: "MastaBlasta OAuth Client"

### 4.2 Configure Authorized URLs

**Authorized JavaScript origins:**
- `http://localhost:33766`
- `https://yourdomain.com` (for production)

**Authorized redirect URIs:**
- Development: `http://localhost:33766/api/oauth/youtube/callback`
- Production: `https://yourdomain.com/api/oauth/youtube/callback`

5. Click **"Create"**

### 4.3 Save Credentials

1. A popup will show your **Client ID** and **Client Secret**
2. Download JSON (optional) or copy the credentials
3. Store securely - you'll need them for configuration

## Step 5: Configure MastaBlasta

### Option A: Environment Variables (System-wide)

Add to your `.env` file or environment:

```bash
# YouTube/Google OAuth Configuration
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:33766/api/oauth/youtube/callback
```

**Pros**: Quick setup, all users share same app  
**Cons**: Shared quota, less flexible

### Option B: Per-User OAuth Apps (Recommended)

Users can configure their own Google Cloud projects via the UI:

1. Login to MastaBlasta
2. Go to **Accounts** page
3. Click **"OAuth Apps"** button
4. Click **"Add OAuth App"**
5. Fill in:
   - **Platform**: YouTube
   - **App Name**: Your project name (optional)
   - **Client ID**: Your Client ID
   - **Client Secret**: Your Client Secret
   - **Redirect URI**: `http://localhost:33766/api/oauth/youtube/callback`

**Pros**: Each user has own quota, more uploads  
**Cons**: Users need Google Cloud projects

## Step 6: OAuth Scopes and Permissions

### Required Scopes

The following scopes are automatically requested during OAuth:

1. **youtube.upload** - Upload and manage videos
2. **youtube** - Manage YouTube account and videos

### YouTube API Quotas

**Free Tier:**
- 10,000 quota units per day
- Video upload: 1,600 units
- Video delete: 50 units
- Metadata update: 50 units

**Calculation:**
- ~6 video uploads per day
- Or many metadata operations

**Request Quota Increase:**
- Go to "APIs & Services" → "Quotas"
- Select YouTube Data API v3
- Request increase (requires justification)

## Step 7: Connect YouTube Channel (User Flow)

### From Web UI

1. User logs into MastaBlasta
2. Navigates to **Accounts** page
3. Clicks **"Quick Connect"** button
4. Selects **"YouTube"** from dropdown
5. Clicks **"Connect with OAuth"**
6. Popup window opens with Google authorization
7. User selects Google account
8. Authorizes YouTube permissions
9. MastaBlasta receives:
   - Access token
   - Refresh token (for long-term access)
   - YouTube channel information
10. Account appears in Connected Accounts list

### What Gets Stored

```json
{
  "account": {
    "platform": "youtube",
    "platform_user_id": "UC1234567890abcdef",
    "platform_username": "My Channel",
    "display_name": "My Channel Name",
    "oauth_token": "encrypted_access_token",
    "refresh_token": "encrypted_refresh_token",
    "token_expires_at": "2026-02-18T15:00:00Z"
  }
}
```

## Step 8: Using the API (for n8n and other integrations)

### Authentication

All API calls require authentication:

```bash
# Get auth token
curl -X POST http://localhost:33766/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'

# Returns: {"access_token": "...", "refresh_token": "..."}
```

Use the access token in subsequent requests:
```bash
Authorization: ******
```

### API Endpoints

#### 1. List Connected Accounts

```bash
GET /api/accounts
Authorization: ******

Response:
{
  "accounts": [
    {
      "id": "account-uuid",
      "platform": "youtube",
      "platform_username": "My Channel",
      "display_name": "My Channel Name",
      "is_active": true
    }
  ]
}
```

#### 2. Upload Video

```bash
# 1. Upload video file first
POST /api/v2/media/upload
Authorization: ******
Content-Type: multipart/form-data

file: <video_file>

Response:
{
  "success": true,
  "media_id": "media-uuid"
}

# 2. Create YouTube post
POST /api/v2/posts
Authorization: ******
Content-Type: application/json

{
  "content": "My Video Title\n\nVideo description here",
  "platforms": ["youtube"],
  "media_ids": ["media-uuid"],
  "post_options": {
    "title": "My Amazing Video",
    "description": "Full video description",
    "tags": ["tutorial", "howto", "example"],
    "privacy": "public",
    "category": "22"
  }
}
```

#### 3. Publish Video

```bash
POST /api/v2/posts/{post_id}/publish
Authorization: ******

Response:
{
  "results": {
    "youtube": {
      "id": "dQw4w9WgXcQ",
      "success": true,
      "url": "https://youtube.com/watch?v=dQw4w9WgXcQ"
    }
  }
}
```

### n8n Integration Example

**Webhook Trigger → HTTP Request Node:**

```json
{
  "method": "POST",
  "url": "http://localhost:33766/api/v2/posts",
  "headers": {
    "Authorization": "******",
    "Content-Type": "application/json"
  },
  "body": {
    "content": "{{$json.video_title}}",
    "platforms": ["youtube"],
    "media_ids": ["{{$json.media_id}}"],
    "post_options": {
      "title": "{{$json.title}}",
      "description": "{{$json.description}}",
      "tags": ["{{$json.tags}}"],
      "privacy": "public"
    }
  }
}
```

## Troubleshooting

### "No active youtube account found for user"

**Solution**: User needs to connect a YouTube channel first
- Go to Accounts page
- Click "Quick Connect"
- Connect YouTube

### "No YouTube channel found"

**Solution**: Create a YouTube channel
- Go to [youtube.com](https://youtube.com)
- Click your profile icon
- Create a channel
- Then reconnect in MastaBlasta

### OAuth Popup Blocked

**Solution**: Allow popups for your domain
- Browser may block OAuth popup
- Add exception in browser settings

### "Invalid OAuth Redirect URI"

**Solution**: Check Google Cloud Console
- Redirect URI must match exactly
- Include http/https correctly
- No trailing slashes

### "Token has expired"

**Solution**: Tokens auto-refresh
- Access tokens expire after 1 hour
- Refresh tokens used automatically
- If refresh fails, reconnect

### "Quota exceeded"

**Solution**: Monitor quota usage
- Check "APIs & Services" → "Quotas" in Google Cloud
- Free tier: 10,000 units/day
- Request increase if needed
- Consider per-user OAuth apps

### "API not enabled"

**Solution**: Enable YouTube Data API v3
- Google Cloud Console
- "APIs & Services" → "Library"
- Enable YouTube Data API v3

### "App not verified"

**Solution**: Add yourself as test user
- Or submit for verification (takes weeks)
- For testing, add users in OAuth consent screen

## Security Best Practices

1. **Never expose Client Secret client-side**
   - Always keep it server-side
   - Store in environment variables
   - Encrypt in database

2. **Use HTTPS in production**
   - Google requires HTTPS for production
   - Get SSL certificate

3. **Validate redirect URIs**
   - Only allow known redirect URIs
   - Validate state parameter

4. **Store tokens securely**
   - MastaBlasta encrypts all tokens
   - Automatic token refresh
   - Never log tokens

5. **Monitor quota usage**
   - Track daily API usage
   - Implement rate limiting
   - Alert on quota warnings

## Advanced Features

### Video Privacy Settings

```json
{
  "post_options": {
    "privacy": "public"    // or "private", "unlisted"
  }
}
```

### Video Categories

Common category IDs:
- **1**: Film & Animation
- **10**: Music
- **15**: Pets & Animals
- **17**: Sports
- **19**: Travel & Events
- **20**: Gaming
- **22**: People & Blogs (default)
- **23**: Comedy
- **24**: Entertainment
- **25**: News & Politics
- **26**: Howto & Style
- **27**: Education
- **28**: Science & Technology

### Video Thumbnails

Custom thumbnails (requires verification):
```bash
# Upload thumbnail after video upload
POST /api/youtube/thumbnails/{video_id}
Content-Type: multipart/form-data

file: <thumbnail_image>
```

### Scheduling Videos

```bash
POST /api/v2/posts
{
  "content": "Video title",
  "platforms": ["youtube"],
  "scheduled_time": "2026-02-20T10:00:00Z",
  "post_options": {
    "privacy": "private"  // Keep private until scheduled
  }
}
```

## YouTube Best Practices

### Video Optimization

1. **Title**: 60 characters or less
2. **Description**: First 157 characters appear in search
3. **Tags**: 10-15 relevant tags
4. **Thumbnail**: 1280x720, under 2MB
5. **Categories**: Choose most relevant
6. **Cards & End screens**: Add after upload

### Content Guidelines

✅ Original content  
✅ Proper licensing for music  
✅ Follow community guidelines  
✅ Appropriate content ratings  

❌ Copyrighted content  
❌ Misleading metadata  
❌ Spam or deceptive practices  

### Upload Recommendations

- **Resolution**: 1080p minimum, 4K recommended
- **Format**: MP4 (H.264 + AAC)
- **File size**: Under 256GB
- **Length**: Under 12 hours
- **Aspect ratio**: 16:9 for best compatibility

## API Reference

### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oauth/init/youtube` | Initialize OAuth flow |
| GET | `/api/oauth/callback/youtube` | Handle OAuth callback |
| POST | `/api/oauth/connect` | Complete OAuth connection |
| GET | `/api/accounts` | List connected accounts |
| POST | `/api/v2/media/upload` | Upload video file |
| POST | `/api/v2/posts` | Create video post |
| POST | `/api/v2/posts/{id}/publish` | Upload to YouTube |

## YouTube API Limitations

### Upload Restrictions

- **File size**: Max 256GB
- **Duration**: Max 12 hours (15 min for unverified)
- **Daily uploads**: ~6 videos (free quota)
- **Formats**: MP4, AVI, MOV, FLV, WMV, etc.

### Rate Limits

- **Quota**: 10,000 units/day (free)
- **Concurrent uploads**: 1 at a time recommended
- **API calls**: Standard rate limits apply

## Support and Resources

- **Google Cloud Console**: https://console.cloud.google.com/
- **YouTube Data API**: https://developers.google.com/youtube/v3
- **OAuth Guide**: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
- **Quota Calculator**: https://developers.google.com/youtube/v3/determine_quota_cost
- **Community**: https://support.google.com/youtube/community

## Version History

- **YouTube Data API v3** (Current)
- OAuth 2.0 with refresh tokens
- Automatic token refresh
- Video upload support

---

**Questions?** Check the [QUICK_YOUTUBE_CONNECT.md](./QUICK_YOUTUBE_CONNECT.md) for user-friendly instructions.
