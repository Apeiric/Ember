/**
 * EMBER — geometry kernel.
 * OWNER: JUDGE
 *
 * Pure functions. Zero dependencies. Zero I/O. Fully unit-testable.
 * Everything the judge needs to reason about "is this road inside that fire"
 * lives here, so `judge.ts` stays readable and deterministic.
 *
 * Coordinate strategy: for the sub-50km distances we care about, we project to
 * a local flat plane ("cheap ruler") around a reference latitude. Accurate to
 * well under 1% at neighbourhood scale and ~100x faster than spherical math in
 * the inner scoring loop. True haversine is used for anything user-facing.
 */

import { EARTH_RADIUS_KM, COMPASS_POINTS } from '@ember/shared';
import type { BBox, CompassDirection, LatLng, Polygon } from '@ember/shared';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export const toRad = (deg: number): number => deg * DEG;
export const toDeg = (rad: number): number => rad * RAD;

/** Normalize any bearing into [0, 360). */
export function normalizeBearing(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOCAL PLANAR PROJECTION ("cheap ruler")
// ═══════════════════════════════════════════════════════════════════════════

export interface Ruler {
  /** km per degree of longitude at the reference latitude. */
  kx: number;
  /** km per degree of latitude. */
  ky: number;
}

export function rulerAt(lat: number): Ruler {
  const cos = Math.cos(lat * DEG);
  return { kx: 111.32 * cos, ky: 110.574 };
}

export interface XY {
  x: number;
  y: number;
}

/** Project to local km-space relative to `origin`. */
export function project(p: LatLng, origin: LatLng, ruler: Ruler): XY {
  return { x: (p.lng - origin.lng) * ruler.kx, y: (p.lat - origin.lat) * ruler.ky };
}

// ═══════════════════════════════════════════════════════════════════════════
// DISTANCE & BEARING
// ═══════════════════════════════════════════════════════════════════════════

/** Great-circle distance in km. Use for anything shown to a human. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const lat1 = a.lat * DEG;
  const lat2 = b.lat * DEG;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial bearing from `a` to `b`, degrees clockwise from north. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const lat1 = a.lat * DEG;
  const lat2 = b.lat * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return normalizeBearing(Math.atan2(y, x) * RAD);
}

/** Travel `km` from `origin` along `bearing`. */
export function destination(origin: LatLng, bearing: number, km: number): LatLng {
  const d = km / EARTH_RADIUS_KM;
  const brg = bearing * DEG;
  const lat1 = origin.lat * DEG;
  const lng1 = origin.lng * DEG;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brg),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brg) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return { lat: lat2 * RAD, lng: ((lng2 * RAD + 540) % 360) - 180 };
}

/** Snap a bearing to one of 8 compass points. Drives "head WEST". */
export function compassFromBearing(deg: number): CompassDirection {
  const idx = Math.round(normalizeBearing(deg) / 45) % 8;
  return COMPASS_POINTS[idx]!;
}

// ═══════════════════════════════════════════════════════════════════════════
// POLYGON PREDICATES
// ═══════════════════════════════════════════════════════════════════════════

/** Ray-casting point-in-polygon. Handles unclosed rings. */
export function pointInPolygon(p: LatLng, poly: Polygon): boolean {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const pi = poly[i]!;
    const pj = poly[j]!;
    const intersects =
      pi.lat > p.lat !== pj.lat > p.lat &&
      p.lng < ((pj.lng - pi.lng) * (p.lat - pi.lat)) / (pj.lat - pi.lat) + pi.lng;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Perpendicular distance in km from `p` to segment `a`→`b`. */
export function distanceToSegmentKm(p: LatLng, a: LatLng, b: LatLng): number {
  const ruler = rulerAt(p.lat);
  const P = project(p, a, ruler);
  const B = project(b, a, ruler);
  const lenSq = B.x * B.x + B.y * B.y;
  if (lenSq === 0) return Math.hypot(P.x, P.y);
  let t = (P.x * B.x + P.y * B.y) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(P.x - t * B.x, P.y - t * B.y);
}

/** Shortest distance in km from `p` to the polygon boundary. */
export function distanceToBoundaryKm(p: LatLng, poly: Polygon): number {
  if (poly.length < 2) return poly.length === 1 ? haversineKm(p, poly[0]!) : Infinity;
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const d = distanceToSegmentKm(p, poly[j]!, poly[i]!);
    if (d < min) min = d;
  }
  return min;
}

/**
 * Signed distance to a polygon in km. Negative inside, positive outside.
 * This is what gives the danger field a soft shoulder instead of a hard cliff —
 * standing 50m from a fire front is not "safe" just because you are outside the
 * drawn line.
 */
export function signedDistanceKm(p: LatLng, poly: Polygon): number {
  const d = distanceToBoundaryKm(p, poly);
  return pointInPolygon(p, poly) ? -d : d;
}

/** Do segments a→b and c→d cross? */
export function segmentsIntersect(a: LatLng, b: LatLng, c: LatLng, d: LatLng): boolean {
  const cross = (o: LatLng, p: LatLng, q: LatLng) =>
    (p.lng - o.lng) * (q.lat - o.lat) - (p.lat - o.lat) * (q.lng - o.lng);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0) !== (d2 > 0) || d1 === 0 || d2 === 0) &&
    ((d3 > 0) !== (d4 > 0) || d3 === 0 || d4 === 0) &&
    !(d1 === 0 && d2 === 0 && d3 === 0 && d4 === 0);
}

/** Does segment a→b enter, exit, or sit inside the polygon? */
export function segmentIntersectsPolygon(a: LatLng, b: LatLng, poly: Polygon): boolean {
  if (pointInPolygon(a, poly) || pointInPolygon(b, poly)) return true;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (segmentsIntersect(a, b, poly[j]!, poly[i]!)) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// POLYGON CONSTRUCTION
// ═══════════════════════════════════════════════════════════════════════════

export function centroid(poly: Polygon): LatLng {
  if (poly.length === 0) return { lat: 0, lng: 0 };
  let lat = 0;
  let lng = 0;
  for (const p of poly) {
    lat += p.lat;
    lng += p.lng;
  }
  return { lat: lat / poly.length, lng: lng / poly.length };
}

export function bbox(poly: Polygon): BBox {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of poly) {
    if (p.lng < w) w = p.lng;
    if (p.lng > e) e = p.lng;
    if (p.lat < s) s = p.lat;
    if (p.lat > n) n = p.lat;
  }
  return [w, s, e, n];
}

/** Andrew's monotone chain convex hull. Returns counter-clockwise ring. */
export function convexHull(points: LatLng[]): Polygon {
  if (points.length < 3) return [...points];
  const pts = [...points].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);

  const build = (src: LatLng[]): LatLng[] => {
    const out: LatLng[] = [];
    for (const p of src) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= 0) {
        out.pop();
      }
      out.push(p);
    }
    out.pop();
    return out;
  };

  return [...build(pts), ...build(pts.reverse())];
}

/**
 * THE PROJECTION PRIMITIVE.
 *
 * Sweep a polygon `km` in the direction `bearing` and take the convex hull of
 * the start and end shapes — the region the hazard could plausibly occupy after
 * travelling that far downwind.
 *
 * Convex hull deliberately OVER-approximates: it fills in concavities the fire
 * might not actually reach. That is the correct direction to be wrong in.
 * A false "dangerous" costs a detour; a false "safe" costs a life.
 */
export function sweepPolygon(poly: Polygon, bearing: number, km: number): Polygon {
  if (poly.length === 0) return [];
  if (km <= 0) return [...poly];
  const translated = poly.map((p) => destination(p, bearing, km));
  return convexHull([...poly, ...translated]);
}

/**
 * Dilate a polygon outward by `km` in all directions (approximate Minkowski sum
 * with a disc, sampled at 8 compass points, then hulled). Used to add the
 * "you cannot stand right next to a fire front" shoulder.
 */
export function bufferPolygon(poly: Polygon, km: number): Polygon {
  if (poly.length === 0) return [];
  if (km <= 0) return [...poly];
  const out: LatLng[] = [];
  for (let b = 0; b < 360; b += 45) {
    for (const p of poly) out.push(destination(p, b, km));
  }
  return convexHull(out);
}

// ═══════════════════════════════════════════════════════════════════════════
// PATHS
// ═══════════════════════════════════════════════════════════════════════════

export function pathLengthKm(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += haversineKm(path[i - 1]!, path[i]!);
  return total;
}

export interface SampledPoint {
  point: LatLng;
  /** Distance from the start of the path, km. */
  distanceKm: number;
}

/**
 * Walk a path and emit a point roughly every `stepKm`, carrying the running
 * distance. The judge turns `distanceKm` into "minutes into the trip", which is
 * what makes the scoring time-aware rather than a snapshot.
 */
export function resamplePath(path: LatLng[], stepKm: number): SampledPoint[] {
  if (path.length === 0) return [];
  if (path.length === 1) return [{ point: path[0]!, distanceKm: 0 }];

  const out: SampledPoint[] = [{ point: path[0]!, distanceKm: 0 }];
  let travelled = 0;
  let carry = 0;

  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const segKm = haversineKm(a, b);
    if (segKm === 0) continue;
    const brg = bearingDeg(a, b);

    let offset = stepKm - carry;
    while (offset < segKm) {
      out.push({ point: destination(a, brg, offset), distanceKm: travelled + offset });
      offset += stepKm;
    }
    carry = (carry + segKm) % stepKm;
    travelled += segKm;
  }

  const last = path[path.length - 1]!;
  if (out[out.length - 1]!.distanceKm < travelled - 1e-9) {
    out.push({ point: last, distanceKm: travelled });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// GOOGLE ENCODED POLYLINE
// ═══════════════════════════════════════════════════════════════════════════

/** Decode Google's encoded polyline format into points. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// ═══════════════════════════════════════════════════════════════════════════
// GEOJSON INTEROP — the map speaks GeoJSON; we speak LatLng.
// ═══════════════════════════════════════════════════════════════════════════

/** GeoJSON uses [lng, lat]. Getting this backwards is the classic mapping bug. */
export function toGeoJsonRing(poly: Polygon): [number, number][] {
  const ring = poly.map((p): [number, number] => [p.lng, p.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);
  return ring;
}

export function fromGeoJsonRing(ring: [number, number][] | number[][]): Polygon {
  return ring.map((c) => ({ lng: Number(c[0]), lat: Number(c[1]) }));
}
