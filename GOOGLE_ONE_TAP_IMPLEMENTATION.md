# Google One Tap Authentication Implementation

## Overview
This document describes the Google One Tap authentication implementation for MastaBlasta.

## What is Google One Tap?
Google One Tap is a secure, streamlined sign-in flow that allows users to sign in to your application with a single tap using their Google account. It provides:
- **Seamless UX**: Users can sign in without typing passwords
- **Security**: Uses Google's OAuth 2.0 infrastructure
- **Auto-selection**: Can automatically sign in returning users
- **Cross-platform**: Works on web, mobile web, and apps

## Implementation Details

### Backend (`/api/v2/auth/google`)

The backend endpoint verifies Google ID tokens and manages user authentication:

```python
@integrated_bp.route('/auth/google', methods=['POST'])
def google_auth():
    # 1. Receive Google credential (ID token) from frontend
    credential = request.json.get('credential')
    
    # 2. Verify the token with Google
    idinfo = id_token.verify_oauth2_token(
        credential, 
        google_requests.Request(), 
        GOOGLE_CLIENT_ID
    )
    
    # 3. Extract user information
    email = idinfo.get('email')
    name = idinfo.get('name')
    google_id = idinfo.get('sub')
    
    # 4. Create or update user in database
    user = get_or_create_user(email, name)
    
    # 5. Generate JWT tokens
    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)
    
    # 6. Return tokens and user info
    return jsonify({
        'user': {...},
        'access_token': access_token,
        'refresh_token': refresh_token
    })
```

**Key Features:**
- Verifies Google ID tokens server-side for security
- Automatically creates new users on first login
- Returns JWT tokens for session management
- No password storage needed for Google-authenticated users

### Frontend

#### AuthContext (`/src/contexts/AuthContext.tsx`)
Manages authentication state globally:
- Stores user and tokens in localStorage
- Sets Authorization header on axios requests
- Provides login/logout functions
- Handles authentication state across the app

#### LoginPage (`/src/pages/LoginPage.tsx`)
Beautiful login page with Google One Tap:
- Initializes Google One Tap SDK
- Renders Google Sign-In button
- Shows One Tap prompt automatically
- Handles authentication callback
- Displays user-friendly error messages
- Shows app features to entice sign-up

#### Protected Routes
App.tsx now includes:
- Protected route wrapper for authenticated pages
- Automatic redirect to /login for unauthenticated users
- User info display in sidebar
- Logout functionality

## Setup Instructions

### 1. Backend Configuration

Set the Google Client ID environment variable:
```bash
export GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 2. Frontend Configuration

Create `frontend/.env`:
```
VITE_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
```

### 3. Google Cloud Console Setup

1. Go to https://console.cloud.google.com/
2. Create/select a project
3. Enable Google+ API
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized origins:
   - http://localhost:5173 (development)
   - https://yourdomain.com (production)
6. Copy the Client ID

## Security Considerations

✅ **Token Verification**: ID tokens are verified server-side with Google
✅ **JWT Tokens**: Access/refresh tokens use HS256 algorithm
✅ **HTTPS**: Should be used in production
✅ **Token Storage**: Tokens stored in localStorage (consider httpOnly cookies for production)
✅ **CORS**: Properly configured for security
✅ **No Passwords**: Google-authenticated users don't need password storage

## User Experience

### First-Time Users
1. Visit the app
2. See login page with Google button
3. Click "Sign in with Google" or use One Tap prompt
4. Select Google account
5. Automatically created in database
6. Redirected to dashboard

### Returning Users
1. Visit the app
2. One Tap prompt appears automatically
3. Single click to sign in
4. Redirected to dashboard

### Session Management
- Access tokens expire after 15 minutes
- Refresh tokens valid for 30 days
- Automatic token refresh can be implemented
- Logout clears all tokens and redirects to login

## Testing

### Backend Test
```bash
python3 -c "
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
print('✓ Google auth libraries working')
"
```

### Frontend Test
```bash
cd frontend && npm run build
```

### Manual Test
1. Start backend: `python app.py`
2. Start frontend: `cd frontend && npm run dev`
3. Navigate to http://localhost:5173
4. Should see login page
5. Click Google sign-in
6. Should authenticate and redirect to dashboard

## Files Changed

### Backend
- `requirements.txt`: Added google-auth==2.27.0
- `integrated_routes.py`: Added /auth/google endpoint, fixed auth signatures

### Frontend
- `index.html`: Added Google One Tap SDK script
- `src/contexts/AuthContext.tsx`: New authentication context
- `src/pages/LoginPage.tsx`: New login page component
- `src/pages/LoginPage.css`: Login page styling
- `src/App.tsx`: Added protected routes and auth integration
- `.env.example`: Example environment configuration

### Documentation
- `README.md`: Added setup instructions and feature list update

## Maintenance

### Token Refresh
Consider implementing automatic token refresh:
```typescript
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      // Refresh token logic
    }
    return Promise.reject(error);
  }
);
```

### Production Checklist
- [ ] Use HTTPS
- [ ] Configure production Google Client ID
- [ ] Consider httpOnly cookies instead of localStorage
- [ ] Implement token refresh logic
- [ ] Add rate limiting to auth endpoint
- [ ] Monitor authentication failures
- [ ] Set up Google Cloud Console properly
- [ ] Configure authorized domains

## Future Enhancements

1. **Social Login Options**: Add Facebook, GitHub, Apple sign-in
2. **2FA**: Optional two-factor authentication
3. **Email/Password**: Alternative login method
4. **Remember Me**: Extended session duration option
5. **Account Linking**: Link multiple auth methods to one account
6. **Session Management**: View/revoke active sessions
7. **Login History**: Track login attempts and locations

## Troubleshooting

### "Invalid Google token" error
- Check that GOOGLE_CLIENT_ID is set correctly
- Verify the client ID in frontend matches backend
- Ensure the token hasn't expired

### One Tap not showing
- Check that Google SDK script loaded
- Verify VITE_GOOGLE_CLIENT_ID is set
- Check browser console for errors
- Some browsers block third-party cookies

### CORS errors
- Verify Flask-CORS is configured
- Check allowed origins in production
- Ensure credentials are included in requests

## Support

For issues or questions:
1. Check Google Identity documentation
2. Review application logs
3. Test with different browsers
4. Verify environment variables
5. Check Google Cloud Console configuration
