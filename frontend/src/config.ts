const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

// You might want to add a warning if it's not set during development
if (!API_BASE_URL && import.meta.env.DEV) {
  console.warn(
    "Warning: VITE_API_BASE_URL is not set in your .env file. API calls might fail."
  );
}

const readOnlyEnvVar: string | undefined = import.meta.env.VITE_API_READ_ONLY;
let IS_READ_ONLY: boolean = false; // Default to false if not set or if value isn't 'true'
if (readOnlyEnvVar) {
  const lowerCaseValue = readOnlyEnvVar.toLowerCase();
  IS_READ_ONLY = lowerCaseValue === 'true' || lowerCaseValue === '1';
}
if (import.meta.env.DEV) {
  console.log('[App Config] API Base URL:', API_BASE_URL);
  console.log('[App Config] Read-Only Mode:', IS_READ_ONLY);
}

export const API = API_BASE_URL;
export const READ_ONLY = IS_READ_ONLY;

