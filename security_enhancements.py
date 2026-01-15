"""
Security enhancements for MastaBlasta
Implements all recommendations from the security audit
"""
import os
import time
import hashlib
import hmac
import re
import logging
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify
from typing import Dict, Any, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)

# Security Configuration
MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION = timedelta(minutes=15)
API_RATE_LIMIT = 100  # requests per minute
RATE_LIMIT_WINDOW = 60  # seconds
WEBHOOK_REPLAY_WINDOW = 300  # 5 minutes
MAX_WEBHOOK_FAILURES = 5

# In-memory storage for rate limiting and lockouts (use Redis in production)
login_attempts = defaultdict(list)
account_lockouts = {}
api_rate_limits = defaultdict(list)
webhook_failures = defaultdict(int)


class PasswordPolicy:
    """Password complexity enforcement"""

    MIN_LENGTH = 8
    MIN_UPPERCASE = 1
    MIN_LOWERCASE = 1
    MIN_DIGITS = 1
    MIN_SPECIAL = 1

    @classmethod
    def validate(cls, password: str) -> tuple[bool, str]:
        """Validate password against policy"""
        if len(password) < cls.MIN_LENGTH:
            return False, f"Password must be at least {cls.MIN_LENGTH} characters"

        if sum(1 for c in password if c.isupper()) < cls.MIN_UPPERCASE:
            return False, f"Password must contain at least {cls.MIN_UPPERCASE} uppercase letter"

        if sum(1 for c in password if c.islower()) < cls.MIN_LOWERCASE:
            return False, f"Password must contain at least {cls.MIN_LOWERCASE} lowercase letter"

        if sum(1 for c in password if c.isdigit()) < cls.MIN_DIGITS:
            return False, f"Password must contain at least {cls.MIN_DIGITS} digit"

        special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
        if sum(1 for c in password if c in special_chars) < cls.MIN_SPECIAL:
            return False, f"Password must contain at least {cls.MIN_SPECIAL} special character"

        return True, "Password meets all requirements"


class AccountSecurity:
    """Account security features"""

    @staticmethod
    def record_login_attempt(email: str, success: bool):
        """Record login attempt"""
        now = datetime.now(timezone.utc)

        if not success:
            # Record failed attempt
            login_attempts[email].append(now)

            # Clean old attempts (older than 1 hour)
            login_attempts[email] = [
                t for t in login_attempts[email]
                if now - t < timedelta(hours=1)
            ]

            # Check for lockout
            recent_failures = [
                t for t in login_attempts[email]
                if now - t < timedelta(minutes=15)
            ]

            if len(recent_failures) >= MAX_LOGIN_ATTEMPTS:
                account_lockouts[email] = now + LOCKOUT_DURATION
                logger.warning(f"Account locked due to failed login attempts: {email}")
                return True  # Account locked
        else:
            # Clear failed attempts on successful login
            if email in login_attempts:
                del login_attempts[email]
            if email in account_lockouts:
                del account_lockouts[email]

        return False

    @staticmethod
    def is_account_locked(email: str) -> bool:
        """Check if account is locked"""
        if email in account_lockouts:
            if datetime.now(timezone.utc) < account_lockouts[email]:
                return True
            else:
                # Lockout expired, remove it
                del account_lockouts[email]
        return False

    @staticmethod
    def get_lockout_remaining(email: str) -> Optional[int]:
        """Get remaining lockout time in seconds"""
        if email in account_lockouts:
            remaining = (account_lockouts[email] - datetime.now(timezone.utc)).total_seconds()
            return max(0, int(remaining))
        return None


class RateLimiter:
    """API rate limiting"""

    @staticmethod
    def check_rate_limit(user_id: str) -> tuple[bool, Optional[int]]:
        """Check if user has exceeded rate limit"""
        now = time.time()

        # Clean old requests
        api_rate_limits[user_id] = [
            t for t in api_rate_limits[user_id]
            if now - t < RATE_LIMIT_WINDOW
        ]

        # Check limit
        if len(api_rate_limits[user_id]) >= API_RATE_LIMIT:
            # Calculate retry-after
            oldest_request = min(api_rate_limits[user_id])
            retry_after = int(RATE_LIMIT_WINDOW - (now - oldest_request))
            return False, retry_after

        # Record request
        api_rate_limits[user_id].append(now)
        return True, None


def rate_limit_middleware():
    """Decorator for rate limiting"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user = getattr(request, 'current_user', None)
            if user:
                allowed, retry_after = RateLimiter.check_rate_limit(user['id'])
                if not allowed:
                    return jsonify({
                        'error': 'Rate limit exceeded',
                        'retry_after': retry_after
                    }), 429
            return f(*args, **kwargs)
        return decorated_function
    return decorator


class HTTPSEnforcer:
    """HTTPS enforcement middleware"""

    @staticmethod
    def enforce_https():
        """Redirect HTTP to HTTPS in production"""
        if os.getenv('FLASK_ENV') == 'production':
            if not request.is_secure:
                url = request.url.replace('http://', 'https://', 1)
                return jsonify({'error': 'HTTPS required', 'redirect': url}), 301
        return None


class CORSConfig:
    """CORS configuration"""

    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000,http://localhost:5173').split(',')

    @classmethod
    def set_cors_headers(cls, response):
        """Set CORS headers"""
        origin = request.headers.get('Origin')

        if origin in cls.ALLOWED_ORIGINS or os.getenv('FLASK_ENV') == 'development':
            response.headers['Access-Control-Allow-Origin'] = origin or '*'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key'
            response.headers['Access-Control-Max-Age'] = '3600'
            response.headers['Access-Control-Allow-Credentials'] = 'true'

        return response


class WebhookSecurity:
    """Webhook security features"""

    @staticmethod
    def generate_signature(payload: bytes, secret: str) -> str:
        """Generate HMAC-SHA256 signature for webhook"""
        return hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

    @staticmethod
    def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
        """Verify webhook signature"""
        expected = WebhookSecurity.generate_signature(payload, secret)
        return hmac.compare_digest(signature, expected)

    @staticmethod
    def verify_timestamp(timestamp: int) -> bool:
        """Verify webhook timestamp (prevent replay attacks)"""
        now = int(time.time())
        return abs(now - timestamp) <= WEBHOOK_REPLAY_WINDOW

    @staticmethod
    def record_failure(webhook_id: str):
        """Record webhook failure"""
        webhook_failures[webhook_id] += 1

        if webhook_failures[webhook_id] >= MAX_WEBHOOK_FAILURES:
            logger.warning(f"Webhook {webhook_id} disabled due to {MAX_WEBHOOK_FAILURES} consecutive failures")
            return True  # Should disable webhook

        return False

    @staticmethod
    def reset_failures(webhook_id: str):
        """Reset failure count on success"""
        if webhook_id in webhook_failures:
            del webhook_failures[webhook_id]


class InputSanitizer:
    """Input validation and sanitization"""

    EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

    @staticmethod
    def validate_email(email: str) -> bool:
        """Validate email format"""
        return bool(InputSanitizer.EMAIL_REGEX.match(email))

    @staticmethod
    def sanitize_filename(filename: str) -> str:
        """Sanitize filename to prevent path traversal"""
        # Remove any path components
        filename = os.path.basename(filename)

        # Remove dangerous characters
        filename = re.sub(r'[^\w\s.-]', '', filename)

        # Limit length
        name, ext = os.path.splitext(filename)
        if len(name) > 200:
            name = name[:200]

        return f"{name}{ext}"

    @staticmethod
    def validate_url(url: str) -> bool:
        """Validate URL format and scheme"""
        if not url.startswith(('http://', 'https://')):
            return False

        # Prevent SSRF to private IPs
        blocked_patterns = [
            'localhost',
            '127.0.0.1',
            '0.0.0.0',
            '169.254.169.254',  # AWS metadata
            '10.',
            '192.168.',
            '172.16.',
        ]

        return not any(pattern in url.lower() for pattern in blocked_patterns)


class SecurityLogger:
    """Security event logging"""

    @staticmethod
    def log_event(event_type: str, user_id: str = None, details: Dict[str, Any] = None):
        """Log security event"""
        log_data = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'event_type': event_type,
            'user_id': user_id,
            'ip_address': request.remote_addr if request else None,
            'user_agent': request.headers.get('User-Agent') if request else None,
            'details': details or {}
        }

        # Log to file/service
        logger.info(f"SECURITY_EVENT: {log_data}")

        # In production, send to SIEM system
        if os.getenv('FLASK_ENV') == 'production':
            # TODO: Send to centralized logging service
            pass

    @staticmethod
    def log_failed_login(email: str):
        """Log failed login attempt"""
        SecurityLogger.log_event('failed_login', details={'email': email[:3] + '***'})

    @staticmethod
    def log_account_lockout(email: str):
        """Log account lockout"""
        SecurityLogger.log_event('account_lockout', details={'email': email[:3] + '***'})

    @staticmethod
    def log_password_change(user_id: str):
        """Log password change"""
        SecurityLogger.log_event('password_change', user_id=user_id)

    @staticmethod
    def log_api_key_generated(user_id: str):
        """Log API key generation"""
        SecurityLogger.log_event('api_key_generated', user_id=user_id)

    @staticmethod
    def log_oauth_token_refresh(user_id: str, platform: str):
        """Log OAuth token refresh"""
        SecurityLogger.log_event('oauth_token_refresh', user_id=user_id, details={'platform': platform})

    @staticmethod
    def log_unauthorized_access(user_id: str = None, endpoint: str = None):
        """Log unauthorized access attempt"""
        SecurityLogger.log_event('unauthorized_access', user_id=user_id, details={'endpoint': endpoint})


class RefreshTokenRotation:
    """Refresh token rotation for enhanced security"""

    # In production, use Redis with TTL
    used_refresh_tokens = set()

    @classmethod
    def mark_token_used(cls, token: str):
        """Mark refresh token as used"""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        cls.used_refresh_tokens.add(token_hash)

    @classmethod
    def is_token_used(cls, token: str) -> bool:
        """Check if token has been used"""
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return token_hash in cls.used_refresh_tokens


class SecurityHeaders:
    """Security headers middleware"""

    @staticmethod
    def set_security_headers(response):
        """Set security headers on response"""
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'SAMEORIGIN'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

        return response


def init_security_middleware(app):
    """Initialize all security middleware"""

    @app.before_request
    def before_request():
        """Security checks before each request"""
        # HTTPS enforcement
        https_response = HTTPSEnforcer.enforce_https()
        if https_response:
            return https_response

        # Rate limiting (if user authenticated)
        if hasattr(request, 'current_user'):
            allowed, retry_after = RateLimiter.check_rate_limit(request.current_user['id'])
            if not allowed:
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': retry_after
                }), 429

    @app.after_request
    def after_request(response):
        """Add security headers to response"""
        response = SecurityHeaders.set_security_headers(response)
        response = CORSConfig.set_cors_headers(response)
        return response


# Export all security classes and functions
__all__ = [
    'PasswordPolicy',
    'AccountSecurity',
    'RateLimiter',
    'HTTPSEnforcer',
    'CORSConfig',
    'WebhookSecurity',
    'InputSanitizer',
    'SecurityLogger',
    'RefreshTokenRotation',
    'SecurityHeaders',
    'init_security_middleware',
    'rate_limit_middleware',
]
