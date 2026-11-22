import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite sirve la raíz del proyecto tal cual: un .p12/.pem copiado aquí queda
// descargable por HTTP aunque esté en .gitignore. Este plugin corta esas rutas
// antes de que lleguen al middleware de ficheros estáticos.
const SECRETOS = /\.(p12|pfx|pem|key|crt|jks)$/i;

const bloquearSecretos = () => ({
  name: 'bloquear-secretos',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const ruta = decodeURIComponent((req.url || '').split('?')[0]);
      if (SECRETOS.test(ruta)) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.end('No encontrado');
        return;
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [react(), bloquearSecretos()],
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
