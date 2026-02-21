"""
Admin API endpoints for subscription and user management
"""
from flask import Blueprint, request, jsonify, g
from datetime import datetime, timezone, timedelta
import logging
import re
import stat
import os
from uuid import uuid4
from sqlalchemy import or_

from app_extensions import auth_required, DB_ENABLED
from subscription_control import admin_only, get_user_subscription
from subscription_config import TierLimits, SubscriptionHelper
from models import User, Subscription, SubscriptionTier, SubscriptionStatus, UsageMetrics, UserRole
from security_enhancements import SecurityLogger

logger = logging.getLogger(__name__)

# Create blueprint
admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')


def _sanitize_env_value(value: str) -> str:
    """Sanitize a value before writing it to a .env file.

    * Strips leading/trailing whitespace.
    * Removes embedded newlines (which would break dotenv parsing).
    * Wraps in double-quotes when the value contains spaces, ``#`` (which
      dotenv treats as a comment start), or ``"``/``'`` characters so that
      the file remains unambiguously parseable on restart.
    """
    value = value.strip().replace('\r', '').replace('\n', '')
    if any(ch in value for ch in (' ', '\t', '#', '"', "'")):
        # Escape any embedded double-quotes and wrap in double-quotes.
        value = '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'
    return value

# ==================== USER MANAGEMENT ====================

@admin_bp.route('/users', methods=['GET'])
@auth_required
@admin_only
def list_users():
    """List all users with subscription information, supports search and filtering"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        
        # Get query parameters for search and filtering
        search = request.args.get('search', '').strip()
        tier_filter = request.args.get('tier', '').strip()
        status_filter = request.args.get('status', '').strip()
        provider_filter = request.args.get('provider', '').strip()
        sort_by = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc')
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('per_page', 50))))
        
        with db_session_scope() as db_session:
            # Build base query with join
            query = db_session.query(User).outerjoin(Subscription, User.id == Subscription.user_id)
            
            # Apply search filter
            if search:
                search_pattern = f'%{search}%'
                query = query.filter(
                    or_(
                        User.email.ilike(search_pattern),
                        User.full_name.ilike(search_pattern),
                        User.id.ilike(search_pattern)
                    )
                )
            
            # Apply tier filter
            if tier_filter:
                try:
                    tier_enum = SubscriptionTier(tier_filter.lower())
                    query = query.filter(Subscription.tier == tier_enum)
                except ValueError:
                    pass
            
            # Apply status filter
            if status_filter:
                try:
                    status_enum = SubscriptionStatus(status_filter.lower())
                    query = query.filter(Subscription.status == status_enum)
                except ValueError:
                    pass
            
            # Apply provider filter
            if provider_filter:
                query = query.filter(User.auth_provider == provider_filter)
            
            # Apply sorting
            if sort_by == 'email':
                query = query.order_by(User.email.desc() if sort_order == 'desc' else User.email.asc())
            elif sort_by == 'created_at':
                query = query.order_by(User.created_at.desc() if sort_order == 'desc' else User.created_at.asc())
            elif sort_by == 'last_login':
                query = query.order_by(User.last_login.desc() if sort_order == 'desc' else User.last_login.asc())
            elif sort_by == 'full_name':
                query = query.order_by(User.full_name.desc() if sort_order == 'desc' else User.full_name.asc())
            
            # Get total count before pagination
            total_users = query.count()
            
            # Apply pagination
            offset = (page - 1) * per_page
            users = query.limit(per_page).offset(offset).all()
            
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
                'total': total_users,
                'page': page,
                'per_page': per_page,
                'total_pages': (total_users + per_page - 1) // per_page
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


@admin_bp.route('/users', methods=['POST'])
@auth_required
@admin_only
def create_user():
    """Create a new user account"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503

    try:
        from database import db_session_scope
        from auth import hash_password

        data = request.get_json() or {}
        email = data.get('email', '').strip().lower()
        full_name = data.get('full_name', '').strip()
        role_str = data.get('role', 'editor').lower()
        password = data.get('password', '')

        if not email:
            return jsonify({'error': 'Email is required'}), 400
        if not password or len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

        try:
            role = UserRole(role_str)
        except ValueError:
            return jsonify({'error': f'Invalid role: {role_str}'}), 400

        with db_session_scope() as db_session:
            existing = db_session.query(User).filter_by(email=email).first()
            if existing:
                return jsonify({'error': 'A user with that email already exists'}), 409

            user = User(
                id=str(uuid4()),
                email=email,
                full_name=full_name,
                password_hash=hash_password(password),
                role=role,
                is_active=True,
                auth_provider='email',
            )
            db_session.add(user)
            db_session.commit()

            logger.info(f"Admin {g.current_user['email']} created user {email}")
            SecurityLogger.log_event(
                'admin_user_created',
                g.current_user['id'],
                {'new_user_email': email, 'role': role_str}
            )

            return jsonify({
                'message': 'User created successfully',
                'user': {
                    'id': user.id,
                    'email': user.email,
                    'full_name': user.full_name,
                    'role': user.role.value,
                    'is_active': user.is_active,
                    'created_at': user.created_at.isoformat(),
                }
            }), 201

    except Exception as e:
        logger.error(f"Error creating user: {e}", exc_info=True)
        return jsonify({'error': 'Failed to create user'}), 500


@admin_bp.route('/users/<user_id>', methods=['DELETE'])
@auth_required
@admin_only
def delete_user(user_id):
    """Permanently delete a user account"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503

    try:
        from database import db_session_scope

        with db_session_scope() as db_session:
            user = db_session.query(User).filter_by(id=user_id).first()
            if not user:
                return jsonify({'error': 'User not found'}), 404

            # Prevent deleting admin accounts
            if user.role == UserRole.ADMIN:
                return jsonify({'error': 'Cannot delete admin users'}), 403

            # Prevent self-deletion
            if user.id == g.current_user['id']:
                return jsonify({'error': 'Cannot delete your own account'}), 403

            email = user.email
            db_session.delete(user)
            db_session.commit()

            logger.warning(f"Admin {g.current_user['email']} deleted user {email}")
            SecurityLogger.log_event(
                'admin_user_deleted',
                g.current_user['id'],
                {'deleted_user_id': user_id, 'deleted_user_email': email}
            )

            return jsonify({'message': 'User deleted successfully', 'user_id': user_id}), 200

    except Exception as e:
        logger.error(f"Error deleting user: {e}", exc_info=True)
        return jsonify({'error': 'Failed to delete user'}), 500


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


# ==================== SQUARE INTEGRATION CONFIGURATION ====================

@admin_bp.route('/square-config', methods=['GET'])
@auth_required
@admin_only
def get_square_config():
    """Get Square integration configuration (sensitive values masked)"""
    try:
        import os

        access_token = os.getenv('SQUARE_ACCESS_TOKEN', '')
        webhook_key = os.getenv('SQUARE_WEBHOOK_SIGNATURE_KEY', '')

        # Build list of which fields are configured so the UI can show a checklist
        configured_fields = {
            'access_token': bool(access_token),
            'environment': True,  # always has a default
            'location_id': bool(os.getenv('SQUARE_LOCATION_ID', '')),
            'webhook_signature_key': bool(webhook_key),
            'catalog_starter': bool(os.getenv('SQUARE_CATALOG_STARTER', '')),
            'catalog_pro': bool(os.getenv('SQUARE_CATALOG_PRO', '')),
            'catalog_enterprise': bool(os.getenv('SQUARE_CATALOG_ENTERPRISE', '')),
        }

        config = {
            # Masked sensitive values (show last 4 chars only)
            'access_token': f"{'*' * 48}{access_token[-4:]}" if access_token else '',
            'webhook_signature_key': f"{'*' * 56}{webhook_key[-4:]}" if webhook_key else '',
            # Non-sensitive values returned as-is
            'environment': os.getenv('SQUARE_ENVIRONMENT', 'sandbox'),
            'location_id': os.getenv('SQUARE_LOCATION_ID', ''),
            'catalog_starter': os.getenv('SQUARE_CATALOG_STARTER', ''),
            'catalog_pro': os.getenv('SQUARE_CATALOG_PRO', ''),
            'catalog_enterprise': os.getenv('SQUARE_CATALOG_ENTERPRISE', ''),
            # Status helpers
            'configured': bool(access_token and os.getenv('SQUARE_LOCATION_ID', '')),
            'configured_fields': configured_fields,
        }

        return jsonify(config), 200

    except Exception as e:
        logger.error(f"Error getting Square config: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get Square configuration'}), 500


@admin_bp.route('/square-config', methods=['POST'])
@auth_required
@admin_only
def update_square_config():
    """Update Square integration configuration.

    Persists credentials to the .env file and applies them to the running
    process immediately so a server restart is not required.
    """
    try:
        data = request.get_json() or {}

        required_fields = ['access_token', 'environment', 'location_id']
        missing_fields = [f for f in required_fields if not data.get(f)]
        if missing_fields:
            return jsonify({'error': 'Missing required fields', 'missing': missing_fields}), 400

        if data.get('environment') not in ('sandbox', 'production'):
            return jsonify({'error': 'environment must be "sandbox" or "production"'}), 400

        # Map from request keys to env var names and sanitized values
        env_map = {
            'SQUARE_ACCESS_TOKEN': _sanitize_env_value(data.get('access_token', '')),
            'SQUARE_ENVIRONMENT': _sanitize_env_value(data.get('environment', 'sandbox')),
            'SQUARE_LOCATION_ID': _sanitize_env_value(data.get('location_id', '')),
            'SQUARE_WEBHOOK_SIGNATURE_KEY': _sanitize_env_value(data.get('webhook_signature_key', '')),
            'SQUARE_CATALOG_STARTER': _sanitize_env_value(data.get('catalog_starter', '')),
            'SQUARE_CATALOG_PRO': _sanitize_env_value(data.get('catalog_pro', '')),
            'SQUARE_CATALOG_ENTERPRISE': _sanitize_env_value(data.get('catalog_enterprise', '')),
        }

        # ── 1. Apply to running process immediately ──────────────────────────
        for key, value in env_map.items():
            # Apply all values (including empty) so clearing a var is reflected
            os.environ[key] = value

        # Reset the Square client singleton so it picks up the new credentials
        try:
            import square_integration
            square_integration._square_client = None
            # Also update module-level constants used by the module
            square_integration.SQUARE_ACCESS_TOKEN = os.environ.get('SQUARE_ACCESS_TOKEN', '')
            square_integration.SQUARE_ENVIRONMENT = os.environ.get('SQUARE_ENVIRONMENT', 'sandbox')
            square_integration.SQUARE_LOCATION_ID = os.environ.get('SQUARE_LOCATION_ID', '')
        except ImportError:
            pass

        # ── 2. Persist to .env file so credentials survive restarts ──────────
        env_file_path = os.path.join(os.path.dirname(__file__), '.env')
        try:
            # Read existing lines (or start fresh)
            if os.path.exists(env_file_path):
                with open(env_file_path, 'r') as fh:
                    lines = fh.readlines()
            else:
                lines = []

            updated_keys = set()
            new_lines = []
            for line in lines:
                # Skip comment lines and empty lines without modification
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    new_lines.append(line)
                    continue
                match = re.match(r'^([A-Z_][A-Z0-9_]*)\s*=', line)
                if match and match.group(1) in env_map:
                    key = match.group(1)
                    new_lines.append(f"{key}={env_map[key]}\n")
                    updated_keys.add(key)
                else:
                    new_lines.append(line)

            # Append any keys that were not already in the file
            for key, value in env_map.items():
                if key not in updated_keys:
                    new_lines.append(f"{key}={value}\n")

            with open(env_file_path, 'w') as fh:
                fh.writelines(new_lines)

            # Restrict file permissions to owner-read-write only (security: no world-read)
            os.chmod(env_file_path, stat.S_IRUSR | stat.S_IWUSR)

            persisted = True
        except Exception as file_err:
            logger.warning(f"Could not write .env file: {file_err}")
            persisted = False

        SecurityLogger.log_event(
            'square_config_updated',
            user_id=g.current_user['id'],
            details=f"Square configuration updated by {g.current_user['email']}"
        )

        return jsonify({
            'success': True,
            'message': 'Square configuration saved and applied',
            'persisted_to_env': persisted,
        }), 200

    except Exception as e:
        logger.error(f"Error updating Square config: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update Square configuration'}), 500


@admin_bp.route('/square-test-connection', methods=['POST'])
@auth_required
@admin_only
def test_square_connection():
    """Test connection to Square API"""
    try:
        from square_integration import SquareSubscriptionManager
        
        # Try to initialize Square client
        manager = SquareSubscriptionManager()
        
        # Test API connection by listing locations
        try:
            result = manager.client.locations.list_locations()
            if result.is_success():
                locations = result.body.get('locations', [])
                return jsonify({
                    'success': True,
                    'message': 'Successfully connected to Square API',
                    'locations_count': len(locations),
                    'environment': manager.environment
                }), 200
            else:
                return jsonify({
                    'success': False,
                    'message': 'Failed to connect to Square API',
                    'error': str(result.errors) if result.errors else 'Unknown error'
                }), 500
        except Exception as api_error:
            return jsonify({
                'success': False,
                'message': 'Failed to connect to Square API',
                'error': str(api_error)
            }), 500
            
    except Exception as e:
        logger.error(f"Error testing Square connection: {e}", exc_info=True)
        return jsonify({
            'success': False,
            'message': 'Failed to initialize Square client',
            'error': str(e)
        }), 500



# ==================== PLATFORM OAUTH CONFIGURATION ====================

# All env-var names that belong to each platform.
# `sensitive` keys are masked in GET responses.
# `optional` keys are not required for "configured" status (nice-to-have extras).
_PLATFORM_ENV_VARS = {
    'meta': {
        'keys': ['META_APP_ID', 'META_APP_SECRET', 'META_REDIRECT_URI'],
        'sensitive': {'META_APP_SECRET'},
        'optional': {'META_REDIRECT_URI'},
    },
    'twitter': {
        'keys': ['TWITTER_CLIENT_ID', 'TWITTER_CLIENT_SECRET', 'TWITTER_REDIRECT_URI', 'TWITTER_BEARER_TOKEN'],
        'sensitive': {'TWITTER_CLIENT_SECRET', 'TWITTER_BEARER_TOKEN'},
        'optional': {'TWITTER_REDIRECT_URI', 'TWITTER_BEARER_TOKEN'},
    },
    'linkedin': {
        'keys': ['LINKEDIN_CLIENT_ID', 'LINKEDIN_CLIENT_SECRET', 'LINKEDIN_REDIRECT_URI'],
        'sensitive': {'LINKEDIN_CLIENT_SECRET'},
        'optional': {'LINKEDIN_REDIRECT_URI'},
    },
    'google': {
        'keys': ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_API_KEY'],
        'sensitive': {'GOOGLE_CLIENT_SECRET', 'GOOGLE_API_KEY'},
        'optional': {'GOOGLE_REDIRECT_URI', 'GOOGLE_API_KEY'},
    },
    'reddit': {
        'keys': ['REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET'],
        'sensitive': {'REDDIT_CLIENT_SECRET'},
        'optional': set(),
    },
    'pinterest': {
        'keys': ['PINTEREST_APP_ID', 'PINTEREST_APP_SECRET', 'PINTEREST_REDIRECT_URI'],
        'sensitive': {'PINTEREST_APP_SECRET'},
        'optional': {'PINTEREST_REDIRECT_URI'},
    },
    'tiktok': {
        'keys': ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_REDIRECT_URI'],
        'sensitive': {'TIKTOK_CLIENT_SECRET'},
        'optional': {'TIKTOK_REDIRECT_URI'},
    },
    'openai': {
        'keys': ['OPENAI_API_KEY'],
        'sensitive': {'OPENAI_API_KEY'},
        'optional': set(),
    },
}


def _mask(value: str) -> str:
    """Return a masked version showing only the last 4 chars."""
    if not value:
        return ''
    if len(value) <= 4:
        return '*' * len(value)
    return '*' * (len(value) - 4) + value[-4:]


@admin_bp.route('/platform-config', methods=['GET'])
@auth_required
@admin_only
def get_platform_config():
    """Return current platform OAuth credentials (sensitive values masked)."""
    import os
    try:
        result = {}
        for platform, meta in _PLATFORM_ENV_VARS.items():
            fields = {}
            configured_fields = {}
            for key in meta['keys']:
                raw = os.getenv(key, '')
                configured_fields[key] = bool(raw)
                if key in meta['sensitive']:
                    fields[key] = _mask(raw)
                else:
                    fields[key] = raw
            result[platform] = {
                'fields': fields,
                'configured_fields': configured_fields,
                # A platform is "configured" when all non-optional keys have values
                'configured': all(
                    os.getenv(k, '')
                    for k in meta['keys']
                    if k not in meta.get('optional', set())
                ),
            }
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error getting platform config: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get platform configuration'}), 500


@admin_bp.route('/platform-config', methods=['POST'])
@auth_required
@admin_only
def update_platform_config():
    """Persist platform OAuth credentials to .env and apply to running process immediately."""
    try:
        data = request.get_json() or {}
        platform = data.get('platform', '').lower()

        if platform not in _PLATFORM_ENV_VARS:
            return jsonify({'error': f'Unknown platform: {platform}. Must be one of: {", ".join(_PLATFORM_ENV_VARS)}'}), 400

        meta = _PLATFORM_ENV_VARS[platform]
        env_map = {}
        for key in meta['keys']:
            # Accept values keyed by env-var name; sanitize before storing
            if key in data.get('fields', {}):
                env_map[key] = _sanitize_env_value(data['fields'][key])

        if not env_map:
            return jsonify({'error': 'No fields provided'}), 400

        # ── 1. Apply to running process immediately ──────────────────────────
        for key, value in env_map.items():
            os.environ[key] = value

        # oauth.py reads its module-level constants at import time via os.getenv().
        # Since os.environ is now updated, any new OAuth flow will pick up the new
        # values automatically because the OAuth classes call os.getenv() at
        # request time (not at module load time).  No setattr/reload is needed.

        # ── 2. Persist to .env file ──────────────────────────────────────────
        env_file_path = os.path.join(os.path.dirname(__file__), '.env')
        try:
            if os.path.exists(env_file_path):
                with open(env_file_path, 'r') as fh:
                    lines = fh.readlines()
            else:
                lines = []

            updated_keys = set()
            new_lines = []
            for line in lines:
                stripped = line.strip()
                if not stripped or stripped.startswith('#'):
                    new_lines.append(line)
                    continue
                match = re.match(r'^([A-Z_][A-Z0-9_]*)\s*=', line)
                if match and match.group(1) in env_map:
                    key = match.group(1)
                    new_lines.append(f"{key}={env_map[key]}\n")
                    updated_keys.add(key)
                else:
                    new_lines.append(line)

            for key, value in env_map.items():
                if key not in updated_keys:
                    new_lines.append(f"{key}={value}\n")

            with open(env_file_path, 'w') as fh:
                fh.writelines(new_lines)
            os.chmod(env_file_path, stat.S_IRUSR | stat.S_IWUSR)
            persisted = True
        except Exception as file_err:
            logger.warning(f"Could not write .env file: {file_err}")
            persisted = False

        SecurityLogger.log_event(
            'platform_config_updated',
            user_id=g.current_user['id'],
            details=f"{platform} configuration updated by {g.current_user['email']}"
        )

        return jsonify({
            'success': True,
            'message': f'{platform.title()} configuration saved and applied',
            'persisted_to_env': persisted,
        }), 200

    except Exception as e:
        logger.error(f"Error updating platform config: {e}", exc_info=True)
        return jsonify({'error': 'Failed to update platform configuration'}), 500


# ==================== AUDIT LOG & ACTIVITY ====================

@admin_bp.route('/audit-logs', methods=['GET'])
@auth_required
@admin_only
def get_audit_logs():
    """Get audit logs with filtering and pagination"""
    try:
        # Get query parameters
        user_id = request.args.get('user_id', '').strip()
        event_type = request.args.get('event_type', '').strip()
        start_date = request.args.get('start_date', '').strip()
        end_date = request.args.get('end_date', '').strip()
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('per_page', 50))))
        
        # Get security events from SecurityLogger
        # Note: In production, this should query a database table
        # For now, we'll return sample data showing the structure
        sample_logs = [
            {
                'id': f'log_{i}',
                'timestamp': (datetime.now(timezone.utc) - timedelta(hours=i)).isoformat(),
                'event_type': ['login_success', 'login_failed', 'password_change', 'subscription_change', 'user_suspended'][i % 5],
                'user_id': f'user_{i % 10}',
                'user_email': f'user{i % 10}@example.com',
                'details': {
                    'ip_address': f'192.168.1.{i % 255}',
                    'user_agent': 'Mozilla/5.0...'
                },
                'severity': ['info', 'warning', 'error'][i % 3]
            }
            for i in range(100)
        ]
        
        logs = sample_logs
        
        # Apply filters
        if user_id:
            logs = [log for log in logs if log.get('user_id') == user_id]
        if event_type:
            logs = [log for log in logs if log.get('event_type') == event_type]
        
        # Pagination
        total = len(logs)
        start_idx = (page - 1) * per_page
        end_idx = start_idx + per_page
        paginated_logs = logs[start_idx:end_idx]
        
        return jsonify({
            'logs': paginated_logs,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting audit logs: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get audit logs'}), 500


# ==================== QUICK ACTIONS ====================

@admin_bp.route('/quick-actions/extend-trial', methods=['POST'])
@auth_required
@admin_only
def extend_trial():
    """Extend trial period for a user"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        days = data.get('days', 7)
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            subscription = db_session.query(Subscription).filter_by(user_id=user_id).first()
            
            if not subscription:
                return jsonify({'error': 'User has no subscription'}), 404
            
            # Extend trial
            if subscription.trial_ends_at:
                subscription.trial_ends_at = subscription.trial_ends_at + timedelta(days=days)
            else:
                subscription.trial_ends_at = datetime.now(timezone.utc) + timedelta(days=days)
            
            # Log the action
            SecurityLogger.log_event(
                'trial_extended',
                user_id=g.current_user['id'],
                details={
                    'target_user_id': user_id,
                    'days_added': days,
                    'new_trial_end': subscription.trial_ends_at.isoformat()
                }
            )
            
            return jsonify({
                'success': True,
                'message': f'Trial extended by {days} days',
                'new_trial_end': subscription.trial_ends_at.isoformat()
            }), 200
            
    except Exception as e:
        logger.error(f"Error extending trial: {e}", exc_info=True)
        return jsonify({'error': 'Failed to extend trial'}), 500


@admin_bp.route('/quick-actions/reset-password', methods=['POST'])
@auth_required
@admin_only
def admin_reset_password():
    """Reset user password and send email"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        data = request.get_json()
        user_id = data.get('user_id')
        
        if not user_id:
            return jsonify({'error': 'user_id is required'}), 400
        
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            user = db_session.query(User).filter_by(id=user_id).first()
            
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Generate temporary password
            import secrets
            temp_password = secrets.token_urlsafe(12)
            
            # Hash using the centralised auth helper (keeps bcrypt params consistent)
            from auth import hash_password
            user.password_hash = hash_password(temp_password)
            user.password_must_change = True
            
            # Log the action
            SecurityLogger.log_event(
                'admin_password_reset',
                user_id=g.current_user['id'],
                details={
                    'target_user_id': user_id,
                    'target_email': user.email
                }
            )
            
            # In production, send email with temp password
            # For now, return it in response (admin must communicate it)
            
            return jsonify({
                'success': True,
                'message': 'Password reset successfully',
                'temporary_password': temp_password,
                'note': 'User must change password on next login'
            }), 200
            
    except Exception as e:
        logger.error(f"Error resetting password: {e}", exc_info=True)
        return jsonify({'error': 'Failed to reset password'}), 500


@admin_bp.route('/quick-actions/bulk-operations', methods=['POST'])
@auth_required
@admin_only
def bulk_operations():
    """Perform bulk operations on multiple users"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        data = request.get_json()
        user_ids = data.get('user_ids', [])
        action = data.get('action')
        
        if not user_ids or not action:
            return jsonify({'error': 'user_ids and action are required'}), 400
        
        if len(user_ids) > 100:
            return jsonify({'error': 'Maximum 100 users per bulk operation'}), 400
        
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            results = []
            
            for user_id in user_ids:
                try:
                    user = db_session.query(User).filter_by(id=user_id).first()
                    if not user:
                        results.append({'user_id': user_id, 'success': False, 'error': 'User not found'})
                        continue
                    
                    if action == 'suspend':
                        user.is_active = False
                        results.append({'user_id': user_id, 'success': True})
                    elif action == 'activate':
                        user.is_active = True
                        results.append({'user_id': user_id, 'success': True})
                    else:
                        results.append({'user_id': user_id, 'success': False, 'error': 'Invalid action'})
                        
                except Exception as e:
                    results.append({'user_id': user_id, 'success': False, 'error': str(e)})
            
            # Log bulk action
            successful = sum(1 for r in results if r['success'])
            SecurityLogger.log_event(
                'bulk_operation',
                user_id=g.current_user['id'],
                details={
                    'action': action,
                    'total_users': len(user_ids),
                    'successful': successful,
                    'failed': len(user_ids) - successful
                }
            )
            
            return jsonify({
                'success': True,
                'results': results,
                'summary': {
                    'total': len(user_ids),
                    'successful': successful,
                    'failed': len(user_ids) - successful
                }
            }), 200
            
    except Exception as e:
        logger.error(f"Error performing bulk operation: {e}", exc_info=True)
        return jsonify({'error': 'Failed to perform bulk operation'}), 500


# ==================== PHASE 2: ANALYTICS DASHBOARD ====================

@admin_bp.route('/analytics/user-growth', methods=['GET'])
@auth_required
@admin_only
def get_user_growth():
    """Get user growth data for charts"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from sqlalchemy import func, cast, Date
        
        period = request.args.get('period', 'daily')  # daily, weekly, monthly
        days = int(request.args.get('days', 30))
        
        with db_session_scope() as db_session:
            # Get user creation data grouped by date
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            
            if period == 'daily':
                growth_data = db_session.query(
                    cast(User.created_at, Date).label('date'),
                    func.count(User.id).label('count')
                ).filter(
                    User.created_at >= start_date
                ).group_by(
                    cast(User.created_at, Date)
                ).order_by('date').all()
            else:
                # For weekly/monthly, we'll aggregate daily data
                growth_data = db_session.query(
                    cast(User.created_at, Date).label('date'),
                    func.count(User.id).label('count')
                ).filter(
                    User.created_at >= start_date
                ).group_by(
                    cast(User.created_at, Date)
                ).order_by('date').all()
            
            # Calculate cumulative total
            cumulative = 0
            chart_data = []
            for date, count in growth_data:
                cumulative += count
                chart_data.append({
                    'date': date.isoformat() if hasattr(date, 'isoformat') else str(date),
                    'new_users': count,
                    'total_users': cumulative
                })
            
            return jsonify({
                'period': period,
                'days': days,
                'data': chart_data
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting user growth: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get user growth data'}), 500


@admin_bp.route('/analytics/revenue', methods=['GET'])
@auth_required
@admin_only
def get_revenue_analytics():
    """Get revenue analytics for dashboard"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from sqlalchemy import func, cast, Date
        
        days = int(request.args.get('days', 90))
        
        with db_session_scope() as db_session:
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=days)
            
            # Get active subscriptions with payment data
            active_subs = db_session.query(Subscription).filter(
                Subscription.status == SubscriptionStatus.ACTIVE
            ).all()
            
            # Calculate MRR (Monthly Recurring Revenue)
            mrr = sum(sub.last_payment_amount or 0 for sub in active_subs)
            
            # Get revenue by tier
            revenue_by_tier = {}
            for tier in SubscriptionTier:
                tier_subs = [sub for sub in active_subs if sub.tier == tier]
                revenue_by_tier[tier.value] = sum(sub.last_payment_amount or 0 for sub in tier_subs)
            
            # Get recent payments for trend
            payment_data = db_session.query(
                cast(Subscription.last_payment_date, Date).label('date'),
                func.sum(Subscription.last_payment_amount).label('amount')
            ).filter(
                Subscription.last_payment_date >= start_date
            ).group_by(
                cast(Subscription.last_payment_date, Date)
            ).order_by('date').all()
            
            revenue_trend = [
                {
                    'date': date.isoformat() if hasattr(date, 'isoformat') else str(date),
                    'amount': float(amount) if amount else 0
                }
                for date, amount in payment_data
            ]
            
            # Calculate churn rate (cancelled in last 30 days / total active 30 days ago)
            thirty_days_ago = end_date - timedelta(days=30)
            recent_cancellations = db_session.query(func.count(Subscription.id)).filter(
                Subscription.cancelled_at >= thirty_days_ago,
                Subscription.cancelled_at <= end_date
            ).scalar()
            
            total_active = len(active_subs)
            churn_rate = (recent_cancellations / total_active * 100) if total_active > 0 else 0
            
            return jsonify({
                'mrr': mrr,
                'total_active_subscriptions': total_active,
                'revenue_by_tier': revenue_by_tier,
                'revenue_trend': revenue_trend,
                'churn_rate': round(churn_rate, 2),
                'recent_cancellations': recent_cancellations
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting revenue analytics: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get revenue analytics'}), 500


@admin_bp.route('/analytics/subscription-distribution', methods=['GET'])
@auth_required
@admin_only
def get_subscription_distribution():
    """Get subscription tier distribution for pie chart"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from sqlalchemy import func
        
        with db_session_scope() as db_session:
            # Get active subscriptions by tier
            distribution = db_session.query(
                Subscription.tier,
                func.count(Subscription.id).label('count')
            ).filter(
                Subscription.status == SubscriptionStatus.ACTIVE
            ).group_by(Subscription.tier).all()
            
            total = sum(count for _, count in distribution)
            
            chart_data = [
                {
                    'tier': tier.value,
                    'count': count,
                    'percentage': round(count / total * 100, 1) if total > 0 else 0
                }
                for tier, count in distribution
            ]
            
            return jsonify({
                'distribution': chart_data,
                'total_active': total
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting subscription distribution: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get subscription distribution'}), 500


# ==================== PHASE 2: SYSTEM HEALTH MONITORING ====================

@admin_bp.route('/health/database', methods=['GET'])
@auth_required
@admin_only
def check_database_health():
    """Check database connection health"""
    if not DB_ENABLED:
        return jsonify({'status': 'disabled', 'message': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        import time
        
        start_time = time.time()
        
        with db_session_scope() as db_session:
            # Simple query to test connection
            result = db_session.execute('SELECT 1').scalar()
            
        response_time = (time.time() - start_time) * 1000  # Convert to ms
        
        return jsonify({
            'status': 'healthy' if result == 1 else 'unhealthy',
            'response_time_ms': round(response_time, 2),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 200
        
    except Exception as e:
        logger.error(f"Database health check failed: {e}", exc_info=True)
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@admin_bp.route('/health/storage', methods=['GET'])
@auth_required
@admin_only
def check_storage_health():
    """Check storage usage"""
    try:
        import shutil
        import os
        
        # Check media directory
        media_dir = os.getenv('MEDIA_DIR', '/home/runner/work/MastaBlasta/MastaBlasta/media')
        
        if os.path.exists(media_dir):
            total, used, free = shutil.disk_usage(media_dir)
            
            return jsonify({
                'status': 'healthy',
                'total_gb': round(total / (1024**3), 2),
                'used_gb': round(used / (1024**3), 2),
                'free_gb': round(free / (1024**3), 2),
                'usage_percent': round(used / total * 100, 1),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 200
        else:
            return jsonify({
                'status': 'warning',
                'message': 'Media directory not found',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 200
            
    except Exception as e:
        logger.error(f"Storage health check failed: {e}", exc_info=True)
        return jsonify({
            'status': 'error',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


@admin_bp.route('/health/system', methods=['GET'])
@auth_required
@admin_only
def get_system_health():
    """Get overall system health status"""
    try:
        health_status = {
            'database': {'status': 'unknown'},
            'storage': {'status': 'unknown'},
            'api': {'status': 'healthy'},  # If this endpoint works, API is healthy
            'timestamp': datetime.now(timezone.utc).isoformat()
        }
        
        # Check database
        try:
            if DB_ENABLED:
                from database import db_session_scope
                with db_session_scope() as db_session:
                    db_session.execute('SELECT 1')
                health_status['database'] = {'status': 'healthy'}
            else:
                health_status['database'] = {'status': 'disabled'}
        except Exception as e:
            health_status['database'] = {'status': 'unhealthy', 'error': str(e)}
        
        # Check storage
        try:
            import shutil
            import os
            media_dir = os.getenv('MEDIA_DIR', '/home/runner/work/MastaBlasta/MastaBlasta/media')
            if os.path.exists(media_dir):
                total, used, free = shutil.disk_usage(media_dir)
                usage_percent = round(used / total * 100, 1)
                health_status['storage'] = {
                    'status': 'healthy' if usage_percent < 80 else 'warning',
                    'usage_percent': usage_percent
                }
            else:
                health_status['storage'] = {'status': 'warning', 'message': 'Directory not found'}
        except Exception as e:
            health_status['storage'] = {'status': 'error', 'error': str(e)}
        
        # Determine overall status
        statuses = [h['status'] for h in health_status.values() if isinstance(h, dict) and 'status' in h]
        if 'unhealthy' in statuses or 'error' in statuses:
            overall = 'unhealthy'
        elif 'warning' in statuses:
            overall = 'warning'
        else:
            overall = 'healthy'
        
        health_status['overall'] = overall
        
        return jsonify(health_status), 200
        
    except Exception as e:
        logger.error(f"System health check failed: {e}", exc_info=True)
        return jsonify({
            'overall': 'error',
            'error': str(e),
            'timestamp': datetime.now(timezone.utc).isoformat()
        }), 500


# ==================== PHASE 3: REVENUE & BILLING DASHBOARD ====================

@admin_bp.route('/revenue/summary', methods=['GET'])
@auth_required
@admin_only
def get_revenue_summary():
    """Get comprehensive revenue summary"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        from sqlalchemy import func
        
        with db_session_scope() as db_session:
            # Get all active subscriptions
            active_subs = db_session.query(Subscription).filter(
                Subscription.status == SubscriptionStatus.ACTIVE
            ).all()
            
            # Calculate MRR
            mrr = sum(sub.last_payment_amount or 0 for sub in active_subs)
            
            # Calculate average revenue per user (ARPU)
            arpu = mrr / len(active_subs) if active_subs else 0
            
            # Estimate LTV (simple: ARPU * average customer lifetime in months)
            # Assuming average lifetime of 24 months for estimation
            estimated_ltv = arpu * 24
            
            # Get growth rate (compare to last month)
            last_month = datetime.now(timezone.utc) - timedelta(days=30)
            last_month_subs = db_session.query(Subscription).filter(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.created_at <= last_month
            ).all()
            
            last_month_mrr = sum(sub.last_payment_amount or 0 for sub in last_month_subs)
            growth_rate = ((mrr - last_month_mrr) / last_month_mrr * 100) if last_month_mrr > 0 else 0
            
            # Failed payments (subscriptions with no recent payment)
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            failed_payments = db_session.query(Subscription).filter(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.last_payment_date < thirty_days_ago
            ).all()
            
            return jsonify({
                'mrr': round(mrr, 2),
                'mrr_growth_rate': round(growth_rate, 2),
                'active_subscribers': len(active_subs),
                'arpu': round(arpu, 2),
                'estimated_ltv': round(estimated_ltv, 2),
                'failed_payments_count': len(failed_payments),
                'failed_payments_value': sum(sub.last_payment_amount or 0 for sub in failed_payments),
                'timestamp': datetime.now(timezone.utc).isoformat()
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting revenue summary: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get revenue summary'}), 500


@admin_bp.route('/revenue/failed-payments', methods=['GET'])
@auth_required
@admin_only
def get_failed_payments():
    """Get list of failed/overdue payments"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            
            # Find subscriptions with no recent payment but still active
            failed = db_session.query(Subscription).filter(
                Subscription.status == SubscriptionStatus.ACTIVE,
                Subscription.last_payment_date < thirty_days_ago
            ).all()
            
            failed_list = []
            for sub in failed:
                user = db_session.query(User).filter_by(id=sub.user_id).first()
                if user:
                    failed_list.append({
                        'user_id': user.id,
                        'user_email': user.email,
                        'user_name': user.full_name,
                        'subscription_id': sub.id,
                        'tier': sub.tier.value,
                        'amount': sub.last_payment_amount,
                        'last_payment_date': sub.last_payment_date.isoformat() if sub.last_payment_date else None,
                        'days_overdue': (datetime.now(timezone.utc) - sub.last_payment_date).days if sub.last_payment_date else None
                    })
            
            return jsonify({
                'failed_payments': failed_list,
                'total': len(failed_list),
                'total_value': sum(f['amount'] or 0 for f in failed_list)
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting failed payments: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get failed payments'}), 500


# ==================== PHASE 3: EMAIL NOTIFICATION SYSTEM ====================

@admin_bp.route('/email/templates', methods=['GET'])
@auth_required
@admin_only
def get_email_templates():
    """Get available email templates"""
    templates = [
        {
            'id': 'trial_ending',
            'name': 'Trial Ending Soon',
            'subject': 'Your trial ends in {days} days',
            'description': 'Reminder sent to users before trial expires',
            'variables': ['user_name', 'days', 'upgrade_link']
        },
        {
            'id': 'payment_failed',
            'name': 'Payment Failed',
            'subject': 'Payment Failed - Action Required',
            'description': 'Notification when payment fails',
            'variables': ['user_name', 'amount', 'retry_link']
        },
        {
            'id': 'feature_announcement',
            'name': 'Feature Announcement',
            'subject': 'New Feature: {feature_name}',
            'description': 'Announce new features to users',
            'variables': ['user_name', 'feature_name', 'feature_description']
        },
        {
            'id': 'maintenance_alert',
            'name': 'Maintenance Alert',
            'subject': 'Scheduled Maintenance',
            'description': 'Notify users about planned maintenance',
            'variables': ['user_name', 'start_time', 'duration', 'impact']
        }
    ]
    
    return jsonify({'templates': templates}), 200


@admin_bp.route('/email/send', methods=['POST'])
@auth_required
@admin_only
def send_email():
    """Send email to user(s)"""
    try:
        data = request.get_json()
        
        recipient_type = data.get('recipient_type', 'single')  # single, filtered, all
        user_ids = data.get('user_ids', [])
        template_id = data.get('template_id')
        subject = data.get('subject', '')
        body = data.get('body', '')
        variables = data.get('variables', {})
        
        if not subject or not body:
            return jsonify({'error': 'Subject and body are required'}), 400
        
        # In production, this would integrate with an email service (SendGrid, SES, etc.)
        # For now, we'll log the intent and return success
        
        logger.info(f"Email send requested by admin {g.current_user['id']}")
        logger.info(f"Recipient type: {recipient_type}, Users: {user_ids}")
        logger.info(f"Subject: {subject}")
        
        # Log the action
        SecurityLogger.log_event(
            'email_sent',
            user_id=g.current_user['id'],
            details={
                'recipient_type': recipient_type,
                'recipient_count': len(user_ids) if user_ids else 0,
                'template_id': template_id,
                'subject': subject
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Email queued for delivery',
            'note': 'Email service integration required for actual delivery',
            'recipients_count': len(user_ids) if user_ids else 1
        }), 200
        
    except Exception as e:
        logger.error(f"Error sending email: {e}", exc_info=True)
        return jsonify({'error': 'Failed to send email'}), 500


@admin_bp.route('/email/preview', methods=['POST'])
@auth_required
@admin_only
def preview_email():
    """Preview email with template variables"""
    try:
        data = request.get_json()
        
        template_id = data.get('template_id')
        variables = data.get('variables', {})
        
        # Simple template rendering (in production, use proper templating engine)
        subject = data.get('subject', '')
        body = data.get('body', '')
        
        # Replace variables
        for key, value in variables.items():
            subject = subject.replace(f'{{{key}}}', str(value))
            body = body.replace(f'{{{key}}}', str(value))
        
        return jsonify({
            'success': True,
            'preview': {
                'subject': subject,
                'body': body
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error previewing email: {e}", exc_info=True)
        return jsonify({'error': 'Failed to preview email'}), 500


# ==================== PHASE 4: CONTENT MODERATION ====================

@admin_bp.route('/moderation/posts', methods=['GET'])
@auth_required
@admin_only
def get_posts_for_moderation():
    """Get posts for content moderation"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        from database import db_session_scope
        
        search = request.args.get('search', '').strip()
        user_id = request.args.get('user_id', '').strip()
        platform = request.args.get('platform', '').strip()
        page = max(1, int(request.args.get('page', 1)))
        per_page = min(100, max(1, int(request.args.get('per_page', 50))))
        
        with db_session_scope() as db_session:
            query = db_session.query(Post)
            
            # Apply filters
            if search:
                query = query.filter(Post.content.ilike(f'%{search}%'))
            if user_id:
                query = query.filter(Post.user_id == user_id)
            
            # Get total count
            total = query.count()
            
            # Paginate
            posts = query.order_by(Post.created_at.desc()).limit(per_page).offset((page-1)*per_page).all()
            
            posts_data = []
            for post in posts:
                user = db_session.query(User).filter_by(id=post.user_id).first()
                posts_data.append({
                    'id': post.id,
                    'content': post.content[:200] + '...' if len(post.content) > 200 else post.content,
                    'full_content': post.content,
                    'user_id': post.user_id,
                    'user_email': user.email if user else 'Unknown',
                    'status': post.status.value if hasattr(post, 'status') else 'unknown',
                    'created_at': post.created_at.isoformat() if post.created_at else None,
                    'scheduled_time': post.scheduled_time.isoformat() if hasattr(post, 'scheduled_time') and post.scheduled_time else None
                })
            
            return jsonify({
                'posts': posts_data,
                'total': total,
                'page': page,
                'per_page': per_page,
                'total_pages': (total + per_page - 1) // per_page
            }), 200
            
    except Exception as e:
        logger.error(f"Error getting posts for moderation: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get posts'}), 500


@admin_bp.route('/moderation/posts/<post_id>/flag', methods=['POST'])
@auth_required
@admin_only
def flag_post(post_id):
    """Flag a post for review"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        data = request.get_json()
        reason = data.get('reason', 'No reason provided')
        
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            post = db_session.query(Post).filter_by(id=post_id).first()
            
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            # Log the flag action
            SecurityLogger.log_event(
                'post_flagged',
                user_id=g.current_user['id'],
                details={
                    'post_id': post_id,
                    'reason': reason,
                    'content_preview': post.content[:100]
                }
            )
            
            return jsonify({
                'success': True,
                'message': 'Post flagged for review',
                'post_id': post_id
            }), 200
            
    except Exception as e:
        logger.error(f"Error flagging post: {e}", exc_info=True)
        return jsonify({'error': 'Failed to flag post'}), 500


@admin_bp.route('/moderation/posts/<post_id>', methods=['DELETE'])
@auth_required
@admin_only
def delete_post(post_id):
    """Delete a post (content moderation)"""
    if not DB_ENABLED:
        return jsonify({'error': 'Database not enabled'}), 503
    
    try:
        data = request.get_json() or {}
        reason = data.get('reason', 'Violated content policy')
        
        from database import db_session_scope
        
        with db_session_scope() as db_session:
            post = db_session.query(Post).filter_by(id=post_id).first()
            
            if not post:
                return jsonify({'error': 'Post not found'}), 404
            
            # Log before deletion
            SecurityLogger.log_event(
                'post_deleted',
                user_id=g.current_user['id'],
                details={
                    'post_id': post_id,
                    'post_user_id': post.user_id,
                    'reason': reason,
                    'content_preview': post.content[:100]
                }
            )
            
            # Delete the post
            db_session.delete(post)
            
            return jsonify({
                'success': True,
                'message': 'Post deleted successfully',
                'post_id': post_id
            }), 200
            
    except Exception as e:
        logger.error(f"Error deleting post: {e}", exc_info=True)
        return jsonify({'error': 'Failed to delete post'}), 500


# ==================== PHASE 4: API KEYS & WEBHOOK MANAGEMENT ====================

@admin_bp.route('/api-management/keys', methods=['GET'])
@auth_required
@admin_only
def get_api_keys():
    """Get API keys for all users"""
    # Note: This is a placeholder. In production, you'd have an APIKey model
    # For now, returning structure showing what data would be available
    
    sample_keys = [
        {
            'id': 'key_1',
            'user_id': 'user_123',
            'user_email': 'user@example.com',
            'key_preview': 'sk_live_****abcd',
            'created_at': datetime.now(timezone.utc).isoformat(),
            'last_used': datetime.now(timezone.utc).isoformat(),
            'requests_count': 1250,
            'status': 'active'
        }
    ]
    
    return jsonify({
        'api_keys': sample_keys,
        'total': len(sample_keys),
        'note': 'API key management requires APIKey model implementation'
    }), 200


@admin_bp.route('/api-management/keys/<key_id>/revoke', methods=['POST'])
@auth_required
@admin_only
def revoke_api_key(key_id):
    """Revoke an API key"""
    try:
        data = request.get_json() or {}
        reason = data.get('reason', 'Security concern')
        
        # Log the revocation
        SecurityLogger.log_event(
            'api_key_revoked',
            user_id=g.current_user['id'],
            details={
                'key_id': key_id,
                'reason': reason
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'API key revoked successfully',
            'note': 'API key management requires APIKey model implementation'
        }), 200
        
    except Exception as e:
        logger.error(f"Error revoking API key: {e}", exc_info=True)
        return jsonify({'error': 'Failed to revoke API key'}), 500


@admin_bp.route('/api-management/webhooks', methods=['GET'])
@auth_required
@admin_only
def get_webhook_logs():
    """Get webhook delivery logs"""
    # Placeholder for webhook management
    # In production, this would query webhook delivery logs
    
    sample_logs = [
        {
            'id': 'log_1',
            'webhook_url': 'https://example.com/webhook',
            'event_type': 'user.created',
            'status': 'success',
            'response_code': 200,
            'delivered_at': datetime.now(timezone.utc).isoformat(),
            'retry_count': 0
        },
        {
            'id': 'log_2',
            'webhook_url': 'https://example.com/webhook',
            'event_type': 'subscription.updated',
            'status': 'failed',
            'response_code': 500,
            'delivered_at': datetime.now(timezone.utc).isoformat(),
            'retry_count': 3
        }
    ]
    
    return jsonify({
        'webhook_logs': sample_logs,
        'total': len(sample_logs),
        'note': 'Webhook management requires webhook delivery tracking implementation'
    }), 200


@admin_bp.route('/api-management/webhooks/<log_id>/retry', methods=['POST'])
@auth_required
@admin_only
def retry_webhook(log_id):
    """Retry a failed webhook delivery"""
    try:
        # Log the retry attempt
        SecurityLogger.log_event(
            'webhook_retry',
            user_id=g.current_user['id'],
            details={
                'log_id': log_id
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Webhook retry initiated',
            'note': 'Webhook management requires webhook delivery tracking implementation'
        }), 200
        
    except Exception as e:
        logger.error(f"Error retrying webhook: {e}", exc_info=True)
        return jsonify({'error': 'Failed to retry webhook'}), 500
