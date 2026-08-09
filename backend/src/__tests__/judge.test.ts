/**
 * EMBER — judge tests. THE MOST IMPORTANT TESTS IN THE REPO.
 * OWNER: JUDGE
 *
 * These prove the two claims the whole pitch rests on:
 *
 *   1. TIME-EVOLVING ROUTING. A road that is clear right now gets rejected
 *      because the fire reaches it before you do. A snapshot router cannot do
 *      this, and it is what "route by where the fire is GOING" actually means.
 *
 *   2. PERSONALIZATION. The same fire and the same roads produce a different
 *      verdict for a person who moves more slowly.
 *
 * If either of these breaks, the demo is a lie. Run `npm test` before you push.
 */

import { describe, expect, it } from 'vitest';
import { PROFILE_TUNING } from '@ember/shared';
import type { DangerField, LatLng, ProfileTuning, Route } from '@ember/shared';
import { buildRoute } from '../core/routes';
import { judgeRoutes, etaAtDistanceKm, spreadAlignment } from '../services/judge';
import { computeFacts } from '../services/verdict';
import { dangerArrivalAt, dangerAt, projectDangerField, rateOfSpreadKph } from '../services/project';
import { tuningFor } from '../services/profiles';
import { PALISADES_HAZARD, PALISADES_ORIGIN, PALISADES_ROUTES } from '../fixtures/palisades-2025';
import { PALISADES_GROUND } from '../fixtures/palisades-2025';

const STANDARD: ProfileTuning = PROFILE_TUNING.standard;
const VULNERABLE: ProfileTuning = PROFILE_TUNING.vulnerable;

const canned = {
  source: 'canned' as const,
  provider: 'test',
  fetchedAt: '2025-01-08T02:00:00.000Z',
};

function route(id: string, path: LatLng[], durationMinutes: number): Route {
  return buildRoute({
    id,
    summary: id,
    legs: [{ path, durationMinutes }],
    destination: { id: `${id}-dest`, name: id, location: path[path.length - 1]!, kind: 'city' },
    provenance: canned,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// A SYNTHETIC FIELD — a 2 km burning square, no spread, so the arithmetic is
// obvious and a failure points at one thing.
// ═══════════════════════════════════════════════════════════════════════════

const BURNING_SQUARE: DangerField = {
  hazardId: 'test',
  kind: 'wildfire',
  zones: [
    {
      id: 'now',
      polygon: [
        { lat: 34.06, lng: -118.53 },
        { lat: 34.08, lng: -118.53 },
        { lat: 34.08, lng: -118.51 },
        { lat: 34.06, lng: -118.51 },
      ],
      severity: 1,
      arrivesInMinutes: 0,
      label: 'Active fire perimeter',
    },
  ],
  spreadBearingDeg: 220,
  spreadRateKph: 0,
  horizonMinutes: 90,
  model: 'test',
  disclaimer: 'test',
};

describe('dangerAt', () => {
  it('is maximal inside the perimeter', () => {
    expect(dangerAt(BURNING_SQUARE, { lat: 34.07, lng: -118.52 }, 0)).toBe(1);
  });

  it('decays with distance rather than stopping at the line', () => {
    const near = dangerAt(BURNING_SQUARE, { lat: 34.0565, lng: -118.52 }, 0);
    const far = dangerAt(BURNING_SQUARE, { lat: 34.0, lng: -118.52 }, 0);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(1);
    expect(far).toBe(0);
  });

  it('returns zero before the hazard arrives', () => {
    const future: DangerField = {
      ...BURNING_SQUARE,
      zones: [{ ...BURNING_SQUARE.zones[0]!, arrivesInMinutes: 40, severity: 0.8 }],
    };
    expect(dangerAt(future, { lat: 34.07, lng: -118.52 }, 10)).toBe(0);
    expect(dangerAt(future, { lat: 34.07, lng: -118.52 }, 45)).toBeGreaterThan(0.8);
  });
});

describe('etaAtDistanceKm', () => {
  it('honours per-segment speed rather than averaging', () => {
    // 1 km slow leg (10 min) then 1 km fast leg (2 min).
    const r = buildRoute({
      id: 'mixed',
      summary: 'mixed',
      legs: [
        { path: [{ lat: 34, lng: -118 }, { lat: 34.009, lng: -118 }], durationMinutes: 10 },
        { path: [{ lat: 34.009, lng: -118 }, { lat: 34.018, lng: -118 }], durationMinutes: 2 },
      ],
      destination: { id: 'd', name: 'd', location: { lat: 34.018, lng: -118 }, kind: 'city' },
      provenance: canned,
    });

    // Halfway by DISTANCE is ~10 minutes in, not ~6. Distance-fraction timing
    // would flatten the canyon road and the highway into one average speed.
    expect(etaAtDistanceKm(r, r.distanceKm / 2)).toBeGreaterThan(9);
    expect(etaAtDistanceKm(r, r.distanceKm)).toBeCloseTo(12, 1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM 1: ROUTES THROUGH ACTIVE FIRE ARE REJECTED
// ═══════════════════════════════════════════════════════════════════════════

describe('judgeRoutes — rejecting active fire', () => {
  const origin: LatLng = { lat: 34.07, lng: -118.56 };

  const through = route(
    'through-the-fire',
    [{ lat: 34.07, lng: -118.56 }, { lat: 34.07, lng: -118.52 }, { lat: 34.07, lng: -118.48 }],
    8, // fastest
  );
  const around = route(
    'around-the-south',
    [{ lat: 34.07, lng: -118.56 }, { lat: 34.03, lng: -118.54 }, { lat: 34.03, lng: -118.48 }],
    20, // slower
  );

  const result = judgeRoutes({
    origin,
    routes: [through, around],
    field: BURNING_SQUARE,
    tuning: STANDARD,
  });

  it('rejects the route that crosses the perimeter', () => {
    const scored = result.scored.find((s) => s.route.id === 'through-the-fire')!;
    expect(scored.rating).toBe('REJECTED');
    expect(scored.peakDanger).toBe(1);
  });

  it('accepts the slower route that goes around', () => {
    const scored = result.scored.find((s) => s.route.id === 'around-the-south')!;
    expect(scored.rating).not.toBe('REJECTED');
  });

  it('recommends the slower safe route over the faster lethal one', () => {
    expect(result.recommended?.route.id).toBe('around-the-south');
  });

  it('identifies the fastest route as the naive pick and flags that we refused it', () => {
    // THE BETRAYAL, in one assertion.
    expect(result.naive?.route.id).toBe('through-the-fire');
    expect(result.naiveWasRejected).toBe(true);
  });

  it('records where the route first meets danger', () => {
    const scored = result.scored.find((s) => s.route.id === 'through-the-fire')!;
    expect(scored.firstContact).not.toBeNull();
    expect(scored.firstContact!.minutesIntoTrip).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM 2: TIME-EVOLVING ROUTING — the thing nobody else does
// ═══════════════════════════════════════════════════════════════════════════

describe('judgeRoutes — routes by where the hazard is GOING', () => {
  const origin: LatLng = { lat: 34.07, lng: -118.62 };

  /** Clear right now. The hazard arrives in 20 minutes. */
  const clearNowBurningLater: DangerField = {
    ...BURNING_SQUARE,
    zones: [
      {
        id: 'in-20-min',
        polygon: [
          { lat: 34.06, lng: -118.58 },
          { lat: 34.08, lng: -118.58 },
          { lat: 34.08, lng: -118.56 },
          { lat: 34.06, lng: -118.56 },
        ],
        severity: 0.9,
        arrivesInMinutes: 20,
        label: 'Projected spread — 20 min',
      },
    ],
  };

  it('reports zero danger there right now — a snapshot router would send you', () => {
    expect(dangerAt(clearNowBurningLater, { lat: 34.07, lng: -118.57 }, 0)).toBe(0);
    expect(dangerArrivalAt(clearNowBurningLater, { lat: 34.07, lng: -118.57 }, 0.15)).toBe(20);
  });

  it('rejects a slow route that arrives after the hazard does', () => {
    // 45 minutes to cover ground the fire reaches at minute 20.
    const slow = route(
      'slow-through-projection',
      [{ lat: 34.07, lng: -118.62 }, { lat: 34.07, lng: -118.57 }, { lat: 34.07, lng: -118.5 }],
      45,
    );
    const result = judgeRoutes({
      origin,
      routes: [slow],
      field: clearNowBurningLater,
      tuning: STANDARD,
    });
    const scored = result.scored[0]!;

    expect(scored.rating).toBe('REJECTED');
    expect(scored.minutesUntilCutoff).toBeLessThan(0);
  });

  it('accepts the same road when you can beat the hazard to it', () => {
    // Same geometry, 6 minutes instead of 45. You are through before it arrives.
    const fast = route(
      'fast-through-projection',
      [{ lat: 34.07, lng: -118.62 }, { lat: 34.07, lng: -118.57 }, { lat: 34.07, lng: -118.5 }],
      6,
    );
    const result = judgeRoutes({
      origin,
      routes: [fast],
      field: clearNowBurningLater,
      tuning: STANDARD,
    });
    const scored = result.scored[0]!;

    expect(scored.rating).not.toBe('REJECTED');
    expect(scored.minutesUntilCutoff).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CLAIM 3: PERSONALIZATION — same fire, different verdict
// ═══════════════════════════════════════════════════════════════════════════

describe('judgeRoutes — same hazard, different person', () => {
  const origin: LatLng = { lat: 34.07, lng: -118.62 };
  const field: DangerField = {
    ...BURNING_SQUARE,
    zones: [
      {
        id: 'in-35-min',
        polygon: [
          { lat: 34.06, lng: -118.58 },
          { lat: 34.08, lng: -118.58 },
          { lat: 34.08, lng: -118.56 },
          { lat: 34.06, lng: -118.56 },
        ],
        severity: 0.9,
        arrivesInMinutes: 35,
        label: 'Projected spread — 35 min',
      },
    ],
  };
  const escape = route(
    'escape',
    [{ lat: 34.07, lng: -118.62 }, { lat: 34.07, lng: -118.57 }, { lat: 34.07, lng: -118.5 }],
    14,
  );

  const forStandard = judgeRoutes({ origin, routes: [escape], field, tuning: STANDARD }).scored[0]!;
  const forVulnerable = judgeRoutes({ origin, routes: [escape], field, tuning: VULNERABLE }).scored[0]!;

  it('gives the slower-moving person materially less slack on the same road', () => {
    expect(forVulnerable.minutesUntilCutoff!).toBeLessThan(forStandard.minutesUntilCutoff!);
  });

  it('leaves the standard profile with a workable margin', () => {
    expect(forStandard.marginMinutes!).toBeGreaterThan(0);
    expect(forStandard.rating).not.toBe('REJECTED');
  });

  it('downgrades the same route for the vulnerable profile', () => {
    // Longer prep, slower pace and a wider safety buffer eat the entire margin.
    expect(forVulnerable.marginMinutes!).toBeLessThan(forStandard.marginMinutes!);
    expect(forVulnerable.rating).not.toBe('SAFE');
  });

  it('makes a person on foot strictly worse off than one with a car', () => {
    const onFoot = tuningFor({ mobility: 'standard', hasCar: false });
    const driving = tuningFor({ mobility: 'standard', hasCar: true });
    expect(onFoot.paceMultiplier).toBeGreaterThan(driving.paceMultiplier * 5);
    expect(onFoot.safetyMarginMinutes).toBeGreaterThan(driving.safetyMarginMinutes);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE PROJECTION HEURISTIC
// ═══════════════════════════════════════════════════════════════════════════

describe('projectDangerField', () => {
  const field = projectDangerField(PALISADES_HAZARD, PALISADES_GROUND);

  it('produces rings ordered by arrival time', () => {
    for (let i = 1; i < field.zones.length; i++) {
      expect(field.zones[i]!.arrivesInMinutes).toBeGreaterThanOrEqual(
        field.zones[i - 1]!.arrivesInMinutes,
      );
    }
  });

  it('spreads in the direction the wind is blowing toward, not from', () => {
    // Getting this backwards inverts the whole product.
    expect(field.spreadBearingDeg).toBe(PALISADES_HAZARD.wind.toDeg);
    expect(field.spreadBearingDeg).not.toBe(PALISADES_HAZARD.wind.fromDeg);
  });

  it('scales the spread rate with wind speed', () => {
    const calm = rateOfSpreadKph({ ...PALISADES_HAZARD, wind: { ...PALISADES_HAZARD.wind, speedKph: 5 } }, null);
    const gale = rateOfSpreadKph({ ...PALISADES_HAZARD, wind: { ...PALISADES_HAZARD.wind, speedKph: 90 } }, null);
    expect(gale).toBeGreaterThan(calm * 3);
  });

  it('never projects an absurd rate of spread', () => {
    const hurricane = rateOfSpreadKph(
      { ...PALISADES_HAZARD, wind: { ...PALISADES_HAZARD.wind, speedKph: 400 } },
      PALISADES_GROUND,
    );
    expect(hurricane).toBeLessThanOrEqual(12);
  });

  it('states its own limitations', () => {
    expect(field.disclaimer).toMatch(/not a validated fire-behaviour model/i);
  });
});

describe('spreadAlignment', () => {
  const field = { ...BURNING_SQUARE, spreadBearingDeg: 220 };

  it('is 1 when driving the way the hazard is moving', () => {
    expect(spreadAlignment(220, field)).toBeCloseTo(1, 3);
  });

  it('is 0 when crossing its path or heading away from it', () => {
    expect(spreadAlignment(130, field)).toBeCloseTo(0, 2); // perpendicular
    expect(spreadAlignment(40, field)).toBe(0); // straight back upwind
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// THE DEMO ITSELF — this is the assertion that protects the pitch.
// ═══════════════════════════════════════════════════════════════════════════

describe('Palisades demo scenario', () => {
  const field = projectDangerField(PALISADES_HAZARD, PALISADES_GROUND);

  const standard = judgeRoutes({
    origin: PALISADES_ORIGIN,
    routes: PALISADES_ROUTES,
    field,
    tuning: tuningFor({ mobility: 'standard', hasCar: true }),
  });

  const vulnerable = judgeRoutes({
    origin: PALISADES_ORIGIN,
    routes: PALISADES_ROUTES,
    field,
    tuning: tuningFor({ mobility: 'vulnerable', hasCar: true }),
  });

  it('scores every canned route', () => {
    expect(standard.scored).toHaveLength(PALISADES_ROUTES.length);
  });

  it('picks the I-405 run as the route a traffic app would choose', () => {
    expect(standard.naive?.route.id).toBe('pal-route-405');
  });

  // ── THE DEMO'S CENTRAL CLAIM. If this ever goes red, the pitch is a lie. ──
  it('REFUSES the fastest route for both profiles — this is the betrayal', () => {
    expect(standard.naive?.rating).toBe('REJECTED');
    expect(standard.naiveWasRejected).toBe(true);
    expect(vulnerable.naiveWasRejected).toBe(true);
  });

  it('recommends the route that crosses the fire’s path, not the one along it', () => {
    // Topanga (SW) is marginally faster and equally clear inside the horizon,
    // but it runs along the spread bearing. Santa Monica (SE) crosses it.
    expect(standard.recommended?.route.id).toBe('pal-route-pch-south');
    expect(standard.recommended?.direction).toBe('SE');
  });

  it('produces the two demo verdicts: SOON for a healthy adult, NOW for a slower one', () => {
    const forStandard = computeFacts({
      hazard: PALISADES_HAZARD,
      ground: PALISADES_GROUND,
      judgement: standard,
      profile: { mobility: 'standard', hasCar: true },
      tuning: tuningFor({ mobility: 'standard', hasCar: true }),
      address: 'demo',
    });
    const forVulnerable = computeFacts({
      hazard: PALISADES_HAZARD,
      ground: PALISADES_GROUND,
      judgement: vulnerable,
      profile: { mobility: 'vulnerable', hasCar: true },
      tuning: tuningFor({ mobility: 'vulnerable', hasCar: true }),
      address: 'demo',
    });

    expect(forStandard.decision).toBe('EVACUATE_SOON');
    expect(forVulnerable.decision).toBe('EVACUATE_NOW');
    // Same fire, same roads, materially less time.
    expect(forVulnerable.minutesUntilCutoff!).toBeLessThan(forStandard.minutesUntilCutoff!);
  });

  it('still offers a survivable route to a healthy adult', () => {
    expect(standard.recommended).not.toBeNull();
    expect(standard.allRoutesDangerous).toBe(false);
  });

  it('leaves the vulnerable profile with less slack than the standard one', () => {
    const a = standard.recommended?.minutesUntilCutoff;
    const b = vulnerable.recommended?.minutesUntilCutoff;
    if (a !== null && a !== undefined && b !== null && b !== undefined) {
      expect(b).toBeLessThan(a);
    }
  });

  it('produces a human-readable reason for every route', () => {
    for (const scored of standard.scored) {
      expect(scored.reasons.length).toBeGreaterThan(0);
      expect(scored.reasons.every((r) => r.length > 10)).toBe(true);
    }
  });
});
