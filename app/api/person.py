from typing import Any

import numpy as np
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    status,
)
from pydantic import BaseModel
from sqlalchemy.orm import selectinload
from sqlmodel import Session, delete, select, update

from app.config import THUMB_DIR
from app.database import get_session, safe_commit
from app.models import Face, Person, PersonSimilarity, PersonTagLink
from app.schemas.person import (
    FaceRead,
    MergePersonsRequest,
    PersonDetail,
    PersonRead,
    PersonUpdate,
    SimilarPerson,
)
from app.utils import (
    cosine_similarity,
    get_person_embedding,
    logger,
    refresh_similarities_for_person,
)

router = APIRouter()


@router.get("/", response_model=list[PersonRead])
def list_persons(
    name: str | None = Query(
        None, description="Filter by substring match on name"
    ),
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_session),
):
    q = select(Person).options(
        selectinload(Person.profile_face)
    )  # load the FK’d face
    if name:
        q = q.where(Person.name.ilike(f"%{name}%"))
    q = q.offset(skip).limit(limit)
    q = q.order_by(Person.views.desc())
    people = session.exec(q).all()
    return [
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


@router.get("/{person_id}/suggest-faces", response_model=list[FaceRead])
def suggest_faces(person_id: int, session: Session = Depends(get_session)):
    # 1) must exist
    if not session.get(Person, person_id):
        raise HTTPException(404, "Person not found")

    # 2) get the person’s average embedding
    target = get_person_embedding(session, person_id)
    if target is None:
        return []

    # 3) fetch all unassigned faces with embeddings
    all_orphans = session.exec(
        select(Face).where(Face.person_id.is_(None), Face.embedding != None)
    ).all()

    # 4) compute similarity scores
    scored = []
    for f in all_orphans:
        emb = np.array(f.embedding, dtype=np.float32)
        sim = cosine_similarity(target, emb)
        scored.append((f, sim))

    # 5) pick top 10
    top10 = sorted(scored, key=lambda x: x[1], reverse=True)[:10]
    return [
        FaceRead(
            id=f.id,
            media_id=f.media_id,
            thumbnail_path=f.thumbnail_path,
            bbox=f.bbox,
        )
        for f, _ in top10
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
    dict_person = {
        "id": person.id,
        "name": person.name,
        "age": person.age,
        "gender": person.gender,
        "tags": person.tags,
    }
    if person.profile_face_id and person.profile_face:
        dict_person["profile_face_id"] = person.profile_face_id
        dict_person["profile_face"] = {
            "id": person.profile_face.id,
            "thumbnail_path": person.profile_face.thumbnail_path,
        }
        logger.debug("PERSON: %s", dict_person)
    return {
        "person": dict_person,
        "tags": person.tags,
        "faces": [
            {
                "id": face.id,
                "person_id": face.person_id,
                "thumbnail_path": face.thumbnail_path,
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
    logger.warning(data)
    updates = data.dict(exclude_unset=True)
    logger.warning(updates)
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

    # Return the updated target person
    session.refresh(target)
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
        # delete thumbnail file if it exists
        try:
            thumb_path = THUMB_DIR / face.thumbnail_path
            if thumb_path.exists():
                thumb_path.unlink()
        except Exception:
            pass
        session.delete(face)

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
    if not session.get(Person, person_id):
        raise HTTPException(404, "Person not found")

    sims = session.exec(
        select(PersonSimilarity)
        .where(PersonSimilarity.person_id == person_id)
        .order_by(PersonSimilarity.similarity.desc())
        .limit(16)
    ).all()

    result: list[SimilarPerson] = []

    for sim in sims:
        logger.debug("Other: %s", sim)
        other = session.get(Person, sim.other_id)
        if not other:
            session.exec(
                delete(PersonSimilarity).where(
                    PersonSimilarity.other_id == sim.other_id
                )
            )
            continue
        result.append(
            SimilarPerson(
                id=other.id, name=other.name, similarity=sim.similarity
            )
        )
    return result


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
    background_tasks.add_task(refresh_similarities_for_person, person_id)
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
