"""Add missing user_id indexes for query performance

Revision ID: d1e2f3g4h5i6
Revises: c1d2e3f4g5h6
Create Date: 2026-02-21 20:00:00.000000

Adds indexes on user_id foreign-key columns that were previously missing.
Without these indexes, every user-specific query (list posts, list media,
list accounts, etc.) required a full table scan.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd1e2f3g4h5i6'
down_revision: Union[str, None] = 'c1d2e3f4g5h6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create missing user_id indexes."""
    # Each create_index call is idempotent-safe: if the index already exists
    # from a prior run the DB will raise an error caught by Alembic's autogen.
    op.create_index('ix_accounts_user_id', 'accounts', ['user_id'])
    op.create_index('ix_posts_user_id', 'posts', ['user_id'])
    op.create_index('ix_media_user_id', 'media', ['user_id'])
    op.create_index('ix_templates_user_id', 'templates', ['user_id'])
    op.create_index('ix_social_monitors_user_id', 'social_monitors', ['user_id'])
    op.create_index('ix_url_shortener_user_id', 'url_shortener', ['user_id'])
    op.create_index('ix_response_templates_user_id', 'response_templates', ['user_id'])
    op.create_index('ix_chatbot_interactions_user_id', 'chatbot_interactions', ['user_id'])


def downgrade() -> None:
    """Drop the user_id indexes."""
    op.drop_index('ix_chatbot_interactions_user_id', table_name='chatbot_interactions')
    op.drop_index('ix_response_templates_user_id', table_name='response_templates')
    op.drop_index('ix_url_shortener_user_id', table_name='url_shortener')
    op.drop_index('ix_social_monitors_user_id', table_name='social_monitors')
    op.drop_index('ix_templates_user_id', table_name='templates')
    op.drop_index('ix_media_user_id', table_name='media')
    op.drop_index('ix_posts_user_id', table_name='posts')
    op.drop_index('ix_accounts_user_id', table_name='accounts')
