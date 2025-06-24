"""add more missing indices

Revision ID: 4763f07751ca
Revises: d1782ccf5482
Create Date: 2025-06-24 15:11:34.296059

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4763f07751ca'
down_revision: Union[str, None] = 'd1782ccf5482'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_face_person_id",
        "face",
        ["person_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_face_person_id", table_name="face")
