"""
Authentication and authorization utilities
"""
import os
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
from typing import Optional, Dict, Any, Callable
from cryptography.fernet import Fernet
import base64


# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'dev-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
REFRESH_TOKEN_EXPIRES = timedelta(days=30)

# Encryption for OAuth tokens
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', Fernet.generate_key().decode())
cipher_suite = Fernet(ENCRYPTION_KEY.encode() if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY)


def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))


def generate_api_key() -> str:
    """Generate a random API key"""
    return f"mb_{uuid.uuid4().hex}"


def encrypt_token(token: str) -> str:
    """Encrypt an OAuth token for secure storage"""
    if not token:
        return None
    return cipher_suite.encrypt(token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt an OAuth token"""
    if not encrypted_token:
        return None
    return cipher_suite.decrypt(encrypted_token.encode()).decode()


def create_access_token(user_id: str, role: str) -> str:
    """Create a JWT access token"""
    payload = {
        'user_id': user_id,
        'role': role,
        'type': 'access',
        'exp': datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRES,
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    """Create a JWT refresh token"""
    payload = {
        'user_id': user_id,
        'type': 'refresh',
        'exp': datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRES,
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate a JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_current_user(db_session) -> Optional[Dict[str, Any]]:
    """Get the current authenticated user from request"""
    auth_header = request.headers.get('Authorization', '')
    
    if not auth_header.startswith('Bearer '):
        return None
    
    token = auth_header.split(' ')[1]
    payload = decode_token(token)
    
    if not payload or payload.get('type') != 'access':
        return None
    
    from models import User
    user = db_session.query(User).filter_by(id=payload['user_id'], is_active=True).first()
    
    if not user:
        return None
    
    return {
        'id': user.id,
        'email': user.email,
        'role': user.role.value,
        'full_name': user.full_name
    }


def require_auth(db_session):
    """Decorator to require authentication"""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = get_current_user(db_session)
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            request.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def require_role(*allowed_roles):
    """Decorator to require specific roles"""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(db_session, *args, **kwargs):
            user = get_current_user(db_session)
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            
            if user['role'] not in allowed_roles:
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            request.current_user = user
            return f(db_session, *args, **kwargs)
        return decorated_function
    return decorator


def verify_api_key(db_session, api_key: str) -> Optional[Dict[str, Any]]:
    """Verify an API key and return associated user"""
    from models import User
    
    user = db_session.query(User).filter_by(api_key=api_key, is_active=True).first()
    
    if not user:
        return None
    
    return {
        'id': user.id,
        'email': user.email,
        'role': user.role.value,
        'full_name': user.full_name
    }


def require_api_key(db_session):
    """Decorator to require API key authentication"""
    def decorator(f: Callable) -> Callable:
        @wraps(f)
        def decorated_function(*args, **kwargs):
            api_key = request.headers.get('X-API-Key', '')
            
            if not api_key:
                return jsonify({'error': 'API key required'}), 401
            
            user = verify_api_key(db_session, api_key)
            if not user:
                return jsonify({'error': 'Invalid API key'}), 401
            
            request.current_user = user
            return f(*args, **kwargs)
        return decorated_function
    return decorator
