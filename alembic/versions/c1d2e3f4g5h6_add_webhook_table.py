"""Add webhook table

Revision ID: c1d2e3f4g5h6
Revises: b1c2d3e4f5g6
Create Date: 2026-02-20 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c1d2e3f4g5h6'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5g6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create webhooks table for persisted webhook registrations."""
    op.create_table(
        'webhooks',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('url', sa.String(2048), nullable=False),
        sa.Column('events', sa.JSON(), nullable=False),
        sa.Column('secret', sa.Text(), nullable=True),
        sa.Column('active', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_webhooks_user_id', 'webhooks', ['user_id'])


def downgrade() -> None:
    """Drop webhooks table."""
    op.drop_index('ix_webhooks_user_id', table_name='webhooks')
    op.drop_table('webhooks')
