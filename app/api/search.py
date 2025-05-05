# app/api/processors.py
import json

import numpy as np
import torch
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_, text
from sqlmodel import Session, select

from app.config import MIN_CLIP_SEARCH_SIMILARITY, model, tokenizer
from app.database import get_session
from app.logger import logger
from app.models import Face, Media, Person, Tag
from app.schemas.search import SearchResult
from sqlalchemy.dialects import sqlite

router = APIRouter()


def encode_text_query(query: str) -> np.ndarray:
    tokenized = tokenizer([query])
    with torch.no_grad():
        text_feat = model.encode_text(tokenized)
    text_feat /= text_feat.norm(dim=-1, keepdim=True)
    return text_feat.squeeze(0).cpu().numpy().tolist()


@router.get("/", summary="Query the database", response_model=SearchResult)
def search(
    query: str | None = Query(
        None,
        description="Query keywords: tag, person, duration_gte, duration_lte",
    ),
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_session),
):
    query_emb = encode_text_query(query)
    max_dist = 1.4
    sql = text(
        """
      SELECT media_id
        FROM media_embeddings
       WHERE embedding MATCH :vec
         AND distance < :maxd
       ORDER BY distance
       LIMIT :k
       OFFSET :o
    """
    ).bindparams(vec=json.dumps(query_emb), maxd=max_dist, k=limit, o=skip)
    rows = session.exec(sql).all()
    media_ids = [r[0] for r in rows]

    # 5) fetch the actual Media rows
    if media_ids:
        stmt = select(Media).where(Media.id.in_(media_ids))
        media_objs = session.exec(stmt).all()
    else:
        media_objs = []

    # 6) reorder them by the original KNN order
    id_to_obj = {m.id: m for m in media_objs}
    media = [id_to_obj[mid] for mid in media_ids if mid in id_to_obj]

    q = f"%{query or ''}%"
    p_stmt = (
        select(Person)
        .where(or_(Person.name.ilike(q)))
        .distinct()
        .offset(skip)
        .limit(limit)
    )
    people = session.exec(p_stmt).all()
    # tags by name alone
    tags = session.exec(
        select(Tag).where(Tag.name.ilike(q)).offset(skip).limit(limit)
    ).all()
    return {
        "persons": people,
        "media": [m.model_dump() for m in media],
        "tags": tags,
    }
