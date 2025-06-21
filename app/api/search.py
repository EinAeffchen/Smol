# app/api/processors.py
import json

import numpy as np
import torch
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import text, func, tuple_, desc
from sqlmodel import Session, select

from app.config import model, tokenizer, MIN_CLIP_SEARCH_SIMILARITY
from app.database import get_session
from app.logger import logger
from app.models import Media, Person, Tag
from app.schemas.search import (
    CursorPage,
)
from app.schemas.tag import TagRead
from app.schemas.person import PersonReadSimple
from app.schemas.media import MediaPreview

router = APIRouter()


def encode_text_query(query: str) -> np.ndarray:
    tokenized = tokenizer([query])
    with torch.no_grad():
        text_feat = model.encode_text(tokenized)
    text_feat /= text_feat.norm(dim=-1, keepdim=True)
    return text_feat.squeeze(0).cpu().numpy().tolist()


@router.get(
    "/media",
    summary="Search media with cursor pagination",
    response_model=CursorPage[MediaPreview],
)
def search_media(
    limit: int = 20,
    cursor: str | None = Query(None, description="page_number"),
    query: str = Query("", description="Free-text or embedding query"),
    session: Session = Depends(get_session),
):
    if not query:
        return CursorPage(items=[], next_cursor=None)

    max_dist = 2.0 - MIN_CLIP_SEARCH_SIMILARITY
    max_pages = 3
    vec = encode_text_query(query)
    min_dist = 0
    if cursor:
        min_dist = float(cursor)

    sql = text(
        """
        SELECT media_id, distance
            FROM media_embeddings
            WHERE embedding MATCH :vec
            AND k = :k
            AND distance < :max_dist
            AND distance > :min_dist
            ORDER BY distance
        """
    ).bindparams(
        vec=json.dumps(vec),
        max_dist=max_dist,
        min_dist=min_dist,
        k=limit * max_pages,
    )
    rows = session.exec(sql).all()  # [(media_id, distance), ...]
    media_ids = [row[0] for row in rows]
    # 2) load & order Media
    medias = session.exec(select(Media).where(Media.id.in_(media_ids))).all()
    id_map = {m.id: m for m in medias}
    ordered = [id_map[mid] for mid in media_ids if mid in id_map]
    if len(medias) == limit:
        next_cursor = str(rows[-1][1])
    else:
        next_cursor = None
    return CursorPage(
        items=[MediaPreview.model_validate(media) for media in ordered],
        next_cursor=next_cursor,
    )


@router.get(
    "/people",
    summary="Search people by name",
    response_model=CursorPage[PersonReadSimple],
)
def search_people(
    limit: int = 20,
    cursor: str | None = Query(None, description="Encoded as `<count>_<id>`"),
    query: str = Query("", description="Person name query"),
    session: Session = Depends(get_session),
):
    if not query:
        return CursorPage(items=[], next_cursor=None)

    q = select(Person).where(Person.name.ilike(f"%{query}%"))

    if cursor:
        try:
            # Keyset pagination requires both the primary sort key and a unique tie-breaker
            cursor_count, cursor_id = map(int, cursor.split("_"))
            q = q.where(
                tuple_(Person.appearance_count, Person.id)
                < (cursor_count, cursor_id)
            )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400, detail="Invalid cursor format"
            )

    q = q.order_by(desc(Person.appearance_count), desc(Person.id)).limit(limit)

    people = session.exec(q).all()

    next_cursor = None
    if len(people) == limit:
        last_person = people[-1]
        next_cursor = f"{last_person.appearance_count}_{last_person.id}"
    return CursorPage(
        items=[PersonReadSimple.model_validate(person) for person in people],
        next_cursor=next_cursor,
    )


@router.get(
    "/tags",
    summary="Search tags by name",
    response_model=CursorPage[TagRead],
)
def search_tags(
    limit: int = 20,
    cursor: str | None = Query(
        None, description="The ID of the last tag from the previous page"
    ),
    query: str = Query("", description="Tag name query"),
    session: Session = Depends(get_session),
):
    if not query:
        return CursorPage(items=[], next_cursor=None)

    # Simplified query without on-the-fly counting
    q = select(Tag).where(Tag.name.ilike(f"%{query}%"))

    if cursor:
        try:
            # For simple sorting by ID, the cursor is just the ID.
            cursor_id = int(cursor)
            # Find tags with an ID less than the cursor's ID (for DESC order)
            q = q.where(Tag.id < cursor_id)
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400, detail="Invalid cursor format"
            )

    # Order by ID descending (newest first) for stable pagination
    q = q.order_by(desc(Tag.id)).limit(limit)

    tags = session.exec(q).all()

    next_cursor = None
    if len(tags) == limit:
        # The next cursor is the ID of the last tag on this page.
        next_cursor = str(tags[-1].id)

    return CursorPage(
        items=[TagRead.model_validate(t) for t in tags],
        next_cursor=next_cursor,
    )
