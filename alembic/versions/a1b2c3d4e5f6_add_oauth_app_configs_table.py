"""Add OAuth app configs table

Revision ID: a1b2c3d4e5f6
Revises: 60eff4a28a0c
Create Date: 2026-01-16 17:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '60eff4a28a0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Create oauth_app_configs table
    op.create_table('oauth_app_configs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('platform', sa.String(length=50), nullable=False),
        sa.Column('app_name', sa.String(length=255), nullable=True),
        sa.Column('client_id', sa.Text(), nullable=False),
        sa.Column('client_secret', sa.Text(), nullable=False),
        sa.Column('redirect_uri', sa.String(length=512), nullable=True),
        sa.Column('additional_config', sa.JSON(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], )
    )
    op.create_index(op.f('ix_oauth_app_configs_user_id'), 'oauth_app_configs', ['user_id'], unique=False)
    op.create_index(op.f('ix_oauth_app_configs_platform'), 'oauth_app_configs', ['platform'], unique=False)
    
    # Add oauth_app_config_id column to accounts table
    op.add_column('accounts', sa.Column('oauth_app_config_id', sa.String(length=36), nullable=True))
    op.create_foreign_key('fk_accounts_oauth_app_config', 'accounts', 'oauth_app_configs', ['oauth_app_config_id'], ['id'])


def downgrade() -> None:
    """Downgrade schema."""
    # Remove foreign key and column from accounts table
    op.drop_constraint('fk_accounts_oauth_app_config', 'accounts', type_='foreignkey')
    op.drop_column('accounts', 'oauth_app_config_id')
    
    # Drop oauth_app_configs table
    op.drop_index(op.f('ix_oauth_app_configs_platform'), table_name='oauth_app_configs')
    op.drop_index(op.f('ix_oauth_app_configs_user_id'), table_name='oauth_app_configs')
    op.drop_table('oauth_app_configs')
