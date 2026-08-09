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

  const strategies: Strategy<GeocodeResult>[] = [
    {
      name: 'Google Geocoding',
      source: 'live',
      enabled: Boolean(env.googleMapsKey) && !offline,
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
