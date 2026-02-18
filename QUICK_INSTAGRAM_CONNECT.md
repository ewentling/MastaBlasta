# Quick Instagram Connect - User Guide

## For End Users: How to Connect Your Instagram Account

This guide is for users who want to connect their Instagram account to MastaBlasta. **No technical knowledge required!**

## What You'll Need

✅ An Instagram Business or Creator account  
✅ A Facebook Page (linked to your Instagram)  
✅ 10 minutes

## Important: Instagram Requirements

⚠️ **Instagram API requires:**
- Instagram **Business** or **Creator** account (not personal)
- Account must be linked to a Facebook Page
- You must be admin of the Facebook Page

**Don't have these yet?** See the setup section below.

## Step-by-Step Instructions

### Step 1: Prepare Your Instagram Account

**If your Instagram is NOT a Business/Creator account:**

1. Open Instagram mobile app
2. Go to **Settings** → **Account**
3. Tap **"Switch to Professional Account"**
4. Choose **Business** or **Creator**
5. Follow the setup wizard

**Link to Facebook Page:**

1. In Instagram Settings → **Account**
2. Tap **"Linked accounts"**
3. Tap **"Facebook"**
4. Login and select your Facebook Page
5. Confirm connection

### Step 2: Login to MastaBlasta

1. Open MastaBlasta in your browser
2. Login with your email and password

### Step 3: Navigate to Accounts

1. Click on **"Accounts"** in the left sidebar
2. You'll see the "Platform Accounts" page

### Step 4: Click "Quick Connect"

1. Click the blue **"Quick Connect"** button (with a lightning bolt icon ⚡)
2. A popup window will appear

### Step 5: Select Instagram

1. In the dropdown menu, select **"Instagram"**
2. (Optional) Give your account a friendly name

### Step 6: Connect with OAuth

1. Click the **"Connect with OAuth"** button
2. A new window will pop up showing Facebook authorization page
   *(Instagram uses Facebook's OAuth system)*

### Step 7: Authorize on Facebook

1. **Login to Facebook** (if not already logged in)
2. **Review permissions** that MastaBlasta is requesting:
   - Manage your Instagram account
   - Post content to Instagram
   - Access your Facebook Pages
3. **Select your Facebook Page** (the one linked to Instagram)
4. Click **"Continue"** or **"Allow"**

### Step 8: Success!

✨ The popup will close automatically  
✨ You'll see your Instagram account in the "Connected Accounts" list  
✨ You're ready to start posting!

## What Happens Next?

Once connected, you can:

- 📸 **Post photos** to your Instagram feed
- 🎥 **Post videos** to your Instagram feed
- 📝 **Add captions** with hashtags and mentions
- 📅 **Schedule posts** for future publishing
- 🔄 **Auto-post** from n8n workflows

## Posting to Instagram

### From the Web Interface

1. Go to **"Posts"** page
2. Click **"New Post"**
3. **Upload an image or video** (required!)
4. Write your caption
5. Check **"Instagram"** in the platforms list
6. Click **"Publish Now"** or **"Schedule"**

### Instagram Post Tips

💡 **Media Required**: Instagram needs an image or video  
💡 **Size**: 1080x1080 (square) or 1080x1350 (portrait)  
💡 **Caption**: Up to 2,200 characters  
💡 **Hashtags**: 5-10 relevant hashtags work best  
💡 **Emojis**: Use emojis to add personality ✨  
💡 **Call-to-Action**: Ask questions or encourage engagement  

## Troubleshooting

### ❌ "Not a Business/Creator account"

**What it means**: Your Instagram account is a personal account.

**Solution**:
1. Open Instagram app
2. Settings → Account
3. "Switch to Professional Account"
4. Choose Business or Creator
5. Complete setup
6. Try connecting again in MastaBlasta

### ❌ "Instagram not linked to Facebook Page"

**What it means**: Your Instagram isn't connected to a Facebook Page.

**Solution**:
1. Open Instagram app
2. Settings → Account → Linked accounts
3. Tap "Facebook"
4. Login and select your Facebook Page
5. Confirm connection
6. Try connecting again in MastaBlasta

### ❌ "No Facebook Page found"

**What it means**: You don't have a Facebook Page or aren't an admin.

**Solution**:
1. Create a Facebook Page at facebook.com
2. Or get admin access to an existing Page
3. Link Instagram to that Page (see above)
4. Try connecting again

### ❌ Popup is blocked

**What it means**: Your browser blocked the authorization popup.

**Solution**:
- Look for popup blocker icon in address bar
- Click and select "Always allow popups"
- Try connecting again

### ❌ "Authorization failed"

**What it means**: You cancelled or didn't complete authorization.

**Solution**:
- Try connecting again
- Make sure you click "Allow"
- Select the correct Facebook Page
- Complete all authorization steps

### ❌ "Media is required for Instagram posts"

**What it means**: You tried to post text-only (Instagram doesn't support this).

**Solution**:
- Instagram requires an image or video
- Upload media first
- Then add your caption
- Text-only posts won't work

### ⚠️ "Connected in demo mode"

**What it means**: OAuth credentials aren't properly configured.

**Solution**:
- Contact your administrator
- Proper OAuth setup is needed for real posting

## Security & Privacy

### What Access Does MastaBlasta Have?

✅ Post photos and videos on your behalf  
✅ Read your Instagram account information  
✅ Access your linked Facebook Page  
❌ Cannot access your Instagram messages  
❌ Cannot see your password  
❌ Cannot access your followers list  
❌ Cannot post Stories (not supported by API)  

### Revoking Access

If you want to disconnect:

**Method 1: From MastaBlasta**
1. Go to Accounts page
2. Find your Instagram account
3. Click the trash icon 🗑️
4. Confirm deletion

**Method 2: From Facebook**
1. Go to Facebook Settings
2. Apps and Websites
3. Find MastaBlasta
4. Remove access

### Token Expiration

- Instagram uses long-lived Page Access Tokens
- Tokens don't expire (unless revoked)
- No need to reconnect regularly

## Tips & Best Practices

### 💡 Tip 1: Optimize Image Size

Instagram loves square images:
- **1080x1080** - Perfect square
- **1080x1350** - Portrait (4:5)
- **1080x566** - Landscape (1.91:1)
- Use high-quality images

### 💡 Tip 2: Write Engaging Captions

First line is crucial:
- Hook readers immediately
- Use line breaks for readability
- Add relevant hashtags (5-10)
- Include call-to-action

### 💡 Tip 3: Best Times to Post

Research shows optimal times:
- **Weekdays**: 11 AM - 1 PM, 7 PM - 9 PM
- **Wednesday-Friday**: Best engagement
- Experiment with your audience

### 💡 Tip 4: Use Hashtags Strategically

Mix hashtag sizes:
- 2-3 large hashtags (100k+ posts)
- 3-4 medium hashtags (10k-100k posts)
- 2-3 niche hashtags (under 10k posts)

### 💡 Tip 5: Maintain Consistency

Build your brand:
- Post 1-2 times per day
- Maintain visual consistency
- Stick to your posting schedule
- Engage with your audience

## Understanding Instagram Features

### Content Types

Instagram supports:
- **Feed Posts**: Photos and videos on your main feed
- **Carousel**: Multiple images in one post (upload separately)
- **Videos**: 3-60 seconds for feed posts

**Not Yet Supported:**
- Stories (API limitation)
- Reels (API limitation)
- IGTV (use feed videos instead)

### Image Requirements

**Aspect Ratios:**
- Square: 1:1 (1080x1080)
- Portrait: 4:5 (1080x1350)
- Landscape: 1.91:1 (1080x566)

**File Requirements:**
- Format: JPG, PNG
- Size: Max 8MB
- Resolution: 1080px recommended

### Video Requirements

**Specifications:**
- Format: MP4, MOV
- Duration: 3-60 seconds
- Size: Max 100MB
- Resolution: 1080p recommended

## Need Help?

### Common Questions

**Q: Why can't I connect a personal Instagram account?**  
A: Instagram API only works with Business/Creator accounts. Switch your account type in Instagram settings.

**Q: Do I need a Facebook Page?**  
A: Yes, it's required by Instagram. Your Instagram must be linked to a Facebook Page.

**Q: Can I post Stories?**  
A: Not yet - Instagram API doesn't support Stories posting.

**Q: Can I post Reels?**  
A: Not yet - Reels posting via API is not available.

**Q: What if I manage multiple Instagram accounts?**  
A: Connect each one separately through different Facebook Pages.

**Q: Can I edit posts after publishing?**  
A: Not through MastaBlasta, but you can edit directly on Instagram.

### Still Having Issues?

1. Check the **[INSTAGRAM_OAUTH_SETUP.md](./INSTAGRAM_OAUTH_SETUP.md)** for detailed troubleshooting
2. Contact your MastaBlasta administrator
3. Check Instagram's [Help Center](https://help.instagram.com/)

---

## For Administrators

If you're setting up MastaBlasta for your users, see:
- **[INSTAGRAM_OAUTH_SETUP.md](./INSTAGRAM_OAUTH_SETUP.md)** - Complete setup guide
- **[FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)** - Facebook app setup (required)
- **[PLATFORM_SETUP.md](./PLATFORM_SETUP.md)** - All platforms setup

Instagram uses Facebook's OAuth system, so Facebook setup is required first.

## Quick Reference

### Pre-Setup (One Time)
1. Convert to Business/Creator account
2. Create/access Facebook Page
3. Link Instagram to Facebook Page

### Connection Steps (TL;DR)
1. Accounts → Quick Connect
2. Select Instagram
3. Authorize in popup (via Facebook)
4. Select Facebook Page
5. Done! ✨

### Posting Steps (TL;DR)
1. Posts → New Post
2. Upload image/video (required!)
3. Write caption
4. Check Instagram
5. Publish Now ✓

### Troubleshooting (TL;DR)
- Not Business account? → Switch in Instagram settings
- Not linked to Page? → Link in Instagram settings
- No Page? → Create Facebook Page
- Media required? → Upload image/video
- Need help? → Contact admin

---

**Happy Gramming! 📸**
