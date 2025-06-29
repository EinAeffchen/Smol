import { API } from "../config";
import { Media, MediaDetail, MediaLocation } from "../types";
import { CursorPage } from "../types";
export const getMedia = async (id: string): Promise<MediaDetail> => {
  const response = await fetch(`${API}/api/media/${id}`);
  return response.json();
};

export const getImages = async (
  cursor: string | null,
  sortOrder: "newest" | "latest"
): Promise<CursorPage<Media>> => {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("sort", sortOrder);
  const response = await fetch(`${API}/api/media/images?${params.toString()}`);
  return response.json();
};

export const getVideos = async (
  cursor: string | null,
  sortOrder: "newest" | "latest"
): Promise<CursorPage<Media>> => {
  const params = new URLSearchParams();
  if (cursor) params.append("cursor", cursor);
  params.append("sort", sortOrder);
  const response = await fetch(`${API}/api/media/videos?${params.toString()}`);
  return response.json();
};

export const getMapMedia = async (): Promise<MediaLocation[]> => {
  const response = await fetch(`${API}/api/media/map`);
  return response.json();
};

export const getMediaLocations = async (
  north: number,
  south: number,
  east: number,
  west: number
): Promise<MediaLocation[]> => {
  const response = await fetch(
    `${API}/api/media/locations?north=${north}&south=${south}&east=${east}&west=${west}`
  );
  if (!response.ok) throw new Error("Failed to fetch media locations");
  return response.json();
};

export const getMediaList = async (
  cursor: string | null,
  sortOrder: "newest" | "latest",
  tags: string[]
): Promise<CursorPage<Media>> => {
  const params = new URLSearchParams({
    sort: sortOrder,
  });
  if (cursor) {
    params.append("cursor", cursor);
  }
  tags.forEach((tag) => params.append("tags", tag));
  const response = await fetch(`${API}/api/media/?${params.toString()}`);
  return response.json();
};

export const getSimilarMedia = async (mediaId: number): Promise<Media[]> => {
  const response = await fetch(`${API}/api/media/${mediaId}/get_similar`);
  if (!response.ok) throw new Error("Failed to load similar media");
  return response.json();
};
