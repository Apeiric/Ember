/**
 * EMBER — shared barrel.
 *
 * Both apps import from `@ember/shared`, which resolves here via tsconfig
 * `paths` (backend + frontend) and a Vite alias (frontend). There is no build
 * step and no package to publish — edit a file, both apps see it immediately.
 */

export * from './types';
export * from './constants';
export * from './contracts';
