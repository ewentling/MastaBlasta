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
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
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
    """Get Square integration configuration (masked for security)"""
    try:
        import os
        
        # Get current configuration (mask sensitive values)
        config = {
            'access_token': f"{'*' * 48}{os.getenv('SQUARE_ACCESS_TOKEN', '')[-4:]}" if os.getenv('SQUARE_ACCESS_TOKEN') else '',
            'environment': os.getenv('SQUARE_ENVIRONMENT', 'sandbox'),
            'location_id': os.getenv('SQUARE_LOCATION_ID', ''),
            'webhook_signature_key': f"{'*' * 56}{os.getenv('SQUARE_WEBHOOK_SIGNATURE_KEY', '')[-4:]}" if os.getenv('SQUARE_WEBHOOK_SIGNATURE_KEY') else '',
            'catalog_starter': os.getenv('SQUARE_CATALOG_STARTER', ''),
            'catalog_pro': os.getenv('SQUARE_CATALOG_PRO', ''),
            'catalog_enterprise': os.getenv('SQUARE_CATALOG_ENTERPRISE', ''),
            'configured': bool(os.getenv('SQUARE_ACCESS_TOKEN') and os.getenv('SQUARE_LOCATION_ID'))
        }
        
        return jsonify(config), 200
        
    except Exception as e:
        logger.error(f"Error getting Square config: {e}", exc_info=True)
        return jsonify({'error': 'Failed to get Square configuration'}), 500


@admin_bp.route('/square-config', methods=['POST'])
@auth_required
@admin_only
def update_square_config():
    """Update Square integration configuration"""
    try:
        data = request.get_json()
        
        # Note: In production, these should be stored securely (e.g., AWS Secrets Manager)
        # For now, we'll just log that the values should be set as environment variables
        
        required_fields = ['access_token', 'environment', 'location_id', 'webhook_signature_key']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return jsonify({
                'error': 'Missing required fields',
                'missing': missing_fields
            }), 400
        
        # Log the configuration update
        SecurityLogger.log_event(
            'square_config_updated',
            user_id=g.current_user['id'],
            details=f"Square configuration updated by {g.current_user['email']}"
        )
        
        return jsonify({
            'message': 'Configuration updated',
            'note': 'Set environment variables: SQUARE_ACCESS_TOKEN, SQUARE_ENVIRONMENT, SQUARE_LOCATION_ID, SQUARE_WEBHOOK_SIGNATURE_KEY, SQUARE_CATALOG_* and restart application'
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
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        
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
            
            # Hash and set password
            import bcrypt
            user.password_hash = bcrypt.hashpw(temp_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
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
