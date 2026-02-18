"""
Admin API endpoints for subscription and user management
"""
from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone, timedelta
import logging
from uuid import uuid4

from app_extensions import auth_required, DB_ENABLED
from subscription_control import admin_only, get_user_subscription
from subscription_config import TierLimits, SubscriptionHelper
from models import User, Subscription, SubscriptionTier, SubscriptionStatus, UsageMetrics, UserRole
from security_enhancements import SecurityLogger

logger = logging.getLogger(__name__)

# Create blueprint
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


# ==================== USER MANAGEMENT ====================

@admin_bp.route('/users', methods=['GET'])
@auth_required
@admin_only
def list_users():
    """List all users with subscription information"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            # Get all users with their subscriptions
            users = db_session.query(User).all()
            
            users_data = []
            for user in users:
                subscription = db_session.query(Subscription).filter_by(user_id=user.id).first()
                
                user_data = {
                    'id': user.id,
                    'email': user.email,
                    'full_name': user.full_name,
                    'role': user.role.value,
                    'is_active': user.is_active,
                    'auth_provider': user.auth_provider,
                    'created_at': user.created_at.isoformat() if user.created_at else None,
                    'last_login': user.last_login.isoformat() if user.last_login else None,
                    'subscription': None
                }
                
                if subscription:
                    user_data['subscription'] = {
                        'id': subscription.id,
                        'tier': subscription.tier.value,
                        'status': subscription.status.value,
                        'trial_ends_at': subscription.trial_ends_at.isoformat() if subscription.trial_ends_at else None,
                        'current_period_start': subscription.current_period_start.isoformat() if subscription.current_period_start else None,
                        'current_period_end': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
                        'payment_method': subscription.payment_method,
                        'last_payment_date': subscription.last_payment_date.isoformat() if subscription.last_payment_date else None,
                        'last_payment_amount': subscription.last_payment_amount,
                        'admin_notes': subscription.admin_notes
                    }
                
                users_data.append(user_data)
            
            return jsonify({
                'users': users_data,
                'total': len(users_data)
            }), 200
            
    except Exception as e:
        logger.error(f"Error listing users: {e}", exc_info=True)
        return jsonify({'error': 'Failed to list users'}), 500


@admin_bp.route('/users/<user_id>', methods=['GET'])
@auth_required
@admin_only
def get_user_details(user_id):
    """Get detailed information about a specific user"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            user = db_session.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            subscription = get_user_subscription(db_session, user_id)
            
            # Get current month usage
            now = datetime.now(timezone.utc)
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            usage = db_session.query(UsageMetrics).filter_by(
                subscription_id=subscription.id,
                period_start=period_start
            ).first()
            
            # Get tier limits
            tier_config = TierLimits.get_tier_config(subscription.tier)
            
            user_data = {
                'id': user.id,
                'email': user.email,
                'full_name': user.full_name,
                'role': user.role.value,
                'is_active': user.is_active,
                'auth_provider': user.auth_provider,
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'subscription': {
                    'id': subscription.id,
                    'tier': subscription.tier.value,
                    'tier_name': tier_config['name'],
                    'status': subscription.status.value,
                    'trial_ends_at': subscription.trial_ends_at.isoformat() if subscription.trial_ends_at else None,
                    'current_period_start': subscription.current_period_start.isoformat() if subscription.current_period_start else None,
                    'current_period_end': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
                    'payment_method': subscription.payment_method,
                    'last_payment_date': subscription.last_payment_date.isoformat() if subscription.last_payment_date else None,
                    'last_payment_amount': subscription.last_payment_amount,
                    'cancelled_at': subscription.cancelled_at.isoformat() if subscription.cancelled_at else None,
                    'cancellation_reason': subscription.cancellation_reason,
                    'admin_notes': subscription.admin_notes,
                    'limits': tier_config
                },
                'usage': None
            }
            
            if usage:
                user_data['usage'] = {
                    'period_start': usage.period_start.isoformat(),
                    'period_end': usage.period_end.isoformat(),
                    'posts_created': usage.posts_created,
                    'posts_scheduled': usage.posts_scheduled,
                    'posts_published': usage.posts_published,
                    'api_calls': usage.api_calls,
                    'storage_used_mb': usage.storage_used_mb,
                    'ai_requests': usage.ai_requests,
                    'analytics_views': usage.analytics_views,
                    'social_listening_queries': usage.social_listening_queries
                }
            
            return jsonify(user_data), 200
            
    except Exception as e:
        logger.error(f"Error getting user details: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get user details'}), 500


@admin_bp.route('/users/<user_id>/subscription', methods=['PATCH'])
@auth_required
@admin_only
def update_subscription(user_id):
    """Update user subscription (tier, status, dates)"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        
        data = request.get_json()
        
        with db_session_scope() as db_session:
            user = db_session.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            subscription = get_user_subscription(db_session, user_id)
            
            # Update tier if provided
            if 'tier' in data:
                try:
                    new_tier = SubscriptionTier(data['tier'])
                    subscription.tier = new_tier
                    logger.info(f"Admin {g.current_user['email']} changed user {user.email} tier to {new_tier.value}")
                except ValueError:
                    return jsonify({'error': f"Invalid tier: {data['tier']}"}), 400
            
            # Update status if provided
            if 'status' in data:
                try:
                    new_status = SubscriptionStatus(data['status'])
                    old_status = subscription.status
                    subscription.status = new_status
                    logger.info(f"Admin {g.current_user['email']} changed user {user.email} status from {old_status.value} to {new_status.value}")
                    
                    # Log security event for suspension
                    if new_status == SubscriptionStatus.SUSPENDED:
                        SecurityLogger.log_event(
                            'subscription_suspended',
                            g.current_user['id'],
                            {'target_user': user_id, 'admin': g.current_user['email']}
                        )
                except ValueError:
                    return jsonify({'error': f"Invalid status: {data['status']}"}), 400
            
            # Update period dates if provided
            if 'current_period_end' in data:
                try:
                    subscription.current_period_end = datetime.fromisoformat(data['current_period_end'].replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    return jsonify({'error': 'Invalid date format for current_period_end'}), 400
            
            if 'trial_ends_at' in data:
                try:
                    subscription.trial_ends_at = datetime.fromisoformat(data['trial_ends_at'].replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    return jsonify({'error': 'Invalid date format for trial_ends_at'}), 400
            
            # Update admin notes
            if 'admin_notes' in data:
                subscription.admin_notes = data['admin_notes']
            
            subscription.updated_at = datetime.now(timezone.utc)
            db_session.commit()
            
            return jsonify({
                'message': 'Subscription updated successfully',
                'subscription': {
                    'tier': subscription.tier.value,
                    'status': subscription.status.value,
                    'trial_ends_at': subscription.trial_ends_at.isoformat() if subscription.trial_ends_at else None,
                    'current_period_end': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
                    'admin_notes': subscription.admin_notes
                }
            }), 200
            
    except Exception as e:
        logger.error(f"Error updating subscription: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update subscription'}), 500


@admin_bp.route('/users/<user_id>/suspend', methods=['POST'])
@auth_required
@admin_only
def suspend_user(user_id):
    """Suspend a user's access"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        
        data = request.get_json() or {}
        reason = data.get('reason', 'No reason provided')
        
        with db_session_scope() as db_session:
            user = db_session.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Prevent suspending admins
            if user.role == UserRole.ADMIN:
                return jsonify({'error': 'Cannot suspend admin users'}), 403
            
            subscription = get_user_subscription(db_session, user_id)
            subscription.status = SubscriptionStatus.SUSPENDED
            subscription.admin_notes = f"Suspended: {reason}\n{subscription.admin_notes or ''}"
            subscription.updated_at = datetime.now(timezone.utc)
            
            user.is_active = False
            
            db_session.commit()
            
            logger.warning(f"Admin {g.current_user['email']} suspended user {user.email}. Reason: {reason}")
            SecurityLogger.log_event(
                'user_suspended',
                g.current_user['id'],
                {'target_user': user_id, 'reason': reason}
            )
            
            return jsonify({
                'message': 'User suspended successfully',
                'user_id': user_id,
                'status': subscription.status.value
            }), 200
            
    except Exception as e:
        logger.error(f"Error suspending user: {e}", exc_info=True)
        return jsonify({'error': 'Failed to suspend user'}), 500


@admin_bp.route('/users/<user_id>/activate', methods=['POST'])
@auth_required
@admin_only
def activate_user(user_id):
    """Activate or reactivate a user's access"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            user = db_session.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            subscription = get_user_subscription(db_session, user_id)
            
            # Reactivate subscription if suspended
            if subscription.status == SubscriptionStatus.SUSPENDED:
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.admin_notes = f"Reactivated by {g.current_user['email']}\n{subscription.admin_notes or ''}"
            elif subscription.status == SubscriptionStatus.EXPIRED:
                # Extend period by 30 days
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.current_period_start = datetime.now(timezone.utc)
                subscription.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)
            
            subscription.updated_at = datetime.now(timezone.utc)
            user.is_active = True
            
            db_session.commit()
            
            logger.info(f"Admin {g.current_user['email']} activated user {user.email}")
            SecurityLogger.log_event(
                'user_activated',
                g.current_user['id'],
                {'target_user': user_id}
            )
            
            return jsonify({
                'message': 'User activated successfully',
                'user_id': user_id,
                'status': subscription.status.value
            }), 200
            
    except Exception as e:
        logger.error(f"Error activating user: {e}", exc_info=True)
        return jsonify({'error': 'Failed to activate user'}), 500


# ==================== SYSTEM METRICS ====================

@admin_bp.route('/metrics', methods=['GET'])
@auth_required
@admin_only
def get_system_metrics():
    """Get system-wide metrics and statistics"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from sqlalchemy import func
        
        with db_session_scope() as db_session:
            # User statistics
            total_users = db_session.query(func.count(User.id)).scalar()
            active_users = db_session.query(func.count(User.id)).filter_by(is_active=True).scalar()
            
            # Subscription statistics by tier
            tier_counts = {}
            for tier in SubscriptionTier:
                count = db_session.query(func.count(Subscription.id)).filter_by(tier=tier).scalar()
                tier_counts[tier.value] = count
            
            # Subscription status counts
            status_counts = {}
            for status in SubscriptionStatus:
                count = db_session.query(func.count(Subscription.id)).filter_by(status=status).scalar()
                status_counts[status.value] = count
            
            # Get current month's aggregated usage
            now = datetime.now(timezone.utc)
            period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            
            usage_stats = db_session.query(
                func.sum(UsageMetrics.posts_created).label('total_posts'),
                func.sum(UsageMetrics.api_calls).label('total_api_calls'),
                func.sum(UsageMetrics.storage_used_mb).label('total_storage'),
                func.sum(UsageMetrics.ai_requests).label('total_ai_requests')
            ).filter(UsageMetrics.period_start == period_start).first()
            
            return jsonify({
                'users': {
                    'total': total_users,
                    'active': active_users,
                    'inactive': total_users - active_users
                },
                'subscriptions': {
                    'by_tier': tier_counts,
                    'by_status': status_counts
                },
                'usage_this_month': {
                    'posts_created': usage_stats.total_posts or 0,
                    'api_calls': usage_stats.total_api_calls or 0,
                    'storage_used_mb': usage_stats.total_storage or 0.0,
                    'ai_requests': usage_stats.total_ai_requests or 0
                },
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting system metrics: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get system metrics'}), 500


# ==================== SUBSCRIPTION CONFIGURATION ====================

@admin_bp.route('/subscription-tiers', methods=['GET'])
@auth_required
@admin_only
def get_subscription_tiers():
    """Get configuration for all subscription tiers"""
    try:
        tiers_data = {}
        for tier in SubscriptionTier:
            config = TierLimits.get_tier_config(tier)
            tiers_data[tier.value] = config
        
        return jsonify({'tiers': tiers_data}), 200
        
    except Exception as e:
        logger.error(f"Error getting subscription tiers: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get subscription tiers'}), 500
