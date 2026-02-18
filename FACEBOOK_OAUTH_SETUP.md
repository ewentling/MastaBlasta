# Facebook OAuth Setup Guide for MastaBlasta

This guide will help you set up Facebook OAuth so users can connect their Facebook accounts with a simple "Connect" button.

## Overview

MastaBlasta uses Facebook OAuth 2.0 with the Graph API v20.0 to enable users to:
- Connect their Facebook accounts
- Post to Facebook Pages they manage
- Fetch long-lived Page Access Tokens
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
         └─────────────▶│  Facebook API   │
                        │     v20.0       │
                        └─────────────────┘
```

## Prerequisites

1. **Facebook Developer Account**
   - Go to [developers.facebook.com](https://developers.facebook.com)
   - Sign in and create a developer account

2. **Facebook App**
   - Create a new app in the Facebook Developer Console
   - Choose "Business" or "Consumer" type

3. **Facebook Page** (for posting)
   - Users need to manage at least one Facebook Page
   - Personal profile posting is heavily restricted by Facebook

## Step 1: Create Facebook App

### 1.1 Register Your App

1. Visit [Facebook Developers](https://developers.facebook.com)
2. Click "My Apps" → "Create App"
3. Select "Business" or "Consumer"
4. Fill in:
   - **App Name**: Your app name (e.g., "MastaBlasta Social Manager")
   - **App Contact Email**: Your email
   - **Business Account**: Optional

### 1.2 Add Facebook Login Product

1. In your app dashboard, click "Add Product"
2. Find "Facebook Login" and click "Set Up"
3. Select "Web" as platform
4. Enter Site URL: `http://localhost:33766` (development) or your production URL

### 1.3 Configure OAuth Settings

1. Go to **Products** → **Facebook Login** → **Settings**
2. Add Valid OAuth Redirect URIs:
   ```
   http://localhost:33766/api/oauth/callback/facebook
   http://localhost:33766/api/oauth/callback/meta
   ```
   For production:
   ```
   https://yourdomain.com/api/oauth/callback/facebook
   https://yourdomain.com/api/oauth/callback/meta
   ```

### 1.4 Get Your Credentials

1. Go to **Settings** → **Basic**
2. Copy:
   - **App ID** (also called Client ID)
   - **App Secret** (click "Show" to reveal)

## Step 2: Configure MastaBlasta

### Option A: Environment Variables (System-wide)

Add to your `.env` file or environment:

```bash
# Facebook/Meta OAuth Configuration
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_REDIRECT_URI=http://localhost:33766/api/oauth/callback/meta
```

**Pros**: Quick setup, all users share same app
**Cons**: Less flexible, all users use same Facebook app

### Option B: Per-User OAuth Apps (Recommended)

Users can configure their own Facebook apps via the UI:

1. Login to MastaBlasta
2. Go to **Accounts** page
3. Click **"OAuth Apps"** button
4. Click **"Add OAuth App"**
5. Fill in:
   - **Platform**: Facebook
   - **App Name**: Your Facebook app name (optional)
   - **Client ID**: Your App ID
   - **Client Secret**: Your App Secret
   - **Redirect URI**: `http://localhost:33766/api/oauth/callback/meta`

**Pros**: Each user uses their own Facebook app, more control
**Cons**: Users need to create their own Facebook apps

## Step 3: Request Permissions (App Review)

Facebook requires App Review for most permissions before your app can be used by the public.

### Required Permissions

The following scopes are automatically requested during OAuth:

1. **pages_manage_posts** - Create posts on Pages
2. **pages_read_engagement** - Read Page insights
3. **pages_show_list** - List Pages user manages
4. **instagram_basic** - Basic Instagram access (if using Instagram)
5. **instagram_content_publish** - Post to Instagram (if using Instagram)

### Scopes for Development

During development, you can:
- Use your own Facebook account
- Add test users in **App Roles** → **Roles** → **Add Testers**
- Test users can use all permissions without App Review

### Submit for App Review

When ready for production:

1. Go to **App Review** → **Permissions and Features**
2. Request the permissions listed above
3. Provide:
   - Screencast showing how your app uses each permission
   - Detailed description of use case
   - Privacy Policy URL
   - Terms of Service URL

**Note**: App Review can take 3-7 days

## Step 4: Connect Facebook Account (User Flow)

### From Web UI

1. User logs into MastaBlasta
2. Navigates to **Accounts** page
3. Clicks **"Quick Connect"** button
4. Selects **"Facebook"** from dropdown
5. Clicks **"Connect with OAuth"**
6. Popup window opens with Facebook login
7. User logs in and authorizes permissions
8. MastaBlasta fetches:
   - User access token (60-day expiry)
   - All Facebook Pages user manages
   - Page Access Tokens (long-lived, no expiry)
9. Account appears in Connected Accounts list

### What Gets Stored

```json
{
  "account": {
    "platform": "facebook",
    "platform_user_id": "123456789",
    "display_name": "John Doe",
    "oauth_token": "encrypted_user_token",
    "platform_metadata": {
      "user_info": {
        "id": "123456789",
        "name": "John Doe"
      },
      "pages": [
        {
          "page_id": "987654321",
          "page_name": "My Business Page",
          "page_access_token": "long_lived_token",
          "category": "Business",
          "instagram_business_account": "111222333"
        }
      ]
    }
  }
}
```

## Step 5: Using the API (for n8n and other integrations)

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
Authorization: Bearer <access_token>
```

### API Endpoints

#### 1. List Connected Accounts

```bash
GET /api/accounts
Authorization: Bearer <token>

Response:
{
  "accounts": [
    {
      "id": "account-uuid",
      "platform": "facebook",
      "display_name": "John Doe",
      "is_active": true
    }
  ]
}
```

#### 2. Create a Post

```bash
POST /api/v2/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Check out this amazing post!",
  "platforms": ["facebook"],
  "post_options": {
    "page_id": "987654321"  // Optional, uses first page if not specified
  }
}

Response:
{
  "success": true,
  "post_id": "post-uuid"
}
```

#### 3. Publish Post

```bash
POST /api/v2/posts/{post_id}/publish
Authorization: Bearer <token>

Response:
{
  "results": {
    "facebook": {
      "id": "987654321_123456789",
      "message": "Check out this amazing post!"
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
    "Authorization": "Bearer {{$env.MASTABLASTA_TOKEN}}",
    "Content-Type": "application/json"
  },
  "body": {
    "content": "{{$json.message}}",
    "platforms": ["facebook"],
    "post_options": {
      "page_id": "{{$json.page_id}}"
    }
  }
}
```

## Troubleshooting

### "No active facebook account found for user"

**Solution**: User needs to connect a Facebook account first
- Go to Accounts page
- Click "Quick Connect"
- Connect Facebook

### "Page ID is required for Facebook posting"

**Solution**: Specify which page to post to
```json
{
  "post_options": {
    "page_id": "your_page_id"
  }
}
```

Or let the system auto-select the first page by omitting `page_id`.

### "Token has expired"

**Solution**: Reconnect the account
- Facebook user tokens expire after 60 days
- Page tokens are long-lived but can be revoked
- User needs to click "Quick Connect" again to refresh

### OAuth Popup Blocked

**Solution**: Allow popups for your domain
- Browser may block OAuth popup
- Add exception in browser settings
- Or use popup blocker extension to allow

### "Invalid OAuth Redirect URI"

**Solution**: Check Facebook app settings
- Redirect URI must match exactly
- Include http/https correctly
- No trailing slashes
- Must be added in Facebook Login settings

## Security Best Practices

1. **Never expose App Secret client-side**
   - Always keep it server-side
   - Store in environment variables
   - Encrypt in database

2. **Use HTTPS in production**
   - Facebook requires HTTPS for production apps
   - Get SSL certificate (Let's Encrypt is free)

3. **Validate redirect URIs**
   - Only allow known redirect URIs
   - Validate state parameter to prevent CSRF

4. **Store tokens securely**
   - MastaBlasta encrypts all tokens
   - Never log tokens
   - Rotate tokens periodically

5. **Implement rate limiting**
   - Protect API endpoints
   - Follow Facebook's rate limits
   - Handle 429 responses gracefully

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

# 2. Create post with media
POST /api/v2/posts
{
  "content": "Check this out!",
  "platforms": ["facebook"],
  "media_ids": ["media-uuid"],
  "post_options": {
    "page_id": "987654321"
  }
}
```

### Scheduling Posts

```bash
POST /api/v2/posts
{
  "content": "Scheduled post",
  "platforms": ["facebook"],
  "scheduled_time": "2026-02-20T10:00:00Z"
}
```

### Multiple Pages

If user manages multiple pages, specify which one:

```json
{
  "post_options": {
    "page_id": "page_1_id"  // Post to specific page
  }
}
```

Or post to all pages (requires multiple API calls):

```python
for page in pages:
    create_post(content, page_id=page['page_id'])
```

## API Reference

### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oauth/init/facebook` | Initialize OAuth flow |
| GET | `/api/oauth/callback/facebook` | Handle OAuth callback |
| POST | `/api/oauth/connect` | Complete OAuth connection |
| GET | `/api/accounts` | List connected accounts |
| POST | `/api/v2/posts` | Create a new post |
| POST | `/api/v2/posts/{id}/publish` | Publish post to platforms |
| GET | `/api/v2/posts` | List all posts |
| GET | `/api/platforms` | List supported platforms |

## Support and Resources

- **Facebook Developer Docs**: https://developers.facebook.com/docs/facebook-login
- **Graph API Reference**: https://developers.facebook.com/docs/graph-api
- **Page Access Tokens**: https://developers.facebook.com/docs/pages/access-tokens
- **App Review**: https://developers.facebook.com/docs/app-review

## Version History

- **v20.0** (Current) - Latest Facebook Graph API version
- Added `pages_show_list` scope for page selection
- Implemented Page Access Token storage
- Fixed account lookup issues

---

**Questions?** Check the [PLATFORM_SETUP.md](./PLATFORM_SETUP.md) for more platform-specific setup guides.
