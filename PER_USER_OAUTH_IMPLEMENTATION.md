# Per-User OAuth Configuration - Implementation Summary

## Overview

This implementation allows users to configure their own OAuth applications directly through the UI, eliminating the need for environment variables and enabling multi-user OAuth support with isolated credentials.

## What Was Changed

### 1. Database Schema Changes

**New Table: `oauth_app_configs`**
- Stores user's OAuth app credentials (encrypted)
- Fields: `id`, `user_id`, `platform`, `app_name`, `client_id` (encrypted), `client_secret` (encrypted), `redirect_uri`, `additional_config`, `is_active`
- One-to-many relationship with users (each user can have one OAuth app per platform)

**Updated Table: `accounts`**
- Added `oauth_app_config_id` column to link accounts to the OAuth app used for connection
- Allows tracking which OAuth credentials were used to connect each account

**Migration File**: `alembic/versions/a1b2c3d4e5f6_add_oauth_app_configs_table.py`

### 2. Backend Changes

#### OAuth Module (`oauth.py`)

**Updated OAuth Classes** to accept custom credentials:
- `TwitterOAuth.get_authorization_url()` - Now accepts optional `client_id` and `redirect_uri`
- `TwitterOAuth.exchange_code_for_token()` - Now accepts optional credentials
- `MetaOAuth`, `LinkedInOAuth`, `GoogleOAuth` - Similar updates for all platforms

**New Helper Functions**:
- `get_platform_oauth_requirements(platform)` - Returns setup instructions and required fields for each platform
- `get_all_platform_requirements()` - Returns requirements for all platforms

#### API Endpoints (`app.py`)

**New OAuth App Management Endpoints**:
- `GET /api/oauth-apps` - List user's OAuth app configurations
- `POST /api/oauth-apps` - Create new OAuth app configuration
- `PUT /api/oauth-apps/<app_id>` - Update OAuth app configuration
- `DELETE /api/oauth-apps/<app_id>` - Delete OAuth app configuration (soft delete)
- `GET /api/oauth-apps/<platform>/requirements` - Get setup requirements for a specific platform
- `GET /api/oauth-apps/requirements` - Get setup requirements for all platforms

**Updated OAuth Flow Endpoints**:
- `GET /api/oauth/init/<platform>` - Now checks for user's OAuth app first, falls back to environment variables
- `GET /api/oauth/callback/<platform>` - Now uses user's OAuth app for token exchange
- `POST /api/oauth/connect` - Now saves `oauth_app_config_id` with account

### 3. Frontend Changes

#### New Components

**`OAuthAppModal.tsx`**:
- Modal for managing OAuth app configurations
- Platform selection with visual cards
- Setup instructions for each platform
- Form for entering OAuth credentials
- List of configured OAuth apps with delete functionality

#### Updated Components

**`AccountsPage.tsx`**:
- Added "OAuth Apps" button to manage OAuth configurations
- Updated Quick Connect modal to show which platforms have OAuth apps configured
- Added link to setup OAuth apps from Quick Connect modal
- Shows status indicator (✓ Configured / ⚠️ Not configured) for each platform

**`api.ts`**:
- Added `oauthAppsApi` object with methods for managing OAuth apps
- Methods: `getAll()`, `create()`, `update()`, `delete()`, `getPlatformRequirements()`, `getAllRequirements()`

## How It Works

### User Flow

1. **Configure OAuth App (One-time per platform)**:
   - User clicks "OAuth Apps" button on Accounts page
   - Selects a platform (Twitter, Facebook, LinkedIn, etc.)
   - Views platform-specific setup instructions
   - Creates OAuth app in platform's developer portal
   - Enters Client ID and Client Secret in MastaBlasta
   - Credentials are encrypted and stored in database

2. **Connect Account**:
   - User clicks "Quick Connect" button
   - Selects platform (shows ✓ if OAuth app is configured)
   - Clicks "Connect"
   - System uses user's OAuth app credentials to initiate OAuth flow
   - User authorizes in popup window
   - Account is connected and linked to user's OAuth app

### Technical Flow

1. **OAuth Init** (`/api/oauth/init/<platform>`):
   ```
   1. Check if user is authenticated
   2. Query database for user's OAuth app for this platform
   3. If found: Decrypt credentials and generate OAuth URL with user's app
   4. If not found: Fall back to environment variables
   5. Store state with oauth_app_id for callback
   ```

2. **OAuth Callback** (`/api/oauth/callback/<platform>`):
   ```
   1. Receive authorization code from platform
   2. Look up state to find oauth_app_id
   3. If oauth_app_id exists: Use user's OAuth app for token exchange
   4. If not: Use environment OAuth
   5. Return tokens to frontend via postMessage
   ```

3. **Account Connection** (`/api/oauth/connect`):
   ```
   1. Receive OAuth data from frontend
   2. Encrypt access_token and refresh_token
   3. Create Account record with encrypted tokens
   4. Link account to oauth_app_config_id
   5. Return success to frontend
   ```

## Security Features

1. **Encryption**: All OAuth credentials (client secrets, access tokens, refresh tokens) are encrypted using Fernet symmetric encryption before storage

2. **User Isolation**: Each user's OAuth credentials are completely isolated - users cannot see or use other users' OAuth apps

3. **Authentication Required**: All OAuth app management endpoints require JWT authentication

4. **Soft Delete**: OAuth apps are soft-deleted (marked inactive) rather than permanently deleted to maintain referential integrity

## Supported Platforms

Currently configured for:
- **Twitter/X** - OAuth 2.0 with PKCE
- **Facebook/Instagram (Meta)** - OAuth 2.0
- **LinkedIn** - OAuth 2.0
- **YouTube (Google)** - OAuth 2.0

Each platform has:
- Custom setup instructions
- Required fields specification
- Documentation links
- Redirect URI requirements

## Fallback Behavior

The system maintains backward compatibility:

1. If user has configured OAuth app: Use user's credentials
2. If user hasn't configured OAuth app: Fall back to environment variables
3. If neither: Show error message with setup instructions

This ensures existing environment-based setups continue to work while new users can use the per-user configuration.

## Benefits

1. **Multi-User Support**: Each user can use their own OAuth apps
2. **No Environment Access Needed**: Users don't need server access to configure platforms
3. **Rate Limit Isolation**: Each user's API usage is isolated
4. **Easier Onboarding**: Clear UI-based setup process
5. **Better Security**: Credentials encrypted at rest, isolated per user
6. **Scalability**: System can support unlimited users with their own OAuth apps

## Migration Path

For existing users with environment-based OAuth:
1. System continues to work with environment variables
2. Users can optionally migrate to per-user OAuth apps
3. Both approaches can coexist
4. No breaking changes to existing functionality

## Future Enhancements

Potential improvements:
1. OAuth app sharing within teams/organizations
2. Multiple OAuth apps per platform per user (for testing/production)
3. OAuth app templates for common configurations
4. Automated token refresh monitoring
5. Usage analytics per OAuth app
6. Webhook URL configuration for platforms that support it
