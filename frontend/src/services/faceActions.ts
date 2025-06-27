import { API } from "../config";
import { Person } from "../types";
import { useCallback } from "react";

export const assignFace = async (faceIds: number[], personId: number) => {
  await fetch(`${API}/api/faces/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ face_ids: faceIds, person_id: personId }),
  });
};

export const createPersonFromFaces = async (
  faceIds: number[],
  name?: string
): Promise<Person> => {
  const res = await fetch(`${API}/api/faces/create_person`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ face_ids: faceIds, name: name }),
  });
  const json = await res.json();
  return (json as any).person ?? (json as any);
};

export const deleteFace = async (faceIds: number[]) => {
  const params = new URLSearchParams();
  faceIds.forEach((id) => params.append("face_ids", id.toString()));
  await fetch(`${API}/api/faces/?${params.toString()}`, { method: "DELETE" });
};

export const detachFace = async (faceIds: number[]) => {
  await fetch(`${API}/api/faces/detach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(faceIds),
  });
};
