from fastapi import APIRouter, Query, Body, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, delete, select, text

from app.config import THUMB_DIR
from app.database import get_session, safe_commit
from app.models import Face, Person, PersonSimilarity, PersonTagLink
from app.schemas.face import FaceAssign, FaceRead, CursorPage
from app.schemas.person import PersonRead
from app.logger import logger

router = APIRouter()


@router.post(
    "/{face_id}/assign",
    summary="Assign an existing face to a person",
    response_model=Face,
)
def assign_face(
    face_id: int,
    body: FaceAssign = Body(...),
    session: Session = Depends(get_session),
):
    face = session.get(Face, face_id)
    if not face:
        raise HTTPException(status_code=404, detail="Face not found")

    person = session.get(Person, body.person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")

    old_person = face.person
    face.person_id = person.id
    sql = text(
        """
                UPDATE face_embeddings
                set person_id=:p_id
                WHERE face_id=:f_id
                """
    ).bindparams(p_id=person.id, f_id=face.id)
    session.exec(sql)
    session.add(face)
    safe_commit(session)

    if old_person and old_person.id != body.person_id:
        old_person_can_be_deleted(session, old_person)
    session.refresh(face)
    return face


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
    session.delete(face)
    old_person_can_be_deleted(session, face.person)
    safe_commit(session)


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
    orphans = session.exec(query.limit(limit)).all()

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
def create_person_from_face(
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
    sql = text(
        """
                UPDATE face_embeddings
                set person_id=:p_id
                WHERE face_id=:f_id
                """
    ).bindparams(p_id=person.id, f_id=face.id)
    session.exec(sql)
    safe_commit(session)
    session.refresh(person)

    # 2) Assign the face
    face.person_id = person.id
    session.add(face)
    safe_commit(session)
    if previous_person and previous_person.id != person.id:
        old_person_can_be_deleted(session, previous_person)
    return person


def old_person_can_be_deleted(session, person: Person):
    if person is None:
        return
    remaining = session.exec(
        select(Face).where(Face.person_id == person.id)
    ).all()
    if remaining:
        return
    # delete any tag links
    session.exec(
        delete(PersonTagLink).where(PersonTagLink.person_id == person.id)
    )
    session.exec(
        delete(PersonSimilarity).where(PersonSimilarity.person_id == person.id)
    )
    session.exec(
        delete(PersonSimilarity).where(PersonSimilarity.other_id == person.id)
    )
    session.delete(person)
    safe_commit(session)
