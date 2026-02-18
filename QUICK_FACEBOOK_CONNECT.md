# Quick Facebook Connect - User Guide

## For End Users: How to Connect Your Facebook Account

This guide is for users who want to connect their Facebook account to MastaBlasta. **No technical knowledge required!**

## What You'll Need

✅ A Facebook account  
✅ At least one Facebook Page you manage  
✅ 5 minutes

## Step-by-Step Instructions

### Step 1: Login to MastaBlasta

1. Open MastaBlasta in your browser
2. Login with your email and password

### Step 2: Navigate to Accounts

1. Click on **"Accounts"** in the left sidebar
2. You'll see the "Platform Accounts" page

### Step 3: Click "Quick Connect"

1. Click the blue **"Quick Connect"** button (with a lightning bolt icon ⚡)
2. A popup window will appear

### Step 4: Select Facebook

1. In the dropdown menu, select **"Facebook"**
2. (Optional) Give your account a friendly name

### Step 5: Connect with OAuth

1. Click the **"Connect with OAuth"** button
2. A new window will pop up showing Facebook's login page

### Step 6: Authorize on Facebook

1. **Login to Facebook** (if not already logged in)
2. **Review permissions** that MastaBlasta is requesting:
   - Manage your Pages
   - Post to your Pages
   - Read Page insights
3. **Select which Pages** you want to connect (or "Select All")
4. Click **"Continue"** or **"Allow"**

### Step 7: Success!

✨ The popup will close automatically  
✨ You'll see your Facebook account in the "Connected Accounts" list  
✨ All your Facebook Pages are now connected!

## What Happens Next?

Once connected, you can:

- ✍️ **Create posts** that will go to your Facebook Pages
- 📅 **Schedule posts** for future publishing
- 📊 **View analytics** for your Page performance
- 🔄 **Auto-post** from n8n workflows

## Posting to Facebook

### From the Web Interface

1. Go to **"Posts"** page
2. Click **"New Post"**
3. Write your content
4. Check **"Facebook"** in the platforms list
5. (Optional) Select which Page to post to
6. Click **"Publish Now"** or **"Schedule"**

### Which Page Will It Post To?

- If you have **one Page**: Posts automatically go there
- If you have **multiple Pages**: 
  - It will post to the **first Page** by default
  - Or you can select a specific Page in post options

## Troubleshooting

### ❌ "No OAuth Apps configured"

**What it means**: The system administrator needs to set up Facebook OAuth credentials.

**Solution**: 
- Contact your MastaBlasta administrator
- They need to configure Facebook OAuth (see [FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md))

### ❌ Popup is blocked

**What it means**: Your browser blocked the Facebook login popup.

**Solution**:
- Look for a popup blocker icon in your browser's address bar
- Click it and select "Always allow popups from this site"
- Try connecting again

### ❌ "Authorization failed"

**What it means**: You cancelled the Facebook authorization or something went wrong.

**Solution**:
- Try connecting again
- Make sure you click "Allow" on Facebook
- Check that you selected at least one Page

### ❌ "No Facebook Pages found"

**What it means**: Your Facebook account doesn't manage any Pages.

**Solution**:
- Create a Facebook Page first (on facebook.com)
- Facebook doesn't allow posting to personal profiles
- Only Business/Creator Pages are supported

### ⚠️ "Connected in demo mode"

**What it means**: OAuth credentials aren't properly configured, so it connected in demo mode.

**Solution**:
- Contact your administrator
- The account may not work for actual posting
- Proper OAuth setup is needed for real posting

## Security & Privacy

### What Access Does MastaBlasta Have?

✅ Post to your Facebook Pages  
✅ Read Page insights and analytics  
✅ List Pages you manage  
❌ Cannot access your personal posts  
❌ Cannot see your private messages  
❌ Cannot access friends list  
❌ Cannot post to your personal timeline  

### Revoking Access

If you want to disconnect:

**Method 1: From MastaBlasta**
1. Go to Accounts page
2. Find your Facebook account
3. Click the trash icon 🗑️
4. Confirm deletion

**Method 2: From Facebook**
1. Go to Facebook Settings
2. Click "Apps and Websites"
3. Find MastaBlasta
4. Click "Remove"

### Token Expiration

- Facebook access tokens expire after **60 days**
- When expired, you'll see errors when trying to post
- Simply reconnect your account to refresh (same steps as above)

## Tips & Best Practices

### 💡 Tip 1: Connect Multiple Pages

You can connect all your Facebook Pages at once:
- When authorizing on Facebook, select all Pages
- MastaBlasta will store access for all of them
- Post to any or all of your Pages

### 💡 Tip 2: Test Before Scheduling

Before scheduling important posts:
1. Create a test post
2. Publish immediately
3. Check it appears on your Page
4. Then schedule your real posts with confidence

### 💡 Tip 3: Check Connection Health

Periodically check your connections:
1. Go to Accounts page
2. Click the test icon 🧪 next to your account
3. It will verify the connection still works

### 💡 Tip 4: Multiple Accounts

You can connect multiple Facebook accounts:
- Connect personal business Page
- Connect client Pages (if you manage them)
- Each connection is independent

## Need Help?

### Common Questions

**Q: Can I post to my personal Facebook profile?**  
A: No, Facebook heavily restricts this. Only Pages are supported.

**Q: Do I need a Facebook Business account?**  
A: No, a regular Facebook account is fine, as long as you manage a Page.

**Q: Will my followers see the posts?**  
A: Yes, posts will appear on your Page like any normal post.

**Q: Can I edit posts after publishing?**  
A: Not through MastaBlasta currently, but you can edit directly on Facebook.

**Q: How often can I post?**  
A: Follow Facebook's guidelines - avoid spamming. Reasonable posting frequency is fine.

### Still Having Issues?

1. Check the **[FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)** for detailed troubleshooting
2. Contact your MastaBlasta administrator
3. Check Facebook's [Help Center](https://www.facebook.com/help)

---

## For Administrators

If you're setting up MastaBlasta for your users, see:
- **[FACEBOOK_OAUTH_SETUP.md](./FACEBOOK_OAUTH_SETUP.md)** - Complete setup guide
- **[PLATFORM_SETUP.md](./PLATFORM_SETUP.md)** - All platforms setup

The key is ensuring OAuth is properly configured so users get the seamless "click and connect" experience described in this guide.
