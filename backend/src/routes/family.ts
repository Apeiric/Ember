/**
 * EMBER — GET /api/family
 * OWNER: FRONTEND
 *
 * Four canned people, one canned fire, four verdicts from the same judge.
 * No accounts, no live tracking, no multi-user infrastructure.
 */

import { Router } from 'express';
import type { ApiError } from '@ember/shared';
import { runFamilyAssessment } from '../pipeline/family';
import { getFamily } from '../fixtures/family';
import { log } from '../logger';

export const familyRouter = Router();

/**
 * GET /api/household — the pre-built profiles, with no judging.
 *
 * Separate from /api/family because the UI needs the roster the moment the app
 * opens, and running the judge four times just to render a list of names would
 * put a second of latency in front of the first screen.
 *
 * Read-only and stateless. Editing happens in the browser's memory — no
 * accounts, no database, no persistence. Reload and you are back to the canned
 * household, which is exactly what a demo wants.
 */
familyRouter.get('/household', (_req, res) => {
  res.json({ ok: true, members: getFamily() });
});

familyRouter.get('/family', async (req, res) => {
  try {
    const forceOffline = req.query.offline === 'true' || req.query.offline === '1';
    res.json(await runFamilyAssessment({ forceOffline }));
  } catch (err) {
    log.error('family assessment failed', err);
    const error: ApiError = {
      ok: false,
      error: 'Family assessment failed',
      detail: err instanceof Error ? err.message : String(err),
    };
    res.status(500).json(error);
  }
});
