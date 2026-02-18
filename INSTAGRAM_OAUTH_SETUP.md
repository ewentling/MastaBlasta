# Instagram OAuth Setup Guide for MastaBlasta

This guide will help you set up Instagram OAuth so users can connect their Instagram accounts with a simple "Connect" button.

## Overview

MastaBlasta uses Meta (Facebook) OAuth 2.0 with the Graph API v20.0 to enable users to:
- Connect their Instagram Business/Creator accounts
- Post photos and videos to Instagram
- Manage Instagram content
- Integrate with n8n workflows via API

**Important**: Instagram uses the same OAuth system as Facebook (Meta). You'll need a Facebook app to connect Instagram.

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
         └─────────────▶│ Instagram API   │
                        │  (via Meta)     │
                        │     v20.0       │
                        └─────────────────┘
```

## Prerequisites

1. **Facebook Developer Account**
   - Required for Instagram API access
   - Create at [developers.facebook.com](https://developers.facebook.com)

2. **Facebook App**
   - Same app can handle both Facebook and Instagram

3. **Instagram Business or Creator Account**
   - Personal Instagram accounts cannot be used for API posting
   - Must be connected to a Facebook Page

4. **Facebook Page**
   - Your Instagram account must be linked to a Facebook Page
   - This is done in Instagram settings

## Quick Start

**If you've already set up Facebook OAuth:**
- ✅ You're almost done!
- ✅ Use the same credentials (META_APP_ID and META_APP_SECRET)
- ✅ Just add Instagram-specific scopes
- ✅ Link your Instagram account to a Facebook Page

**If you haven't set up Facebook OAuth yet:**
- 📘 Follow the complete Facebook setup guide first: [FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)
- Then return here for Instagram-specific steps

## Step 1: Complete Facebook App Setup

### 1.1 Follow Facebook OAuth Setup

If you haven't already, complete the Facebook OAuth setup:

1. See [FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md) for detailed instructions
2. Create Facebook App
3. Add Facebook Login product
4. Configure OAuth settings
5. Get Client ID and Client Secret

### 1.2 Verify Your Credentials

You should have:
- `META_APP_ID` - Your Facebook App ID
- `META_APP_SECRET` - Your Facebook App Secret
- `META_REDIRECT_URI` - Your callback URL

## Step 2: Add Instagram to Your Facebook App

### 2.1 Add Instagram Product

1. Go to [Facebook Developers](https://developers.facebook.com)
2. Select your app
3. Click **"Add Product"**
4. Find **"Instagram Graph API"** (not Instagram Basic Display)
5. Click **"Set Up"**

### 2.2 Configure Instagram Settings

1. In Instagram Graph API settings
2. Add your **redirect URI**: `http://localhost:33766/api/oauth/meta/callback`
3. Same as Facebook - they share the OAuth configuration

## Step 3: Link Instagram to Facebook Page

**This is crucial - Instagram API only works with Business/Creator accounts linked to a Facebook Page.**

### 3.1 Convert to Business/Creator Account

1. Open Instagram mobile app
2. Go to **Settings** → **Account**
3. Select **"Switch to Professional Account"**
4. Choose **Business** or **Creator**
5. Complete the setup

### 3.2 Connect to Facebook Page

1. In Instagram Settings → **Account**
2. Select **"Linked accounts"**
3. Tap **"Facebook"**
4. Login and select your Facebook Page
5. Confirm the connection

**Verify Connection:**
- Go to your Facebook Page
- Check Page Settings → Instagram
- Your Instagram account should be listed

## Step 4: Configure MastaBlasta

### Option A: Environment Variables (System-wide)

**Same as Facebook** - use these variables:

```bash
# Meta (Facebook/Instagram) OAuth Configuration
META_APP_ID=your_app_id_here
META_APP_SECRET=your_app_secret_here
META_REDIRECT_URI=http://localhost:33766/api/oauth/meta/callback
```

**Note**: One app handles both Facebook and Instagram!

### Option B: Per-User OAuth Apps

Users configure their own Facebook apps (same process as Facebook):

1. Login to MastaBlasta
2. Go to **Accounts** page
3. Click **"OAuth Apps"** button
4. Click **"Add OAuth App"**
5. Fill in:
   - **Platform**: Facebook (handles Instagram too!)
   - **Client ID**: Your App ID
   - **Client Secret**: Your App Secret
   - **Redirect URI**: `http://localhost:33766/api/oauth/meta/callback`

## Step 5: OAuth Scopes and Permissions

### Required Scopes (Already Configured)

MastaBlasta automatically requests these scopes:

1. **instagram_basic** - Basic Instagram access
2. **instagram_content_publish** - Post content to Instagram
3. **pages_show_list** - List Facebook Pages (for Instagram connection)
4. **pages_read_engagement** - Read Page insights

### App Review Requirements

Before going public, request these permissions from Facebook:
1. **instagram_content_publish** - Requires review
2. **instagram_basic** - Usually auto-approved

**During Review:**
- You can test with your own account
- Add test users in App Roles
- Provide screenshots of your posting flow

## Step 6: Connect Instagram Account (User Flow)

### From Web UI

1. User logs into MastaBlasta
2. Navigates to **Accounts** page
3. Clicks **"Quick Connect"** button
4. Selects **"Instagram"** from dropdown
5. Clicks **"Connect with OAuth"**
6. Popup window opens with Facebook/Instagram authorization
7. User logs in and authorizes permissions
8. **Selects Facebook Page** (which has Instagram linked)
9. MastaBlasta receives:
   - Facebook Page access
   - Instagram Business Account ID
   - Long-lived Page Access Token
10. Account appears in Connected Accounts list

### What Gets Stored

```json
{
  "account": {
    "platform": "instagram",
    "platform_user_id": "instagram_business_account_id",
    "display_name": "Instagram Account Name",
    "oauth_token": "encrypted_page_access_token",
    "platform_metadata": {
      "facebook_page_id": "123456789",
      "instagram_business_account": "987654321",
      "page_name": "My Business Page"
    }
  }
}
```

## Step 7: Using the API (for n8n and other integrations)

### Authentication

All API calls require authentication (same as other platforms):

```bash
# Get auth token
curl -X POST http://localhost:33766/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password"}'
```

### API Endpoints

#### Post to Instagram

```bash
POST /api/v2/posts
Authorization: ******
Content-Type: application/json

{
  "content": "Check out this amazing photo! 📸 #photography",
  "platforms": ["instagram"],
  "media_ids": ["media-uuid"],
  "post_options": {
    "instagram_account_id": "987654321"
  }
}
```

**Note**: Instagram requires media (images or videos) - you cannot post text-only content.

### n8n Integration Example

```json
{
  "method": "POST",
  "url": "http://localhost:33766/api/v2/posts",
  "headers": {
    "Authorization": "******",
    "Content-Type": "application/json"
  },
  "body": {
    "content": "{{$json.caption}}",
    "platforms": ["instagram"],
    "media_ids": ["{{$json.media_id}}"]
  }
}
```

## Troubleshooting

### "No active instagram account found for user"

**Solution**: Connect Instagram account
- Must connect through Facebook Page
- Instagram account must be Business/Creator
- Must be linked to Facebook Page

### "Instagram account not linked to Page"

**Solution**: Link Instagram to Facebook Page
- Open Instagram mobile app
- Settings → Linked accounts → Facebook
- Connect to your Facebook Page

### "Not a Business/Creator account"

**Solution**: Convert to Business account
- Instagram Settings → Account
- Switch to Professional Account
- Choose Business or Creator

### "Instagram account ID not found"

**Solution**: Verify Page connection
- Check Facebook Page settings
- Instagram should be listed under Connected Accounts
- Reconnect if needed

### "Media is required for Instagram posts"

**Solution**: Instagram doesn't support text-only posts
- Always upload an image or video
- Use `/api/v2/media/upload` first
- Then include `media_ids` in post

### OAuth Popup Blocked

**Solution**: Same as Facebook
- Allow popups for your domain
- Check browser settings

## Instagram API Limitations

### Content Requirements

**Images:**
- **Formats**: JPG, PNG
- **Size**: 1080x1080 (square), 1080x1350 (portrait), 1080x566 (landscape)
- **Aspect ratio**: 4:5 (portrait) to 1.91:1 (landscape)
- **File size**: Max 8MB

**Videos:**
- **Formats**: MP4, MOV
- **Duration**: 3-60 seconds (Feed), up to 15 min (IGTV)
- **Size**: 1080x1920 (stories), 1080x1080 (square)
- **File size**: Max 100MB

**Captions:**
- **Length**: Max 2,200 characters
- **Hashtags**: Max 30 hashtags
- **Mentions**: Max 20 mentions

### Posting Restrictions

- Cannot post to personal accounts (Business/Creator only)
- Cannot post Stories via API
- Cannot post Reels via API (coming soon)
- Images must be publicly accessible URLs
- Videos must be publicly accessible URLs

## Instagram Best Practices

### Content Guidelines

✅ High-quality images (1080x1080 minimum)  
✅ Engaging captions with emojis  
✅ 5-10 relevant hashtags  
✅ Call-to-action in caption  
✅ Consistent posting schedule  

❌ Low-resolution images  
❌ Watermarked content  
❌ Excessive hashtags (looks spammy)  
❌ Copyrighted content  

### Optimal Posting

- **Best days**: Wednesday, Thursday, Friday
- **Best times**: 11 AM - 1 PM, 7 PM - 9 PM
- **Frequency**: 1-2 posts per day maximum
- **Hashtags**: Mix of popular and niche tags

### What Works on Instagram

✅ Visual storytelling  
✅ Behind-the-scenes content  
✅ User-generated content  
✅ Product showcases  
✅ Inspirational quotes  
✅ Tutorials and tips  

## API Reference

### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oauth/init/instagram` | Initialize OAuth flow |
| GET | `/api/oauth/callback/meta` | Handle OAuth callback (shared with Facebook) |
| POST | `/api/oauth/connect` | Complete OAuth connection |
| GET | `/api/accounts` | List connected accounts |
| POST | `/api/v2/media/upload` | Upload image/video |
| POST | `/api/v2/posts` | Create Instagram post |
| POST | `/api/v2/posts/{id}/publish` | Publish to Instagram |

## Support and Resources

- **Instagram Graph API Docs**: https://developers.facebook.com/docs/instagram-api
- **Content Publishing**: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
- **Business Account Setup**: https://help.instagram.com/502981923235522
- **Page Connection**: https://help.instagram.com/399237934150902

## Version History

- **Graph API v20.0** (Current)
- Instagram Business Account integration
- Content publishing support
- Page Access Token storage

---

**Questions?** Check the [QUICK_INSTAGRAM_CONNECT.md](./QUICK_INSTAGRAM_CONNECT.md) for user-friendly instructions.
