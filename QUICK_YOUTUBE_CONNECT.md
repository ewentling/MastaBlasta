# Quick YouTube Connect - User Guide

## For End Users: How to Connect Your YouTube Channel

This guide is for users who want to connect their YouTube channel to MastaBlasta. **No technical knowledge required!**

## What You'll Need

✅ A Google account  
✅ A YouTube channel  
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

### Step 4: Select YouTube

1. In the dropdown menu, select **"YouTube"**
2. (Optional) Give your account a friendly name

### Step 5: Connect with OAuth

1. Click the **"Connect with OAuth"** button
2. A new window will pop up showing Google's authorization page

### Step 6: Authorize on Google

1. **Select your Google account** (or login if needed)
2. **Review permissions** that MastaBlasta is requesting:
   - Manage your YouTube account
   - Upload and manage videos
3. Click **"Continue"** or **"Allow"**

### Step 7: Success!

✨ The popup will close automatically  
✨ You'll see your YouTube channel in the "Connected Accounts" list  
✨ You're ready to start uploading!

## What Happens Next?

Once connected, you can:

- 📹 **Upload videos** to your YouTube channel
- 📝 **Manage video metadata** (title, description, tags)
- 📅 **Schedule video uploads** for future publishing
- 🎬 **Build your channel** consistently
- 🔄 **Auto-upload** from n8n workflows

## Uploading to YouTube

### From the Web Interface

1. Go to **"Posts"** page
2. Click **"New Post"**
3. Upload your video file
4. Fill in title and description
5. Check **"YouTube"** in the platforms list
6. Click **"Publish Now"** or **"Schedule"**

### YouTube Upload Tips

💡 **Title**: 60 characters or less for best display  
💡 **Description**: First 157 chars appear in search  
💡 **Tags**: 10-15 relevant tags  
💡 **Thumbnail**: Custom thumbnail increases views  
💡 **Category**: Choose the most relevant one  
💡 **Privacy**: Public, Unlisted, or Private  

## Troubleshooting

### ❌ "No OAuth Apps configured"

**What it means**: The system administrator needs to set up Google OAuth credentials.

**Solution**: 
- Contact your MastaBlasta administrator
- They need to configure YouTube OAuth (see [YOUTUBE_OAUTH_SETUP.md](./YOUTUBE_OAUTH_SETUP.md))

### ❌ Popup is blocked

**What it means**: Your browser blocked the Google authorization popup.

**Solution**:
- Look for a popup blocker icon in your browser's address bar
- Click it and select "Always allow popups from this site"
- Try connecting again

### ❌ "Authorization failed"

**What it means**: You cancelled the Google authorization or something went wrong.

**Solution**:
- Try connecting again
- Make sure you click "Allow" on Google
- Check that you're selecting the correct Google account

### ❌ "No YouTube channel found"

**What it means**: Your Google account doesn't have a YouTube channel.

**Solution**:
1. Go to [youtube.com](https://youtube.com)
2. Click your profile icon
3. Click "Create a channel"
4. Follow the channel creation wizard
5. Then reconnect in MastaBlasta

### ❌ "Quota exceeded"

**What it means**: You've reached your daily YouTube API quota.

**Solution**:
- **Free tier**: 10,000 units/day (~6 video uploads)
- Wait for quota to reset (midnight Pacific Time)
- Or contact admin about quota increase
- Videos uploaded directly on YouTube don't count toward this limit

### ❌ "Token has expired"

**What it means**: Your YouTube connection needs to be refreshed.

**Solution**:
- MastaBlasta automatically refreshes tokens
- If it fails, simply reconnect (same steps as above)
- Takes less than 1 minute

### ⚠️ "Connected in demo mode"

**What it means**: OAuth credentials aren't properly configured.

**Solution**:
- Contact your administrator
- The account may not work for actual uploads
- Proper OAuth setup is needed

## Security & Privacy

### What Access Does MastaBlasta Have?

✅ Upload videos to your channel  
✅ Manage your videos and metadata  
✅ View your channel information  
❌ Cannot access your watch history  
❌ Cannot see your subscriptions  
❌ Cannot access your private messages  
❌ Cannot change your channel settings (name, banner, etc.)  

### Revoking Access

If you want to disconnect:

**Method 1: From MastaBlasta**
1. Go to Accounts page
2. Find your YouTube account
3. Click the trash icon 🗑️
4. Confirm deletion

**Method 2: From Google**
1. Go to [Google Account](https://myaccount.google.com/)
2. Click "Security" → "Third-party apps with account access"
3. Find MastaBlasta
4. Click "Remove Access"

### Token Expiration

- YouTube access tokens expire after **1 hour**
- Refresh tokens last **indefinitely** (until revoked)
- MastaBlasta automatically refreshes tokens
- If auto-refresh fails, simply reconnect

## Tips & Best Practices

### 💡 Tip 1: Optimize for Search

YouTube is the 2nd largest search engine:
- Use keywords in title
- Write detailed descriptions
- Add relevant tags
- Create custom thumbnails

### 💡 Tip 2: Best Upload Times

Research shows optimal times are:
- **Weekdays**: 2-4 PM (your audience's timezone)
- **Weekends**: 9-11 AM
- Experiment and check your YouTube Analytics

### 💡 Tip 3: Video Quality

Higher quality = more views:
- **Resolution**: 1080p minimum, 4K ideal
- **Format**: MP4 (H.264 + AAC)
- **Audio**: Clear audio is crucial
- **Lighting**: Good lighting matters

### 💡 Tip 4: Thumbnails Matter

Custom thumbnails get 10x more clicks:
- Use bright colors
- Add text overlay
- Show emotion or action
- Keep it simple and clear
- Size: 1280x720 pixels

### 💡 Tip 5: Engage Your Audience

Build a community:
- Ask questions in videos
- Respond to comments
- Create playlists
- Use end screens and cards
- Consistent upload schedule

## Understanding YouTube Features

### Video Privacy Settings

- **Public**: Anyone can find and watch
- **Unlisted**: Only people with link can watch
- **Private**: Only you and people you choose

### Video Categories

Choose the right category for discoverability:
- Film & Animation
- Music
- Gaming
- People & Blogs
- Education
- Science & Technology
- And more...

### Video Scheduling

Schedule uploads for optimal times:
1. Upload with "Private" privacy
2. Set scheduled time in MastaBlasta
3. Video goes public automatically

## Quota Limits Explained

### What Are Quotas?

YouTube limits API usage to prevent abuse:
- **10,000 units per day** (free tier)
- **Video upload costs 1,600 units**
- **~6 video uploads per day**

### Tips to Stay Within Quota

1. **Upload directly**: Videos uploaded on YouTube.com don't count
2. **Batch uploads**: Upload multiple videos at once
3. **Request increase**: Submit form in Google Cloud Console
4. **Per-user OAuth**: Each user gets separate quota

### When Quota Resets

- Quota resets at **midnight Pacific Time**
- Monitor usage in Google Cloud Console
- Plan uploads accordingly

## Need Help?

### Common Questions

**Q: Can I delete videos after uploading?**  
A: Not through MastaBlasta currently, but you can delete directly on YouTube.

**Q: Can I edit videos after uploading?**  
A: You can edit metadata (title, description, tags) on YouTube.

**Q: What video formats are supported?**  
A: MP4, AVI, MOV, FLV, WMV, and more. MP4 is recommended.

**Q: What's the maximum file size?**  
A: 256GB or 12 hours, whichever comes first.

**Q: Can I upload multiple videos at once?**  
A: Yes, create separate posts for each video.

**Q: How long does upload take?**  
A: Depends on file size and internet speed. Usually 5-30 minutes.

### Still Having Issues?

1. Check the **[YOUTUBE_OAUTH_SETUP.md](./YOUTUBE_OAUTH_SETUP.md)** for detailed troubleshooting
2. Contact your MastaBlasta administrator
3. Check YouTube's [Help Center](https://support.google.com/youtube/)

---

## For Administrators

If you're setting up MastaBlasta for your users, see:
- **[YOUTUBE_OAUTH_SETUP.md](./YOUTUBE_OAUTH_SETUP.md)** - Complete setup guide
- **[PLATFORM_SETUP.md](./PLATFORM_SETUP.md)** - All platforms setup

The key is ensuring OAuth is properly configured so users get the seamless "click and connect" experience described in this guide.

## Quick Reference

### Connection Steps (TL;DR)
1. Accounts → Quick Connect
2. Select YouTube
3. Authorize in popup
4. Done! ✨

### Uploading Steps (TL;DR)
1. Posts → New Post
2. Upload video file
3. Add title & description
4. Check YouTube
5. Publish Now ✓

### Troubleshooting (TL;DR)
- Popup blocked? → Allow popups
- No channel? → Create channel on YouTube
- Quota exceeded? → Wait for reset (midnight PT)
- Token expired? → Reconnect
- Need help? → Contact admin

---

**Happy Creating! 🎬**
