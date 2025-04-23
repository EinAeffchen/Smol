from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select
from sqlalchemy import delete

from app.database import get_session
from app.models import Tag, Media, Person, MediaTagLink, PersonTagLink
from app.schemas.tag import TagRead
from app.database import safe_commit

router = APIRouter()


@router.get("/", response_model=list[Tag])
def list_tags(session: Session = Depends(get_session)):
    return session.exec(select(Tag)).all()


@router.post("/", response_model=Tag, status_code=status.HTTP_201_CREATED)
def create_tag(
    *,
    name: str = Body(..., embed=True),
    session: Session = Depends(get_session)
):
    tag = Tag(name=name)
    session.add(tag)
    safe_commit(session)
    session.refresh(tag)
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
    # ensure both exist
    if not session.get(Media, media_id):
        raise HTTPException(404, "Media not found")
    if not session.get(Tag, tag_id):
        raise HTTPException(404, "Tag not found")
    link = MediaTagLink(media_id=media_id, tag_id=tag_id)
    session.add(link)
    safe_commit(session)


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
