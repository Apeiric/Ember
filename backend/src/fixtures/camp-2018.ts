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
          { lat: 39.76238, lng: -121.586 },
          { lat: 39.76233, lng: -121.58693 },
          { lat: 39.76233, lng: -121.58715 },
          { lat: 39.76232, lng: -121.58788 },
          { lat: 39.76232, lng: -121.58849 },
          { lat: 39.76244, lng: -121.58898 },
          { lat: 39.76269, lng: -121.58899 },
          { lat: 39.76321, lng: -121.589 },
          { lat: 39.76494, lng: -121.58898 },
          { lat: 39.76688, lng: -121.58896 },
          { lat: 39.76776, lng: -121.58897 },
          { lat: 39.77017, lng: -121.58896 },
          { lat: 39.77046, lng: -121.58878 },
          { lat: 39.77046, lng: -121.58808 },
          { lat: 39.77078, lng: -121.58721 },
          { lat: 39.77348, lng: -121.58715 },
          { lat: 39.77431, lng: -121.58711 },
          { lat: 39.77437, lng: -121.58707 },
          { lat: 39.77478, lng: -121.58664 },
          { lat: 39.77521, lng: -121.58653 },
          { lat: 39.77557, lng: -121.58655 },
          { lat: 39.77682, lng: -121.58656 },
          { lat: 39.77775, lng: -121.58655 },
          { lat: 39.77775, lng: -121.58561 },
          { lat: 39.77775, lng: -121.58521 },
          { lat: 39.77776, lng: -121.58293 },
          { lat: 39.77777, lng: -121.58197 },
          { lat: 39.77847, lng: -121.58195 },
          { lat: 39.77866, lng: -121.58195 },
          { lat: 39.78022, lng: -121.58256 },
        ],
        durationMinutes: 5,
        roadName: 'Pentz Rd',
      },
      {
        path: [
          { lat: 39.78022, lng: -121.58256 },
          { lat: 39.77772, lng: -121.59398 },
          { lat: 39.76926, lng: -121.61261 },
          { lat: 39.76115, lng: -121.62288 },
          { lat: 39.75515, lng: -121.63217 },
          { lat: 39.75062, lng: -121.63824 },
          { lat: 39.74918, lng: -121.6448 },
          { lat: 39.74796, lng: -121.64858 },
          { lat: 39.74784, lng: -121.65194 },
          { lat: 39.74787, lng: -121.65394 },
          { lat: 39.74783, lng: -121.65702 },
          { lat: 39.74569, lng: -121.66125 },
          { lat: 39.74666, lng: -121.66408 },
          { lat: 39.74744, lng: -121.66619 },
          { lat: 39.74752, lng: -121.66913 },
          { lat: 39.74719, lng: -121.6714 },
          { lat: 39.74709, lng: -121.67151 },
          { lat: 39.74115, lng: -121.67736 },
          { lat: 39.73669, lng: -121.68451 },
          { lat: 39.73279, lng: -121.69524 },
          { lat: 39.72904, lng: -121.70403 },
          { lat: 39.72121, lng: -121.71339 },
          { lat: 39.71437, lng: -121.72638 },
          { lat: 39.71356, lng: -121.74031 },
          { lat: 39.70803, lng: -121.75912 },
          { lat: 39.71158, lng: -121.77442 },
          { lat: 39.71457, lng: -121.78947 },
          { lat: 39.72014, lng: -121.80461 },
          { lat: 39.73697, lng: -121.81976 },
          { lat: 39.72856, lng: -121.83758 },
        ],
        durationMinutes: 18,
        roadName: 'Skyway',
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
          { lat: 39.76238, lng: -121.586 },
          { lat: 39.76233, lng: -121.58693 },
          { lat: 39.76233, lng: -121.58715 },
          { lat: 39.76232, lng: -121.58788 },
          { lat: 39.76232, lng: -121.58849 },
          { lat: 39.76208, lng: -121.58899 },
          { lat: 39.76196, lng: -121.58898 },
          { lat: 39.76112, lng: -121.58901 },
          { lat: 39.75823, lng: -121.58903 },
          { lat: 39.75496, lng: -121.58903 },
          { lat: 39.75255, lng: -121.58904 },
          { lat: 39.74891, lng: -121.58904 },
          { lat: 39.74861, lng: -121.5895 },
          { lat: 39.74861, lng: -121.58996 },
          { lat: 39.74863, lng: -121.59295 },
          { lat: 39.74812, lng: -121.59377 },
          { lat: 39.74585, lng: -121.59379 },
          { lat: 39.74493, lng: -121.59382 },
          { lat: 39.74418, lng: -121.59379 },
          { lat: 39.74345, lng: -121.59378 },
          { lat: 39.74233, lng: -121.59379 },
          { lat: 39.74061, lng: -121.5938 },
          { lat: 39.73836, lng: -121.59377 },
          { lat: 39.73787, lng: -121.59377 },
          { lat: 39.73783, lng: -121.59379 },
          { lat: 39.73775, lng: -121.59287 },
          { lat: 39.73774, lng: -121.59193 },
          { lat: 39.73533, lng: -121.59199 },
          { lat: 39.73527, lng: -121.5919 },
          { lat: 39.73504, lng: -121.59153 },
        ],
        durationMinutes: 6,
        roadName: 'Pentz Rd',
      },
      {
        path: [
          { lat: 39.73504, lng: -121.59153 },
          { lat: 39.73909, lng: -121.59381 },
          { lat: 39.74971, lng: -121.59375 },
          { lat: 39.75226, lng: -121.60274 },
          { lat: 39.75226, lng: -121.60776 },
          { lat: 39.74018, lng: -121.609 },
          { lat: 39.73685, lng: -121.61287 },
          { lat: 39.72606, lng: -121.61194 },
          { lat: 39.71974, lng: -121.6112 },
          { lat: 39.7145, lng: -121.61152 },
          { lat: 39.70825, lng: -121.61142 },
          { lat: 39.70302, lng: -121.61013 },
          { lat: 39.69604, lng: -121.61415 },
          { lat: 39.69023, lng: -121.62015 },
          { lat: 39.68168, lng: -121.62661 },
          { lat: 39.66505, lng: -121.62786 },
          { lat: 39.64962, lng: -121.63378 },
          { lat: 39.63926, lng: -121.63733 },
          { lat: 39.62439, lng: -121.63598 },
          { lat: 39.61738, lng: -121.62583 },
          { lat: 39.6037, lng: -121.62034 },
          { lat: 39.60059, lng: -121.61954 },
          { lat: 39.5931, lng: -121.62049 },
          { lat: 39.5837, lng: -121.62175 },
          { lat: 39.58002, lng: -121.62164 },
          { lat: 39.56621, lng: -121.60928 },
          { lat: 39.5246, lng: -121.57371 },
          { lat: 39.51169, lng: -121.57259 },
          { lat: 39.5079, lng: -121.57397 },
          { lat: 39.51378, lng: -121.55639 },
        ],
        durationMinutes: 22,
        roadName: 'Clark Rd / CA-191',
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
