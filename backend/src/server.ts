/**
 * EMBER — HTTP server.
 * OWNER: JUDGE (merge captain)
 *
 * Deliberately boring. All the interesting behaviour is in `pipeline/assess.ts`.
 */

import express from 'express';
import cors from 'cors';
import { env, capabilities } from './env';
import { log } from './logger';
import { assessRouter } from './routes/assess';
import { healthRouter } from './routes/health';
import { scenariosRouter } from './routes/scenarios';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins.length > 0 ? env.corsOrigins : true,
    }),
  );
  app.use(express.json({ limit: '256kb' }));

  app.use('/api', healthRouter);
  app.use('/api', scenariosRouter);
  app.use('/api', assessRouter);

  app.get('/', (_req, res) => {
    res.json({
      service: 'Ember — the safe way out of a wildfire.',
      endpoints: ['GET /api/health', 'GET /api/scenarios', 'POST /api/assess'],
    });
  });

  app.use((_req, res) => {
    res.status(404).json({ ok: false, error: 'Not found' });
  });

  return app;
}

// Only listen when run directly — importing this file in a test must not bind a port.
const isDirectRun = process.argv[1]?.includes('server');
if (isDirectRun) {
  const app = createApp();
  app.listen(env.port, () => {
    log.info(`Ember backend on http://localhost:${env.port}`);
    log.info(
      `providers: ${Object.entries(capabilities)
        .map(([k, v]) => `${k}=${v ? 'on' : 'off'}`)
        .join(' ')}`,
    );
    if (env.forceOffline) {
      log.warn('EMBER_FORCE_OFFLINE is ON — every stage will use canned demo data.');
    }
  });
}
