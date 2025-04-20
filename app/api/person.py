from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from app.database import get_session
from app.models import Face, Person
from app.schemas import PersonRead, FaceRead

router = APIRouter()


@router.get("/", response_model=List[PersonRead])
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
            )
        )
        for p in people
    ]


@router.get("/{person_id}", response_model=Person)
def get_person(person_id: int, session: Session = Depends(get_session)):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person


@router.post("/{person_id}/profile_face", response_model=Person)
def set_profile_face(
    person_id: int,
    face_id: Optional[int],
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
