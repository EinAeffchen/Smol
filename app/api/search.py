# app/api/processors.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from app.database import get_session
from app.utils import logger
import torch
from app.config import tokenizer, model
from app.models import Media, Tag, Person, Face
from app.schemas.search import SearchResult
from app.schemas.media import MediaPreview
from sqlmodel import Session, select
from sqlalchemy import or_
import numpy as np
from app.config import MIN_CLIP_SEARCH_SIMILARITY
from app.utils import get_all_media_embeddings

router = APIRouter()


def encode_text_query(query: str) -> np.ndarray:
    tokenized = tokenizer([query])
    with torch.no_grad():
        text_feat = model.encode_text(tokenized)
    text_feat /= text_feat.norm(dim=-1, keepdim=True)
    return text_feat.squeeze(0).cpu().numpy()


def rank_media_by_query(
    query_embedding: np.ndarray,
    media_embeddings: list[tuple[int, list[float]]],
) -> list[tuple[int, str, float]]:
    query_vec = query_embedding
    results = []
    for media_id, emb in media_embeddings:
        emb_vec = np.array(emb, dtype=np.float32)
        score = float(
            np.dot(query_vec, emb_vec)
            / (np.linalg.norm(query_vec) * np.linalg.norm(emb_vec))
        )
        if score > MIN_CLIP_SEARCH_SIMILARITY:
            results.append((media_id, score))
    return sorted(results, key=lambda x: x[1], reverse=True)


def query_media_by_query_vector(query: str, session: Session):
    query_embedding = encode_text_query(query)
    media_embeddings = get_all_media_embeddings(session)
    ranked = rank_media_by_query(query_embedding, media_embeddings)
    logger.error("RANKED: %s", ranked)
    return ranked


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
    ranked = query_media_by_query_vector(query, session)[skip : skip + limit]
    ranked_ids = [m_id for m_id, _ in ranked]
    page_ids = ranked_ids[skip : skip + limit]
    orm_media = []
    if page_ids:
        orm_media = session.exec(
            select(Media).where(Media.id.in_(page_ids))
        ).all()

    id_to_media = {m.id: m for m in orm_media}
    ordered_media = [
        id_to_media[mid] for mid in page_ids if mid in id_to_media
    ]

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
        "media": [m.model_dump() for m in ordered_media],
        "tags": tags,
    }
