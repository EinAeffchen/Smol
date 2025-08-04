"""Fix person_embedding

Revision ID: 6b0604629099
Revises: 698da7bee6e8
Create Date: 2025-07-03 14:57:34.918858

"""
import json
from typing import Sequence, Union

import numpy as np
import sqlalchemy as sa
from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '6b0604629099'
down_revision: Union[str, None] = '698da7bee6e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    find_duplicates_sql = text("""
        SELECT person_id
        FROM person_embeddings
        GROUP BY person_id
        HAVING COUNT(*) > 1
    """)
    result = bind.execute(find_duplicates_sql)
    person_ids_with_duplicates = result.scalars().all()

    if not person_ids_with_duplicates:
        print("No duplicate person embeddings found. Skipping data migration.")
    else:
        print(f"Found {len(person_ids_with_duplicates)} persons with duplicate embeddings. Consolidating...")

        for person_id in person_ids_with_duplicates:
            print(f"Processing person_id: {person_id}")
            
            # 1. Fetch all embeddings for the current person
            fetch_sql = text("SELECT embedding FROM person_embeddings WHERE person_id = :p_id")
            embeddings_result = bind.execute(fetch_sql.bindparams(p_id=person_id))
            
            # Embeddings are likely stored as JSON strings; load them into a list.
            # If they are blobs, you would need a different deserialization method.
            face_embeddings_bytes  = embeddings_result.scalars().all()
            
            # 2. Calculate the normalized centroid
            embeddings_array = np.array(
                [np.frombuffer(e, dtype=np.float32) for e in face_embeddings_bytes],
                dtype=np.float32
            )
            centroid = embeddings_array.mean(axis=0)
            norm = np.linalg.norm(centroid)
            if norm > 0:
                centroid /= norm
            
            consolidated_embedding_json = json.dumps(centroid.tolist())

            # 3. Delete all old entries for this person
            delete_sql = text("DELETE FROM person_embeddings WHERE person_id = :p_id")
            bind.execute(delete_sql.bindparams(p_id=person_id))

            # 4. Insert the single new consolidated entry
            insert_sql = text("""
                INSERT INTO person_embeddings (person_id, embedding)
                VALUES (:p_id, :emb)
            """)
            bind.execute(insert_sql.bindparams(p_id=person_id, emb=consolidated_embedding_json))
        
        print("Data consolidation complete.")


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("idx_person_embeddings_person_id ", "person_embeddings")
    pass
