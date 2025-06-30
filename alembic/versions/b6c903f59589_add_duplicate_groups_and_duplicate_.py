from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b6c903f59589'
down_revision: Union[str, None] = '863326504dd6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'duplicategroup',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_table(
        'duplicatemedia',
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('media_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['group_id'], ['duplicategroup.id'], ),
        sa.ForeignKeyConstraint(['media_id'], ['media.id'], ),
        sa.PrimaryKeyConstraint('group_id', 'media_id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('duplicatemedia')
    op.drop_table('duplicategroup')