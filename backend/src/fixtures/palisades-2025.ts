/**
 * EMBER — CANNED SCENARIO: Palisades Fire, Los Angeles, January 2025.
 * OWNER: FRONTEND (owns the demo) + DATA (owns accuracy)
 *
 * ⚠️  THIS FILE IS WHY THE DEMO NEVER BREAKS. CONTEXT.md §7.
 * Zero network. Zero API keys. Runs on a plane.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HONESTY STATEMENT — read this before you claim anything on stage.
 *
 * The Palisades Fire was real: it ignited in the hills above Pacific Palisades
 * on 7 January 2025, driven by an extreme Santa Ana wind event, and destroyed
 * thousands of structures. The geography here is real — Palisades Drive really
 * is the single road in and out of the Palisades Highlands, Sunset Blvd really
 * runs east toward the 405, and PCH really is the coastal escape.
 *
 * The PERIMETER POLYGON IS AN ILLUSTRATIVE RECONSTRUCTION, not an official
 * NIFC shapefile. It is shaped to be geographically plausible for the early
 * hours of the fire. Say "reconstructed from the real event" — never "this is
 * the official perimeter". The provenance on every object below says `canned`
 * and the UI renders a DEMO DATA badge accordingly.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * WHY THIS SCENARIO WINS THE DEMO:
 *   • The Palisades Highlands has ONE road out. `exitCount: 1`. That is the
 *     entire thesis of the product in a single integer.
 *   • Santa Ana winds blow from the northeast, so the fire runs southwest —
 *     across Sunset Blvd, the fastest route to the freeway.
 *   • The fastest route (east on Sunset to the 405) is therefore the one that
 *     drives along the fire's advancing flank. That is the betrayal, and the
 *     judge derives it from this geometry rather than being told.
 */

import type {
  GroundContext,
  Hazard,
  LatLng,
  Provenance,
  Route,
  ScenarioSummary,
} from '@ember/shared';
import { buildRoute } from '../core/routes';

const FETCHED_AT = '2025-01-08T02:10:00.000Z';

const canned = (note: string): Provenance => ({
  source: 'canned',
  provider: 'canned:palisades-2025',
  fetchedAt: FETCHED_AT,
  note,
});

// ═══════════════════════════════════════════════════════════════════════════
// THE FIRE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Active burn area in the hills northeast of the Palisades Highlands.
 * Roughly 2 km across, centred near Temescal Ridge.
 */
const PERIMETER: LatLng[] = [
  { lat: 34.1, lng: -118.513 },
  { lat: 34.096, lng: -118.495 },
  { lat: 34.084, lng: -118.488 },
  { lat: 34.072, lng: -118.495 },
  { lat: 34.07, lng: -118.512 },
  { lat: 34.08, lng: -118.523 },
  { lat: 34.093, lng: -118.524 },
];

export const PALISADES_HAZARD: Hazard = {
  id: 'palisades-2025',
  kind: 'wildfire',
  name: 'Palisades Fire',
  perimeter: [PERIMETER],
  hotspots: [
    { location: { lat: 34.0885, lng: -118.5055 }, confidence: 0.96, brightnessK: 412, detectedAt: FETCHED_AT },
    { location: { lat: 34.0822, lng: -118.5123 }, confidence: 0.91, brightnessK: 388, detectedAt: FETCHED_AT },
    { location: { lat: 34.0768, lng: -118.5088 }, confidence: 0.87, brightnessK: 371, detectedAt: FETCHED_AT },
    { location: { lat: 34.0941, lng: -118.5179 }, confidence: 0.79, brightnessK: 349, detectedAt: FETCHED_AT },
    { location: { lat: 34.0748, lng: -118.5185 }, confidence: 0.74, brightnessK: 341, detectedAt: FETCHED_AT },
  ],
  wind: {
    // Santa Ana: offshore flow out of the northeast. This is the whole story —
    // it is why the fire runs downhill toward the ocean and across the town.
    speedKph: 40,
    gustKph: 95,
    fromDeg: 40,
    toDeg: 220,
    observedAt: FETCHED_AT,
    station: 'KSMO / Santa Monica Muni (reconstructed)',
  },
  discoveredAt: '2025-01-07T18:30:00.000Z',
  acres: 2920,
  containmentPct: 0,
  provenance: {
    perimeter: canned('Illustrative reconstruction of the early Palisades Fire perimeter.'),
    hotspots: canned('Representative VIIRS-style hotspots inside the reconstructed perimeter.'),
    wind: canned('Santa Ana wind event, 7 Jan 2025: sustained ~40 mph, gusts ~75 mph.'),
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// THE ADDRESS — Palisades Highlands. One road out.
// ═══════════════════════════════════════════════════════════════════════════

export const PALISADES_DEMO_ADDRESS = '1500 Palisades Drive, Pacific Palisades, CA 90272';
export const PALISADES_ORIGIN: LatLng = { lat: 34.0709, lng: -118.5556 };

/** Canned geocodes so the demo works with no Google key. Keys are lowercased. */
export const PALISADES_GEOCODES: Record<string, { formattedAddress: string; location: LatLng }> = {
  '1500 palisades drive, pacific palisades, ca 90272': {
    formattedAddress: '1500 Palisades Dr, Pacific Palisades, CA 90272, USA',
    location: PALISADES_ORIGIN,
  },
  '1500 palisades drive': {
    formattedAddress: '1500 Palisades Dr, Pacific Palisades, CA 90272, USA',
    location: PALISADES_ORIGIN,
  },
  'palisades drive': {
    formattedAddress: 'Palisades Dr, Pacific Palisades, CA 90272, USA',
    location: PALISADES_ORIGIN,
  },
  'pacific palisades': {
    formattedAddress: 'Pacific Palisades, Los Angeles, CA, USA',
    location: { lat: 34.0464, lng: -118.5265 },
  },
};

export const PALISADES_GROUND: GroundContext = {
  elevationM: 232,
  slopePct: 11.4,
  // Terrain falls away to the southwest, toward the ocean — the same way the
  // wind is pushing. Downslope + downwind is the worst possible combination.
  aspectDeg: 214,
  terrain: 'Chaparral canyon on a south-west facing slope, dense wildland-urban interface.',
  // THE NUMBER THAT SELLS THE PRODUCT.
  exitCount: 1,
  exits: [
    { name: 'Palisades Drive (only road out)', bearingDeg: 168, direction: 'S', kind: 'arterial' },
  ],
  provenance: canned('Terrain and exit count for the Palisades Highlands; one road in and out.'),
};

// ═══════════════════════════════════════════════════════════════════════════
// CANDIDATE ROUTES
//
// These are the shapes Google Directions would return for this origin. Durations
// are evacuation-realistic (congested canyon road, moving traffic on PCH).
//
// Route A is FASTEST. It is also the one that drives along the fire's flank.
// We do not label it dangerous here — `judge.ts` works that out from geometry.
// ═══════════════════════════════════════════════════════════════════════════

const routeProvenance = canned('Canned route geometry approximating Google Directions alternatives.');

/** Palisades Drive: the single shared spine every route must use. */
const PALISADES_DRIVE: LatLng[] = [
  { lat: 34.0709, lng: -118.5556 },
  { lat: 34.067, lng: -118.5545 },
  { lat: 34.062, lng: -118.553 },
  { lat: 34.057, lng: -118.552 },
  { lat: 34.0538, lng: -118.551 },
];

export const PALISADES_ROUTES: Route[] = [
  // ── A: FASTEST. East on Sunset toward the I-405. This is the killer. ──────
  buildRoute({
    id: 'pal-route-405',
    summary: 'Palisades Dr → Sunset Blvd east → I-405',
    legs: [
      { path: PALISADES_DRIVE, durationMinutes: 6 },
      {
        // Sunset curves northeast through Brentwood toward the 405 at the Getty.
        // That is where the freeway actually is — and it is straight back up
        // toward where the fire started.
        path: [
          { lat: 34.0538, lng: -118.551 },
          { lat: 34.053, lng: -118.54 },
          { lat: 34.0545, lng: -118.525 },
          { lat: 34.056, lng: -118.51 },
          { lat: 34.06, lng: -118.495 },
          { lat: 34.0685, lng: -118.4835 },
          { lat: 34.0805, lng: -118.4755 },
        ],
        durationMinutes: 13,
      },
    ],
    destination: {
      id: 'dest-405',
      name: 'I-405 north / Getty Center',
      location: { lat: 34.0805, lng: -118.4755 },
      kind: 'highway',
    },
    provenance: routeProvenance,
  }),

  // ── B: Down to the coast, then southeast to Santa Monica. ────────────────
  // Slower. Also the one where the ocean is on your right and the fire cannot
  // reach you from that side.
  buildRoute({
    id: 'pal-route-pch-south',
    summary: 'Palisades Dr → Sunset west → PCH south → Santa Monica',
    legs: [
      { path: PALISADES_DRIVE, durationMinutes: 6 },
      {
        path: [
          { lat: 34.0538, lng: -118.551 },
          { lat: 34.051, lng: -118.557 },
          { lat: 34.047, lng: -118.564 },
          { lat: 34.038, lng: -118.559 },
        ],
        durationMinutes: 4,
      },
      {
        path: [
          { lat: 34.038, lng: -118.559 },
          { lat: 34.033, lng: -118.545 },
          { lat: 34.029, lng: -118.53 },
          { lat: 34.025, lng: -118.512 },
          { lat: 34.021, lng: -118.498 },
          { lat: 34.0195, lng: -118.4912 },
        ],
        durationMinutes: 12,
      },
    ],
    destination: {
      id: 'dest-santa-monica',
      name: 'Santa Monica Civic Center (evacuation point)',
      location: { lat: 34.0195, lng: -118.4912 },
      kind: 'shelter',
    },
    provenance: routeProvenance,
  }),

  // ── C: Coast road northwest toward Malibu. ───────────────────────────────
  // Looks reasonable on a map. It runs almost exactly along the fire's spread
  // bearing — you would be driving with the fire. The judge should hate it.
  buildRoute({
    id: 'pal-route-pch-north',
    summary: 'Palisades Dr → Sunset west → PCH north → Topanga',
    legs: [
      { path: PALISADES_DRIVE, durationMinutes: 6 },
      {
        path: [
          { lat: 34.0538, lng: -118.551 },
          { lat: 34.051, lng: -118.557 },
          { lat: 34.047, lng: -118.564 },
          { lat: 34.038, lng: -118.559 },
        ],
        durationMinutes: 4,
      },
      {
        path: [
          { lat: 34.038, lng: -118.559 },
          { lat: 34.0375, lng: -118.575 },
          { lat: 34.0365, lng: -118.59 },
          { lat: 34.036, lng: -118.605 },
        ],
        durationMinutes: 11,
      },
    ],
    destination: {
      id: 'dest-topanga',
      name: 'Topanga Beach',
      location: { lat: 34.036, lng: -118.605 },
      kind: 'coast',
    },
    provenance: routeProvenance,
  }),
];

export const PALISADES_SUMMARY: ScenarioSummary = {
  id: 'palisades-2025',
  name: 'Palisades Fire',
  region: 'Pacific Palisades, Los Angeles County, CA',
  date: '2025-01-07',
  demoAddress: PALISADES_DEMO_ADDRESS,
  headline:
    'Santa Ana winds drive the fire southwest across Sunset Blvd. The Highlands have one road out.',
  center: { lat: 34.062, lng: -118.535 },
};
