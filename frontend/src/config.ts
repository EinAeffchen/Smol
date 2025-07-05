const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

if (!API_BASE_URL && import.meta.env.DEV) {
  console.warn(
    "Warning: VITE_API_BASE_URL is not set in your .env file. API calls might fail."
  );
}

const getBooleanEnv = (envVar: string | undefined): boolean => {
    return envVar?.toLowerCase() === "true";
}

export const API = API_BASE_URL;
export const READ_ONLY = getBooleanEnv(import.meta.env.VITE_API_READ_ONLY);
export const ENABLE_PEOPLE = getBooleanEnv(import.meta.env.VITE_API_ENABLE_PEOPLE);

if (import.meta.env.DEV) {
  console.log("[App Config] API Base URL:", API);
  console.log("[App Config] Read-Only Mode:", READ_ONLY);
  console.log("[App Config] People tracking enabled:", ENABLE_PEOPLE);
}
