from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.config import MEDIA_DIR, THUMB_DIR
from app.database import get_session
from app.models import Face, Media, MediaTagLink, Tag, ExifData
from app.schemas.media import MediaRead, MediaPreview, MediaLocation
from app.utils import logger
from app.database import safe_commit

router = APIRouter()


@router.get("/", response_model=list[MediaRead])
def list_media(
    tags: list[str] | None = Query(
        None, description="Filter by tag name(s), comma-separated"
    ),
    person_id: int | None = Query(
        None, description="Filter by detected person ID"
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    session: Session = Depends(get_session),
):
    q = select(Media)

    if tags is not None and len(tags) > 0:
        q = q.join(Media.tags).where(Tag.name.in_(tags))

    if person_id:
        q = q.join(Media.faces).where(Face.person_id == person_id)
    q = q.offset(skip).limit(limit)
    return session.exec(q).all()


@router.get("/locations", response_model=list[MediaLocation])
def list_locations(session: Session = Depends(get_session)):
    stmt = (
        select(
            Media.id,
            ExifData.lat.label("latitude"),
            ExifData.lon.label("longitude"),
        )
        .join(ExifData, ExifData.media_id == Media.id)
        .where(ExifData.lat.is_not(None), ExifData.lon.is_not(None))
    )
    rows = session.exec(stmt).all()
    return [
        MediaLocation(
            id=row.id,
            latitude=row.latitude,
            longitude=row.longitude,
            thumbnail=f"/thumbnails/{row.id}.jpg",
        )
        for row in rows
    ]


@router.get(
    "/images", response_model=list[MediaPreview], summary="List all images"
)
def list_images(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
):
    stmt = (
        select(Media)
        .where(Media.duration == None)  # images have no duration
        .order_by(Media.inserted_at.desc())
        .offset(skip)
        .limit(limit)
    )
    medias = session.exec(stmt).all()
    return [
        MediaPreview(**m.model_dump(), thumb_url=f"/thumbnails/{m.id}.jpg")
        for m in medias
    ]


@router.get(
    "/videos", response_model=list[MediaRead], summary="List all videos"
)
def list_videos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
):
    stmt = (
        select(Media)
        .where(Media.duration != None)  # videos have a duration
        .order_by(Media.inserted_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return session.exec(stmt).all()


@router.get("/{media_id}")
def get_media(media_id: int, session: Session = Depends(get_session)):
    media = session.get(Media, media_id)
    if not media:
        raise HTTPException(404, "Media not found")
    logger.info("TAGS: %s", media.tags)
    media.views += 1
    session.add(media)
    safe_commit(session)
    session.refresh(media)
    # 1) load the media and its faces, each with its person
    q = (
        select(Face)
        .where(Face.media_id == media_id)
        .options(selectinload(Face.person))
    )
    faces: list[Face] = session.exec(q).all()

    # 2) collect unique persons
    seen = set()
    persons_data: list[dict[str, Any]] = []
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
                "profile_face_id": p.profile_face_id,
                "profile_face": profile,
            }
        )

    # 3) return a dict with exactly what the frontend needs
    media = dict(media)
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
    # 2) delete all tag links for this media
    session.exec(delete(MediaTagLink).where(MediaTagLink.media_id == media_id))
    session.exec(delete(ExifData).where(ExifData.media_id == media_id))
    # 3) delete the Media row itself
    session.delete(media)

    safe_commit(session)


@router.get("/exif/{media_id}", response_model=ExifData)
def read_exif(media_id: int, session=Depends(get_session)):
    ex = session.exec(
        select(ExifData).where(ExifData.media_id == media_id)
    ).first()
    if not ex:
        raise HTTPException(404, "No EXIF data")
    return ex
