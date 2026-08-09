/**
 * EMBER — the map.
 * OWNER: FRONTEND
 *
 * Mapbox GL, dark basemap, five layers:
 *
 *   1. Fire perimeter        solid red      where it is burning now
 *   2. Projection rings      orange, faded  where it is going
 *   3. Rejected routes       RED, dashed    what your phone would tell you
 *   4. Recommended route     GREEN, thick   what we tell you
 *   5. Your house            white dot
 *
 * The colour language is the pitch: red is the route that kills you, green is
 * the one that doesn't. Do not repurpose either colour for anything else.
 *
 * NO TOKEN? We render `MapFallback` instead — a token-free SVG schematic that
 * shows the same five things. The demo never degrades to a grey rectangle.
 *
 * NEXT STEP (post-scaffold, CONTEXT.md §8): swap this for Cesium + Google
 * Photorealistic 3D Tiles for the "camera flies into the neighbourhood" beat.
 * The props below do not need to change — it is the same data either way.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { AssessResponse, LatLng, Polygon } from '@ember/shared';
import { ROUTE_COLORS } from '../lib/format';
import { MapFallback } from './MapFallback';

// Accept either name — the shared .env uses MAPBOX_PUBLIC_TOKEN.
// ⚠️ PUBLIC (pk.*) tokens only. Every VITE_-prefixed var is compiled into the
// public JS bundle, so an sk.* secret token here would be published to anyone
// who opens devtools.
const TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ??
  import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN) as string | undefined;
const STYLE = import.meta.env.VITE_MAPBOX_STYLE ?? 'mapbox://styles/mapbox/dark-v11';

const SRC = {
  perimeter: 'ember-perimeter',
  projection: 'ember-projection',
  routes: 'ember-routes',
  origin: 'ember-origin',
} as const;

export function MapView({ data }: { data: AssessResponse | null }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  // ── Initialise once ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!TOKEN || !container.current || map.current) return;

    try {
      mapboxgl.accessToken = TOKEN;
      const instance = new mapboxgl.Map({
        container: container.current,
        style: STYLE,
        center: [-118.5265, 34.0464],
        zoom: 11,
        attributionControl: false,
        // The demo is a fixed camera move; spinning the globe is a distraction.
        dragRotate: false,
      });

      instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      instance.on('load', () => {
        installLayers(instance);
        setReady(true);
      });
      // A bad token fails here rather than throwing at construction.
      instance.on('error', (e) => {
        const message = e.error?.message ?? 'Mapbox failed to load';
        if (/token|401|403/i.test(message)) setFailed(message);
      });

      map.current = instance;
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Mapbox failed to initialise');
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // ── Push data on every new assessment ───────────────────────────────────
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !data) return;

    setSource(instance, SRC.perimeter, {
      type: 'FeatureCollection',
      features: data.hazard.perimeter.map((poly) => polygonFeature(poly, {})),
    });

    setSource(instance, SRC.projection, {
      type: 'FeatureCollection',
      features: data.field.zones
        .filter((z) => z.arrivesInMinutes > 0 && z.polygon.length >= 3)
        .map((z) =>
          polygonFeature(z.polygon, {
            minutes: z.arrivesInMinutes,
            // Nearer-in-time rings render more strongly.
            opacity: Math.max(0.04, 0.22 - z.arrivesInMinutes / 600),
          }),
        ),
    });

    setSource(instance, SRC.routes, {
      type: 'FeatureCollection',
      features: data.routes.map((scored) => {
        const isRecommended = scored.route.id === data.recommended?.route.id;
        const rejected = scored.rating === 'REJECTED';
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: scored.route.path.map((p): [number, number] => [p.lng, p.lat]),
          },
          properties: {
            color: isRecommended
              ? ROUTE_COLORS.recommended
              : rejected
                ? ROUTE_COLORS.naive
                : ROUTE_COLORS.other,
            width: isRecommended ? 6 : rejected ? 4 : 2.5,
            opacity: isRecommended || rejected ? 1 : 0.4,
            dash: rejected ? 1 : 0,
          },
        };
      }),
    });

    setSource(instance, SRC.origin, {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [data.origin.location.lng, data.origin.location.lat] },
          properties: {},
        },
      ],
    });

    // Frame everything: house, fire, and every route.
    const points: LatLng[] = [
      data.origin.location,
      ...data.hazard.perimeter.flat(),
      ...data.routes.flatMap((r) => r.route.path),
    ];
    if (points.length > 0) {
      const bounds = points.reduce(
        (b, p) => b.extend([p.lng, p.lat]),
        new mapboxgl.LngLatBounds(
          [points[0]!.lng, points[0]!.lat],
          [points[0]!.lng, points[0]!.lat],
        ),
      );
      instance.fitBounds(bounds, { padding: 70, duration: 1400, maxZoom: 14 });
    }
  }, [data, ready]);

  // ── No token, or Mapbox refused it → schematic map, never a blank box ────
  if (!TOKEN || failed) {
    if (!data) return <MapPlaceholder />;
    return (
      <MapFallback
        data={data}
        reason={
          failed
            ? 'Mapbox rejected the token, so Ember fell back to a token-free renderer.'
            : 'No VITE_MAPBOX_TOKEN set — add one in frontend/.env.local for satellite basemaps.'
        }
      />
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={container} className="h-full w-full" />
      {!data && <MapPlaceholder overlay />}
    </div>
  );
}

function MapPlaceholder({ overlay = false }: { overlay?: boolean }) {
  return (
    <div
      className={`flex h-full w-full items-center justify-center bg-ash-950 ${
        overlay ? 'pointer-events-none absolute inset-0 bg-ash-950/60' : ''
      }`}
    >
      <div className="max-w-xs px-6 text-center">
        <div className="mx-auto mb-3 h-10 w-10 rounded-full border-2 border-dashed border-ash-700" />
        <p className="text-sm text-ash-400">Enter an address to see the fire, the routes,</p>
        <p className="text-sm text-ash-400">and the way out.</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LAYER SETUP
// ═══════════════════════════════════════════════════════════════════════════

function installLayers(map: mapboxgl.Map) {
  const empty = { type: 'FeatureCollection' as const, features: [] };
  for (const id of Object.values(SRC)) {
    map.addSource(id, { type: 'geojson', data: empty });
  }

  // Projection rings sit UNDER the perimeter so the active fire stays readable.
  map.addLayer({
    id: 'projection-fill',
    type: 'fill',
    source: SRC.projection,
    paint: { 'fill-color': ROUTE_COLORS.projection, 'fill-opacity': ['get', 'opacity'] },
  });
  map.addLayer({
    id: 'projection-line',
    type: 'line',
    source: SRC.projection,
    paint: {
      'line-color': ROUTE_COLORS.projection,
      'line-width': 1,
      'line-opacity': 0.4,
      'line-dasharray': [3, 3],
    },
  });

  map.addLayer({
    id: 'perimeter-fill',
    type: 'fill',
    source: SRC.perimeter,
    paint: { 'fill-color': ROUTE_COLORS.perimeter, 'fill-opacity': 0.35 },
  });
  map.addLayer({
    id: 'perimeter-line',
    type: 'line',
    source: SRC.perimeter,
    paint: { 'line-color': ROUTE_COLORS.perimeter, 'line-width': 2.5 },
  });

  // Soft halo under every route so lines stay legible over bright terrain.
  map.addLayer({
    id: 'routes-halo',
    type: 'line',
    source: SRC.routes,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['*', ['get', 'width'], 2.6],
      'line-opacity': 0.16,
    },
  });
  map.addLayer({
    id: 'routes-line',
    type: 'line',
    source: SRC.routes,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['get', 'width'],
      'line-opacity': ['get', 'opacity'],
    },
  });

  map.addLayer({
    id: 'origin-halo',
    type: 'circle',
    source: SRC.origin,
    paint: { 'circle-radius': 16, 'circle-color': '#ffffff', 'circle-opacity': 0.14 },
  });
  map.addLayer({
    id: 'origin-dot',
    type: 'circle',
    source: SRC.origin,
    paint: {
      'circle-radius': 7,
      'circle-color': '#ffffff',
      'circle-stroke-color': '#08090c',
      'circle-stroke-width': 2.5,
    },
  });
}

function setSource(map: mapboxgl.Map, id: string, data: GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as mapboxgl.GeoJSONSource | undefined;
  source?.setData(data);
}

function polygonFeature(
  poly: Polygon,
  properties: Record<string, unknown>,
): GeoJSON.Feature<GeoJSON.Polygon> {
  const ring = poly.map((p): [number, number] => [p.lng, p.lat]);
  // GeoJSON polygons must be explicitly closed or Mapbox renders nothing.
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push(first);

  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [ring] },
    properties,
  };
}
