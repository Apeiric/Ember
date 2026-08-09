import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const shared = fileURLToPath(new URL('../shared/src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ember/shared': `${shared}/index.ts`,
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
