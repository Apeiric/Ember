/**
 * EMBER — GET /api/health
 * OWNER: DATA
 *
 * Render pings this to decide whether the service is up. It also answers the
 * question you will ask forty times today: "which keys are actually loaded?"
 * Reports booleans only — never echo a secret.
 */

import { Router } from 'express';
import { capabilities, env } from '../env';
import { cacheStats } from '../core/cache';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'ember-backend',
    version: '0.1.0',
    nodeEnv: env.nodeEnv,
    uptimeSeconds: Math.round(process.uptime()),
    /** Which providers are wired up. Booleans only — no key material. */
    capabilities,
    forceOffline: env.forceOffline,
    defaultScenario: env.defaultScenarioId,
    cache: { entries: cacheStats().size },
  });
});
