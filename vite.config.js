import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite configuration for the Izy Global Partners LLP library application.
// In development, /api requests are proxied to the local Node + SQLite server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
});
