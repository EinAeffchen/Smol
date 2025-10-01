from datetime import date, datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import (
    and_,
    desc,
    func,
    literal_column,
    or_,
    tuple_,
    union_all,
)
from sqlmodel import Session, delete, distinct, select, text, update

from app.config import settings
from app.database import get_session, safe_commit, safe_execute
from app.logger import logger
from app.models import Face, Media, Person, PersonTagLink, TimelineEvent
from app.schemas.face import CursorPage as FaceCursorPage
from app.schemas.person import (
    CursorPage,
    FaceRead,
    MediaCursorPage,
    MergePersonsRequest,
    PersonDetail,
    PersonRead,
    PersonReadSimple,
    PersonUpdate,
    ProfileFace,
    SimilarPerson,
)
from app.schemas.timeline import (
    TimelineEventCreate,
    TimelineEventUpdate,
    TimelinePage,
)
from app.utils import (
    get_person_embedding,
    recalculate_person_appearance_counts,
    refresh_similarities_for_person,
    update_person_embedding,
)

router = APIRouter()


# Timeline events
@router.get("/{person_id}/timeline", response_model=TimelinePage)
def get_person_timeline(
    person_id: int,
    session: Session = Depends(get_session),
    cursor: str | None = None,
    limit: int = 1000,
):
    media_ids_subquery = (
        select(Face.media_id).where(Face.person_id == person_id).distinct()
    )
    media_query = (
        select(
            Media.id.label("item_id"),
            func.date(Media.created_at).label("timeline_date"),
            literal_column("'media'").label("item_type"),
        )
        .where(Media.id.in_(media_ids_subquery))
        .where(Media.created_at.is_not(None))
    )

    # Subquery for one-time TimelineEvent items
    events_query = (
        select(
            TimelineEvent.id.label("item_id"),
            TimelineEvent.event_date.label("timeline_date"),
            literal_column("'event'").label("item_type"),
        )
        .where(TimelineEvent.person_id == person_id)
        .where(TimelineEvent.recurrence.is_(None))
    )

    timeline_cte = union_all(media_query, events_query).cte("timeline")

    final_query = select(
        timeline_cte.c.item_id,
        timeline_cte.c.timeline_date.label("timeline_date"),
        timeline_cte.c.item_type,
    )
    if cursor:
        try:
            cursor_date = date.fromisoformat(cursor)
            final_query = final_query.where(
                timeline_cte.c.timeline_date < cursor_date
            )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Invalid cursor format. Use YYYY-MM-DD.",
            )

    final_query = final_query.order_by(
        timeline_cte.c.timeline_date.desc()
    ).limit(limit + 1)

    page_items_result = session.exec(final_query).all()

    has_next_page = len(page_items_result) > limit
    page_items = page_items_result[:limit]

    next_cursor = str(page_items[-1].timeline_date) if has_next_page else None

    if not page_items:
        return {"items": [], "next_cursor": None}

    page_min_date = date.fromisoformat(page_items[-1].timeline_date)
    page_max_date = date.fromisoformat(page_items[0].timeline_date)

    media_ids_to_fetch = [
        item.item_id for item in page_items if item.item_type == "media"
    ]
    event_ids_to_fetch = [
        item.item_id for item in page_items if item.item_type == "event"
    ]

    media_on_page = session.exec(
        select(Media).where(Media.id.in_(media_ids_to_fetch))
    ).all()
    events_on_page = session.exec(
        select(TimelineEvent).where(TimelineEvent.id.in_(event_ids_to_fetch))
    ).all()

    media_map = {m.id: m for m in media_on_page}
    event_map = {e.id: e for e in events_on_page}

    combined_items = []
    for item in page_items:
        if item.item_type == "media":
            combined_items.append(media_map.get(item.item_id))
        elif item.item_type == "event":
            combined_items.append(event_map.get(item.item_id))

    combined_items = [i for i in combined_items if i]

    recurring_events = session.exec(
        select(TimelineEvent).where(
            TimelineEvent.person_id == person_id,
            TimelineEvent.recurrence == "yearly",
        )
    ).all()

    for event in recurring_events:
        for year in range(page_min_date.year, page_max_date.year + 1):
            try:
                occurrence_date = event.event_date.replace(year=year)
                if page_min_date <= occurrence_date <= page_max_date:
                    event_data = event.model_dump()
                    event_data["event_date"] = occurrence_date
                    event_occurrence = TimelineEvent.model_validate(event_data)
                    combined_items.append(event_occurrence)
            except ValueError:
                continue

    def get_date(item: Media | TimelineEvent) -> date:
        return (
            item.created_at.date()
            if isinstance(item, Media)
            else item.event_date
        )

    combined_items.sort(key=get_date, reverse=True)

    timeline_items = []
    for item in combined_items:
        if isinstance(item, Media):
            timeline_items.append({
                "type": "media",
                "date": get_date(item),
                "items": item,
            })
        elif isinstance(item, TimelineEvent):
            timeline_items.append({
                "type": "event",
                "date": get_date(item),
                "event": item,
            })

    return {"items": timeline_items, "next_cursor": next_cursor}


@router.post("/{person_id}/events", response_model=TimelineEvent)
def create_person_event(
    person_id: int,
    event: TimelineEventCreate,
    session: Session = Depends(get_session),
):
    """Create a new timeline event for a specific person."""
    db_event = TimelineEvent.model_validate(
        event, update={"person_id": person_id}
    )
    session.add(db_event)
    session.commit()
    session.refresh(db_event)
    return db_event


@router.put("/{person_id}/events/{event_id}", response_model=TimelineEvent)
def update_person_event(
    person_id: int,  # Included for RESTful consistency, though not strictly needed for the query
    event_id: int,
    event_update: TimelineEventUpdate,
    session: Session = Depends(get_session),
):
    """Update an existing timeline event."""
    db_event = session.get(TimelineEvent, event_id)
    if not db_event or db_event.person_id != person_id:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = event_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_event, key, value)

    session.add(db_event)
    session.commit()
    session.refresh(db_event)
    return db_event


@router.delete("/{person_id}/events/{event_id}", status_code=204)
def delete_person_event(
    person_id: int, event_id: int, session: Session = Depends(get_session)
):
    """Delete a timeline event."""
    db_event = session.get(TimelineEvent, event_id)
    if db_event and db_event.person_id == person_id:
        session.delete(db_event)
        session.commit()
    return {"ok": True}  # Return nothing on 204


@router.get("/", response_model=CursorPage)
def list_persons(
    name: str | None = Query(
        None, description="Filter by substring match on name"
    ),
    cursor: str | None = Query(
        None,
        description="encoded as `<id>`; e.g. `2025-05-05T12:34:56.789012_1234` or `2500_1234`",
    ),
    limit: int = 50,
    session: Session = Depends(get_session),
):
    before_count = None
    before_id = None
    if cursor:
        try:
            count, raw_id = cursor.split("_")
            before_count = int(count)
            before_id = int(raw_id)
        except (ValueError, TypeError):
            raise HTTPException(400, "Invalid cursor format")

    q = select(Person)

    if name:
        q = q.where(Person.name.ilike(f"%{name}%"))

    if cursor and before_id is not None and before_count is not None:
        q = q.where(
            or_(
                Person.appearance_count < before_count,
                and_(
                    Person.appearance_count == before_count,
                    Person.id < before_id,
                ),
            )
        )

    q = q.order_by(Person.appearance_count.desc(), Person.id.desc())
    q = q.limit(limit)
    people_with_counts = session.exec(q).all()
    items = [
        PersonRead(
            **person.model_dump(),
            profile_face=(
                FaceRead(**person.profile_face.model_dump())
                if person.profile_face
                else None
            ),
        )
        for person in people_with_counts
    ]

    next_cursor = None
    if len(items) == limit:
        last_person = people_with_counts[-1]
        next_cursor = f"{last_person.appearance_count}_{last_person.id}"

    return CursorPage(next_cursor=next_cursor, items=items)


@router.get("/{person_id}/suggest-faces", response_model=list[FaceRead])
def suggest_faces(
    person_id: int, limit: int = 20, session: Session = Depends(get_session)
):
    # 1) must exist
    if not session.get(Person, person_id):
        raise HTTPException(404, "Person not found")

    # 2) get the person’s average embedding
    target = get_person_embedding(session, person_id)
    if target is None:
        return []
    sql = text(
        """
            SELECT face_id, distance
              FROM face_embeddings
             WHERE embedding MATCH :vec
                    and k = :k
                    and person_id = -1
                    and distance < 1.3
             ORDER BY distance
            """
    ).bindparams(vec=target, k=limit)
    rows = session.exec(sql).all()
    face_ids = [r[0] for r in rows]

    faces = session.exec(select(Face).where(Face.id.in_(face_ids))).all()
    id_map = {f.id: f for f in faces}
    ordered = [id_map[f] for f in face_ids if f in id_map]

    return [
        FaceRead(
            id=f.id,
            media_id=f.media_id,
            thumbnail_path=f.thumbnail_path,
        )
        for f in ordered
    ]


@router.get("/{person_id}/faces", response_model=FaceCursorPage)
def get_faces(
    person_id: int,
    session: Session = Depends(get_session),
    cursor: str | None = Query(
        None,
        description="encoded as `<id>`; e.g. `1234`",
    ),
    limit: int = 10,
):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    before_id = None
    if cursor:
        before_id = int(cursor)
    q = (
        select(Face)
        .where(Face.person_id == person.id)
        .order_by(Face.id.desc())
    )
    if before_id:
        q = q.where(Face.id < before_id)

    faces = safe_execute(session, q.limit(limit)).all()
    if len(faces) == limit:
        next_cursor = str(faces[-1].id)
    else:
        next_cursor = None

    return FaceCursorPage(next_cursor=next_cursor, items=faces)


@router.get("/all-simple", response_model=list[PersonReadSimple])
def get_all_persons_simple(session: Session = Depends(get_session)):
    """Returns a lightweight list of all persons for filter selections."""
    people = session.exec(select(Person).order_by(Person.name)).all()
    return [PersonReadSimple.model_validate(p) for p in people]


@router.get("/{person_id}/media-appearances", response_model=MediaCursorPage)
def get_appearances(
    person_id: int,
    with_person_ids: list[int] = Query(
        [], description="Filter for media that also includes these person IDs"
    ),
    limit: int = 30,
    cursor: str | None = Query(
        None,
        description="encoded as `<id>`; e.g. `2025-05-05T12:34:56.789012_1234` or `2500_1234`",
    ),
    session: Session = Depends(get_session),
):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    all_required_ids = list(set([person_id] + with_person_ids))
    required_ids_count = len(all_required_ids)

    media_id_q = (
        select(Face.media_id)
        .where(Face.person_id.in_(all_required_ids))
        .group_by(Face.media_id)
        .having(
            func.count(func.distinct(Face.person_id)) == required_ids_count
        )
    )
    matching_media_ids = session.exec(media_id_q).all()

    if not matching_media_ids:
        return CursorPage(items=[], next_cursor=None)

    q = (
        select(Media)
        .where(Media.id.in_(matching_media_ids))
        .order_by(Media.created_at.desc())
    )

    if cursor:
        try:
            created_at_str, media_id_str = cursor.rsplit("_", 1)
            logger.debug(cursor)
            logger.debug(created_at_str)
            cursor_created_at = datetime.fromisoformat(created_at_str)
            cursor_media_id = int(media_id_str)
            q = q.where(
                tuple_(Media.created_at, Media.id)
                < (cursor_created_at, cursor_media_id)
            )
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400, detail="Invalid cursor format"
            )

    q = q.order_by(desc(Media.created_at), desc(Media.id)).limit(limit)

    items = session.exec(q).all()

    next_cursor = None
    if len(items) == limit:
        last_item = items[-1]
        next_cursor = f"{last_item.created_at.isoformat()}_{last_item.id}"

    return MediaCursorPage(next_cursor=next_cursor, items=items)


@router.get("/{person_id}", response_model=PersonDetail)
def get_person(person_id: int, session: Session = Depends(get_session)):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    if person.profile_face_id and not person.profile_face:
        person.profile_face_id = None
        session.add(person)
        session.commit()
        session.refresh(person)
    stmt = (
        select(func.count(distinct(Media.id)))
        .join_from(Person, Face, Face.person_id == Person.id)
        .join_from(Face, Media, Face.media_id == Media.id)
        .where(Person.id == person_id)
    )
    media_count = session.scalar(stmt)
    if person.profile_face:
        profile_face = ProfileFace(
            id=person.profile_face.id,
            thumbnail_path=person.profile_face.thumbnail_path,
        )
    else:
        profile_face = None
    return PersonDetail(
        id=person.id,
        name=person.name,
        profile_face_id=person.profile_face_id,
        profile_face=profile_face,
        tags=person.tags,
        appearance_count=media_count,
    )


@router.patch(
    "/{person_id}",
    response_model=Person,
    summary="Update a person's details",
)
def update_person(
    person_id: int,
    data: PersonUpdate,
    session: Session = Depends(get_session),
):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    updates = data.model_dump(exclude_unset=True)
    for key, val in updates.items():
        setattr(person, key, val)
    session.add(person)
    safe_commit(session)
    session.refresh(person)
    return person


@router.post("/{person_id}/profile_face", response_model=Person)
def set_profile_face(
    person_id: int,
    face_id: int | None,
    session: Session = Depends(get_session),
):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    person.profile_face_id = face_id
    session.add(person)
    safe_commit(session)
    session.refresh(person)
    return person


@router.post(
    "/merge",
    summary="Merge one person into another",
    status_code=status.HTTP_200_OK,
)
def merge_persons(
    body: MergePersonsRequest,
    session: Session = Depends(get_session),
):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    sid, tid = body.source_id, body.target_id
    if sid == tid:
        raise HTTPException(
            status_code=400, detail="source_id and target_id must differ"
        )

    source = session.get(Person, sid)
    target = session.get(Person, tid)

    if not source or not target:
        raise HTTPException(
            status_code=404, detail="Source or target person not found"
        )

    session.exec(
        update(Face).where(Face.person_id == sid).values(person_id=tid)
    )

    session.delete(source)
    safe_commit(session)
    update_person_embedding(session, tid)
    sql = text(
        """
        DELETE FROM person_embeddings
        WHERE person_id=:p_id
        """
    ).bindparams(p_id=sid)
    session.exec(sql)
    recalculate_person_appearance_counts(session, [tid])
    session.refresh(target)
    safe_commit(session)
    return target


@router.delete(
    "/{person_id}",
    summary="Delete a person and all their faces",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_person(person_id: int, session: Session = Depends(get_session)):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    faces = session.exec(select(Face).where(Face.person_id == person_id)).all()
    for face in faces:
        face.person_id = None
        sql = text(
            """
                Update face_embeddings
                SET person_id=-1
                WHERE face_id=:f_id
                """
        ).bindparams(f_id=face.id)
        session.exec(sql)
    sql = text(
        """
        DELETE FROM person_embeddings
        WHERE person_id=:p_id
        """
    ).bindparams(p_id=person.id)
    session.exec(sql)
    session.exec(
        delete(PersonTagLink).where(PersonTagLink.person_id == person_id)
    )

    session.delete(person)
    safe_commit(session)


@router.get(
    "/{person_id}/similarities",
    response_model=list[SimilarPerson],
    summary="Get stored similarity scores for a person including name and thumbnail",
)
def get_similarities(
    person_id: int,
    session: Session = Depends(get_session),
):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    vec = get_person_embedding(session, person_id)
    if vec is None:
        return []

    k_val = 20

    sql = text(
        """
        SELECT
            p.id                          AS person_id,
            p.name                        AS person_name, -- aliased to avoid confusion if 'name' is a keyword
            profile_f.thumbnail_path      AS thumbnail_path,
            ROUND(
                (1.0 - (MIN(pe.distance) * MIN(pe.distance)) / 2.0) * 100,
                2
            )                             AS similarity_pct
        FROM person_embeddings AS pe
        JOIN person AS p
            ON p.id = pe.person_id
        LEFT JOIN face AS profile_f -- LEFT JOIN to include persons even if they don't have a profile face
            ON p.profile_face_id = profile_f.id -- Assuming Person table has profile_face_id
        WHERE
            pe.person_id != :p_id          -- Exclude the person themselves
            AND pe.embedding MATCH :vec    -- Vector similarity match (specific to your pg_embedding setup)
            AND pe.k = :k_param            -- If 'k' is a parameter for the MATCH or a column in person_embeddings
                                           -- Ensure this 'k' usage is correct for your pg_embedding extension.
                                           -- Often, for KNN, you'd use ORDER BY embedding_distance LIMIT k.
                                           -- If pe.k is a column, this is filtering on that column.
        GROUP BY
            p.id, p.name, profile_f.thumbnail_path -- Include all selected non-aggregated columns
        ORDER BY
            MIN(pe.distance) ASC           -- Closest first
        LIMIT :limit_val                   -- Limit the number of results
        """
    ).bindparams(
        p_id=person_id,
        vec=vec,  # Handle numpy array or list
        k_param=k_val,  # Parameter for the 'pe.k = :k_param' condition
        limit_val=k_val,  # Parameter for the LIMIT clause
    )

    result_rows = session.exec(sql).all()

    similar_persons_list = []
    for row in result_rows:
        similar_persons_list.append(
            SimilarPerson(
                id=row.person_id,
                name=row.person_name,
                thumbnail=row.thumbnail_path,  # Populate the new thumbnail field
                similarity=row.similarity_pct,
            )
        )

    return similar_persons_list


@router.post(
    "/{person_id}/refresh-similarities",
    summary="Recompute similarity scores for a person",
    status_code=status.HTTP_202_ACCEPTED,
)
def refresh_similarities(
    person_id: int,
    session: Session = Depends(get_session),
):
    if settings.general.read_only:
        return HTTPException(
            status_code=403,
            detail="Not allowed in settings.general.read_only mode.",
        )
    if not session.get(Person, person_id):
        raise HTTPException(404, "Person not found")

    # enqueue the compute in the background
    refresh_similarities_for_person(person_id)
    return {"detail": "Similarity refresh started"}
