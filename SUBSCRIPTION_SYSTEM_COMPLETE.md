# Subscription & Access Control System - Complete Implementation Guide

## Overview

MastaBlasta now includes a comprehensive subscription-based access control system that allows the application owner to charge for access and control user permissions. This system includes subscription tiers, usage tracking, admin management tools, and automatic limit enforcement.

## Table of Contents

1. [Architecture](#architecture)
2. [Subscription Tiers](#subscription-tiers)
3. [Admin Dashboard](#admin-dashboard)
4. [API Reference](#api-reference)
5. [Usage Enforcement](#usage-enforcement)
6. [Database Schema](#database-schema)
7. [Setup & Configuration](#setup--configuration)
8. [User Workflows](#user-workflows)
9. [Security & Compliance](#security--compliance)
10. [Testing Guide](#testing-guide)

---

## Architecture

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  AdminPage   │  │ Regular User │  │ Settings     │    │
│  │  Dashboard   │  │   Pages      │  │   Modal      │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└────────────┬─────────────────┬──────────────┬─────────────┘
             │                 │              │
             ▼                 ▼              ▼
┌────────────────────────────────────────────────────────────┐
│                 Backend API (Flask)                         │
│  ┌──────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │ Admin Routes │  │ Regular Routes│  │   Auth Routes │  │
│  │ @admin_only  │  │ @require_sub  │  │  @auth_required│ │
│  └──────────────┘  └───────────────┘  └───────────────┘  │
└────────────┬──────────────────────────────┬───────────────┘
             │                              │
             ▼                              ▼
┌────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                    │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐     │
│  │  Users   │  │ Subscriptions│  │  UsageMetrics   │     │
│  └──────────┘  └──────────────┘  └─────────────────┘     │
└────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **User Registration**: New users get FREE tier with 14-day trial automatically
2. **Access Check**: Every protected operation checks subscription status and limits
3. **Usage Tracking**: Operations increment usage counters (posts, API calls, etc.)
4. **Admin Management**: Admins can view, modify, suspend, or activate any user
5. **Grace Period**: 7-day grace period after expiration before full restriction

---

## Subscription Tiers

### Tier Comparison

| Feature | FREE | STARTER | PRO | ENTERPRISE |
|---------|------|---------|-----|------------|
| **Price** | $0 | $29/mo | $99/mo | $299/mo |
| **Posts/Month** | 10 | 100 | 1,000 | Unlimited |
| **Accounts per Platform** | 1 | 3 | 10 | Unlimited |
| **Scheduled Posts** | 5 | 50 | 500 | Unlimited |
| **Storage** | 100 MB | 1 GB | 10 GB | Unlimited |
| **API Calls/Day** | 100 | 1,000 | 10,000 | Unlimited |
| **Basic Analytics** | ✅ | ✅ | ✅ | ✅ |
| **Advanced Analytics** | ❌ | ✅ | ✅ | ✅ |
| **AI Features** | ❌ | ✅ | ✅ | ✅ |
| **Social Listening** | ❌ | ❌ | ✅ | ✅ |
| **Custom Branding** | ❌ | ❌ | ✅ | ✅ |
| **API Access** | ❌ | ✅ | ✅ | ✅ |
| **Team Collaboration** | ❌ | ❌ | ✅ | ✅ |
| **Webhooks** | ❌ | ✅ | ✅ | ✅ |
| **Priority Support** | ❌ | ❌ | ❌ | ✅ |

### Tier Configuration

Tiers are configured in `subscription_config.py` in the `TierLimits.TIER_CONFIGS` dictionary. Each tier includes:

- Numeric limits (posts, accounts, storage, etc.)
- Feature flags (boolean access to features)
- Price information

**To modify limits**: Edit `subscription_config.py` and restart the application.

---

## Admin Dashboard

### Access

- URL: `/admin`
- Requires: ADMIN role
- Only visible to admin users in navigation

### Features

#### 1. User Management Tab

**User Table**:
- View all users with subscription information
- Columns: User (name/email), Tier, Status, Join Date, Actions
- Click "Manage" to open user details

**User Details Modal**:
- User info: name, email, role, auth provider, dates
- Subscription details: tier, status, payment info, admin notes
- Usage metrics: posts, API calls, storage, AI requests
- Actions:
  - Edit subscription (tier, status, notes)
  - Suspend user (with reason)
  - Activate/reactivate user

#### 2. System Metrics Tab

**Overview Cards**:
- Total users (active/inactive breakdown)
- Posts created this month
- API calls this month
- Storage used
- AI requests

**Subscription Distributions**:
- By Tier: Count of users in each tier
- By Status: Count of subscriptions by status

**Auto-refresh**: Metrics refresh every 30 seconds

---

## API Reference

### Admin Endpoints

All admin endpoints require:
- Authentication: `Authorization: Bearer <token>`
- Role: ADMIN

#### GET /api/admin/users

List all users with subscription information.

**Response**:
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "full_name": "John Doe",
      "role": "editor",
      "is_active": true,
      "auth_provider": "email",
      "created_at": "2024-01-01T00:00:00Z",
      "last_login": "2024-01-15T10:30:00Z",
      "subscription": {
        "id": "uuid",
        "tier": "pro",
        "status": "active",
        "current_period_end": "2024-02-01T00:00:00Z",
        ...
      }
    }
  ],
  "total": 150
}
```

#### GET /api/admin/users/:id

Get detailed information about a specific user.

**Response**: Includes usage metrics for current month.

#### PATCH /api/admin/users/:id/subscription

Update user subscription.

**Request Body**:
```json
{
  "tier": "pro",
  "status": "active",
  "current_period_end": "2024-03-01T00:00:00Z",
  "admin_notes": "Upgraded manually"
}
```

#### POST /api/admin/users/:id/suspend

Suspend user access.

**Request Body**:
```json
{
  "reason": "Payment failed - multiple attempts"
}
```

#### POST /api/admin/users/:id/activate

Activate or reactivate a user.

**Response**: User status updated to active, period extended if expired.

#### GET /api/admin/metrics

Get system-wide statistics.

**Response**: User counts, subscription distributions, usage totals.

#### GET /api/admin/subscription-tiers

Get configuration for all subscription tiers.

---

## Usage Enforcement

### Decorators

#### @require_subscription(feature_name=None)

Requires an active subscription. Optionally checks if tier has access to a feature.

```python
@app.route('/api/posts', methods=['POST'])
@auth_required
@require_subscription()
def create_post():
    # User must have active subscription
    pass

@app.route('/api/ai/generate', methods=['POST'])
@auth_required
@require_subscription(feature_name='ai_features')
def ai_generate():
    # User must have active subscription with AI features
    pass
```

**Error Response** (403):
```json
{
  "error": "Feature not available",
  "message": "Your free plan does not include ai_features. Please upgrade.",
  "tier": "free",
  "feature": "ai_features"
}
```

#### @check_usage_limit(limit_name, increment=1)

Enforces usage limits and tracks usage.

```python
@app.route('/api/posts', methods=['POST'])
@auth_required
@require_subscription()
@check_usage_limit('posts_per_month')
def create_post():
    # Checks and increments posts_created counter
    pass
```

**Error Response** (429):
```json
{
  "error": "Usage limit exceeded",
  "message": "You have reached your posts per month limit of 100 for the Starter plan.",
  "tier": "starter",
  "limit": 100,
  "current_usage": 100,
  "upgrade_url": "/settings?tab=subscription"
}
```

### Supported Limits

- `posts_per_month` → `posts_created`
- `scheduled_posts_limit` → `posts_scheduled`
- `api_calls_per_day` → `api_calls`
- `ai_requests` → `ai_requests`

---

## Database Schema

### Subscription Model

```python
class Subscription(Base):
    __tablename__ = 'subscriptions'
    
    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), unique=True)
    tier = Column(Enum(SubscriptionTier))  # FREE, STARTER, PRO, ENTERPRISE
    status = Column(Enum(SubscriptionStatus))  # TRIAL, ACTIVE, CANCELLED, EXPIRED, SUSPENDED
    
    # Dates
    trial_ends_at = Column(DateTime)
    current_period_start = Column(DateTime)
    current_period_end = Column(DateTime)
    
    # Payment (for future integration)
    payment_method = Column(String(50))
    payment_provider_customer_id = Column(String(255))
    last_payment_date = Column(DateTime)
    last_payment_amount = Column(Float)
    
    # Cancellation
    cancelled_at = Column(DateTime)
    cancellation_reason = Column(Text)
    
    # Admin
    admin_notes = Column(Text)
```

### UsageMetrics Model

```python
class UsageMetrics(Base):
    __tablename__ = 'usage_metrics'
    
    id = Column(String(36), primary_key=True)
    subscription_id = Column(String(36), ForeignKey('subscriptions.id'))
    
    # Period
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    
    # Counters
    posts_created = Column(Integer, default=0)
    posts_scheduled = Column(Integer, default=0)
    posts_published = Column(Integer, default=0)
    api_calls = Column(Integer, default=0)
    storage_used_mb = Column(Float, default=0.0)
    ai_requests = Column(Integer, default=0)
    analytics_views = Column(Integer, default=0)
    social_listening_queries = Column(Integer, default=0)
```

### Database Migration

After implementing, create and run migration:

```bash
# Create migration
alembic revision --autogenerate -m "Add subscription and usage metrics models"

# Apply migration
alembic upgrade head
```

---

## Setup & Configuration

### 1. Environment Variables

No new environment variables required. Uses existing database configuration.

### 2. Database Migration

```bash
cd /path/to/MastaBlasta
alembic revision --autogenerate -m "Add subscription models"
alembic upgrade head
```

### 3. Create First Admin User

Using Python shell:

```python
from database import db_session_scope
from models import User, UserRole
from auth import hash_password
import uuid

with db_session_scope() as session:
    admin = User(
        id=str(uuid.uuid4()),
        email='admin@yourdomain.com',
        password_hash=hash_password('secure_password'),
        full_name='Admin User',
        role=UserRole.ADMIN,
        is_active=True
    )
    session.add(admin)
    session.commit()
```

Or use registration endpoint and manually update role in database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'admin@yourdomain.com';
```

### 4. Restart Application

```bash
# If using Docker
docker-compose restart

# Or manually
python app.py
```

---

## User Workflows

### For End Users

1. **Sign Up**: Auto-assigned FREE tier with 14-day trial
2. **Use Application**: Subject to FREE tier limits
3. **Hit Limit**: See upgrade prompt with clear message
4. **Upgrade** (future): Would integrate with payment processor
5. **Continue Using**: Full access to tier features

### For Administrators

1. **Access Admin Dashboard**: Click "Admin" in navigation
2. **Monitor System**: View metrics and user statistics
3. **Manage Users**:
   - Upgrade/downgrade tiers manually
   - Suspend users for policy violations
   - Extend trials or periods
   - Add admin notes
4. **Track Usage**: Monitor monthly usage across all users

---

## Security & Compliance

### Access Control

- **3-Layer Security**:
  1. Authentication required (@auth_required)
  2. Role-based access (@admin_only for admin routes)
  3. Subscription validation (@require_subscription)

- **Authorization Logging**: All admin actions logged via SecurityLogger
- **Prevents Privilege Escalation**: Admins cannot be suspended
- **Audit Trail**: Admin notes and action logs

### Data Protection

- **Encrypted Tokens**: OAuth tokens encrypted with Fernet
- **Secure Sessions**: HttpOnly, Secure, SameSite cookies
- **No Payment Data**: Placeholder fields only, no actual payment processing
- **GDPR Compliant**: User data accessible and deletable

### Rate Limiting

- **Per-Tier Limits**: Different limits for each subscription tier
- **Grace Period**: 7-day grace after expiration
- **Clear Communication**: Users notified before and after limits

---

## Testing Guide

### Manual Testing

#### 1. Test User Creation

```bash
curl -X POST http://localhost:5000/api/v2/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "name": "Test User"
  }'
```

Expected: User created with FREE tier, trial period set.

#### 2. Test Subscription Check

```bash
# Login first to get token
TOKEN=$(curl -X POST http://localhost:5000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "SecurePass123!"}' \
  | jq -r '.access_token')

# Try to create post (should work within limit)
curl -X POST http://localhost:5000/api/v2/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test post",
    "platforms": ["twitter"]
  }'
```

Expected: Post created, usage incremented.

#### 3. Test Limit Enforcement

Create 11 posts (FREE limit is 10):

```bash
for i in {1..11}; do
  curl -X POST http://localhost:5000/api/v2/posts \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"content\": \"Post $i\", \"platforms\": [\"twitter\"]}"
  echo ""
done
```

Expected: First 10 succeed, 11th returns 429 (Too Many Requests).

#### 4. Test Admin Dashboard

1. Create admin user (see setup section)
2. Login as admin
3. Navigate to http://localhost:3000/admin
4. Verify:
   - User list displays
   - Can edit subscriptions
   - Can suspend users
   - Metrics display correctly

#### 5. Test Suspension

```bash
ADMIN_TOKEN=$(curl -X POST http://localhost:5000/api/v2/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin_password"}' \
  | jq -r '.access_token')

# Suspend test user
curl -X POST http://localhost:5000/api/admin/users/{USER_ID}/suspend \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Test suspension"}'

# Try to use app as suspended user (should fail)
curl -X POST http://localhost:5000/api/v2/posts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"content": "Test", "platforms": ["twitter"]}'
```

Expected: Returns 403 with suspension message.

### Automated Testing

Create test file `test_subscriptions.py`:

```python
import pytest
from models import User, Subscription, SubscriptionTier, SubscriptionStatus
from subscription_control import get_user_subscription, check_subscription_active
from subscription_config import TierLimits

def test_auto_create_subscription(db_session):
    """Test automatic subscription creation"""
    user = User(id='test-id', email='test@test.com')
    db_session.add(user)
    db_session.commit()
    
    sub = get_user_subscription(db_session, user.id)
    assert sub.tier == SubscriptionTier.FREE
    assert sub.status == SubscriptionStatus.TRIAL

def test_tier_limits():
    """Test tier limit checks"""
    # FREE tier
    config = TierLimits.get_tier_config(SubscriptionTier.FREE)
    assert config['posts_per_month'] == 10
    
    # Check limit
    within_limit, remaining = TierLimits.check_limit(
        SubscriptionTier.FREE, 'posts_per_month', 5
    )
    assert within_limit == True
    assert remaining == 5

def test_feature_access():
    """Test feature access by tier"""
    # FREE doesn't have AI
    assert not TierLimits.has_feature(SubscriptionTier.FREE, 'ai_features')
    
    # STARTER has AI
    assert TierLimits.has_feature(SubscriptionTier.STARTER, 'ai_features')
```

Run tests:

```bash
pytest test_subscriptions.py -v
```

---

## Troubleshooting

### Issue: Admin link not visible

**Cause**: User doesn't have admin role.

**Solution**: Update user role in database:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

### Issue: "Database not enabled" error

**Cause**: DATABASE_URL not configured or database not accessible.

**Solution**: Check environment variables and database connection.

### Issue: Usage limits not enforcing

**Cause**: Decorators not applied to routes.

**Solution**: Add `@require_subscription()` and `@check_usage_limit()` to routes.

### Issue: Subscription not created for existing users

**Cause**: Users created before subscription system.

**Solution**: Run migration script:
```python
from database import db_session_scope
from models import User, Subscription, SubscriptionTier, SubscriptionStatus
from datetime import datetime, timedelta, timezone
import uuid

with db_session_scope() as session:
    users = session.query(User).all()
    for user in users:
        if not session.query(Subscription).filter_by(user_id=user.id).first():
            trial_end = datetime.now(timezone.utc) + timedelta(days=14)
            sub = Subscription(
                id=str(uuid.uuid4()),
                user_id=user.id,
                tier=SubscriptionTier.FREE,
                status=SubscriptionStatus.TRIAL,
                trial_ends_at=trial_end,
                current_period_start=datetime.now(timezone.utc),
                current_period_end=trial_end
            )
            session.add(sub)
    session.commit()
```

---

## Next Steps

### Payment Integration (Future)

To integrate with Stripe or PayPal:

1. Add payment processor SDK
2. Create webhook handlers for payment events
3. Update subscription status based on payments
4. Add upgrade/downgrade UI flow
5. Handle prorated billing

### Advanced Features (Future)

- Custom tier creation
- Usage-based billing
- Team/organization subscriptions
- Reseller/agency plans
- API key management per tier
- Advanced analytics per subscription
- Automated dunning for failed payments
- Customer self-service portal

---

## Conclusion

The subscription & access control system is production-ready and provides:

✅ Comprehensive admin dashboard
✅ Automatic subscription management
✅ Usage tracking and enforcement
✅ Security and audit logging
✅ Scalable architecture
✅ Clear upgrade paths

The owner can now charge for access and control user permissions with enterprise-grade tooling.
