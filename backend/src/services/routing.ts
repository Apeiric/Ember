/**
 * EMBER — candidate route generation. CONTEXT.md §5 step 5.
 * OWNER: DATA (adapter) / JUDGE (destination selection)
 *
 * This service is deliberately DUMB about safety. It asks Google for every way
 * out it can think of and hands them all to the judge. Google optimises for
 * traffic; that is the point. If we filtered dangerous routes here, we would
 * have nothing to reject on stage — and no honest way to show that the fastest
 * route is the one that kills you.
 *
 * Strategy chain: Google Directions (alternatives=true) → canned scenario routes.
 */

import {
  DESTINATION_SEARCH_KM,
  TIMEOUTS_MS,
  CACHE_TTL_MS,
} from '@ember/shared';
import type {
  DangerField,
  Destination,
  LatLng,
  Route,
  Sourced,
} from '@ember/shared';
import { cached } from '../core/cache';
import {
  compassFromBearing,
  decodePolyline,
  destination as pointAtBearing,
  normalizeBearing,
} from '../core/geo';
import { buildRoute } from '../core/routes';
import { fetchJson, resolve, settleAll, type Strategy } from '../core/resilient';
import type { TraceRecorder } from '../core/trace';
import { env, isOffline } from '../env';
import { getScenario, scenarioForHazard } from '../fixtures';
import { COMPASS_LABELS } from '@ember/shared';

export interface RoutingQuery {
  origin: LatLng;
  field: DangerField;
  forceOffline?: boolean;
  scenarioId?: string;
}

export async function fetchRoutes(
  query: RoutingQuery,
  trace: TraceRecorder,
): Promise<Sourced<Route[]>> {
  const offline = isOffline(query.forceOffline);

  const strategies: Strategy<Route[]>[] = [
    {
      name: 'Google Directions (alternatives)',
      source: 'live',
      enabled: Boolean(env.googleMapsKey) && !offline,
      timeoutMs: TIMEOUTS_MS.directions,
      note: 'Traffic-optimised routes, unfiltered — the judge does the rejecting.',
      run: async (signal) => {
        const destinations = pickDestinations(query.origin, query.field);

        // Fan out across candidate destinations; a single failing leg must not
        // cost us the other three.
        const results = await Promise.allSettled(
          destinations.map((dest) => fetchDirections(query.origin, dest, signal)),
        );

        const routes = results
          .filter((r): r is PromiseFulfilledResult<Route[]> => r.status === 'fulfilled')
          .flatMap((r) => r.value);

        if (routes.length === 0) throw new Error('Google returned no usable routes');
        return dedupe(routes);
      },
    },

    // ── LAST RESORT. MUST NOT FAIL. ─────────────────────────────────────────
    {
      name: 'Canned scenario routes',
      source: 'canned',
      note: 'Route geometry from the matching demo scenario.',
      run: async () => {
        const scenario =
          scenarioForHazard(query.field.hazardId) ?? getScenario(query.scenarioId);
        return scenario.routes;
      },
    },
  ];

  return resolve('routing', strategies, trace, TIMEOUTS_MS.directions);
}

// ═══════════════════════════════════════════════════════════════════════════
// DESTINATION SELECTION
//
// You cannot ask a routing API for "somewhere safe" — it has no idea there is a
// fire. So we choose the compass directions worth trying and let it route to
// each. We bias AWAY from the hazard's spread bearing, but we deliberately keep
// one candidate pointing into the danger arc: that is usually where the nearest
// freeway is, it is what a traffic-optimised app would pick, and we want the
// judge to see it and reject it rather than never being offered it.
// ═══════════════════════════════════════════════════════════════════════════

export function pickDestinations(origin: LatLng, field: DangerField): Destination[] {
  const away = normalizeBearing(field.spreadBearingDeg + 180);
  const bearings = [away, normalizeBearing(away + 70), normalizeBearing(away - 70), field.spreadBearingDeg];

  return bearings.map((bearing, i) => {
    const location = pointAtBearing(origin, bearing, DESTINATION_SEARCH_KM);
    const dir = compassFromBearing(bearing);
    return {
      id: `auto-${i}-${dir}`,
      name: `${DESTINATION_SEARCH_KM} km ${COMPASS_LABELS[dir].toLowerCase()}`,
      location,
      kind: 'safe-zone' as const,
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE DIRECTIONS ADAPTER
// OWNER: DATA
// ═══════════════════════════════════════════════════════════════════════════

interface GoogleDirectionsResponse {
  status: string;
  error_message?: string;
  routes: {
    summary?: string;
    overview_polyline?: { points: string };
    legs: {
      distance?: { value: number };
      duration?: { value: number };
      duration_in_traffic?: { value: number };
      steps?: { polyline?: { points: string }; duration?: { value: number } }[];
    }[];
  }[];
}

async function fetchDirections(
  origin: LatLng,
  dest: Destination,
  signal: AbortSignal,
): Promise<Route[]> {
  const key = `dir:${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}->${dest.id}`;

  return cached(key, CACHE_TTL_MS.directions, async () => {
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', `${origin.lat},${origin.lng}`);
    url.searchParams.set('destination', `${dest.location.lat},${dest.location.lng}`);
    // THE critical parameter — without it we get one route and no betrayal.
    url.searchParams.set('alternatives', 'true');
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('key', env.googleMapsKey!);

    const body = await fetchJson<GoogleDirectionsResponse>(url.toString(), signal);
    if (body.status !== 'OK') {
      throw new Error(`Directions status ${body.status}${body.error_message ? `: ${body.error_message}` : ''}`);
    }

    return body.routes.map((r, i) => {
      // Prefer step-level geometry: it preserves where the road actually bends,
      // which matters when we are asking whether it clips a fire perimeter.
      const legs = r.legs.flatMap((leg) => {
        const steps = leg.steps ?? [];
        if (steps.length === 0) {
          return [
            {
              path: decodePolyline(r.overview_polyline?.points ?? ''),
              durationMinutes: (leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0) / 60,
            },
          ];
        }
        return steps.map((step) => ({
          path: decodePolyline(step.polyline?.points ?? ''),
          durationMinutes: (step.duration?.value ?? 0) / 60,
        }));
      });

      return buildRoute({
        id: `g-${dest.id}-${i}`,
        summary: r.summary ? `${r.summary} → ${dest.name}` : `Route to ${dest.name}`,
        legs: legs.filter((l) => l.path.length >= 2),
        destination: dest,
        provenance: {
          source: 'live',
          provider: 'Google Directions',
          fetchedAt: new Date().toISOString(),
          note: 'alternatives=true, departure_time=now',
        },
      });
    });
  });
}

/**
 * Different destinations often return the same road for the first few km.
 * Collapse near-identical routes so the UI shows genuine alternatives rather
 * than four copies of the same highway.
 */
function dedupe(routes: Route[]): Route[] {
  const seen = new Map<string, Route>();
  for (const route of routes) {
    if (route.path.length < 2) continue;
    const mid = route.path[Math.floor(route.path.length / 2)]!;
    const end = route.path[route.path.length - 1]!;
    const key = `${mid.lat.toFixed(2)},${mid.lng.toFixed(2)}|${end.lat.toFixed(2)},${end.lng.toFixed(2)}`;
    const existing = seen.get(key);
    if (!existing || route.durationMinutes < existing.durationMinutes) seen.set(key, route);
  }
  return [...seen.values()];
}
