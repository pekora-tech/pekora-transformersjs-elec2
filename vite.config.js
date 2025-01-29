import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    strictPort: true,
    host: '0.0.0.0',
    https: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});
