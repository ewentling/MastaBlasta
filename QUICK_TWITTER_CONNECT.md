# Quick Twitter/X Connect - User Guide

## For End Users: How to Connect Your Twitter/X Account

This guide is for users who want to connect their Twitter/X account to MastaBlasta. **No technical knowledge required!**

## What You'll Need

✅ A Twitter/X account  
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

### Step 4: Select Twitter

1. In the dropdown menu, select **"Twitter"**
2. (Optional) Give your account a friendly name

### Step 5: Connect with OAuth

1. Click the **"Connect with OAuth"** button
2. A new window will pop up showing Twitter's authorization page

### Step 6: Authorize on Twitter

1. **Login to Twitter** (if not already logged in)
2. **Review permissions** that MastaBlasta is requesting:
   - Read your tweets
   - Post tweets
   - Read user information
3. Click **"Authorize app"**

### Step 7: Success!

✨ The popup will close automatically  
✨ You'll see your Twitter account in the "Connected Accounts" list  
✨ You're ready to start tweeting!

## What Happens Next?

Once connected, you can:

- 🐦 **Post tweets** from MastaBlasta
- 🧵 **Create threads** for longer content
- 📅 **Schedule tweets** for future publishing
- 📊 **View analytics** for your tweets (coming soon)
- 🔄 **Auto-post** from n8n workflows

## Posting to Twitter

### From the Web Interface

1. Go to **"Posts"** page
2. Click **"New Post"**
3. Write your tweet (up to 280 characters)
4. Check **"Twitter"** in the platforms list
5. Click **"Publish Now"** or **"Schedule"**

### Tweet Tips

💡 **Character Limit**: 280 characters (including spaces)  
💡 **Media**: Add up to 4 images or 1 video  
💡 **Hashtags**: Use 1-2 relevant hashtags  
💡 **Mentions**: Tag people with @username  
💡 **Threads**: Long content automatically becomes a thread  

## Troubleshooting

### ❌ "No OAuth Apps configured"

**What it means**: The system administrator needs to set up Twitter OAuth credentials.

**Solution**: 
- Contact your MastaBlasta administrator
- They need to configure Twitter OAuth (see [TWITTER_OAUTH_SETUP.md](./TWITTER_OAUTH_SETUP.md))

### ❌ Popup is blocked

**What it means**: Your browser blocked the Twitter authorization popup.

**Solution**:
- Look for a popup blocker icon in your browser's address bar
- Click it and select "Always allow popups from this site"
- Try connecting again

### ❌ "Authorization failed"

**What it means**: You cancelled the Twitter authorization or something went wrong.

**Solution**:
- Try connecting again
- Make sure you click "Authorize app" on Twitter
- Check that you're logged into the correct Twitter account

### ❌ "Token has expired"

**What it means**: Your Twitter connection needs to be refreshed.

**Solution**:
- MastaBlasta automatically refreshes tokens
- If it fails, simply reconnect (same steps as above)
- Takes less than 1 minute

### ⚠️ "Connected in demo mode"

**What it means**: OAuth credentials aren't properly configured, so it connected in demo mode.

**Solution**:
- Contact your administrator
- The account may not work for actual posting
- Proper OAuth setup is needed for real tweets

### ❌ "App does not have write permissions"

**What it means**: The Twitter app isn't configured to post tweets.

**Solution**:
- Contact your administrator
- They need to enable "Read and Write" permissions
- Reconnect after permissions are fixed

## Security & Privacy

### What Access Does MastaBlasta Have?

✅ Post tweets on your behalf  
✅ Read your public tweets  
✅ See your profile information  
❌ Cannot access your private messages  
❌ Cannot see your password  
❌ Cannot access your followers list  
❌ Cannot change your account settings  

### Revoking Access

If you want to disconnect:

**Method 1: From MastaBlasta**
1. Go to Accounts page
2. Find your Twitter account
3. Click the trash icon 🗑️
4. Confirm deletion

**Method 2: From Twitter**
1. Go to Twitter Settings
2. Click "Security and account access"
3. Click "Apps and sessions"
4. Find MastaBlasta
5. Click "Revoke access"

### Token Expiration

- Twitter access tokens expire after **2 hours**
- Refresh tokens last **indefinitely** (until revoked)
- MastaBlasta automatically refreshes tokens
- If auto-refresh fails, simply reconnect

## Tips & Best Practices

### 💡 Tip 1: Keep it Concise

Twitter is about brevity:
- Aim for 100-150 characters
- Get to the point quickly
- Use threads for longer thoughts

### 💡 Tip 2: Use Media

Tweets with images get 150% more engagement:
- Add eye-catching images
- Use videos for demos
- GIFs for humor

### 💡 Tip 3: Best Times to Tweet

Research shows optimal times are:
- **Weekdays**: 8-10 AM, 12-1 PM, 5-6 PM
- **Weekends**: 9-11 AM
- Adjust for your audience's timezone

### 💡 Tip 4: Test Before Scheduling

Before scheduling important tweets:
1. Create a test tweet
2. Publish immediately
3. Check it appears correctly
4. Then schedule your real tweets

### 💡 Tip 5: Monitor Rate Limits

Twitter has posting limits:
- **Free tier**: ~50 tweets per day
- Stay within limits to avoid errors
- Spread tweets throughout the day

## Understanding Threads

### What is a Thread?

A thread is a series of connected tweets:
- Tweet 1/3: First part of story
- Tweet 2/3: Middle part
- Tweet 3/3: Conclusion

### Automatic Thread Creation

MastaBlasta automatically creates threads when:
- Your content exceeds 280 characters
- Split happens at word boundaries
- Thread indicators added (1/3, 2/3, etc.)

### Manual Thread Creation

To force a thread:
```
First tweet text here

---

Second tweet text here

---

Third tweet text here
```

## Rate Limits Explained

### What Are Rate Limits?

Twitter limits how many tweets you can post to prevent spam.

### Free Tier Limits

- **50 tweets per 24 hours**
- Limit resets every day
- Shared across all apps using your account

### What Happens When You Hit the Limit?

- You'll see "Rate limit exceeded" error
- Wait for the limit to reset
- Or contact admin about upgrading

### Tips to Stay Within Limits

1. Schedule tweets throughout the day
2. Don't post in bursts
3. Monitor your usage
4. Quality over quantity

## Need Help?

### Common Questions

**Q: Can I delete tweets after posting?**  
A: Not through MastaBlasta currently, but you can delete directly on Twitter.

**Q: Can I edit tweets?**  
A: Twitter doesn't allow editing tweets (except Twitter Blue users within 30 min).

**Q: How long does my content stay posted?**  
A: Forever, unless you manually delete it on Twitter.

**Q: Can I post to multiple Twitter accounts?**  
A: Yes! Connect multiple accounts and select which one to use.

**Q: What about Twitter Blue features?**  
A: If you have Twitter Blue, you get longer tweets (4,000 chars) automatically.

### Still Having Issues?

1. Check the **[TWITTER_OAUTH_SETUP.md](./TWITTER_OAUTH_SETUP.md)** for detailed troubleshooting
2. Contact your MastaBlasta administrator
3. Check Twitter's [Help Center](https://help.twitter.com/)

---

## For Administrators

If you're setting up MastaBlasta for your users, see:
- **[TWITTER_OAUTH_SETUP.md](./TWITTER_OAUTH_SETUP.md)** - Complete setup guide
- **[PLATFORM_SETUP.md](./PLATFORM_SETUP.md)** - All platforms setup

The key is ensuring OAuth is properly configured so users get the seamless "click and connect" experience described in this guide.

## Quick Reference

### Connection Steps (TL;DR)
1. Accounts page → Quick Connect
2. Select Twitter
3. Authorize in popup
4. Done! ✨

### Posting Steps (TL;DR)
1. Posts page → New Post
2. Write tweet (≤280 chars)
3. Check Twitter
4. Publish Now ✓

### Troubleshooting (TL;DR)
- Popup blocked? → Allow popups
- Token expired? → Reconnect
- Rate limited? → Wait 24 hours
- Need help? → Contact admin

---

**Happy Tweeting! 🐦**
