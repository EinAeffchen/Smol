from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select
from sqlalchemy import delete
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models import Tag, Media, Person, MediaTagLink, PersonTagLink
from app.schemas.tag import TagRead
from app.database import safe_commit

router = APIRouter()


@router.get("/", response_model=list[TagRead])
def list_tags(
    skip: int = 0, limit: int = 50, session: Session = Depends(get_session)
):
    return session.exec(
        select(Tag).options(selectinload(Tag.media)).offset(skip).limit(limit)
    ).all()


def get_or_create_tag(name: str, session: Session) -> Tag:
    name = name.lower()
    tag = session.exec(select(Tag).where(Tag.name == name)).first()
    if not tag:
        tag = Tag(name=name)
        session.add(tag)
        safe_commit(session)
        session.refresh(tag)
    return tag


def attach_tag_to_media(media_id: int, tag_id: int, session: Session) -> None:
    # avoid dupes
    # ensure both exist
    if not session.get(Media, media_id):
        raise HTTPException(404, "Media not found")
    if not session.get(Tag, tag_id):
        raise HTTPException(404, "Tag not found")
    if session.exec(
        select(MediaTagLink).where(
            MediaTagLink.tag_id == tag_id, MediaTagLink.media_id == media_id
        )
    ).first():
        return
    link = MediaTagLink(media_id=media_id, tag_id=tag_id)
    session.add(link)
    safe_commit(session)


@router.post("/", response_model=Tag, status_code=status.HTTP_201_CREATED)
def create_tag(
    *,
    name: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    tag = get_or_create_tag(name, session)
    return tag


@router.get("/{tag_id}", response_model=TagRead)
def get_tag(tag_id: int, session: Session = Depends(get_session)):
    tag = session.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    # relationships media & persons auto‑loaded
    return tag


# Assign / remove on Media
@router.post(
    "/media/{media_id}/{tag_id}", status_code=status.HTTP_204_NO_CONTENT
)
def add_tag_to_media(
    media_id: int, tag_id: int, session: Session = Depends(get_session)
):
    attach_tag_to_media(media_id, tag_id, session)


@router.delete(
    "/media/{media_id}/{tag_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_tag_from_media(
    media_id: int, tag_id: int, session: Session = Depends(get_session)
):
    session.exec(
        delete(MediaTagLink).where(
            MediaTagLink.media_id == media_id, MediaTagLink.tag_id == tag_id
        )
    )
    safe_commit(session)


# Assign / remove on Person
@router.post(
    "/persons/{person_id}/{tag_id}", status_code=status.HTTP_204_NO_CONTENT
)
def add_tag_to_person(
    person_id: int, tag_id: int, session: Session = Depends(get_session)
):
    if not session.get(Person, person_id):
        raise HTTPException(404, "Person not found")
    if not session.get(Tag, tag_id):
        raise HTTPException(404, "Tag not found")
    link = PersonTagLink(person_id=person_id, tag_id=tag_id)
    session.add(link)
    safe_commit(session)


@router.delete(
    "/persons/{person_id}/{tag_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_tag_from_person(
    person_id: int, tag_id: int, session: Session = Depends(get_session)
):
    session.exec(
        delete(PersonTagLink).where(
            PersonTagLink.person_id == person_id,
            PersonTagLink.tag_id == tag_id,
        )
    )
    safe_commit(session)
