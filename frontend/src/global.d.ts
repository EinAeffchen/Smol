interface RuntimeConfig {
  VITE_API_READ_ONLY: string;
  VITE_API_ENABLE_PEOPLE: string;
  VITE_API_MEME_MODE: string;
}

interface Window {
  runtimeConfig?: RuntimeConfig;
}