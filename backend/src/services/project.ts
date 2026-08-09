/**
 * EMBER — hazard projection. CONTEXT.md §5 step 4.
 * OWNER: JUDGE
 *
 * Turns a `Hazard` (where the fire IS) into a `DangerField` (where the fire is
 * GOING). This is the boundary where "wildfire" stops existing as a concept:
 * everything downstream sees only polygons with severities and arrival times.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠️  THIS IS A HEURISTIC, NOT A FIRE-BEHAVIOUR MODEL. SAY SO ON STAGE.
 *
 * Real operational modelling (Rothermel, FARSITE, ELMFIRE) needs fuel type,
 * fuel moisture, canopy structure, and serious compute. We use two textbook
 * rules of thumb:
 *
 *   1. A wind-driven fire runs downwind at roughly a fixed fraction of wind speed.
 *   2. Rate of spread roughly doubles for every 10° of upslope.
 *
 * Plus a flank term, because fires widen as they run.
 *
 * We deliberately OVER-DRAW the danger zone (convex sweep + dilation).
 * A false "dangerous" costs a detour. A false "safe" costs a life.
 * That asymmetry is a design decision, not an accident.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HAZARD-AGNOSTIC NOTE: to support flood, write `projectFloodField()` next to
 * this returning the same `DangerField` (water spreading downhill instead of
 * downwind, arrival times from a hydrograph instead of a wind vector). The
 * judge, the routing, the personalization, and the verdict do not change.
 * DO NOT BUILD THAT TODAY — CONTEXT.md §9.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  DANGER_FALLOFF_KM,
  DANGER_INTENSIFY_MIN,
  PROJECTION_DISCLAIMER,
  PROJECTION_HORIZON_MIN,
  PROJECTION_MODEL_ID,
  PROJECTION_RINGS_MIN,
  RING_SEVERITY,
  ROS_BASE_KPH,
  ROS_FLANK_RATIO,
  ROS_MAX_KPH,
  ROS_WIND_FACTOR,
  SLOPE_DOUBLING_DEG,
} from '@ember/shared';
import type { DangerField, DangerZone, GroundContext, Hazard, LatLng } from '@ember/shared';
import {
  bufferPolygon,
  destination,
  normalizeBearing,
  signedDistanceKm,
  sweepPolygon,
} from '../core/geo';

/**
 * Estimated rate of spread in km/h.
 * Exported so `judge.test.ts` can assert the heuristic directly.
 */
export function rateOfSpreadKph(hazard: Hazard, ground: GroundContext | null): number {
  const base = ROS_BASE_KPH + ROS_WIND_FACTOR * Math.max(0, hazard.wind.speedKph);
  return Math.min(ROS_MAX_KPH, base * slopeMultiplier(hazard, ground));
}

/**
 * How much the terrain accelerates the fire.
 *
 * `aspectDeg` is the DOWNHILL direction, so upslope is aspect + 180°. A fire
 * only gets the slope bonus to the extent the wind is pushing it uphill, so we
 * scale by the cosine between the wind's travel direction and upslope.
 */
export function slopeMultiplier(hazard: Hazard, ground: GroundContext | null): number {
  if (!ground || ground.slopePct == null || ground.aspectDeg == null) return 1;

  const slopeDeg = Math.atan(Math.abs(ground.slopePct) / 100) * (180 / Math.PI);
  const upslopeBearing = normalizeBearing(ground.aspectDeg + 180);
  const delta = ((hazard.wind.toDeg - upslopeBearing + 540) % 360) - 180;
  const alignment = Math.cos((delta * Math.PI) / 180);

  // Only an uphill push counts. Downhill runs are handled by the wind term.
  const effectiveSlopeDeg = slopeDeg * Math.max(0, alignment);
  return 2 ** (effectiveSlopeDeg / SLOPE_DOUBLING_DEG);
}

/** Build the time-evolving danger field for a hazard. */
export function projectDangerField(hazard: Hazard, ground: GroundContext | null): DangerField {
  const rosKph = rateOfSpreadKph(hazard, ground);
  const bearing = hazard.wind.toDeg;
  const zones: DangerZone[] = [];

  PROJECTION_RINGS_MIN.forEach((minutes, ringIndex) => {
    const severity = RING_SEVERITY[ringIndex] ?? 0.3;
    const headKm = (rosKph * minutes) / 60;
    const flankKm = headKm * ROS_FLANK_RATIO;

    hazard.perimeter.forEach((poly, polyIndex) => {
      if (poly.length < 3) return;

      // t=0 keeps the true perimeter shape — it is what we draw on the map, and
      // convexifying the real fire outline would be a lie about observed data.
      const projected =
        minutes === 0 ? poly : bufferPolygon(sweepPolygon(poly, bearing, headKm), flankKm);

      zones.push({
        id: `${hazard.id}-p${polyIndex}-t${minutes}`,
        polygon: projected,
        severity,
        arrivesInMinutes: minutes,
        label:
          minutes === 0
            ? 'Active fire perimeter'
            : `Projected spread — ${minutes} min`,
      });
    });
  });

  // Hotspots become their own small active zones. This matters when the
  // perimeter feed is stale or missing but FIRMS still has detections: we can
  // build a usable danger field out of satellite hotspots alone.
  for (const hotspot of hazard.hotspots) {
    if (hotspot.confidence < 0.5) continue;
    zones.push({
      id: `${hazard.id}-hs-${hotspot.location.lat.toFixed(4)}-${hotspot.location.lng.toFixed(4)}`,
      polygon: circle(hotspot.location, 0.45),
      severity: Math.min(1, 0.7 + hotspot.confidence * 0.3),
      arrivesInMinutes: 0,
      label: 'Satellite hotspot',
    });
  }

  // The judge assumes ascending arrival order so it can stop at the first match.
  zones.sort((a, b) => a.arrivesInMinutes - b.arrivesInMinutes);

  return {
    hazardId: hazard.id,
    kind: hazard.kind,
    zones,
    spreadBearingDeg: bearing,
    spreadRateKph: Math.round(rosKph * 100) / 100,
    horizonMinutes: PROJECTION_HORIZON_MIN,
    model: PROJECTION_MODEL_ID,
    disclaimer: PROJECTION_DISCLAIMER,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DANGER SAMPLING — the two questions the judge asks the field.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * How dangerous is `point` at `minutes` from now? Returns 0..1.
 *
 * Danger does not stop at the polygon edge — it decays over `DANGER_FALLOFF_KM`,
 * because standing 50 metres from a fire front is not safe just because you are
 * outside a line someone drew. And once the front has passed through, the area
 * intensifies toward fully-involved rather than staying at its ring severity.
 */
export function dangerAt(field: DangerField, point: LatLng, minutes: number): number {
  let worst = 0;
  for (const zone of field.zones) {
    if (minutes < zone.arrivesInMinutes) continue; // hasn't got here yet
    const contribution = zoneDanger(zone, point, minutes);
    if (contribution > worst) worst = contribution;
    if (worst >= 1) return 1;
  }
  return worst;
}

/**
 * The earliest minute at which `point` becomes meaningfully dangerous, or
 * `null` if it stays clear for the whole projection horizon.
 *
 * Subtract your own arrival time from this and you get the headline number:
 * "~40 minutes before this road is cut off".
 */
export function dangerArrivalAt(
  field: DangerField,
  point: LatLng,
  contactThreshold: number,
): number | null {
  // zones are sorted ascending by arrivesInMinutes, so the first hit is earliest.
  for (const zone of field.zones) {
    if (zoneDanger(zone, point, zone.arrivesInMinutes) >= contactThreshold) {
      return zone.arrivesInMinutes;
    }
  }
  return null;
}

function zoneDanger(zone: DangerZone, point: LatLng, minutes: number): number {
  const proximity = proximityFactor(zone, point);
  if (proximity <= 0) return 0;

  const elapsed = Math.max(0, minutes - zone.arrivesInMinutes);
  const intensified =
    zone.severity + (1 - zone.severity) * Math.min(1, elapsed / DANGER_INTENSIFY_MIN);

  return intensified * proximity;
}

/** 1 inside the polygon, decaying linearly to 0 at DANGER_FALLOFF_KM outside. */
function proximityFactor(zone: DangerZone, point: LatLng): number {
  // Cheap bbox reject first — this runs in the innermost scoring loop.
  const b = zoneBBox(zone);
  const pad = DANGER_FALLOFF_KM / 85; // conservative degrees-per-km at CA latitudes
  if (
    point.lng < b[0] - pad ||
    point.lng > b[2] + pad ||
    point.lat < b[1] - pad ||
    point.lat > b[3] + pad
  ) {
    return 0;
  }

  const d = signedDistanceKm(point, zone.polygon);
  if (d <= 0) return 1;
  if (d >= DANGER_FALLOFF_KM) return 0;
  return 1 - d / DANGER_FALLOFF_KM;
}

// Memoized per-zone geometry. Zones are rebuilt per request, and a route can
// sample a few hundred points against a dozen zones — recomputing the bbox each
// time is the difference between 5ms and 300ms.
const bboxCache = new WeakMap<DangerZone, [number, number, number, number]>();

function zoneBBox(zone: DangerZone): [number, number, number, number] {
  const hit = bboxCache.get(zone);
  if (hit) return hit;
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of zone.polygon) {
    if (p.lng < w) w = p.lng;
    if (p.lng > e) e = p.lng;
    if (p.lat < s) s = p.lat;
    if (p.lat > n) n = p.lat;
  }
  const box: [number, number, number, number] = [w, s, e, n];
  bboxCache.set(zone, box);
  return box;
}

/** Approximate a circle as a 16-gon. Used for hotspots. */
function circle(center: LatLng, radiusKm: number): LatLng[] {
  const pts: LatLng[] = [];
  for (let i = 0; i < 16; i++) pts.push(destination(center, (i * 360) / 16, radiusKm));
  return pts;
}
