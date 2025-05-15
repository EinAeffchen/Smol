from fastapi import APIRouter, Query, Body, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, delete, select, text

from app.config import THUMB_DIR
from app.database import get_session, safe_commit, safe_execute
from app.models import Face, Person, PersonSimilarity, PersonTagLink
from app.schemas.face import FaceAssign, FaceRead, CursorPage
from app.schemas.person import PersonRead
from app.logger import logger
from app.database import engine
from app.utils import get_person_embedding
from app.write_queue import write_queue
import json
import time

router = APIRouter()


@router.post(
    "/{face_id}/assign",
    summary="Assign an existing face to a person",
    response_model=Face,
)
async def assign_face(
    face_id: int,
    body: FaceAssign = Body(...),
    session: Session = Depends(get_session),
):
    face = session.get(Face, face_id)
    if not face:
        raise HTTPException(status_code=404, detail="Face not found")
    if face.person_id == body.person_id:
        return face
    person = session.get(Person, body.person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    old_person = face.person
    if old_person:
        old_person_id = old_person.id
    else:
        old_person_id = None
    face.person = person

    session.add(face)
    face_id = face.id
    person_id = person.id

    session.refresh(face)
    safe_commit(session)

    if old_person_id and old_person_id != body.person_id:
        old_person_can_be_deleted(session, old_person_id)
    update_face_embedding(session, face_id, person_id)
    safe_commit(session)
    session.expunge(face)
    session.close()
    return face


def update_face_embedding(
    session: Session,
    face_id: int,
    person_id: int | None,
    delete_face: bool = False,
):
    if not delete_face and person_id:
        sql = text(
            """
            UPDATE face_embeddings
            set person_id=:p_id
            WHERE face_id=:f_id
            """
        ).bindparams(p_id=person_id, f_id=face_id)
    else:
        sql = text(
            """DELETE FROM face_embeddings
                   WHERE face_id=:f_id"""
        ).bindparams(f_id=face_id)
    if person_id:
        safe_execute(session, sql)
        person_embedding = get_person_embedding(session, person_id)
        sql = text(
            """
            INSERT OR REPLACE INTO person_embeddings(person_id, embedding)
            VALUES(:p_id, :emb)"""
        ).bindparams(p_id=person_id, emb=json.dumps(person_embedding.tolist()))
        safe_execute(session, sql)


@router.delete(
    "/{face_id}",
    summary="Delete a face record (and its thumbnail file)",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_face(face_id: int, session: Session = Depends(get_session)):
    face = session.get(Face, face_id)
    if not face:
        raise HTTPException(404, "Face not found")

    # remove thumbnail from disk
    thumb = THUMB_DIR / face.thumbnail_path
    if thumb.exists():
        thumb.unlink()
    face_id = face.id
    if face.person:
        person_id = face.person.id
    else:
        person_id = None
    session.delete(face)
    if not old_person_can_be_deleted(session, person_id):
        update_face_embedding(session, face_id, person_id, delete_face=True)
    safe_commit(session)
    session.close()


class FaceCreatePerson(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = None


@router.get("/orphans", response_model=CursorPage)
def get_orphans(
    session: Session = Depends(get_session),
    cursor: str | None = Query(
        None,
        description="encoded as `<id>`; e.g. `2025-05-05T12:34:56.789012_1234` or `2500_1234`",
    ),
    limit: int = 48,
):
    before_id = None
    if cursor:
        before_id = int(cursor)
    query = (
        select(Face).where(Face.person_id.is_(None)).order_by(Face.id.desc())
    )
    if before_id:
        query = query.where(Face.id < before_id)
    orphans = safe_execute(session, query.limit(limit)).all()

    if len(orphans) == limit:
        next_cursor = str(orphans[-1].id)
    else:
        next_cursor = None
    return CursorPage(next_cursor=next_cursor, items=orphans)


@router.post(
    "/{face_id}/create_person",
    summary="Create a new person from this face and assign",
    response_model=PersonRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_person_from_face(
    face_id: int,
    body: FaceCreatePerson = Body(...),
    session: Session = Depends(get_session),
):
    face = session.get(Face, face_id)
    if not face:
        raise HTTPException(status_code=404, detail="Face not found")

    previous_person = face.person
    # 1) Create the Person
    person = Person(
        name=body.name,
        age=body.age,
        gender=body.gender,
        profile_face_id=face.id,
    )
    session.add(person)
    session.flush()

    person_id = person.id
    face.person_id = person_id
    session.add(face)
    if previous_person:
        previous_person_id = previous_person.id
    else:
        previous_person_id = None
    safe_commit(session)

    if previous_person_id and previous_person_id != person_id:
        old_person_can_be_deleted(session, previous_person_id)
    update_face_embedding(session, face_id, person_id)
    session.close()
    return person


def old_person_can_be_deleted(session: Session, person_id: int | None):
    if person_id is None:
        return True
    remaining = safe_execute(
        session, select(Face).where(Face.person_id == person_id)
    ).first()
    if remaining:
        session.close()
        return False

    # delete any tag links
    safe_execute(
        session,
        delete(PersonTagLink).where(PersonTagLink.person_id == person_id),
    )
    safe_execute(
        session,
        delete(PersonSimilarity).where(
            PersonSimilarity.person_id == person_id
        ),
    )
    safe_execute(
        session,
        delete(PersonSimilarity).where(PersonSimilarity.other_id == person_id),
    )
    person = session.get(Person, person_id)
    session.delete(person)
    safe_commit(session)
    return True
