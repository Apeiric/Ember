/**
 * EMBER — tuning knobs and thresholds.
 * OWNER: JUDGE (but everyone reads it)
 *
 * Every magic number in the system lives here with a comment explaining where it
 * came from. If you find a bare number in a service file, move it here.
 */

import type { CompassDirection, Mobility, ProfileTuning } from './types';

// ═══════════════════════════════════════════════════════════════════════════
// DANGER THRESHOLDS
// ═══════════════════════════════════════════════════════════════════════════

/** Danger >= this is treated as impassable. A route touching it is REJECTED, always. */
export const LETHAL_DANGER = 0.75;

/** Danger >= this counts as "meaningful contact" and is recorded as firstContact. */
export const CONTACT_DANGER = 0.15;

/** Routes above this exposure score are downgraded from SAFE to MARGINAL. */
export const MARGINAL_EXPOSURE = 8;

/** Danger decays to zero this many km outside a zone's edge (soft shoulder). */
export const DANGER_FALLOFF_KM = 0.8;

// ═══════════════════════════════════════════════════════════════════════════
// FIRE PROJECTION HEURISTIC
//
// ⚠️  HONESTY NOTE — say this out loud in the pitch, do not hide it:
// This is NOT a validated fire-behaviour model. Real operational modelling
// (Rothermel / FARSITE / ELMFIRE) needs fuel moisture, fuel type, canopy data
// and a lot of compute. We use two well-established rules of thumb:
//
//   1. Fire spreads WITH the wind at roughly a fixed fraction of wind speed.
//   2. Rate of spread roughly DOUBLES for every 10° of upslope.
//
// We deliberately OVER-approximate the danger zone (convex sweep, see geo.ts).
// A false "dangerous" costs someone a detour. A false "safe" costs a life.
// ═══════════════════════════════════════════════════════════════════════════

/** Rate of spread as a fraction of mid-flame wind speed, grass/chaparral. */
export const ROS_WIND_FACTOR = 0.09;

/** Baseline creep with zero wind, km/h. Fires do not stand still. */
export const ROS_BASE_KPH = 0.3;

/** Spread rate doubles per this many degrees of upslope. */
export const SLOPE_DOUBLING_DEG = 10;

/** Never project faster than this — keeps a wind gust from producing nonsense. */
export const ROS_MAX_KPH = 12;

/**
 * Flank spread as a fraction of head-fire rate. A wind-driven fire is not a
 * laser: it widens sideways as it runs. Without this the projection is a thin
 * finger and neighbourhoods just off the wind axis look falsely safe.
 */
export const ROS_FLANK_RATIO = 0.25;

/**
 * Minutes after the front arrives before an area is treated as fully involved.
 * Danger ramps from the ring's severity up to 1.0 over this window.
 */
export const DANGER_INTENSIFY_MIN = 30;

/**
 * Time rings we generate for the danger field, minutes.
 *
 * Ring spacing IS the resolution of `minutesUntilCutoff` — the headline number
 * on the verdict card. Coarse rings quantise it into useless steps, so keep the
 * near-term rings tight where the decision actually gets made.
 */
export const PROJECTION_RINGS_MIN = [0, 10, 20, 30, 45, 60, 90] as const;

/** Beyond this we return null instead of guessing. Honesty over false precision. */
export const PROJECTION_HORIZON_MIN = 90;

/** Severity assigned to each ring, indexed alongside PROJECTION_RINGS_MIN. */
export const RING_SEVERITY = [1.0, 0.92, 0.82, 0.72, 0.58, 0.45, 0.3] as const;

export const PROJECTION_MODEL_ID = 'wind-uphill-heuristic-v1';

export const PROJECTION_DISCLAIMER =
  'Projection is a documented heuristic — fire spreads with the wind and roughly ' +
  'doubles speed per 10° of upslope — not a validated fire-behaviour model. ' +
  'The danger zone is deliberately over-drawn: we would rather send you on a ' +
  'detour than through a fire.';

// ═══════════════════════════════════════════════════════════════════════════
// ROUTING
// ═══════════════════════════════════════════════════════════════════════════

/** Route paths are resampled to this spacing before scoring. Smaller = finer, slower. */
export const ROUTE_SAMPLE_KM = 0.15;

/** How far out we look for evacuation destinations. */
export const DESTINATION_SEARCH_KM = 35;

/** A destination must be at least this far from any danger zone to be a candidate. */
export const DESTINATION_MIN_CLEARANCE_KM = 6;

/** Walking speed, km/h — used when `hasCar: false`. */
export const WALK_SPEED_KPH = 4.5;

// ═══════════════════════════════════════════════════════════════════════════
// PERSONALIZATION — CONTEXT.md §5 step 7.
//
// Same fire, different verdict per person. This is the demo kicker.
// ═══════════════════════════════════════════════════════════════════════════

export const PROFILE_TUNING: Record<Mobility, ProfileTuning> = {
  standard: {
    label: 'Healthy adult',
    description: 'Drives, moves quickly, can leave within a few minutes.',
    paceMultiplier: 1.0,
    prepMinutes: 5,
    safetyMarginMinutes: 10,
    slopePenalty: 0,
    maxTolerableDanger: 0.6,
  },
  vulnerable: {
    label: 'Reduced mobility',
    description:
      'Elderly, disabled, or travelling with small children. Needs to leave earlier, ' +
      'move more slowly, and avoid steep or complex routes.',
    // Slower to load, slower to drive, slower to react at every junction.
    paceMultiplier: 1.45,
    // Mobility aids, medication, another person to move. This is the big one.
    prepMinutes: 25,
    // Wider buffer: no capacity to sprint if the projection is wrong.
    safetyMarginMinutes: 30,
    slopePenalty: 1.5,
    maxTolerableDanger: 0.35,
  },
};

/** Applied on top of the mobility tuning when the user has no vehicle. */
export const NO_CAR_MODIFIER = {
  paceMultiplierOverride: null as number | null, // computed from WALK_SPEED_KPH
  extraPrepMinutes: 10,
  extraSafetyMinutes: 25,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// VERDICT THRESHOLDS — margin (minutes) → decision
// ═══════════════════════════════════════════════════════════════════════════

export const VERDICT_THRESHOLDS = {
  /** Below this many minutes of margin: go, right now, no packing. */
  evacuateNow: 20,
  /** Below this: go soon, you have time to grab essentials. */
  evacuateSoon: 60,
  /** Below this: get ready. */
  prepare: 180,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// COMPASS
// ═══════════════════════════════════════════════════════════════════════════

export const COMPASS_POINTS: CompassDirection[] = [
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW',
];

export const COMPASS_LABELS: Record<CompassDirection, string> = {
  N: 'NORTH',
  NE: 'NORTHEAST',
  E: 'EAST',
  SE: 'SOUTHEAST',
  S: 'SOUTH',
  SW: 'SOUTHWEST',
  W: 'WEST',
  NW: 'NORTHWEST',
};

// ═══════════════════════════════════════════════════════════════════════════
// RESILIENCE — CONTEXT.md §7. Every external call gets a hard deadline.
// ═══════════════════════════════════════════════════════════════════════════

export const TIMEOUTS_MS = {
  geocode: 6_000,
  perimeter: 5_000,
  hotspots: 4_000,
  wind: 3_500,
  /**
   * Mireye fans out to several federal sources (USGS 3DEP, Overture, FEMA NRI)
   * per request. Warm it answers in ~600ms, but a cold container has been seen
   * to blow straight through 3.5s. Ground data is an enhancement, so we would
   * rather wait than silently lose the slope term.
   */
  ground: 9_000,
  directions: 6_000,
  /** Caltrans publishes ~12 MB per district and there is no filtered endpoint. */
  closures: 12_000,
  evacZones: 6_000,
  /** LLM gets longer — but the pipeline still returns without it. */
  verdict: 12_000,
} as const;

/** In-process cache TTLs. Fire perimeters do not change every second. */
export const CACHE_TTL_MS = {
  geocode: 24 * 60 * 60 * 1000,
  perimeter: 5 * 60 * 1000,
  hotspots: 5 * 60 * 1000,
  wind: 10 * 60 * 1000,
  ground: 60 * 60 * 1000,
  directions: 60 * 1000,
  /** 12 MB a request — cache hard, it changes on the order of minutes. */
  closures: 5 * 60 * 1000,
  evacZones: 3 * 60 * 1000,
} as const;

export const EARTH_RADIUS_KM = 6371.0088;
