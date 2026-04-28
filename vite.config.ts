import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    port: 8080,
  },
  preview: {
    port: 8080,
  },
  build: {
    outDir: "dist",
    assetsInlineLimit: 0, // never inline game assets as base64
  },
});
