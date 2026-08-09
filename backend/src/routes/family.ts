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
import { log } from '../logger';

export const familyRouter = Router();

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
