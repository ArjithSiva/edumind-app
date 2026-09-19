import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Local dev proxy so the browser talks to localhost:5173/api and Vite
    // forwards to the Express server. In production VITE_API_URL is used instead.
    proxy: {
      "/api": { target: "http://localhost:5000", changeOrigin: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // Split the heavy libraries out so the first paint isn't waiting on charts.
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          motion: ["framer-motion"],
        },
      },
    },
  },
});
