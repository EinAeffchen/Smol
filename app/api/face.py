from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlmodel import Session, select, delete
from pydantic import BaseModel
from fastapi.encoders import jsonable_encoder
from app.database import get_session
from app.models import Face, Person, PersonTagLink, PersonSimilarity
from app.schemas.face import FaceAssign
from app.config import THUMB_DIR
from app.utils import logger
from fastapi.responses import JSONResponse

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

    old_person_id = face.person_id
    face.person_id = person.id
    session.add(face)
    session.commit()

    if old_person_id is not None and old_person_id != body.person_id:
        remaining = session.exec(
            select(Face).where(Face.person_id == old_person_id)
        ).all()
        if not remaining:
            # delete any tag links
            session.exec(
                delete(PersonTagLink).where(
                    PersonTagLink.person_id == old_person_id
                )
            )
            session.exec(
                delete(PersonSimilarity).where(
                    PersonSimilarity.person_id == old_person_id
                )
            )
            session.exec(
                delete(PersonSimilarity).where(
                    PersonSimilarity.other_id == old_person_id
                )
            )
            # delete the person row
            person = session.get(Person, old_person_id)
            if person:
                session.delete(person)
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
        profile_face_id=face.id,
    )
    session.add(person)
    session.commit()
    session.refresh(person)

    # 2) Assign the face
    face.person_id = person.id
    session.add(face)
    session.commit()
    logger.debug("Person.id: %s", person.id)
    logger.debug(type(person))
    return person
