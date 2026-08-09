/**
 * EMBER — backend type surface.
 *
 * The canonical definitions live in `shared/src/types.ts` so the backend and
 * frontend can never disagree about a shape. This file re-exports them at the
 * path the team expects (`backend/src/types.ts`).
 *
 * Import from either — they are the same symbols:
 *   import type { Hazard } from '@ember/shared';
 *   import type { Hazard } from './types';
 */

export * from '@ember/shared';
