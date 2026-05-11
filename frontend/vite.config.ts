import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'https://localhost:7001',
      '/hubs': {
        target: 'https://localhost:7001',
        ws: true,
        secure: false
      }
    }
  }
});

