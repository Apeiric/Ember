/**
 * EMBER — CANNED SCENARIO: Camp Fire, Paradise CA, 8 November 2018.
 * OWNER: FRONTEND (demo) + DATA (accuracy)
 *
 * ⚠️  Illustrative reconstruction, not an official perimeter. Same honesty rules
 * as `palisades-2025.ts` — read the statement at the top of that file.
 *
 * WHY THIS SCENARIO EXISTS:
 * The Camp Fire is the proof that this problem is real and lethal. Eighty-five
 * people died; a large number of them died in their cars, on roads, during the
 * evacuation itself — not in their homes. Paradise sat on a ridge with a small
 * number of outbound roads, the fire arrived from the northeast at extraordinary
 * speed, and the evacuation funnelled onto exactly the roads it was reaching.
 *
 * Use Palisades for the live demo (recent, recognisable). Keep this one loaded
 * for the "this is not hypothetical" beat in the pitch — swap the scenario and
 * the same engine produces the same kind of verdict on a different fire, which
 * also demonstrates that nothing is hardcoded to one dataset.
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

const FETCHED_AT = '2018-11-08T15:00:00.000Z';

const canned = (note: string): Provenance => ({
  source: 'canned',
  provider: 'canned:camp-2018',
  fetchedAt: FETCHED_AT,
  note,
});

/** Fire front northeast of Paradise, running down out of the Feather River canyon. */
const PERIMETER: LatLng[] = [
  { lat: 39.812, lng: -121.556 },
  { lat: 39.806, lng: -121.524 },
  { lat: 39.79, lng: -121.514 },
  { lat: 39.782, lng: -121.545 },
  { lat: 39.784, lng: -121.578 },
  { lat: 39.8, lng: -121.582 },
];

export const CAMP_HAZARD: Hazard = {
  id: 'camp-2018',
  kind: 'wildfire',
  name: 'Camp Fire',
  perimeter: [PERIMETER],
  hotspots: [
    { location: { lat: 39.7995, lng: -121.5405 }, confidence: 0.98, brightnessK: 433, detectedAt: FETCHED_AT },
    { location: { lat: 39.7922, lng: -121.5601 }, confidence: 0.94, brightnessK: 401, detectedAt: FETCHED_AT },
    { location: { lat: 39.7961, lng: -121.5268 }, confidence: 0.88, brightnessK: 377, detectedAt: FETCHED_AT },
  ],
  wind: {
    // Jarbo Gap northeast wind event. Extreme downslope flow into Paradise.
    speedKph: 55,
    gustKph: 80,
    fromDeg: 45,
    toDeg: 225,
    observedAt: FETCHED_AT,
    station: 'Jarbo Gap RAWS (reconstructed)',
  },
  discoveredAt: '2018-11-08T14:30:00.000Z',
  acres: 5400,
  containmentPct: 0,
  provenance: {
    perimeter: canned('Illustrative reconstruction of the Camp Fire front, morning of 8 Nov 2018.'),
    hotspots: canned('Representative hotspots along the advancing northeast front.'),
    wind: canned('Jarbo Gap northeast downslope wind event.'),
  },
};

export const CAMP_DEMO_ADDRESS = 'Pentz Road, Paradise, CA 95969';
export const CAMP_ORIGIN: LatLng = { lat: 39.7625, lng: -121.586 };

export const CAMP_GEOCODES: Record<string, { formattedAddress: string; location: LatLng }> = {
  'pentz road, paradise, ca 95969': {
    formattedAddress: 'Pentz Rd, Paradise, CA 95969, USA',
    location: CAMP_ORIGIN,
  },
  'pentz road': { formattedAddress: 'Pentz Rd, Paradise, CA 95969, USA', location: CAMP_ORIGIN },
  paradise: {
    formattedAddress: 'Paradise, CA 95969, USA',
    location: { lat: 39.7596, lng: -121.6219 },
  },
};

export const CAMP_GROUND: GroundContext = {
  elevationM: 533,
  slopePct: 6.2,
  aspectDeg: 230,
  terrain: 'Forested ridge town, heavy timber and dense wildland-urban interface.',
  // Paradise had a handful of outbound roads for ~26,000 people. The evacuation
  // itself became the hazard.
  exitCount: 3,
  exits: [
    { name: 'Skyway (southwest to Chico)', bearingDeg: 232, direction: 'SW', kind: 'arterial' },
    { name: 'Clark Road / CA-191 (south to Oroville)', bearingDeg: 183, direction: 'S', kind: 'arterial' },
    { name: 'Pentz Road (north)', bearingDeg: 4, direction: 'N', kind: 'residential' },
  ],
  provenance: canned('Ridge terrain and the small set of outbound roads serving Paradise.'),
};

const routeProvenance = canned('Canned route geometry approximating Google Directions alternatives.');

export const CAMP_ROUTES: Route[] = [
  // ── FASTEST on paper: north on Pentz, west on Skyway to Chico. ───────────
  // Going north on Pentz drives straight at the advancing front.
  buildRoute({
    id: 'camp-route-skyway',
    summary: 'Pentz Rd north → Skyway southwest → Chico',
    legs: [
      {
        path: [
          { lat: 39.7625, lng: -121.586 },
          { lat: 39.7705, lng: -121.5845 },
          { lat: 39.78, lng: -121.583 },
        ],
        durationMinutes: 5,
      },
      {
        path: [
          { lat: 39.78, lng: -121.583 },
          { lat: 39.7705, lng: -121.62 },
          { lat: 39.757, lng: -121.665 },
          { lat: 39.745, lng: -121.73 },
          { lat: 39.7285, lng: -121.8375 },
        ],
        durationMinutes: 18,
      },
    ],
    destination: {
      id: 'dest-chico',
      name: 'Chico',
      location: { lat: 39.7285, lng: -121.8375 },
      kind: 'city',
    },
    provenance: routeProvenance,
  }),

  // ── South on Pentz, then Clark Rd / CA-191 to Oroville. Away from the front. ──
  buildRoute({
    id: 'camp-route-oroville',
    summary: 'Pentz Rd south → Clark Rd / CA-191 → Oroville',
    legs: [
      {
        path: [
          { lat: 39.7625, lng: -121.586 },
          { lat: 39.75, lng: -121.588 },
          { lat: 39.735, lng: -121.59 },
        ],
        durationMinutes: 6,
      },
      {
        path: [
          { lat: 39.735, lng: -121.59 },
          { lat: 39.7, lng: -121.588 },
          { lat: 39.65, lng: -121.58 },
          { lat: 39.58, lng: -121.567 },
          { lat: 39.5138, lng: -121.5564 },
        ],
        durationMinutes: 22,
      },
    ],
    destination: {
      id: 'dest-oroville',
      name: 'Oroville',
      location: { lat: 39.5138, lng: -121.5564 },
      kind: 'city',
    },
    provenance: routeProvenance,
  }),
];

export const CAMP_SUMMARY: ScenarioSummary = {
  id: 'camp-2018',
  name: 'Camp Fire',
  region: 'Paradise, Butte County, CA',
  date: '2018-11-08',
  demoAddress: CAMP_DEMO_ADDRESS,
  headline:
    'A northeast wind event pushes the front into a ridge town with a handful of roads out. ' +
    'Eighty-five people died; many of them on the road.',
  center: { lat: 39.775, lng: -121.55 },
};
