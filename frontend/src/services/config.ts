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
