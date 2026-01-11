"""
Real OAuth implementation for social media platforms
"""
import os
import requests
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import secrets
import tweepy
from requests_oauthlib import OAuth2Session
import logging

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
                'expires_at': datetime.utcnow() + timedelta(seconds=token_data['expires_in'])
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
                'expires_at': datetime.utcnow() + timedelta(seconds=long_lived_data.get('expires_in', 5184000))  # ~60 days
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
    def post_instagram_media(cls, access_token: str, instagram_account_id: str, image_url: str, caption: str) -> Optional[Dict[str, Any]]:
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
                'expires_at': datetime.utcnow() + timedelta(seconds=token_data['expires_in'])
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
                'expires_at': datetime.utcnow() + timedelta(seconds=token_data['expires_in'])
            }
        except Exception as e:
            logger.error(f"Google token exchange failed: {e}")
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
            'expires_at': datetime.utcnow() + timedelta(seconds=token_data['expires_in'])
        }
    except Exception as e:
        logger.error(f"Token refresh failed for {platform}: {e}")
        return None
