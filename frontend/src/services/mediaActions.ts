import { API } from "../config";
import { Task } from "../types";

export const convertMedia = async (mediaId: number): Promise<Task> => {
  const res = await fetch(`${API}/api/media/${mediaId}/converter`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to start conversion");
  return res.json();
};

export const deleteMediaRecord = async (mediaId: number) => {
  const res = await fetch(`${API}/api/media/${mediaId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete media record");
};

export const deleteMediaFile = async (mediaId: number) => {
  const res = await fetch(`${API}/api/media/${mediaId}/file`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete media file");
};
