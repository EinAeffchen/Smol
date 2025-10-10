import { API } from "../config";
import { VersionUpdateInfo } from "../types";

export const getVersionUpdateInfo = async (): Promise<VersionUpdateInfo> => {
  const res = await fetch(`${API}/api/version/update`);
  if (!res.ok) {
    throw new Error("Failed to fetch update information");
  }
  return res.json();
};
