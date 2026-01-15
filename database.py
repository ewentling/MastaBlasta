"""
Database initialization and session management
"""
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from contextlib import contextmanager
from models import Base
import logging

logger = logging.getLogger(__name__)

# Database configuration
DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost/mastablasta')

# Create engine
try:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Verify connections before using
        echo=False  # Set to True for SQL debugging
    )

    # Create session factory
    Session = scoped_session(sessionmaker(bind=engine))
    DB_CONNECTION_OK = True
except Exception as e:
    logger.warning(f"Database connection failed: {e}. Using in-memory storage.")
    engine = None
    Session = None
    DB_CONNECTION_OK = False


def init_db():
    """Initialize database - create all tables"""
    if not DB_CONNECTION_OK:
        logger.warning("Database not available, skipping init")
        return False
    try:
        Base.metadata.create_all(engine)
        logger.info("Database initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        return False


def get_db_session():
    """Get a database session"""
    return Session()


@contextmanager
def db_session_scope():
    """Provide a transactional scope for database operations"""
    session = Session()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Database transaction failed: {e}")
        raise
    finally:
        session.close()


def close_db():
    """Close database session"""
    Session.remove()
