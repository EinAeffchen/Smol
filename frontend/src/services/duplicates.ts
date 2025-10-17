import { API } from "../config";
import { DuplicatePage, Task, DuplicateStats } from "../types";

export const getDuplicates = async (
  cursor: string | null = null,
  limit: number = 10
): Promise<DuplicatePage> => {
  const params = new URLSearchParams();
  if (cursor) {
    params.append("cursor", cursor);
  }
  params.append("limit", limit.toString());

  const response = await fetch(`${API}/api/duplicates?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to fetch duplicates");
  }
  return response.json();
};

export const getDuplicateStats = async (): Promise<DuplicateStats> => {
  const response = await fetch(API + "/api/duplicates/stats");
  if (!response.ok) {
    throw new Error("Failed to fetch duplicate statistics");
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
  | "BLACKLIST_RECORDS"
  | "MARK_NOT_DUPLICATE";
export const resolveDuplicates = async (
  groupId: number,
  action: ResolveAction,
  masterMediaId?: number
) => {
  const payload = {
    group_id: groupId,
    master_media_id: masterMediaId ?? null,
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
