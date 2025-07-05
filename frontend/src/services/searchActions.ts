import { API } from "../config";
import { Media } from "../types";

export const searchByImage = async (file: File): Promise<Media[]> => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API}/api/search/by-image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Image search failed");
  }

  return response.json();
};
