/**
 * ███████╗███╗   ███╗██████╗ ███████╗██████╗
 * ██╔════╝████╗ ████║██╔══██╗██╔════╝██╔══██╗   THE JUDGE
 * █████╗  ██╔████╔██║██████╔╝█████╗  ██████╔╝   CONTEXT.md §5 step 6
 * ██╔══╝  ██║╚██╔╝██║██╔══██╗██╔══╝  ██╔══██╗
 * ███████╗██║ ╚═╝ ██║██████╔╝███████╗██║  ██║
 *
 * OWNER: JUDGE (Navelan) — this is the file that makes Ember different.
 *
 * PURE. DETERMINISTIC. NO I/O. NO NETWORK. NO LLM. FULLY UNIT-TESTABLE.
 * Same inputs → same outputs, every time. Do not put a fetch in this file.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT MAKES THIS DIFFERENT FROM EVERY ROUTING ENGINE
 *
 * Google asks: "how long does this road take?"
 * We ask:      "where will the fire be WHEN I GET THERE?"
 *
 * For every point along every candidate route we compute two numbers:
 *
 *   yourArrival   — when YOU reach this point (prep time + travel × your pace)
 *   dangerArrival — when the FIRE reaches this point (from the danger field)
 *
 * The gap between them is your margin. The smallest gap anywhere along a route
 * is `minutesUntilCutoff` — the number on the verdict card. If it goes negative,
 * the fire gets there first and the route is rejected no matter how fast it is.
 *
 * That is the whole idea. A road that is clear right now is an inferno in twenty
 * minutes, and a snapshot router will happily send you down it.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HAZARD-AGNOSTIC BY CONSTRUCTION
 *
 * Search this file for "fire". You will find it in comments only. The judge
 * consumes a `DangerField` — polygons with a severity and an arrival time — and
 * nothing else. Flood and earthquake produce the same structure from different
 * physics, and this file would not change by a single line.
 *
 * That claim is true, it is a pitch point, and it stays true only if you keep
 * hazard-specific reasoning out of here. Put it in `project.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
  CONTACT_DANGER,
  LETHAL_DANGER,
  MARGINAL_EXPOSURE,
  ROUTE_SAMPLE_KM,
} from '@ember/shared';
import type {
  DangerContact,
  DangerField,
  JudgeResult,
  LatLng,
  ProfileTuning,
  Route,
  RouteRating,
  ScoredRoute,
} from '@ember/shared';
import { bearingDeg, compassFromBearing, resamplePath } from '../core/geo';
import { dangerArrivalAt, dangerAt } from './project';

export interface JudgeInput {
  origin: LatLng;
  routes: Route[];
  field: DangerField;
  tuning: ProfileTuning;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export function judgeRoutes(input: JudgeInput): JudgeResult {
  const { origin, routes, field, tuning } = input;

  // "What your phone would do": fastest by raw driving time, safety ignored.
  // Ties broken by distance so the result is stable across runs.
  const naiveId = pickNaiveId(routes);

  const scored = routes.map((route) =>
    scoreRoute(route, field, tuning, origin, route.id === naiveId),
  );

  scored.sort((a, b) => rank(a) - rank(b) || cost(a, tuning, field) - cost(b, tuning, field));

  const recommended = scored.find((s) => s.rating !== 'REJECTED') ?? null;
  const rejected = scored.filter((s) => s.rating === 'REJECTED');
  const naive = scored.find((s) => s.isNaiveFastest) ?? null;

  return {
    scored,
    recommended,
    naive,
    rejected,
    allRoutesDangerous: recommended === null,
    // THE MONEY SHOT: the fastest route is one we refuse to give you.
    naiveWasRejected: naive?.rating === 'REJECTED',
    field,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SCORING A SINGLE ROUTE
// ═══════════════════════════════════════════════════════════════════════════

export function scoreRoute(
  route: Route,
  field: DangerField,
  tuning: ProfileTuning,
  origin: LatLng,
  isNaiveFastest: boolean,
): ScoredRoute {
  const samples = resamplePath(route.path, ROUTE_SAMPLE_KM);

  let exposureScore = 0;
  let peakDanger = 0;
  let firstContact: DangerContact | null = null;
  let minutesUntilCutoff: number | null = null;
  let previousArrival = tuning.prepMinutes;

  for (const sample of samples) {
    // WHEN DO *I* GET HERE?
    // Prep time first — you are not moving during it, but the fire is.
    const yourArrival =
      tuning.prepMinutes + etaAtDistanceKm(route, sample.distanceKm) * tuning.paceMultiplier;

    // HOW BAD IS IT HERE, AT THAT MOMENT?
    const danger = dangerAt(field, sample.point, yourArrival);

    // Cumulative exposure: danger integrated over the time you spend in it.
    // Two minutes at 0.5 is worse than ten seconds at 0.9 — snapshot scoring
    // cannot express that, and it is exactly what kills people in slow traffic.
    const deltaMinutes = Math.max(0, yourArrival - previousArrival);
    exposureScore += danger * deltaMinutes;
    previousArrival = yourArrival;

    if (danger > peakDanger) peakDanger = danger;

    if (!firstContact && danger >= CONTACT_DANGER) {
      firstContact = {
        segmentIndex: segmentIndexAtDistance(route, sample.distanceKm),
        location: sample.point,
        minutesIntoTrip: round(yourArrival, 1),
        danger: round(danger, 3),
        zoneId: nearestZoneId(field, sample.point, yourArrival),
        zoneLabel: nearestZoneLabel(field, sample.point, yourArrival),
      };
    }

    // WHEN DOES THE FIRE GET HERE? The race, point by point.
    const dangerArrival = dangerArrivalAt(field, sample.point, CONTACT_DANGER);
    if (dangerArrival !== null) {
      const slack = dangerArrival - yourArrival;
      if (minutesUntilCutoff === null || slack < minutesUntilCutoff) {
        minutesUntilCutoff = slack;
      }
    }
  }

  const marginMinutes =
    minutesUntilCutoff === null ? null : minutesUntilCutoff - tuning.safetyMarginMinutes;

  const climbM = route.segments.reduce((sum, s) => sum + Math.max(0, s.elevationGainM ?? 0), 0);
  const brg = bearingDeg(origin, route.destination.location);

  const rating = rate({ peakDanger, minutesUntilCutoff, marginMinutes, exposureScore, tuning });

  return {
    route,
    rating,
    exposureScore: round(exposureScore, 2),
    peakDanger: round(peakDanger, 3),
    firstContact,
    minutesUntilCutoff: minutesUntilCutoff === null ? null : round(minutesUntilCutoff, 1),
    marginMinutes: marginMinutes === null ? null : round(marginMinutes, 1),
    reasons: explain({
      route,
      rating,
      peakDanger,
      exposureScore,
      firstContact,
      minutesUntilCutoff,
      marginMinutes,
      tuning,
      isNaiveFastest,
      field,
      alignment: spreadAlignment(brg, field),
    }),
    bearingDeg: round(brg, 1),
    direction: compassFromBearing(brg),
    isNaiveFastest,
    climbM: Math.round(climbM),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// THE VERDICT ON A ROUTE
// ═══════════════════════════════════════════════════════════════════════════

interface RateInput {
  peakDanger: number;
  minutesUntilCutoff: number | null;
  marginMinutes: number | null;
  exposureScore: number;
  tuning: ProfileTuning;
}

function rate({
  peakDanger,
  minutesUntilCutoff,
  marginMinutes,
  exposureScore,
  tuning,
}: RateInput): RouteRating {
  // ── Hard rejections. No amount of speed buys your way past these. ────────

  // The route crosses ground that is, or will be, actively burning.
  if (peakDanger >= LETHAL_DANGER) return 'REJECTED';

  // The fire reaches a point on this route before you do. You lose the race.
  if (minutesUntilCutoff !== null && minutesUntilCutoff < 0) return 'REJECTED';

  // ── Downgrades. Passable, but you would be relying on the projection being
  //    right, and it is a heuristic. Say so rather than pretending. ──────────

  // You make it, but with no buffer left for THIS person.
  if (marginMinutes !== null && marginMinutes < 0) return 'MARGINAL';

  // Danger higher than this person should be asked to drive through.
  if (peakDanger > tuning.maxTolerableDanger) return 'MARGINAL';

  // Long exposure to moderate danger — the slow-traffic-through-smoke case.
  if (exposureScore > MARGINAL_EXPOSURE) return 'MARGINAL';

  return 'SAFE';
}

const RANK: Record<RouteRating, number> = { SAFE: 0, MARGINAL: 1, REJECTED: 2 };
const rank = (s: ScoredRoute): number => RANK[s.rating];

/**
 * Tie-breaker within a rating band. Danger dominates; time matters but is not
 * allowed to win an argument with safety; climb only matters for profiles that
 * asked us to care about it.
 */
function cost(s: ScoredRoute, tuning: ProfileTuning, field: DangerField): number {
  const time = s.route.durationMinutes * tuning.paceMultiplier;
  const climbPenalty = (s.climbM / 100) * tuning.slopePenalty * 4;
  const slackBonus = Math.min(s.marginMinutes ?? 60, 60) * 0.3;
  return (
    s.exposureScore * 15 +
    time * 0.5 +
    climbPenalty +
    alignmentPenalty(s, field) -
    slackBonus
  );
}

/**
 * How much this route runs ALONG the hazard's direction of travel rather than
 * across it. 1 = driving in the same direction the fire is moving, 0 = crossing
 * it or heading away.
 */
export function spreadAlignment(routeBearingDeg: number, field: DangerField): number {
  const delta = ((routeBearingDeg - field.spreadBearingDeg + 540) % 360) - 180;
  return Math.max(0, Math.cos((delta * Math.PI) / 180));
}

/**
 * Penalise driving along the hazard's path even when the projection says you
 * would stay ahead of it.
 *
 * Two reasons, and both are real rather than cosmetic:
 *   • Staying in front of a fire keeps you in its path for the whole trip. Any
 *     delay — a closure, a collision, gridlock — puts it back on top of you.
 *   • Our projection is a HEURISTIC. If the rate of spread is underestimated,
 *     a route running across the fire's path degrades gracefully, while a route
 *     running along it fails catastrophically.
 *
 * Deliberately a cost, not a rejection: if the only way out runs downwind, we
 * still give it to you rather than telling you to stay and burn.
 */
function alignmentPenalty(s: ScoredRoute, field: DangerField): number {
  return spreadAlignment(s.bearingDeg, field) * 10;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPLANATION — machine-generated, human-readable. Claude turns these into prose;
// if Claude is unavailable, the template verdict uses them verbatim. Either way
// the REASONING is computed here, not invented by a language model.
// ═══════════════════════════════════════════════════════════════════════════

interface ExplainInput {
  route: Route;
  rating: RouteRating;
  peakDanger: number;
  exposureScore: number;
  firstContact: DangerContact | null;
  minutesUntilCutoff: number | null;
  marginMinutes: number | null;
  tuning: ProfileTuning;
  isNaiveFastest: boolean;
  field: DangerField;
  /** 0..1, how much this route runs along the hazard's direction of travel. */
  alignment: number;
}

function explain(i: ExplainInput): string[] {
  const out: string[] = [];

  if (i.isNaiveFastest) {
    out.push(
      `Fastest option by travel time (${Math.round(i.route.durationMinutes)} min) — this is the route a traffic-optimised app would give you.`,
    );
  }

  if (i.peakDanger >= LETHAL_DANGER) {
    out.push(
      `Crosses ground that is burning or projected to burn (peak danger ${i.peakDanger.toFixed(2)}). Rejected outright.`,
    );
  }

  if (i.firstContact) {
    out.push(
      `Meets the ${i.firstContact.zoneLabel.toLowerCase()} about ${Math.round(i.firstContact.minutesIntoTrip)} min into the trip.`,
    );
  } else {
    out.push('Stays clear of the projected danger zone for the whole trip.');
  }

  if (i.minutesUntilCutoff !== null) {
    if (i.minutesUntilCutoff < 0) {
      out.push(
        `The hazard reaches this road roughly ${Math.abs(Math.round(i.minutesUntilCutoff))} min before you would. You would not win that race.`,
      );
    } else {
      out.push(
        `Tightest point on the route: about ${Math.round(i.minutesUntilCutoff)} min of slack between you and the hazard.`,
      );
      if (i.marginMinutes !== null && i.marginMinutes < 0) {
        out.push(
          `That is inside the ${i.tuning.safetyMarginMinutes} min safety buffer for ${i.tuning.label.toLowerCase()} — leave immediately if you take it.`,
        );
      }
    }
  } else {
    out.push(
      `No projected hazard contact within the ${i.field.horizonMinutes} min forecast horizon.`,
    );
  }

  if (i.exposureScore > MARGINAL_EXPOSURE) {
    out.push(
      `Long exposure to moderate danger (score ${i.exposureScore.toFixed(1)}) — slow going through a smoky corridor rather than one sharp crossing.`,
    );
  }

  if (i.alignment > 0.6) {
    out.push(
      'Runs in the same direction the hazard is travelling — you would be staying ahead of it rather than getting out of its way.',
    );
  } else if (i.alignment < 0.2 && i.rating !== 'REJECTED') {
    out.push('Moves across the hazard’s path rather than along it.');
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/** Fastest by raw duration — no safety input at all. That is the point. */
function pickNaiveId(routes: Route[]): string | null {
  if (routes.length === 0) return null;
  let best = routes[0]!;
  for (const r of routes) {
    if (
      r.durationMinutes < best.durationMinutes ||
      (r.durationMinutes === best.durationMinutes && r.distanceKm < best.distanceKm)
    ) {
      best = r;
    }
  }
  return best.id;
}

/**
 * Minutes of travel to reach `km` along the route, honouring per-segment speed.
 * Distance-fraction would flatten a slow canyon road and a fast highway into the
 * same average, and the whole model depends on this number being right.
 */
export function etaAtDistanceKm(route: Route, km: number): number {
  if (km <= 0) return 0;
  let travelled = 0;
  for (const seg of route.segments) {
    if (travelled + seg.distanceKm >= km) {
      const within = seg.distanceKm > 0 ? (km - travelled) / seg.distanceKm : 0;
      return seg.cumulativeMinutes - seg.durationMinutes + seg.durationMinutes * within;
    }
    travelled += seg.distanceKm;
  }
  return route.durationMinutes;
}

function segmentIndexAtDistance(route: Route, km: number): number {
  let travelled = 0;
  for (const seg of route.segments) {
    travelled += seg.distanceKm;
    if (travelled >= km) return seg.index;
  }
  return Math.max(0, route.segments.length - 1);
}

function nearestZoneId(field: DangerField, point: LatLng, minutes: number): string {
  return worstZone(field, point, minutes)?.id ?? 'unknown';
}

function nearestZoneLabel(field: DangerField, point: LatLng, minutes: number): string {
  return worstZone(field, point, minutes)?.label ?? 'Danger zone';
}

function worstZone(field: DangerField, point: LatLng, minutes: number) {
  let best: { id: string; label: string; value: number } | null = null;
  for (const zone of field.zones) {
    if (minutes < zone.arrivesInMinutes) continue;
    // Re-use the field's own sampler so the label always matches the number.
    const value = dangerAt({ ...field, zones: [zone] }, point, minutes);
    if (value > 0 && (!best || value > best.value)) {
      best = { id: zone.id, label: zone.label, value };
    }
  }
  return best;
}

function round(n: number, places: number): number {
  const f = 10 ** places;
  return Math.round(n * f) / f;
}
