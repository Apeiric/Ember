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
  // South-east finger toward Rustic and Sullivan canyons — the real fire ran
  // this way on the evening of 7 Jan, which is exactly why Sunset-to-the-405
  // was the wrong way out.
  { lat: 34.069, lng: -118.4865 },
  { lat: 34.0635, lng: -118.4915 },
  { lat: 34.068, lng: -118.5 },
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
    // Spot fire east of the main body, above Sunset's bend toward the Getty —
    // wind-driven spotting ahead of the front is how this fire actually moved.
    { location: { lat: 34.0655, lng: -118.4895 }, confidence: 0.83, brightnessK: 356, detectedAt: FETCHED_AT },
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
  // The household fixtures' addresses. Without these, selecting a family member
  // under the pinned scenario silently geocode-falls-back to the demo origin —
  // their verdict gets computed from a house they are not in.
  '881 alma real dr, pacific palisades': {
    formattedAddress: '881 Alma Real Dr, Pacific Palisades, CA 90272, USA',
    location: { lat: 34.0466, lng: -118.5223 },
  },
  'palisades charter high school': {
    formattedAddress: 'Palisades Charter High School, 15777 Bowdoin St, Pacific Palisades, CA',
    location: { lat: 34.0407, lng: -118.5265 },
  },
  'brentwood, los angeles': {
    formattedAddress: 'Brentwood, Los Angeles, CA, USA',
    location: { lat: 34.0522, lng: -118.4712 },
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

/** Palisades Drive: the single shared spine every route must use.
 *  Geometry baked from Google Directions (2026-08-09) so the line follows the
 *  real road — canned at runtime, zero network, never crosses terrain. */
const PALISADES_DRIVE: LatLng[] = [
  { lat: 34.07092, lng: -118.55417 },
  { lat: 34.06974, lng: -118.55373 },
  { lat: 34.06787, lng: -118.55251 },
  { lat: 34.06786, lng: -118.55159 },
  { lat: 34.06967, lng: -118.55163 },
  { lat: 34.07081, lng: -118.55174 },
  { lat: 34.07203, lng: -118.55184 },
  { lat: 34.0743, lng: -118.55364 },
  { lat: 34.07441, lng: -118.55527 },
  { lat: 34.07434, lng: -118.55723 },
  { lat: 34.07547, lng: -118.55878 },
  { lat: 34.07628, lng: -118.56065 },
  { lat: 34.0775, lng: -118.56193 },
  { lat: 34.07772, lng: -118.56345 },
  { lat: 34.07689, lng: -118.56481 },
  { lat: 34.07534, lng: -118.56512 },
  { lat: 34.0717, lng: -118.56308 },
  { lat: 34.06889, lng: -118.56026 },
  { lat: 34.06672, lng: -118.55915 },
  { lat: 34.06456, lng: -118.55854 },
  { lat: 34.06141, lng: -118.55648 },
  { lat: 34.05976, lng: -118.5555 },
  { lat: 34.05816, lng: -118.55536 },
  { lat: 34.0558, lng: -118.55391 },
  { lat: 34.05333, lng: -118.55341 },
  { lat: 34.05139, lng: -118.55288 },
  { lat: 34.05081, lng: -118.55231 },
  { lat: 34.05126, lng: -118.55221 },
  { lat: 34.05235, lng: -118.55222 },
  { lat: 34.05294, lng: -118.55202 },
];

export const PALISADES_ROUTES: Route[] = [
  // ── A: FASTEST. East on Sunset toward the I-405. This is the killer. ──────
  buildRoute({
    id: 'pal-route-405',
    summary: 'Palisades Dr → Sunset Blvd east → I-405',
    legs: [
      { path: PALISADES_DRIVE, durationMinutes: 6, roadName: 'Palisades Dr' },
      {
        // Sunset curves northeast through Brentwood toward the 405 at the Getty.
        // That is where the freeway actually is — and it is straight back up
        // toward where the fire started.
        path: [
          { lat: 34.05294, lng: -118.55202 },
          { lat: 34.05078, lng: -118.55275 },
          { lat: 34.04363, lng: -118.55099 },
          { lat: 34.04153, lng: -118.54976 },
          { lat: 34.04685, lng: -118.54385 },
          { lat: 34.04851, lng: -118.53813 },
          { lat: 34.04975, lng: -118.53055 },
          { lat: 34.04807, lng: -118.5269 },
          { lat: 34.05289, lng: -118.52477 },
          { lat: 34.05391, lng: -118.52502 },
          { lat: 34.05403, lng: -118.52344 },
          { lat: 34.04938, lng: -118.52476 },
          { lat: 34.04171, lng: -118.51892 },
          { lat: 34.0441, lng: -118.51687 },
          { lat: 34.05063, lng: -118.5115 },
          { lat: 34.04767, lng: -118.5101 },
          { lat: 34.05095, lng: -118.505 },
          { lat: 34.05387, lng: -118.49925 },
          { lat: 34.05475, lng: -118.49606 },
          { lat: 34.06033, lng: -118.49419 },
          { lat: 34.05766, lng: -118.49194 },
          { lat: 34.05722, lng: -118.48449 },
          { lat: 34.06507, lng: -118.4703 },
          { lat: 34.07232, lng: -118.46744 },
          { lat: 34.07261, lng: -118.46599 },
          { lat: 34.07745, lng: -118.46948 },
          { lat: 34.088, lng: -118.47474 },
          { lat: 34.08759, lng: -118.47623 },
          { lat: 34.08467, lng: -118.4758 },
          { lat: 34.08047, lng: -118.47571 },
        ],
        durationMinutes: 13,
        roadName: 'Sunset Blvd',
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
      { path: PALISADES_DRIVE, durationMinutes: 6, roadName: 'Palisades Dr' },
      {
        path: [
          { lat: 34.05294, lng: -118.55202 },
          { lat: 34.05245, lng: -118.55218 },
          { lat: 34.05177, lng: -118.55236 },
          { lat: 34.05082, lng: -118.55215 },
          { lat: 34.04767, lng: -118.55281 },
          { lat: 34.04557, lng: -118.55211 },
          { lat: 34.04427, lng: -118.5525 },
          { lat: 34.04281, lng: -118.55379 },
          { lat: 34.0419, lng: -118.55419 },
          { lat: 34.04251, lng: -118.55547 },
          { lat: 34.04393, lng: -118.55768 },
          { lat: 34.04624, lng: -118.55989 },
          { lat: 34.04736, lng: -118.56047 },
          { lat: 34.04676, lng: -118.56101 },
          { lat: 34.04663, lng: -118.56222 },
          { lat: 34.04744, lng: -118.56378 },
          { lat: 34.04737, lng: -118.56456 },
          { lat: 34.04691, lng: -118.56568 },
          { lat: 34.04593, lng: -118.56631 },
          { lat: 34.04464, lng: -118.56678 },
          { lat: 34.04364, lng: -118.56694 },
          { lat: 34.04387, lng: -118.56642 },
          { lat: 34.0438, lng: -118.56611 },
          { lat: 34.04339, lng: -118.56646 },
          { lat: 34.04264, lng: -118.5672 },
          { lat: 34.04205, lng: -118.56765 },
          { lat: 34.04136, lng: -118.56543 },
          { lat: 34.04114, lng: -118.56351 },
          { lat: 34.04013, lng: -118.56088 },
          { lat: 34.03913, lng: -118.55842 },
        ],
        durationMinutes: 4,
        roadName: 'Sunset Blvd',
      },
      {
        path: [
          { lat: 34.03913, lng: -118.55842 },
          { lat: 34.03857, lng: -118.55689 },
          { lat: 34.03844, lng: -118.55559 },
          { lat: 34.03903, lng: -118.55204 },
          { lat: 34.03943, lng: -118.54938 },
          { lat: 34.03957, lng: -118.54624 },
          { lat: 34.03923, lng: -118.54393 },
          { lat: 34.03866, lng: -118.54178 },
          { lat: 34.03676, lng: -118.53781 },
          { lat: 34.0356, lng: -118.53555 },
          { lat: 34.03461, lng: -118.534 },
          { lat: 34.03196, lng: -118.52687 },
          { lat: 34.03105, lng: -118.5247 },
          { lat: 34.02849, lng: -118.52016 },
          { lat: 34.02834, lng: -118.51933 },
          { lat: 34.02957, lng: -118.51737 },
          { lat: 34.03025, lng: -118.51628 },
          { lat: 34.0302, lng: -118.51564 },
          { lat: 34.03043, lng: -118.51382 },
          { lat: 34.03055, lng: -118.51313 },
          { lat: 34.03015, lng: -118.51327 },
          { lat: 34.02857, lng: -118.5144 },
          { lat: 34.027, lng: -118.51519 },
          { lat: 34.02662, lng: -118.51457 },
          { lat: 34.02565, lng: -118.51275 },
          { lat: 34.02319, lng: -118.50866 },
          { lat: 34.02419, lng: -118.50508 },
          { lat: 34.02717, lng: -118.50036 },
          { lat: 34.01961, lng: -118.49153 },
          { lat: 34.01955, lng: -118.49112 },
        ],
        durationMinutes: 12,
        roadName: 'PCH south',
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
      { path: PALISADES_DRIVE, durationMinutes: 6, roadName: 'Palisades Dr' },
      {
        path: [
          { lat: 34.05294, lng: -118.55202 },
          { lat: 34.05245, lng: -118.55218 },
          { lat: 34.05177, lng: -118.55236 },
          { lat: 34.05082, lng: -118.55215 },
          { lat: 34.04767, lng: -118.55281 },
          { lat: 34.04557, lng: -118.55211 },
          { lat: 34.04427, lng: -118.5525 },
          { lat: 34.04281, lng: -118.55379 },
          { lat: 34.0419, lng: -118.55419 },
          { lat: 34.04251, lng: -118.55547 },
          { lat: 34.04393, lng: -118.55768 },
          { lat: 34.04624, lng: -118.55989 },
          { lat: 34.04736, lng: -118.56047 },
          { lat: 34.04676, lng: -118.56101 },
          { lat: 34.04663, lng: -118.56222 },
          { lat: 34.04744, lng: -118.56378 },
          { lat: 34.04737, lng: -118.56456 },
          { lat: 34.04691, lng: -118.56568 },
          { lat: 34.04593, lng: -118.56631 },
          { lat: 34.04464, lng: -118.56678 },
          { lat: 34.04364, lng: -118.56694 },
          { lat: 34.04387, lng: -118.56642 },
          { lat: 34.0438, lng: -118.56611 },
          { lat: 34.04339, lng: -118.56646 },
          { lat: 34.04264, lng: -118.5672 },
          { lat: 34.04205, lng: -118.56765 },
          { lat: 34.04136, lng: -118.56543 },
          { lat: 34.04114, lng: -118.56351 },
          { lat: 34.04013, lng: -118.56088 },
          { lat: 34.03913, lng: -118.55842 },
        ],
        durationMinutes: 4,
        roadName: 'Sunset Blvd',
      },
      {
        path: [
          { lat: 34.03913, lng: -118.55842 },
          { lat: 34.03857, lng: -118.55689 },
          { lat: 34.03854, lng: -118.55654 },
          { lat: 34.03881, lng: -118.55541 },
          { lat: 34.03881, lng: -118.55541 },
          { lat: 34.03867, lng: -118.55651 },
          { lat: 34.03912, lng: -118.55794 },
          { lat: 34.04068, lng: -118.56224 },
          { lat: 34.04132, lng: -118.56386 },
          { lat: 34.0417, lng: -118.5666 },
          { lat: 34.04205, lng: -118.56907 },
          { lat: 34.04209, lng: -118.5699 },
          { lat: 34.04195, lng: -118.57165 },
          { lat: 34.04129, lng: -118.57353 },
          { lat: 34.04017, lng: -118.57548 },
          { lat: 34.04002, lng: -118.57615 },
          { lat: 34.04016, lng: -118.57844 },
          { lat: 34.0401, lng: -118.57949 },
          { lat: 34.04001, lng: -118.58021 },
          { lat: 34.03911, lng: -118.58331 },
          { lat: 34.03877, lng: -118.58476 },
          { lat: 34.03932, lng: -118.58773 },
          { lat: 34.03952, lng: -118.58979 },
          { lat: 34.03996, lng: -118.59256 },
          { lat: 34.03991, lng: -118.59325 },
          { lat: 34.03996, lng: -118.59533 },
          { lat: 34.03959, lng: -118.5969 },
          { lat: 34.03938, lng: -118.60113 },
          { lat: 34.03945, lng: -118.60322 },
          { lat: 34.03854, lng: -118.60634 },
        ],
        durationMinutes: 11,
        roadName: 'PCH north',
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
