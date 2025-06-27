import { API } from "../config";
import { Tag } from "../types";

export const removeTagFromMedia = async (mediaId: number, tagId: number) => {
  const res = await fetch(`${API}/api/tags/media/${mediaId}/${tagId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove tag from media");
};

export const removeTagFromPerson = async (personId: number, tagId: number) => {
  const res = await fetch(`${API}/api/tags/person/${personId}/${tagId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove tag from person");
};

export const deleteTag = async (tagId: number) => {
  const res = await fetch(`${API}/api/tags/${tagId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete tag");
};
