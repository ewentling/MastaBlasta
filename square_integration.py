"""
Square subscription integration for payment processing
"""
import os
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from uuid import uuid4

from square.client import Client
from square.http.auth.o_auth_2 import BearerAuthCredentials

from models import Subscription, SubscriptionTier, SubscriptionStatus, User
from subscription_config import TierLimits

logger = logging.getLogger(__name__)

# Square API Configuration
SQUARE_ACCESS_TOKEN = os.getenv('SQUARE_ACCESS_TOKEN', '')
SQUARE_ENVIRONMENT = os.getenv('SQUARE_ENVIRONMENT', 'sandbox')  # 'sandbox' or 'production'
SQUARE_LOCATION_ID = os.getenv('SQUARE_LOCATION_ID', '')

# Initialize Square client
_square_client = None


def get_square_client() -> Client:
    """Get or initialize Square API client"""
    global _square_client
    
    if not _square_client:
        if not SQUARE_ACCESS_TOKEN:
            raise ValueError("SQUARE_ACCESS_TOKEN environment variable not set")
        
        _square_client = Client(
            access_token=SQUARE_ACCESS_TOKEN,
            environment=SQUARE_ENVIRONMENT
        )
        logger.info(f"Initialized Square client in {SQUARE_ENVIRONMENT} mode")
    
    return _square_client


class SquareSubscriptionManager:
    """Manager for Square subscription operations"""
    
    @staticmethod
    def create_checkout_session(user: User, tier: SubscriptionTier, db_session) -> Dict[str, Any]:
        """
        Create a Square checkout session for subscription payment
        
        Args:
            user: User object
            tier: Subscription tier to purchase
            db_session: Database session
            
        Returns:
            Dict with checkout_url and subscription_id
        """
        try:
            client = get_square_client()
            tier_config = TierLimits.get_tier_config(tier)
            
            if not tier_config:
                raise ValueError(f"Invalid tier: {tier}")
            
            # Create or get Square customer
            customer_id = SquareSubscriptionManager._get_or_create_customer(user, client)
            
            # Get Square catalog item for this tier
            catalog_item_id = SquareSubscriptionManager._get_catalog_item_for_tier(tier)
            
            if not catalog_item_id:
                raise ValueError(f"No Square catalog item configured for tier: {tier.value}")
            
            # Create checkout link
            checkout_api = client.checkout
            
            idempotency_key = str(uuid4())
            
            request_body = {
                'idempotency_key': idempotency_key,
                'order': {
                    'location_id': SQUARE_LOCATION_ID,
                    'customer_id': customer_id,
                    'line_items': [
                        {
                            'quantity': '1',
                            'catalog_object_id': catalog_item_id
                        }
                    ]
                },
                'checkout_options': {
                    'redirect_url': f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/subscription/success",
                    'ask_for_shipping_address': False,
                    'merchant_support_email': os.getenv('SUPPORT_EMAIL', 'support@mastablasta.com')
                }
            }
            
            result = checkout_api.create_payment_link(request_body)
            
            if result.is_success():
                payment_link = result.body.get('payment_link', {})
                checkout_url = payment_link.get('url')
                
                logger.info(f"Created Square checkout for user {user.id}, tier {tier.value}")
                
                return {
                    'checkout_url': checkout_url,
                    'customer_id': customer_id,
                    'tier': tier.value,
                    'price': tier_config['price']
                }
            else:
                errors = result.errors
                logger.error(f"Square checkout creation failed: {errors}")
                raise Exception(f"Failed to create checkout: {errors}")
                
        except Exception as e:
            logger.error(f"Error creating Square checkout: {e}", exc_info=True)
            raise
    
    @staticmethod
    def _get_or_create_customer(user: User, client: Client) -> str:
        """Get or create Square customer for user"""
        try:
            customers_api = client.customers
            
            # Search for existing customer by email
            search_result = customers_api.search_customers({
                'query': {
                    'filter': {
                        'email_address': {
                            'exact': user.email
                        }
                    }
                }
            })
            
            if search_result.is_success():
                customers = search_result.body.get('customers', [])
                if customers:
                    customer_id = customers[0]['id']
                    logger.info(f"Found existing Square customer: {customer_id}")
                    return customer_id
            
            # Create new customer
            create_result = customers_api.create_customer({
                'idempotency_key': str(uuid4()),
                'given_name': user.full_name.split()[0] if user.full_name else user.email.split('@')[0],
                'family_name': ' '.join(user.full_name.split()[1:]) if user.full_name and len(user.full_name.split()) > 1 else '',
                'email_address': user.email,
                'reference_id': user.id  # Store our user ID in Square
            })
            
            if create_result.is_success():
                customer_id = create_result.body['customer']['id']
                logger.info(f"Created new Square customer: {customer_id}")
                return customer_id
            else:
                errors = create_result.errors
                logger.error(f"Failed to create Square customer: {errors}")
                raise Exception(f"Failed to create customer: {errors}")
                
        except Exception as e:
            logger.error(f"Error with Square customer: {e}", exc_info=True)
            raise
    
    @staticmethod
    def _get_catalog_item_for_tier(tier: SubscriptionTier) -> Optional[str]:
        """
        Get Square catalog item ID for subscription tier
        
        These should be configured in Square dashboard and stored as environment variables
        """
        catalog_mapping = {
            SubscriptionTier.STARTER: os.getenv('SQUARE_CATALOG_STARTER'),
            SubscriptionTier.PRO: os.getenv('SQUARE_CATALOG_PRO'),
            SubscriptionTier.ENTERPRISE: os.getenv('SQUARE_CATALOG_ENTERPRISE'),
        }
        
        catalog_id = catalog_mapping.get(tier)
        
        if not catalog_id:
            logger.warning(f"No Square catalog ID configured for tier {tier.value}")
            logger.info("Set environment variables: SQUARE_CATALOG_STARTER, SQUARE_CATALOG_PRO, SQUARE_CATALOG_ENTERPRISE")
        
        return catalog_id
    
    @staticmethod
    def create_subscription_from_payment(
        user_id: str,
        tier: SubscriptionTier,
        square_customer_id: str,
        square_subscription_id: str,
        db_session
    ) -> Subscription:
        """
        Create or update subscription after successful Square payment
        
        This is called from webhook handler after payment confirmation
        """
        try:
            # Check if subscription already exists
            subscription = db_session.query(Subscription).filter_by(user_id=user_id).first()
            
            now = datetime.now(timezone.utc)
            period_end = now + timedelta(days=30)  # Monthly billing
            
            if subscription:
                # Update existing subscription
                subscription.tier = tier
                subscription.status = SubscriptionStatus.ACTIVE
                subscription.square_customer_id = square_customer_id
                subscription.square_subscription_id = square_subscription_id
                subscription.current_period_start = now
                subscription.current_period_end = period_end
                subscription.last_payment_date = now
                subscription.payment_method = 'square'
                
                tier_config = TierLimits.get_tier_config(tier)
                if tier_config:
                    subscription.last_payment_amount = tier_config['price']
                
                logger.info(f"Updated subscription for user {user_id} to {tier.value}")
            else:
                # Create new subscription
                subscription = Subscription(
                    id=str(uuid4()),
                    user_id=user_id,
                    tier=tier,
                    status=SubscriptionStatus.ACTIVE,
                    square_customer_id=square_customer_id,
                    square_subscription_id=square_subscription_id,
                    current_period_start=now,
                    current_period_end=period_end,
                    last_payment_date=now,
                    payment_method='square'
                )
                
                tier_config = TierLimits.get_tier_config(tier)
                if tier_config:
                    subscription.last_payment_amount = tier_config['price']
                
                db_session.add(subscription)
                logger.info(f"Created new subscription for user {user_id}, tier {tier.value}")
            
            db_session.commit()
            return subscription
            
        except Exception as e:
            logger.error(f"Error creating subscription from payment: {e}", exc_info=True)
            db_session.rollback()
            raise
    
    @staticmethod
    def sync_subscription_from_square(subscription_id: str, db_session) -> Optional[Subscription]:
        """
        Sync subscription status from Square API
        
        Used by admin or periodic sync jobs
        """
        try:
            subscription = db_session.query(Subscription).filter_by(
                square_subscription_id=subscription_id
            ).first()
            
            if not subscription:
                logger.warning(f"No local subscription found for Square ID: {subscription_id}")
                return None
            
            client = get_square_client()
            subscriptions_api = client.subscriptions
            
            result = subscriptions_api.retrieve_subscription(subscription_id)
            
            if result.is_success():
                square_sub = result.body.get('subscription', {})
                square_status = square_sub.get('status', '')
                
                # Map Square status to our status
                status_mapping = {
                    'ACTIVE': SubscriptionStatus.ACTIVE,
                    'CANCELED': SubscriptionStatus.CANCELLED,
                    'PAUSED': SubscriptionStatus.SUSPENDED,
                    'PENDING': SubscriptionStatus.TRIAL,
                }
                
                new_status = status_mapping.get(square_status, SubscriptionStatus.EXPIRED)
                
                if subscription.status != new_status:
                    logger.info(f"Updating subscription {subscription.id} status: {subscription.status.value} -> {new_status.value}")
                    subscription.status = new_status
                    db_session.commit()
                
                return subscription
            else:
                errors = result.errors
                logger.error(f"Failed to retrieve Square subscription: {errors}")
                return None
                
        except Exception as e:
            logger.error(f"Error syncing from Square: {e}", exc_info=True)
            return None
    
    @staticmethod
    def cancel_subscription(subscription: Subscription, db_session) -> bool:
        """
        Cancel subscription in Square
        
        Note: This cancels at period end, not immediately
        """
        try:
            if not subscription.square_subscription_id:
                logger.warning(f"No Square subscription ID for subscription {subscription.id}")
                return False
            
            client = get_square_client()
            subscriptions_api = client.subscriptions
            
            result = subscriptions_api.cancel_subscription(
                subscription.square_subscription_id
            )
            
            if result.is_success():
                subscription.status = SubscriptionStatus.CANCELLED
                subscription.cancelled_at = datetime.now(timezone.utc)
                db_session.commit()
                
                logger.info(f"Cancelled Square subscription {subscription.square_subscription_id}")
                return True
            else:
                errors = result.errors
                logger.error(f"Failed to cancel Square subscription: {errors}")
                return False
                
        except Exception as e:
            logger.error(f"Error cancelling subscription: {e}", exc_info=True)
            return False
