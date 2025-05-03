from pydantic import BaseModel, ConfigDict


class FaceRead(BaseModel):
    id: int
    media_id: int
    thumbnail_path: str

    model_config = ConfigDict(from_attributes=True)

class FaceAssign(BaseModel):
    person_id: int
