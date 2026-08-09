/**
 * EMBER — THE 3D SCENE. CONTEXT.md §4 step 2, §6, §8.
 * OWNER: FRONTEND
 *
 * "camera flies into the real 3D neighborhood, house lights up"
 *
 * Cesium + Google Photorealistic 3D Tiles. This is the demo's second beat and
 * the reason the betrayal lands emotionally rather than as an abstraction — you
 * are looking at the actual houses on the actual ridge, with the actual fire
 * coming over it.
 *
 * WHAT IS DRAWN, and the colour language (identical to the 2D map):
 *   • Fire perimeter      RED translucent wall + glowing ground     burning now
 *   • Projection rings    ORANGE walls, fainter the further out     where it goes
 *   • Rejected routes     RED dashed, clamped to terrain            your phone's answer
 *   • Recommended route   GREEN glowing, clamped to terrain         our answer
 *   • Your house          white pulsing marker + vertical beam
 *
 * FAILURE BEHAVIOUR (CONTEXT.md §7): if the Google Map Tiles key is missing or
 * the tileset refuses to load, we fall back to Cesium's own terrain rather than
 * showing nothing — and if Cesium itself will not start, `MapView` keeps the 2D
 * map. There is no path here that ends in a blank rectangle.
 */

import { useEffect, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';
import type { AssessResponse, LatLng, Polygon } from '@ember/shared';
import { ROUTE_COLORS } from '../lib/format';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN as string | undefined;

const css = (hex: string, alpha = 1) => Cesium.Color.fromCssColorString(hex).withAlpha(alpha);

export function Scene3D({ data, onExit }: { data: AssessResponse | null; onExit: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const viewer = useRef<Cesium.Viewer | null>(null);
  const [status, setStatus] = useState<'booting' | 'ready' | 'failed'>('booting');
  const [detail, setDetail] = useState<string>('Loading photorealistic tiles…');

  // ── Boot the viewer once ────────────────────────────────────────────────
  useEffect(() => {
    if (!container.current || viewer.current) return;

    /**
     * ⚠️ REACT STRICTMODE + A HEAVY IMPERATIVE WIDGET.
     *
     * In dev, StrictMode mounts → unmounts → remounts. Viewer construction is
     * async (the tileset is awaited), so the cleanup for the FIRST mount runs
     * while that promise is still in flight. If cleanup only destroys
     * `viewer.current`, the first Viewer is never assigned and never destroyed —
     * it just keeps rendering its own canvas into the same container.
     *
     * You then get two stacked canvases: the live one flies to the address, the
     * orphan sits at Cesium's default whole-Earth view, and depending on stacking
     * order you stare at a globe while the console insists the camera is over
     * Los Angeles. Track the instance locally and destroy it after every await.
     */
    let disposed = false;
    let instance: Cesium.Viewer | null = null;

    (async () => {
      try {
        if (CESIUM_TOKEN) Cesium.Ion.defaultAccessToken = CESIUM_TOKEN;

        const v = new Cesium.Viewer(container.current!, {
          // Strip every widget — this is a product surface, not a GIS tool.
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: document.createElement('div'),
        });

        // Claim it immediately so cleanup can always find it.
        instance = v;
        if (disposed) {
          v.destroy();
          return;
        }

        if (v.scene.skyAtmosphere) v.scene.skyAtmosphere.show = true;
        v.scene.fog.enabled = true;
        // Let the camera get low without clipping through the ground.
        v.scene.screenSpaceCameraController.enableCollisionDetection = false;
        v.scene.globe.depthTestAgainstTerrain = true;

        if (GOOGLE_KEY) {
          try {
            Cesium.GoogleMaps.defaultApiKey = GOOGLE_KEY;
            const tileset = await Cesium.createGooglePhotorealistic3DTileset();
            if (disposed) {
              v.destroy();
              return;
            }
            v.scene.primitives.add(tileset);
            // Google tiles include their own ground; Cesium's globe underneath
            // would z-fight with it.
            v.scene.globe.show = false;
            setDetail('Google Photorealistic 3D Tiles');
          } catch (err) {
            // Tiles unavailable (key not enabled for Map Tiles API, quota, etc).
            // Cesium world terrain still gives real elevation — degraded, not dead.
            v.scene.globe.show = true;
            setDetail(
              `Photorealistic tiles unavailable (${err instanceof Error ? err.message.slice(0, 60) : 'error'}) — using terrain only`,
            );
          }
        } else {
          v.scene.globe.show = true;
          setDetail('No VITE_GOOGLE_MAPS_API_KEY — terrain only, no photorealistic buildings');
        }

        if (disposed) {
          v.destroy();
          return;
        }
        viewer.current = v;
        // Dev-only handle so you can poke the scene from the console
        // (`__emberViewer.camera.position`) instead of guessing.
        if (import.meta.env.DEV) {
          (window as unknown as { __emberViewer?: Cesium.Viewer }).__emberViewer = v;
        }
        setStatus('ready');
      } catch (err) {
        setStatus('failed');
        setDetail(err instanceof Error ? err.message : 'Cesium failed to initialise');
      }
    })();

    return () => {
      disposed = true;
      // `instance`, not `viewer.current` — the latter is only set once the
      // whole async boot succeeds, so it misses exactly the case that leaks.
      const live = instance ?? viewer.current;
      if (live && !live.isDestroyed()) live.destroy();
      instance = null;
      viewer.current = null;
    };
  }, []);

  // ── Draw the assessment, then fly the camera in ─────────────────────────
  useEffect(() => {
    const v = viewer.current;
    if (!v || status !== 'ready' || !data) return;

    // The camera flight is the LAST thing in this effect. If any entity throws
    // — an unsupported material, a ground primitive the GPU will not do — the
    // effect aborts and you get a scene that loaded but never flew anywhere,
    // with nothing in the console to explain it. Never let that be silent.
    try {
      drawScene(v, data);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[Scene3D] draw failed:', err);
      setDetail(`Scene draw failed: ${message.slice(0, 90)}`);
    }
  }, [data, status]);

  useEffect(() => {
    const v = viewer.current;
    if (!v || status !== 'ready' || !data) return;
    // Fly regardless of whether every entity drew — an empty scene over the
    // right neighbourhood still beats staring at the whole globe.
    flyToOrigin(v, data);
  }, [data, status]);

  function drawScene(v: Cesium.Viewer, data: AssessResponse) {
    v.entities.removeAll();

    // 1. Projection rings — furthest-out first so nearer rings sit on top.
    const rings = data.field.zones
      .filter((z) => z.arrivesInMinutes > 0 && z.polygon.length >= 3)
      .sort((a, b) => b.arrivesInMinutes - a.arrivesInMinutes);

    for (const zone of rings) {
      const fade = Math.max(0.05, 0.3 - zone.arrivesInMinutes / 400);
      v.entities.add({
        name: zone.label,
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(toCartesians(zone.polygon)),
          material: css(ROUTE_COLORS.projection, fade),
          // A wall, not a stain: from a low camera angle a flat polygon on the
          // ground is nearly invisible, while an extruded volume reads as a
          // front advancing over the ridge.
          extrudedHeight: 120 + zone.severity * 260,
          height: 0,
          outline: true,
          outlineColor: css(ROUTE_COLORS.projection, 0.55),
        },
      });
    }

    // 2. Active perimeter — the thing that is burning right now.
    for (const poly of data.hazard.perimeter) {
      if (poly.length < 3) continue;
      v.entities.add({
        name: 'Active fire perimeter',
        polygon: {
          hierarchy: new Cesium.PolygonHierarchy(toCartesians(poly)),
          material: css(ROUTE_COLORS.perimeter, 0.55),
          // Tall enough to be unmistakable from 3 km out — this is the thing
          // the whole screen is about.
          extrudedHeight: 650,
          height: 0,
          outline: true,
          outlineColor: css(ROUTE_COLORS.perimeter, 1),
        },
      });
    }

    // 3. Hotspots — vertical embers. Cheap, and they read instantly as fire.
    for (const hotspot of data.hazard.hotspots) {
      v.entities.add({
        position: Cesium.Cartesian3.fromDegrees(hotspot.location.lng, hotspot.location.lat, 60),
        point: {
          pixelSize: 8 + hotspot.confidence * 10,
          color: css('#ffb267', 0.9),
          outlineColor: css(ROUTE_COLORS.perimeter, 1),
          outlineWidth: 2,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        },
      });
    }

    // 4. Routes. Clamped to terrain so they follow the actual streets.
    for (const scored of data.routes) {
      const isRecommended = scored.route.id === data.recommended?.route.id;
      const rejected = scored.rating === 'REJECTED';
      const color = isRecommended
        ? ROUTE_COLORS.recommended
        : rejected
          ? ROUTE_COLORS.naive
          : ROUTE_COLORS.other;

      v.entities.add({
        name: scored.route.summary,
        polyline: {
          positions: toCartesians(scored.route.path),
          width: isRecommended ? 12 : rejected ? 8 : 4,
          clampToGround: true,
          material: isRecommended
            ? new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.28,
                color: css(color, 1),
              })
            : rejected
              ? new Cesium.PolylineDashMaterialProperty({
                  color: css(color, 0.95),
                  dashLength: 26,
                })
              : css(color, 0.4),
        },
      });
    }

    // 5. The house — a beam so you can find it from any camera angle.
    const origin = data.origin.location;
    v.entities.add({
      name: data.origin.formattedAddress,
      position: Cesium.Cartesian3.fromDegrees(origin.lng, origin.lat, 0),
      point: {
        pixelSize: 16,
        color: Cesium.Color.WHITE,
        outlineColor: css('#08090c', 1),
        outlineWidth: 3,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          origin.lng, origin.lat, 0,
          origin.lng, origin.lat, 400,
        ]),
        width: 3,
        material: new Cesium.PolylineGlowMaterialProperty({
          glowPower: 0.5,
          color: Cesium.Color.WHITE.withAlpha(0.85),
        }),
      },
    });

  }

  return (
    <div className="relative h-full w-full bg-ash-950">
      <div ref={container} className="h-full w-full" />

      {/* Exit back to the 2D map. */}
      <button
        type="button"
        onClick={onExit}
        className="absolute right-3 top-3 z-10 rounded-lg border border-white/10 bg-ash-900/85 px-3 py-1.5 text-xs font-semibold text-ash-200 backdrop-blur transition-colors hover:border-ember-500 hover:text-ember-300"
      >
        ← 2D map
      </button>

      {status === 'booting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-ash-950">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-400" />
            <p className="text-sm text-ash-300">Loading 3D scene…</p>
            <p className="mt-1 text-[0.68rem] text-ash-300">{detail}</p>
          </div>
        </div>
      )}

      {status === 'failed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-ash-950 p-6">
          <div className="max-w-sm text-center">
            <p className="text-sm font-semibold text-alarm-400">3D scene unavailable</p>
            <p className="mt-1 text-xs text-ash-400">{detail}</p>
            <button
              type="button"
              onClick={onExit}
              className="mt-4 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ash-200 hover:border-ember-500"
            >
              Back to the 2D map
            </button>
          </div>
        </div>
      )}

      {status === 'ready' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-ash-950 via-ash-950/70 to-transparent p-3">
          <p className="text-[0.62rem] text-ash-400">{detail}</p>
          <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
            {[
              { c: ROUTE_COLORS.perimeter, l: 'Fire' },
              { c: ROUTE_COLORS.projection, l: 'Projected' },
              { c: ROUTE_COLORS.naive, l: 'Fastest (rejected)' },
              { c: ROUTE_COLORS.recommended, l: 'Safe route' },
            ].map((i) => (
              <span key={i.l} className="flex items-center gap-1.5 text-[0.6rem] text-ash-300">
                <span className="h-0.5 w-4 rounded" style={{ background: i.c }} />
                {i.l}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * THE FLIGHT — CONTEXT.md §4 step 2, "camera flies into the real 3D
 * neighborhood".
 *
 * Approach from the side the fire is NOT on, so the camera looks at the house
 * with the fire beyond it. That single composition is what makes the threat
 * legible in one frame instead of needing a caption.
 */
function flyToOrigin(v: Cesium.Viewer, data: AssessResponse): void {
  const origin = data.origin.location;

  // The hazard travels along `spreadBearingDeg`, so it is UPWIND of the house —
  // at bearing (spread + 180). Stand DOWNWIND of the house (i.e. along the
  // spread bearing, the safe side) and look back up the wind line. That puts
  // house in the middle of frame and fire beyond it, which is the whole story
  // in one shot. Standing upwind instead points the camera away from the fire.
  const cameraBearing = data.field.spreadBearingDeg;
  const lookBearing = (cameraBearing + 180) % 360;

  // Keep the standoff short. Downwind of a coastal address is the sea, and at
  // 3+ km the camera ends up over water with half the frame full of ocean.
  // 2.4 km keeps it on the ridge; the extruded fire walls carry the visibility.
  const standoffKm = 2.4;
  const altitudeM = 1400;
  const eye = destination(origin, cameraBearing, standoffKm);

  v.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(eye.lng, eye.lat, altitudeM),
    orientation: {
      heading: Cesium.Math.toRadians(lookBearing),
      // ~-30° puts the look-at point roughly on the house at this standoff,
      // leaving the upper half of frame for the fire behind it.
      pitch: Cesium.Math.toRadians(-30),
      roll: 0,
    },
    duration: 3.4,
  });
}

function toCartesians(path: LatLng[] | Polygon): Cesium.Cartesian3[] {
  return path.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat));
}

/** Local copy of the geo helper — the frontend does not import backend code. */
function destination(origin: LatLng, bearingDeg: number, km: number): LatLng {
  const R = 6371.0088;
  const d = km / R;
  const b = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 =
    lng1 +
    Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: (lat2 * 180) / Math.PI, lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180 };
}
