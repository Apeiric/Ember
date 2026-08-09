/**
 * EMBER — fold official closures and evacuation orders into the danger field.
 * OWNER: JUDGE
 *
 * PURE. DETERMINISTIC. NO I/O. NO LLM.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIRD TIME judge.ts DID NOT CHANGE.
 *
 *   fire      → DangerZone   (project.ts)
 *   a neighbour's text → DangerZone   (apply-report.ts)
 *   the State of California → DangerZone   (this file)
 *
 * Three completely different kinds of input, one structure, one judge. That is
 * the hazard-agnostic design paying for itself again.
 *
 * TWO DIFFERENT THINGS, DELIBERATELY TREATED DIFFERENTLY:
 *
 *   A CLOSED ROAD is a wall. Caltrans says the carriageway is shut, so it is
 *   impassable — lethal severity, tiny falloff, route rejected.
 *
 *   AN EVACUATION ORDER is not a wall. It means "leave this area", and the
 *   person we are routing is usually standing inside one. Marked `advisory`, so
 *   it adds to cumulative exposure — making the judge prefer routes that get
 *   out quickly — but never rejects a route and never starts a countdown. Treat
 *   it as danger and you tell someone under an evacuation order to shelter in
 *   place, which is precisely backwards.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { DangerField, DangerZone, EvacuationZone, LatLng, RoadClosure } from '@ember/shared';
import { destination, haversineKm } from '../core/geo';

/** Half-width of the wall drawn across a closed carriageway, km. */
const CLOSURE_RADIUS_KM = 0.11;

/** Blocks are laid along the closure at this spacing so nothing can thread it. */
const CLOSURE_STEP_KM = 0.2;

/**
 * Ramps are not carriageways.
 *
 * Caltrans reports on/off ramp closures constantly, and a shut ramp does not
 * shut the freeway it hangs off. Modelling one as a wall across the mainline
 * would reject a perfectly good escape route several times an hour in Los
 * Angeles. Mainline and connector closures are the ones that stop you.
 */
const BLOCKING_FACILITIES = /mainline|connector|conventional|collector|hov/i;

/** Exposure weight per evacuation status. All well under CONTACT_DANGER. */
const EVAC_SEVERITY: Record<EvacuationZone['status'], number> = {
  order: 0.34,
  warning: 0.18,
  advisory: 0.1,
  unknown: 0.1,
};

export interface OfficialInput {
  closures: RoadClosure[];
  zones: EvacuationZone[];
}

/**
 * Return a NEW danger field with official facts added. Input is not mutated.
 */
export function applyOfficial(field: DangerField, input: OfficialInput): DangerField {
  const added: DangerZone[] = [];

  // ── Closed roads: walls ──────────────────────────────────────────────────
  for (const closure of input.closures) {
    if (!BLOCKING_FACILITIES.test(closure.facility)) continue;

    const label = `${closure.road} closed — ${closure.reason}`;
    for (const point of spanPoints(closure.from, closure.to)) {
      added.push({
        id: `${closure.id}-${point.lat.toFixed(4)},${point.lng.toFixed(4)}`,
        polygon: blob(point, CLOSURE_RADIUS_KM),
        severity: 1,
        arrivesInMinutes: 0,
        // Shut on the road, fine one street over — not a fire-sized shoulder.
        falloffKm: 0.04,
        label,
      });
    }
  }

  // ── Evacuation zones: pressure, not walls ────────────────────────────────
  for (const zone of input.zones) {
    if (zone.polygon.length < 3) continue;
    added.push({
      id: `evaczone-${zone.id}`,
      polygon: zone.polygon,
      severity: EVAC_SEVERITY[zone.status],
      arrivesInMinutes: 0,
      falloffKm: 0.1,
      // Never rejects, never starts a countdown. See the header.
      advisory: true,
      label: `${statusLabel(zone.status)} — zone ${zone.zoneId}`,
    });
  }

  if (added.length === 0) return field;

  return {
    ...field,
    // The judge assumes ascending arrival order.
    zones: [...field.zones, ...added].sort((a, b) => a.arrivesInMinutes - b.arrivesInMinutes),
  };
}

export function statusLabel(status: EvacuationZone['status']): string {
  switch (status) {
    case 'order':
      return 'Evacuation order';
    case 'warning':
      return 'Evacuation warning';
    case 'advisory':
      return 'Evacuation advisory';
    default:
      return 'Evacuation zone';
  }
}

/** How many closures actually blocked anything, for the trace and the UI. */
export function countBlocking(closures: RoadClosure[]): number {
  return closures.filter((c) => BLOCKING_FACILITIES.test(c.facility)).length;
}

/** Points along a closure span, inclusive of both ends. */
function spanPoints(from: LatLng, to: LatLng): LatLng[] {
  const km = haversineKm(from, to);
  if (km < 0.01) return [from];
  // Long closures are common (a whole freeway segment); cap the blob count so a
  // 40 km closure does not add 200 polygons to every scoring pass.
  const steps = Math.min(40, Math.max(1, Math.ceil(km / CLOSURE_STEP_KM)));
  const out: LatLng[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    out.push({ lat: from.lat + (to.lat - from.lat) * t, lng: from.lng + (to.lng - from.lng) * t });
  }
  return out;
}

function blob(center: LatLng, radiusKm: number): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i < 12; i++) pts.push(destination(center, (i * 360) / 12, radiusKm));
  return pts;
}
