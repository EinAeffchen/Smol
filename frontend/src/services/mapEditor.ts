import { API } from "../config";
import { CursorPage, MediaPreview } from "../types";

export const getMissingGeoMedia = async (
  cursor: string | null
): Promise<CursorPage<MediaPreview>> => {
  const params = new URLSearchParams();
  if (cursor) {
    params.append("cursor", cursor);
  }
  const response = await fetch(
    `${API}/api/media/missing-geo?${params.toString()}`
  );
  return response.json();
};

export const updateMediaGeolocation = async (
  mediaId: number,
  latitude: number,
  longitude: number
) => {
  const res = await fetch(`${API}/api/media/${mediaId}/geolocation`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      latitude: latitude,
      longitude: longitude,
    }),
  });
  if (!res.ok) throw new Error("Failed to update media geolocation");
};
