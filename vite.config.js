import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // El entorno alojado sirve el dev server detrás de un proxy con otro Host.
  server: { port: 12000, host: true, allowedHosts: true },
  preview: { port: 12000, host: true, allowedHosts: true },
});
