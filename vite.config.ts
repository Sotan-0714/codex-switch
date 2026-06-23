import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: "src/renderer-react",
  base: "./",
  build: {
    outDir: "../../renderer-dist",
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src/renderer-react"),
      "@assets": path.resolve(__dirname, "src/assets")
    }
  }
});
