"""
Authentication and authorization utilities
"""
import os
import secrets
import sys
import uuid
import bcrypt
import jwt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
from typing import Optional, Dict, Any, Callable
from cryptography.fernet import Fernet
import logging

logger = logging.getLogger(__name__)

# Security: Validate critical environment variables
def _validate_production_secrets():
    """Validate that production secrets are properly configured"""
    is_production = os.getenv('FLASK_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production'
    
    jwt_key = os.getenv('JWT_SECRET_KEY')
    encryption_key = os.getenv('ENCRYPTION_KEY')
    
    # Check for insecure defaults
    insecure_defaults = [
        'dev-secret-key-change-in-production',
        'change-me',
        'secret',
        'password',
        'default'
    ]
    
    if is_production:
        # CRITICAL: In production, secrets MUST be set and secure
        if not jwt_key or jwt_key in insecure_defaults or len(jwt_key) < 32:
            logger.critical("🔴 SECURITY ERROR: JWT_SECRET_KEY not properly configured for production!")
            logger.critical("   Set a secure random key: export JWT_SECRET_KEY=\"$(openssl rand -hex 32)\"")
            sys.exit(1)
            
        if not encryption_key or encryption_key in insecure_defaults or len(encryption_key) < 32:
            logger.critical("🔴 SECURITY ERROR: ENCRYPTION_KEY not properly configured for production!")
            logger.critical("   Set a secure random key: export ENCRYPTION_KEY=\"$(openssl rand -hex 32)\"")
            sys.exit(1)
            
        logger.info("✅ Production secrets validated successfully")
    else:
        # Development: Warn if using insecure defaults
        if not jwt_key or jwt_key in insecure_defaults:
            logger.warning("⚠️  WARNING: Using default JWT_SECRET_KEY in development")
            logger.warning("   For production, set: export JWT_SECRET_KEY=\"$(openssl rand -hex 32)\"")
            
        if not encryption_key or encryption_key in insecure_defaults:
            logger.warning("⚠️  WARNING: Using default ENCRYPTION_KEY in development")
            logger.warning("   For production, set: export ENCRYPTION_KEY=\"$(openssl rand -hex 32)\"")

# Validate secrets on import (fail fast)
_validate_production_secrets()

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


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode a JWT token (alias for decode_token for backward compatibility)"""
    return decode_token(token)


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


def create_default_admin(db_session):
    """
    Create default admin account for initial deployment.
    Email: admin@mastablasta.com
    Password: ChangeMe123!
    Must be changed on first login.
    """
    from models import User, UserRole
    
    try:
        # Check if admin already exists
        admin = db_session.query(User).filter_by(email='admin@mastablasta.com').first()
        if admin:
            logger.info("Default admin account already exists")
            return
        
        # Create default admin with a randomly generated password
        admin_id = str(uuid.uuid4())
        default_password = secrets.token_urlsafe(16)  # 128-bit random password
        
        admin = User(
            id=admin_id,
            email='admin@mastablasta.com',
            password_hash=hash_password(default_password),
            full_name='System Administrator',
            role=UserRole.ADMIN,
            is_active=True,
            password_must_change=True  # Force password change on first login
        )
        
        db_session.add(admin)
        db_session.commit()
        
        logger.warning("=" * 70)
        logger.warning("🔐 DEFAULT ADMIN ACCOUNT CREATED")
        logger.warning("=" * 70)
        logger.warning("   Email: admin@mastablasta.com")
        logger.warning(f"   Password: {default_password}")
        logger.warning("")
        logger.warning("⚠️  IMPORTANT: This password MUST be changed on first login!")
        logger.warning("⚠️  This message is shown ONCE. Store the password securely.")
        logger.warning("=" * 70)
        
    except Exception as e:
        logger.error(f"Error creating default admin: {e}")
        db_session.rollback()
