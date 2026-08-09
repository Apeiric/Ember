/**
 * EMBER — POST /api/assess
 * OWNER: JUDGE
 *
 * The one endpoint that matters. Validates, runs the pipeline, returns a
 * complete `AssessResponse`.
 */

import { Router } from 'express';
import { assessRequestSchema } from '@ember/shared';
import type { ApiError } from '@ember/shared';
import { runAssessment } from '../pipeline/assess';
import { log } from '../logger';

export const assessRouter = Router();

assessRouter.post('/assess', async (req, res) => {
  const parsed = assessRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join('.') || 'body'}: ${i.message}`)
      .join('; ');
    const error: ApiError = { ok: false, error: 'Invalid request', detail };
    res.status(400).json(error);
    return;
  }

  try {
    const result = await runAssessment(parsed.data);
    res.json(result);
  } catch (err) {
    // Reaching here means even the canned fallbacks failed, which should be
    // impossible. Log loudly — this is a bug, not a degraded upstream.
    log.error('assess pipeline failed', err);
    const error: ApiError = {
      ok: false,
      error: 'Assessment failed',
      detail: err instanceof Error ? err.message : String(err),
    };
    res.status(500).json(error);
  }
});
