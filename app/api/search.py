# app/api/processors.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session
from app.database import get_session
from app.utils import logger
from app.models import Media, Tag, Person, Face
from app.schemas.search import SearchResult
from sqlmodel import Session, select
from sqlalchemy import or_

router = APIRouter()


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
    q = f"%{query or ''}%"
    stmt = (
        select(Media)
        # join to tags
        .join(Media.tags, isouter=True)
        # join to faces→person
        .join(Media.faces, isouter=True)
        .join(Face.person, isouter=True)
        # match either tag.name OR person.name
        .where(or_(Tag.name.ilike(q), Person.name.ilike(q)))
        .distinct()  # dedupe on Media.id
        .offset(skip)
        .limit(limit)
    )
    media = session.exec(stmt).all()
    p_stmt = (
        select(Person)
        .join(Person.tags, isouter=True)
        .where(or_(Person.name.ilike(q), Tag.name.ilike(q)))
        .distinct()
        .offset(skip)
        .limit(limit)
    )
    people = session.exec(p_stmt).all()
    # tags by name alone
    tags = session.exec(
        select(Tag).where(Tag.name.ilike(q)).offset(skip).limit(limit)
    ).all()
    return SearchResult(persons=people, media=media, tags=tags)
