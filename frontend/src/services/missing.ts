import { API } from "../config";
import {
  MissingBulkActionPayload,
  MissingConfirmResponse,
  MissingMediaPage,
  MissingResetResponse,
} from "../types";

export interface MissingQuery {
  cursor?: string | null;
  limit?: number;
  pathPrefix?: string;
  includeConfirmed?: boolean;
}

const buildQueryString = (params: Record<string, string | undefined>) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.append(key, value);
    }
  });
  return searchParams.toString();
};

export const getMissingMedia = async (
  options: MissingQuery = {}
): Promise<MissingMediaPage> => {
  const query = buildQueryString({
    cursor: options.cursor ?? undefined,
    limit: options.limit?.toString(),
    path_prefix: options.pathPrefix,
    include_confirmed: options.includeConfirmed ? "true" : undefined,
  });

  const response = await fetch(
    `${API}/api/missing/${query ? `?${query}` : ""}`
  );
  if (!response.ok) {
    throw new Error("Failed to load missing media");
  }
  return response.json();
};

const postMissingAction = async <T>(
  endpoint: string,
  payload: MissingBulkActionPayload
): Promise<T> => {
  const response = await fetch(`${API}/api/missing/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || "Missing media action failed");
  }
  return response.json();
};

export const confirmMissing = (payload: MissingBulkActionPayload) =>
  postMissingAction<MissingConfirmResponse>("confirm", payload);

export const resetMissingFlags = (payload: MissingBulkActionPayload) =>
  postMissingAction<MissingResetResponse>("reset", payload);
