import { defineConfig } from 'tsup';

/**
 * Bundles the backend (including everything imported from `shared/`) into a
 * single ESM file. tsup resolves the `@ember/shared` tsconfig path alias, so
 * there is no separate package to build or publish.
 */
export default defineConfig({
  entry: ['src/server.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  sourcemap: true,
  clean: true,
  // Bundle `shared`; leave real npm dependencies external so node resolves them.
  noExternal: [/@ember\/shared/],
  splitting: false,
});
