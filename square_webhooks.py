"""
Square webhook handlers for subscription events
"""
import os
import logging
import hmac
import hashlib
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone

from models import Subscription, SubscriptionStatus, SubscriptionTier, User
from square_integration import SquareSubscriptionManager
from security_enhancements import SecurityLogger

logger = logging.getLogger(__name__)

# Create blueprint
square_webhooks_bp = Blueprint('square_webhooks', __name__, url_prefix='/api/square')

# Square webhook signature key
SQUARE_WEBHOOK_SIGNATURE_KEY = os.getenv('SQUARE_WEBHOOK_SIGNATURE_KEY', '')


def verify_square_signature(payload: bytes, signature: str) -> bool:
    """
    Verify Square webhook signature
    
    Args:
        payload: Raw request body
        signature: Square-Signature header value
        
    Returns:
        True if signature is valid
    """
    if not SQUARE_WEBHOOK_SIGNATURE_KEY:
        logger.warning("SQUARE_WEBHOOK_SIGNATURE_KEY not configured - skipping verification")
        return True  # Allow in dev mode
    
    try:
        # Combine notification URL + request body
        url = request.url
        string_to_sign = url + payload.decode('utf-8')
        
        # Calculate HMAC
        hmac_sha256 = hmac.new(
            SQUARE_WEBHOOK_SIGNATURE_KEY.encode('utf-8'),
            string_to_sign.encode('utf-8'),
            hashlib.sha256
        )
        
        expected_signature = hmac_sha256.hexdigest()
        
        # Compare signatures (constant time comparison)
        return hmac.compare_digest(expected_signature, signature)
        
    except Exception as e:
        logger.error(f"Error verifying Square signature: {e}", exc_info=True)
        return False


@square_webhooks_bp.route('/webhooks', methods=['POST'])
def handle_webhook():
    """
    Handle Square webhook events
    
    Events we handle:
    - subscription.created
    - subscription.updated  
    - payment.updated (for successful payments)
    - subscription.canceled
    """
    try:
        # Verify signature
        signature = request.headers.get('Square-Signature', '')
        payload = request.get_data()
        
        if not verify_square_signature(payload, signature):
            logger.warning("Invalid Square webhook signature")
            SecurityLogger.log_suspicious_activity(
                request.remote_addr,
                "Invalid Square webhook signature",
                request.headers.get('User-Agent', '')
            )
            return jsonify({'error': 'Invalid signature'}), 401
        
        # Parse event
        event = request.json
        event_type = event.get('type', '')
        event_data = event.get('data', {})
        
        logger.info(f"Received Square webhook: {event_type}")
        
        # Route to appropriate handler
        if event_type == 'subscription.created':
            return handle_subscription_created(event_data)
        elif event_type == 'subscription.updated':
            return handle_subscription_updated(event_data)
        elif event_type == 'payment.updated':
            return handle_payment_updated(event_data)
        elif event_type == 'subscription.canceled':
            return handle_subscription_canceled(event_data)
        else:
            logger.info(f"Unhandled webhook type: {event_type}")
            return jsonify({'status': 'ignored'}), 200
            
    except Exception as e:
        logger.error(f"Error handling Square webhook: {e}", exc_info=True)
        return jsonify({'error': 'Webhook processing failed'}), 500


def handle_subscription_created(data: dict):
    """Handle subscription.created event"""
    try:
        from database import db_session_scope
        
        subscription_data = data.get('object', {}).get('subscription', {})
        square_subscription_id = subscription_data.get('id')
        square_customer_id = subscription_data.get('customer_id')
        
        if not square_subscription_id or not square_customer_id:
            logger.warning("Missing subscription or customer ID in webhook")
            return jsonify({'error': 'Invalid data'}), 400
        
        with db_session_scope() as db_session:
            # Find user by Square customer ID
            subscription = db_session.query(Subscription).filter_by(
                square_customer_id=square_customer_id
            ).first()
            
            if subscription:
                # Update with Square subscription ID
                subscription.square_subscription_id = square_subscription_id
                subscription.status = SubscriptionStatus.ACTIVE
                db_session.commit()
                
                logger.info(f"Updated subscription with Square ID: {square_subscription_id}")
                SecurityLogger.log_event('subscription_created', subscription.user_id, 
                                        f"Square subscription created: {square_subscription_id}")
            else:
                logger.warning(f"No subscription found for Square customer: {square_customer_id}")
        
        return jsonify({'status': 'processed'}), 200
        
    except Exception as e:
        logger.error(f"Error handling subscription.created: {e}", exc_info=True)
        return jsonify({'error': 'Processing failed'}), 500


def handle_subscription_updated(data: dict):
    """Handle subscription.updated event"""
    try:
        from database import db_session_scope
        
        subscription_data = data.get('object', {}).get('subscription', {})
        square_subscription_id = subscription_data.get('id')
        square_status = subscription_data.get('status', '')
        
        if not square_subscription_id:
            return jsonify({'error': 'Invalid data'}), 400
        
        # Map Square status to our status
        status_mapping = {
            'ACTIVE': SubscriptionStatus.ACTIVE,
            'CANCELED': SubscriptionStatus.CANCELLED,
            'PAUSED': SubscriptionStatus.SUSPENDED,
            'PENDING': SubscriptionStatus.TRIAL,
        }
        
        new_status = status_mapping.get(square_status, SubscriptionStatus.EXPIRED)
        
        with db_session_scope() as db_session:
            subscription = db_session.query(Subscription).filter_by(
                square_subscription_id=square_subscription_id
            ).first()
            
            if subscription:
                old_status = subscription.status
                subscription.status = new_status
                db_session.commit()
                
                logger.info(f"Updated subscription {subscription.id}: {old_status.value} -> {new_status.value}")
                SecurityLogger.log_event('subscription_updated', subscription.user_id,
                                        f"Status changed: {old_status.value} -> {new_status.value}")
            else:
                logger.warning(f"No subscription found for Square ID: {square_subscription_id}")
        
        return jsonify({'status': 'processed'}), 200
        
    except Exception as e:
        logger.error(f"Error handling subscription.updated: {e}", exc_info=True)
        return jsonify({'error': 'Processing failed'}), 500


def handle_payment_updated(data: dict):
    """Handle payment.updated event (successful payments)"""
    try:
        from database import db_session_scope
        
        payment_data = data.get('object', {}).get('payment', {})
        payment_status = payment_data.get('status', '')
        
        # Only process completed payments
        if payment_status != 'COMPLETED':
            logger.info(f"Ignoring payment with status: {payment_status}")
            return jsonify({'status': 'ignored'}), 200
        
        # Extract subscription info from payment
        order_id = payment_data.get('order_id')
        customer_id = payment_data.get('customer_id')
        amount = payment_data.get('amount_money', {}).get('amount', 0) / 100  # Convert cents to dollars
        
        if not customer_id:
            return jsonify({'error': 'Missing customer ID'}), 400
        
        with db_session_scope() as db_session:
            # Find subscription by Square customer ID
            subscription = db_session.query(Subscription).filter_by(
                square_customer_id=customer_id
            ).first()
            
            if subscription:
                subscription.last_payment_date = datetime.now(timezone.utc)
                subscription.last_payment_amount = amount
                subscription.status = SubscriptionStatus.ACTIVE
                
                # Extend period by 30 days
                from datetime import timedelta
                subscription.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)
                
                db_session.commit()
                
                logger.info(f"Recorded payment for subscription {subscription.id}: ${amount}")
                SecurityLogger.log_event('payment_received', subscription.user_id,
                                        f"Payment processed: ${amount}")
            else:
                logger.warning(f"No subscription found for customer: {customer_id}")
        
        return jsonify({'status': 'processed'}), 200
        
    except Exception as e:
        logger.error(f"Error handling payment.updated: {e}", exc_info=True)
        return jsonify({'error': 'Processing failed'}), 500


def handle_subscription_canceled(data: dict):
    """Handle subscription.canceled event"""
    try:
        from database import db_session_scope
        
        subscription_data = data.get('object', {}).get('subscription', {})
        square_subscription_id = subscription_data.get('id')
        
        if not square_subscription_id:
            return jsonify({'error': 'Invalid data'}), 400
        
        with db_session_scope() as db_session:
            subscription = db_session.query(Subscription).filter_by(
                square_subscription_id=square_subscription_id
            ).first()
            
            if subscription:
                subscription.status = SubscriptionStatus.CANCELLED
                subscription.cancelled_at = datetime.now(timezone.utc)
                db_session.commit()
                
                logger.info(f"Cancelled subscription {subscription.id}")
                SecurityLogger.log_event('subscription_canceled', subscription.user_id,
                                        "Subscription canceled via Square")
            else:
                logger.warning(f"No subscription found for Square ID: {square_subscription_id}")
        
        return jsonify({'status': 'processed'}), 200
        
    except Exception as e:
        logger.error(f"Error handling subscription.canceled: {e}", exc_info=True)
        return jsonify({'error': 'Processing failed'}), 500
