"""Add missing media tracking fields

Revision ID: 7b61f855d2b3
Revises: 92f7ecebc445
Create Date: 2025-10-06 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "7b61f855d2b3"
down_revision: Union[str, None] = "92f7ecebc445"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "media",
        sa.Column("missing_since", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "media",
        sa.Column(
            "missing_confirmed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("0"),
        ),
    )
    op.create_index(
        "ix_media_missing_since",
        "media",
        ["missing_since"],
        unique=False,
    )
    op.create_index(
        "ix_media_missing_confirmed",
        "media",
        ["missing_confirmed"],
        unique=False,
    )
    op.alter_column(
        "media",
        "missing_confirmed",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_index("ix_media_missing_confirmed", table_name="media")
    op.drop_index("ix_media_missing_since", table_name="media")
    op.drop_column("media", "missing_confirmed")
    op.drop_column("media", "missing_since")
