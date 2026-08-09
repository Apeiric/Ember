/**
 * EMBER — threat feeds. CONTEXT.md §5 step 2.
 * OWNER: DATA
 *
 * Three independent feeds, fetched concurrently, assembled into one `Hazard`:
 *
 *   perimeter  NIFC Wildfire Perimeters (ArcGIS)  — no key
 *   hotspots   NASA FIRMS                          — key
 *   wind       NWS / weather.gov                   — no key, needs User-Agent
 *
 * CONTEXT.md §7: "Wrap feeds in Promise.allSettled: one dead API ≠ blackout."
 * Each feed degrades independently — a live perimeter with canned wind is a
 * perfectly good answer, and the provenance on the Hazard says exactly that.
 */

import { CACHE_TTL_MS, TIMEOUTS_MS } from '@ember/shared';
import type { Hazard, Hotspot, LatLng, Polygon, Provenance, Sourced, Wind } from '@ember/shared';
import { cached } from '../core/cache';
import { fromGeoJsonRing, haversineKm, normalizeBearing } from '../core/geo';
import { fetchJson, resolve, settleAll, type Strategy } from '../core/resilient';
import type { TraceRecorder } from '../core/trace';
import { env, isOffline } from '../env';
import { findScenarioNear, getScenario } from '../fixtures';

export interface HazardQuery {
  location: LatLng;
  /** How far out to look for an active incident. */
  radiusKm?: number;
  forceOffline?: boolean;
  scenarioId?: string;
}

export async function fetchHazard(
  query: HazardQuery,
  trace: TraceRecorder,
): Promise<Sourced<Hazard>> {
  const offline = isOffline(query.forceOffline);
  const radiusKm = query.radiusKm ?? 60;

  const strategies: Strategy<Hazard>[] = [
    {
      name: 'NIFC + FIRMS + NWS',
      source: 'live',
      enabled: !offline && !query.scenarioId,
      timeoutMs: TIMEOUTS_MS.perimeter,
      note: 'Live perimeter, hotspots and wind, assembled independently.',
      run: async (signal) => {
        // One dead feed must not black out the other two.
        const feeds = await settleAll({
          perimeter: fetchNifcPerimeter(query.location, radiusKm, signal),
          hotspots: fetchFirmsHotspots(query.location, radiusKm, signal),
          wind: fetchNwsWind(query.location, signal),
        });

        // A perimeter is the one thing we genuinely cannot synthesise. Without
        // it there is no hazard to route around — fall through to canned.
        if (!feeds.perimeter || feeds.perimeter.polygons.length === 0) {
          throw new Error('no active perimeter found near this location');
        }

        const fallbackWind = nearestScenario(query).hazard.wind;
        return {
          id: feeds.perimeter.id,
          kind: 'wildfire',
          name: feeds.perimeter.name,
          perimeter: feeds.perimeter.polygons,
          hotspots: feeds.hotspots ?? [],
          wind: feeds.wind ?? fallbackWind,
          discoveredAt: feeds.perimeter.discoveredAt,
          acres: feeds.perimeter.acres,
          containmentPct: feeds.perimeter.containmentPct,
          provenance: {
            perimeter: live('NIFC Wildfire Perimeters'),
            hotspots: feeds.hotspots
              ? live('NASA FIRMS')
              : degraded('NASA FIRMS unavailable — no hotspot overlay.'),
            wind: feeds.wind
              ? live('NWS weather.gov')
              : degraded('NWS unavailable — using the scenario wind vector.'),
          },
        } satisfies Hazard;
      },
    },

    // ── LAST RESORT. MUST NOT FAIL. CONTEXT.md §7. ──────────────────────────
    {
      name: 'Canned scenario',
      source: 'canned',
      note: 'Reconstructed real fire — complete, self-consistent, zero network.',
      run: async () => nearestScenario(query).hazard,
    },
  ];

  return resolve('hazard', strategies, trace, TIMEOUTS_MS.perimeter);
}

function nearestScenario(query: HazardQuery) {
  if (query.scenarioId) return getScenario(query.scenarioId);
  return findScenarioNear(query.location) ?? getScenario();
}

const live = (provider: string): Provenance => ({
  source: 'live',
  provider,
  fetchedAt: new Date().toISOString(),
});

const degraded = (note: string): Provenance => ({
  source: 'canned',
  provider: 'canned:scenario',
  fetchedAt: new Date().toISOString(),
  note,
});

// ═══════════════════════════════════════════════════════════════════════════
// NIFC PERIMETERS — ArcGIS FeatureServer, GeoJSON out, no key.
// OWNER: DATA
// ═══════════════════════════════════════════════════════════════════════════

const NIFC_URL =
  'https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/' +
  'WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query';

interface NifcFeature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: number[][][] | number[][][][] } | null;
}

interface PerimeterResult {
  id: string;
  name: string;
  polygons: Polygon[];
  discoveredAt: string;
  acres?: number;
  containmentPct?: number;
}

async function fetchNifcPerimeter(
  location: LatLng,
  radiusKm: number,
  signal: AbortSignal,
): Promise<PerimeterResult | null> {
  return cached(
    `nifc:${location.lat.toFixed(2)},${location.lng.toFixed(2)}:${radiusKm}`,
    CACHE_TTL_MS.perimeter,
    async () => {
      const url = new URL(NIFC_URL);
      url.searchParams.set('f', 'geojson');
      url.searchParams.set('outFields', '*');
      url.searchParams.set('geometryType', 'esriGeometryPoint');
      url.searchParams.set('geometry', `${location.lng},${location.lat}`);
      url.searchParams.set('inSR', '4326');
      url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
      url.searchParams.set('distance', String(radiusKm * 1000));
      url.searchParams.set('units', 'esriSRUnit_Meter');
      url.searchParams.set('resultRecordCount', '10');

      const body = await fetchJson<{ features?: NifcFeature[] }>(url.toString(), signal);
      const features = body.features ?? [];
      if (features.length === 0) return null;

      // Nearest incident wins — someone in LA should not be routed around a fire
      // in Oregon just because it is bigger.
      let best: { feature: NifcFeature; polygons: Polygon[]; km: number } | null = null;
      for (const feature of features) {
        const polygons = geoJsonToPolygons(feature.geometry);
        if (polygons.length === 0) continue;
        const km = Math.min(
          ...polygons.map((poly) =>
            Math.min(...poly.map((p) => haversineKm(location, p))),
          ),
        );
        if (!best || km < best.km) best = { feature, polygons, km };
      }
      if (!best) return null;

      const p = best.feature.properties;
      return {
        id: String(p.poly_GlobalID ?? p.attr_UniqueFireIdentifier ?? `nifc-${Date.now()}`),
        name: String(p.attr_IncidentName ?? p.poly_IncidentName ?? 'Active wildfire'),
        polygons: best.polygons,
        discoveredAt: toIso(p.attr_FireDiscoveryDateTime) ?? new Date().toISOString(),
        acres: numberOrUndefined(p.attr_IncidentSize ?? p.poly_GISAcres),
        containmentPct: numberOrUndefined(p.attr_PercentContained),
      };
    },
  );
}

function geoJsonToPolygons(geometry: NifcFeature['geometry']): Polygon[] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
    // Outer ring only; holes inside a fire perimeter are not survivable ground.
    const rings = geometry.coordinates as number[][][];
    return rings.length > 0 ? [fromGeoJsonRing(rings[0]!)] : [];
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][])
      .map((poly) => (poly.length > 0 ? fromGeoJsonRing(poly[0]!) : []))
      .filter((p) => p.length >= 3);
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// NASA FIRMS — satellite thermal detections. CSV over HTTP, needs a key.
// OWNER: DATA
// ═══════════════════════════════════════════════════════════════════════════

async function fetchFirmsHotspots(
  location: LatLng,
  radiusKm: number,
  signal: AbortSignal,
): Promise<Hotspot[] | null> {
  if (!env.firmsKey) return null;

  return cached(
    `firms:${location.lat.toFixed(2)},${location.lng.toFixed(2)}`,
    CACHE_TTL_MS.hotspots,
    async () => {
      const deg = radiusKm / 111;
      const area = [
        (location.lng - deg).toFixed(3),
        (location.lat - deg).toFixed(3),
        (location.lng + deg).toFixed(3),
        (location.lat + deg).toFixed(3),
      ].join(',');

      // FIRMS returns CSV, not JSON.
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${env.firmsKey}/VIIRS_SNPP_NRT/${area}/1`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
      return parseFirmsCsv(await res.text());
    },
  );
}

/** Exported for unit testing — CSV parsing is exactly the kind of thing that
 *  silently breaks when a column moves. */
export function parseFirmsCsv(csv: string): Hotspot[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const iLat = col('latitude');
  const iLng = col('longitude');
  const iConf = col('confidence');
  const iBright = col('bright_ti4');
  const iDate = col('acq_date');
  const iTime = col('acq_time');
  if (iLat < 0 || iLng < 0) return [];

  const out: Hotspot[] = [];
  for (const line of lines.slice(1)) {
    const cells = line.split(',');
    const lat = Number(cells[iLat]);
    const lng = Number(cells[iLng]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    out.push({
      location: { lat, lng },
      confidence: parseFirmsConfidence(cells[iConf]),
      brightnessK: iBright >= 0 ? Number(cells[iBright]) || undefined : undefined,
      detectedAt: parseFirmsTimestamp(cells[iDate], cells[iTime]),
    });
  }
  return out;
}

/** VIIRS reports n/l/h; MODIS reports 0–100. Handle both. */
function parseFirmsConfidence(raw?: string): number {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'h' || v === 'high') return 0.9;
  if (v === 'n' || v === 'nominal') return 0.65;
  if (v === 'l' || v === 'low') return 0.35;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n / 100)) : 0.5;
}

function parseFirmsTimestamp(date?: string, time?: string): string {
  if (!date) return new Date().toISOString();
  const hhmm = (time ?? '0000').padStart(4, '0');
  const parsed = new Date(`${date}T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00Z`);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

// ═══════════════════════════════════════════════════════════════════════════
// NWS WIND — weather.gov. Free, no key, but REQUIRES a User-Agent header
// (see `fetchJson` — it sets one; do not strip it or NWS hard-rejects).
// OWNER: DATA
// ═══════════════════════════════════════════════════════════════════════════

interface NwsPointsResponse {
  properties: { observationStations?: string; forecastGridData?: string };
}
interface NwsStationsResponse {
  features: { id: string; properties: { stationIdentifier: string } }[];
}
interface NwsObservationResponse {
  properties: {
    windSpeed?: { value: number | null };
    windGust?: { value: number | null };
    windDirection?: { value: number | null };
    timestamp?: string;
    station?: string;
  };
}

async function fetchNwsWind(location: LatLng, signal: AbortSignal): Promise<Wind | null> {
  return cached(
    `nws:${location.lat.toFixed(2)},${location.lng.toFixed(2)}`,
    CACHE_TTL_MS.wind,
    async () => {
      const points = await fetchJson<NwsPointsResponse>(
        `https://api.weather.gov/points/${location.lat.toFixed(4)},${location.lng.toFixed(4)}`,
        signal,
      );
      const stationsUrl = points.properties.observationStations;
      if (!stationsUrl) return null;

      const stations = await fetchJson<NwsStationsResponse>(stationsUrl, signal);
      const station = stations.features[0];
      if (!station) return null;

      const obs = await fetchJson<NwsObservationResponse>(
        `${station.id}/observations/latest`,
        signal,
      );
      const p = obs.properties;
      const speedKph = p.windSpeed?.value;
      const fromDeg = p.windDirection?.value;
      if (speedKph == null || fromDeg == null) return null;

      return {
        // NWS reports km/h already for windSpeed under the default unit system.
        speedKph: Math.round(speedKph),
        gustKph: p.windGust?.value != null ? Math.round(p.windGust.value) : undefined,
        fromDeg: normalizeBearing(fromDeg),
        // Fire travels the way the wind BLOWS, which is 180° from where it blows FROM.
        // Getting this backwards inverts the entire projection — do not "simplify" it.
        toDeg: normalizeBearing(fromDeg + 180),
        observedAt: p.timestamp ?? new Date().toISOString(),
        station: station.properties.stationIdentifier,
      };
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════════

function numberOrUndefined(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function toIso(v: unknown): string | undefined {
  if (v == null) return undefined;
  const d = typeof v === 'number' ? new Date(v) : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
