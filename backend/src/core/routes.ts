/**
 * EMBER — route construction helper.
 * OWNER: JUDGE
 *
 * Both the live Google Directions adapter and the canned fixtures need to turn
 * "a list of points plus a duration" into a `Route` with time-stamped segments.
 * That logic lives here so the two can never drift apart — the judge scores
 * canned and live routes through identical code.
 */

import type { Destination, LatLng, Provenance, Route, RouteSegment } from '@ember/shared';
import { haversineKm } from './geo';

export interface RouteLeg {
  /** Ordered points for this leg. The first point should repeat the previous leg's last. */
  path: LatLng[];
  /** Driving time for this leg under current conditions, minutes. */
  durationMinutes: number;
}

export interface BuildRouteInput {
  id: string;
  summary: string;
  legs: RouteLeg[];
  destination: Destination;
  provenance: Provenance;
}

/**
 * Build a `Route` with per-segment cumulative timing.
 *
 * `cumulativeMinutes` on each segment is the ETA at that segment's END. This is
 * the field that makes the whole system time-aware: the judge asks the danger
 * field "how bad is this point at THAT minute", not "how bad is it now".
 */
export function buildRoute(input: BuildRouteInput): Route {
  const path: LatLng[] = [];
  const segments: RouteSegment[] = [];
  let cumulativeMinutes = 0;
  let totalKm = 0;

  for (const leg of input.legs) {
    const legKm = legLengthKm(leg.path);
    // Distribute the leg's duration across its segments in proportion to length,
    // so a long straight stretch takes longer than a short one at the same speed.
    for (let i = 1; i < leg.path.length; i++) {
      const start = leg.path[i - 1]!;
      const end = leg.path[i]!;
      const distanceKm = haversineKm(start, end);
      const share = legKm > 0 ? distanceKm / legKm : 0;
      const durationMinutes = leg.durationMinutes * share;
      cumulativeMinutes += durationMinutes;
      totalKm += distanceKm;

      segments.push({
        index: segments.length,
        start,
        end,
        distanceKm,
        durationMinutes,
        cumulativeMinutes,
      });

      if (path.length === 0) path.push(start);
      path.push(end);
    }
  }

  return {
    id: input.id,
    summary: input.summary,
    path,
    segments,
    distanceKm: round(totalKm, 3),
    durationMinutes: round(cumulativeMinutes, 2),
    destination: input.destination,
    provenance: input.provenance,
  };
}

function legLengthKm(path: LatLng[]): number {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += haversineKm(path[i - 1]!, path[i]!);
  return km;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
