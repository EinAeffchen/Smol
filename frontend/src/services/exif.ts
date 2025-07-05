import { API } from "../config";

export const getExifData = async (mediaId: number): Promise<any> => {
  const response = await fetch(`${API}/api/media/${mediaId}/processors/exif`);
  if (!response.ok) throw new Error("Failed to fetch EXIF data");
  return response.json();
};
