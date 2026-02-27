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
import requests as _siem_requests
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
        """Set CORS headers with security logging"""
        origin = request.headers.get('Origin')
        is_production = os.getenv('FLASK_ENV') == 'production' or os.getenv('ENVIRONMENT') == 'production'

        if is_production:
            # Production: Strict whitelist only
            if origin in cls.ALLOWED_ORIGINS:
                response.headers['Access-Control-Allow-Origin'] = origin
                response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
                response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key'
                response.headers['Access-Control-Max-Age'] = '3600'
                response.headers['Access-Control-Allow-Credentials'] = 'true'
            else:
                # Log rejected CORS request
                logger.warning(f"CORS request rejected from origin: {origin}")
                SecurityLogger.log_event('cors_rejected', details={'origin': origin})
        else:
            # Development: Permissive but logged
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
    def validate_url(url: str, https_only: bool = False) -> bool:
        """Validate URL format and scheme, blocking SSRF targets.

        Uses urllib.parse for robust parsing so that encoded, IPv6, and
        octal IP representations are all normalised before the check.

        Args:
            url: The URL to validate.
            https_only: If True, reject plain http:// URLs.
        """
        from urllib.parse import urlparse
        import ipaddress

        if https_only:
            if not url.startswith('https://'):
                return False
        elif not url.startswith(('http://', 'https://')):
            return False

        try:
            parsed = urlparse(url)
        except Exception:
            return False

        hostname = parsed.hostname or ''

        # Try to parse as an IP address (handles IPv6, dotted-decimal, etc.)
        try:
            addr = ipaddress.ip_address(hostname)
            # Reject private, loopback, link-local, and reserved ranges
            if (addr.is_private or addr.is_loopback or
                    addr.is_link_local or addr.is_reserved or
                    addr.is_multicast or addr.is_unspecified):
                return False
        except ValueError:
            # Not a bare IP – apply hostname-level string checks
            _blocked_patterns = [
                'localhost', 'metadata.google.internal', '169.254.', 'metadata.google',
                '10.', '192.168.', '172.16.', '172.17.', '172.18.',
                '172.19.', '172.20.', '172.21.', '172.22.', '172.23.',
                '172.24.', '172.25.', '172.26.', '172.27.', '172.28.',
                '172.29.', '172.30.', '172.31.',
            ]
            if any(p in hostname.lower() for p in _blocked_patterns):
                return False

        return True


class SecurityHeaders:
    """Security headers middleware"""
    
    @staticmethod
    def add_security_headers(response):
        """Add comprehensive security headers to response"""
        # Strict Transport Security (HSTS) - Force HTTPS for 1 year
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        
        # Content Security Policy - Prevent XSS
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "img-src 'self' data: https: blob:; "
            "font-src 'self' data: https://fonts.gstatic.com; "
            "connect-src 'self' https://accounts.google.com https://generativelanguage.googleapis.com; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        
        # Prevent MIME type sniffing
        response.headers['X-Content-Type-Options'] = 'nosniff'
        
        # Prevent clickjacking
        response.headers['X-Frame-Options'] = 'DENY'
        
        # XSS Protection (legacy browsers)
        response.headers['X-XSS-Protection'] = '1; mode=block'
        
        # Referrer Policy - Don't leak referrers
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        
        # Permissions Policy - Disable unnecessary features
        response.headers['Permissions-Policy'] = (
            'geolocation=(), microphone=(), camera=(), payment=()'
        )
        
        return response
    
    @staticmethod
    def set_security_headers(response):
        """Alias for add_security_headers for backward compatibility"""
        return SecurityHeaders.add_security_headers(response)


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

        # In production, forward to a SIEM endpoint if configured via SIEM_ENDPOINT env var
        if os.getenv('FLASK_ENV') == 'production':
            siem_endpoint = os.getenv('SIEM_ENDPOINT')
            if siem_endpoint:
                try:
                    _siem_requests.post(siem_endpoint, json=log_data, timeout=2)
                except Exception:
                    pass  # Never let SIEM forwarding break the request

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
    def log_unauthorized_access(user_id: str, resource: str):
        """Log unauthorized access attempt"""
        SecurityLogger.log_event('unauthorized_access', user_id=user_id, details={'resource': resource})
    
    @staticmethod
    def log_suspicious_activity(user_id: str, activity: str):
        """Log suspicious activity"""
        SecurityLogger.log_event('suspicious_activity', user_id=user_id, details={'activity': activity})
    
    @staticmethod
    def log_oauth_success(user_id: str, platform: str):
        """Log successful OAuth connection"""
        SecurityLogger.log_event('oauth_success', user_id=user_id, details={'platform': platform})
    
    @staticmethod
    def log_oauth_failure(user_id: str, platform: str, error: str):
        """Log failed OAuth attempt"""
        SecurityLogger.log_event('oauth_failure', user_id=user_id, details={'platform': platform, 'error': error})


# Export all security classes for easy import
__all__ = [
    'PasswordPolicy',
    'AccountSecurity',
    'RateLimiter',
    'HTTPSEnforcer',
    'CORSConfig',
    'WebhookSecurity',
    'InputSanitizer',
    'SecurityHeaders',
    'SecurityLogger',
    'RefreshTokenRotation',
    'init_security_middleware'
]


class RefreshTokenRotation:
    """Refresh token rotation for enhanced security.

    Stores (hash -> expiry) so the set is automatically pruned on each
    operation, preventing unbounded memory growth.  The TTL mirrors the
    refresh token lifetime (30 days).
    """

    _TTL = timedelta(days=30)
    # Maps sha256(token) -> expiry datetime
    _used: Dict[str, datetime] = {}

    @classmethod
    def _prune(cls):
        """Remove expired entries to bound memory use."""
        now = datetime.now(timezone.utc)
        expired = [h for h, exp in cls._used.items() if now >= exp]
        for h in expired:
            del cls._used[h]

    @classmethod
    def mark_token_used(cls, token: str):
        """Mark refresh token as used."""
        cls._prune()
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        cls._used[token_hash] = datetime.now(timezone.utc) + cls._TTL

    @classmethod
    def is_token_used(cls, token: str) -> bool:
        """Check if token has been used and has not yet expired."""
        cls._prune()
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        return token_hash in cls._used


def prune_security_state() -> None:
    """Prune expired entries from in-memory security state.

    Call this from a periodic background job (e.g. every 5 minutes) to prevent
    unbounded growth of the login_attempts and account_lockouts dicts across
    the lifetime of the process.
    """
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)

    # Prune login_attempts: remove emails with no recent failures
    stale_emails = [
        email for email, attempts in login_attempts.items()
        if not any(t > cutoff for t in attempts)
    ]
    for email in stale_emails:
        del login_attempts[email]

    # Prune account_lockouts: remove expired lockouts
    expired_lockouts = [email for email, exp in account_lockouts.items() if now >= exp]
    for email in expired_lockouts:
        del account_lockouts[email]

    # Prune api_rate_limits: remove users with no recent requests
    rate_cutoff = now - timedelta(seconds=RATE_LIMIT_WINDOW)
    stale_users = [
        uid for uid, times in api_rate_limits.items()
        if not any(t > rate_cutoff for t in times)
    ]
    for uid in stale_users:
        del api_rate_limits[uid]

    logger.debug(
        "Security state pruned: removed %d stale login entries, "
        "%d expired lockouts, %d stale rate-limit entries",
        len(stale_emails), len(expired_lockouts), len(stale_users)
    )


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
