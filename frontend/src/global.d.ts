interface RuntimeConfig {
  VITE_API_READ_ONLY: string;
  VITE_API_ENABLE_PEOPLE: string;
}

interface Window {
  runtimeConfig?: RuntimeConfig;
}