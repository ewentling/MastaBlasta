"""Add password_must_change column

Revision ID: b1c2d3e4f5g6
Revises: a1b2c3d4e5f6
Create Date: 2026-02-18 21:52:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add password_must_change column to users table."""
    # Add password_must_change column with default False
    op.add_column('users', sa.Column('password_must_change', sa.Boolean(), nullable=True))
    
    # Update existing rows to have default value of False
    op.execute("UPDATE users SET password_must_change = FALSE WHERE password_must_change IS NULL")
    
    # Make the column non-nullable after setting defaults
    op.alter_column('users', 'password_must_change', nullable=False, server_default=sa.false())


def downgrade() -> None:
    """Remove password_must_change column from users table."""
    op.drop_column('users', 'password_must_change')
