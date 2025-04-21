from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select
from pydantic import BaseModel

from app.database import get_session
from app.models import Face, Person
from app.schemas.face import FaceAssign
from app.config import THUMB_DIR

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
    face.person_id = person.id
    session.add(face)
    session.commit()
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
    session.commit()


class FaceCreatePerson(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    ethnicity: str | None = None


@router.post(
    "/{face_id}/create_person",
    summary="Create a new person from this face and assign",
    response_model=Person,
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

    # 1) Create the Person
    person = Person(
        name=body.name,
        age=body.age,
        gender=body.gender,
        ethnicity=body.ethnicity,
        profile_face_id=face.id,
    )
    session.add(person)
    session.commit()
    session.refresh(person)

    # 2) Assign the face
    face.person_id = person.id
    session.add(face)
    session.commit()

    return person
