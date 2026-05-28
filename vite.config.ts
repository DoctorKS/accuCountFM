import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Tauri configuration
// - clearScreen: false → preserve Rust compile output
// - server.strictPort: true → Tauri expects exactly 1420
// - envPrefix VITE_ + TAURI_ → expose tauri env vars to renderer
export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: false,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "es2022",
    sourcemap: true,
  },
}));
