import { API } from "../config";
import { FaceRead } from "../types";

export const getOrphanFaces = async (page: number): Promise<FaceRead[]> => {
  const response = await fetch(`${API}/api/faces/orphan?page=${page}`);
  return response.json();
};
