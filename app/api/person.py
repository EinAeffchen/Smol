from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.database import get_session
from app.models import Person

router = APIRouter()


@router.get("/", response_model=List[Person])
def list_persons(
    name: Optional[str] = Query(None, description="Match substring in name"),
    age_min: Optional[int] = Query(None, ge=0),
    age_max: Optional[int] = Query(None, ge=0),
    gender: Optional[str] = Query(None),
    ethnicity: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1),
    session: Session = Depends(get_session),
):
    q = select(Person)
    if name:
        q = q.where(Person.name.ilike(f"%{name}%"))
    if age_min is not None:
        q = q.where(Person.age >= age_min)
    if age_max is not None:
        q = q.where(Person.age <= age_max)
    if gender:
        q = q.where(Person.gender == gender)
    if ethnicity:
        q = q.where(Person.ethnicity == ethnicity)
    q = q.offset(skip).limit(limit)
    return session.exec(q).all()


@router.get("/{person_id}", response_model=Person)
def get_person(person_id: int, session: Session = Depends(get_session)):
    person = session.get(Person, person_id)
    if not person:
        raise HTTPException(status_code=404, detail="Person not found")
    return person
