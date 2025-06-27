import { API } from "../config";
import { MediaPreview } from "../types";

export const getMissingGeoMedia = async (): Promise<MediaPreview[]> => {
  const response = await fetch(`${API}/api/media/missing_geo`);
  if (!response.ok) throw new Error("Failed to fetch missing geo media");
  return response.json();
};

export const updateMediaGeolocation = async (mediaId: number, latitude: number, longitude: number) => {
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
