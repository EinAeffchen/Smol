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
from sqlalchemy.orm import selectinload
from sqlmodel import Session, delete, select, text, update

from app.database import get_session, safe_commit
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
from app.utils import (
    get_person_embedding,
    refresh_similarities_for_person,
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
                    and person_id = -1
             ORDER BY distance
            LIMIT :k
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
    person.views += 1
    q = (
        select(Face)
        .where(Face.person_id == person.id)
        .options(selectinload(Face.media))
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
        logger.debug("PERSON: %s", dict_person)
    return {
        "person": dict_person,
        "faces": [
            {
                "id": face.id,
                "person_id": face.person_id,
                "thumbnail_path": face.thumbnail_path,
                "media_id": face.media_id,
            }
            for face in faces
        ],
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
    target_emb = get_person_embedding(session, tid)
    sql = text(
        """
        UPDATE person_embeddings
        set embedding=:emb
        WHERE person_id=:p_id
        """
    ).bindparams(p_id=tid, emb=json.dumps(target_emb.tolist()))
    session.exec(sql)
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
    response_model=list[SimilarPerson],
    summary="Get stored similarity scores for a person",
)
def get_similarities(
    person_id: int,
    session: Session = Depends(get_session),
):
    # ensure person exists
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")
    target_row = session.exec(
        text(
            "SELECT embedding FROM person_embeddings "
            "WHERE person_id = :p_id LIMIT 1"
        ).bindparams(p_id=person_id)
    ).first()
    if not target_row:
        return []

    vec_json = target_row[0]

    # 3) one GROUP-BY query:
    sql = text(
        """
      SELECT
        p.id                                  AS person_id,
        p.name                                AS name,
        ROUND(
            (1.0 - (MIN(pe.distance)*MIN(pe.distance)) / 2.0) * 100,
            2
            ) AS similarity_pct
      FROM person_embeddings AS pe
      JOIN person AS p
        ON p.id = pe.person_id
      WHERE
        pe.person_id    != :p_id              -- drop self
        AND pe.embedding MATCH :vec           -- top-level MATCH
        AND k               = :k              -- KNN constraint
      GROUP BY
        pe.person_id, p.name
      ORDER BY
        MIN(pe.distance)                      -- closest first
    """
    ).bindparams(
        p_id=person_id, vec=vec_json, k=20  # your desired neighbours
    )

    rows = session.exec(sql).all()
    return [
        SimilarPerson(id=rid, name=rname, similarity=sim)
        for rid, rname, sim in rows
    ]


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
    if not session.get(Person, person_id):
        raise HTTPException(404, "Person not found")

    # enqueue the compute in the background
    refresh_similarities_for_person(person_id)
    return {"detail": "Similarity refresh started"}


@router.post(
    "/{person_id}/auto-set-age",
    summary="Automatically sets age and gender based on faces",
    status_code=status.HTTP_202_ACCEPTED,
)
def auto_set_age(
    person_id: int,
    session: Session = Depends(get_session),
):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(404, "Person not found")

    session.add(person)
    safe_commit(session)
