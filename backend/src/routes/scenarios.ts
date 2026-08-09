/**
 * EMBER — GET /api/scenarios
 * OWNER: FRONTEND
 *
 * Powers the demo scenario picker. Lets you switch fires on stage in one click
 * and demonstrate that nothing is hardcoded to a single dataset.
 */

import { Router } from 'express';
import { listScenarios } from '../fixtures';

export const scenariosRouter = Router();

scenariosRouter.get('/scenarios', (_req, res) => {
  res.json({ ok: true, scenarios: listScenarios() });
});
