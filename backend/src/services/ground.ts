/**
 * EMBER — physical ground truth. CONTEXT.md §5 step 3.
 * OWNER: DATA
 *
 * Mireye supplies terrain (elevation, slope, aspect) and the roads that actually
 * lead out of a location. Two things depend on it:
 *
 *   • `project.ts` uses slope + aspect to speed the fire up when it runs uphill.
 *   • `exitCount` is the single most damning number we can show a user.
 *     Palisades Highlands: 1. Paradise: 3, for 26,000 people.
 *
 * Strategy chain: Mireye → canned scenario terrain → flat-earth neutral default.
 * Ground data is an ENHANCEMENT, never a blocker — the pipeline runs without it.
 */

import { CACHE_TTL_MS, TIMEOUTS_MS } from '@ember/shared';
import type { GroundContext, LatLng, Sourced } from '@ember/shared';
import { cached } from '../core/cache';
import { compassFromBearing } from '../core/geo';
import { fetchJson, resolve, type Strategy } from '../core/resilient';
import type { TraceRecorder } from '../core/trace';
import { env, isOffline } from '../env';
import { findScenarioNear, getScenario } from '../fixtures';

/**
 * Shape we expect back from Mireye.
 *
 * OWNER: DATA — verify these field names against the Mireye docs at the venue
 * and adjust the mapping in `fromMireye()`. Everything else stays put.
 */
interface MireyeTerrainResponse {
  elevation_m?: number;
  slope_percent?: number;
  aspect_degrees?: number;
  land_cover?: string;
  roads?: { name?: string; bearing_deg?: number; classification?: string }[];
}

export async function fetchGround(
  location: LatLng,
  trace: TraceRecorder,
  opts: { forceOffline?: boolean; scenarioId?: string } = {},
): Promise<Sourced<GroundContext>> {
  const offline = isOffline(opts.forceOffline);
  const key = `ground:${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;

  const strategies: Strategy<GroundContext>[] = [
    {
      name: 'Mireye terrain',
      source: 'live',
      enabled: Boolean(env.mireyeKey) && !offline,
      timeoutMs: TIMEOUTS_MS.ground,
      url: `${env.mireyeBaseUrl}/v1/terrain`,
      run: async (signal) =>
        cached(key, CACHE_TTL_MS.ground, async () => {
          const url = new URL('/v1/terrain', env.mireyeBaseUrl);
          url.searchParams.set('lat', String(location.lat));
          url.searchParams.set('lng', String(location.lng));
          url.searchParams.set('include', 'roads');

          const body = await fetchJson<MireyeTerrainResponse>(url.toString(), signal, {
            headers: { Authorization: `Bearer ${env.mireyeKey}` },
          });
          return fromMireye(body);
        }),
    },

    {
      name: 'Canned scenario terrain',
      source: 'canned',
      note: 'Terrain and exit count from the matching demo scenario.',
      run: async () => {
        const scenario = opts.scenarioId
          ? getScenario(opts.scenarioId)
          : (findScenarioNear(location) ?? getScenario());
        return scenario.ground;
      },
    },

    // ── ABSOLUTE FLOOR. Cannot throw. Neutral values only. ───────────────────
    {
      name: 'Neutral terrain',
      source: 'mock',
      note: 'No terrain data available — slope treated as flat, no exit information.',
      run: async () => NEUTRAL_GROUND,
    },
  ];

  return resolve('ground', strategies, trace, TIMEOUTS_MS.ground);
}

/**
 * Deliberately null, not zero. `null` means "we do not know" and makes
 * `project.ts` skip the slope term entirely; `0` would be a claim that the
 * ground is flat, which we have not earned.
 */
export const NEUTRAL_GROUND: GroundContext = {
  elevationM: null,
  slopePct: null,
  aspectDeg: null,
  terrain: null,
  exitCount: null,
  exits: [],
  provenance: {
    source: 'mock',
    provider: 'neutral-default',
    fetchedAt: new Date(0).toISOString(),
    note: 'No terrain provider configured. Slope acceleration disabled.',
  },
};

function fromMireye(body: MireyeTerrainResponse): GroundContext {
  const roads = body.roads ?? [];
  return {
    elevationM: body.elevation_m ?? null,
    slopePct: body.slope_percent ?? null,
    aspectDeg: body.aspect_degrees ?? null,
    terrain: body.land_cover ?? null,
    exitCount: roads.length > 0 ? roads.length : null,
    exits: roads.map((r) => {
      const bearing = r.bearing_deg ?? 0;
      return {
        name: r.name ?? 'Unnamed road',
        bearingDeg: bearing,
        direction: compassFromBearing(bearing),
        kind: normalizeRoadKind(r.classification),
      };
    }),
    provenance: {
      source: 'live',
      provider: 'Mireye terrain',
      fetchedAt: new Date().toISOString(),
    },
  };
}

function normalizeRoadKind(raw?: string): 'highway' | 'arterial' | 'residential' | 'unknown' {
  const v = (raw ?? '').toLowerCase();
  if (v.includes('motorway') || v.includes('highway') || v.includes('trunk')) return 'highway';
  if (v.includes('primary') || v.includes('secondary') || v.includes('arterial')) return 'arterial';
  if (v.includes('residential') || v.includes('street')) return 'residential';
  return 'unknown';
}
