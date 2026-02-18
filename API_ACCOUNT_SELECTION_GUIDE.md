# API Guide: Account Selection by Friendly Name

## Overview

MastaBlasta supports multiple user accounts and multiple platform accounts per user. Each account has a friendly name (display_name) that makes it easy to identify and select specific accounts when posting.

## Key Features

- ✅ Multi-user support with authentication
- ✅ Multiple accounts per platform (e.g., 3 Facebook profiles)
- ✅ Friendly names (display_name) for easy identification
- ✅ Account selection by display_name when posting
- 🔒 Security: Users can only access their own accounts

## Authentication

All API calls require authentication with a Bearer token:

```bash
Authorization: Bearer <your_access_token>
```

Get your access token by logging in:

```bash
POST /api/v2/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your_password"
}

Response:
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {...}
}
```

## Managing Accounts

### 1. List Your Accounts

Get all accounts with their friendly names:

```bash
GET /api/v2/accounts
Authorization: Bearer <token>

Response:
{
  "accounts": [
    {
      "id": "account-uuid-1",
      "platform": "facebook",
      "display_name": "My Business Page",
      "platform_username": "mybusiness",
      "platform_user_id": "123456789",
      "is_active": true,
      "created_at": "2026-02-18T00:00:00Z"
    },
    {
      "id": "account-uuid-2",
      "platform": "facebook",
      "display_name": "Personal Profile",
      "platform_username": "john.doe",
      "platform_user_id": "987654321",
      "is_active": true,
      "created_at": "2026-02-17T00:00:00Z"
    },
    {
      "id": "account-uuid-3",
      "platform": "twitter",
      "display_name": "Personal Twitter",
      "platform_username": "@johndoe",
      "platform_user_id": "111222333",
      "is_active": true,
      "created_at": "2026-02-16T00:00:00Z"
    }
  ],
  "count": 3
}
```

### 2. Get Account Details

Get details for a specific account:

```bash
GET /api/v2/accounts/<account_id>
Authorization: Bearer <token>

Response:
{
  "account": {
    "id": "account-uuid-1",
    "platform": "facebook",
    "display_name": "My Business Page",
    "platform_username": "mybusiness",
    "platform_user_id": "123456789",
    "is_active": true,
    "token_expires_at": "2026-04-18T00:00:00Z",
    "created_at": "2026-02-18T00:00:00Z",
    "updated_at": "2026-02-18T00:00:00Z",
    "platform_metadata": {
      "pages": [...]
    }
  }
}
```

**Security Note**: You can only access accounts that belong to you. Attempting to access another user's account will return a 404 error.

### 3. Update Account Friendly Name

Change the display name for easier identification:

```bash
PATCH /api/v2/accounts/<account_id>
Authorization: Bearer <token>
Content-Type: application/json

{
  "display_name": "Updated Friendly Name"
}

Response:
{
  "success": true,
  "account": {
    "id": "account-uuid-1",
    "platform": "facebook",
    "display_name": "Updated Friendly Name",
    "platform_username": "mybusiness"
  },
  "message": "Account display name updated successfully"
}
```

## Posting to Specific Accounts

### Method 1: Default (First Account)

Post without specifying accounts - uses the first (most recent) account per platform:

```bash
POST /api/v2/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Hello from MastaBlasta!",
  "platforms": ["facebook", "twitter"]
}

Response:
{
  "id": "post-uuid",
  "user_id": "user-uuid",
  "content": "Hello from MastaBlasta!",
  "platforms": ["facebook", "twitter"],
  "status": "draft",
  ...
}
```

Then publish:

```bash
POST /api/v2/posts/<post_id>/publish
Authorization: Bearer <token>

Response:
{
  "results": {
    "facebook": {
      "id": "facebook_post_id_123",
      "success": true
    },
    "twitter": {
      "id": "twitter_post_id_456",
      "success": true
    }
  }
}
```

### Method 2: Select by Friendly Name (Recommended)

Specify which account to use for each platform by display_name:

```bash
POST /api/v2/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "content": "Posting to specific accounts!",
  "platforms": ["facebook", "twitter"]
}

Response:
{
  "id": "post-uuid",
  ...
}
```

Then publish with account selection:

```bash
POST /api/v2/posts/<post_id>/publish
Authorization: Bearer <token>
Content-Type: application/json

{
  "account_names": {
    "facebook": "My Business Page",
    "twitter": "Personal Twitter"
  }
}

Response:
{
  "results": {
    "facebook": {
      "id": "facebook_post_id_789",
      "success": true
    },
    "twitter": {
      "id": "twitter_post_id_012",
      "success": true
    }
  }
}
```

### Method 3: Mixed Selection

You can mix explicit selection and default behavior:

```bash
POST /api/v2/posts/<post_id>/publish
Authorization: Bearer <token>
Content-Type: application/json

{
  "account_names": {
    "facebook": "My Business Page"
    // twitter will use default (first account)
  }
}
```

## Error Handling

### Account Not Found

If the specified display_name doesn't exist:

```json
{
  "results": {
    "facebook": {
      "error": "No active facebook account found with display name \"Non-existent Account\""
    }
  }
}
```

### Unauthorized Access

If you try to access another user's account:

```json
{
  "error": "Unauthorized: You do not own this account"
}
```

Or when trying to publish someone else's post:

```json
{
  "error": "Unauthorized: You can only publish your own posts"
}
```

### No Accounts Available

If you haven't connected any accounts:

```json
{
  "results": {
    "facebook": {
      "error": "No active facebook account found for user"
    }
  }
}
```

## n8n Integration

### Example Workflow

**Step 1: Authenticate**

```javascript
// HTTP Request Node: Login
{
  "method": "POST",
  "url": "https://mastablasta.example.com/api/v2/auth/login",
  "body": {
    "email": "user@example.com",
    "password": "{{$env.MASTABLASTA_PASSWORD}}"
  }
}
// Store access_token in workflow variable
```

**Step 2: List Accounts (Optional)**

```javascript
// HTTP Request Node: Get Accounts
{
  "method": "GET",
  "url": "https://mastablasta.example.com/api/v2/accounts",
  "headers": {
    "Authorization": "Bearer {{$json.access_token}}"
  }
}
```

**Step 3: Create Post**

```javascript
// HTTP Request Node: Create Post
{
  "method": "POST",
  "url": "https://mastablasta.example.com/api/v2/posts",
  "headers": {
    "Authorization": "Bearer {{$json.access_token}}",
    "Content-Type": "application/json"
  },
  "body": {
    "content": "{{$json.message}}",
    "platforms": ["facebook", "twitter"]
  }
}
// Store post_id from response
```

**Step 4: Publish to Specific Accounts**

```javascript
// HTTP Request Node: Publish
{
  "method": "POST",
  "url": "https://mastablasta.example.com/api/v2/posts/{{$json.post_id}}/publish",
  "headers": {
    "Authorization": "Bearer {{$json.access_token}}",
    "Content-Type": "application/json"
  },
  "body": {
    "account_names": {
      "facebook": "My Business Page",
      "twitter": "Personal Twitter"
    }
  }
}
```

## Security Best Practices

### 1. Token Management

- Store access tokens securely
- Use environment variables in n8n
- Refresh tokens before they expire

### 2. Account Isolation

- ✅ Each user can only see their own accounts
- ✅ Each user can only post to their own accounts
- ✅ Account IDs are validated against user ownership
- ✅ Attempting to access another user's account returns 404 (not 403) to prevent information leakage

### 3. API Key Security

- Never commit API keys to version control
- Use separate keys for development and production
- Rotate keys periodically

## Complete Example: Multi-Account Posting

```bash
# 1. Login
curl -X POST https://mastablasta.example.com/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'

# Save the access_token from response
TOKEN="eyJhbGc..."

# 2. List your accounts to see display names
curl -X GET https://mastablasta.example.com/api/v2/accounts \
  -H "Authorization: Bearer $TOKEN"

# 3. Create a post
curl -X POST https://mastablasta.example.com/api/v2/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Check out our new product launch! 🚀",
    "platforms": ["facebook", "twitter", "linkedin"]
  }'

# Save the post_id from response
POST_ID="post-uuid-123"

# 4. Publish to specific accounts
curl -X POST https://mastablasta.example.com/api/v2/posts/$POST_ID/publish \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "account_names": {
      "facebook": "Company Page",
      "twitter": "Corporate Twitter",
      "linkedin": "CEO Account"
    }
  }'
```

## Troubleshooting

### Issue: "No active <platform> account found"

**Solution**: Connect an account for that platform first using OAuth or check that the account is active.

### Issue: "No active <platform> account found with display name 'X'"

**Solution**: 
1. Check available display names with `GET /api/v2/accounts`
2. Ensure the display_name matches exactly (case-sensitive)
3. Update display_name if needed with `PATCH /api/v2/accounts/<id>`

### Issue: "Unauthorized: You do not own this account"

**Solution**: You're trying to use an account_id that belongs to another user. This is a security error. Only use accounts returned from your `GET /api/v2/accounts` call.

### Issue: "Unauthorized: You can only publish your own posts"

**Solution**: You're trying to publish a post created by another user. Each user can only publish their own posts.

## API Reference Summary

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v2/accounts` | List user's accounts | ✓ |
| GET | `/api/v2/accounts/<id>` | Get account details | ✓ |
| PATCH | `/api/v2/accounts/<id>` | Update display_name | ✓ |
| POST | `/api/v2/posts` | Create post | ✓ |
| POST | `/api/v2/posts/<id>/publish` | Publish with optional account_names | ✓ |

## Support

For more information:
- OAuth Setup Guides: See platform-specific guides (FACEBOOK_OAUTH_SETUP.md, TWITTER_OAUTH_SETUP.md, etc.)
- General Setup: See PLATFORM_SETUP.md
- User Guides: See QUICK_*_CONNECT.md files
