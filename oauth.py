"""
Real OAuth implementation for social media platforms
"""
import os
import requests
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone
import secrets
import tweepy
from requests_oauthlib import OAuth2Session
import logging
from urllib.parse import urlencode

logger = logging.getLogger(__name__)

# Platform OAuth Configuration
TWITTER_CLIENT_ID = os.getenv('TWITTER_CLIENT_ID', '')
TWITTER_CLIENT_SECRET = os.getenv('TWITTER_CLIENT_SECRET', '')
TWITTER_REDIRECT_URI = os.getenv('TWITTER_REDIRECT_URI', 'http://localhost:33766/api/oauth/twitter/callback')

META_APP_ID = os.getenv('META_APP_ID', '')
META_APP_SECRET = os.getenv('META_APP_SECRET', '')
META_REDIRECT_URI = os.getenv('META_REDIRECT_URI', 'http://localhost:33766/api/oauth/meta/callback')

LINKEDIN_CLIENT_ID = os.getenv('LINKEDIN_CLIENT_ID', '')
LINKEDIN_CLIENT_SECRET = os.getenv('LINKEDIN_CLIENT_SECRET', '')
LINKEDIN_REDIRECT_URI = os.getenv('LINKEDIN_REDIRECT_URI', 'http://localhost:33766/api/oauth/linkedin/callback')

GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
GOOGLE_REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:33766/api/oauth/google/callback')


class TwitterOAuth:
    """Twitter OAuth 2.0 PKCE implementation"""

    AUTHORIZE_URL = 'https://twitter.com/i/oauth2/authorize'
    TOKEN_URL = 'https://api.twitter.com/2/oauth2/token'
    SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access']

    @classmethod
    def get_authorization_url(cls, state: str) -> Dict[str, str]:
        """Generate authorization URL with PKCE"""
        code_verifier = secrets.token_urlsafe(32)

        oauth = OAuth2Session(
            TWITTER_CLIENT_ID,
            redirect_uri=TWITTER_REDIRECT_URI,
            scope=cls.SCOPES
        )

        authorization_url, state = oauth.authorization_url(
            cls.AUTHORIZE_URL,
            code_challenge=code_verifier,
            code_challenge_method='plain'
        )

        return {
            'authorization_url': authorization_url,
            'state': state,
            'code_verifier': code_verifier
        }

    @classmethod
    def exchange_code_for_token(cls, code: str, code_verifier: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token"""
        try:
            data = {
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': TWITTER_REDIRECT_URI,
                'code_verifier': code_verifier,
                'client_id': TWITTER_CLIENT_ID
            }

            response = requests.post(cls.TOKEN_URL, data=data)
            response.raise_for_status()

            token_data = response.json()
            return {
                'access_token': token_data['access_token'],
                'refresh_token': token_data.get('refresh_token'),
                'expires_at': datetime.now(timezone.utc) + timedelta(seconds=token_data['expires_in'])
            }
        except Exception as e:
            logger.error(f"Twitter token exchange failed: {e}")
            return None

    @classmethod
    def post_tweet(cls, access_token: str, content: str, media_ids: list = None) -> Optional[Dict[str, Any]]:
        """Post a tweet using Twitter API v2"""
        try:
            client = tweepy.Client(bearer_token=access_token)

            tweet_data = {'text': content}
            if media_ids:
                tweet_data['media'] = {'media_ids': media_ids}

            response = client.create_tweet(**tweet_data)
            return {'id': response.data['id'], 'text': response.data['text']}
        except Exception as e:
            logger.error(f"Twitter post failed: {e}")
            return None


class MetaOAuth:
    """Meta (Facebook/Instagram) OAuth implementation"""

    AUTHORIZE_URL = 'https://www.facebook.com/v18.0/dialog/oauth'
    TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token'
    GRAPH_API_URL = 'https://graph.facebook.com/v18.0'
    SCOPES = ['pages_manage_posts', 'pages_read_engagement', 'instagram_basic', 'instagram_content_publish']

    @classmethod
    def get_authorization_url(cls, state: str) -> str:
        """Generate Meta OAuth authorization URL"""
        params = {
            'client_id': META_APP_ID,
            'redirect_uri': META_REDIRECT_URI,
            'state': state,
            'scope': ','.join(cls.SCOPES),
            'response_type': 'code'
        }

        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{cls.AUTHORIZE_URL}?{query_string}"

    @classmethod
    def exchange_code_for_token(cls, code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token"""
        try:
            params = {
                'client_id': META_APP_ID,
                'client_secret': META_APP_SECRET,
                'redirect_uri': META_REDIRECT_URI,
                'code': code
            }

            response = requests.get(cls.TOKEN_URL, params=params)
            response.raise_for_status()

            token_data = response.json()

            # Exchange short-lived token for long-lived token
            long_lived_params = {
                'grant_type': 'fb_exchange_token',
                'client_id': META_APP_ID,
                'client_secret': META_APP_SECRET,
                'fb_exchange_token': token_data['access_token']
            }

            long_lived_response = requests.get(cls.TOKEN_URL, params=long_lived_params)
            long_lived_response.raise_for_status()
            long_lived_data = long_lived_response.json()

            return {
                'access_token': long_lived_data['access_token'],
                'expires_at': datetime.now(timezone.utc) + timedelta(seconds=long_lived_data.get('expires_in', 5184000))  # ~60 days
            }
        except Exception as e:
            logger.error(f"Meta token exchange failed: {e}")
            return None

    @classmethod
    def post_to_facebook_page(cls, access_token: str, page_id: str, content: str, media_url: str = None) -> Optional[Dict[str, Any]]:
        """Post to Facebook Page"""
        try:
            url = f"{cls.GRAPH_API_URL}/{page_id}/feed"
            data = {
                'message': content,
                'access_token': access_token
            }

            if media_url:
                data['link'] = media_url

            response = requests.post(url, data=data)
            response.raise_for_status()

            return response.json()
        except Exception as e:
            logger.error(f"Facebook post failed: {e}")
            return None

    @classmethod
    def post_instagram_media(cls, access_token: str, instagram_account_id: str,
                             image_url: str, caption: str) -> Optional[Dict[str, Any]]:
        """Post to Instagram"""
        try:
            # Step 1: Create media container
            container_url = f"{cls.GRAPH_API_URL}/{instagram_account_id}/media"
            container_data = {
                'image_url': image_url,
                'caption': caption,
                'access_token': access_token
            }

            container_response = requests.post(container_url, data=container_data)
            container_response.raise_for_status()
            container_id = container_response.json()['id']

            # Step 2: Publish media
            publish_url = f"{cls.GRAPH_API_URL}/{instagram_account_id}/media_publish"
            publish_data = {
                'creation_id': container_id,
                'access_token': access_token
            }

            publish_response = requests.post(publish_url, data=publish_data)
            publish_response.raise_for_status()

            return publish_response.json()
        except Exception as e:
            logger.error(f"Instagram post failed: {e}")
            return None


class LinkedInOAuth:
    """LinkedIn OAuth 2.0 implementation"""

    AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization'
    TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken'
    API_URL = 'https://api.linkedin.com/v2'
    SCOPES = ['w_member_social', 'r_liteprofile', 'r_emailaddress']

    @classmethod
    def get_authorization_url(cls, state: str) -> str:
        """Generate LinkedIn OAuth authorization URL"""
        params = {
            'response_type': 'code',
            'client_id': LINKEDIN_CLIENT_ID,
            'redirect_uri': LINKEDIN_REDIRECT_URI,
            'state': state,
            'scope': ' '.join(cls.SCOPES)
        }

        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{cls.AUTHORIZE_URL}?{query_string}"

    @classmethod
    def exchange_code_for_token(cls, code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token"""
        try:
            data = {
                'grant_type': 'authorization_code',
                'code': code,
                'redirect_uri': LINKEDIN_REDIRECT_URI,
                'client_id': LINKEDIN_CLIENT_ID,
                'client_secret': LINKEDIN_CLIENT_SECRET
            }

            response = requests.post(cls.TOKEN_URL, data=data)
            response.raise_for_status()

            token_data = response.json()
            return {
                'access_token': token_data['access_token'],
                'expires_at': datetime.now(timezone.utc) + timedelta(seconds=token_data['expires_in'])
            }
        except Exception as e:
            logger.error(f"LinkedIn token exchange failed: {e}")
            return None

    @classmethod
    def post_share(cls, access_token: str, content: str, visibility: str = 'PUBLIC') -> Optional[Dict[str, Any]]:
        """Post a share on LinkedIn"""
        try:
            # Get user ID
            me_url = f"{cls.API_URL}/me"
            me_response = requests.get(me_url, headers={'Authorization': f'Bearer {access_token}'})
            me_response.raise_for_status()
            user_id = me_response.json()['id']

            # Create share
            share_url = f"{cls.API_URL}/ugcPosts"
            share_data = {
                'author': f'urn:li:person:{user_id}',
                'lifecycleState': 'PUBLISHED',
                'specificContent': {
                    'com.linkedin.ugc.ShareContent': {
                        'shareCommentary': {
                            'text': content
                        },
                        'shareMediaCategory': 'NONE'
                    }
                },
                'visibility': {
                    'com.linkedin.ugc.MemberNetworkVisibility': visibility
                }
            }

            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }

            response = requests.post(share_url, json=share_data, headers=headers)
            response.raise_for_status()

            return response.json()
        except Exception as e:
            logger.error(f"LinkedIn post failed: {e}")
            return None


class GoogleOAuth:
    """Google (YouTube) OAuth 2.0 implementation"""

    AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
    TOKEN_URL = 'https://oauth2.googleapis.com/token'
    YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'
    SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube']

    @classmethod
    def get_authorization_url(cls, state: str) -> str:
        """Generate Google OAuth authorization URL"""
        params = {
            'client_id': GOOGLE_CLIENT_ID,
            'redirect_uri': GOOGLE_REDIRECT_URI,
            'response_type': 'code',
            'scope': ' '.join(cls.SCOPES),
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state
        }

        query_string = '&'.join([f"{k}={v}" for k, v in params.items()])
        return f"{cls.AUTHORIZE_URL}?{query_string}"

    @classmethod
    def exchange_code_for_token(cls, code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token"""
        try:
            data = {
                'code': code,
                'client_id': GOOGLE_CLIENT_ID,
                'client_secret': GOOGLE_CLIENT_SECRET,
                'redirect_uri': GOOGLE_REDIRECT_URI,
                'grant_type': 'authorization_code'
            }

            response = requests.post(cls.TOKEN_URL, data=data)
            response.raise_for_status()

            token_data = response.json()
            return {
                'access_token': token_data['access_token'],
                'refresh_token': token_data.get('refresh_token'),
                'expires_at': datetime.now(timezone.utc) + timedelta(seconds=token_data['expires_in'])
            }
        except Exception as e:
            logger.error(f"Google token exchange failed: {e}")
            return None


class GoogleCalendarOAuth:
    """Google Calendar OAuth 2.0 implementation"""

    AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
    TOKEN_URL = 'https://oauth2.googleapis.com/token'
    CALENDAR_API_URL = 'https://www.googleapis.com/calendar/v3'
    SCOPES = ['https://www.googleapis.com/auth/calendar.events']

    @classmethod
    def get_authorization_url(cls, user_id: str, state: str) -> str:
        """Generate Google Calendar OAuth authorization URL"""
        # Build redirect URI properly - ensure we have a base URL
        base_redirect_uri = GOOGLE_REDIRECT_URI
        if '/callback' in base_redirect_uri:
            # Remove the existing callback path
            base_redirect_uri = base_redirect_uri.rsplit('/callback', 1)[0]
        elif base_redirect_uri.endswith('/'):
            base_redirect_uri = base_redirect_uri.rstrip('/')
        
        redirect_uri = f"{base_redirect_uri}/calendar"
        
        params = {
            'client_id': GOOGLE_CLIENT_ID,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(cls.SCOPES),
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state
        }

        query_string = urlencode(params)
        return f"{cls.AUTHORIZE_URL}?{query_string}"

    @classmethod
    def exchange_code_for_token(cls, code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token"""
        try:
            data = {
                'code': code,
                'client_id': GOOGLE_CLIENT_ID,
                'client_secret': GOOGLE_CLIENT_SECRET,
                'redirect_uri': f"{GOOGLE_REDIRECT_URI.rsplit('/', 1)[0]}/calendar",
                'grant_type': 'authorization_code'
            }

            response = requests.post(cls.TOKEN_URL, data=data)
            response.raise_for_status()

            token_data = response.json()
            return {
                'access_token': token_data['access_token'],
                'refresh_token': token_data.get('refresh_token'),
                'expires_at': datetime.now(timezone.utc) + timedelta(seconds=token_data['expires_in'])
            }
        except Exception as e:
            logger.error(f"Google Calendar token exchange failed: {e}")
            return None

    @classmethod
    def create_calendar_event(cls, access_token: str, calendar_id: str, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a new calendar event"""
        try:
            url = f"{cls.CALENDAR_API_URL}/calendars/{calendar_id}/events"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }

            response = requests.post(url, headers=headers, json=event_data)
            response.raise_for_status()

            return response.json()
        except Exception as e:
            logger.error(f"Failed to create calendar event: {e}")
            return None

    @classmethod
    def update_calendar_event(cls, access_token: str, calendar_id: str, event_id: str, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update an existing calendar event"""
        try:
            url = f"{cls.CALENDAR_API_URL}/calendars/{calendar_id}/events/{event_id}"
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }

            response = requests.put(url, headers=headers, json=event_data)
            response.raise_for_status()

            return response.json()
        except Exception as e:
            logger.error(f"Failed to update calendar event: {e}")
            return None


class GoogleDriveOAuth:
    """Google Drive OAuth 2.0 implementation"""

    AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
    TOKEN_URL = 'https://oauth2.googleapis.com/token'
    DRIVE_API_URL = 'https://www.googleapis.com/drive/v3'
    SCOPES = [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file'
    ]

    @classmethod
    def get_authorization_url(cls, user_id: str, state: str) -> str:
        """Generate Google Drive OAuth authorization URL"""
        # Build redirect URI properly - ensure we have a base URL
        base_redirect_uri = GOOGLE_REDIRECT_URI
        if '/callback' in base_redirect_uri:
            # Remove the existing callback path
            base_redirect_uri = base_redirect_uri.rsplit('/callback', 1)[0]
        elif base_redirect_uri.endswith('/'):
            base_redirect_uri = base_redirect_uri.rstrip('/')
        
        redirect_uri = f"{base_redirect_uri}/drive"
        
        params = {
            'client_id': GOOGLE_CLIENT_ID,
            'redirect_uri': redirect_uri,
            'response_type': 'code',
            'scope': ' '.join(cls.SCOPES),
            'access_type': 'offline',
            'prompt': 'consent',
            'state': state
        }

        query_string = urlencode(params)
        return f"{cls.AUTHORIZE_URL}?{query_string}"

    @classmethod
    def exchange_code_for_token(cls, code: str) -> Optional[Dict[str, Any]]:
        """Exchange authorization code for access token"""
        try:
            data = {
                'code': code,
                'client_id': GOOGLE_CLIENT_ID,
                'client_secret': GOOGLE_CLIENT_SECRET,
                'redirect_uri': f"{GOOGLE_REDIRECT_URI.rsplit('/', 1)[0]}/drive",
                'grant_type': 'authorization_code'
            }

            response = requests.post(cls.TOKEN_URL, data=data)
            response.raise_for_status()

            token_data = response.json()
            return {
                'access_token': token_data['access_token'],
                'refresh_token': token_data.get('refresh_token'),
                'expires_at': datetime.now(timezone.utc) + timedelta(seconds=token_data['expires_in'])
            }
        except Exception as e:
            logger.error(f"Google Drive token exchange failed: {e}")
            return None

    @classmethod
    def list_files(cls, access_token: str, folder_id: str = 'root', page_size: int = 100) -> Optional[Dict[str, Any]]:
        """List files from Google Drive"""
        try:
            url = f"{cls.DRIVE_API_URL}/files"
            headers = {'Authorization': f'Bearer {access_token}'}
            params = {
                'pageSize': page_size,
                'fields': 'files(id,name,mimeType,size,createdTime,thumbnailLink,webViewLink)',
                'q': f"'{folder_id}' in parents and trashed=false"
            }

            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()

            return response.json()
        except Exception as e:
            logger.error(f"Failed to list Drive files: {e}")
            return None

    @classmethod
    def get_file_metadata(cls, access_token: str, file_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for a specific file"""
        try:
            url = f"{cls.DRIVE_API_URL}/files/{file_id}"
            headers = {'Authorization': f'Bearer {access_token}'}
            params = {
                'fields': 'id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink,webContentLink'
            }

            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()

            return response.json()
        except Exception as e:
            logger.error(f"Failed to get file metadata: {e}")
            return None

    @classmethod
    def download_file(cls, access_token: str, file_id: str) -> Optional[bytes]:
        """Download file content from Google Drive"""
        try:
            url = f"{cls.DRIVE_API_URL}/files/{file_id}"
            headers = {'Authorization': f'Bearer {access_token}'}
            params = {'alt': 'media'}

            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()

            return response.content
        except Exception as e:
            logger.error(f"Failed to download file: {e}")
            return None


def refresh_access_token(platform: str, refresh_token: str) -> Optional[Dict[str, Any]]:
    """Refresh an expired access token"""
    try:
        if platform == 'twitter':
            data = {
                'grant_type': 'refresh_token',
                'refresh_token': refresh_token,
                'client_id': TWITTER_CLIENT_ID
            }
            response = requests.post(TwitterOAuth.TOKEN_URL, data=data)
        elif platform == 'google':
            data = {
                'client_id': GOOGLE_CLIENT_ID,
                'client_secret': GOOGLE_CLIENT_SECRET,
                'refresh_token': refresh_token,
                'grant_type': 'refresh_token'
            }
            response = requests.post(GoogleOAuth.TOKEN_URL, data=data)
        else:
            return None

        response.raise_for_status()
        token_data = response.json()

        return {
            'access_token': token_data['access_token'],
            'expires_at': datetime.now(timezone.utc) + timedelta(seconds=token_data['expires_in'])
        }
    except Exception as e:
        logger.error(f"Token refresh failed for {platform}: {e}")
        return None


class ConnectionHealthMonitor:
    """Monitor OAuth connection health and status"""

    @staticmethod
    def check_connection_status(platform: str, access_token: str, expires_at: datetime) -> Dict[str, Any]:
        """Check if a connection is healthy"""
        status = {
            'platform': platform,
            'is_connected': True,
            'is_expired': False,
            'expires_in_hours': None,
            'health_status': 'healthy',
            'warnings': []
        }

        # Check expiration
        if expires_at:
            now = datetime.now(timezone.utc)
            if expires_at < now:
                status['is_expired'] = True
                status['health_status'] = 'expired'
                status['warnings'].append('Token has expired')
            else:
                delta = expires_at - now
                hours_remaining = delta.total_seconds() / 3600
                status['expires_in_hours'] = round(hours_remaining, 1)

                if hours_remaining < 24:
                    status['health_status'] = 'expiring_soon'
                    status['warnings'].append(f'Token expires in {round(hours_remaining, 1)} hours')

        # Test API connectivity
        try:
            if platform == 'twitter' and access_token:
                client = tweepy.Client(access_token)  # Use access_token parameter for user auth
                client.get_me()
            elif platform == 'meta' and access_token:
                response = requests.get(
                    'https://graph.facebook.com/v18.0/me',
                    headers={'Authorization': f'Bearer {access_token}'}
                )
                response.raise_for_status()
            elif platform == 'linkedin' and access_token:
                response = requests.get(
                    'https://api.linkedin.com/v2/me',
                    headers={'Authorization': f'Bearer {access_token}'}
                )
                response.raise_for_status()
            elif platform == 'google' and access_token:
                response = requests.get(
                    'https://www.googleapis.com/oauth2/v1/userinfo',
                    headers={'Authorization': f'Bearer {access_token}'}
                )
                response.raise_for_status()
        except Exception as e:
            status['health_status'] = 'unhealthy'
            status['warnings'].append(f'API test failed: {str(e)}')
            status['is_connected'] = False

        return status

    @staticmethod
    def get_reconnection_instructions(platform: str) -> Dict[str, Any]:
        """Get instructions for reconnecting a platform"""
        instructions = {
            'twitter': {
                'title': 'Reconnect Twitter/X',
                'steps': [
                    'Go to Accounts page',
                    'Click "Connect Twitter/X"',
                    'Authorize the application',
                    'You will be redirected back automatically'
                ],
                'required_permissions': ['tweet.read', 'tweet.write', 'users.read', 'offline.access']
            },
            'meta': {
                'title': 'Reconnect Facebook/Instagram',
                'steps': [
                    'Go to Accounts page',
                    'Click "Connect Facebook" or "Connect Instagram"',
                    'Log in to Facebook if needed',
                    'Select the Page/Account to connect',
                    'Grant requested permissions',
                    'You will be redirected back automatically'
                ],
                'required_permissions': [
                    'pages_manage_posts', 'pages_read_engagement',
                    'instagram_basic', 'instagram_content_publish'
                ]
            },
            'linkedin': {
                'title': 'Reconnect LinkedIn',
                'steps': [
                    'Go to Accounts page',
                    'Click "Connect LinkedIn"',
                    'Log in to LinkedIn if needed',
                    'Grant requested permissions',
                    'You will be redirected back automatically'
                ],
                'required_permissions': ['w_member_social', 'r_liteprofile', 'r_emailaddress']
            },
            'google': {
                'title': 'Reconnect YouTube',
                'steps': [
                    'Go to Accounts page',
                    'Click "Connect YouTube"',
                    'Select your Google account',
                    'Grant YouTube permissions',
                    'You will be redirected back automatically'
                ],
                'required_permissions': ['youtube.upload', 'youtube']
            }
        }

        return instructions.get(platform, {
            'title': f'Reconnect {platform.title()}',
            'steps': ['Visit Accounts page and click Connect button'],
            'required_permissions': []
        })


class PlatformAccountValidator:
    """Validate platform accounts and permissions"""

    @staticmethod
    def validate_account_setup(platform: str, access_token: str) -> Dict[str, Any]:
        """Validate that an account is properly configured"""
        validation = {
            'platform': platform,
            'is_valid': True,
            'errors': [],
            'warnings': [],
            'account_info': {}
        }

        try:
            if platform == 'twitter':
                client = tweepy.Client(access_token)  # Use access_token parameter for user auth
                me = client.get_me()
                validation['account_info'] = {
                    'username': me.data.username,
                    'name': me.data.name,
                    'id': me.data.id
                }
            elif platform == 'meta':
                response = requests.get(
                    'https://graph.facebook.com/v18.0/me',
                    params={
                        'access_token': access_token,
                        'fields': 'id,name,accounts{id,name,access_token}'
                    }
                )
                response.raise_for_status()
                data = response.json()
                validation['account_info'] = {
                    'user_id': data.get('id'),
                    'name': data.get('name'),
                    'pages': [{'id': page['id'], 'name': page['name']} for page in data.get('accounts', [])]
                }

                if not validation['account_info'].get('pages'):
                    validation['warnings'].append('No Facebook Pages found. You need a Page to post.')
            elif platform == 'linkedin':
                response = requests.get(
                    'https://api.linkedin.com/v2/me',
                    headers={'Authorization': f'Bearer {access_token}'}
                )
                response.raise_for_status()
                data = response.json()
                validation['account_info'] = {
                    'id': data.get('id'),
                    'firstName': data.get('localizedFirstName'),
                    'lastName': data.get('localizedLastName')
                }
            elif platform == 'google':
                response = requests.get(
                    'https://www.googleapis.com/youtube/v3/channels',
                    params={'part': 'snippet', 'mine': 'true'},
                    headers={'Authorization': f'Bearer {access_token}'}
                )
                response.raise_for_status()
                data = response.json()

                if data.get('items'):
                    channel = data['items'][0]
                    validation['account_info'] = {
                        'channel_id': channel['id'],
                        'title': channel['snippet']['title'],
                        'description': channel['snippet']['description']
                    }
                else:
                    validation['errors'].append('No YouTube channel found for this account')
                    validation['is_valid'] = False

        except Exception as e:
            validation['is_valid'] = False
            validation['errors'].append(f'Validation failed: {str(e)}')

        return validation

    @staticmethod
    def check_permissions(platform: str, access_token: str) -> Dict[str, Any]:
        """Check what permissions are granted for an account"""
        permissions = {
            'platform': platform,
            'granted_permissions': [],
            'missing_permissions': [],
            'can_post': False,
            'can_read': False
        }

        try:
            if platform == 'twitter':
                # Twitter API v2 doesn't provide a simple scope check, assume granted based on successful connection
                permissions['granted_permissions'] = ['tweet.read', 'tweet.write', 'users.read']
                permissions['can_post'] = True
                permissions['can_read'] = True
            elif platform == 'meta':
                response = requests.get(
                    'https://graph.facebook.com/v18.0/me/permissions',
                    params={'access_token': access_token}
                )
                response.raise_for_status()
                data = response.json()

                for perm in data.get('data', []):
                    if perm.get('status') == 'granted':
                        permissions['granted_permissions'].append(perm['permission'])

                permissions['can_post'] = 'pages_manage_posts' in permissions['granted_permissions']
                permissions['can_read'] = 'pages_read_engagement' in permissions['granted_permissions']
            elif platform == 'linkedin':
                # LinkedIn doesn't provide a scope introspection endpoint, assume based on successful auth
                permissions['granted_permissions'] = ['w_member_social', 'r_liteprofile']
                permissions['can_post'] = True
                permissions['can_read'] = True
            elif platform == 'google':
                response = requests.get(
                    'https://www.googleapis.com/oauth2/v1/tokeninfo',
                    params={'access_token': access_token}
                )
                response.raise_for_status()
                data = response.json()
                permissions['granted_permissions'] = data.get('scope', '').split()
                permissions['can_post'] = 'https://www.googleapis.com/auth/youtube.upload' in permissions['granted_permissions']
                permissions['can_read'] = 'https://www.googleapis.com/auth/youtube' in permissions['granted_permissions']

        except Exception as e:
            logger.error(f"Permission check failed for {platform}: {e}")

        return permissions


class QuickConnectWizard:
    """Simplified wizard for quick platform connections"""

    PLATFORM_CONFIGS = {
        'twitter': {
            'display_name': 'Twitter/X',
            'icon': '𝕏',
            'color': '#000000',
            'difficulty': 'easy',
            'setup_time': '2 minutes',
            'features': ['Post tweets', 'Post threads', 'Upload media', 'Auto-scheduling']
        },
        'meta_facebook': {
            'display_name': 'Facebook',
            'icon': '📘',
            'color': '#1877F2',
            'difficulty': 'easy',
            'setup_time': '3 minutes',
            'features': ['Post to Pages', 'Share photos/videos', 'Auto-scheduling', 'Analytics']
        },
        'meta_instagram': {
            'display_name': 'Instagram',
            'icon': '📷',
            'color': '#E4405F',
            'difficulty': 'medium',
            'setup_time': '5 minutes',
            'features': ['Post photos/videos', 'Reels', 'Stories', 'Auto-scheduling'],
            'requirements': ['Business/Creator account', 'Connected to Facebook Page']
        },
        'linkedin': {
            'display_name': 'LinkedIn',
            'icon': '💼',
            'color': '#0A66C2',
            'difficulty': 'easy',
            'setup_time': '2 minutes',
            'features': ['Post updates', 'Share articles', 'Auto-scheduling', 'Professional network']
        },
        'google_youtube': {
            'display_name': 'YouTube',
            'icon': '▶️',
            'color': '#FF0000',
            'difficulty': 'medium',
            'setup_time': '4 minutes',
            'features': ['Upload videos', 'Shorts', 'Thumbnails', 'Descriptions'],
            'requirements': ['YouTube channel']
        },
        'tiktok': {
            'display_name': 'TikTok',
            'icon': '🎵',
            'color': '#000000',
            'difficulty': 'hard',
            'setup_time': '10 minutes',
            'features': ['Upload videos', 'Auto-scheduling', 'Trending sounds'],
            'requirements': ['Business account', 'Manual API setup required']
        },
        'pinterest': {
            'display_name': 'Pinterest',
            'icon': '📌',
            'color': '#E60023',
            'difficulty': 'easy',
            'setup_time': '3 minutes',
            'features': ['Create pins', 'Upload images', 'Boards', 'Auto-scheduling']
        }
    }

    @classmethod
    def get_quick_connect_options(cls) -> Dict[str, Any]:
        """Get all quick connect platform options"""
        return {
            'platforms': cls.PLATFORM_CONFIGS,
            'recommended_order': ['twitter', 'meta_facebook', 'meta_instagram', 'linkedin', 'google_youtube'],
            'total_platforms': len(cls.PLATFORM_CONFIGS)
        }

    @classmethod
    def get_platform_config(cls, platform: str) -> Dict[str, Any]:
        """Get configuration for a specific platform"""
        return cls.PLATFORM_CONFIGS.get(platform, {})

    @classmethod
    def generate_connection_url(cls, platform: str, state: str, user_id: str) -> Dict[str, Any]:
        """Generate a connection URL with enhanced user experience"""
        base_platform = platform.split('_')[0] if '_' in platform else platform

        result = {
            'platform': platform,
            'display_name': cls.PLATFORM_CONFIGS.get(platform, {}).get('display_name', platform.title()),
            'state': state,
            'user_id': user_id,
            'authorization_url': None,
            'instructions': None
        }

        try:
            if base_platform == 'twitter':
                auth_data = TwitterOAuth.get_authorization_url(state)
                result['authorization_url'] = auth_data['authorization_url']
                result['code_verifier'] = auth_data['code_verifier']
            elif base_platform == 'meta':
                result['authorization_url'] = MetaOAuth.get_authorization_url(state)
            elif base_platform == 'linkedin':
                result['authorization_url'] = LinkedInOAuth.get_authorization_url(state)
            elif base_platform == 'google':
                result['authorization_url'] = GoogleOAuth.get_authorization_url(state)
            else:
                result['error'] = f'Platform {platform} not supported for OAuth connection'
                result['instructions'] = f'Please configure {platform} manually via API keys or check platform documentation'
        except Exception as e:
            result['error'] = f'Failed to generate connection URL: {str(e)}'
            logger.error(f"Connection URL generation failed for {platform}: {e}")

        return result


class ConnectionTroubleshooter:
    """Diagnose and fix connection issues"""

    @staticmethod
    def diagnose_connection_issue(platform: str, error_code: str = None, error_message: str = None) -> Dict[str, Any]:
        """Diagnose connection issues and provide solutions"""
        diagnosis = {
            'platform': platform,
            'issue_type': 'unknown',
            'severity': 'medium',
            'possible_causes': [],
            'solutions': [],
            'docs_url': None
        }

        # Analyze error patterns
        if error_message:
            error_lower = error_message.lower()

            if 'invalid_client' in error_lower or 'client_id' in error_lower:
                diagnosis['issue_type'] = 'invalid_credentials'
                diagnosis['severity'] = 'high'
                diagnosis['possible_causes'] = [
                    'Client ID is incorrect',
                    'Client ID not set in environment variables',
                    'Using wrong type of credentials (API key vs OAuth)'
                ]
                diagnosis['solutions'] = [
                    f'Verify {platform.upper()}_CLIENT_ID environment variable',
                    f'Check credentials in {platform} developer dashboard',
                    'Restart application after updating environment variables',
                    'Ensure no extra spaces or quotes in credentials'
                ]
            elif 'redirect_uri' in error_lower or 'callback' in error_lower:
                diagnosis['issue_type'] = 'redirect_uri_mismatch'
                diagnosis['severity'] = 'high'
                diagnosis['possible_causes'] = [
                    'Redirect URI not registered in platform',
                    'Redirect URI doesn\'t match exactly',
                    'Missing protocol (http:// or https://)',
                    'Trailing slash mismatch'
                ]
                diagnosis['solutions'] = [
                    f'Register redirect URI in {platform} app settings',
                    'Ensure exact match including protocol and port',
                    f'Check {platform.upper()}_REDIRECT_URI environment variable',
                    'Remove any trailing slashes from redirect URI'
                ]
            elif 'expired' in error_lower or 'token' in error_lower:
                diagnosis['issue_type'] = 'expired_token'
                diagnosis['severity'] = 'medium'
                diagnosis['possible_causes'] = [
                    'Access token has expired',
                    'Refresh token is invalid',
                    'Platform revoked access'
                ]
                diagnosis['solutions'] = [
                    'Reconnect the account',
                    'Check if user revoked access in platform settings',
                    'Enable automatic token refresh',
                    'Verify refresh token is stored correctly'
                ]
            elif 'permission' in error_lower or 'scope' in error_lower or 'access denied' in error_lower:
                diagnosis['issue_type'] = 'insufficient_permissions'
                diagnosis['severity'] = 'high'
                diagnosis['possible_causes'] = [
                    'Required permissions not granted',
                    'User denied permissions during OAuth',
                    'App doesn\'t have access to required features'
                ]
                diagnosis['solutions'] = [
                    'Reconnect and grant all requested permissions',
                    f'Check app permissions in {platform} developer dashboard',
                    'For Facebook/Instagram: Ensure app has required products added',
                    'For YouTube: Verify YouTube Data API is enabled'
                ]
            elif 'rate' in error_lower or '429' in error_lower:
                diagnosis['issue_type'] = 'rate_limit'
                diagnosis['severity'] = 'low'
                diagnosis['possible_causes'] = [
                    'Too many API requests',
                    'Platform rate limit exceeded'
                ]
                diagnosis['solutions'] = [
                    'Wait before retrying',
                    'Reduce posting frequency',
                    'Check platform API usage dashboard',
                    'Consider upgrading API tier if available'
                ]
            elif 'network' in error_lower or 'timeout' in error_lower or 'connection' in error_lower:
                diagnosis['issue_type'] = 'network_error'
                diagnosis['severity'] = 'low'
                diagnosis['possible_causes'] = [
                    'Network connectivity issues',
                    'Platform API is down',
                    'Firewall blocking requests'
                ]
                diagnosis['solutions'] = [
                    'Check internet connection',
                    'Retry in a few moments',
                    'Check platform status page',
                    'Verify no firewall/proxy blocking requests'
                ]

        # Add platform-specific documentation
        docs_urls = {
            'twitter': 'https://developer.twitter.com/en/docs/authentication/oauth-2-0',
            'meta': 'https://developers.facebook.com/docs/facebook-login',
            'linkedin': 'https://docs.microsoft.com/en-us/linkedin/shared/authentication/authentication',
            'google': 'https://developers.google.com/identity/protocols/oauth2'
        }
        diagnosis['docs_url'] = docs_urls.get(platform)

        return diagnosis

    @staticmethod
    def test_connection_prerequisites(platform: str) -> Dict[str, Any]:
        """Test if all prerequisites are met for connecting a platform"""
        test_results = {
            'platform': platform,
            'ready_to_connect': True,
            'checks': []
        }

        # Check environment variables
        env_var_map = {
            'twitter': ('TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET'),
            'meta': ('META_APP_ID', 'META_APP_SECRET'),
            'linkedin': ('LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET'),
            'google': ('GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET')
        }

        if platform in env_var_map:
            for var in env_var_map[platform]:
                value = os.getenv(var)
                check = {
                    'name': f'Environment variable: {var}',
                    'status': 'pass' if value else 'fail',
                    'message': 'Set' if value else 'Not set - connection will fail'
                }
                test_results['checks'].append(check)
                if not value:
                    test_results['ready_to_connect'] = False

        # Check redirect URI
        redirect_var_map = {
            'twitter': 'TWITTER_REDIRECT_URI',
            'meta': 'META_REDIRECT_URI',
            'linkedin': 'LINKEDIN_REDIRECT_URI',
            'google': 'GOOGLE_REDIRECT_URI'
        }

        if platform in redirect_var_map:
            redirect_uri = os.getenv(redirect_var_map[platform])
            check = {
                'name': f'Redirect URI: {redirect_var_map[platform]}',
                'status': 'pass' if redirect_uri else 'fail',
                'message': redirect_uri if redirect_uri else 'Not set'
            }
            test_results['checks'].append(check)
            if not redirect_uri:
                test_results['ready_to_connect'] = False

        return test_results


class BulkConnectionManager:
    """Manage multiple platform connections at once"""

    @staticmethod
    def prepare_bulk_connection(platforms: list, user_id: str) -> Dict[str, Any]:
        """Prepare to connect multiple platforms in sequence"""
        wizard = QuickConnectWizard()

        result = {
            'total_platforms': len(platforms),
            'connection_sequence': [],
            'estimated_time_minutes': 0
        }

        for platform in platforms:
            config = wizard.get_platform_config(platform)
            state = secrets.token_urlsafe(32)

            connection_data = wizard.generate_connection_url(platform, state, user_id)
            connection_data['config'] = config

            result['connection_sequence'].append(connection_data)

            # Estimate time
            setup_time_str = config.get('setup_time', '3 minutes')
            # Extract first number from string like "2 minutes" or "10 minutes"
            import re
            match = re.search(r'\d+', setup_time_str)
            minutes = int(match.group()) if match else 3
            result['estimated_time_minutes'] += minutes

        return result

    @staticmethod
    def get_bulk_connection_progress(user_id: str, platforms: list) -> Dict[str, Any]:
        """Get progress of bulk connection setup"""
        # This would normally query the database for connected accounts
        # For now, return a structure showing what to track
        return {
            'user_id': user_id,
            'total_platforms': len(platforms),
            'completed': 0,
            'in_progress': 0,
            'pending': len(platforms),
            'failed': 0,
            'platform_status': {platform: 'pending' for platform in platforms}
        }


class AutoReconnectionService:
    """Automatically handle token refreshes and reconnections"""

    @staticmethod
    def should_refresh_token(expires_at: datetime, refresh_buffer_hours: int = 2) -> bool:
        """Check if token should be refreshed proactively"""
        if not expires_at:
            return False

        buffer_time = datetime.now(timezone.utc) + timedelta(hours=refresh_buffer_hours)
        return expires_at <= buffer_time

    @staticmethod
    def auto_refresh_if_needed(platform: str, account_data: Dict[str, Any]) -> Dict[str, Any]:
        """Automatically refresh token if needed"""
        result = {
            'refreshed': False,
            'new_token': None,
            'expires_at': None,
            'error': None
        }

        try:
            expires_at = account_data.get('token_expires_at')
            refresh_token = account_data.get('refresh_token')

            if not expires_at or not refresh_token:
                return result

            if AutoReconnectionService.should_refresh_token(expires_at):
                new_token_data = refresh_access_token(platform, refresh_token)

                if new_token_data:
                    result['refreshed'] = True
                    result['new_token'] = new_token_data['access_token']
                    result['expires_at'] = new_token_data['expires_at']
                else:
                    result['error'] = 'Token refresh failed'
        except Exception as e:
            result['error'] = str(e)
            logger.error(f"Auto-refresh failed for {platform}: {e}")

        return result

    @staticmethod
    def schedule_token_refresh_check(account_id: str, platform: str, expires_at: datetime):
        """Schedule a token refresh check (would integrate with task queue)"""
        # This would normally schedule a background task
        # For now, return scheduling info
        check_time = expires_at - timedelta(hours=2)

        return {
            'account_id': account_id,
            'platform': platform,
            'check_scheduled_for': check_time.isoformat(),
            'message': 'Token refresh will be attempted automatically before expiration'
        }
