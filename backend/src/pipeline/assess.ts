/**
 * EMBER — the pipeline. CONTEXT.md §5.
 * OWNER: JUDGE (Navelan) — this is the merge point for all three workstreams.
 *
 *   1. LOCATE      geocode.ts   address → lat/lng
 *   2. THREAT      hazards.ts   perimeter + hotspots + wind → Hazard
 *   3. GROUND      ground.ts    terrain + roads out
 *   4. PROJECT     project.ts   Hazard + terrain → DangerField  (hazard-specific ENDS HERE)
 *   5. ROUTE       routing.ts   candidate escape routes, unfiltered
 *   6. JUDGE       judge.ts     score, reject, rank                ← the core
 *   7. PERSONALIZE profiles.ts  same fire, different verdict per person
 *   8. VERDICT     verdict.ts   Claude writes it, engine decides it
 *
 * Every stage records a trace entry. Stages 1-3 and 5 degrade independently to
 * canned data, so the pipeline always reaches stage 8 with a complete input set.
 * There is no code path here that returns a partial answer.
 */

import type { AssessResponse, ParsedAssessRequest } from '@ember/shared';
import { createTrace } from '../core/trace';
import { log } from '../logger';
import { geocodeAddress } from '../services/geocode';
import { fetchGround } from '../services/ground';
import { fetchHazard } from '../services/hazards';
import { judgeRoutes } from '../services/judge';
import { tuningFor } from '../services/profiles';
import { projectDangerField } from '../services/project';
import { fetchRoutes } from '../services/routing';
import { writeVerdict } from '../services/verdict';

export async function runAssessment(req: ParsedAssessRequest): Promise<AssessResponse> {
  const trace = createTrace();
  const t0 = performance.now();

  // ── 1. LOCATE ───────────────────────────────────────────────────────────
  const geo = await geocodeAddress(req.address, trace, {
    forceOffline: req.forceOffline,
    scenarioId: req.scenarioId,
  });
  const origin = geo.data.location;

  // An address that matched a canned scenario pins the rest of the pipeline to
  // that scenario, so the hazard, terrain and routes all describe one coherent
  // world instead of a live fire with canned roads.
  const scenarioId = req.scenarioId ?? geo.data.scenarioId;

  // ── 2 & 3. THREAT and GROUND, concurrently ──────────────────────────────
  // Independent feeds. Running them in series would add ~4s to every request
  // for no reason, and on stage that is the difference between a demo that
  // feels instant and one that feels broken.
  const [hazard, ground] = await Promise.all([
    fetchHazard({ location: origin, forceOffline: req.forceOffline, scenarioId }, trace),
    fetchGround(origin, trace, { forceOffline: req.forceOffline, scenarioId }),
  ]);

  // ── 4. PROJECT ──────────────────────────────────────────────────────────
  // Last point in the pipeline where the word "wildfire" means anything.
  const field = await trace.step('project', async () =>
    projectDangerField(hazard.data, ground.data),
  );

  // ── 5. ROUTE ────────────────────────────────────────────────────────────
  const routes = await fetchRoutes(
    { origin, field, forceOffline: req.forceOffline, scenarioId },
    trace,
  );

  // ── 6 & 7. JUDGE + PERSONALIZE ──────────────────────────────────────────
  const tuning = tuningFor(req.profile);
  const judgement = await trace.step('judge', async () =>
    judgeRoutes({ origin, routes: routes.data, field, tuning }),
  );

  log.info(
    `assess "${req.address}" → ${judgement.scored.length} routes, ` +
      `${judgement.rejected.length} rejected, naive ${judgement.naiveWasRejected ? 'REJECTED' : 'ok'}`,
  );

  // ── 8. VERDICT ──────────────────────────────────────────────────────────
  const verdict = await writeVerdict(
    {
      hazard: hazard.data,
      ground: ground.data,
      judgement,
      profile: req.profile,
      tuning,
      address: geo.data.formattedAddress,
      forceOffline: req.forceOffline,
    },
    trace,
  );

  log.info(
    `verdict ${verdict.decision} (${verdict.generatedBy}) in ${Math.round(performance.now() - t0)}ms`,
  );

  return {
    ok: true,
    scenarioId: scenarioId ?? null,
    origin: {
      query: req.address,
      formattedAddress: geo.data.formattedAddress,
      location: origin,
      provenance: geo.provenance,
    },
    hazard: hazard.data,
    field,
    profile: req.profile,
    tuning,
    ground: ground.data,
    routes: judgement.scored,
    recommended: judgement.recommended,
    naive: judgement.naive,
    verdict,
    trace: trace.finish(),
  };
}
