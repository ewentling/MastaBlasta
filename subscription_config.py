"""
Subscription tier configuration and limits
"""
from models import SubscriptionTier
from typing import Dict, Any


class TierLimits:
    """Subscription tier limits and features"""
    
    # Define limits for each tier (NO FREE TIER - all paid via Square)
    TIER_CONFIGS: Dict[SubscriptionTier, Dict[str, Any]] = {
        SubscriptionTier.STARTER: {
            'name': 'Starter',
            'price': 29,
            'posts_per_month': 100,
            'accounts_per_platform': 3,
            'scheduled_posts_limit': 50,
            'storage_mb': 1000,
            'api_calls_per_day': 1000,
            'features': {
                'basic_analytics': True,
                'advanced_analytics': True,
                'ai_features': True,
                'social_listening': False,
                'custom_branding': False,
                'priority_support': False,
                'api_access': True,
                'team_collaboration': False,
                'webhooks': True,
            }
        },
        SubscriptionTier.PRO: {
            'name': 'Pro',
            'price': 99,
            'posts_per_month': 1000,
            'accounts_per_platform': 10,
            'scheduled_posts_limit': 500,
            'storage_mb': 10000,
            'api_calls_per_day': 10000,
            'features': {
                'basic_analytics': True,
                'advanced_analytics': True,
                'ai_features': True,
                'social_listening': True,
                'custom_branding': True,
                'priority_support': False,
                'api_access': True,
                'team_collaboration': True,
                'webhooks': True,
            }
        },
        SubscriptionTier.ENTERPRISE: {
            'name': 'Enterprise',
            'price': 299,
            'posts_per_month': -1,  # Unlimited
            'accounts_per_platform': -1,  # Unlimited
            'scheduled_posts_limit': -1,  # Unlimited
            'storage_mb': -1,  # Unlimited
            'api_calls_per_day': -1,  # Unlimited
            'features': {
                'basic_analytics': True,
                'advanced_analytics': True,
                'ai_features': True,
                'social_listening': True,
                'custom_branding': True,
                'priority_support': True,
                'api_access': True,
                'team_collaboration': True,
                'webhooks': True,
            }
        }
    }
    
    @classmethod
    def get_tier_config(cls, tier: SubscriptionTier) -> Dict[str, Any]:
        """Get configuration for a subscription tier"""
        if tier not in cls.TIER_CONFIGS:
            # Default to STARTER tier if tier is unknown
            logger.warning(f"Unknown subscription tier: {tier}, defaulting to STARTER")
            return cls.TIER_CONFIGS[SubscriptionTier.STARTER]
        return cls.TIER_CONFIGS[tier]
    
    @classmethod
    def get_limit(cls, tier: SubscriptionTier, limit_name: str) -> int:
        """Get a specific limit value for a tier"""
        config = cls.get_tier_config(tier)
        return config.get(limit_name, 0)
    
    @classmethod
    def has_feature(cls, tier: SubscriptionTier, feature_name: str) -> bool:
        """Check if a tier has access to a specific feature"""
        config = cls.get_tier_config(tier)
        features = config.get('features', {})
        return features.get(feature_name, False)
    
    @classmethod
    def is_unlimited(cls, limit_value: int) -> bool:
        """Check if a limit value represents unlimited (-1)"""
        return limit_value == -1
    
    @classmethod
    def check_limit(cls, tier: SubscriptionTier, limit_name: str, current_usage: int) -> tuple[bool, int]:
        """
        Check if current usage is within limits
        
        Returns:
            tuple: (within_limit: bool, remaining: int or -1 for unlimited)
        """
        limit = cls.get_limit(tier, limit_name)
        
        if cls.is_unlimited(limit):
            return True, -1
        
        within_limit = current_usage < limit
        remaining = max(0, limit - current_usage)
        
        return within_limit, remaining


class SubscriptionHelper:
    """Helper methods for subscription management"""
    
    @staticmethod
    def get_grace_period_days() -> int:
        """Number of days of grace period after expiration"""
        return 7
    
    @staticmethod
    def get_trial_period_days() -> int:
        """Number of days for trial period"""
        return 14
    
    @staticmethod
    def get_tier_display_name(tier: SubscriptionTier) -> str:
        """Get human-readable tier name"""
        return TierLimits.get_tier_config(tier)['name']
    
    @staticmethod
    def get_tier_price(tier: SubscriptionTier) -> float:
        """Get monthly price for tier"""
        return TierLimits.get_tier_config(tier)['price']
    
    @staticmethod
    def format_limit(limit: int) -> str:
        """Format limit value for display"""
        if TierLimits.is_unlimited(limit):
            return "Unlimited"
        return str(limit)
