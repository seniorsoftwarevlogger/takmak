import { defineConfig } from 'vite';
import { resolve } from 'node:path';
export default defineConfig({
  base: process.env.PAGES_BASE_PATH || "/",
  build: { rollupOptions: { input: { site: resolve(import.meta.dirname, 'index.html'), en: resolve(import.meta.dirname, 'en.html'), studio: resolve(import.meta.dirname, 'studio.html') } } },
});
