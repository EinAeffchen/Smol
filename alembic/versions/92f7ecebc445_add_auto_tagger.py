"""Add auto tagger

Revision ID: 92f7ecebc445
Revises: 6b0604629099
Create Date: 2025-07-30 11:40:35.785269

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '92f7ecebc445'
down_revision: Union[str, None] = '6b0604629099'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('mediataglink', sa.Column('auto_score', sa.Float(), nullable=True))
    # we're resetting auto tagger, as it was falsely set
    bind = op.get_bind()
    update_media = text("""
        UPDATE media SET ran_auto_tagging=false
    """)
    result = bind.execute(update_media)

def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('mediataglink', 'auto_score')

