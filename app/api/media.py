import json
import os
from datetime import datetime, timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import and_, delete, or_, text
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.config import MEDIA_DIR, MIN_CLIP_SEARCH_SIMILARITY, THUMB_DIR
from app.database import get_session, safe_commit
from app.logger import logger
from app.models import ExifData, Face, Media, MediaTagLink, Person, Scene, Tag
from app.schemas.media import (
    CursorPage,
    GeoUpdate,
    MediaDetail,
    MediaLocation,
    MediaPreview,
    MediaRead,
    SceneRead,
)
from app.schemas.person import PersonRead
from app.utils import (
    update_exif_gps,
)

router = APIRouter()


def format_timestamp(seconds: float) -> str:
    """
    Turn seconds (e.g. 12.3456) into a WebVTT timestamp like "00:00:12.346".
    """
    td = timedelta(seconds=seconds)
    # total seconds → hours, minutes, seconds, milliseconds
    total_ms = int(td.total_seconds() * 1000)
    hrs, rem = divmod(total_ms, 3_600_000)
    mins, rem = divmod(rem, 60_000)
    secs, ms = divmod(rem, 1000)
    return f"{hrs:02d}:{mins:02d}:{secs:02d}.{ms:03d}"


@router.get("/missing_geo", response_model=list[MediaPreview])
def get_missing_geo(session: Session = Depends(get_session)):
    stmt = (
        select(Media)
        .join(ExifData)
        .where(ExifData.lat.is_(None))
        .order_by(Media.inserted_at.desc())
        .limit(100)
    )
    return session.exec(stmt).all()


@router.get("/", response_model=CursorPage)
def list_media(
    tags: list[str] | None = Query(
        None, description="Filter by tag name(s), comma-separated"
    ),
    person_id: int | None = Query(
        None, description="Filter by detected person ID"
    ),
    sort: Annotated[str, Query(enum=["newest", "latest"])] = "newest",
    cursor: str | None = Query(
        None,
        description="encoded as `<value>_<id>`; e.g. `2025-05-05T12:34:56.789012_1234` or `2500_1234`",
    ),
    limit: int = Query(100, ge=1, le=200),
    session: Session = Depends(get_session),
):
    q = select(Media)
    # select by tags
    if tags and len(tags) > 0:
        q = q.join(Media.tags).where(Tag.name.in_(tags))

    if sort == "newest":
        sort_col = Media.created_at
        # Type of the value in the cursor for 'newest'
        parse_val_from_cursor = lambda val_str: datetime.fromisoformat(val_str)
    elif sort == "latest":
        sort_col = Media.inserted_at
        # Type of the value in the cursor for 'latest'
        parse_val_from_cursor = lambda val_str: datetime.fromisoformat(val_str)
    else:
        # Handle invalid sort parameter, perhaps default or raise error
        raise ValueError(f"Unsupported sort option: {sort}")

    # Apply consistent ordering
    q = q.order_by(sort_col.desc(), Media.id.desc())

    if cursor:
        try:
            val_str, id_str = cursor.split("_", 1)
            prev_cursor_val = parse_val_from_cursor(val_str)
            prev_cursor_id = int(id_str)
        except ValueError:
            logger.warning("Warning: Invalid cursor format: %s", cursor)
        else:
            # Apply the cursor-based WHERE clause
            q = q.where(
                or_(
                    sort_col < prev_cursor_val,
                    and_(
                        sort_col == prev_cursor_val, Media.id < prev_cursor_id
                    ),
                )
            )
    logger.warning(q)
    if person_id:
        q = q.join(Media.faces).where(Face.person_id == person_id)

    results = session.exec(q.limit(limit)).all()
    if len(results) == limit:
        last = results[-1]
        v = getattr(last, "created_at" if sort == "newest" else "inserted_at")
        val_token = v.isoformat()
        next_cursor = f"{val_token}_{last.id}"
    else:
        next_cursor = None
    return CursorPage(items=results, next_cursor=next_cursor)


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


@router.get("/images", response_model=CursorPage, summary="List all images")
def list_images(
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
    cursor: str | None = Query(
        None,
        description="encoded as `<value>_<id>`; e.g. `2025-05-05T12:34:56.789012_1234` or `2500_1234`",
    ),
):
    stmt = select(Media).where(
        Media.duration.is_(None)
    )  # images have no duration

    if cursor:
        before_id = int(cursor)
        # keyset predicate
        stmt = stmt.where(Media.id < before_id)
    logger.debug("LIMIT: %s", limit)
    stmt = stmt.order_by(Media.id.desc())
    medias = session.exec(stmt.limit(limit)).all()
    next_cursor = str(medias[-1].id) if len(medias) == limit else None
    return CursorPage(items=medias, next_cursor=next_cursor)


@router.get("/videos", response_model=CursorPage, summary="List all videos")
def list_videos(
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
    cursor: str | None = Query(
        None,
        description="encoded as `<id>`; e.g. `2025-05-05T12:34:56.789012_1234` or `2500_1234`",
    ),
):
    stmt = select(Media).where(
        Media.duration != None
    )  # videos have a duration
    stmt = stmt.order_by(Media.inserted_at.desc())
    if cursor:
        before_id = int(cursor)
        # keyset predicate
        stmt = stmt.where(Media.id < before_id)
    results = session.exec(stmt.limit(limit)).all()
    next_cursor = str(results[-1].id) if len(results) == limit else None
    return CursorPage(items=results, next_cursor=next_cursor)


@router.get("/{media_id}", response_model=MediaDetail)
def get_media(media_id: int, session: Session = Depends(get_session)):
    statement = (
        select(Media)
        .where(Media.id == media_id)
        .options(
            selectinload(Media.tags),
            selectinload(Media.faces)
            .selectinload(Face.person)
            .selectinload(Person.profile_face),
        )
    )
    media = session.exec(statement).one_or_none()
    if not media:
        raise HTTPException(404, "Media not found")

    seen = set()
    persons: list[PersonRead] = []
    orphans: list[Face] = []
    for face in media.faces:
        if not face.person:
            orphans.append(face)
        p = face.person
        if p and p.id not in seen:
            seen.add(p.id)
            persons.append(p)

    # 2) take tags straight off media.tags
    return MediaDetail(media=media, persons=persons, orphans=orphans)


@router.get(
    "/{media_id}/scenes.vtt",
    response_class=PlainTextResponse,
    summary="Serve a WebVTT file mapping scene start/end → thumbnail",
)
def scenes_vtt(
    media_id: int, request: Request, session: Session = Depends(get_session)
):
    API_URL = os.environ.get("API_PUBLIC_URL", f"http://localhost:{os.environ.get('PORT')}")
    scenes = session.exec(
        select(Scene)
        .where(Scene.media_id == media_id)
        .order_by(Scene.start_time)
    ).all()
    if not scenes:
        if request.method == "HEAD":
            raise HTTPException(404, "No scenes found for that media")
        empty_vtt = "WEBVTT\n\n"
        return PlainTextResponse(empty_vtt, media_type="text/vtt")

    # Build WebVTT text
    lines = ["WEBVTT", ""]
    for s in scenes:
        start = format_timestamp(s.start_time)
        # pick a tiny epsilon if end_time is missing
        end_time = s.end_time or (s.start_time + 0.1)
        end = format_timestamp(end_time)
        lines += [f"{start} --> {end}", f"{API_URL}/thumbnails/{s.thumbnail_path}", ""]

    return PlainTextResponse("\n".join(lines), media_type="text/vtt")


def delete_file(session: Session, media_id: int):
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
    "/{media_id}/file",
    summary="Permanently delete the media file & its thumbnail from disk",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_media_file(media_id: int, session: Session = Depends(get_session)):
    delete_file(session, media_id)


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
    session.exec(delete(Scene).where(Scene.media_id == media.id))
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


@router.get("/{media_id}/get_similar", response_model=list[MediaPreview])
def get_similar_media(
    media_id: int, k: int = 10, session=Depends(get_session)
):
    media = session.get(Media, media_id)
    if not media or not media.embedding:
        raise HTTPException(404, "Media not found")
    max_dist = 1.0 - MIN_CLIP_SEARCH_SIMILARITY
    sql = text(
        """
      SELECT media_id
        FROM media_embeddings
       WHERE embedding MATCH :vec
         AND distance < :maxd
       ORDER BY distance
       LIMIT :k
    """
    ).bindparams(vec=json.dumps(media.embedding), maxd=max_dist, k=k)
    rows = session.exec(sql).all()
    media_ids = [r[0] for r in rows if r[0] != media_id]

    if not media_ids:
        return []

    # 5) fetch the actual Media rows
    stmt = select(Media).where(Media.id.in_(media_ids))
    media_objs = session.exec(stmt).all()

    # 6) reorder them by the original KNN order
    id_to_obj = {m.id: m for m in media_objs}
    return [id_to_obj[mid] for mid in media_ids if mid in id_to_obj]


@router.get("/{media_id}/scenes", response_model=list[SceneRead])
def get_scenes(media_id: int, session: Session = Depends(get_session)):
    return session.exec(
        select(Scene)
        .where(Scene.media_id == media_id)
        .order_by(Scene.start_time)
    ).all()


@router.patch("/{media_id}/geolocation", response_model=MediaRead)
def update_geolocation(
    media_id: int,
    data: GeoUpdate,
    session: Session = Depends(get_session),
):
    media = session.exec(
        select(Media)
        .options(selectinload(Media.exif))
        .where(Media.id == media_id)
    ).first()
    if not media:
        raise HTTPException(404, "Media not found")
    media.exif.lat = data.latitude
    media.exif.lon = data.longitude
    update_exif_gps(media.path, data.longitude, data.latitude)
    session.add(media)
    session.commit()
    session.refresh(media)
    return media
