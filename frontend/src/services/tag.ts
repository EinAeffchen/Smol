import { API } from "../config";
import { Tag } from "../types";

export const getTags = async (page: number): Promise<Tag[]> => {
  const response = await fetch(`${API}/api/tags/?page=${page}`);
  return response.json();
};

export const getTag = async (id: string): Promise<Tag> => {
  const response = await fetch(`${API}/api/tags/${id}`);
  return response.json();
};
