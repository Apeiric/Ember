/**
 * EMBER — fold verified field reports into the danger field.
 * OWNER: JUDGE
 *
 * PURE. DETERMINISTIC. NO I/O. NO LLM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE POINT OF THIS FILE — AND WHY judge.ts DID NOT CHANGE.
 *
 * A blocked road is not a new concept the judge has to learn. It is a small
 * patch of ground you must not drive through, which is exactly what a
 * `DangerZone` already is. So a report becomes:
 *
 *     "Sunset Blvd is blocked"  →  DangerZone{ severity 1.0, arrives 0 min }
 *
 * and the judge rejects routes through it using the same code path it uses for
 * fire. Not one line of `judge.ts` changed to support real-time reports.
 *
 * That is the hazard-agnostic design earning its keep for the second time: the
 * first was "flood is a different producer of the same structure", this is
 * "so is a human being on the phone".
 *
 * ONLY VERIFIED FACTS GET IN. `interpret.ts` marks a fact verified when it
 * matches real route geometry. Unverified claims are carried through to the UI
 * so the user can see what was said, but they never reach this function's
 * output and therefore never influence a verdict.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { LETHAL_DANGER } from '@ember/shared';
import type { DangerField, DangerZone, FieldReport, LatLng, Route } from '@ember/shared';
import { destination, resamplePath } from '../core/geo';

/**
 * How wide a blocking polygon is drawn across a road, km.
 * Wide enough that the judge cannot thread between blobs; narrow enough not to
 * swallow a parallel road one block over.
 */
const BLOCK_RADIUS_KM = 0.13;

/**
 * Skip this fraction of a blocked segment at its start.
 *
 * A segment begins at a junction, and junctions are shared: the Sunset/PCH
 * intersection is where the southbound and northbound escapes diverge. Blocking
 * from the very first metre closes the junction itself, which takes out the
 * route that merely passes through on its way somewhere else. "PCH south is
 * shut" must not shut PCH north.
 */
const JUNCTION_SKIP_FRACTION = 0.35;

/**
 * Return a NEW danger field with verified report facts added.
 * The input field is not mutated — re-running with different reports is safe.
 */
export function applyReports(
  field: DangerField,
  reports: FieldReport[],
  routes: Route[],
): DangerField {
  const added: DangerZone[] = [];

  for (const report of reports) {
    // ── Blocked roads ────────────────────────────────────────────────────
    for (const block of report.blocks) {
      if (!block.verified) continue; // geometry said no. It does not get a vote.

      for (const { routeId, segmentIndex } of block.affectedSegments) {
        const route = routes.find((r) => r.id === routeId);
        const segment = route?.segments[segmentIndex];
        if (!segment) continue;

        // Cover only THIS segment, and only past the junction it starts at.
        // Blanketing the whole route would close the shared spine every other
        // route leaves the house on; blanketing from the junction would close
        // the routes that merely pass through it. Both strand the user.
        const skipKm = segment.distanceKm * JUNCTION_SKIP_FRACTION;
        for (const sample of resamplePath([segment.start, segment.end], 0.2)) {
          if (sample.distanceKm < skipKm) continue;
          added.push({
            id: `${report.id}-block-${routeId}-${segmentIndex}-${sample.distanceKm.toFixed(2)}`,
            polygon: blob(sample.point, BLOCK_RADIUS_KM),
            // Impassable NOW. Not "dangerous" — closed.
            severity: 1,
            arrivesInMinutes: 0,
            // A closed road is impassable ON the road and fine one street over.
            // No fire-sized shoulder.
            falloffKm: 0.04,
            label: `${block.road} blocked — ${block.reason}`,
          });
        }
      }
    }

    // ── Reported danger areas ────────────────────────────────────────────
    for (const danger of report.dangers) {
      if (!danger.verified || !danger.location) continue;
      added.push({
        id: `${report.id}-danger-${danger.description.slice(0, 16)}`,
        polygon: blob(danger.location, danger.radiusKm),
        // A reported area is a hazard, not necessarily a wall. Cap it below
        // lethal unless the reporter described something extreme, so a smoke
        // report degrades a route rather than deleting it.
        severity: Math.min(danger.severity, LETHAL_DANGER + 0.2),
        arrivesInMinutes: 0,
        // Reported areas are already drawn generously (1.2 km across); a second
        // 800 m shoulder on top would swallow half the map.
        falloffKm: 0.25,
        label: `Reported: ${danger.description}`,
      });
    }
  }

  if (added.length === 0) return field;

  return {
    ...field,
    // The judge assumes ascending arrival order.
    zones: [...field.zones, ...added].sort((a, b) => a.arrivesInMinutes - b.arrivesInMinutes),
  };
}

/** How many verified facts a set of reports actually contributed. */
export function countVerified(reports: FieldReport[]): { blocks: number; dangers: number } {
  return {
    blocks: reports.reduce((n, r) => n + r.blocks.filter((b) => b.verified).length, 0),
    dangers: reports.reduce((n, r) => n + r.dangers.filter((d) => d.verified).length, 0),
  };
}

/** A rough circle. 12 sides is plenty for a blocking polygon. */
function blob(center: LatLng, radiusKm: number): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i < 12; i++) pts.push(destination(center, (i * 360) / 12, radiusKm));
  return pts;
}
