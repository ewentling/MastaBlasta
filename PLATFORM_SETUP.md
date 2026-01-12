# Platform OAuth Setup Guide

This guide provides step-by-step instructions for configuring OAuth authentication for each supported social media platform.

## Table of Contents
- [Twitter/X](#twitter-x)
- [Facebook](#facebook)
- [Instagram](#instagram)
- [LinkedIn](#linkedin)
- [YouTube](#youtube)
- [Manual Setup (Without OAuth)](#manual-setup-without-oauth)

---

## Twitter/X

### Prerequisites
- A Twitter Developer Account
- An approved Twitter App

### Steps

1. **Create a Twitter Developer Account**
   - Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
   - Sign in with your Twitter account
   - Apply for a developer account (approval may take a few days)

2. **Create a New App**
   - Once approved, go to the Developer Portal
   - Click "Create Project" and follow the wizard
   - Create a new App within your project

3. **Configure OAuth 2.0 Settings**
   - In your App settings, go to "Settings" → "User authentication settings"
   - Click "Set up" or "Edit"
   - Enable "OAuth 2.0"
   - Set the following:
     - **App permissions**: Read and Write
     - **Type of App**: Web App, Automated App or Bot
     - **Callback URI / Redirect URL**: `http://localhost:33766/api/oauth/twitter/callback`
     - For production: `https://yourdomain.com/api/oauth/twitter/callback`

4. **Get Your Credentials**
   - Go to "Keys and tokens" tab
   - Copy the **Client ID** and **Client Secret**

5. **Set Environment Variables**
   ```bash
   export TWITTER_CLIENT_ID="your_client_id_here"
   export TWITTER_CLIENT_SECRET="your_client_secret_here"
   export TWITTER_REDIRECT_URI="http://localhost:33766/api/oauth/twitter/callback"
   ```

### Scopes Used
- `tweet.read` - Read tweets
- `tweet.write` - Post tweets
- `users.read` - Read user information
- `offline.access` - Get refresh tokens

---

## Facebook

### Prerequisites
- A Facebook Developer Account
- A Facebook App

### Steps

1. **Create a Facebook Developer Account**
   - Go to [Facebook Developers](https://developers.facebook.com/)
   - Click "Get Started"
   - Complete the registration process

2. **Create a New App**
   - In the Facebook Developer Dashboard, click "Create App"
   - Select app type: "Business" or "Consumer"
   - Fill in the app details and create

3. **Add Facebook Login Product**
   - In your app dashboard, click "Add Product"
   - Find "Facebook Login" and click "Set Up"
   - Choose "Web" as the platform
   - Enter your site URL: `http://localhost:33766` (or your production URL)

4. **Configure OAuth Settings**
   - Go to "Facebook Login" → "Settings"
   - Add Valid OAuth Redirect URIs:
     - Development: `http://localhost:33766/api/oauth/meta/callback`
     - Production: `https://yourdomain.com/api/oauth/meta/callback`

5. **Get Your Credentials**
   - Go to "Settings" → "Basic"
   - Copy the **App ID** and **App Secret**

6. **Set Environment Variables**
   ```bash
   export META_APP_ID="your_app_id_here"
   export META_APP_SECRET="your_app_secret_here"
   export META_REDIRECT_URI="http://localhost:33766/api/oauth/meta/callback"
   ```

7. **Request Page Permissions**
   - Your app will need to request these permissions:
     - `pages_manage_posts` - Post to Pages
     - `pages_read_engagement` - Read Page insights

### Important Notes
- Facebook requires your app to be reviewed before accessing certain permissions
- For development/testing, you can add test users in App Roles
- Page access tokens are long-lived (60 days)

---

## Instagram

Instagram uses Meta's OAuth system (same as Facebook).

### Prerequisites
- A Facebook Developer Account and App (see Facebook setup above)
- An Instagram Business or Creator Account
- The Instagram account must be connected to a Facebook Page

### Steps

1. **Complete Facebook App Setup** (see Facebook section above)

2. **Add Instagram Product**
   - In your Facebook app dashboard, click "Add Product"
   - Find "Instagram Basic Display" or "Instagram Graph API"
   - Click "Set Up"

3. **Configure OAuth Settings**
   - Use the same redirect URI as Facebook: `http://localhost:33766/api/oauth/meta/callback`

4. **Environment Variables**
   - Use the same credentials as Facebook:
   ```bash
   export META_APP_ID="your_app_id_here"
   export META_APP_SECRET="your_app_secret_here"
   export META_REDIRECT_URI="http://localhost:33766/api/oauth/meta/callback"
   ```

5. **Required Permissions**
   - `instagram_basic` - Basic Instagram access
   - `instagram_content_publish` - Post content to Instagram

### Important Notes
- Instagram only supports posting to Business and Creator accounts
- Media must be publicly accessible URLs
- Instagram has specific image/video requirements (aspect ratios, sizes)

---

## LinkedIn

### Prerequisites
- A LinkedIn Developer Account
- A LinkedIn App

### Steps

1. **Create a LinkedIn App**
   - Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
   - Click "Create App"
   - Fill in the required information:
     - App name
     - LinkedIn Page (you'll need to associate a Page)
     - Privacy policy URL
     - App logo

2. **Configure OAuth Settings**
   - In your app settings, go to the "Auth" tab
   - Add Redirect URLs:
     - Development: `http://localhost:33766/api/oauth/linkedin/callback`
     - Production: `https://yourdomain.com/api/oauth/linkedin/callback`

3. **Request API Access**
   - Go to the "Products" tab
   - Request access to:
     - "Share on LinkedIn" - For posting capability
     - "Sign In with LinkedIn" - For authentication

4. **Get Your Credentials**
   - Go to the "Auth" tab
   - Copy the **Client ID** and **Client Secret**

5. **Set Environment Variables**
   ```bash
   export LINKEDIN_CLIENT_ID="your_client_id_here"
   export LINKEDIN_CLIENT_SECRET="your_client_secret_here"
   export LINKEDIN_REDIRECT_URI="http://localhost:33766/api/oauth/linkedin/callback"
   ```

### Required Scopes
- `w_member_social` - Share content on LinkedIn
- `r_liteprofile` - Read profile data
- `r_emailaddress` - Read email address

### Important Notes
- API access requires LinkedIn Page association
- Review process may be required for certain products
- Posts are limited to certain content types

---

## YouTube

### Prerequisites
- A Google Cloud Platform Account
- A YouTube Channel

### Steps

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Note your Project ID

2. **Enable YouTube Data API v3**
   - In the Google Cloud Console, go to "APIs & Services" → "Library"
   - Search for "YouTube Data API v3"
   - Click on it and press "Enable"

3. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - If prompted, configure the OAuth consent screen first:
     - User Type: External (for public) or Internal (for organization)
     - Fill in app information
     - Add scopes: `https://www.googleapis.com/auth/youtube.upload`
   - Application type: "Web application"
   - Name: "MastaBlasta"
   - Authorized redirect URIs:
     - Development: `http://localhost:33766/api/oauth/google/callback`
     - Production: `https://yourdomain.com/api/oauth/google/callback`

4. **Get Your Credentials**
   - Download the JSON credentials file or copy:
     - **Client ID**
     - **Client Secret**

5. **Set Environment Variables**
   ```bash
   export GOOGLE_CLIENT_ID="your_client_id_here"
   export GOOGLE_CLIENT_SECRET="your_client_secret_here"
   export GOOGLE_REDIRECT_URI="http://localhost:33766/api/oauth/google/callback"
   ```

### Required Scopes
- `https://www.googleapis.com/auth/youtube.upload` - Upload videos
- `https://www.googleapis.com/auth/youtube` - Manage your YouTube account

### Important Notes
- YouTube API has daily quota limits
- Video uploads require proper video file formats
- Thumbnails and metadata can be set during upload

---

## Manual Setup (Without OAuth)

If you prefer not to use OAuth or need to use API keys directly, you can manually set up accounts:

### Twitter
1. Generate API keys in Twitter Developer Portal
2. Use "Manual Setup" in the Accounts page
3. Enter:
   - API Key
   - API Secret
   - Access Token
   - Access Token Secret

### Facebook/Instagram
1. Get a Page Access Token from Graph API Explorer
2. Use "Manual Setup" in the Accounts page
3. Enter:
   - Access Token
   - Page ID (for Facebook)
   - Instagram Account ID (for Instagram)

### LinkedIn
1. Get an access token through OAuth manually
2. Use "Manual Setup" in the Accounts page
3. Enter:
   - Access Token
   - Organization ID (for company pages)

---

## Testing Your Configuration

After setting up OAuth credentials:

1. Restart the MastaBlasta application to load new environment variables
2. Go to the Accounts page
3. Click "Quick Connect"
4. Select a platform
5. Click "Connect"
6. You should be redirected to the platform's authorization page
7. After authorizing, you'll be redirected back and the account will be created

If you see "OAuth not configured" errors, verify:
- Environment variables are set correctly
- The application has been restarted
- Redirect URIs match exactly in both the platform and your configuration
- Required API products/permissions are enabled

---

## Troubleshooting

### "Invalid client_id" Error
- Verify the CLIENT_ID environment variable is set correctly
- Check that there are no extra spaces or quotes in the value
- Ensure you're using the correct type of credentials (OAuth 2.0, not API keys)

### "Redirect URI mismatch" Error
- Ensure the redirect URI in your app settings exactly matches the one in your environment variables
- Include the protocol (http:// or https://)
- Check for trailing slashes (most platforms don't allow them)

### "Access denied" or "Insufficient permissions" Error
- Verify you've requested the correct scopes/permissions
- For Facebook/Instagram, check if your app is in Development Mode
- Some platforms require app review before accessing certain features

### OAuth Popup Blocked
- Allow popups for localhost or your domain
- Check browser console for errors
- Try a different browser if issues persist

---

## Environment Variables Summary

Create a `.env` file in the root directory with all credentials:

```bash
# Twitter
TWITTER_CLIENT_ID=your_twitter_client_id
TWITTER_CLIENT_SECRET=your_twitter_client_secret
TWITTER_REDIRECT_URI=http://localhost:33766/api/oauth/twitter/callback

# Facebook/Instagram (Meta)
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_REDIRECT_URI=http://localhost:33766/api/oauth/meta/callback

# LinkedIn
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret
LINKEDIN_REDIRECT_URI=http://localhost:33766/api/oauth/linkedin/callback

# YouTube (Google)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:33766/api/oauth/google/callback
```

Load them before running the app:
```bash
source .env  # or use a .env loader
python app.py
```

---

## Security Best Practices

1. **Never commit credentials to version control**
   - Add `.env` to `.gitignore`
   - Use environment variables or secure secret management

2. **Use different credentials for development and production**

3. **Regularly rotate secrets and tokens**

4. **Limit OAuth scopes to only what's needed**

5. **Use HTTPS in production**
   - Update redirect URIs to use https://
   - Configure SSL/TLS certificates

6. **Monitor API usage and quotas**
   - Set up alerts for quota limits
   - Implement rate limiting in your application

---

## Additional Resources

- [Twitter API Documentation](https://developer.twitter.com/en/docs)
- [Meta for Developers](https://developers.facebook.com/docs)
- [LinkedIn API Documentation](https://docs.microsoft.com/en-us/linkedin/)
- [YouTube Data API](https://developers.google.com/youtube/v3)
- [OAuth 2.0 Simplified](https://www.oauth.com/)
