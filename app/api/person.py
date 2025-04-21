from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select, update

from pydantic import BaseModel
from app.database import get_session
from app.models import Face, Person
from app.schemas.person import (
    PersonRead,
    FaceRead,
    PersonDetail,
    PersonUpdate,
    MergePersonsRequest,
)
from app.utils import logger

router = APIRouter()


@router.get("/", response_model=list[PersonRead])
def list_persons(session=Depends(get_session)):
    q = select(Person).options(
        selectinload(Person.profile_face)
    )  # load the FK’d face
    people = session.exec(q).all()
    return [
        PersonRead(
            **p.dict(),
            profile_face=(
                FaceRead(**p.profile_face.dict()) if p.profile_face else None
            ),
        )
        for p in people
    ]


@router.get("/{person_id}", response_model=PersonDetail)
def get_person(person_id: int, session: Session = Depends(get_session)):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
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
        "ethnicity": person.ethnicity,
        "tags": person.tags,
    }
    logger.error(person.profile_face_id)
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
    session.commit()
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
    session.commit()
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
    session.commit()

    # Return the updated target person
    session.refresh(target)
    return target


@router.get("/", response_model=list[Person])
def search_persons(
    name: str | None = Query(
        None, description="Filter by substring match on name"
    ),
    skip: int = 0,
    limit: int = 50,
    session: Session = Depends(get_session),
):
    q = select(Person)
    if name:
        q = q.where(Person.name.ilike(f"%{name}%"))
    q = q.offset(skip).limit(limit)
    return session.exec(q).all()
