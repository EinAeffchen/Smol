"""Removes unused PersonSimilarity table

Revision ID: 4472c47816da
Revises:
Create Date: 2025-10-08 09:04:00.135082

"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4472c47816da"
down_revision: Union[str, None] = "7b61f855d2b3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("personsimilarity", if_exists=True)


def downgrade() -> None:
    op.create_table(
        "personsimilarity",
        sa.Column("person_id", sa.Integer(), nullable=False),
        sa.Column("other_id", sa.Integer(), nullable=False),
        sa.Column("similarity", sa.Float(), nullable=False),
        sa.Column("calculated_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(
            ["other_id"],
            ["person.id"],
        ),
        sa.ForeignKeyConstraint(
            ["person_id"],
            ["person.id"],
        ),
        sa.PrimaryKeyConstraint("person_id", "other_id"),
    )
