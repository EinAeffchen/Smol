/// <reference types="vite/client" />
/// <reference types="vite/types/importMeta.d.ts" />

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/static/", // ← here
  plugins: [react()],
  optimizeDeps: {
    include: ["prop‐types"], // <-- add this
  },
  build: {
    sourcemap: true,
    minify: false,
    commonjsOptions: {
      include: [/node_modules/],
    },
  },
  define: {
    // force React library to think it's in development mode:
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
