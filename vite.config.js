import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // El entorno alojado sirve el dev server detrás de un proxy con otro Host.
  server: {
    port: 12000,
    host: true,
    allowedHosts: true,
    // La API Laravel corre aparte (php artisan serve, puerto 12001). En dev se
    // proxya /api para evitar CORS y no depender de VITE_API_URL.
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://127.0.0.1:12001',
        changeOrigin: true,
      },
    },
  },
  preview: { port: 12000, host: true, allowedHosts: true },
});
