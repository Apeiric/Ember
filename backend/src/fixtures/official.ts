/**
 * EMBER — canned official data for the Palisades scenario.
 * OWNER: FRONTEND (demo) + DATA (accuracy)
 *
 * ⚠️ Illustrative reconstruction, not real agency records. Same honesty rules as
 * the other fixtures: the January 2025 Palisades Fire really did close PCH and
 * really did trigger mandatory evacuation orders across the Highlands, but these
 * exact polygons and closure IDs are ours, not Caltrans's or CAL FIRE's.
 *
 * Exists so the demo still shows official closures and evacuation orders with
 * no network — the same guarantee every other feed has.
 */

import type { EvacuationZone, RoadClosure } from '@ember/shared';

// Northbound PCH beyond the Sunset junction — the Topanga escape. Chained in
// segments that TRACE THE REAL ROAD (from the same Google geometry as the
// routes): a single straight from→to chord cuts the corner of the coast road
// and its 130 m block blobs miss the pavement entirely.
export const CANNED_CLOSURES: RoadClosure[] = [
  {
    id: 'canned-pch-topanga-0',
    road: 'SR-1',
    description: 'Pacific Coast Hwy at Topanga Canyon Blvd',
    from: { lat: 34.04195, lng: -118.57165 },
    to: { lat: 34.04016, lng: -118.57844 },
    reason: 'Fire activity adjacent to roadway',
    facility: 'Mainline',
    startsAt: '2025-01-08T01:40:00.000Z',
    endsAt: null,
    indefinite: true,
  },
  {
    id: 'canned-pch-topanga-1',
    road: 'SR-1',
    description: 'Pacific Coast Hwy at Topanga Canyon Blvd',
    from: { lat: 34.04016, lng: -118.57844 },
    to: { lat: 34.03877, lng: -118.58476 },
    reason: 'Fire activity adjacent to roadway',
    facility: 'Mainline',
    startsAt: '2025-01-08T01:40:00.000Z',
    endsAt: null,
    indefinite: true,
  },
  {
    id: 'canned-pch-topanga-2',
    road: 'SR-1',
    description: 'Pacific Coast Hwy at Topanga Canyon Blvd',
    from: { lat: 34.03877, lng: -118.58476 },
    to: { lat: 34.03991, lng: -118.59325 },
    reason: 'Fire activity adjacent to roadway',
    facility: 'Mainline',
    startsAt: '2025-01-08T01:40:00.000Z',
    endsAt: null,
    indefinite: true,
  },
  {
    id: 'canned-pch-topanga-3',
    road: 'SR-1',
    description: 'Pacific Coast Hwy at Topanga Canyon Blvd',
    from: { lat: 34.03991, lng: -118.59325 },
    to: { lat: 34.03945, lng: -118.60322 },
    reason: 'Fire activity adjacent to roadway',
    facility: 'Mainline',
    startsAt: '2025-01-08T01:40:00.000Z',
    endsAt: null,
    indefinite: true,
  },
  {
    id: 'canned-pch-topanga-4',
    road: 'SR-1',
    description: 'Pacific Coast Hwy at Topanga Canyon Blvd',
    from: { lat: 34.03945, lng: -118.60322 },
    to: { lat: 34.03854, lng: -118.60634 },
    reason: 'Fire activity adjacent to roadway',
    facility: 'Mainline',
    startsAt: '2025-01-08T01:40:00.000Z',
    endsAt: null,
    indefinite: true,
  },
];

export const CANNED_EVAC_ZONES: EvacuationZone[] = [
  {
    id: 'canned-zone-highlands',
    zoneId: 'PAC-1201',
    status: 'order',
    county: 'Los Angeles',
    city: 'Pacific Palisades',
    info: 'Mandatory evacuation order for the Palisades Highlands. Leave via Palisades Dr to Sunset Blvd.',
    // Covers the Highlands including the demo address.
    polygon: [
      { lat: 34.085, lng: -118.575 },
      { lat: 34.085, lng: -118.535 },
      { lat: 34.055, lng: -118.535 },
      { lat: 34.055, lng: -118.575 },
    ],
  },
  {
    id: 'canned-zone-village',
    zoneId: 'PAC-1204',
    status: 'warning',
    county: 'Los Angeles',
    city: 'Pacific Palisades',
    info: 'Evacuation warning for Pacific Palisades village and the coastal bluffs.',
    polygon: [
      { lat: 34.055, lng: -118.565 },
      { lat: 34.055, lng: -118.52 },
      { lat: 34.03, lng: -118.52 },
      { lat: 34.03, lng: -118.565 },
    ],
  },
];
