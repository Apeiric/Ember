/**
 * EMBER — token-free tactical map.
 * OWNER: FRONTEND
 *
 * ⚠️  WHY THIS EXISTS: a missing or rate-limited Mapbox token is the single most
 * common way a mapping demo dies on stage. Without this component that failure
 * is a blank grey rectangle where the product should be.
 *
 * This is a self-contained SVG renderer — no token, no tiles, no network. It
 * draws the same five things the real map draws (perimeter, projection rings,
 * rejected route, safe route, your house) from the same response payload.
 * It is not pretty like satellite imagery, but it is READABLE, and the betrayal
 * still lands: the red line still runs into the fire.
 *
 * CONTEXT.md §7, applied to the one layer everyone forgets to make resilient.
 */

import { useMemo } from 'react';
import type { AssessResponse, LatLng } from '@ember/shared';
import { ROUTE_COLORS } from '../lib/format';

const W = 800;
const H = 600;
const PAD = 48;

export function MapFallback({ data, reason }: { data: AssessResponse; reason: string }) {
  const view = useMemo(() => buildProjection(data), [data]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-ash-950">
      {/* Subtle grid so the shapes read as a map rather than floating in space. */}
      {/* `meet`, not `slice` — cropping a map is how you hide the fire that is
          about to reach the house. Everything must stay in frame. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1a1f2b" strokeWidth="1" />
          </pattern>
          <radialGradient id="fireGlow">
            <stop offset="0%" stopColor={ROUTE_COLORS.perimeter} stopOpacity="0.55" />
            <stop offset="100%" stopColor={ROUTE_COLORS.perimeter} stopOpacity="0.05" />
          </radialGradient>
        </defs>

        <rect width={W} height={H} fill="#08090c" />
        <rect width={W} height={H} fill="url(#grid)" />

        {/* Projection rings, furthest-out first so nearer rings paint on top. */}
        {view.rings
          .slice()
          .reverse()
          .map((ring) => (
            <polygon
              key={ring.id}
              points={ring.points}
              fill={ROUTE_COLORS.projection}
              fillOpacity={0.06}
              stroke={ROUTE_COLORS.projection}
              strokeOpacity={0.3}
              strokeWidth={1}
              strokeDasharray="5 4"
            />
          ))}

        {/* Active perimeter. */}
        {view.perimeter.map((poly, i) => (
          <polygon
            key={i}
            points={poly}
            fill="url(#fireGlow)"
            stroke={ROUTE_COLORS.perimeter}
            strokeWidth={2}
          />
        ))}

        {/* Routes: rejected ones red, the recommendation green, the rest grey. */}
        {view.routes.map((route) => (
          <g key={route.id}>
            <polyline
              points={route.points}
              fill="none"
              stroke={route.color}
              strokeWidth={route.emphasis ? 4 : 2}
              strokeOpacity={route.emphasis ? 1 : 0.45}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={route.rejected ? '10 6' : undefined}
            />
            {route.rejected && route.emphasis && (
              <polyline
                points={route.points}
                fill="none"
                stroke={route.color}
                strokeWidth={11}
                strokeOpacity={0.14}
                strokeLinecap="round"
              />
            )}
          </g>
        ))}

        {/* Wind arrow — explains the whole projection in one glyph. */}
        <g transform={`translate(${W - 96}, 56)`}>
          <g transform={`rotate(${data.field.spreadBearingDeg})`}>
            <path d="M0,-22 L7,10 L0,4 L-7,10 Z" fill={ROUTE_COLORS.projection} />
          </g>
          <text
            y="34"
            textAnchor="middle"
            fill="#6b7689"
            fontSize="10"
            fontFamily="ui-monospace, monospace"
          >
            {data.field.spreadRateKph} km/h
          </text>
        </g>

        {/* Your house. */}
        <g transform={`translate(${view.origin.x}, ${view.origin.y})`}>
          <circle r="16" fill="#fff" fillOpacity="0.12" />
          <circle r="7" fill="#fff" stroke="#08090c" strokeWidth="2.5" />
        </g>

        {/* Destination pin for the recommended route. */}
        {view.destination && (
          <g transform={`translate(${view.destination.x}, ${view.destination.y})`}>
            <circle r="6" fill={ROUTE_COLORS.recommended} stroke="#08090c" strokeWidth="2" />
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ash-950 via-ash-950/85 to-transparent p-4">
        <p className="max-w-[65%] text-[0.68rem] leading-snug text-ash-400">
          <span className="font-semibold text-ember-400">Schematic view</span> — {reason}
        </p>
        <Legend />
      </div>
    </div>
  );
}

function Legend() {
  const items = [
    { color: ROUTE_COLORS.perimeter, label: 'Fire' },
    { color: ROUTE_COLORS.projection, label: 'Projected' },
    { color: ROUTE_COLORS.naive, label: 'Fastest (rejected)' },
    { color: ROUTE_COLORS.recommended, label: 'Safe route' },
  ];
  return (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5 text-[0.62rem] text-ash-300">
          <span className="h-0.5 w-4 rounded" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROJECTION — fit every piece of geometry into the viewBox.
// ═══════════════════════════════════════════════════════════════════════════

interface ProjectedRoute {
  id: string;
  points: string;
  color: string;
  emphasis: boolean;
  rejected: boolean;
}

function buildProjection(data: AssessResponse) {
  const all: LatLng[] = [
    data.origin.location,
    ...data.hazard.perimeter.flat(),
    ...data.routes.flatMap((r) => r.route.path),
  ];

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of all) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }

  // Guard against a degenerate bbox (single point) producing a divide-by-zero.
  const spanLat = Math.max(maxLat - minLat, 1e-4);
  const spanLng = Math.max(maxLng - minLng, 1e-4);

  // Preserve aspect ratio, correcting longitude for latitude compression so the
  // shapes are not stretched.
  const lngScale = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const scale = Math.min((W - PAD * 2) / (spanLng * lngScale), (H - PAD * 2) / spanLat);
  const offsetX = (W - spanLng * lngScale * scale) / 2;
  const offsetY = (H - spanLat * scale) / 2;

  const project = (p: LatLng) => ({
    x: offsetX + (p.lng - minLng) * lngScale * scale,
    // SVG y grows downward; latitude grows upward.
    y: offsetY + (maxLat - p.lat) * scale,
  });

  const toPoints = (path: LatLng[]) =>
    path.map((p) => { const q = project(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(' ');

  const recommendedId = data.recommended?.route.id;
  const naiveId = data.naive?.route.id;

  const routes: ProjectedRoute[] = data.routes.map((scored) => {
    const isRecommended = scored.route.id === recommendedId;
    const isNaive = scored.route.id === naiveId;
    const rejected = scored.rating === 'REJECTED';
    return {
      id: scored.route.id,
      points: toPoints(scored.route.path),
      color: isRecommended
        ? ROUTE_COLORS.recommended
        : rejected
          ? ROUTE_COLORS.naive
          : ROUTE_COLORS.other,
      emphasis: isRecommended || (isNaive && rejected),
      rejected,
    };
  });

  return {
    perimeter: data.hazard.perimeter.map(toPoints),
    // Only the outer projection rings — drawing all twelve is visual noise.
    rings: data.field.zones
      .filter((z) => z.arrivesInMinutes > 0 && z.polygon.length >= 3)
      .filter((_, i, arr) => i % Math.max(1, Math.floor(arr.length / 4)) === 0)
      .map((z) => ({ id: z.id, points: toPoints(z.polygon) })),
    routes,
    origin: project(data.origin.location),
    destination: data.recommended ? project(data.recommended.route.destination.location) : null,
  };
}
