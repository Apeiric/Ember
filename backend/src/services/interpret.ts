/**
 * EMBER — messy human language → structured facts.
 * OWNER: DATA
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THIS IS THE FILE WHERE CLAUDE EARNS ITS PLACE.
 *
 * The judge is excellent at geometry and hopeless at prose. Real disaster
 * information is prose: a 911 transcript, a neighbour's text, a news alert —
 *
 *     "the fire jumped Sunset, it's blocked, heavy smoke on the east side"
 *
 * Claude reads that and produces facts the judge can consume: a blocked road, a
 * new danger area. That is genuine reasoning — turning chaos into structure —
 * and no amount of deterministic code does it.
 *
 * But Claude NEVER decides whether a route is safe. It produces a claim. Then:
 *
 *   1. GEOMETRY VERIFIES IT. An extracted road only counts if it actually
 *      intersects a candidate route we already hold. A hallucinated street name
 *      matches nothing and is dropped — surfaced to the user as "unverified",
 *      never fed to the judge.
 *
 *   2. THE JUDGE DECIDES. A verified block enters as a lethal DangerZone and the
 *      judge — completely unchanged — rejects routes through it exactly as it
 *      rejects routes through fire.
 *
 * We deliberately do NOT check Claude with a second language model. The failure
 * we care about is "invented a road that isn't there", and the correct guard for
 * that is the map, not another probabilistic opinion.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Anthropic from '@anthropic-ai/sdk';
import { TIMEOUTS_MS } from '@ember/shared';
import type {
  FieldReport,
  LatLng,
  ReportConfidence,
  ReportedDanger,
  RoadBlock,
  Route,
} from '@ember/shared';
import { resolve, type Strategy } from '../core/resilient';
import type { TraceRecorder } from '../core/trace';
import { env, isOffline } from '../env';

// ═══════════════════════════════════════════════════════════════════════════
// WHAT WE ASK CLAUDE FOR
// ═══════════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = `You extract structured facts from unstructured wildfire situation reports.

The text comes from ordinary people under stress — neighbours, 911 transcripts, group chats, radio. It is informal, incomplete, and sometimes contradictory. Your job is interpretation, not judgement.

Extract only what the text actually claims:

- blocked_roads: a road a person could no longer drive. Give the road name as close to a real street name as the text supports ("Sunset" -> "Sunset Blvd"). If the text names a DIRECTION for that road, include it in the name ("PCH south", "I-405 north") — a closure southbound does not close the northbound side, and dropping the direction shuts a road that is still open. If the text does not name a road, do not invent one.
- danger_areas: places described as dangerous that are not a specific road — "heavy smoke on the east side", "flames behind the school". Use the words given.
- severity: how bad the text says it is, 0..1. "impassable"/"wall of flame" ~0.95. "heavy smoke" ~0.6. "hazy" ~0.25.
- confidence: how firmly the text asserts it. Firsthand and specific = high. Hearsay, hedged, or vague = low.

Rules:
- NEVER invent a road, place, or hazard the text does not mention. An empty list is a correct answer.
- Do not decide whether any route is safe. You are not routing anyone.
- Do not restate the fire's overall behaviour, only what THIS report adds.
- summary: one plain sentence a frightened person would understand.`;

const EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    blocked_roads: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          road: { type: 'string' },
          reason: { type: 'string' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['road', 'reason', 'confidence'],
        additionalProperties: false,
      },
    },
    danger_areas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          severity: { type: 'number' },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        },
        required: ['description', 'severity', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'blocked_roads', 'danger_areas'],
  additionalProperties: false,
} as const;

interface Extraction {
  summary: string;
  blocked_roads: { road: string; reason: string; confidence: ReportConfidence }[];
  danger_areas: { description: string; severity: number; confidence: ReportConfidence }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export interface InterpretInput {
  text: string;
  /** Candidate routes — the ground truth an extracted road is checked against. */
  routes: Route[];
  origin: LatLng;
  forceOffline?: boolean;
}

/**
 * Reports ACCUMULATE across re-runs — profile switches and new reports re-send
 * the whole list — so without a cache every rerun re-pays a Claude call per
 * report already read. Keyed on the raw text + the route set, because the
 * geometric verification depends on which routes exist. In-process and
 * unbounded-ish: capped, and report texts are ≤2000 chars by contract.
 */
const interpretCache = new Map<string, FieldReport>();
const INTERPRET_CACHE_MAX = 200;

export async function interpretReport(
  input: InterpretInput,
  trace: TraceRecorder,
): Promise<FieldReport> {
  const offline = isOffline(input.forceOffline);

  const cacheKey = `${input.routes.map((r) => r.id).join(',')}|${input.text}`;
  const hit = interpretCache.get(cacheKey);
  if (hit) {
    trace.record({
      name: 'interpret',
      status: 'ok',
      ms: 0,
      source: 'cached',
      provider: `${hit.interpretedBy} (cached)`,
      note: 'Report already read — reusing the verified facts.',
    });
    return hit;
  }

  const strategies: Strategy<Extraction>[] = [
    {
      name: `Claude ${env.anthropicModel} (interpret)`,
      source: 'live',
      enabled: Boolean(env.anthropicKey) && !offline,
      timeoutMs: TIMEOUTS_MS.verdict,
      note: 'Parses free text into blocked roads and danger areas.',
      run: (signal) => callClaude(input.text, signal),
    },
    {
      name: 'Groq (interpret)',
      source: 'live',
      enabled: Boolean(env.groqKey) && !offline,
      timeoutMs: TIMEOUTS_MS.verdict,
      run: (signal) => callGroq(input.text, signal),
    },
    // ── LAST RESORT. MUST NOT FAIL. ─────────────────────────────────────────
    // A keyword scan is a poor reader, but "no language model available" must
    // not mean "we ignored a report that a road is on fire".
    {
      name: 'Keyword heuristic',
      source: 'mock',
      note: 'No language model available — crude keyword scan.',
      run: async () => heuristicExtract(input.text),
    },
  ];

  const { data, provenance } = await resolve('interpret', strategies, trace, TIMEOUTS_MS.verdict);

  // ── THE DETERMINISTIC GUARD ──────────────────────────────────────────────
  // Everything above this line is a probabilistic claim. Everything below is
  // checked against geometry we already trust.
  const unresolved: string[] = [];

  const blocks: RoadBlock[] = data.blocked_roads.map((raw) => {
    let match = matchRoadToRoutes(raw.road, input.routes);
    // "Sunset near the east side" closes the east end of Sunset, not the whole
    // road — the reporter told us which part, so use it.
    const hint = compassHintFor(raw.road, input.text);
    if (hint && match.verified) match = filterSegmentsBySide(match, hint, input.routes);
    if (!match.verified) unresolved.push(`Road "${raw.road}" — no candidate route matches it`);
    return {
      road: raw.road,
      location: match.location,
      reason: raw.reason,
      confidence: raw.confidence,
      verified: match.verified,
      affectsRouteIds: match.routeIds,
      affectedSegments: match.affectedSegments,
    };
  });

  const dangers: ReportedDanger[] = data.danger_areas.map((raw) => {
    const located = locateDescription(raw.description, input.origin, input.routes);
    if (!located) unresolved.push(`Danger "${raw.description}" — could not be placed on the map`);
    return {
      description: raw.description,
      location: located?.location ?? null,
      radiusKm: located?.radiusKm ?? 0.6,
      severity: clamp01(raw.severity),
      confidence: raw.confidence,
      verified: located !== null,
    };
  });

  const report: FieldReport = {
    id: `rpt_${Date.now().toString(36)}`,
    rawText: input.text,
    receivedAt: new Date().toISOString(),
    blocks,
    dangers,
    summary: data.summary,
    unresolved,
    interpretedBy: provenance.provider.startsWith('Claude')
      ? 'claude'
      : provenance.provider.startsWith('Groq')
        ? 'groq'
        : 'heuristic',
  };

  // Only cache real reads — a heuristic fallback should retry the LLM next run.
  if (report.interpretedBy !== 'heuristic') {
    if (interpretCache.size >= INTERPRET_CACHE_MAX) {
      const oldest = interpretCache.keys().next().value;
      if (oldest !== undefined) interpretCache.delete(oldest);
    }
    interpretCache.set(cacheKey, report);
  }
  return report;
}

// ═══════════════════════════════════════════════════════════════════════════
// GEOMETRIC VERIFICATION — the part that makes the LLM safe to use.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Does a reported road name correspond to a road we are actually routing over?
 *
 * We match against the route SUMMARIES Google gave us ("Palisades Dr → Sunset
 * Blvd east → I-405"), which are real road names from a real routing engine.
 * A name that matches nothing cannot be placed on the map and therefore cannot
 * be allowed to influence the verdict.
 */
export function matchRoadToRoutes(
  road: string,
  routes: Route[],
): {
  verified: boolean;
  routeIds: string[];
  affectedSegments: { routeId: string; segmentIndex: number }[];
  location: LatLng | null;
} {
  const keys = significantTokens(road);
  const empty = { verified: false, routeIds: [], affectedSegments: [], location: null };
  if (keys.length === 0) return empty;

  const affectedSegments: { routeId: string; segmentIndex: number }[] = [];
  const routeIds = new Set<string>();
  let location: LatLng | null = null;

  for (const route of routes) {
    for (const segment of route.segments) {
      // Prefer the segment's own road name; fall back to the route summary only
      // when the provider gave us nothing better.
      const label = segment.roadName ?? route.summary;
      if (!matchesAny(keys, road, label)) continue;

      affectedSegments.push({ routeId: route.id, segmentIndex: segment.index });
      routeIds.add(route.id);
      location ??= segment.start;
    }
  }

  if (affectedSegments.length === 0) return empty;
  return { verified: true, routeIds: [...routeIds], affectedSegments, location };
}

/**
 * The distinguishing words in a road name.
 *
 * Road TYPES (blvd, ave, hwy) and DIRECTIONS (south, southbound) are stripped,
 * because they appear in almost every road name and would make "Mildred Ave"
 * match any route containing an avenue. What is left is the proper name —
 * "sunset", "pch", "405" — which is the part that actually identifies a road.
 *
 * This is what makes hallucinations fail closed: an invented street contributes
 * a proper name that appears nowhere in the real geometry, so it matches
 * nothing and never reaches the judge.
 */
export function significantTokens(road: string): string[] {
  return normalizeRoad(road)
    .split(' ')
    .map((t) => t.replace(/bound$/, ''))
    .filter((t) => t.length >= 3 && !ROAD_TYPE_WORDS.has(t) && !DIRECTION_WORDS.has(t));
}

const ROAD_TYPE_WORDS = new Set([
  'blvd', 'boulevard', 'ave', 'avenue', 'st', 'street', 'rd', 'road', 'dr', 'drive',
  'hwy', 'highway', 'ln', 'lane', 'way', 'pkwy', 'parkway', 'ct', 'court', 'pl', 'place',
  'the', 'of', 'and', 'to',
]);

const DIRECTION_WORDS = new Set([
  'north', 'south', 'east', 'west', 'n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw',
]);

/** The compass direction stated in a road name, if any. */
export function directionOf(road: string): string | null {
  for (const token of normalizeRoad(road).split(' ')) {
    const t = token.replace(/bound$/, '');
    if (DIRECTION_WORDS.has(t)) return t;
  }
  return null;
}

/**
 * The compass qualifier attached to a road MENTION in the raw report — "a power
 * line is down across Sunset near the east side" — as opposed to a direction in
 * the road's NAME ("PCH south"), which `directionOf` handles.
 *
 * We only read the clause(s) that actually contain the road's name tokens, so a
 * compass word from an unrelated sentence ("fire on the north ridge, and Sunset
 * is blocked") cannot leak onto the wrong fact. Ambiguity (two directions, or
 * none) returns null, and null means "no filtering" — the whole road stays
 * blocked, which is the safe direction to fail.
 */
export function compassHintFor(road: string, reportText: string): 'north' | 'south' | 'east' | 'west' | null {
  // A direction in the NAME is a carriageway, not a geographic side. Do not
  // geometry-filter "PCH south" — matchesAny already handles it.
  if (directionOf(road)) return null;
  const tokens = significantTokens(road);
  if (tokens.length === 0) return null;

  const clauses = reportText.toLowerCase().split(/[,.;\n!?–—]+/);
  const relevant = clauses.filter((c) => tokens.some((t) => c.includes(t)));
  if (relevant.length === 0) return null;

  const found = new Set<'north' | 'south' | 'east' | 'west'>();
  for (const clause of relevant) {
    for (const m of clause.matchAll(/\b(north|south|east|west)(?:ern|erly)?\b/g)) {
      found.add(m[1] as 'north' | 'south' | 'east' | 'west');
    }
  }
  return found.size === 1 ? [...found][0]! : null;
}

/**
 * Keep only the matched segments on the stated side of the road's own extent.
 *
 * "Sunset near the east side" must not close the western stretch of Sunset that
 * the recommended escape uses — over-matching there strands the user for no
 * stated reason. Side is judged against the centroid of everything that
 * matched (the road as we know it), with a margin so segments straddling the
 * middle are dropped rather than guessed. If filtering would remove every
 * segment, the hint contradicts the geometry and we keep the full match:
 * fail closed, never open.
 */
export function filterSegmentsBySide(
  match: {
    verified: boolean;
    routeIds: string[];
    affectedSegments: { routeId: string; segmentIndex: number }[];
    location: LatLng | null;
  },
  hint: 'north' | 'south' | 'east' | 'west',
  routes: Route[],
): typeof match {
  if (match.affectedSegments.length < 2) return match;

  const mids = match.affectedSegments.map(({ routeId, segmentIndex }) => {
    const seg = routes.find((r) => r.id === routeId)?.segments[segmentIndex];
    return seg
      ? { lat: (seg.start.lat + seg.end.lat) / 2, lng: (seg.start.lng + seg.end.lng) / 2 }
      : null;
  });
  const placed = mids.filter((m): m is LatLng => m !== null);
  if (placed.length < 2) return match;

  const centroid = {
    lat: placed.reduce((s, m) => s + m.lat, 0) / placed.length,
    lng: placed.reduce((s, m) => s + m.lng, 0) / placed.length,
  };
  // ~0.15 km in degrees at CA latitudes; a segment must be clearly on the side.
  const MARGIN = 0.0016;
  const onSide = (m: LatLng): boolean =>
    hint === 'east'
      ? m.lng > centroid.lng + MARGIN
      : hint === 'west'
        ? m.lng < centroid.lng - MARGIN
        : hint === 'north'
          ? m.lat > centroid.lat + MARGIN
          : m.lat < centroid.lat - MARGIN;

  const kept = match.affectedSegments.filter((_, i) => mids[i] && onSide(mids[i]!));
  if (kept.length === 0) return match; // hint contradicts geometry → keep all

  const routeIds = [...new Set(kept.map((s) => s.routeId))];
  const first = kept[0]!;
  const seg = routes.find((r) => r.id === first.routeId)?.segments[first.segmentIndex];
  return { verified: true, routeIds, affectedSegments: kept, location: seg?.start ?? match.location };
}

/**
 * A road matches a segment when a distinguishing name token matches AND the
 * directions do not contradict.
 *
 * Direction matters: "PCH south is blocked" must not close the northbound
 * carriageway, which on this map is a completely different escape route. When
 * either side omits a direction we allow the match — an unqualified report of
 * "PCH is blocked" should close both.
 */
function matchesAny(keys: string[], reportedRoad: string, label: string): boolean {
  const haystack = normalizeRoad(label);
  if (!keys.some((k) => haystack.includes(k))) return false;

  const want = directionOf(reportedRoad);
  const have = directionOf(label);
  if (want && have && want !== have) return false;
  return true;
}

/**
 * Try to place a described danger area on the map.
 *
 * Only compass-relative descriptions are resolvable without a gazetteer —
 * "east side", "north of town". Anything else stays unverified and is shown to
 * the user without being fed to the judge. We would rather under-react to a
 * vague report than invent a hazard in the wrong place.
 */
export function locateDescription(
  description: string,
  origin: LatLng,
  _routes: Route[],
): { location: LatLng; radiusKm: number } | null {
  const text = description.toLowerCase();

  const BEARINGS: [string, number][] = [
    ['north[- ]?east', 45],
    ['south[- ]?east', 135],
    ['south[- ]?west', 225],
    ['north[- ]?west', 315],
    ['north', 0],
    ['east', 90],
    ['south', 180],
    ['west', 270],
  ];

  for (const [dir, bearing] of BEARINGS) {
    // ⚠️ A bare compass word is NOT an area reference.
    //
    // "Downed power line across PCH south toward Santa Monica" contains "south"
    // — but that is part of a ROAD NAME, already handled as a road block. Naive
    // matching placed a 1.2 km hazard 1.5 km south of the user's own house, on
    // top of the family we are trying to evacuate.
    //
    // So require the direction to sit in an actual area phrase: "east side",
    // "north of town", "the western edge". Anything else stays unresolved —
    // shown to the user, never fed to the judge.
    const areaPhrase = new RegExp(
      `\\b(?:${dir}(?:ern)?)\\s+(?:side|end|part|section|area|edge|half|slope|ridge|canyon|hills?)\\b` +
        `|\\b(?:${dir}(?:ern)?)\\s+of\\b` +
        `|\\b(?:on|to|in|toward|towards)\\s+the\\s+(?:${dir}(?:ern)?)\\b`,
    );
    if (areaPhrase.test(text)) {
      // 1.5 km out, 1.2 km across — a neighbourhood-sized blob, not a pinpoint.
      return { location: offsetKm(origin, bearing, 1.5), radiusKm: 1.2 };
    }
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  client ??= new Anthropic({
    apiKey: env.anthropicKey,
    timeout: TIMEOUTS_MS.verdict,
    maxRetries: 1,
  });
  return client;
}

async function callClaude(text: string, signal: AbortSignal): Promise<Extraction> {
  const params = {
    model: env.anthropicModel,
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    output_config: {
      // Extraction is a reading task, not a reasoning marathon — keep it fast.
      effort: 'low',
      format: { type: 'json_schema', schema: EXTRACTION_SCHEMA },
    },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user' as const, content: `SITUATION REPORT:\n"""\n${text}\n"""` }],
  };

  const response = await anthropic().beta.messages.create(params as never, { signal });
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined the request (stop_reason: refusal)');
  }
  const out = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
  return parseExtraction(out);
}

async function callGroq(text: string, signal: AbortSignal): Promise<Extraction> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: { Authorization: `Bearer ${env.groqKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.groqModel,
      response_format: { type: 'json_object' },
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nRespond with JSON: {"summary":string,"blocked_roads":[{"road":string,"reason":string,"confidence":"high"|"medium"|"low"}],"danger_areas":[{"description":string,"severity":number,"confidence":"high"|"medium"|"low"}]}`,
        },
        { role: 'user', content: `SITUATION REPORT:\n"""\n${text}\n"""` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseExtraction(body.choices?.[0]?.message?.content ?? '');
}

function parseExtraction(raw: string): Extraction {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();
  if (!text.startsWith('{')) {
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s >= 0 && e > s) text = text.slice(s, e + 1);
  }

  const parsed = JSON.parse(text) as Partial<Extraction>;
  return {
    summary: String(parsed.summary ?? 'Report received.'),
    blocked_roads: (parsed.blocked_roads ?? [])
      .filter((b) => b && typeof b.road === 'string' && b.road.trim().length > 0)
      .slice(0, 6)
      .map((b) => ({
        road: String(b.road).trim(),
        reason: String(b.reason ?? 'reported blocked'),
        confidence: normalizeConfidence(b.confidence),
      })),
    danger_areas: (parsed.danger_areas ?? [])
      .filter((d) => d && typeof d.description === 'string')
      .slice(0, 6)
      .map((d) => ({
        description: String(d.description).trim(),
        severity: clamp01(Number(d.severity)),
        confidence: normalizeConfidence(d.confidence),
      })),
  };
}

/**
 * Keyword fallback. Deliberately conservative: it only fires on explicit
 * blocking language, because a false "road is closed" sends someone the long
 * way round for no reason.
 */
export function heuristicExtract(text: string): Extraction {
  const lower = text.toLowerCase();
  const blocked: Extraction['blocked_roads'] = [];

  // "<Name> is blocked/closed/impassable/on fire"
  const pattern =
    /\b([A-Z][A-Za-z]*(?:\s+(?:[A-Z][A-Za-z]*|de|del|la|el))*\s*(?:Blvd|Boulevard|Ave|Avenue|St|Street|Rd|Road|Dr|Drive|Hwy|Highway|Ln|Lane|Way|Pkwy|Canyon|PCH|I-\d+|CA-\d+))\b[^.]{0,40}?\b(blocked|closed|impassable|on fire|jumped|cut off|gridlock)/gi;
  for (const m of text.matchAll(pattern)) {
    blocked.push({ road: m[1]!.trim(), reason: m[2]!.toLowerCase(), confidence: 'medium' });
  }

  const dangers: Extraction['danger_areas'] = [];
  if (/heavy smoke|thick smoke|smoke everywhere/.test(lower)) {
    dangers.push({ description: text.slice(0, 90), severity: 0.6, confidence: 'low' });
  }

  return {
    summary: blocked.length > 0 ? `Reported blocked: ${blocked.map((b) => b.road).join(', ')}.` : 'Report received.',
    blocked_roads: blocked,
    danger_areas: dangers,
  };
}

// ═══════════════════════════════════════════════════════════════════════════

function normalizeRoad(s: string): string {
  return s
    .toLowerCase()
    .replace(/\bboulevard\b/g, 'blvd')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bdrive\b/g, 'dr')
    .replace(/\bhighway\b/g, 'hwy')
    .replace(/\bpacific coast hwy\b/g, 'pch')
    .replace(/[^a-z0-9 -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeConfidence(v: unknown): ReportConfidence {
  const s = String(v ?? '').toLowerCase();
  return s === 'high' || s === 'low' ? s : 'medium';
}

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0.5);

function offsetKm(origin: LatLng, bearingDeg: number, km: number): LatLng {
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
