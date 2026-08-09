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
  Provenance,
  Route,
  Sourced,
} from '@ember/shared';
import { cached } from '../core/cache';
import {
  compassFromBearing,
  decodePolyline,
  destination as pointAtBearing,
  haversineKm,
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
      // Same rule as geocode, hazards and ground: a pinned scenario is fully
      // canned. Live routes against a canned fire replace the hand-tuned
      // geometry the demo depends on — the rejected-fastest-route moment is a
      // property of THOSE roads against THAT projection, and swapping in
      // today's traffic quietly deletes it.
      enabled: Boolean(env.googleMapsKey) && !offline && !query.scenarioId,
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

        if (routes.length === 0) {
          // Surface WHY every leg failed. "no usable routes" on its own sends
          // you hunting through code when the real answer is one HTTP message.
          const reasons = results
            .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
            .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));
          const unique = [...new Set(reasons)];
          throw new Error(
            `Google returned no usable routes — ${unique.join(' | ') || 'all destinations empty'}`,
          );
        }
        return dedupe(routes);
      },
    },

    {
      // Canned routes are only meaningful for the scenario they were drawn for.
      // Serving Palisades geometry for a live fire 80 km away would draw roads
      // that do not touch the user's actual address — a coherent-looking map
      // that is quietly lying. Only use them when the hazard really is that
      // scenario, or the caller explicitly pinned one.
      name: 'Canned scenario routes',
      source: 'canned',
      enabled: Boolean(scenarioForHazard(query.field.hazardId) ?? query.scenarioId),
      note: 'Route geometry from the matching demo scenario.',
      run: async () => {
        const scenario =
          scenarioForHazard(query.field.hazardId) ?? getScenario(query.scenarioId);
        return scenario.routes;
      },
    },

    // ── LAST RESORT. MUST NOT FAIL. ─────────────────────────────────────────
    {
      // No routing provider and no matching scenario. Draw straight-line escape
      // corridors from the REAL origin so the geometry is at least self-
      // consistent with the address and the fire we actually loaded.
      //
      // These are NOT roads. Marked `mock` so the UI badge says so out loud.
      name: 'Straight-line corridors (no routing provider)',
      source: 'mock',
      note: 'Direct bearings from the address — NOT real roads. Distances and times are estimates.',
      run: async () => straightLineCorridors(query.origin, query.field),
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
      steps?: {
        polyline?: { points: string };
        duration?: { value: number };
        /** e.g. `Turn <b>right</b> onto <b>Sunset Blvd</b>` */
        html_instructions?: string;
      }[];
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
          // Road name per step, so a field report naming a road resolves to
          // specific segments instead of the whole trip.
          roadName: roadNameFromInstruction(step.html_instructions),
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
 * Pull the road name out of a Google step instruction.
 *
 * Instructions look like `Turn <b>right</b> onto <b>Sunset Blvd</b>` or
 * `Merge onto <b>I-405 N</b>`. The road is the LAST bolded fragment that is not
 * a turn direction — the first bold is usually "right"/"left".
 */
export function roadNameFromInstruction(html?: string): string | undefined {
  if (!html) return undefined;
  const bolds = [...html.matchAll(/<b>(.*?)<\/b>/g)]
    .map((m) => m[1]!.replace(/<[^>]+>/g, '').trim())
    .filter((s) => s.length > 0 && !/^(right|left|north|south|east|west|slight|sharp|straight)$/i.test(s));
  return bolds[bolds.length - 1];
}

/**
 * Escape corridors as straight bearings from the origin — the floor of the
 * routing chain, used when there is no routing provider AND no canned scenario
 * that matches this hazard.
 *
 * The judge still does real work on these: it samples each corridor against the
 * real danger field, over real time, and will still reject the one that runs
 * into the fire. What you lose is road-following, so distances are optimistic
 * (a straight line is always shorter than the road) and the "fastest" route is
 * whichever bearing is shortest rather than whatever traffic says.
 *
 * Marked `source: 'mock'` so the UI shows NO DATA rather than implying these
 * are drivable roads.
 */
function straightLineCorridors(origin: LatLng, field: DangerField): Route[] {
  const provenance: Provenance = {
    source: 'mock',
    provider: 'straight-line corridors',
    fetchedAt: new Date().toISOString(),
    note: 'Direct bearings, not roads. No routing provider was available.',
  };

  return pickDestinations(origin, field).map((dest, i) => {
    const distanceKm = haversineKm(origin, dest.location);
    // Deliberately pessimistic: evacuation traffic, not open highway.
    const durationMinutes = (distanceKm / EVAC_SPEED_KPH) * 60;
    // A few intermediate points so the judge samples along the corridor rather
    // than only at the endpoints.
    const path: LatLng[] = [];
    const steps = 12;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      path.push({
        lat: origin.lat + (dest.location.lat - origin.lat) * t,
        lng: origin.lng + (dest.location.lng - origin.lng) * t,
      });
    }

    return buildRoute({
      id: `corridor-${i}-${dest.id}`,
      summary: `Direct corridor ${dest.name}`,
      legs: [{ path, durationMinutes }],
      destination: dest,
      provenance,
    });
  });
}

/** Assumed average speed on a congested evacuation route, km/h. */
const EVAC_SPEED_KPH = 30;

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
