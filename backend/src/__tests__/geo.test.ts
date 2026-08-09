/**
 * EMBER — geometry kernel tests.
 * OWNER: JUDGE
 *
 * The judge is only as trustworthy as this file. Every scoring decision reduces
 * to "is this point inside that polygon" and "how far apart are these two things".
 */

import { describe, expect, it } from 'vitest';
import {
  bearingDeg,
  compassFromBearing,
  convexHull,
  decodePolyline,
  destination,
  distanceToBoundaryKm,
  haversineKm,
  pointInPolygon,
  resamplePath,
  segmentIntersectsPolygon,
  signedDistanceKm,
  sweepPolygon,
} from '../core/geo';
import type { LatLng, Polygon } from '@ember/shared';

const LAX: LatLng = { lat: 33.9416, lng: -118.4085 };
const SFO: LatLng = { lat: 37.6213, lng: -122.379 };

/** A 0.02° box (roughly 2.2 km tall) centred on the Palisades demo area. */
const BOX: Polygon = [
  { lat: 34.06, lng: -118.54 },
  { lat: 34.08, lng: -118.54 },
  { lat: 34.08, lng: -118.52 },
  { lat: 34.06, lng: -118.52 },
];

describe('haversineKm', () => {
  it('matches the known LAX→SFO great-circle distance', () => {
    // Published value is ~543 km.
    expect(haversineKm(LAX, SFO)).toBeGreaterThan(538);
    expect(haversineKm(LAX, SFO)).toBeLessThan(548);
  });

  it('is zero for identical points and symmetric', () => {
    expect(haversineKm(LAX, LAX)).toBe(0);
    expect(haversineKm(LAX, SFO)).toBeCloseTo(haversineKm(SFO, LAX), 6);
  });
});

describe('bearingDeg', () => {
  it('reports north-west for LAX→SFO', () => {
    const b = bearingDeg(LAX, SFO);
    expect(b).toBeGreaterThan(300);
    expect(b).toBeLessThan(340);
  });

  it('reports due east along a parallel', () => {
    expect(bearingDeg({ lat: 34, lng: -118 }, { lat: 34, lng: -117 })).toBeCloseTo(90, 0);
  });
});

describe('destination', () => {
  it('round-trips against haversineKm', () => {
    const moved = destination(LAX, 45, 12);
    expect(haversineKm(LAX, moved)).toBeCloseTo(12, 2);
    expect(bearingDeg(LAX, moved)).toBeCloseTo(45, 1);
  });
});

describe('compassFromBearing', () => {
  it('snaps to the nearest of eight points', () => {
    expect(compassFromBearing(0)).toBe('N');
    expect(compassFromBearing(359)).toBe('N');
    expect(compassFromBearing(90)).toBe('E');
    expect(compassFromBearing(181)).toBe('S');
    expect(compassFromBearing(225)).toBe('SW');
    expect(compassFromBearing(315)).toBe('NW');
  });
});

describe('pointInPolygon', () => {
  it('detects inside and outside', () => {
    expect(pointInPolygon({ lat: 34.07, lng: -118.53 }, BOX)).toBe(true);
    expect(pointInPolygon({ lat: 34.05, lng: -118.53 }, BOX)).toBe(false);
    expect(pointInPolygon({ lat: 34.07, lng: -118.5 }, BOX)).toBe(false);
  });

  it('never reports inside for a degenerate polygon', () => {
    expect(pointInPolygon({ lat: 34.07, lng: -118.53 }, [])).toBe(false);
    expect(pointInPolygon({ lat: 34.07, lng: -118.53 }, [BOX[0]!, BOX[1]!])).toBe(false);
  });
});

describe('signedDistanceKm', () => {
  it('is negative inside and positive outside', () => {
    expect(signedDistanceKm({ lat: 34.07, lng: -118.53 }, BOX)).toBeLessThan(0);
    expect(signedDistanceKm({ lat: 34.03, lng: -118.53 }, BOX)).toBeGreaterThan(0);
  });

  it('measures the gap to the boundary in kilometres', () => {
    // 0.01° of latitude ≈ 1.1 km south of the box's lower edge.
    const d = signedDistanceKm({ lat: 34.05, lng: -118.53 }, BOX);
    expect(d).toBeGreaterThan(0.9);
    expect(d).toBeLessThan(1.3);
  });
});

describe('distanceToBoundaryKm', () => {
  it('is small but non-zero for a point just inside the edge', () => {
    const d = distanceToBoundaryKm({ lat: 34.0605, lng: -118.53 }, BOX);
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(0.2);
  });
});

describe('segmentIntersectsPolygon', () => {
  it('detects a road crossing straight through', () => {
    const crosses = segmentIntersectsPolygon(
      { lat: 34.07, lng: -118.56 },
      { lat: 34.07, lng: -118.5 },
      BOX,
    );
    expect(crosses).toBe(true);
  });

  it('ignores a road that passes safely to the south', () => {
    const clears = segmentIntersectsPolygon(
      { lat: 34.03, lng: -118.56 },
      { lat: 34.03, lng: -118.5 },
      BOX,
    );
    expect(clears).toBe(false);
  });
});

describe('convexHull', () => {
  it('drops interior points', () => {
    const hull = convexHull([...BOX, { lat: 34.07, lng: -118.53 }]);
    expect(hull).toHaveLength(4);
  });
});

describe('sweepPolygon', () => {
  it('extends the shape downwind and keeps the original ground covered', () => {
    // Sweep 2 km toward the south-west, the Santa Ana direction.
    const swept = sweepPolygon(BOX, 225, 2);

    // Everything that was burning is still inside the projection.
    for (const p of BOX) {
      expect(pointInPolygon(p, swept) || distanceToBoundaryKm(p, swept) < 0.01).toBe(true);
    }

    // Ground 1 km south-west of the box is now covered; it was not before.
    const downwind = destination({ lat: 34.06, lng: -118.54 }, 225, 1);
    expect(pointInPolygon(downwind, BOX)).toBe(false);
    expect(pointInPolygon(downwind, swept)).toBe(true);
  });

  it('does not extend upwind', () => {
    const swept = sweepPolygon(BOX, 225, 2);
    // 1.5 km to the north-east — the fire is running away from here.
    const upwind = destination({ lat: 34.08, lng: -118.52 }, 45, 1.5);
    expect(pointInPolygon(upwind, swept)).toBe(false);
  });

  it('is a no-op for zero distance', () => {
    expect(sweepPolygon(BOX, 225, 0)).toEqual(BOX);
  });
});

describe('resamplePath', () => {
  it('emits evenly spaced points with monotonic cumulative distance', () => {
    const path = [
      { lat: 34.0, lng: -118.5 },
      { lat: 34.0, lng: -118.4 },
    ];
    const samples = resamplePath(path, 0.5);

    expect(samples.length).toBeGreaterThan(10);
    expect(samples[0]!.distanceKm).toBe(0);

    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]!.distanceKm).toBeGreaterThan(samples[i - 1]!.distanceKm);
    }

    const total = haversineKm(path[0]!, path[1]!);
    expect(samples[samples.length - 1]!.distanceKm).toBeCloseTo(total, 1);
  });

  it('handles degenerate paths without throwing', () => {
    expect(resamplePath([], 0.5)).toEqual([]);
    expect(resamplePath([{ lat: 1, lng: 1 }], 0.5)).toHaveLength(1);
  });
});

describe('decodePolyline', () => {
  it('decodes the canonical Google example', () => {
    const points = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
    expect(points).toHaveLength(3);
    expect(points[0]!.lat).toBeCloseTo(38.5, 5);
    expect(points[0]!.lng).toBeCloseTo(-120.2, 5);
    expect(points[2]!.lat).toBeCloseTo(43.252, 5);
    expect(points[2]!.lng).toBeCloseTo(-126.453, 5);
  });
});
