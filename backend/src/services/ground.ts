/**
 * EMBER — physical ground truth. CONTEXT.md §5 step 3.
 * OWNER: DATA
 *
 * Mireye Earth (https://api.mireye.com) supplies federally-sourced terrain with
 * per-field provenance. Two things depend on it:
 *
 *   • `project.ts` uses slope + aspect to speed the fire up when it runs uphill.
 *   • `exitCount` is the single most damning number we can show a user.
 *
 * Fields we use, and where Mireye gets them:
 *   elevation                      USGS 3DEP seamless DEM
 *   slope_degrees                  computed from USGS 3DEP
 *   aspect_degrees                 compass bearing the slope FACES (downhill)
 *   nearest_major_road_name/_m     Overture transportation
 *   wildfire_annual_frequency      FEMA National Risk Index
 *
 * `aspect_degrees` is the downhill direction, which is exactly what
 * `GroundContext.aspectDeg` means — no conversion needed. `slope_degrees` is an
 * angle and our type wants percent, so we convert.
 *
 * Strategy chain: Mireye → canned scenario terrain → flat-earth neutral default.
 * Ground data is an ENHANCEMENT, never a blocker — the pipeline runs without it.
 */

import { CACHE_TTL_MS, TIMEOUTS_MS } from '@ember/shared';
import type { GroundContext, LatLng, Sourced } from '@ember/shared';
import { cached } from '../core/cache';
import { resolve, type Strategy } from '../core/resilient';
import type { TraceRecorder } from '../core/trace';
import { env, isOffline } from '../env';
import { findScenarioNear, getScenario } from '../fixtures';

/** One field in a Mireye `/v1/fetch` response. Every value carries its source. */
interface MireyeField {
  value: unknown;
  unit: string | null;
  source: string;
  source_url: string;
  confidence: 'high' | 'medium' | 'low' | string;
  fetched_at: string;
  dataset_vintage?: string | null;
  notes?: string | null;
  status: string;
}

interface MireyeFetchResponse {
  lat: number;
  lng: number;
  fetched_at: string;
  fields: Record<string, MireyeField | undefined>;
  partial_failures?: unknown[];
}

const TERRAIN_FIELDS = [
  'elevation',
  'slope_degrees',
  'aspect_degrees',
  'nearest_major_road_name',
  'nearest_major_road_distance_m',
  'wildfire_annual_frequency',
] as const;

export async function fetchGround(
  location: LatLng,
  trace: TraceRecorder,
  opts: { forceOffline?: boolean; scenarioId?: string } = {},
): Promise<Sourced<GroundContext>> {
  const offline = isOffline(opts.forceOffline);
  const key = `ground:${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;

  const strategies: Strategy<GroundContext>[] = [
    {
      name: 'Mireye Earth /v1/fetch',
      source: 'live',
      // Same rule as geocode and hazards: a pinned scenario is fully canned, so
      // the demo is reproducible offline. Live terrain here would also wipe out
      // the scenario's `exitCount: 1` — Mireye reports the nearest road, not a
      // count of ways out, so the "one road out" finding would silently vanish.
      enabled: Boolean(env.mireyeKey) && !offline && !opts.scenarioId,
      timeoutMs: TIMEOUTS_MS.ground,
      url: `${env.mireyeBaseUrl}/v1/fetch`,
      run: async (signal) =>
        cached(key, CACHE_TTL_MS.ground, async () => {
          const res = await fetch(new URL('/v1/fetch', env.mireyeBaseUrl), {
            method: 'POST',
            signal,
            headers: {
              Authorization: `Bearer ${env.mireyeKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              lat: location.lat,
              lng: location.lng,
              fields: TERRAIN_FIELDS,
            }),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 160)}`);
          }
          return fromMireye(await res.json() as MireyeFetchResponse);
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

function fromMireye(body: MireyeFetchResponse): GroundContext {
  const num = (name: string): number | null => {
    const f = body.fields?.[name];
    if (!f || f.status !== 'ok') return null;
    const n = Number(f.value);
    return Number.isFinite(n) ? n : null;
  };
  const text = (name: string): string | null => {
    const f = body.fields?.[name];
    if (!f || f.status !== 'ok' || typeof f.value !== 'string') return null;
    return f.value;
  };

  const slopeDeg = num('slope_degrees');
  const roadName = text('nearest_major_road_name');
  const roadDistM = num('nearest_major_road_distance_m');
  const fireFreq = num('wildfire_annual_frequency');

  // Human-readable terrain line, assembled only from values we actually got.
  const parts: string[] = [];
  if (slopeDeg != null) parts.push(`${slopeDeg.toFixed(1)}° slope (USGS 3DEP)`);
  if (roadName) {
    parts.push(
      roadDistM != null
        ? `nearest major road ${roadName}, ${(roadDistM / 1000).toFixed(1)} km away`
        : `nearest major road ${roadName}`,
    );
  }
  if (fireFreq != null) {
    parts.push(`FEMA wildfire frequency ${fireFreq.toFixed(3)} events/yr for this tract`);
  }

  return {
    elevationM: num('elevation'),
    // Our type is percent grade; Mireye reports the angle. tan(θ)·100.
    slopePct: slopeDeg == null ? null : Math.tan((slopeDeg * Math.PI) / 180) * 100,
    // Mireye's aspect is the bearing the slope FACES — i.e. downhill. That is
    // exactly what GroundContext.aspectDeg means, so no conversion.
    aspectDeg: num('aspect_degrees'),
    terrain: parts.length > 0 ? parts.join('; ') : null,
    // Mireye gives the NEAREST major road, not a count of ways out of the
    // neighbourhood. Reporting `1` here would be a lie that happens to look
    // like our best demo stat. We do not know, so we say we do not know.
    exitCount: null,
    exits: [],
    provenance: {
      source: 'live',
      provider: 'Mireye Earth (USGS 3DEP, Overture, FEMA NRI)',
      fetchedAt: body.fetched_at ?? new Date().toISOString(),
      url: 'https://api.mireye.com/v1/fetch',
      note: fieldProvenanceNote(body),
    },
  };
}

/** Summarise which upstream federal sources actually answered. */
function fieldProvenanceNote(body: MireyeFetchResponse): string {
  const ok: string[] = [];
  const failed: string[] = [];
  for (const name of TERRAIN_FIELDS) {
    const f = body.fields?.[name];
    if (f?.status === 'ok') ok.push(`${name}←${f.source}`);
    else failed.push(name);
  }
  const head = `${ok.length}/${TERRAIN_FIELDS.length} fields resolved`;
  return failed.length > 0 ? `${head}; unavailable: ${failed.join(', ')}` : head;
}
