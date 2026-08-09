/**
 * EMBER — address → coordinates. CONTEXT.md §5 step 1.
 * OWNER: DATA
 *
 * Strategy chain: Google Geocoding → canned scenario addresses.
 * The canned tier means someone can type "1500 Palisades Drive" on a plane and
 * still get a full assessment.
 */

import { CACHE_TTL_MS, TIMEOUTS_MS } from '@ember/shared';
import type { LatLng, Sourced } from '@ember/shared';
import { cached } from '../core/cache';
import { fetchJson, resolve, type Strategy } from '../core/resilient';
import type { TraceRecorder } from '../core/trace';
import { env, isOffline } from '../env';
import { cannedGeocode, getScenario } from '../fixtures';

export interface GeocodeResult {
  formattedAddress: string;
  location: LatLng;
  /** Set when the address matched a canned scenario — pins the rest of the pipeline. */
  scenarioId?: string;
}

interface CensusGeocodeResponse {
  result?: {
    addressMatches?: {
      matchedAddress: string;
      /** x = longitude, y = latitude. */
      coordinates: { x: number; y: number };
    }[];
  };
}

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

interface MireyeGeocodeResponse {
  lat: number;
  lng: number;
  normalized_address?: string;
  /** e.g. "rooftop" vs "street" — how much to trust the pin. */
  accuracy_type?: string;
  match_type?: string;
  provider?: string;
  source?: string;
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  }[];
}

export async function geocodeAddress(
  query: string,
  trace: TraceRecorder,
  opts: { forceOffline?: boolean; scenarioId?: string } = {},
): Promise<Sourced<GeocodeResult>> {
  const offline = isOffline(opts.forceOffline);

  /**
   * A pinned scenario must be fully reproducible — that is the entire reason it
   * exists (CONTEXT.md §7). If we geocode live here we get the real rooftop
   * coordinate, which sits ~600 m from where the scenario's canned routes
   * begin, and the map draws the house floating off the end of its own
   * evacuation route. Pinned means canned, all the way down.
   */
  const live = !offline && !opts.scenarioId;

  const strategies: Strategy<GeocodeResult>[] = [
    {
      name: 'Google Geocoding',
      source: 'live',
      enabled: Boolean(env.googleMapsKey) && live,
      timeoutMs: TIMEOUTS_MS.geocode,
      url: 'https://maps.googleapis.com/maps/api/geocode/json',
      run: async (signal) =>
        cached(`geocode:${query.toLowerCase()}`, CACHE_TTL_MS.geocode, async () => {
          const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
          url.searchParams.set('address', query);
          url.searchParams.set('key', env.googleMapsKey!);
          // Bias toward California — the scenarios and the fire feeds live there.
          url.searchParams.set('components', 'country:US');

          const body = await fetchJson<GoogleGeocodeResponse>(url.toString(), signal);
          if (body.status !== 'OK' || body.results.length === 0) {
            throw new Error(`Google status ${body.status}${body.error_message ? `: ${body.error_message}` : ''}`);
          }
          const top = body.results[0]!;
          return {
            formattedAddress: top.formatted_address,
            location: { lat: top.geometry.location.lat, lng: top.geometry.location.lng },
          };
        }),
    },

    // Mireye's geocoder is rooftop-accurate and reports HOW it matched, so we
    // can tell a building centroid from a street interpolation. It is a genuine
    // second provider, not a degraded one — hence source: 'live'.
    {
      name: 'Mireye Earth /v1/geocode',
      source: 'live',
      enabled: Boolean(env.mireyeKey) && live,
      timeoutMs: TIMEOUTS_MS.geocode,
      url: `${env.mireyeBaseUrl}/v1/geocode`,
      run: async (signal) =>
        cached(`geocode:mireye:${query.toLowerCase()}`, CACHE_TTL_MS.geocode, async () => {
          const res = await fetch(new URL('/v1/geocode', env.mireyeBaseUrl), {
            method: 'POST',
            signal,
            headers: {
              Authorization: `Bearer ${env.mireyeKey}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({ address: query }),
          });
          if (!res.ok) {
            throw new Error(`HTTP ${res.status} ${res.statusText}: ${(await res.text()).slice(0, 160)}`);
          }
          const body = (await res.json()) as MireyeGeocodeResponse;
          if (!Number.isFinite(body.lat) || !Number.isFinite(body.lng)) {
            throw new Error('no coordinate in response');
          }
          return {
            formattedAddress: body.normalized_address ?? query,
            location: { lat: body.lat, lng: body.lng },
          };
        }),
    },

    // ── FREE, NO-KEY TIERS ──────────────────────────────────────────────────
    // Not in the original API stack. Added because Google Geocoding is the only
    // keyed geocoder we have, and if its project loses billing every live
    // address in the demo dies with it. These two cost nothing and need no key.

    {
      // US Census Bureau geocoder. Official, free, no key, US-only.
      // Handles street addresses well; returns nothing for a bare city name.
      name: 'US Census geocoder',
      source: 'live',
      enabled: live,
      timeoutMs: TIMEOUTS_MS.geocode,
      url: 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress',
      run: async (signal) =>
        cached(`geocode:census:${query.toLowerCase()}`, CACHE_TTL_MS.geocode, async () => {
          const url = new URL(
            'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress',
          );
          url.searchParams.set('address', query);
          url.searchParams.set('benchmark', 'Public_AR_Current');
          url.searchParams.set('format', 'json');

          const body = await fetchJson<CensusGeocodeResponse>(url.toString(), signal);
          const match = body.result?.addressMatches?.[0];
          if (!match) throw new Error('no address match');
          return {
            formattedAddress: match.matchedAddress,
            // Census returns x=lng, y=lat. Swapping these puts you in Asia.
            location: { lat: match.coordinates.y, lng: match.coordinates.x },
          };
        }),
    },

    {
      // OpenStreetMap Nominatim. Free, no key, and the only tier here that
      // resolves a bare place name like "Pacific Palisades, CA".
      // Usage policy requires a real User-Agent (fetchJson sets one) and low
      // volume — fine for a demo, not for production traffic.
      name: 'OpenStreetMap Nominatim',
      source: 'live',
      enabled: live,
      timeoutMs: TIMEOUTS_MS.geocode,
      url: 'https://nominatim.openstreetmap.org/search',
      run: async (signal) =>
        cached(`geocode:osm:${query.toLowerCase()}`, CACHE_TTL_MS.geocode, async () => {
          const url = new URL('https://nominatim.openstreetmap.org/search');
          url.searchParams.set('q', query);
          url.searchParams.set('format', 'jsonv2');
          url.searchParams.set('limit', '1');
          url.searchParams.set('countrycodes', 'us');

          const body = await fetchJson<NominatimResult[]>(url.toString(), signal);
          const top = body[0];
          if (!top) throw new Error('no result');
          return {
            formattedAddress: top.display_name,
            location: { lat: Number(top.lat), lng: Number(top.lon) },
          };
        }),
    },

    // ── LAST RESORT. MUST NOT FAIL. ─────────────────────────────────────────
    {
      name: 'Canned scenario addresses',
      source: 'canned',
      note: 'Matched against the demo scenarios — no network required.',
      run: async () => {
        const hit = cannedGeocode(query);
        if (hit) return hit;

        // Unknown address with no geocoder: drop the user at the pinned (or
        // default) scenario's demo address rather than failing the request.
        // Loud, honest, and the demo keeps moving.
        const scenario = getScenario(opts.scenarioId);
        return {
          formattedAddress: `${scenario.summary.demoAddress} (demo address — "${query}" could not be geocoded)`,
          location: scenario.origin,
          scenarioId: scenario.summary.id,
        };
      },
    },
  ];

  return resolve('geocode', strategies, trace, TIMEOUTS_MS.geocode);
}
