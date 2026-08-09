/**
 * EMBER — frontend type surface.
 *
 * Mirrors the backend by re-exporting the exact same definitions from
 * `shared/src/types.ts`. There is no second copy to drift out of sync: if the
 * backend changes a field, this file's consumers stop compiling immediately.
 *
 * Import from either — they are the same symbols:
 *   import type { AssessResponse } from '@ember/shared';
 *   import type { AssessResponse } from './types';
 */

export * from '@ember/shared';
