import { API } from "../config";
import { CursorPage, FaceRead } from "../types";

export const getOrphanFaces = async (
  cursor: string | null
): Promise<CursorPage<FaceRead>> => {
  const params = new URLSearchParams();
  if (cursor) {
    params.append("cursor", cursor);
  }
  const response = await fetch(`${API}/api/faces/orphans?${params.toString()}`);
  return response.json();
};
