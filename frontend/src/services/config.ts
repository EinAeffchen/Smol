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

export const reloadConfig = async (): Promise<AppConfig> => {
  const response = await fetch(`${API}/api/config/reload`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to reload config");
  }

  // Fetch latest config from backend so we can sync frontend runtime flags
  const latest = await getConfig();

  // In production builds, config getters read from window.runtimeConfig.
  // Update these values so components referencing config.READ_ONLY (etc.)
  // see the new values without a full page refresh.
  if (!import.meta.env.DEV) {
    const ro = String(!!latest.general.read_only);
    const people = String(!!latest.general.enable_people);
    window.runtimeConfig = {
      ...(window.runtimeConfig ?? {}),
      VITE_API_READ_ONLY: ro,
      VITE_API_ENABLE_PEOPLE: people,
    } as any;

    // Emit a lightweight event that components can listen to if they need
    // to react to config changes proactively (e.g., force a re-render).
    try {
      window.dispatchEvent(new Event("runtime-config-updated"));
    } catch (_) {
      // no-op: dispatchEvent can fail in some test environments
    }
  }

  return latest;
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
