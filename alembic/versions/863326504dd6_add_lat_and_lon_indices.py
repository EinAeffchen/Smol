"""add lat and lon indices

Revision ID: 863326504dd6
Revises: 4763f07751ca
Create Date: 2025-06-26 13:32:36.209255

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '863326504dd6'
down_revision: Union[str, None] = '4763f07751ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_lat_idx",
        "exifdata",
        ["lat"],
        unique=False,
    )
    op.create_index(
        "ix_lon_idx",
        "exifdata",
        ["lon"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_lat_idx", table_name="exifdata")
    op.drop_index("ix_lon_idx", table_name="exifdata")

