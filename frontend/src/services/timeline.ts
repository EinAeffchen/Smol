import { API } from "../config";
import { format } from "date-fns";
import {
  CursorPage,
  TimelineDisplayItem,
  TimelineEvent,
  TimelineEventCreate,
  TimelineEventUpdate,
} from "../types";

export const getPersonTimeline = async (
  personId: number,
  cursor: string | null
): Promise<CursorPage<TimelineDisplayItem>> => {
  const params = new URLSearchParams();
  if (cursor) {
    params.append("cursor", cursor);
  }
  const response = await fetch(
    `${API}/api/person/${personId}/timeline?${params.toString()}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch person timeline.");
  }
  return response.json();
};

export const createTimelineEvent = async (
  personId: number,
  eventData: TimelineEventCreate
): Promise<TimelineEvent> => {
  const payload = {
    ...eventData,
    event_date: format(eventData.event_date, "yyyy-MM-dd"),
  };
  const response = await fetch(`${API}/api/person/${personId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload), // Send the formatted payload
  });
  if (!response.ok) {
    throw new Error("Failed to create timeline event.");
  }
  return response.json();
};

export const updateTimelineEvent = async (
  personId: number,
  eventId: number,
  eventData: TimelineEventUpdate
): Promise<TimelineEvent> => {
  const payload = {
    ...eventData,
    ...(eventData.event_date && {
      event_date: format(eventData.event_date, "yyyy-MM-dd"),
    }),
  };

  const response = await fetch(
    `${API}/api/person/${personId}/events/${eventId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!response.ok) {
    throw new Error("Failed to update timeline event.");
  }
  return response.json();
};

export const deleteTimelineEvent = async (
  personId: number,
  eventId: number
): Promise<void> => {
  const response = await fetch(
    `${API}/api/person/${personId}/events/${eventId}`,
    {
      method: "DELETE",
    }
  );
  if (!response.ok) throw new Error("Failed to delete timeline event.");
};
