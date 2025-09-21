import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import and_, or_, text, tuple_
from sqlalchemy.orm import aliased, selectinload
from sqlmodel import Session, select

from app.config import (
    settings,
)
from app.database import get_session
from app.logger import logger
from app.models import ExifData, Face, Media, Person, Scene, Tag
from app.schemas.face import FaceRead
from app.schemas.media import (
    CursorPage,
    GeoUpdate,
    MediaDetail,
    MediaLocation,
    MediaNeighbors,
    MediaPreview,
    MediaRead,
    SceneRead,
)
from app.schemas.person import PersonRead
from app.utils import (
    delete_file,
    delete_record,
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


@router.get("/missing-geo", response_model=CursorPage)
def get_missing_geo(
    session: Session = Depends(get_session),
    cursor: str | None = None,  # 1. Accept an optional string cursor
    limit: int = 100,  # 2. Make the limit a parameter
):
    stmt = (
        select(Media)
        .join(ExifData)
        .where(ExifData.lat.is_(None))
        # Add a secondary unique sort key for stable ordering
        .order_by(Media.inserted_at.desc(), Media.id.desc())
    )

    # 3. If a cursor is provided, add it to the query
    if cursor:
        try:
            # The cursor will be the `inserted_at` timestamp of the last item from the previous page
            cursor_datetime = datetime.fromisoformat(cursor)
            stmt = stmt.where(Media.inserted_at < cursor_datetime)
        except ValueError:
            # Handle invalid cursor format if necessary
            pass

    # Apply the limit to get one page of results
    stmt = stmt.limit(limit)

    results = session.exec(stmt).all()

    # 4. Determine the next cursor
    next_cursor = None
    if len(results) == limit:
        # If we got a full page, the next cursor is the timestamp of the last item
        last_item_timestamp = results[-1].inserted_at
        next_cursor = last_item_timestamp.isoformat()

    # 5. Return the data in the correct object shape
    return CursorPage(items=results, next_cursor=next_cursor)


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
        parse_val_from_cursor = lambda val_str: datetime.fromisoformat(val_str)
    elif sort == "latest":
        sort_col = Media.inserted_at
        parse_val_from_cursor = lambda val_str: datetime.fromisoformat(val_str)
    else:
        raise ValueError(f"Unsupported sort option: {sort}")

    q = q.order_by(sort_col.desc(), Media.id.desc())

    if cursor:
        try:
            val_str, id_str = cursor.split("_", 1)
            prev_cursor_val = parse_val_from_cursor(val_str)
            prev_cursor_id = int(id_str)
        except ValueError:
            logger.warning("Warning: Invalid cursor format: %s", cursor)
        else:
            q = q.where(
                or_(
                    sort_col < prev_cursor_val,
                    and_(
                        sort_col == prev_cursor_val, Media.id < prev_cursor_id
                    ),
                )
            )
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
def list_locations(
    session: Session = Depends(get_session),
    north: float | None = None,
    south: float | None = None,
    east: float | None = None,
    west: float | None = None,
):
    """
    Lists media locations. If bounding box parameters (north, south, east, west)
    are provided, it returns only locations within that box.
    """
    stmt = (
        select(
            Media.id,
            Media.thumbnail_path,
            ExifData.lat.label("latitude"),
            ExifData.lon.label("longitude"),
        )
        .join(ExifData, ExifData.media_id == Media.id)
        .where(ExifData.lat.is_not(None), ExifData.lon.is_not(None))
    )

    # Check if all bounding box parameters are present
    if all(p is not None for p in [north, south, east, west]):
        stmt = stmt.where(
            ExifData.lat >= south,
            ExifData.lat <= north,
            ExifData.lon >= west,
            ExifData.lon <= east,
        )

    # Add a reasonable limit to prevent sending overwhelming amounts of data
    # for very dense areas, even within the viewport.
    stmt = stmt.limit(5000)

    rows = session.exec(stmt).all()
    results = []
    for row in rows:
        thumbnail_path = (
            f"/{row.id}.jpg" if not row.thumbnail_path else row.thumbnail_path
        )
        results.append(
            MediaLocation(
                id=row.id,
                latitude=row.latitude,
                longitude=row.longitude,
                thumbnail=thumbnail_path,
            )
        )
    return results


@router.get("/images", response_model=CursorPage, summary="List all images")
def list_images(
    limit: int = Query(50, ge=1, le=200),
    session: Session = Depends(get_session),
    sort: Annotated[str, Query(enum=["newest", "latest"])] = "newest",
    cursor: str | None = Query(
        None,
        description="encoded as `<value>_<id>`; e.g. `2025-05-05T12:34:56.789012_1234` or `2500_1234`",
    ),
):
    stmt = select(Media).where(
        Media.duration.is_(None)
    )  # images have no duration

    if sort == "newest":
        sort_col = Media.created_at
        parse_val_from_cursor = lambda val_str: datetime.fromisoformat(val_str)
    elif sort == "latest":
        sort_col = Media.inserted_at
        parse_val_from_cursor = lambda val_str: datetime.fromisoformat(val_str)
    else:
        raise ValueError(f"Unsupported sort option: {sort}")

    stmt = stmt.order_by(sort_col.desc(), Media.id.desc())

    if cursor:
        try:
            val_str, id_str = cursor.split("_", 1)
            prev_cursor_val = parse_val_from_cursor(val_str)
            prev_cursor_id = int(id_str)
        except ValueError:
            logger.warning("Warning: Invalid cursor format: %s", cursor)
        else:
            stmt = stmt.where(
                or_(
                    sort_col < prev_cursor_val,
                    and_(
                        sort_col == prev_cursor_val, Media.id < prev_cursor_id
                    ),
                )
            )

    medias = session.exec(stmt.limit(limit)).all()
    if len(medias) == limit:
        last = medias[-1]
        v = getattr(last, "created_at" if sort == "newest" else "inserted_at")
        val_token = v.isoformat()
        next_cursor = f"{val_token}_{last.id}"
    else:
        next_cursor = None
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
        stmt = stmt.where(Media.id < before_id)
    results = session.exec(stmt.limit(limit)).all()
    next_cursor = str(results[-1].id) if len(results) == limit else None
    return CursorPage(items=results, next_cursor=next_cursor)


@router.post("/{media_id}/open-folder", status_code=204)
def open_media_folder(
    media_id: int,
    session: Session = Depends(get_session),
):
    """Open the directory containing the media file in the OS file browser.

    Only supported when running as a packaged/binary app and not in Docker.
    """
    if settings.general.is_docker:
        raise HTTPException(400, "Opening folders not supported in Docker")
    if not settings.general.is_binary:
        raise HTTPException(400, "Opening folders only allowed in binary mode")

    media = session.get(Media, media_id)
    if not media:
        raise HTTPException(404, "Media not found")

    media_path = Path(media.path)
    parent = media_path.parent
    if not parent.exists():
        raise HTTPException(404, "Media directory not found")

    try:
        if sys.platform.startswith("win"):
            subprocess.Popen(["explorer", str(parent)])
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(parent)])
        else:
            # Linux and others
            subprocess.Popen(["xdg-open", str(parent)])
    except Exception as e:
        raise HTTPException(500, f"Failed to open folder: {e}")
    return


@router.get("/{media_id}/neighbors", response_model=MediaNeighbors)
def get_neighbors(
    media_id: int,
    session: Session = Depends(get_session),
    sort: Annotated[str, Query(enum=["newest", "latest"])] = "newest",
    filter_people: list[int] | None = Query(
        [], description="Provide a persons context for navigation"
    ),
):
    if sort == "newest":
        sort_col = Media.created_at
        sort_col_name = "created_at"
    elif sort == "latest":
        sort_col = Media.inserted_at
        sort_col_name = "inserted_at"
    else:
        raise ValueError(f"Unsupported sort option: {sort}")

    original = session.get(Media, media_id)
    if not original:
        raise HTTPException(404, "Media not found")

    original_sort_value = getattr(original, sort_col_name)
    q = select(Media)

    if filter_people:
        q = q.join(Face, Face.media_id == Media.id).where(
            Face.person_id.in_(filter_people)
        )

    previous_query = (
        q.where(
            tuple_(sort_col, Media.id) > (original_sort_value, original.id)
        )
        .order_by(sort_col.asc(), Media.id.asc())
        .limit(1)
    )
    next_query = (
        q.where(
            tuple_(sort_col, Media.id) < (original_sort_value, original.id)
        )
        .order_by(sort_col.desc(), Media.id.desc())
        .limit(1)
    )
    prev_row = session.exec(previous_query).first()
    next_row = session.exec(next_query).first()
    next_media = None
    previous_media = None
    if next_row:
        next_media = MediaPreview.model_validate(next_row)
    if prev_row:
        previous_media = MediaPreview.model_validate(prev_row)
    return MediaNeighbors(
        next_media=next_media,
        previous_media=previous_media,
    )


@router.get("/{media_id}", response_model=MediaDetail)
def get_media(media_id: int, session: Session = Depends(get_session)):
    profile_face_alias = aliased(Face)

    statement = (
        select(
            Media,
            Person,
        )
        .outerjoin(Media.faces)
        .outerjoin(Face.person)
        .outerjoin(profile_face_alias, Person.profile_face)
        .where(Media.id == media_id)
        .group_by(Person.id)
        .options(selectinload(Media.tags))
    )
    rows = session.exec(statement).all()
    if not rows:
        raise HTTPException(404, "Media not found")

    media = rows[0][0]
    seen = set()
    persons: list[PersonRead] = []
    orphans: list[Face] = []
    for _, person in rows:
        if person and person.id not in seen:
            seen.add(person.id)
            persons.append(
                PersonRead(
                    **person.model_dump(),
                    profile_face=(
                        FaceRead(**person.profile_face.model_dump())
                        if person.profile_face
                        else None
                    ),
                )
            )
    orphans = [f for f in media.faces if not f.person]
    return MediaDetail(media=media, persons=persons, orphans=orphans)


@router.get(
    "/{media_id}/scenes.vtt",
    response_class=PlainTextResponse,
    summary="Serve a WebVTT file mapping scene start/end → thumbnail",
)
def scenes_vtt(
    media_id: int, request: Request, session: Session = Depends(get_session)
):
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

    lines = ["WEBVTT", ""]
    for s in scenes:
        start = format_timestamp(s.start_time)
        end_time = s.end_time or (s.start_time + 0.1)
        end = format_timestamp(end_time)
        lines += [
            f"{start} --> {end}",
            f"/thumbnails/{s.thumbnail_path}",
            "",
        ]

    return PlainTextResponse("\n".join(lines), media_type="text/vtt")


@router.delete(
    "/{media_id}/file",
    summary="Permanently delete the media file & its thumbnail from disk",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_media_file(media_id: int, session: Session = Depends(get_session)):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
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
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    delete_record(media_id, session)


@router.get("/exif/{media_id}", response_model=ExifData)
def read_exif(media_id: int, session=Depends(get_session)):
    ex = session.exec(
        select(ExifData).where(ExifData.media_id == media_id)
    ).first()
    if not ex:
        raise HTTPException(404, "No EXIF data")
    return ex


@router.get("/{media_id}/get-similar", response_model=list[MediaPreview])
def get_similar_media(media_id: int, k: int = 8, session=Depends(get_session)):
    # Ensure an anchor embedding exists for this media
    has_vec = session.exec(
        text("SELECT 1 FROM media_embeddings WHERE media_id = :id").bindparams(
            id=media_id
        )
    ).first()
    if not has_vec:
        raise HTTPException(404, "No embedding found for this media")

    max_dist = 2.0 - settings.ai.min_similarity_dist
    # Fully in-DB nearest-neighbor query using the anchor vector via subquery
    rows = session.exec(
        text(
            """
            SELECT media_id, distance
              FROM media_embeddings
             WHERE embedding MATCH (
                       SELECT embedding
                         FROM media_embeddings
                        WHERE media_id = :id
                   )
               AND k = :k
               AND distance < :maxd
             ORDER BY distance
            """
        ).bindparams(id=media_id, k=k + 1, maxd=max_dist)
    ).all()

    # Exclude the anchor and preserve order; cap to k
    media_ids = [row[0] for row in rows if row[0] != media_id][:k]
    if not media_ids:
        return []

    media_objs = session.exec(
        select(Media).where(Media.id.in_(media_ids))
    ).all()
    id_to_obj = {m.id: m for m in media_objs}
    ordered = [id_to_obj[mid] for mid in media_ids if mid in id_to_obj]
    return [MediaPreview.model_validate(m) for m in ordered]


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
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
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
