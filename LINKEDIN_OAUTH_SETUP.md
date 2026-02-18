# LinkedIn OAuth Setup Guide for MastaBlasta

This guide will help you set up LinkedIn OAuth so users can connect their LinkedIn accounts with a simple "Connect" button.

## Overview

MastaBlasta uses LinkedIn OAuth 2.0 to enable users to:
- Connect their LinkedIn accounts
- Post updates to LinkedIn
- Share content with their network
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
         └─────────────▶│  LinkedIn API   │
                        │      v2         │
                        └─────────────────┘
```

## Prerequisites

1. **LinkedIn Account**
   - Personal or business LinkedIn account

2. **LinkedIn Page** (recommended for business)
   - Company/Organization Page for business posting

3. **LinkedIn Developer Account**
   - Free to create at [LinkedIn Developers](https://www.linkedin.com/developers/)

## Step 1: Create LinkedIn App

### 1.1 Access Developer Portal

1. Visit [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Sign in with your LinkedIn account
3. Click **"Create app"**

### 1.2 Fill in App Details

1. **App name**: "MastaBlasta Social Manager" (or your preferred name)
2. **LinkedIn Page**: 
   - You must associate a LinkedIn Page
   - If you don't have one, create a Company Page first
3. **Privacy policy URL**: Your privacy policy (required)
   - Example: `https://yourdomain.com/privacy`
4. **App logo**: Upload a logo (required)
   - Minimum 100x100 pixels
   - Square format recommended
5. **Legal agreement**: Check the box to agree
6. Click **"Create app"**

### 1.3 Verify Your App

1. LinkedIn will send verification link to your Page admins
2. Click the verification link in the email
3. Your app status will change to "Verified"

## Step 2: Configure OAuth Settings

### 2.1 Set Up Authentication

1. In your app dashboard, go to the **"Auth"** tab
2. Under **"OAuth 2.0 settings"**, find **"Redirect URLs"**
3. Click **"Add redirect URL"**
4. Add your redirect URLs:
   - Development: `http://localhost:33766/api/oauth/linkedin/callback`
   - Production: `https://yourdomain.com/api/oauth/linkedin/callback`
5. Click **"Update"**

### 2.2 Get Your Credentials

1. Stay on the **"Auth"** tab
2. Under **"Application credentials"**, you'll find:
   - **Client ID**: Copy this
   - **Client Secret**: Click "Show" and copy (shown only once!)
3. Store these securely

## Step 3: Request API Products

### 3.1 Required Products

LinkedIn requires you to request access to specific products:

1. In your app dashboard, go to **"Products"** tab
2. Request these products:

**Sign In with LinkedIn using OpenID Connect**
- Status: Usually auto-approved
- Provides: Basic profile access

**Share on LinkedIn**
- Status: Requires review for some use cases
- Provides: Ability to post on behalf of users

### 3.2 Product Review Process

If review is required:
1. Click **"Request access"** for "Share on LinkedIn"
2. Fill in the use case form:
   - Describe how you'll use the API
   - Explain the user benefit
   - Provide screenshots of your UI
3. Submit for review
4. Wait for approval (typically 1-2 weeks)

**Note**: During review, you can still test with your own account and test accounts.

## Step 4: Configure MastaBlasta

### Option A: Environment Variables (System-wide)

Add to your `.env` file or environment:

```bash
# LinkedIn OAuth Configuration
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:33766/api/oauth/linkedin/callback
```

**Pros**: Quick setup, all users share same app  
**Cons**: Less flexible, single app for all users

### Option B: Per-User OAuth Apps (Recommended)

Users can configure their own LinkedIn apps via the UI:

1. Login to MastaBlasta
2. Go to **Accounts** page
3. Click **"OAuth Apps"** button
4. Click **"Add OAuth App"**
5. Fill in:
   - **Platform**: LinkedIn
   - **App Name**: Your LinkedIn app name (optional)
   - **Client ID**: Your Client ID
   - **Client Secret**: Your Client Secret
   - **Redirect URI**: `http://localhost:33766/api/oauth/linkedin/callback`

**Pros**: Each user uses their own app, more control  
**Cons**: Users need to create LinkedIn developer apps

## Step 5: OAuth Scopes and Permissions

### Required Scopes

The following scopes are automatically requested during OAuth:

1. **openid** - OpenID Connect authentication
2. **profile** - Access to profile information
3. **email** - Access to email address
4. **w_member_social** - Share content on LinkedIn

### LinkedIn Posting Permissions

**Personal Posts:**
- Share updates on your personal profile
- Up to 100 posts per user per day

**Organization Posts:**
- Requires additional setup
- Must have admin access to Organization Page
- Different API endpoint

## Step 6: Connect LinkedIn Account (User Flow)

### From Web UI

1. User logs into MastaBlasta
2. Navigates to **Accounts** page
3. Clicks **"Quick Connect"** button
4. Selects **"LinkedIn"** from dropdown
5. Clicks **"Connect with OAuth"**
6. Popup window opens with LinkedIn authorization
7. User logs in (if not already) and authorizes permissions
8. MastaBlasta receives:
   - Access token (60-day expiry)
   - User profile information
   - Email address
9. Account appears in Connected Accounts list

### What Gets Stored

```json
{
  "account": {
    "platform": "linkedin",
    "platform_user_id": "ABC123XYZ",
    "platform_username": "john-doe",
    "display_name": "John Doe",
    "oauth_token": "encrypted_access_token",
    "token_expires_at": "2026-04-18T12:00:00Z"
  }
}
```

## Step 7: Using the API (for n8n and other integrations)

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
      "platform": "linkedin",
      "display_name": "John Doe",
      "is_active": true
    }
  ]
}
```

#### 2. Create a LinkedIn Post

```bash
POST /api/v2/posts
Authorization: ******
Content-Type: application/json

{
  "content": "Excited to share my latest project! #innovation",
  "platforms": ["linkedin"]
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
Authorization: ******

Response:
{
  "results": {
    "linkedin": {
      "id": "urn:li:share:1234567890",
      "success": true
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
    "content": "{{$json.post_content}}",
    "platforms": ["linkedin"]
  }
}
```

## Troubleshooting

### "No active linkedin account found for user"

**Solution**: User needs to connect a LinkedIn account first
- Go to Accounts page
- Click "Quick Connect"
- Connect LinkedIn

### "Product access required"

**Solution**: Request "Share on LinkedIn" product
- Go to LinkedIn Developers portal
- Your app → Products tab
- Request "Share on LinkedIn"
- Submit for review if needed

### OAuth Popup Blocked

**Solution**: Allow popups for your domain
- Browser may block OAuth popup
- Add exception in browser settings

### "Invalid OAuth Redirect URI"

**Solution**: Check LinkedIn app settings
- Redirect URI must match exactly
- Include http/https correctly
- No trailing slashes
- Must be added in Auth tab

### "Token has expired"

**Solution**: Reconnect the account
- LinkedIn tokens expire after 60 days
- Reconnect to refresh

### "App not verified"

**Solution**: Verify your app
- Check email for verification link
- Must be verified by Page admin
- Status shows in app dashboard

## Security Best Practices

1. **Never expose Client Secret client-side**
   - Always keep it server-side
   - Store in environment variables
   - Encrypt in database

2. **Use HTTPS in production**
   - LinkedIn requires HTTPS for production
   - Get SSL certificate

3. **Validate redirect URIs**
   - Only allow known redirect URIs
   - Validate state parameter

4. **Store tokens securely**
   - MastaBlasta encrypts all tokens
   - Never log tokens
   - Handle expiration gracefully

5. **Respect rate limits**
   - 100 posts per user per day
   - Monitor usage
   - Implement retry logic

## Advanced Features

### Posting with Media

```bash
# 1. Upload image first
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
  "content": "Check out this image!",
  "platforms": ["linkedin"],
  "media_ids": ["media-uuid"]
}
```

### Scheduling Posts

```bash
POST /api/v2/posts
{
  "content": "Scheduled LinkedIn post",
  "platforms": ["linkedin"],
  "scheduled_time": "2026-02-20T10:00:00Z"
}
```

### Organization Posting

To post on behalf of an organization:
1. Must have admin access to Organization Page
2. Request additional permissions in LinkedIn app
3. Use organization URN in API calls

## LinkedIn Best Practices

### Content Guidelines

1. **Professional tone**: LinkedIn is a professional network
2. **Value-driven**: Share insights, not just updates
3. **Engagement**: Ask questions, encourage discussion
4. **Formatting**: Use paragraphs for readability
5. **Hashtags**: 3-5 relevant hashtags
6. **Links**: Share valuable resources
7. **Media**: Images increase engagement by 2x

### Optimal Posting

- **Best days**: Tuesday, Wednesday, Thursday
- **Best times**: 7-8 AM, 12 PM, 5-6 PM
- **Frequency**: 1-2 posts per day maximum
- **Length**: 150-300 characters ideal

### What Works on LinkedIn

✅ Industry insights and trends  
✅ Professional achievements  
✅ Thought leadership articles  
✅ Company updates and news  
✅ Career tips and advice  
✅ Educational content  

❌ Overly promotional content  
❌ Personal/casual posts  
❌ Controversial topics  
❌ Too frequent posting  

## API Reference

### Complete Endpoint List

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/oauth/init/linkedin` | Initialize OAuth flow |
| GET | `/api/oauth/callback/linkedin` | Handle OAuth callback |
| POST | `/api/oauth/connect` | Complete OAuth connection |
| GET | `/api/accounts` | List connected accounts |
| POST | `/api/v2/posts` | Create a new post |
| POST | `/api/v2/posts/{id}/publish` | Publish post to LinkedIn |
| GET | `/api/v2/posts` | List all posts |

## LinkedIn API Limitations

### Rate Limits

- **Posts**: 100 per user per day
- **API calls**: Varies by product
- **Throttling**: Implemented for excessive use

### Content Restrictions

- **Text length**: 3,000 characters maximum
- **Media**: Up to 9 images or 1 video
- **Video size**: Max 200MB
- **Image formats**: JPG, PNG, GIF
- **Video formats**: MP4, MOV

## Support and Resources

- **LinkedIn Developers**: https://www.linkedin.com/developers/
- **API Documentation**: https://learn.microsoft.com/en-us/linkedin/
- **OAuth Guide**: https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication
- **Share API**: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
- **Support**: https://www.linkedin.com/help/linkedin

## Version History

- **OAuth 2.0** (Current) - Secure authentication
- Share on LinkedIn integration
- Profile information access
- Token management

---

**Questions?** Check the [QUICK_LINKEDIN_CONNECT.md](./QUICK_LINKEDIN_CONNECT.md) for user-friendly instructions.
