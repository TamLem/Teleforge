import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api/teleforge/flow-hooks": {
        changeOrigin: true,
        target: "http://localhost:3100"
      }
    }
  }
});
