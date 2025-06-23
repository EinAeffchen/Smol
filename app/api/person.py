from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy import and_, desc, func, or_, tuple_
from sqlalchemy.orm import defer
from sqlmodel import Session, delete, distinct, select, text, update

from app.config import READ_ONLY
from app.database import get_session, safe_commit, safe_execute
from app.logger import logger
from app.models import Face, Media, Person, PersonTagLink
from app.schemas.face import CursorPage as FaceCursorPage
from app.schemas.person import (
    CursorPage,
    FaceRead,
    MediaCursorPage,
    MergePersonsRequest,
    PersonDetail,
    PersonRead,
    PersonUpdate,
    ProfileFace,
    PersonReadSimple,
    SimilarPerson,
)
from app.utils import (
    get_person_embedding,
    refresh_similarities_for_person,
    update_person_embedding,
)

router = APIRouter()


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
        .options(defer(Face.embedding))
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

    media_id_subquery = (
        select(Face.media_id)
        .where(Face.person_id.in_(all_required_ids))
        .group_by(Face.media_id)
        .having(
            func.count(func.distinct(Face.person_id)) == required_ids_count
        )
    ).subquery()

    q = select(Media).join(
        media_id_subquery, Media.id == media_id_subquery.c.media_id
    )

    if cursor:
        try:
            created_at_str, media_id_str = cursor.rsplit("_", 1)
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
    return PersonDetail(
        id=person.id,
        name=person.name,
        profile_face_id=person.profile_face_id,
        profile_face=ProfileFace(
            id=person.profile_face.id,
            thumbnail_path=person.profile_face.thumbnail_path,
        ),
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
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
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
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
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
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
        )
    sid, tid = body.source_id, body.target_id
    if sid == tid:
        raise HTTPException(
            status_code=400, detail="source_id and target_id must differ"
        )

    source = session.get(Person, sid)
    source_media_count = source.appearance_count
    target = session.get(Person, tid)
    target.appearance_count += source_media_count
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

    session.refresh(target)
    safe_commit(session)
    return target


@router.delete(
    "/{person_id}",
    summary="Delete a person and all their faces",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_person(person_id: int, session: Session = Depends(get_session)):
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
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
    if READ_ONLY:
        return HTTPException(
            status_code=403, detail="Not allowed in READ_ONLY mode."
        )
    if not session.get(Person, person_id):
        raise HTTPException(404, "Person not found")

    # enqueue the compute in the background
    refresh_similarities_for_person(person_id)
    return {"detail": "Similarity refresh started"}
