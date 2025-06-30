from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select, delete
from app.database import get_session
from app.models import Media, DuplicateGroup, DuplicateMedia
from app.schemas.duplicates import (
    DuplicatePage,
    ResolveDuplicatesRequest,
    DuplicateGroup as DuplicateGroupSchema,
)
from sqlalchemy.orm import selectinload
from app.schemas.media import MediaPreview
from app.models import Blacklist
from app.utils import delete_file, delete_record

router = APIRouter()


@router.get("", response_model=DuplicatePage)
def get_duplicates(
    session: Session = Depends(get_session),
    cursor: int | None = Query(
        None, description="DuplicateGroup ID to start from."
    ),
    limit: int = Query(10, ge=1, le=50),
):
    """
    Returns a paginated list of duplicate image groups, each structured as an object.
    This version is optimized to prevent N+1 query issues.
    """
    # 1. The main query now includes .options(selectinload(...))
    # This tells SQLAlchemy to pre-load the related media for all groups in the batch.
    query = (
        select(DuplicateGroup)
        .options(
            selectinload(DuplicateGroup.media_links).selectinload(
                DuplicateMedia.media
            )
        )
        .order_by(DuplicateGroup.id)
    )

    if cursor:
        query = query.where(DuplicateGroup.id > cursor)

    duplicate_groups_db = session.exec(query.limit(limit)).all()

    # 2. Build the structured response. The loop is now much simpler.
    response_items: list[DuplicateGroupSchema] = []
    for group_db in duplicate_groups_db:
        # Thanks to selectinload, group_db.media_links and link.media are already loaded
        # with no extra database queries inside this loop.
        media_objects = sorted(
            [link.media for link in group_db.media_links], key=lambda m: m.id
        )

        # Create the Pydantic model for the group
        group_schema = DuplicateGroupSchema(
            group_id=group_db.id,
            items=[MediaPreview.model_validate(m) for m in media_objects],
        )
        response_items.append(group_schema)
    # 3. Calculate the next cursor
    next_cursor = None
    if len(duplicate_groups_db) == limit:
        next_cursor = duplicate_groups_db[-1].id

    # 4. Return the final, correctly shaped page object
    return DuplicatePage(items=response_items, next_cursor=next_cursor)


@router.post("/resolve")
def resolve_duplicate_group(
    request: ResolveDuplicatesRequest, session: Session = Depends(get_session)
):
    # 1. Find all media IDs in the group
    stmt = select(DuplicateMedia).where(
        DuplicateMedia.group_id == request.group_id
    )
    all_duplicates_in_group = session.exec(stmt).all()
    all_media_ids_in_group = {dm.media_id for dm in all_duplicates_in_group}

    # Ensure the master ID is actually in the group
    if request.master_media_id not in all_media_ids_in_group:
        raise HTTPException(
            status_code=404,
            detail="Master media ID not found in the specified group.",
        )

    ids_to_process = all_media_ids_in_group - {request.master_media_id}

    media_to_process_stmt = select(Media).where(Media.id.in_(ids_to_process))
    media_to_process = session.exec(media_to_process_stmt).all()

    # 2. Perform the requested action on all other media items
    for media in media_to_process:
        if request.action == "DELETE_FILES":
            # Delete the file from disk (add your file deletion logic here)
            # delete_file_from_disk(media.path)
            delete_file(session, media.id)

        elif request.action == "DELETE_RECORDS":
            delete_record(media.id, session)

        elif request.action == "BLACKLIST_RECORDS":
            # Add to blacklist table
            blacklist_entry = Blacklist(path=media.path)
            session.add(blacklist_entry)
            delete_record(media.id, session)

    # 3. Delete the original DuplicateMedia entries and the group itself
    session.exec(
        delete(DuplicateMedia).where(
            DuplicateMedia.group_id == request.group_id
        )
    )
    session.exec(
        delete(DuplicateGroup).where(DuplicateGroup.id == request.group_id)
    )

    session.commit()

    return {"message": f"Group {request.group_id} resolved successfully."}
