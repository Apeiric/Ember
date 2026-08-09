/**
 * EMBER — the map.
 * OWNER: FRONTEND
 *
 * Mapbox GL, dark basemap. The layers ARE the argument:
 *
 *   1. Fire perimeter        solid red          where it is burning now
 *   2. Satellite hotspots    glowing dots       the detections behind it
 *   3. Projection rings      orange, LABELLED   "fire here in ~30 min"
 *   4. Closed roads          dark red strokes   what officials shut
 *   5. Evac zone outlines    faint violet       the official order area
 *   6. Rejected routes       RED, dashed        what your phone would say
 *   7. Recommended route     GREEN, thick       what we say
 *   8. PINCH MARKERS         ✕ / ✓             the exact point the race is
 *                                               won or lost — the proof
 *   9. Your people           labelled pins      tap one to assess them
 *
 * The rings and the pinch markers exist because a rejection you can point at
 * is believable and an invisible one is not. The judge computes WHERE the fire
 * beats you; the map's job is to make that point impossible to miss.
 *
 * Red = the route that kills you. Green = the one that doesn't. Do not
 * repurpose either colour for anything else.
 *
 * NO TOKEN? We render `MapFallback` instead — a token-free SVG schematic.
 * The demo never degrades to a grey rectangle.
 */

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { AssessResponse, FamilyMember, LatLng, Polygon } from '@ember/shared';
import { ROUTE_COLORS } from '../lib/format';
import { MapFallback } from './MapFallback';

// Accept either name — the shared .env uses MAPBOX_PUBLIC_TOKEN.
// ⚠️ PUBLIC (pk.*) tokens only. Every VITE_-prefixed var is compiled into the
// public JS bundle, so an sk.* secret token here would be published to anyone
// who opens devtools.
const TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN ??
  import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN) as string | undefined;
const STYLE = import.meta.env.VITE_MAPBOX_STYLE ?? 'mapbox://styles/mapbox/dark-v11';

// Font stacks hosted by Mapbox for every mapbox:// style.
const FONT_BOLD = ['DIN Pro Bold', 'Arial Unicode MS Bold'];
const FONT_MED = ['DIN Pro Medium', 'Arial Unicode MS Regular'];

const SRC = {
  perimeter: 'ember-perimeter',
  projection: 'ember-projection',
  hotspots: 'ember-hotspots',
  closures: 'ember-closures',
  evac: 'ember-evac',
  routes: 'ember-routes',
  pinch: 'ember-pinch',
  destinations: 'ember-destinations',
  origin: 'ember-origin',
  members: 'ember-members',
} as const;

interface Props {
  data: AssessResponse | null;
  /** The household — rendered as labelled pins. Tap one to assess that person. */
  members?: FamilyMember[];
  activeId?: string | null;
  onSelectMember?: (id: string) => void;
}

export function MapView({ data, members = [], activeId = null, onSelectMember }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  // Keep the latest handler without re-registering map listeners.
  const selectRef = useRef(onSelectMember);
  selectRef.current = onSelectMember;

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
        // Bottom-LEFT would sit underneath the side rail and silently swallow
        // clicks meant for panel buttons (mapbox controls are z-index:2).
        logoPosition: 'bottom-right',
        // The demo is a fixed camera move; spinning the globe is a distraction.
        dragRotate: false,
      });

      instance.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
      instance.on('load', () => {
        installLayers(instance);

        // Tapping a person on the map = tapping them in the household list.
        instance.on('click', 'members-dot', (e) => {
          const id = e.features?.[0]?.properties?.memberId as string | undefined;
          if (id) selectRef.current?.(id);
        });
        instance.on('mouseenter', 'members-dot', () => {
          instance.getCanvas().style.cursor = 'pointer';
        });
        instance.on('mouseleave', 'members-dot', () => {
          instance.getCanvas().style.cursor = '';
        });

        setReady(true);
      });
      // A bad token fails here rather than throwing at construction.
      instance.on('error', (e) => {
        const message = e.error?.message ?? 'Mapbox failed to load';
        if (/token|401|403/i.test(message)) setFailed(message);
      });

      map.current = instance;
      // Dev-only handle so tests can project coordinates and drive clicks.
      if (import.meta.env.DEV) {
        (window as unknown as Record<string, unknown>).__emberMap = instance;
      }
    } catch (err) {
      setFailed(err instanceof Error ? err.message : 'Mapbox failed to initialise');
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // ── Your people: pins render even before the first assessment ───────────
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready) return;

    setSource(instance, SRC.members, {
      type: 'FeatureCollection',
      features: members
        .filter((m) => Math.abs(m.location.lat) > 0.01) // skip unplaced new people
        .map((m) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [m.location.lng, m.location.lat] as [number, number],
          },
          properties: {
            memberId: m.id,
            name: m.name,
            initial: m.name.trim().charAt(0).toUpperCase() || '?',
            active: m.id === activeId ? 1 : 0,
          },
        })),
    });
  }, [members, activeId, ready]);

  // ── Push assessment data on every new verdict ───────────────────────────
  useEffect(() => {
    const instance = map.current;
    if (!instance || !ready || !data) return;

    setSource(instance, SRC.perimeter, {
      type: 'FeatureCollection',
      features: data.hazard.perimeter.map((poly) => polygonFeature(poly, {})),
    });

    // The projection rings — WHERE THE FIRE IS GOING, labelled with when.
    setSource(instance, SRC.projection, {
      type: 'FeatureCollection',
      features: data.field.zones
        .filter((z) => !z.advisory && z.arrivesInMinutes > 0 && z.polygon.length >= 3)
        .map((z) =>
          polygonFeature(z.polygon, {
            minutes: z.arrivesInMinutes,
            ringLabel: `FIRE HERE IN ~${z.arrivesInMinutes} MIN`,
            // Nearer rings fill more strongly; the outline carries the rest.
            opacity: Math.max(0.05, 0.2 - z.arrivesInMinutes / 700),
          }),
        ),
    });

    // The raw satellite detections. These are the receipts behind the polygon.
    setSource(instance, SRC.hotspots, {
      type: 'FeatureCollection',
      features: data.hazard.hotspots.map((h) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [h.location.lng, h.location.lat] as [number, number],
        },
        properties: { confidence: h.confidence },
      })),
    });

    // Officially closed roads — drawn, because a rejection caused by a closure
    // the user cannot see looks like a bug instead of a reason.
    setSource(instance, SRC.closures, {
      type: 'FeatureCollection',
      features: (data.official?.closures ?? [])
        .filter((c) => c.from && c.to)
        .map((c) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [c.from!.lng, c.from!.lat],
              [c.to!.lng, c.to!.lat],
            ] as [number, number][],
          },
          properties: { label: `${c.road} CLOSED` },
        })),
    });

    // Official evacuation zones — context, not danger. Kept deliberately faint.
    setSource(instance, SRC.evac, {
      type: 'FeatureCollection',
      features: data.field.zones
        .filter((z) => z.advisory && z.polygon.length >= 3)
        .map((z) => polygonFeature(z.polygon, { label: (z.label ?? 'EVACUATION ZONE').toUpperCase() })),
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
            width: isRecommended ? 6 : rejected ? 4.5 : 2.5,
            opacity: isRecommended || rejected ? 1 : 0.4,
            dash: rejected ? 1 : 0,
          },
        };
      }),
    });

    // ── THE PROOF: where the race is won and where it is lost ─────────────
    const pinchFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
    const naive = data.naive;
    if (naive && naive.rating === 'REJECTED' && naive.pinch && !isRecommendedRoute(data, naive)) {
      const behind = Math.max(1, Math.round(Math.abs(Math.min(0, naive.pinch.slackMinutes))));
      pinchFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [naive.pinch.location.lng, naive.pinch.location.lat],
        },
        properties: {
          kind: 'lost',
          glyph: '×',
          label:
            naive.pinch.slackMinutes < 0
              ? `THE FIRE GETS HERE FIRST\n~${behind} min before you`
              : 'THE FIRE MEETS THIS ROAD',
        },
      });
    }
    const rec = data.recommended;
    if (rec?.pinch && rec.pinch.slackMinutes > 0) {
      pinchFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [rec.pinch.location.lng, rec.pinch.location.lat] },
        properties: {
          kind: 'won',
          glyph: '✓',
          label: `YOU CLEAR THIS POINT\n~${Math.round(rec.pinch.slackMinutes)} min ahead of the fire`,
        },
      });
    }
    setSource(instance, SRC.pinch, { type: 'FeatureCollection', features: pinchFeatures });

    // Name where the important routes are trying to take you.
    setSource(instance, SRC.destinations, {
      type: 'FeatureCollection',
      features: data.routes
        .filter(
          (s) => s.route.id === data.recommended?.route.id || s.rating === 'REJECTED',
        )
        .map((s) => ({
          type: 'Feature' as const,
          geometry: {
            type: 'Point' as const,
            coordinates: [s.route.destination.location.lng, s.route.destination.location.lat] as [
              number,
              number,
            ],
          },
          properties: { name: s.route.destination.name },
        })),
    });

    setSource(instance, SRC.origin, {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [data.origin.location.lng, data.origin.location.lat],
          },
          properties: {},
        },
      ],
    });

    // Frame everything: house, fire, every route — and any of your people who
    // are plausibly in frame (skip cross-state members or the camera flies out).
    const points: LatLng[] = [
      data.origin.location,
      ...data.hazard.perimeter.flat(),
      ...data.routes.flatMap((r) => r.route.path),
      ...members
        .map((m) => m.location)
        .filter(
          (p) =>
            Math.abs(p.lat) > 0.01 &&
            Math.abs(p.lat - data.origin.location.lat) < 0.35 &&
            Math.abs(p.lng - data.origin.location.lng) < 0.35,
        ),
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
  }, [data, ready, members]);

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

function isRecommendedRoute(data: AssessResponse, s: { route: { id: string } }): boolean {
  return data.recommended?.route.id === s.route.id;
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
        <p className="text-sm text-ash-300">Enter an address to see the fire, the routes,</p>
        <p className="text-sm text-ash-300">and the way out.</p>
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

  // ── Projection rings: soft fill + a firm, labelled edge ──────────────────
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
      'line-width': 1.6,
      'line-opacity': 0.75,
      'line-dasharray': [3, 2.2],
    },
  });
  // The words that make the rings legible: this is not decoration, it is a
  // forecast. One label per ring, repeated along the edge.
  map.addLayer({
    id: 'projection-label',
    type: 'symbol',
    source: SRC.projection,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'ringLabel'],
      'text-font': FONT_BOLD,
      'text-size': 11,
      'text-letter-spacing': 0.08,
      'symbol-spacing': 420,
    },
    paint: {
      'text-color': '#ffc09a',
      'text-halo-color': '#160a04',
      'text-halo-width': 1.6,
    },
  });

  // ── Official evacuation zones: context, faint on purpose ────────────────
  map.addLayer({
    id: 'evac-line',
    type: 'line',
    source: SRC.evac,
    paint: {
      'line-color': '#a78bfa',
      'line-width': 1.2,
      'line-opacity': 0.45,
      'line-dasharray': [1.5, 2.5],
    },
  });
  map.addLayer({
    id: 'evac-label',
    type: 'symbol',
    source: SRC.evac,
    layout: {
      'symbol-placement': 'line',
      'text-field': ['get', 'label'],
      'text-font': FONT_MED,
      'text-size': 9.5,
      'symbol-spacing': 500,
    },
    paint: { 'text-color': '#b9a6ff', 'text-opacity': 0.75, 'text-halo-color': '#0b0714', 'text-halo-width': 1.2 },
  });

  // ── The fire itself ─────────────────────────────────────────────────────
  map.addLayer({
    id: 'perimeter-fill',
    type: 'fill',
    source: SRC.perimeter,
    paint: { 'fill-color': ROUTE_COLORS.perimeter, 'fill-opacity': 0.38 },
  });
  map.addLayer({
    id: 'perimeter-line',
    type: 'line',
    source: SRC.perimeter,
    paint: { 'line-color': ROUTE_COLORS.perimeter, 'line-width': 2.5 },
  });

  // Satellite hotspots: a soft glow and a hot core.
  map.addLayer({
    id: 'hotspots-glow',
    type: 'circle',
    source: SRC.hotspots,
    paint: {
      'circle-radius': 13,
      'circle-color': '#ff7a29',
      'circle-opacity': 0.22,
      'circle-blur': 0.8,
    },
  });
  map.addLayer({
    id: 'hotspots-core',
    type: 'circle',
    source: SRC.hotspots,
    paint: {
      'circle-radius': 3.5,
      'circle-color': '#ffb056',
      'circle-stroke-color': '#ff4d1f',
      'circle-stroke-width': 1.5,
    },
  });

  // ── Routes: halo, solid pass, dashed pass for the rejected ones ─────────
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
    filter: ['==', ['get', 'dash'], 0],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['get', 'width'],
      'line-opacity': ['get', 'opacity'],
    },
  });
  // Dashes read as "the route you are NOT taking" without stealing weight
  // from the green line.
  map.addLayer({
    id: 'routes-line-rejected',
    type: 'line',
    source: SRC.routes,
    filter: ['==', ['get', 'dash'], 1],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['get', 'width'],
      'line-opacity': ['get', 'opacity'],
      'line-dasharray': [1.8, 1.4],
    },
  });

  // ── Closed roads sit above routes: a closure overrules a route ──────────
  map.addLayer({
    id: 'closures-line',
    type: 'line',
    source: SRC.closures,
    layout: { 'line-cap': 'round' },
    paint: { 'line-color': '#ff2e3d', 'line-width': 5, 'line-opacity': 0.85 },
  });
  map.addLayer({
    id: 'closures-cross',
    type: 'line',
    source: SRC.closures,
    layout: { 'line-cap': 'butt' },
    paint: {
      'line-color': '#12060a',
      'line-width': 5,
      'line-dasharray': [0.6, 1.2],
      'line-opacity': 0.9,
    },
  });
  map.addLayer({
    id: 'closures-label',
    type: 'symbol',
    source: SRC.closures,
    layout: {
      'symbol-placement': 'line-center',
      'text-field': ['get', 'label'],
      'text-font': FONT_BOLD,
      'text-size': 11,
      'text-offset': [0, -1.1],
    },
    paint: { 'text-color': '#ff9099', 'text-halo-color': '#160408', 'text-halo-width': 1.6 },
  });

  // Destination names, so "southeast" has a word attached to it.
  map.addLayer({
    id: 'destinations-dot',
    type: 'circle',
    source: SRC.destinations,
    paint: {
      'circle-radius': 4,
      'circle-color': '#e7ecf4',
      'circle-stroke-color': '#0a0c10',
      'circle-stroke-width': 1.5,
    },
  });
  map.addLayer({
    id: 'destinations-label',
    type: 'symbol',
    source: SRC.destinations,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': FONT_MED,
      'text-size': 10.5,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
      'text-max-width': 12,
    },
    paint: { 'text-color': '#dfe5ee', 'text-halo-color': '#0a0c10', 'text-halo-width': 1.4 },
  });

  // ── THE PROOF MARKERS ───────────────────────────────────────────────────
  map.addLayer({
    id: 'pinch-halo',
    type: 'circle',
    source: SRC.pinch,
    paint: {
      'circle-radius': 17,
      'circle-color': ['match', ['get', 'kind'], 'lost', '#f01e1e', '#3ddc84'],
      'circle-opacity': 0.22,
      'circle-blur': 0.4,
    },
  });
  map.addLayer({
    id: 'pinch-dot',
    type: 'circle',
    source: SRC.pinch,
    paint: {
      'circle-radius': 9.5,
      'circle-color': ['match', ['get', 'kind'], 'lost', '#f01e1e', '#18b45f'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'pinch-glyph',
    type: 'symbol',
    source: SRC.pinch,
    layout: {
      'text-field': ['get', 'glyph'],
      'text-font': FONT_BOLD,
      'text-size': 13,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'pinch-label',
    type: 'symbol',
    source: SRC.pinch,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': FONT_BOLD,
      'text-size': 11.5,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-max-width': 16,
      'text-line-height': 1.25,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': ['match', ['get', 'kind'], 'lost', '#ff8d8d', '#8dffbe'],
      'text-halo-color': '#0a0c10',
      'text-halo-width': 1.8,
    },
  });

  // ── You, and your people ────────────────────────────────────────────────
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

  map.addLayer({
    id: 'members-dot',
    type: 'circle',
    source: SRC.members,
    paint: {
      'circle-radius': ['case', ['==', ['get', 'active'], 1], 11, 8.5],
      'circle-color': ['case', ['==', ['get', 'active'], 1], '#ff6b0a', '#343c4d'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 2,
    },
  });
  map.addLayer({
    id: 'members-initial',
    type: 'symbol',
    source: SRC.members,
    layout: {
      'text-field': ['get', 'initial'],
      'text-font': FONT_BOLD,
      'text-size': 10.5,
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffffff' },
  });
  map.addLayer({
    id: 'members-name',
    type: 'symbol',
    source: SRC.members,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': FONT_MED,
      'text-size': 10.5,
      'text-offset': [0, 1.35],
      'text-anchor': 'top',
      'text-optional': true,
    },
    paint: { 'text-color': '#eef2f8', 'text-halo-color': '#0a0c10', 'text-halo-width': 1.5 },
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
