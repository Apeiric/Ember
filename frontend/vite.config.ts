import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const sharedDir = fileURLToPath(new URL('../shared/src', import.meta.url));

export default defineConfig({
  // NOTE: no vite-plugin-cesium. Under Vite 6 it serves Cesium's Assets/ and
  // Widgets/ but lets Workers/ fall through to the SPA fallback, so Cesium gets
  // index.html where a worker script should be and dies at render time.
  // `scripts/copy-cesium.mjs` stages the assets into public/ instead (see
  // predev/prebuild), and index.html sets window.CESIUM_BASE_URL.
  plugins: [react()],
  resolve: {
    alias: {
      // Matches the tsconfig `paths` entry. Both must exist: tsconfig teaches
      // the type checker, this teaches the bundler.
      '@ember/shared': `${sharedDir}/index.ts`,
    },
  },
  server: {
    port: 5173,
    // `shared/` lives outside the frontend root, so Vite needs explicit permission.
    fs: { allow: ['..'] },
    proxy: {
      // Same-origin in dev — no CORS, and `VITE_API_URL` can stay unset.
      '/api': {
        target: process.env.VITE_API_PROXY ?? 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    // Sourcemaps off in production: the Scene3D map alone is 17 MB, and
    // Render's free instance (512 MB) has been known to OOM generating them.
    // A deploy that builds beats a deploy you can debug.
    sourcemap: false,
  },
});
