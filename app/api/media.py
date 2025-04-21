from pathlib import Path
from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.config import MEDIA_DIR, THUMB_DIR
from app.database import get_session
from app.models import Face, Media, MediaTagLink, Person, Tag
from app.schemas.media import MediaRead

router = APIRouter()


@router.get("/", response_model=List[MediaRead])
def list_media(
    tags: Optional[List[str]] = Query(
        None, description="Filter by tag name(s), comma-separated"
    ),
    person_id: Optional[int] = Query(
        None, description="Filter by detected person ID"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    session: Session = Depends(get_session),
):
    q = select(Media)

    if tags is not None and len(tags) > 0:
        q = q.join(Media.tags).where(Tag.name.in_(tags))

    if person_id:
        q = q.join(Media.faces).where(Face.person_id == person_id)
    q = q.offset(skip).limit(limit)
    return session.exec(q).all()


@router.get("/{media_id}")
def get_media(media_id: int, session=Depends(get_session)):
    media = session.get(Media, media_id)
    if not media:
        raise HTTPException(404, "Media not found")

    # 1) load the media and its faces, each with its person
    q = (
        select(Face)
        .where(Face.media_id == media_id)
        .options(selectinload(Face.person))
    )
    faces: List[Face] = session.exec(q).all()

    # 2) collect unique persons
    seen = set()
    persons_data: List[dict[str, Any]] = []
    for f in faces:
        p = f.person
        if not p or p.id in seen:
            continue
        seen.add(p.id)

        # 4) load that person's profile_face row (if set)
        profile = None
        if p.profile_face_id:
            pf = session.get(Face, p.profile_face_id)
            if pf:
                profile = {
                    "id": pf.id,
                    "thumbnail_path": pf.thumbnail_path,
                }

        # 5) build a minimal person dict including profile_face
        persons_data.append(
            {
                "id": p.id,
                "name": p.name,
                "age": p.age,
                "gender": p.gender,
                "ethnicity": p.ethnicity,
                "profile_face_id": p.profile_face_id,
                "profile_face": profile,
            }
        )

    # 3) return a dict with exactly what the frontend needs
    return {"media": media, "persons": persons_data}


@router.delete(
    "/{media_id}/file",
    summary="Permanently delete the media file & its thumbnail from disk",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_media_file(media_id: int, session: Session = Depends(get_session)):
    media = session.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    delete_media_record(media_id, session)

    # delete original file
    orig = MEDIA_DIR / media.path
    if orig.exists():
        orig.unlink()

    # delete thumbnail
    thumb = THUMB_DIR / f"{media.id}.jpg"
    if thumb.exists():
        thumb.unlink()

    return


@router.delete(
    "/{media_id}",
    summary="Delete media record (and dependent faces) from database",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_media_record(
    media_id: int,
    session: Session = Depends(get_session),
):
    media = session.get(Media, media_id)
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")

    # 1) delete all Face rows referencing this media
    session.exec(delete(Face).where(Face.media_id == media_id))
    # TODO add thumbnail deletion
    # 2) delete all tag links for this media
    session.exec(delete(MediaTagLink).where(MediaTagLink.media_id == media_id))

    # 3) delete the Media row itself
    session.delete(media)

    session.commit()
    return
