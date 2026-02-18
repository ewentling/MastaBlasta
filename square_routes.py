"""
Square subscription routes for user checkout and admin management
"""
from flask import Blueprint, request, jsonify, g
import logging

from app_extensions import auth_required, DB_ENABLED
from subscription_control import admin_only
from models import User, Subscription, SubscriptionTier
from square_integration import SquareSubscriptionManager
from security_enhancements import SecurityLogger

logger = logging.getLogger(__name__)

# Create blueprint
square_bp = Blueprint('square', __name__, url_prefix='/api/square')


@square_bp.route('/create-checkout', methods=['POST'])
@auth_required
def create_checkout():
    """
    Create Square checkout session for subscription payment
    
    Request body:
    {
        "tier": "starter" | "pro" | "enterprise"
    }
    
    Returns:
    {
        "checkout_url": "https://checkout.square.site/...",
        "tier": "starter",
        "price": 29
    }
    """
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        data = request.json or {}
        tier_str = data.get('tier', '').lower()
        
        # Validate tier
        tier_mapping = {
            'starter': SubscriptionTier.STARTER,
            'pro': SubscriptionTier.PRO,
            'enterprise': SubscriptionTier.ENTERPRISE
        }
        
        tier = tier_mapping.get(tier_str)
        if not tier:
            return jsonify({'error': f'Invalid tier: {tier_str}. Must be starter, pro, or enterprise'}), 400
        
        user_id = g.current_user['id']
        
        from database import db_session_scope
        with db_session_scope() as db_session:
            user = db_session.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Check if user already has an active subscription
            existing_sub = db_session.query(Subscription).filter_by(user_id=user_id).first()
            if existing_sub and existing_sub.status.value in ['active', 'trial']:
                return jsonify({
                    'error': 'You already have an active subscription',
                    'current_tier': existing_sub.tier.value,
                    'status': existing_sub.status.value
                }), 400
            
            # Create checkout session
            checkout_data = SquareSubscriptionManager.create_checkout_session(
                user, tier, db_session
            )
            
            # Store customer_id for webhook matching
            if existing_sub:
                existing_sub.square_customer_id = checkout_data['customer_id']
                db_session.commit()
            
            SecurityLogger.log_event('checkout_created', user_id, 
                                    f"Created checkout for tier: {tier.value}")
            
            return jsonify(checkout_data), 200
            
    except ValueError as e:
        logger.error(f"Validation error creating checkout: {e}")
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        logger.error(f"Error creating checkout: {e}", exc_info=True)
        return jsonify({'error': 'Failed to create checkout session'}), 500


@square_bp.route('/subscription-status', methods=['GET'])
@auth_required
def get_subscription_status():
    """
    Get current user's subscription status
    
    Returns:
    {
        "has_subscription": true,
        "tier": "starter",
        "status": "active",
        "current_period_end": "2024-02-15T00:00:00Z",
        "square_subscription_id": "abc123"
    }
    """
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        user_id = g.current_user['id']
        
        from database import db_session_scope
        with db_session_scope() as db_session:
            subscription = db_session.query(Subscription).filter_by(user_id=user_id).first()
            
            if not subscription:
                return jsonify({
                    'has_subscription': False,
                    'message': 'No subscription found. Please subscribe to continue.'
                }), 200
            
            return jsonify({
                'has_subscription': True,
                'tier': subscription.tier.value,
                'status': subscription.status.value,
                'current_period_start': subscription.current_period_start.isoformat() if subscription.current_period_start else None,
                'current_period_end': subscription.current_period_end.isoformat() if subscription.current_period_end else None,
                'square_subscription_id': subscription.square_subscription_id,
                'last_payment_date': subscription.last_payment_date.isoformat() if subscription.last_payment_date else None,
                'last_payment_amount': subscription.last_payment_amount
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting subscription status: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get subscription status'}), 500


@square_bp.route('/admin/sync-subscription/<subscription_id>', methods=['POST'])
@auth_required
@admin_only
def admin_sync_subscription(subscription_id):
    """
    Admin endpoint to sync subscription status from Square
    
    Args:
        subscription_id: Square subscription ID
        
    Returns updated subscription data
    """
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        with db_session_scope() as db_session:
            subscription = SquareSubscriptionManager.sync_subscription_from_square(
                subscription_id, db_session
            )
            
            if not subscription:
                return jsonify({'error': 'Subscription not found or sync failed'}), 404
            
            SecurityLogger.log_event('admin_sync_subscription', g.current_user['id'],
                                    f"Synced subscription {subscription.id} from Square")
            
            return jsonify({
                'id': subscription.id,
                'user_id': subscription.user_id,
                'tier': subscription.tier.value,
                'status': subscription.status.value,
                'square_subscription_id': subscription.square_subscription_id,
                'updated_at': subscription.updated_at.isoformat() if subscription.updated_at else None
            }), 200
            
    except Exception as e:
        logger.error(f"Error syncing subscription: {e}", exc_info=True)
        return jsonify({'error': 'Failed to sync subscription'}), 500


@square_bp.route('/admin/cancel-subscription/<user_id>', methods=['POST'])
@auth_required
@admin_only
def admin_cancel_subscription(user_id):
    """
    Admin endpoint to cancel a user's Square subscription
    
    Note: This cancels at period end, not immediately
    """
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        with db_session_scope() as db_session:
            subscription = db_session.query(Subscription).filter_by(user_id=user_id).first()
            
            if not subscription:
                return jsonify({'error': 'Subscription not found'}), 404
            
            success = SquareSubscriptionManager.cancel_subscription(subscription, db_session)
            
            if success:
                SecurityLogger.log_event('admin_cancel_subscription', g.current_user['id'],
                                        f"Cancelled subscription for user {user_id}")
                
                return jsonify({
                    'success': True,
                    'message': 'Subscription cancelled (will end at period end)',
                    'subscription_id': subscription.id,
                    'cancelled_at': subscription.cancelled_at.isoformat() if subscription.cancelled_at else None
                }), 200
            else:
                return jsonify({'error': 'Failed to cancel subscription in Square'}), 500
            
    except Exception as e:
        logger.error(f"Error cancelling subscription: {e}", exc_info=True)
        return jsonify({'error': 'Failed to cancel subscription'}), 500


@square_bp.route('/tiers', methods=['GET'])
def get_subscription_tiers():
    """
    Get available subscription tiers (public endpoint)
    
    Returns tier information for pricing page
    """
    from subscription_config import TierLimits
    
    tiers_data = []
    for tier in [SubscriptionTier.STARTER, SubscriptionTier.PRO, SubscriptionTier.ENTERPRISE]:
        config = TierLimits.get_tier_config(tier)
        if config:
            tiers_data.append({
                'id': tier.value,
                'name': config['name'],
                'price': config['price'],
                'posts_per_month': config['posts_per_month'],
                'accounts_per_platform': config['accounts_per_platform'],
                'scheduled_posts_limit': config['scheduled_posts_limit'],
                'features': config['features']
            })
    
    return jsonify({'tiers': tiers_data}), 200
