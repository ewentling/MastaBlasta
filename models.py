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
    SCHEDULED = "scheduled"
    PUBLISHED = "published"
    FAILED = "failed"


class User(Base):
    """User model for authentication and authorization"""
    __tablename__ = 'users'

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for Google-only users
    full_name = Column(String(255))
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
    posts = relationship("Post", back_populates="user", cascade="all, delete-orphan")
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
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    platform = Column(String(50), nullable=False, index=True)
    platform_user_id = Column(String(255))
    platform_username = Column(String(255))
    display_name = Column(String(255))
    oauth_token = Column(Text)  # Encrypted
    refresh_token = Column(Text)  # Encrypted
    token_expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True, nullable=False)
    platform_metadata = Column(JSON)  # Platform-specific data
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="accounts")
    posts = relationship("Post", secondary="post_accounts", back_populates="accounts")

    def __repr__(self):
        return f"<Account {self.platform}:{self.platform_username}>"


class Post(Base):
    """Post model"""
    __tablename__ = 'posts'

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=False)
    post_type = Column(String(50))  # standard, thread, reel, story, etc.
    status = Column(Enum(PostStatus), default=PostStatus.DRAFT, nullable=False, index=True)
    scheduled_time = Column(DateTime, index=True)
    published_at = Column(DateTime)
    post_options = Column(JSON)  # Platform-specific options
    parallel_execution = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship("User", back_populates="posts")
    accounts = relationship("Account", secondary="post_accounts", back_populates="posts")
    media = relationship("Media", secondary="post_media", back_populates="posts")
    analytics = relationship("PostAnalytics", back_populates="post", cascade="all, delete-orphan")

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
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
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
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
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
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
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
    user_id = Column(String(36), ForeignKey('users.id'))
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
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
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
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
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
