import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: '../web_ui',
    emptyOutDir: true,
  },
  server: {
    port: 3000,
  },
});

