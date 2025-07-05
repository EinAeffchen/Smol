import { API } from "../config";
import { DuplicatePage, Task } from "../types";

export const getDuplicates = async (
  cursor: number | null = null,
  limit: number = 10
): Promise<DuplicatePage> => {
  const params = new URLSearchParams();
  if (cursor) {
    params.append("cursor", cursor.toString());
  }
  params.append("limit", limit.toString());

  const response = await fetch(`${API}/api/duplicates?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch duplicates");
  }
  return response.json();
};

export const startDuplicateDetection = async (): Promise<Task> => {
  const response = await fetch(`${API}/api/tasks/find_duplicates`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to start duplicate detection");
  }
  return response.json();
};

export type ResolveAction =
  | "DELETE_FILES"
  | "DELETE_RECORDS"
  | "BLACKLIST_RECORDS";
export const resolveDuplicates = async (
  groupId: number,
  masterMediaId: number,
  action: ResolveAction
) => {
  const payload = {
    group_id: groupId,
    master_media_id: masterMediaId,
    action: action,
  };

  const response = await fetch(`${API}/api/duplicates/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.detail || "Failed to resolve duplicate group.");
  }

  return await response.json();
};
