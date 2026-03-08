"""
Database models for MastaBlasta social media management platform
"""
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, Float, JSON, Enum
from sqlalchemy.orm import declarative_base, relationship, validates
import enum

Base = declarative_base()


class UserRole(enum.Enum):
    """User roles for role-based access control"""
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


class PostStatus(enum.Enum):
    """Post status enumeration"""
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"  # Awaiting team approval
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class SubscriptionTier(enum.Enum):
    """Subscription tier levels"""
    STARTER = "starter"
    PRO = "pro"
    ENTERPRISE = "enterprise"


class SubscriptionStatus(enum.Enum):
    """Subscription status"""
    TRIAL = "trial"
    ACTIVE = "active"
    CANCELLED = "cancelled"
    EXPIRED = "expired"
    SUSPENDED = "suspended"


class User(Base):
    """User model for authentication and authorization"""
    __tablename__ = 'users'

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for Google-only users
    full_name = Column(String(255))
    password_must_change = Column(Boolean, default=False)  # Force password change on first login
    role = Column(Enum(UserRole), default=UserRole.EDITOR, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    api_key = Column(String(64), unique=True, index=True)
    auth_provider = Column(String(50), default='email')  # 'email' or 'google'
    google_id = Column(String(255), unique=True, index=True, nullable=True)  # Google's sub ID
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    last_login = Column(DateTime)

    # Relationships
    accounts = relationship("Account", back_populates="user", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan", foreign_keys="[Post.user_id]")
    media = relationship("Media", back_populates="user", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="user", cascade="all, delete-orphan")
    google_services = relationship("GoogleService", back_populates="user", cascade="all, delete-orphan")

    @validates('password_hash', 'google_id')
    def validate_auth_method(self, key, value):
        """Validate that user has at least one authentication method on INSERT only"""
        # This validator runs during INSERT, not during UPDATE
        # Check will happen after all fields are set
        return value
    
    def validate_user_auth(self):
        """Validate that at least one authentication method exists"""
        if not self.password_hash and not self.google_id:
            raise ValueError("User must have either password_hash or google_id")

    def __repr__(self):
        return f"<User {self.email} ({self.role.value})>"


class Account(Base):
    """Social media platform account model"""
    __tablename__ = 'accounts'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    platform = Column(String(50), nullable=False, index=True)
    platform_user_id = Column(String(255))
    platform_username = Column(String(255))
    display_name = Column(String(255))
    oauth_token = Column(Text)  # Encrypted
    refresh_token = Column(Text)  # Encrypted
    token_expires_at = Column(DateTime)
    oauth_app_config_id = Column(String(36), ForeignKey('oauth_app_configs.id'), nullable=True)  # Reference to OAuth app used
    is_active = Column(Boolean, default=True, nullable=False)
    platform_metadata = Column(JSON)  # Platform-specific data
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="accounts")
    posts = relationship("Post", secondary="post_accounts", back_populates="accounts")
    oauth_app_config = relationship("OAuthAppConfig")

    def __repr__(self):
        return f"<Account {self.platform}:{self.platform_username}>"


class ConnectionAuditLog(Base):
    """Audit log for OAuth connection events"""
    __tablename__ = 'connection_audit_logs'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    platform = Column(String(50), nullable=False)
    account_id = Column(String(36), ForeignKey('accounts.id'), nullable=True)
    action = Column(String(50), nullable=False)  # 'connect', 'disconnect', 'refresh', 'scope_update'
    scopes = Column(JSON, nullable=True)  # List of scopes granted/requested
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    status = Column(String(20), nullable=False)  # 'success', 'failed'
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    user = relationship("User")
    account = relationship("Account")

    def __repr__(self):
        return f"<ConnectionAuditLog {self.action} on {self.platform} ({self.status})>"


class Post(Base):
    """Post model"""
    __tablename__ = 'posts'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=True, index=True)  # Optional workspace
    campaign_id = Column(String(36), ForeignKey('campaigns.id'), nullable=True, index=True)  # Optional campaign
    content = Column(Text, nullable=False)
    post_type = Column(String(50))  # standard, thread, reel, story, etc.
    status = Column(Enum(PostStatus), default=PostStatus.DRAFT, nullable=False, index=True)
    scheduled_time = Column(DateTime, index=True)
    published_at = Column(DateTime)
    post_options = Column(JSON)  # Platform-specific options
    parallel_execution = Column(Boolean, default=True)
    tags = Column(JSON)  # List of tag strings for organization
    is_evergreen = Column(Boolean, default=False)  # Mark as recyclable/evergreen content
    recycle_count = Column(Integer, default=0)  # Number of times this post has been recycled
    last_recycled_at = Column(DateTime, nullable=True)  # Last recycle time
    approval_status = Column(String(50), nullable=True)  # 'approved', 'rejected', or null
    approved_by = Column(String(36), ForeignKey('users.id'), nullable=True)  # User who reviewed (approved/rejected)
    approved_at = Column(DateTime, nullable=True)  # When the review decision was made
    rejection_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="posts", foreign_keys=[user_id])
    approver = relationship("User", foreign_keys=[approved_by])
    workspace = relationship("Workspace", back_populates="posts")
    campaign = relationship("Campaign", back_populates="posts")
    accounts = relationship("Account", secondary="post_accounts", back_populates="posts")
    media = relationship("Media", secondary="post_media", back_populates="posts")
    analytics = relationship("PostAnalytics", back_populates="post", cascade="all, delete-orphan")
    comments = relationship("PostComment", back_populates="post", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Post {self.id} ({self.status.value})>"


class PostAccount(Base):
    """Association table for posts and accounts (many-to-many)"""
    __tablename__ = 'post_accounts'

    post_id = Column(String(36), ForeignKey('posts.id'), primary_key=True)
    account_id = Column(String(36), ForeignKey('accounts.id'), primary_key=True)
    platform_post_id = Column(String(255))  # ID returned by platform API
    error_message = Column(Text)
    published_at = Column(DateTime)


class Media(Base):
    """Media file model"""
    __tablename__ = 'media'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255))
    file_path = Column(String(512), nullable=False)
    thumbnail_path = Column(String(512))
    mime_type = Column(String(100), nullable=False)
    file_size = Column(Integer, nullable=False)  # in bytes
    width = Column(Integer)
    height = Column(Integer)
    duration = Column(Float)  # for videos, in seconds
    file_metadata = Column(JSON)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="media")
    posts = relationship("Post", secondary="post_media", back_populates="media")

    def __repr__(self):
        return f"<Media {self.filename}>"


class PostMedia(Base):
    """Association table for posts and media (many-to-many)"""
    __tablename__ = 'post_media'

    post_id = Column(String(36), ForeignKey('posts.id'), primary_key=True)
    media_id = Column(String(36), ForeignKey('media.id'), primary_key=True)
    order = Column(Integer, default=0)  # Order in carousel/album


class PostAnalytics(Base):
    """Post analytics and performance metrics"""
    __tablename__ = 'post_analytics'

    id = Column(String(36), primary_key=True)
    post_id = Column(String(36), ForeignKey('posts.id'), nullable=False, index=True)
    platform = Column(String(50), nullable=False)
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments = Column(Integer, default=0)
    reach = Column(Integer, default=0)
    engagement_rate = Column(Float, default=0.0)
    click_through_rate = Column(Float, default=0.0)
    raw_data = Column(JSON)  # Full platform response
    collected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    post = relationship("Post", back_populates="analytics")

    def __repr__(self):
        return f"<Analytics {self.post_id}:{self.platform}>"


class Template(Base):
    """Post template model"""
    __tablename__ = 'templates'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    category = Column(String(100))
    variables = Column(JSON)  # List of variable placeholders
    platforms = Column(JSON)  # Supported platforms
    is_shared = Column(Boolean, default=False)  # Shared with team
    use_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="templates")

    def __repr__(self):
        return f"<Template {self.name}>"


class ABTest(Base):
    """A/B testing experiment model"""
    __tablename__ = 'ab_tests'

    id = Column(String(36), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="active")  # active, paused, completed
    variant_a_content = Column(Text, nullable=False)
    variant_b_content = Column(Text, nullable=False)
    variant_a_post_id = Column(String(36), ForeignKey('posts.id'))
    variant_b_post_id = Column(String(36), ForeignKey('posts.id'))
    platforms = Column(JSON)
    metrics = Column(JSON)  # Target metrics to compare
    results = Column(JSON)  # Test results and winner
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def __repr__(self):
        return f"<ABTest {self.name} ({self.status})>"


class SocialMonitor(Base):
    """Social listening monitor model"""
    __tablename__ = 'social_monitors'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    keywords = Column(JSON, nullable=False)  # List of keywords/hashtags
    platforms = Column(JSON, nullable=False)  # Platforms to monitor
    is_active = Column(Boolean, default=True)
    notification_email = Column(String(255))
    filters = Column(JSON)  # Additional filters (language, location, etc.)
    last_check = Column(DateTime)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    results = relationship("MonitorResult", back_populates="monitor", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<SocialMonitor {self.name}>"


class MonitorResult(Base):
    """Results from social listening monitors"""
    __tablename__ = 'monitor_results'

    id = Column(String(36), primary_key=True)
    monitor_id = Column(String(36), ForeignKey('social_monitors.id'), nullable=False, index=True)
    platform = Column(String(50), nullable=False)
    content = Column(Text, nullable=False)
    author = Column(String(255))
    author_url = Column(String(512))
    post_url = Column(String(512))
    engagement = Column(JSON)  # likes, shares, comments
    sentiment = Column(String(50))  # positive, neutral, negative
    matched_keywords = Column(JSON)
    discovered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    monitor = relationship("SocialMonitor", back_populates="results")

    def __repr__(self):
        return f"<MonitorResult {self.monitor_id}:{self.platform}>"


class URLShortener(Base):
    """URL shortening and tracking model"""
    __tablename__ = 'url_shortener'

    id = Column(String(36), primary_key=True)
    short_code = Column(String(20), unique=True, nullable=False, index=True)
    original_url = Column(Text, nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), index=True)
    post_id = Column(String(36), ForeignKey('posts.id'))
    clicks = Column(Integer, default=0)
    url_metadata = Column(JSON)  # UTM parameters, etc.
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    expires_at = Column(DateTime)

    # Relationships
    user = relationship("User")
    click_events = relationship("URLClick", back_populates="url", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<URLShortener {self.short_code}>"


class URLClick(Base):
    """URL click tracking model"""
    __tablename__ = 'url_clicks'

    id = Column(String(36), primary_key=True)
    url_id = Column(String(36), ForeignKey('url_shortener.id'), nullable=False, index=True)
    clicked_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    ip_address = Column(String(45))  # IPv6 support
    user_agent = Column(Text)
    referrer = Column(Text)
    country = Column(String(2))
    city = Column(String(100))
    device_type = Column(String(50))  # mobile, desktop, tablet

    # Relationships
    url = relationship("URLShortener", back_populates="click_events")

    def __repr__(self):
        return f"<URLClick {self.url_id}>"


class ResponseTemplate(Base):
    """Automated response template model"""
    __tablename__ = 'response_templates'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    trigger_keywords = Column(JSON)  # Keywords that trigger this response
    response_text = Column(Text, nullable=False)
    platforms = Column(JSON)  # Applicable platforms
    is_active = Column(Boolean, default=True)
    use_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<ResponseTemplate {self.name}>"


class ChatbotInteraction(Base):
    """Chatbot conversation history model"""
    __tablename__ = 'chatbot_interactions'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    platform = Column(String(50), nullable=False)
    platform_user_id = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    response = Column(Text)
    response_template_id = Column(String(36), ForeignKey('response_templates.id'))
    sentiment = Column(String(50))
    is_automated = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    # Relationships
    user = relationship("User")
    template = relationship("ResponseTemplate")

    def __repr__(self):
        return f"<ChatbotInteraction {self.platform}:{self.platform_user_id}>"


class GoogleService(Base):
    """Google service connections (Calendar, Drive, YouTube) for users"""
    __tablename__ = 'google_services'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    service_type = Column(String(50), nullable=False)  # 'calendar', 'drive', 'youtube'
    access_token = Column(Text)  # Encrypted with Fernet
    refresh_token = Column(Text)  # Encrypted with Fernet
    token_expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    service_metadata = Column(JSON)  # e.g., {'calendar_id': 'primary'}
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="google_services")

    def __repr__(self):
        return f"<GoogleService {self.service_type} for user {self.user_id}>"


class OAuthAppConfig(Base):
    """User's OAuth application credentials for social platforms"""
    __tablename__ = 'oauth_app_configs'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    platform = Column(String(50), nullable=False, index=True)  # 'twitter', 'meta', 'linkedin', 'google'
    app_name = Column(String(255))  # Friendly name like "My Twitter App"
    client_id = Column(Text, nullable=False)  # Encrypted with Fernet
    client_secret = Column(Text, nullable=False)  # Encrypted with Fernet
    redirect_uri = Column(String(512))  # Platform-specific redirect URI
    additional_config = Column(JSON)  # Platform-specific additional configuration
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<OAuthAppConfig {self.platform} for user {self.user_id}>"


class Subscription(Base):
    """User subscription model for access control and billing"""
    __tablename__ = 'subscriptions'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, unique=True, index=True)
    tier = Column(Enum(SubscriptionTier), default=SubscriptionTier.STARTER, nullable=False)
    status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.TRIAL, nullable=False)
    
    # Trial and billing periods (no trials in Square model - pending payment)
    trial_ends_at = Column(DateTime, nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    
    # Square payment integration
    payment_method = Column(String(50), default='square', nullable=False)  # Always 'square'
    square_subscription_id = Column(String(255), nullable=True, unique=True, index=True)  # Square subscription ID
    square_customer_id = Column(String(255), nullable=True, index=True)  # Square customer ID
    payment_provider_customer_id = Column(String(255), nullable=True)  # Backward compatibility
    last_payment_date = Column(DateTime, nullable=True)
    last_payment_amount = Column(Float, nullable=True)
    
    # Cancellation
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    
    # Admin notes
    admin_notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", backref="subscription")
    usage_metrics = relationship("UsageMetrics", back_populates="subscription", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Subscription {self.tier.value}/{self.status.value} for user {self.user_id}>"

    def is_active(self):
        """Check if subscription is currently active"""
        return self.status in [SubscriptionStatus.TRIAL, SubscriptionStatus.ACTIVE]
    
    def is_expired(self):
        """Check if subscription has expired"""
        if self.status == SubscriptionStatus.EXPIRED:
            return True
        if self.current_period_end and datetime.now(timezone.utc) > self.current_period_end:
            return True
        if self.status == SubscriptionStatus.TRIAL and self.trial_ends_at and datetime.now(timezone.utc) > self.trial_ends_at:
            return True
        return False


class UsageMetrics(Base):
    """Track user usage for subscription enforcement"""
    __tablename__ = 'usage_metrics'

    id = Column(String(36), primary_key=True)
    subscription_id = Column(String(36), ForeignKey('subscriptions.id'), nullable=False, index=True)
    
    # Time period for these metrics
    period_start = Column(DateTime, nullable=False, index=True)
    period_end = Column(DateTime, nullable=False)
    
    # Usage counters
    posts_created = Column(Integer, default=0, nullable=False)
    posts_scheduled = Column(Integer, default=0, nullable=False)
    posts_published = Column(Integer, default=0, nullable=False)
    api_calls = Column(Integer, default=0, nullable=False)
    storage_used_mb = Column(Float, default=0.0, nullable=False)
    
    # Feature usage
    ai_requests = Column(Integer, default=0, nullable=False)
    analytics_views = Column(Integer, default=0, nullable=False)
    social_listening_queries = Column(Integer, default=0, nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    subscription = relationship("Subscription", back_populates="usage_metrics")

    def __repr__(self):
        return f"<UsageMetrics {self.period_start} - {self.period_end} for subscription {self.subscription_id}>"


class Webhook(Base):
    """Persisted webhook registrations for event notifications"""
    __tablename__ = 'webhooks'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    url = Column(String(2048), nullable=False)
    events = Column(JSON, nullable=False)  # List[str] of event names
    secret = Column(Text, nullable=True)   # HMAC signing secret (optional)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<Webhook {self.id} url={self.url} user={self.user_id}>"


class Workspace(Base):
    """Workspace for multi-tenant management (agencies, teams, brands)"""
    __tablename__ = 'workspaces'

    id = Column(String(36), primary_key=True)
    owner_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    logo_url = Column(String(512), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    settings = Column(JSON, nullable=True)  # Workspace-specific settings
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    owner = relationship("User", backref="owned_workspaces")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    posts = relationship("Post", back_populates="workspace")
    campaigns = relationship("Campaign", back_populates="workspace")

    def __repr__(self):
        return f"<Workspace {self.name}>"


class WorkspaceMember(Base):
    """Workspace membership with role-based access"""
    __tablename__ = 'workspace_members'

    id = Column(String(36), primary_key=True)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    role = Column(String(50), default='member', nullable=False)  # 'admin', 'editor', 'member', 'viewer'
    can_approve = Column(Boolean, default=False)  # Can approve posts
    can_publish = Column(Boolean, default=True)  # Can publish posts
    invited_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    joined_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", foreign_keys=[user_id], backref="workspace_memberships")
    inviter = relationship("User", foreign_keys=[invited_by])

    def __repr__(self):
        return f"<WorkspaceMember {self.user_id} in {self.workspace_id} ({self.role})>"


class Campaign(Base):
    """Campaign for grouping related posts together"""
    __tablename__ = 'campaigns'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    workspace_id = Column(String(36), ForeignKey('workspaces.id'), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default='active')  # 'draft', 'active', 'paused', 'completed'
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    goals = Column(JSON, nullable=True)  # Campaign goals/KPIs
    tags = Column(JSON, nullable=True)  # Campaign tags
    color = Column(String(7), nullable=True)  # Hex color for visual identification
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User")
    workspace = relationship("Workspace", back_populates="campaigns")
    posts = relationship("Post", back_populates="campaign")

    def __repr__(self):
        return f"<Campaign {self.name} ({self.status})>"


class PostComment(Base):
    """Team comments on posts for collaboration"""
    __tablename__ = 'post_comments'

    id = Column(String(36), primary_key=True)
    post_id = Column(String(36), ForeignKey('posts.id'), nullable=False, index=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    content = Column(Text, nullable=False)
    is_resolved = Column(Boolean, default=False)  # Mark comment as resolved
    parent_id = Column(String(36), ForeignKey('post_comments.id'), nullable=True)  # For threaded comments
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    post = relationship("Post", back_populates="comments")
    user = relationship("User")
    replies = relationship("PostComment", backref="parent", remote_side="PostComment.id")

    def __repr__(self):
        return f"<PostComment {self.id} on post {self.post_id}>"


class AutoEngagement(Base):
    """Auto-engagement rules for milestone-based actions"""
    __tablename__ = 'auto_engagements'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Trigger conditions (milestones)
    trigger_type = Column(String(50), nullable=False)  # 'likes', 'comments', 'views', 'shares'
    trigger_threshold = Column(Integer, nullable=False)  # e.g., 100 likes
    trigger_platform = Column(String(50), nullable=True)  # Platform filter, null = all platforms
    
    # Action to perform
    action_type = Column(String(50), nullable=False)  # 'like', 'comment', 'repost', 'notify'
    action_content = Column(Text, nullable=True)  # Comment text if action is 'comment'
    action_options = Column(JSON, nullable=True)  # Additional action configuration
    
    # Statistics
    times_triggered = Column(Integer, default=0)
    last_triggered_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<AutoEngagement {self.name} ({self.trigger_type} >= {self.trigger_threshold})>"


class ContentRecycleSchedule(Base):
    """Schedule for recycling evergreen content"""
    __tablename__ = 'content_recycle_schedules'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    post_id = Column(String(36), ForeignKey('posts.id'), nullable=False, index=True)
    
    # Recycle schedule
    recycle_interval_days = Column(Integer, default=30)  # Days between recycles
    next_recycle_at = Column(DateTime, nullable=True, index=True)
    max_recycles = Column(Integer, default=0)  # 0 = unlimited
    current_recycle_count = Column(Integer, default=0)
    
    # Recycle options
    modify_content = Column(Boolean, default=True)  # Modify content before reposting
    modification_type = Column(String(50), default='ai_rewrite')  # 'ai_rewrite', 'shuffle', 'none'
    target_platforms = Column(JSON, nullable=True)  # Platforms to recycle to
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User")
    post = relationship("Post")

    def __repr__(self):
        return f"<ContentRecycleSchedule for post {self.post_id}>"


class SmartQueueSlot(Base):
    """Time slots for smart queue posting"""
    __tablename__ = 'smart_queue_slots'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    
    # Schedule configuration
    day_of_week = Column(Integer, nullable=False)  # 0=Monday, 6=Sunday
    time_slot = Column(String(5), nullable=False)  # HH:MM format
    platform = Column(String(50), nullable=True)  # null = all platforms
    timezone = Column(String(50), default='UTC')
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")

    def __repr__(self):
        return f"<SmartQueueSlot day={self.day_of_week} time={self.time_slot}>"


class SmartQueueItem(Base):
    """Items in the smart queue waiting to be posted"""
    __tablename__ = 'smart_queue_items'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    
    content = Column(Text, nullable=False)
    media_urls = Column(JSON, nullable=True)  # List of media URLs
    platforms = Column(JSON, nullable=False)  # Target platforms
    post_type = Column(String(50), default='standard')
    
    # Queue position
    position = Column(Integer, nullable=False, index=True)
    assigned_slot_id = Column(String(36), ForeignKey('smart_queue_slots.id'), nullable=True)
    scheduled_time = Column(DateTime, nullable=True)
    
    status = Column(String(20), default='queued')  # queued, scheduled, posted, failed
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    slot = relationship("SmartQueueSlot")

    def __repr__(self):
        return f"<SmartQueueItem position={self.position} status={self.status}>"


class LinkInBioPage(Base):
    """Link-in-bio landing page"""
    __tablename__ = 'link_in_bio_pages'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    
    # Page settings
    slug = Column(String(100), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False)
    bio = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    theme = Column(String(50), default='default')  # default, dark, gradient, minimal
    background_color = Column(String(7), default='#1a1a2e')
    button_style = Column(String(50), default='rounded')  # rounded, pill, square
    
    # Social links
    social_links = Column(JSON, nullable=True)  # {platform: url}
    
    # Analytics
    total_views = Column(Integer, default=0)
    total_clicks = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User")
    links = relationship("LinkInBioLink", back_populates="page", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<LinkInBioPage {self.slug}>"


class LinkInBioLink(Base):
    """Individual link on a link-in-bio page"""
    __tablename__ = 'link_in_bio_links'

    id = Column(String(36), primary_key=True)
    page_id = Column(String(36), ForeignKey('link_in_bio_pages.id'), nullable=False, index=True)
    
    title = Column(String(255), nullable=False)
    url = Column(String(1000), nullable=False)
    icon = Column(String(50), nullable=True)  # Icon name or emoji
    thumbnail_url = Column(String(500), nullable=True)
    
    position = Column(Integer, nullable=False)
    click_count = Column(Integer, default=0)
    
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    page = relationship("LinkInBioPage", back_populates="links")

    def __repr__(self):
        return f"<LinkInBioLink {self.title}>"


class UnifiedInboxItem(Base):
    """Unified inbox for comments, DMs, and mentions across platforms"""
    __tablename__ = 'unified_inbox_items'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, index=True)
    account_id = Column(String(36), ForeignKey('accounts.id'), nullable=False, index=True)
    
    # Item type
    item_type = Column(String(20), nullable=False)  # comment, dm, mention, reply
    platform = Column(String(50), nullable=False)
    platform_item_id = Column(String(255), nullable=True)  # ID from the platform
    
    # Content
    content = Column(Text, nullable=True)
    author_name = Column(String(255), nullable=True)
    author_username = Column(String(255), nullable=True)
    author_avatar = Column(String(500), nullable=True)
    
    # Related post (for comments/replies)
    related_post_id = Column(String(36), ForeignKey('posts.id'), nullable=True)
    platform_post_id = Column(String(255), nullable=True)
    
    # Status
    is_read = Column(Boolean, default=False, nullable=False)
    is_archived = Column(Boolean, default=False, nullable=False)
    is_replied = Column(Boolean, default=False, nullable=False)
    sentiment = Column(String(20), nullable=True)  # positive, negative, neutral
    
    received_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    user = relationship("User")
    account = relationship("Account")
    post = relationship("Post")

    def __repr__(self):
        return f"<UnifiedInboxItem {self.item_type} from {self.platform}>"


class TrendingKeyword(Base):
    """Cached trending keywords/hashtags by platform"""
    __tablename__ = 'trending_keywords'

    id = Column(String(36), primary_key=True)
    platform = Column(String(50), nullable=False, index=True)
    keyword = Column(String(255), nullable=False)
    hashtag = Column(String(255), nullable=True)
    
    # Trend data
    trend_volume = Column(Integer, nullable=True)  # Number of posts/mentions
    trend_rank = Column(Integer, nullable=True)
    category = Column(String(100), nullable=True)
    location = Column(String(100), default='worldwide')
    
    # Cache timestamp
    fetched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    expires_at = Column(DateTime, nullable=False)

    def __repr__(self):
        return f"<TrendingKeyword {self.keyword} on {self.platform}>"
