import { defineConfig } from 'vite';

// base './' permite desplegar en GitHub Pages / Netlify / cualquier subcarpeta.
export default defineConfig({
  base: './',
  server: { port: 5173, open: false },
});
