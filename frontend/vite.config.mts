/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode, command }) => {
  const domain = process.env.DOMAIN || "http://localhost:8000/";

  // ---- START DEBUG LOG ----
  console.log(`[vite.config.js] Mode: ${mode}`);
  console.log(`[vite.config.js] Domain is set to: ${domain}`);
  // ---- END DEBUG LOG ----
  let base: string = "/";
  if (mode == "production") {
    base = "/static/";
  }

  return {
    base: base, // Uncomment and set if your app is served from a sub-path
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: `${domain}`,
          // changeOrigin: true,
          // rewrite: (path) => path.replace(/^\/api/, ''), // Uncomment if your API doesn't expect the /api prefix
        },
      },
    },
    // optimizeDeps: {
    //   include: ["prop-types"],
    // },
    build: {
      minify: true,
    },
    // define: {
    //   "process.env.NODE_ENV": JSON.stringify(mode),
    // },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
  };
});
