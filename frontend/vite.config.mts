/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode, command }) => {
  const apiProxyPort = process.env.PORT || "8000";

    // ---- START DEBUG LOG ----
    console.log(`[vite.config.js] Mode: ${mode}`);
    console.log(`[vite.config.js] process.env.PORT: ${process.env.PORT}`);
    console.log(`[vite.config.js] apiProxyPort is set to: ${apiProxyPort}`);
  // ---- END DEBUG LOG ----
  
  return {
    base: "/static/", // Uncomment and set if your app is served from a sub-path
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: `http://localhost:${apiProxyPort}`,
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