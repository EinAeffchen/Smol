"""add person relationship table

Revision ID: 94d1f4d9ef32
Revises: 4472c47816da
Create Date: 2025-10-08 12:30:00.000000
"""

import sqlite3
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "94d1f4d9ef32"
down_revision: str | None = "4472c47816da"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    try:
        op.create_table(
            "person_relationship",
            sa.Column("person_a_id", sa.Integer(), nullable=False),
            sa.Column("person_b_id", sa.Integer(), nullable=False),
            sa.Column(
                "coappearance_count", sa.Integer(), nullable=False, server_default="0"
            ),
            sa.Column("last_media_id", sa.Integer(), nullable=True),
            sa.Column(
                "updated_at",
                sa.DateTime(),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            ),
            sa.ForeignKeyConstraint(["last_media_id"], ["media.id"]),
            sa.ForeignKeyConstraint(["person_a_id"], ["person.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["person_b_id"], ["person.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("person_a_id", "person_b_id"),
        )
        op.create_index(
            "ix_person_relationship_coappearance_count",
            "person_relationship",
            ["coappearance_count"],
        )
    except sqlite3.OperationalError:
        print("Skipping creating of person_relationship as it already exists")


def downgrade() -> None:
    op.drop_index(
        "ix_person_relationship_coappearance_count", table_name="person_relationship"
    )
    op.drop_table("person_relationship")
