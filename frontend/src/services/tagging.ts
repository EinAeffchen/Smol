import { API } from "../config";
import { Tag } from "../types";

export const createTag = async (name: string): Promise<Tag> => {
  const res = await fetch(`${API}/api/tags/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to create tag");
  return res.json();
};

export const assignTag = async (ownerType: "media" | "person", ownerId: number, tagId: number) => {
  const res = await fetch(`${API}/api/tags/${ownerType}/${ownerId}/${tagId}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to assign tag");
};
