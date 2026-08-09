/**
 * EMBER — official closures and evacuation orders.
 * OWNER: DATA
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * VERIFIED LIVE ENDPOINTS (all keyless GETs, verified working):
 *
 * ROAD CLOSURES — Caltrans Lane Closure System (LCS), per district:
 *   https://cwwp2.dot.ca.gov/data/d{N}/lcs/lcsStatusD{NN}.json
 *   e.g. D7 (Los Angeles/Ventura):
 *   https://cwwp2.dot.ca.gov/data/d7/lcs/lcsStatusD07.json
 *   ~12 MB, ~4,000 records. `closure.typeOfClosure === 'Full'` is the one that
 *   matters; the rest are lane and ramp work. Each record carries begin/end
 *   lat-lng, route designation, and start/end epochs.
 *
 * CHP incidents (same host, not currently consumed — left documented because it
 * is the natural next feed):
 *   https://cwwp2.dot.ca.gov/data/d7/cc/ccStatusD07.json
 *
 * EVACUATION ZONES — CAL FIRE statewide aggregation (primary):
 *   https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/
 *     Combined_Statewide_Evacuation_Public_View/FeatureServer/0
 *   Statuses observed live: "Evacuation Order", "Evacuation Warning", "Advisory".
 *
 * EVACUATION ZONES — Cal OES hosted aggregation (secondary):
 *   https://services.arcgis.com/BLN4oKB0N1YSgvY8/arcgis/rest/services/
 *     CA_EVACUATIONS_CalOESHosted_view/FeatureServer/0
 *
 * ⚠️ WHAT NIFC DOES **NOT** PUBLISH:
 * The NIFC ArcGIS org (services3.arcgis.com/T4QMspbfLg3qTGWY — the same portal
 * our perimeters come from) has 772 services, but no national road-closure or
 * evacuation-zone layer. Its evac layers are per-incident and ad hoc
 * ("2025_Trout_Fire_Evacuation_Areas", "Gold_Mountain_Evacuation_Zones"), with
 * inconsistent names and schemas, published by whichever team stood them up.
 * There is nothing stable to code against, so we use the CALIFORNIA statewide
 * aggregations instead. Do not claim a national closure feed — it does not exist.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { CACHE_TTL_MS, TIMEOUTS_MS } from '@ember/shared';
import type {
  EvacuationStatus,
  EvacuationZone,
  LatLng,
  OfficialContext,
  Provenance,
  RoadClosure,
} from '@ember/shared';
import { cached } from '../core/cache';
import { fromGeoJsonRing, haversineKm, pointInPolygon } from '../core/geo';
import { fetchJson, resolve, settleAll, type Strategy } from '../core/resilient';
import type { TraceRecorder } from '../core/trace';
import { isOffline } from '../env';
import { CANNED_CLOSURES, CANNED_EVAC_ZONES } from '../fixtures/official';

/** Only look this far out — a shut ramp in Long Beach is not your problem. */
const DEFAULT_RADIUS_KM = 45;

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export async function fetchOfficial(
  location: LatLng,
  trace: TraceRecorder,
  opts: { forceOffline?: boolean; scenarioId?: string; radiusKm?: number } = {},
): Promise<OfficialContext> {
  const radiusKm = opts.radiusKm ?? DEFAULT_RADIUS_KM;
  // A pinned scenario is fully canned — same rule as every other stage.
  const live = !isOffline(opts.forceOffline) && !opts.scenarioId;

  const closureStrategies: Strategy<RoadClosure[]>[] = [
    {
      name: 'Caltrans LCS (full closures)',
      source: 'live',
      enabled: live,
      timeoutMs: TIMEOUTS_MS.closures,
      url: 'https://cwwp2.dot.ca.gov/data/d{N}/lcs/lcsStatusD{NN}.json',
      note: 'Statewide-highway full closures, currently in effect.',
      run: (signal) => fetchCaltransClosures(location, radiusKm, signal),
    },
    {
      name: 'Canned closures',
      source: 'canned',
      note: 'Demo closures for the reconstructed scenario.',
      run: async () => CANNED_CLOSURES,
    },
  ];

  const zoneStrategies: Strategy<EvacuationZone[]>[] = [
    {
      name: 'CAL FIRE statewide evacuations',
      source: 'live',
      enabled: live,
      timeoutMs: TIMEOUTS_MS.evacZones,
      url: `${CALFIRE_EVAC}/query`,
      run: (signal) => fetchEvacZones(CALFIRE_EVAC, CALFIRE_FIELDS, location, radiusKm, signal),
    },
    {
      name: 'Cal OES evacuations',
      source: 'live',
      enabled: live,
      timeoutMs: TIMEOUTS_MS.evacZones,
      url: `${CALOES_EVAC}/query`,
      run: (signal) => fetchEvacZones(CALOES_EVAC, CALOES_FIELDS, location, radiusKm, signal),
    },
    {
      name: 'Canned evacuation zones',
      source: 'canned',
      note: 'Demo evacuation zones for the reconstructed scenario.',
      run: async () => CANNED_EVAC_ZONES,
    },
  ];

  // Independent feeds — a dead LCS must not cost us the evacuation orders.
  const results = await settleAll({
    closures: resolve('closures', closureStrategies, trace, TIMEOUTS_MS.closures),
    zones: resolve('evac-zones', zoneStrategies, trace, TIMEOUTS_MS.evacZones),
  });

  const closures = results.closures?.data ?? [];
  const zones = results.zones?.data ?? [];

  return {
    closures,
    zones,
    // Are we standing in an ordered area? This changes the verdict, not the route.
    originZone:
      zones.find((z) => z.status === 'order' && pointInPolygon(location, z.polygon)) ??
      zones.find((z) => pointInPolygon(location, z.polygon)) ??
      null,
    provenance: {
      closures: results.closures?.provenance ?? unavailable('Caltrans LCS'),
      zones: results.zones?.provenance ?? unavailable('CAL FIRE / Cal OES'),
    },
  };
}

const unavailable = (provider: string): Provenance => ({
  source: 'mock',
  provider,
  fetchedAt: new Date().toISOString(),
  note: 'Feed unavailable and no canned data applied.',
});

// ═══════════════════════════════════════════════════════════════════════════
// CALTRANS LANE CLOSURE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

interface LcsRecord {
  lcs?: LcsBody;
}
interface LcsBody {
  location?: {
    begin?: Record<string, string>;
    end?: Record<string, string>;
  };
  closure?: {
    closureID?: string;
    facility?: string;
    typeOfClosure?: string;
    typeOfWork?: string;
    closureTimestamp?: {
      closureStartEpoch?: string;
      closureEndEpoch?: string;
      isClosureEndIndefinite?: string;
    };
  };
}

/**
 * Caltrans districts, roughly. The LCS feed is published per district and there
 * is no statewide file, so we have to pick. Boxes overlap deliberately — better
 * to fetch two districts near a boundary than to miss the one you are in.
 */
const DISTRICTS: { id: number; bbox: [number, number, number, number] }[] = [
  { id: 1, bbox: [-124.6, 38.7, -122.7, 42.1] },
  { id: 2, bbox: [-123.1, 39.4, -119.8, 42.1] },
  { id: 3, bbox: [-122.6, 37.9, -119.8, 39.9] },
  { id: 4, bbox: [-123.3, 36.8, -121.1, 39.0] },
  { id: 5, bbox: [-122.4, 34.7, -119.3, 37.5] },
  { id: 6, bbox: [-120.8, 34.7, -117.5, 37.7] },
  { id: 7, bbox: [-119.6, 33.6, -117.5, 35.0] },
  { id: 8, bbox: [-118.1, 33.3, -114.0, 35.9] },
  { id: 9, bbox: [-120.1, 34.9, -116.9, 38.8] },
  { id: 10, bbox: [-121.7, 36.9, -119.2, 39.0] },
  { id: 11, bbox: [-117.7, 32.4, -114.3, 34.0] },
  { id: 12, bbox: [-118.2, 33.2, -117.3, 34.0] },
];

export function districtsFor(location: LatLng): number[] {
  const hits = DISTRICTS.filter(
    (d) =>
      location.lng >= d.bbox[0] &&
      location.lng <= d.bbox[2] &&
      location.lat >= d.bbox[1] &&
      location.lat <= d.bbox[3],
  ).map((d) => d.id);
  // Each district file is ~12 MB. Two is already generous on a phone tether.
  return hits.length > 0 ? hits.slice(0, 2) : [7];
}

async function fetchCaltransClosures(
  location: LatLng,
  radiusKm: number,
  signal: AbortSignal,
): Promise<RoadClosure[]> {
  const districts = districtsFor(location);
  const nowEpoch = Date.now() / 1000;

  const perDistrict = await Promise.allSettled(
    districts.map((d) => {
      const dd = String(d).padStart(2, '0');
      const url = `https://cwwp2.dot.ca.gov/data/d${d}/lcs/lcsStatusD${dd}.json`;
      return cached(`lcs:${d}`, CACHE_TTL_MS.closures, () =>
        fetchJson<{ data?: LcsRecord[] }>(url, signal),
      );
    }),
  );

  const out: RoadClosure[] = [];
  for (const settled of perDistrict) {
    if (settled.status !== 'fulfilled') continue;
    for (const row of settled.value.data ?? []) {
      const body = row.lcs ?? (row as unknown as LcsBody);
      const closure = body.closure;
      const begin = body.location?.begin;
      const end = body.location?.end;
      if (!closure || !begin) continue;

      // FULL closures only. A lane closure is traffic; a full closure is a wall.
      if (closure.typeOfClosure !== 'Full') continue;

      // In effect RIGHT NOW. The feed is mostly future scheduled work — treating
      // next Tuesday's roadworks as a live obstruction would reroute people for
      // nothing.
      const start = Number(closure.closureTimestamp?.closureStartEpoch);
      const finish = Number(closure.closureTimestamp?.closureEndEpoch);
      const indefinite = closure.closureTimestamp?.isClosureEndIndefinite === 'true';
      if (!Number.isFinite(start) || start > nowEpoch) continue;
      if (!indefinite && (!Number.isFinite(finish) || finish < nowEpoch)) continue;

      const from = coord(begin.beginLatitude, begin.beginLongitude);
      if (!from) continue;
      const to = coord(end?.endLatitude, end?.endLongitude) ?? from;
      if (haversineKm(location, from) > radiusKm) continue;

      out.push({
        id: `ct-${closure.closureID ?? `${from.lat},${from.lng}`}-${start}`,
        road: begin.beginRoute ?? 'Unknown route',
        description: begin.beginLocationName ?? begin.beginNearbyPlace ?? 'State highway',
        from,
        to,
        reason: closure.typeOfWork ?? 'Closure',
        facility: closure.facility ?? 'Mainline',
        startsAt: Number.isFinite(start) ? new Date(start * 1000).toISOString() : null,
        endsAt: !indefinite && Number.isFinite(finish) ? new Date(finish * 1000).toISOString() : null,
        indefinite,
      });
    }
  }
  return out;
}

function coord(lat?: string, lng?: string): LatLng | null {
  const la = Number(lat);
  const ln = Number(lng);
  return Number.isFinite(la) && Number.isFinite(ln) && (la !== 0 || ln !== 0)
    ? { lat: la, lng: ln }
    : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// EVACUATION ZONES (ArcGIS FeatureServer, GeoJSON out)
// ═══════════════════════════════════════════════════════════════════════════

const CALFIRE_EVAC =
  'https://services1.arcgis.com/jUJYIo9tSA7EHvfZ/arcgis/rest/services/Combined_Statewide_Evacuation_Public_View/FeatureServer/0';
const CALOES_EVAC =
  'https://services.arcgis.com/BLN4oKB0N1YSgvY8/arcgis/rest/services/CA_EVACUATIONS_CalOESHosted_view/FeatureServer/0';

/** The two aggregations use different casing for the same concepts. */
interface ZoneFields {
  zoneId: string[];
  status: string[];
  county: string[];
  city: string[];
  info: string[];
}
const CALFIRE_FIELDS: ZoneFields = {
  zoneId: ['zone_id'],
  status: ['zone_status'],
  county: ['county_abbr'],
  city: ['city_abbr'],
  info: ['zone_status_reason', 'known_as'],
};
const CALOES_FIELDS: ZoneFields = {
  zoneId: ['ZONE_ID'],
  status: ['STATUS'],
  county: ['COUNTY'],
  city: ['CITY'],
  info: ['PUBLIC_INFO', 'CRITICAL_INFO', 'NOTES'],
};

async function fetchEvacZones(
  base: string,
  fields: ZoneFields,
  location: LatLng,
  radiusKm: number,
  signal: AbortSignal,
): Promise<EvacuationZone[]> {
  const deg = radiusKm / 111;
  const envelope = {
    xmin: location.lng - deg,
    ymin: location.lat - deg,
    xmax: location.lng + deg,
    ymax: location.lat + deg,
    spatialReference: { wkid: 4326 },
  };

  const url = new URL(`${base}/query`);
  url.searchParams.set('f', 'geojson');
  url.searchParams.set('where', '1=1');
  url.searchParams.set('geometry', JSON.stringify(envelope));
  url.searchParams.set('geometryType', 'esriGeometryEnvelope');
  url.searchParams.set('inSR', '4326');
  url.searchParams.set('spatialRel', 'esriSpatialRelIntersects');
  url.searchParams.set('outFields', '*');
  url.searchParams.set('resultRecordCount', '60');

  const key = `evac:${base.slice(-40)}:${location.lat.toFixed(2)},${location.lng.toFixed(2)}`;
  const body = await cached(key, CACHE_TTL_MS.evacZones, () =>
    fetchJson<{ features?: EvacFeature[] }>(url.toString(), signal),
  );

  const features = body.features ?? [];
  if (features.length === 0) throw new Error('no evacuation zones in this area');

  const zones: EvacuationZone[] = [];
  for (const feature of features) {
    for (const polygon of geoJsonPolygons(feature.geometry)) {
      if (polygon.length < 3) continue;
      const props = feature.properties ?? {};
      zones.push({
        id: `evac-${pick(props, fields.zoneId) ?? zones.length}-${zones.length}`,
        zoneId: String(pick(props, fields.zoneId) ?? 'unknown'),
        status: normalizeStatus(pick(props, fields.status)),
        county: asText(pick(props, fields.county)),
        city: asText(pick(props, fields.city)),
        info: asText(pick(props, fields.info)),
        polygon,
      });
    }
  }
  return zones;
}

interface EvacFeature {
  properties?: Record<string, unknown>;
  geometry?: { type: string; coordinates: unknown } | null;
}

function geoJsonPolygons(geometry: EvacFeature['geometry']): LatLng[][] {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') {
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

/** Observed live values: "Evacuation Order", "Evacuation Warning", "Advisory". */
export function normalizeStatus(raw: unknown): EvacuationStatus {
  const v = String(raw ?? '').toLowerCase();
  if (v.includes('order') || v.includes('mandatory')) return 'order';
  if (v.includes('warning')) return 'warning';
  if (v.includes('advisory') || v.includes('shelter')) return 'advisory';
  return 'unknown';
}

function pick(props: Record<string, unknown>, names: string[]): unknown {
  for (const n of names) {
    const v = props[n];
    if (v !== undefined && v !== null && String(v).trim().length > 0) return v;
  }
  return undefined;
}

function asText(v: unknown): string | null {
  const s = v === undefined || v === null ? '' : String(v).trim();
  return s.length > 0 ? s : null;
}
