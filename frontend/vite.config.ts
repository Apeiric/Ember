import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const sharedDir = fileURLToPath(new URL('../shared/src', import.meta.url));

export default defineConfig({
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
    sourcemap: true,
  },
});
