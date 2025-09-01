import { API } from "../config";
import { AppConfig } from "../types";

export const getConfig = async (): Promise<AppConfig> => {
  const response = await fetch(`${API}/api/config/`);
  console.log(response)
  if (!response.ok) {
    throw new Error("Failed to fetch config");
  }
  return response.json();
};

export const saveConfig = async (config: AppConfig): Promise<AppConfig> => {
  const response = await fetch(`${API}/api/config/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error("Failed to save config");
  }
  return response.json();
};

export const reloadConfig = async (): Promise<void> => {
  const response = await fetch(`${API}/api/config/reload`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to reload config");
  }
};

export const pickDirectory = async (): Promise<string | null> => {
  const response = await fetch(`${API}/api/config/pick-directory`);
  if (!response.ok) {
    // Return null so the caller can fall back to manual entry
    return null;
  }
  const data = await response.json();
  return (data?.path as string) || null;
};
