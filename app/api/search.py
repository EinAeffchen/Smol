# app/api/processors.py
import json
from datetime import datetime
from typing import Literal, Optional, Union

import numpy as np
import torch
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_, text
from sqlalchemy.dialects import sqlite
from sqlmodel import Session, and_, or_, select

from app.config import MIN_CLIP_SEARCH_SIMILARITY, model, tokenizer
from app.database import get_session
from app.logger import logger
from app.models import Face, Media, Person, Tag
from app.schemas.search import CursorPage, SearchResult
from app.schemas.tag import TagRead
from app.schemas.media import MediaPreview
from app.schemas.person import PersonRead

router = APIRouter()


def encode_text_query(query: str) -> np.ndarray:
    tokenized = tokenizer([query])
    with torch.no_grad():
        text_feat = model.encode_text(tokenized)
    text_feat /= text_feat.norm(dim=-1, keepdim=True)
    return text_feat.squeeze(0).cpu().numpy().tolist()


@router.get(
    "/",
    summary="Search media, persons, or tags with cursor pagination",
    response_model=CursorPage,
)
def search(
    *,
    category: Literal["media", "person", "tag"] = Query(
        ..., description="Which type to search"
    ),
    limit: int = 20,
    cursor: str | None = Query(
        None,
        description="page_number",
    ),
    query: str = Query("", description="Free-text or embedding query"),
    session: Session = Depends(get_session),
):
    max_dist = 2
    max_pages = 3
    if category == "media":
        vec = encode_text_query(query)
        if cursor:
            page = int(cursor)
        else:
            page = 1
        sql = text(
            """
            SELECT media_id, distance
              FROM media_embeddings
             WHERE embedding MATCH :vec
               AND distance < :max_dist
             ORDER BY distance
            LIMIT :k
            """
        ).bindparams(
            vec=json.dumps(vec), max_dist=max_dist, k=limit * max_pages
        )
        rows = session.exec(sql).all()  # [(media_id, distance), ...]
        media_ids = [r[0] for r in rows[(page - 1) * limit : page * limit]]

        # 2) load & order Media
        medias = session.exec(
            select(Media).where(Media.id.in_(media_ids))
        ).all()
        id_map = {m.id: m for m in medias}
        ordered = [id_map[mid] for mid in media_ids if mid in id_map]
        logger.warning("Page: %s - results: %s", page, len(medias))
        if len(medias) == limit:
            next_cursor = str(page + 1)
        else:
            next_cursor = None
        return CursorPage(
            items=[SearchResult(media=ordered, persons=[], tags=[])],
            next_cursor=next_cursor,
        )

    elif category == "person":
        people = session.exec(
            select(Person).where(Person.name.ilike(f"%{query}%"))
        ).all()
        return CursorPage(
            items=[SearchResult(media=[], persons=people, tags=[])],
            next_cursor=None,
        )

    else:  # category == "tag"
        tags = session.exec(
            select(Tag).where(Tag.name.ilike(f"%{query}%"))
        ).all()
        return CursorPage(
            items=[SearchResult(media=[], persons=[], tags=tags)],
            next_cursor=None,
        )
