import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  build: { rollupOptions: { input: { site: resolve(import.meta.dirname, 'index.html'), studio: resolve(import.meta.dirname, 'studio.html') } } },
});
