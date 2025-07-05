import { API } from "../config";
import { CursorPage, MediaPreview, PersonReadSimple, Tag } from "../types";

export const searchMedia = async (
  query: string,
  limit: number,
  cursor?: string
): Promise<CursorPage<MediaPreview>> => {
  const response = await fetch(
    `${API}/api/search/media?query=${query}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`
  );
  return response.json();
};

export const searchPeople = async (
  query: string,
  limit: number = 10,
  cursor?: string
): Promise<CursorPage<PersonReadSimple>> => {
  const response = await fetch(
    `${API}/api/search/person?query=${query}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`
  );
  return response.json();
};

export const searchTags = async (
  query: string,
  limit: number,
  cursor?: string
): Promise<CursorPage<Tag>> => {
  const response = await fetch(
    `${API}/api/search/tags?query=${query}&limit=${limit}${cursor ? `&cursor=${cursor}` : ""}`
  );
  return response.json();
};
