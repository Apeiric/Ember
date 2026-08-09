/**
 * EMBER — serving the built frontend from the API process.
 * OWNER: JUDGE (merge captain)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY ONE SERVICE INSTEAD OF TWO:
 *
 * The blueprint originally deployed a static site next to the API. That works,
 * but it costs a second free-tier service, needs CORS_ORIGINS wired between
 * them, and needs VITE_API_URL pointed at the other host — three things that
 * can be individually wrong, on demo day, in front of judges.
 *
 * Serving `frontend/dist` from Express makes the app same-origin: no CORS, and
 * `VITE_API_URL` stays unset so the client just calls `/api/...` on whatever
 * host it was loaded from. One URL, one deploy, nothing to keep in sync.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import express, { type Express, type Request, type Response, type NextFunction } from 'express';
import { existsSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from './logger';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Find the built frontend.
 *
 * `../../frontend/dist` is the answer both in dev (`backend/src/server.ts`) and
 * in production (`backend/dist/server.js`) because both live exactly two levels
 * under the repo root. The rest are belt-and-braces for other layouts, and
 * FRONTEND_DIST overrides everything if a host does something unusual.
 */
export function findFrontendDist(): string | null {
  const fromEnv = process.env.FRONTEND_DIST?.trim();
  const candidates = [
    ...(fromEnv ? [resolve(fromEnv)] : []),
    resolve(here, '../../frontend/dist'),
    resolve(here, '../frontend/dist'),
    resolve(process.cwd(), 'frontend/dist'),
    resolve(process.cwd(), 'dist'),
  ];
  // index.html, not just the directory — an empty `dist/` left over from a
  // failed build would otherwise make us serve 404s instead of falling back.
  return candidates.find((dir) => existsSync(join(dir, 'index.html'))) ?? null;
}

/**
 * Mount the SPA at `/`, leaving `/api/*` alone.
 *
 * Call AFTER the API routers: Express matches in registration order, so the API
 * wins any path it claims and the SPA fallback only ever sees what is left.
 */
export function serveFrontend(app: Express): boolean {
  const dist = findFrontendDist();

  if (!dist) {
    // Dev (Vite serves the app on :5173 and proxies /api here), or an API-only
    // deploy. Keep the service banner so hitting the root still explains itself.
    app.get('/', (_req, res) => {
      res.json({
        service: 'Ember — the safe way out of a wildfire.',
        note: 'No built frontend found. Run `npm run build` to serve the app from this origin.',
        endpoints: ['GET /api/health', 'GET /api/scenarios', 'POST /api/assess'],
      });
    });
    log.warn('no frontend build found — serving the API only');
    return false;
  }

  app.use(
    express.static(dist, {
      // Vite fingerprints everything under /assets, so those are safe to cache
      // hard. index.html must NOT be cached or a deploy will not take effect
      // until the browser feels like it.
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${sep}assets${sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    }),
  );

  // SPA fallback. A deep link is a client-side route, not a missing file.
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    // Never hand HTML to an API caller — an unmatched /api path is a real 404
    // and the JSON handler after this should answer it.
    if (req.path.startsWith('/api')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(join(dist, 'index.html'));
  });

  log.info(`serving frontend from ${dist}`);
  return true;
}
