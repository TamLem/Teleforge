import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/teleforge/actions": {
        changeOrigin: true,
        target: "http://localhost:3100"
      }
    }
  }
});
