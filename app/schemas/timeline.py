from pydantic import BaseModel
from typing import Literal
from app.schemas.media import MediaPreview
from datetime import date


class TimelineEventBase(BaseModel):
    id: int|None=None
    title: str
    description: str | None = None
    event_date: date
    recurrence: str | None = None


# Define the shapes of the items in our timeline
class TimelineMediaItem(BaseModel):
    type: Literal["media"] = "media"
    date: date
    items: MediaPreview  # The existing preview model


class TimelineEventItem(BaseModel):
    type: Literal["event"] = "event"
    date: date
    event: TimelineEventBase  # The event model we just defined


TimelineItem = TimelineMediaItem | TimelineEventItem


class TimelinePage(BaseModel):
    items: list[TimelineItem]
    next_cursor: str | None = None


class TimelineEventCreate(TimelineEventBase):
    pass  # It has the same fields as the base for now


class TimelineEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    event_date: date | None = None
    recurrence: str | None = None


class TimelineEvent(TimelineEventBase):
    id: int
    person_id: int

    class Config:
        orm_mode = True
