"""add imagehash and blacklist

Revision ID: 698da7bee6e8
Revises: b6c903f59589
Create Date: 2025-06-30 13:30:37.914026

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "698da7bee6e8"
down_revision: Union[str, None] = "b6c903f59589"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "blacklist",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_blacklist_path",
        "blacklist",
        ["path"],
        unique=True,
    )
    op.add_column("media", sa.Column("phash", sa.Text(), nullable=True))
    op.create_index(
        "ix_media_phash",
        "media",
        ["phash"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("blacklist")
    op.drop_column("media", "phash")
