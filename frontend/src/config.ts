const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

if (!API_BASE_URL && import.meta.env.DEV) {
  console.warn(
    "Warning: VITE_API_BASE_URL is not set in your .env file. API calls might fail."
  );
}

const getBooleanEnv = (envVar: string | undefined): boolean => {
  return envVar?.toLowerCase() === "true";
};

export const API = API_BASE_URL;

const config = {
  /**
   * Checks if the application is in read-only mode.
   * Accesses the correct source based on the environment (dev vs. prod).
   */
  get READ_ONLY(): boolean {
    if (import.meta.env.DEV) {
      return getBooleanEnv(import.meta.env.VITE_API_READ_ONLY);
    }
    return getBooleanEnv(window.runtimeConfig?.VITE_API_READ_ONLY);
  },

  /**
   * Checks if the people/faces feature is enabled.
   * Accesses the correct source based on the environment (dev vs. prod).
   */
  get ENABLE_PEOPLE(): boolean {
    if (import.meta.env.DEV) {
      return getBooleanEnv(import.meta.env.VITE_API_ENABLE_PEOPLE);
    }
    return getBooleanEnv(window.runtimeConfig?.VITE_API_ENABLE_PEOPLE);
  },

  /**
   * When enabled, replace GIF thumbnails with originals so they animate in grids.
   */
  get MEME_MODE(): boolean {
    if (import.meta.env.DEV) {
      return getBooleanEnv(import.meta.env.VITE_API_MEME_MODE);
    }
    return getBooleanEnv(window.runtimeConfig?.VITE_API_MEME_MODE);
  },
};

console.log(import.meta.env);
if (import.meta.env.DEV) {
  console.log("[App Config] API Base URL:", API);
  console.log("[App Config] Read-Only Mode:", config.READ_ONLY);
  console.log("[App Config] People tracking enabled:", config.ENABLE_PEOPLE);
  console.log("[App Config] Meme mode:", config.MEME_MODE);
}
export default config;
