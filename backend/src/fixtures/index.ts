/**
 * EMBER — canned scenario registry. CONTEXT.md §7.
 * OWNER: FRONTEND (demo) + DATA (accuracy)
 *
 * Every service's LAST fallback strategy resolves through this file. As long as
 * this module loads, the pipeline produces a complete, correct, self-consistent
 * answer with no network and no API keys.
 *
 * TO ADD A SCENARIO: create `<id>.ts` exporting the same five pieces, then add
 * one line to SCENARIOS. Nothing else in the codebase needs to change.
 */

import type { GroundContext, Hazard, LatLng, Route, ScenarioSummary } from '@ember/shared';
import { haversineKm } from '../core/geo';
import {
  PALISADES_GEOCODES,
  PALISADES_GROUND,
  PALISADES_HAZARD,
  PALISADES_ORIGIN,
  PALISADES_ROUTES,
  PALISADES_SUMMARY,
} from './palisades-2025';
import {
  CAMP_GEOCODES,
  CAMP_GROUND,
  CAMP_HAZARD,
  CAMP_ORIGIN,
  CAMP_ROUTES,
  CAMP_SUMMARY,
} from './camp-2018';

export interface Scenario {
  summary: ScenarioSummary;
  hazard: Hazard;
  ground: GroundContext;
  /** The demo address's coordinates — the routes below start here. */
  origin: LatLng;
  /** Lowercased query fragments → geocode results. */
  geocodes: Record<string, { formattedAddress: string; location: LatLng }>;
  routes: Route[];
}

export const SCENARIOS: Record<string, Scenario> = {
  'palisades-2025': {
    summary: PALISADES_SUMMARY,
    hazard: PALISADES_HAZARD,
    ground: PALISADES_GROUND,
    origin: PALISADES_ORIGIN,
    geocodes: PALISADES_GEOCODES,
    routes: PALISADES_ROUTES,
  },
  'camp-2018': {
    summary: CAMP_SUMMARY,
    hazard: CAMP_HAZARD,
    ground: CAMP_GROUND,
    origin: CAMP_ORIGIN,
    geocodes: CAMP_GEOCODES,
    routes: CAMP_ROUTES,
  },
};

export const DEFAULT_SCENARIO_ID = 'palisades-2025';

export function listScenarios(): ScenarioSummary[] {
  return Object.values(SCENARIOS).map((s) => s.summary);
}

/** Always returns a scenario. An unknown id silently falls back to the default. */
export function getScenario(id?: string | null): Scenario {
  if (id && SCENARIOS[id]) return SCENARIOS[id];
  return SCENARIOS[DEFAULT_SCENARIO_ID]!;
}

/**
 * Pick the scenario whose fire is nearest a location, within `maxKm`.
 * Lets someone type a real Los Angeles address and land in the Palisades
 * scenario without knowing scenario ids exist.
 */
export function findScenarioNear(location: LatLng, maxKm = 60): Scenario | null {
  let best: { scenario: Scenario; km: number } | null = null;
  for (const scenario of Object.values(SCENARIOS)) {
    const km = haversineKm(location, scenario.summary.center);
    if (km <= maxKm && (!best || km < best.km)) best = { scenario, km };
  }
  return best?.scenario ?? null;
}

/**
 * Canned geocoder. Substring match against each scenario's known addresses so
 * partial typing ("palisades drive") still resolves during a live demo.
 */
export function cannedGeocode(
  query: string,
): { formattedAddress: string; location: LatLng; scenarioId: string } | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  for (const [scenarioId, scenario] of Object.entries(SCENARIOS)) {
    // Exact match first — never let "paradise" beat a full street address.
    const exact = scenario.geocodes[q];
    if (exact) return { ...exact, scenarioId };
  }
  for (const [scenarioId, scenario] of Object.entries(SCENARIOS)) {
    for (const [key, value] of Object.entries(scenario.geocodes)) {
      if (q.includes(key) || key.includes(q)) return { ...value, scenarioId };
    }
  }
  return null;
}

/** Which scenario owns this hazard id — used to look up canned routes later. */
export function scenarioForHazard(hazardId: string): Scenario | null {
  return Object.values(SCENARIOS).find((s) => s.hazard.id === hazardId) ?? null;
}
