import json
from typing import Any

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    status,
)
from sqlalchemy.orm import selectinload, defer
from sqlmodel import Session, delete, select, text, update

from app.database import get_session, safe_commit, safe_execute
from app.logger import logger
from app.models import Face, Person, PersonTagLink
from app.schemas.person import (
    CursorPage,
    FaceRead,
    MergePersonsRequest,
    PersonDetail,
    PersonRead,
    PersonUpdate,
    SimilarPerson,
)
from app.schemas.face import CursorPage as FaceCursorPage
from app.utils import (
    get_person_embedding,
    update_person_embedding,
    refresh_similarities_for_person,
)
from app.config import READ_ONLY

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
    before_id = None
    if cursor:
        before_id = int(cursor)

    q = select(Person).options(
        selectinload(Person.profile_face)
    )  # load the FK’d face
    if name:
        q = q.where(Person.name.ilike(f"%{name}%"))
    q = q.limit(limit)
    q = q.order_by(Person.id.desc())
    if before_id:
        q = q.where(Person.id < before_id)

    people = session.exec(q).all()
    items = [
        PersonRead(
            **p.model_dump(),
            profile_face=(
                FaceRead(**p.profile_face.model_dump())
                if p.profile_face
                else None
            ),
        )
        for p in people
    ]
    if len(items) == limit:
        next_cursor = str(people[-1].id)
    else:
        next_cursor = None
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
                    and distance < 1.5
             ORDER BY distance
            """
    ).bindparams(vec=json.dumps(target.tolist()), k=limit)
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
    q = (
        select(Face)
        .where(Face.person_id == person.id)
        .options(selectinload(Face.media), defer(Face.embedding))
    )
    faces: list[Face] = session.exec(q).all()
    seen = set()
    medias: list[dict[str, Any]] = []
    for f in faces:
        m = f.media
        if not m or m.id in seen:
            continue
        seen.add(m.id)
        medias.append(
            {
                "id": m.id,
                "path": m.path,
                "filename": m.filename,
                "duration": m.duration,
                "width": m.width,
                "height": m.height,
                "views": m.views,
                "inserted_at": m.inserted_at.isoformat(),
            }
        )
        medias = sorted(medias, key=lambda a: a["inserted_at"])
    dict_person = {
        "id": person.id,
        "name": person.name,
        "age": person.age,
        "gender": person.gender,
    }
    if person.profile_face_id and person.profile_face:
        dict_person["profile_face_id"] = person.profile_face_id
        dict_person["profile_face"] = {
            "id": person.profile_face.id,
            "thumbnail_path": person.profile_face.thumbnail_path,
        }
        dict_person["tags"] = person.tags
    return {
        "person": dict_person,
        "medias": medias,
    }


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
    target = session.get(Person, tid)
    if not source or not target:
        raise HTTPException(
            status_code=404, detail="Source or target person not found"
        )

    # Reassign all faces from source -> target
    session.exec(
        update(Face).where(Face.person_id == sid).values(person_id=tid)
    )

    # Delete the now-empty source person
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
    # Return the updated target person
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

    # 1) delete all Face rows for this person (and remove thumbnails)
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
    # 2) remove any person–tag links
    session.exec(
        delete(PersonTagLink).where(PersonTagLink.person_id == person_id)
    )

    # 3) delete the Person record itself
    session.delete(person)
    safe_commit(session)


@router.get(
    "/{person_id}/similarities",
    response_model=list[SimilarPerson],  # Uses the updated SimilarPerson model
    summary="Get stored similarity scores for a person including name and thumbnail",
)
def get_similarities(
    person_id: int,
    session: Session = Depends(get_session),
    # k_neighbors: int = 20, # Optional: make 'k' a query parameter
):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    vec = get_person_embedding(
        session, person_id
    )  # Assuming this returns the embedding vector
    if (
        vec is None
    ):  # If the target person has no embedding, no similarities can be found
        return []

    k_val = 20  # Your desired number of neighbors

    # Updated SQL query
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
        vec=(
            json.dumps(vec.tolist())
            if hasattr(vec, "tolist")
            else json.dumps(vec)
        ),  # Handle numpy array or list
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
    background_tasks: BackgroundTasks,
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
