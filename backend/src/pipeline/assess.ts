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

import type {
  AssessResponse,
  FieldReport,
  OfficialContext,
  ParsedAssessRequest,
  ReportImpact,
} from '@ember/shared';
import { createTrace } from '../core/trace';
import { log } from '../logger';
import { geocodeAddress } from '../services/geocode';
import { fetchGround } from '../services/ground';
import { fetchHazard } from '../services/hazards';
import { judgeRoutes } from '../services/judge';
import { tuningFor } from '../services/profiles';
import { projectDangerField } from '../services/project';
import { fetchRoutes } from '../services/routing';
import { fetchOfficial } from '../services/official';
import { applyOfficial, countBlocking } from '../services/apply-official';
import { interpretReport } from '../services/interpret';
import { applyReports, countVerified } from '../services/apply-report';
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
  const [hazard, ground, official] = await Promise.all([
    fetchHazard({ location: origin, forceOffline: req.forceOffline, scenarioId }, trace),
    fetchGround(origin, trace, { forceOffline: req.forceOffline, scenarioId }),
    // Official closures + evacuation orders. Independent of the fire feeds:
    // a road can be shut for a downed line with no fire anywhere near it.
    fetchOfficial(origin, trace, { forceOffline: req.forceOffline, scenarioId }),
  ]);

  // ── 4. PROJECT ──────────────────────────────────────────────────────────
  // Last point in the pipeline where the word "wildfire" means anything.
  const projected = await trace.step('project', async () =>
    projectDangerField(hazard.data, ground.data),
  );

  // Official ground truth folded in BEFORE routing, so closed roads are already
  // lethal by the time candidate routes are scored. `judge.ts` is untouched:
  // a closed carriageway is just another DangerZone.
  const field = applyOfficial(projected, official);
  log.info(
    `official: ${countBlocking(official.closures)} blocking closure(s) of ${official.closures.length}, ` +
      `${official.zones.length} evacuation zone(s)` +
      (official.originZone ? ` — origin is inside ${official.originZone.zoneId} (${official.originZone.status})` : ''),
  );

  // ── 5. ROUTE ────────────────────────────────────────────────────────────
  const routes = await fetchRoutes(
    { origin, field, forceOffline: req.forceOffline, scenarioId },
    trace,
  );

  // ── 5b. INTERPRET FIELD REPORTS ─────────────────────────────────────────
  // Claude turns messy human text into structured facts; geometry verifies
  // them; `applyReports` folds the survivors in as danger zones. The judge
  // below is byte-for-byte the same code either way.
  const tuning = tuningFor(req.profile);
  const reportTexts = (req.reports ?? []).filter((t) => t.trim().length > 0);
  const reports: FieldReport[] = [];
  let effectiveField = field;

  // Baseline judgement BEFORE any report, so we can show what changed.
  const baseline =
    reportTexts.length > 0
      ? judgeRoutes({ origin, routes: routes.data, field, tuning })
      : null;

  for (const text of reportTexts) {
    const report = await interpretReport(
      { text, routes: routes.data, origin, forceOffline: req.forceOffline },
      trace,
    );
    reports.push(report);
  }
  if (reports.length > 0) {
    effectiveField = applyReports(field, reports, routes.data);
    const counted = countVerified(reports);
    log.info(
      `reports: ${reports.length} parsed → ${counted.blocks} verified block(s), ${counted.dangers} danger area(s)`,
    );
  }

  // ── 6 & 7. JUDGE + PERSONALIZE ──────────────────────────────────────────
  const judgement = await trace.step('judge', async () =>
    judgeRoutes({ origin, routes: routes.data, field: effectiveField, tuning }),
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
      official,
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

  const impact: ReportImpact | null =
    baseline === null
      ? null
      : {
          report: reports[reports.length - 1]!,
          previousRouteId: baseline.recommended?.route.id ?? null,
          currentRouteId: judgement.recommended?.route.id ?? null,
          rerouted:
            (baseline.recommended?.route.id ?? null) !== (judgement.recommended?.route.id ?? null),
          newlyRejectedRouteIds: judgement.rejected
            .map((r) => r.route.id)
            .filter((id) => !baseline.rejected.some((b) => b.route.id === id)),
          previousCutoffMinutes: baseline.recommended?.minutesUntilCutoff ?? null,
          currentCutoffMinutes: judgement.recommended?.minutesUntilCutoff ?? null,
        };

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
    field: effectiveField,
    profile: req.profile,
    tuning,
    ground: ground.data,
    routes: judgement.scored,
    recommended: judgement.recommended,
    naive: judgement.naive,
    verdict,
    official,
    reports,
    impact,
    trace: trace.finish(),
  };
}
