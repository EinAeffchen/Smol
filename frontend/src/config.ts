const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

if (!API_BASE_URL && import.meta.env.DEV) {
  console.warn(
    "Warning: VITE_API_BASE_URL is not set in your .env file. API calls might fail."
  );
}

const readOnlyEnvVar: string | undefined = import.meta.env.VITE_API_READ_ONLY;
let IS_READ_ONLY: boolean = false; 
if (readOnlyEnvVar) {
  const lowerCaseValue = readOnlyEnvVar.toLowerCase();
  IS_READ_ONLY = lowerCaseValue === "true";
}
const enablePeopleEnvVar: string | undefined = import.meta.env
  .VITE_API_ENABLE_PEOPLE;
let PEOPLE_ARE_ENABLED: boolean = false; 
if (enablePeopleEnvVar) {
  const lowerCaseValue = enablePeopleEnvVar.toLowerCase();
  PEOPLE_ARE_ENABLED = lowerCaseValue === "true";
}
if (import.meta.env.DEV) {
  console.log("[App Config] API Base URL:", API_BASE_URL);
  console.log("[App Config] Read-Only Mode:", IS_READ_ONLY);
  console.log("[App Config] People tracking enabled:", PEOPLE_ARE_ENABLED);
}

export const API = API_BASE_URL;
export const READ_ONLY = IS_READ_ONLY;
export const ENABLE_PEOPLE = PEOPLE_ARE_ENABLED;
