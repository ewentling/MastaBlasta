# Twitter/X OAuth Setup Guide for MastaBlasta

This guide will help you set up Twitter OAuth so users can connect their Twitter/X accounts with a simple "Connect" button.

## Overview

MastaBlasta uses Twitter OAuth 2.0 with PKCE (Proof Key for Code Exchange) to enable users to:
- Connect their Twitter/X accounts
- Post tweets and threads
- Manage tweet media
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
         └─────────────▶│   Twitter API   │
                        │      v2         │
                        └─────────────────┘
```

## Prerequisites

1. **Twitter/X Account**
   - You need a Twitter account to create a developer account

2. **Twitter Developer Account**
   - Apply at [developer.twitter.com](https://developer.twitter.com)
   - Approval typically takes a few days

3. **Twitter App**
   - Create an app in the Twitter Developer Portal
   - Get Client ID and Client Secret

## Step 1: Create Twitter Developer Account

### 1.1 Apply for Developer Access

1. Visit [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Sign in with your Twitter account
3. Click **"Apply for a developer account"**
4. Choose your use case:
   - **Hobbyist** - Making a bot or building a test app
   - **Professional** - Building production apps
   - **Business** - Building apps for your organization
5. Fill in the application form:
   - How will you use the Twitter API?
   - Will you analyze tweets?
   - Will you display tweets off Twitter?
   - Will your app use Tweet, Retweet, Like, or Follow?
6. Agree to Terms of Service
7. Verify your email address
8. Wait for approval (usually 1-3 days)

### 1.2 Developer Portal Overview

Once approved, you'll have access to:
- **Projects** - Container for apps
- **Apps** - Individual applications
- **API Keys** - Client ID and Client Secret
- **Access Tokens** - For direct API access

## Step 2: Create Twitter App

### 2.1 Create a New App

1. Go to [Developer Portal Dashboard](https://developer.twitter.com/en/portal/dashboard)
2. Click **"+ Create Project"** (or use an existing project)
3. Fill in project details:
   - **Project Name**: "MastaBlasta Social Manager"
   - **Use Case**: Choose appropriate option
   - **Project Description**: Brief description of your app
4. Click **"Next"**
5. Click **"+ Add App"** to create an app within the project
6. **App Name**: "MastaBlasta OAuth App"
7. Copy the **API Key**, **API Secret**, and **Bearer Token** (save these securely)
8. Click **"App Settings"**

### 2.2 Configure OAuth 2.0 Settings

1. In your app dashboard, go to **"Settings"**
2. Scroll to **"User authentication settings"**
3. Click **"Set up"** (or **"Edit"** if already configured)
4. Configure OAuth 2.0:
   - **App permissions**: 
     - ✅ Read
     - ✅ Write (required for posting)
   - **Type of App**: Web App, Automated App or Bot
   - **App info**:
     - **Callback URI / Redirect URL**: 
       - Development: `http://localhost:33766/api/oauth/twitter/callback`
       - Production: `https://yourdomain.com/api/oauth/twitter/callback`
     - **Website URL**: Your website or `http://localhost:33766`
5. Click **"Save"**

### 2.3 Get OAuth 2.0 Credentials

1. Go to **"Keys and tokens"** tab
2. Under **"OAuth 2.0 Client ID and Client Secret"**:
   - Copy **Client ID**
   - Click **"Generate"** and copy **Client Secret** (shown only once!)
3. Store these securely - you'll need them for configuration

## Step 3: Configure MastaBlasta

### Option A: Environment Variables (System-wide)

Add to your `.env` file or environment:

```bash
# Twitter OAuth Configuration
TWITTER_CLIENT_ID=your_client_id_here
TWITTER_CLIENT_SECRET=your_client_secret_here
TWITTER_REDIRECT_URI=http://localhost:33766/api/oauth/twitter/callback
```

**Pros**: Quick setup, all users share same app
**Cons**: Less flexible, single rate limit shared

### Option B: Per-User OAuth Apps (Recommended)

Users can configure their own Twitter apps via the UI:

1. Login to MastaBlasta
2. Go to **Accounts** page
3. Click **"OAuth Apps"** button
4. Click **"Add OAuth App"**
5. Fill in:
   - **Platform**: Twitter
   - **App Name**: Your Twitter app name (optional)
   - **Client ID**: Your Client ID
   - **Client Secret**: Your Client Secret
   - **Redirect URI**: `http://localhost:33766/api/oauth/twitter/callback`

**Pros**: Each user uses their own app, separate rate limits
**Cons**: Users need to create Twitter developer apps

## Step 4: OAuth Scopes and Permissions

### Required Scopes

The following scopes are automatically requested during OAuth:

1. **tweet.read** - Read tweets and user profile
2. **tweet.write** - Post tweets, retweets, quote tweets
3. **users.read** - Read user information
4. **offline.access** - Get refresh tokens for long-lived access

### Rate Limits

**Free Tier (Essential Access):**
- 50 tweets per 24 hours
- 500,000 tweets read per month

**Basic Tier ($100/month):**
- 3,000 tweets per month
- 10,000 tweets read per month

**Pro Tier ($5,000/month):**
- 300,000 tweets per month
- 1,000,000 tweets read per month

Note: Rate limits apply per app, not per user.

## Step 5: Connect Twitter Account (User Flow)

### From Web UI

1. User logs into MastaBlasta
2. Navigates to **Accounts** page
3. Clicks **"Quick Connect"** button
4. Selects **"Twitter"** from dropdown
5. Clicks **"Connect with OAuth"**
6. Popup window opens with Twitter authorization
7. User logs in (if not already) and authorizes permissions
8. MastaBlasta receives:
   - Access token (2 hour expiry)
   - Refresh token (for token renewal)
   - User information
9. Account appears in Connected Accounts list

### What Gets Stored

```json
{
  "account": {
    "platform": "twitter",
    "platform_user_id": "1234567890",
    "platform_username": "username",
    "display_name": "Display Name",
    "oauth_token": "encrypted_access_token",
    "refresh_token": "encrypted_refresh_token",
    "token_expires_at": "2026-02-18T14:00:00Z"
  }
}
```

## Step 6: Using the API (for n8n and other integrations)

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
      "platform": "twitter",
      "platform_username": "username",
      "display_name": "Display Name",
      "is_active": true
    }
  ]
}
```

#### 2. Create a Tweet

```bash
POST /api/v2/posts
Authorization: ******
Content-Type: application/json

{
  "content": "Hello from MastaBlasta! 🚀",
  "platforms": ["twitter"]
}

Response:
{
  "success": true,
  "post_id": "post-uuid"
}
```

#### 3. Publish Tweet

```bash
POST /api/v2/posts/{post_id}/publish
Authorization: ******

Response:
{
  "results": {
    "twitter": {
      "id": "1234567890123456789",
      "text": "Hello from MastaBlasta! 🚀"
    }
  }
}
```

#### 4. Create Thread

```bash
POST /api/v2/posts
Authorization: ******
Content-Type: application/json

{
  "content": "This is a long tweet that will be automatically split into a thread. It contains multiple thoughts and ideas that need more than 280 characters to express properly.",
  "platforms": ["twitter"],
  "post_options": {
    "post_type": "thread"
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
    "content": "{{$json.tweet_text}}",
    "platforms": ["twitter"]
  }
}
```

## Troubleshooting

### "No active twitter account found for user"

**Solution**: User needs to connect a Twitter account first
- Go to Accounts page
- Click "Quick Connect"
- Connect Twitter

### "Token has expired"

**Solution**: Tokens automatically refresh
- Access tokens expire after 2 hours
- MastaBlasta automatically uses refresh token
- If refresh fails, reconnect the account

### OAuth Popup Blocked

**Solution**: Allow popups for your domain
- Browser may block OAuth popup
- Add exception in browser settings
- Or use popup blocker extension to allow

### "Invalid OAuth Redirect URI"

**Solution**: Check Twitter app settings
- Redirect URI must match exactly
- Include http/https correctly
- No trailing slashes
- Must be added in User Authentication settings

### "App does not have write permissions"

**Solution**: Enable write permissions
- Go to Twitter Developer Portal
- App Settings → User authentication settings
- Enable "Read and Write" permissions
- Reconnect the account

### Rate Limit Exceeded

**Solution**: Monitor usage and upgrade if needed
- Check your usage in Developer Portal
- Free tier has strict limits
- Consider upgrading to Basic or Pro tier
- Implement posting schedules to stay within limits

## Security Best Practices

1. **Never expose Client Secret client-side**
   - Always keep it server-side
   - Store in environment variables
   - Encrypt in database

2. **Use HTTPS in production**
   - Twitter requires HTTPS for production apps
   - Get SSL certificate (Let's Encrypt is free)

3. **Validate redirect URIs**
   - Only allow known redirect URIs
   - Validate state parameter to prevent CSRF

4. **Store tokens securely**
   - MastaBlasta encrypts all tokens
   - Never log tokens
   - Auto-refresh before expiry

5. **Implement rate limiting**
   - Protect API endpoints
   - Follow Twitter's rate limits
   - Handle 429 responses gracefully

6. **PKCE Security**
   - Twitter requires PKCE for OAuth 2.0
   - Code verifier must be stored securely
   - Never expose code verifier to client

## Advanced Features

### Posting with Media

```bash
# 1. Upload media first
POST /api/v2/media/upload
Content-Type: multipart/form-data

file: <image_file>

Response:
{
  "success": true,
  "media_id": "media-uuid"
}

# 2. Create tweet with media
POST /api/v2/posts
{
  "content": "Check this out!",
  "platforms": ["twitter"],
  "media_ids": ["media-uuid"]
}
```

### Thread Creation

Twitter threads are automatically created when content exceeds 280 characters:

```python
# Long content is split at word boundaries
content = "This is a very long tweet..." # > 280 chars
# Automatically becomes: Tweet 1/3, Tweet 2/3, Tweet 3/3
```

### Scheduling Tweets

```bash
POST /api/v2/posts
{
  "content": "Scheduled tweet",
  "platforms": ["twitter"],
  "scheduled_time": "2026-02-20T10:00:00Z"
}
```

## API Reference

### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oauth/init/twitter` | Initialize OAuth flow |
| GET | `/api/oauth/callback/twitter` | Handle OAuth callback |
| POST | `/api/oauth/connect` | Complete OAuth connection |
| GET | `/api/accounts` | List connected accounts |
| POST | `/api/v2/posts` | Create a new tweet |
| POST | `/api/v2/posts/{id}/publish` | Publish tweet |
| GET | `/api/v2/posts` | List all posts |
| POST | `/api/v2/media/upload` | Upload media for tweets |

## Twitter API Limitations

### Content Restrictions

- **Tweet length**: 280 characters (4,000 for Twitter Blue)
- **Media**: Up to 4 images or 1 video per tweet
- **Video size**: Max 512MB
- **Image formats**: JPG, PNG, GIF, WEBP
- **Video formats**: MP4, MOV

### Best Practices

1. **Optimal Tweet Length**: 100-280 characters
2. **Posting Time**: Consider audience timezone
3. **Hashtags**: 1-2 hashtags per tweet
4. **Mentions**: Tag relevant accounts
5. **Media**: Always include engaging images/videos
6. **Threads**: Use for longer stories
7. **Frequency**: 3-5 tweets per day optimal

## Support and Resources

- **Twitter Developer Docs**: https://developer.twitter.com/en/docs
- **API Reference**: https://developer.twitter.com/en/docs/twitter-api
- **OAuth 2.0 Guide**: https://developer.twitter.com/en/docs/authentication/oauth-2-0
- **Rate Limits**: https://developer.twitter.com/en/docs/twitter-api/rate-limits
- **Community Forum**: https://twittercommunity.com/

## Version History

- **OAuth 2.0 with PKCE** (Current) - Secure authentication
- Automatic token refresh
- Thread support
- Media upload support

---

**Questions?** Check the [QUICK_TWITTER_CONNECT.md](./QUICK_TWITTER_CONNECT.md) for user-friendly instructions.
