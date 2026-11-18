import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/website-api/': {
        target: 'http://127.0.0.1:8011',
        // Keep the browser's host so the backend can validate the request origin.
        changeOrigin: false,
      },
    },
    port: 3000,
    open: false,
  },
});
