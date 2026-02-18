"""
Subscription-based access control decorators and middleware
"""
from functools import wraps
from flask import g, jsonify
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from models import Subscription, SubscriptionStatus, SubscriptionTier, UsageMetrics, User
from subscription_config import TierLimits, SubscriptionHelper
import logging

logger = logging.getLogger(__name__)


def get_user_subscription(db_session: Session, user_id: str) -> Subscription:
    """
    Get subscription for a user.
    
    NOTE: With Square integration, subscriptions are NOT auto-created.
    Users must complete Square checkout to get a subscription.
    Returns None if no subscription exists (user must subscribe).
    """
    subscription = db_session.query(Subscription).filter_by(user_id=user_id).first()
    
    # NO auto-creation - users must pay via Square
    if not subscription:
        logger.warning(f"No subscription found for user {user_id} - payment required")
        return None
    
    return subscription


def check_subscription_active(subscription: Subscription) -> tuple[bool, str]:
    """
    Check if subscription is active and not expired
    
    Returns:
        tuple: (is_active: bool, message: str)
    """
    # Check if suspended by admin
    if subscription.status == SubscriptionStatus.SUSPENDED:
        return False, "Your account has been suspended. Please contact support."
    
    # Check if cancelled
    if subscription.status == SubscriptionStatus.CANCELLED:
        return False, "Your subscription has been cancelled. Please reactivate to continue."
    
    # Check if expired
    if subscription.status == SubscriptionStatus.EXPIRED:
        grace_end = subscription.current_period_end + timedelta(days=SubscriptionHelper.get_grace_period_days())
        if datetime.now(timezone.utc) <= grace_end:
            return True, "Your subscription has expired. You are in the grace period. Please renew."
        return False, "Your subscription has expired. Please renew to continue."
    
    # Check trial expiration
    if subscription.status == SubscriptionStatus.TRIAL:
        if subscription.trial_ends_at and datetime.now(timezone.utc) > subscription.trial_ends_at:
            return False, "Your trial period has ended. Please upgrade to continue."
    
    # Check active subscription expiration
    if subscription.status == SubscriptionStatus.ACTIVE:
        if subscription.current_period_end and datetime.now(timezone.utc) > subscription.current_period_end:
            # Grace period
            grace_end = subscription.current_period_end + timedelta(days=SubscriptionHelper.get_grace_period_days())
            if datetime.now(timezone.utc) <= grace_end:
                return True, "Your subscription needs renewal. You are in the grace period."
            return False, "Your subscription has expired. Please renew to continue."
    
    return True, ""


def require_subscription(feature_name: str = None):
    """
    Decorator to require an active subscription
    
    Args:
        feature_name: Optional feature name to check if tier has access
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get current user (should be set by @require_auth)
            if not hasattr(g, 'current_user') or not g.current_user:
                return jsonify({'error': 'Authentication required'}), 401
            
            user_id = g.current_user['id']
            
            # Get database session from kwargs or app context
            db_session = kwargs.get('db_session')
            if not db_session:
                from database import get_session
                db_session = get_session()
            
            try:
                # Get or create subscription
                subscription = get_user_subscription(db_session, user_id)
                
                # Handle case where subscription is None
                if subscription is None:
                    logger.warning(f"No subscription found for user {user_id}")
                    return jsonify({
                        'error': 'Subscription required',
                        'message': 'No active subscription found. Please subscribe to continue.',
                        'subscription_status': 'none'
                    }), 403
                
                # Check if subscription is active
                is_active, message = check_subscription_active(subscription)
                if not is_active:
                    logger.warning(f"Subscription check failed for user {user_id}: {message}")
                    return jsonify({
                        'error': 'Subscription required',
                        'message': message,
                        'subscription_status': subscription.status.value,
                        'tier': subscription.tier.value
                    }), 403
                
                # Check if tier has access to feature
                if feature_name:
                    if not TierLimits.has_feature(subscription.tier, feature_name):
                        return jsonify({
                            'error': 'Feature not available',
                            'message': f'Your {subscription.tier.value} plan does not include {feature_name}. Please upgrade.',
                            'tier': subscription.tier.value,
                            'feature': feature_name
                        }), 403
                
                # Add subscription to g for use in function
                g.subscription = subscription
                
                return f(*args, **kwargs)
                
            except Exception as e:
                logger.error(f"Error checking subscription for user {user_id}: {e}", exc_info=True)
                return jsonify({'error': 'Subscription check failed'}), 500
        
        return decorated_function
    return decorator


def check_usage_limit(limit_name: str, increment: int = 1):
    """
    Decorator to check and enforce usage limits
    
    Args:
        limit_name: Name of the limit to check (e.g., 'posts_per_month')
        increment: Amount to increment usage by if within limit
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get current user and subscription
            if not hasattr(g, 'subscription'):
                return jsonify({'error': 'Subscription check required first'}), 500
            
            subscription = g.subscription
            db_session = kwargs.get('db_session')
            
            if not db_session:
                from database import get_session
                db_session = get_session()
            
            try:
                # Get or create current period usage metrics
                now = datetime.now(timezone.utc)
                period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                period_end = (period_start + timedelta(days=32)).replace(day=1) - timedelta(seconds=1)
                
                usage = db_session.query(UsageMetrics).filter_by(
                    subscription_id=subscription.id,
                    period_start=period_start
                ).first()
                
                if not usage:
                    from uuid import uuid4
                    usage = UsageMetrics(
                        id=str(uuid4()),
                        subscription_id=subscription.id,
                        period_start=period_start,
                        period_end=period_end
                    )
                    db_session.add(usage)
                    db_session.commit()
                
                # Map limit_name to usage metric field
                usage_field_map = {
                    'posts_per_month': 'posts_created',
                    'scheduled_posts_limit': 'posts_scheduled',
                    'api_calls_per_day': 'api_calls',
                    'ai_requests': 'ai_requests',
                }
                
                usage_field = usage_field_map.get(limit_name)
                if not usage_field:
                    logger.warning(f"Unknown limit name: {limit_name}")
                    return f(*args, **kwargs)  # Continue if unknown limit
                
                # Get current usage
                current_usage = getattr(usage, usage_field, 0)
                
                # Check limit
                within_limit, remaining = TierLimits.check_limit(
                    subscription.tier,
                    limit_name,
                    current_usage
                )
                
                if not within_limit:
                    tier_name = SubscriptionHelper.get_tier_display_name(subscription.tier)
                    limit_value = TierLimits.get_limit(subscription.tier, limit_name)
                    
                    return jsonify({
                        'error': 'Usage limit exceeded',
                        'message': f'You have reached your {limit_name.replace("_", " ")} limit of {limit_value} for the {tier_name} plan.',
                        'tier': subscription.tier.value,
                        'limit': limit_value,
                        'current_usage': current_usage,
                        'upgrade_url': '/settings?tab=subscription'
                    }), 429  # Too Many Requests
                
                # Increment usage
                setattr(usage, usage_field, current_usage + increment)
                db_session.commit()
                
                # Add usage info to g
                g.usage = usage
                g.remaining = remaining
                
                return f(*args, **kwargs)
                
            except Exception as e:
                logger.error(f"Error checking usage limit {limit_name}: {e}", exc_info=True)
                return jsonify({'error': 'Usage check failed'}), 500
        
        return decorated_function
    return decorator


def admin_only(f):
    """Decorator to require ADMIN role - can be used with @require_subscription"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not hasattr(g, 'current_user') or not g.current_user:
            return jsonify({'error': 'Authentication required'}), 401
        
        from models import UserRole
        if g.current_user.get('role') != UserRole.ADMIN.value:
            logger.warning(f"Admin access denied for user {g.current_user['id']}")
            return jsonify({'error': 'Admin access required'}), 403
        
        return f(*args, **kwargs)
    
    return decorated_function
