"""add index to face_media_id

Revision ID: d1782ccf5482
Revises: 6dc68d69ae18
Create Date: 2025-06-24 14:38:55.144379

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d1782ccf5482"
down_revision: Union[str, None] = "6dc68d69ae18"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_face_media_id",
        "face",
        ["media_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_face_media_id", table_name="face")
