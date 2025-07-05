import { API } from "../config";
import { Person } from "../types";

export const updatePerson = async (
  personId: number,
  data: { name?: string; profile_face_id?: number }
): Promise<Person> => {
  const res = await fetch(`${API}/api/person/${personId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update person");
  return res.json();
};

export const deletePerson = async (personId: number) => {
  const res = await fetch(`${API}/api/person/${personId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete person");
};

export const mergePersons = async (sourceId: number, targetId: number) => {
  const res = await fetch(`${API}/api/person/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source_id: sourceId, target_id: targetId }),
  });
  if (!res.ok) throw new Error("Failed to merge persons");
};

export const searchPersonsByName = async (name: string): Promise<Person[]> => {
  const res = await fetch(
    `${API}/api/person/?name=${encodeURIComponent(name)}`
  );
  if (!res.ok) throw new Error("Failed to search persons");
  const data = await res.json();
  return data.items;
};

export const getSuggestedFaces = async (
  personId: number,
  signal?: AbortSignal
): Promise<any[]> => {
  const res = await fetch(`${API}/api/person/${personId}/suggest-faces`, {
    signal,
  });
  if (!res.ok) throw new Error("Failed to fetch suggested faces");
  return res.json();
};

export const getSimilarPersons = async (
  personId: number,
  signal?: AbortSignal
): Promise<any[]> => {
  const res = await fetch(`${API}/api/person/${personId}/similarities`, {
    signal,
  });
  if (!res.ok) throw new Error("Failed to fetch similar persons");
  return res.json();
};

export const getPersonFaces = async (
  personId: number,
  cursor: string | null,
  limit: number
): Promise<any> => {
  const params = new URLSearchParams({
    limit: limit.toString(),
  });
  if (cursor) {
    params.append("cursor", cursor);
  }
  const res = await fetch(
    `${API}/api/person/${personId}/faces?${params.toString()}`
  );
  if (!res.ok) throw new Error("Failed to fetch person faces");
  return res.json();
};

export const setProfileFace = async (faceId: number, personId: number) => {
  return updatePerson(personId, { profile_face_id: faceId });
};
