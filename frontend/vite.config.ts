import fs from 'fs';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';

function cleanWebUiAssetsPlugin(): Plugin {
  return {
    name: 'clean-web-ui-assets',
    buildStart() {
      const outDir = path.resolve(__dirname, '../web_ui');
      const assetsDir = path.join(outDir, 'assets');
      const indexHtml = path.join(outDir, 'index.html');
      if (fs.existsSync(assetsDir)) {
        fs.rmSync(assetsDir, { recursive: true, force: true });
      }
      if (fs.existsSync(indexHtml)) {
        fs.rmSync(indexHtml, { force: true });
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), cleanWebUiAssetsPlugin()],
  root: '.',
  build: {
    outDir: '../web_ui',
    emptyOutDir: false,
  },
  server: {
    port: 3000,
  },
});
