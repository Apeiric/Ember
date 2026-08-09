/**
 * EMBER — the verdict. CONTEXT.md §5 step 8.
 * OWNER: DATA
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DIVISION OF LABOUR — READ THIS BEFORE CHANGING ANYTHING HERE
 *
 * The language model does NOT decide anything. Every number and every decision
 * on the verdict card is computed by `judge.ts`:
 *
 *     decision            ← margin thresholds, deterministic
 *     direction           ← bearing to the recommended destination
 *     minutesUntilCutoff  ← the route/hazard race, point by point
 *     leaveWithinMinutes  ← margin minus the profile's safety buffer
 *
 * Claude's job is to turn computed facts into a sentence a frightened person can
 * act on in three seconds. If the model is unavailable, the template fallback
 * produces the same decision with slightly stiffer prose — nobody gets a worse
 * answer, only a less fluent one.
 *
 * That split is why the LLM being down is a cosmetic failure rather than an
 * outage, and it is worth one line in the pitch.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Strategy chain: Claude (Opus 5) → Groq (fast) → deterministic template.
 */

import Anthropic from '@anthropic-ai/sdk';
import { COMPASS_LABELS, TIMEOUTS_MS, VERDICT_THRESHOLDS } from '@ember/shared';
import type {
  Citation,
  OfficialContext,
  Decision,
  GroundContext,
  Hazard,
  JudgeResult,
  ProfileTuning,
  RouteVerdict,
  UserProfile,
} from '@ember/shared';
import { resolve, type Strategy } from '../core/resilient';
import type { TraceRecorder } from '../core/trace';
import { env, isOffline } from '../env';
import { profileNote } from './profiles';

export interface VerdictInput {
  hazard: Hazard;
  /** Official closures and evacuation orders, when available. */
  official?: OfficialContext;
  ground: GroundContext;
  judgement: JudgeResult;
  profile: UserProfile;
  tuning: ProfileTuning;
  address: string;
  forceOffline?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// DETERMINISTIC CORE — computed first, always. The LLM only ever decorates it.
// ═══════════════════════════════════════════════════════════════════════════

interface VerdictFacts {
  decision: Decision;
  directionLabel: string | null;
  minutesUntilCutoff: number | null;
  leaveWithinMinutes: number | null;
  confidence: 'high' | 'moderate' | 'low';
  citations: Citation[];
}

export function computeFacts(input: VerdictInput): VerdictFacts {
  const { judgement, tuning, hazard, ground } = input;
  const best = judgement.recommended;

  const margin = best?.marginMinutes ?? null;
  const cutoff = best?.minutesUntilCutoff ?? null;

  let decision: Decision;
  if (judgement.allRoutesDangerous) {
    // Nothing survived. Telling someone to drive into a fire is worse than
    // telling them to shelter, so we say shelter and say why.
    decision = 'SHELTER_IN_PLACE';
  } else if (margin === null) {
    decision = 'MONITOR';
  } else if (margin <= VERDICT_THRESHOLDS.evacuateNow) {
    decision = 'EVACUATE_NOW';
  } else if (margin <= VERDICT_THRESHOLDS.evacuateSoon) {
    decision = 'EVACUATE_SOON';
  } else if (margin <= VERDICT_THRESHOLDS.prepare) {
    decision = 'PREPARE';
  } else {
    decision = 'MONITOR';
  }

  // "You have N minutes" = your slack, minus the buffer this person needs.
  // Never negative on screen: zero means go now.
  const leaveWithinMinutes = margin === null ? null : Math.max(0, Math.round(margin));

  return {
    decision,
    directionLabel: best ? COMPASS_LABELS[best.direction] : null,
    minutesUntilCutoff: cutoff === null ? null : Math.round(cutoff),
    leaveWithinMinutes,
    // Confidence is about DATA QUALITY, not about how sure we feel.
    confidence: confidenceFrom(input),
    citations: buildCitations(hazard, ground, judgement),
  };
}

function confidenceFrom({ hazard, ground, judgement }: VerdictInput): 'high' | 'moderate' | 'low' {
  const liveFeeds = [
    hazard.provenance.perimeter.source,
    hazard.provenance.wind.source,
    ground.provenance.source,
  ].filter((s) => s === 'live' || s === 'cached').length;

  if (judgement.field.zones.length === 0) return 'low';
  if (liveFeeds >= 2) return 'high';
  if (liveFeeds === 1) return 'moderate';
  return 'low';
}

function buildCitations(
  hazard: Hazard,
  ground: GroundContext,
  judgement: JudgeResult,
): Citation[] {
  const cites: Citation[] = [
    {
      label: `${hazard.name} perimeter`,
      source: hazard.provenance.perimeter.provider,
      retrievedAt: hazard.provenance.perimeter.fetchedAt,
    },
    {
      label: `Wind ${hazard.wind.speedKph} km/h from ${Math.round(hazard.wind.fromDeg)}°`,
      source: hazard.provenance.wind.provider,
      retrievedAt: hazard.provenance.wind.fetchedAt,
    },
    {
      label: `Spread projection at ${judgement.field.spreadRateKph} km/h (${judgement.field.model})`,
      source: 'Ember heuristic — not a validated fire-behaviour model',
    },
  ];

  if (hazard.hotspots.length > 0) {
    cites.push({
      label: `${hazard.hotspots.length} satellite hotspot detections`,
      source: hazard.provenance.hotspots.provider,
      retrievedAt: hazard.provenance.hotspots.fetchedAt,
    });
  }
  if (judgement.field.zones.some((z) => z.advisory)) {
    const orders = judgement.field.zones.filter((z) => z.advisory).length;
    cites.push({
      label: `${orders} official evacuation zone${orders === 1 ? '' : 's'} in effect`,
      source: 'CAL FIRE / Cal OES statewide evacuation aggregation',
    });
  }
  if (ground.exitCount != null) {
    cites.push({
      label: `${ground.exitCount} road${ground.exitCount === 1 ? '' : 's'} out of this area`,
      source: ground.provenance.provider,
    });
  }
  return cites;
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════

export async function writeVerdict(
  input: VerdictInput,
  trace: TraceRecorder,
): Promise<RouteVerdict> {
  const facts = computeFacts(input);
  const offline = isOffline(input.forceOffline);
  const prompt = buildPrompt(input, facts);

  const strategies: Strategy<RouteVerdict>[] = [
    {
      name: `Claude ${env.anthropicModel}`,
      source: 'live',
      enabled: Boolean(env.anthropicKey) && !offline,
      timeoutMs: TIMEOUTS_MS.verdict,
      run: async (signal) => {
        const prose = await callClaude(prompt, signal);
        return assemble(input, facts, prose, 'claude');
      },
    },
    {
      name: `Groq ${env.groqModel}`,
      source: 'live',
      enabled: Boolean(env.groqKey) && !offline,
      timeoutMs: TIMEOUTS_MS.verdict,
      note: 'Fast fallback writer.',
      run: async (signal) => {
        const prose = await callGroq(prompt, signal);
        return assemble(input, facts, prose, 'groq');
      },
    },

    // ── LAST RESORT. MUST NOT FAIL. Same decision, stiffer prose. ───────────
    {
      name: 'Deterministic template',
      source: 'canned',
      note: 'Verdict assembled from computed facts — no language model involved.',
      run: async () => assemble(input, facts, null, 'template'),
    },
  ];

  const result = await resolve('verdict', strategies, trace, TIMEOUTS_MS.verdict);
  return result.data;
}

/**
 * Verdict with no language model at all — computed facts plus templated prose.
 *
 * Used by the family view, where four verdicts are produced at once: four Claude
 * calls would cost ~25 seconds and buy nothing, because every number on a family
 * card (decision, direction, minutes) is already deterministic. Instant, free,
 * and byte-for-byte reproducible.
 */
export function buildTemplateVerdict(input: VerdictInput): RouteVerdict {
  return assemble(input, computeFacts(input), null, 'template');
}

// ═══════════════════════════════════════════════════════════════════════════
// PROMPT
// ═══════════════════════════════════════════════════════════════════════════

/** The only fields a language model is allowed to produce. */
interface VerdictProse {
  headline: string;
  subhead: string;
  reasoning: string[];
  rejectedSummary: string;
  profileNote: string;
}

const SYSTEM_PROMPT = `You write emergency evacuation instructions that appear on a phone screen during an active wildfire.

The reader may be frightened, may be elderly, and has seconds — not minutes — to understand you. Everything you receive has already been computed by a routing engine. You are not deciding anything. You are making computed facts readable.

Rules:
- HEADLINE: at most 18 characters, uppercase, one instruction. Use the decision given.
- SUBHEAD: at most 60 characters. Must state the direction and the road name.
- REASONING: 2-4 bullets, at most 90 characters each, plain language. Use the supplied numbers exactly as given — never invent, round differently, or soften them.
- REJECTED_SUMMARY: one sentence about the faster route that was refused, and why. Empty string if no route was rejected.
- PROFILE_NOTE: one sentence on what changed because of who this person is. Empty string if nothing changed.
- No preamble, no reassurance, no hedging, no emoji.
- Never promise safety. Say what to do and what the timing is.`;

function buildPrompt(input: VerdictInput, facts: VerdictFacts): string {
  const { judgement, hazard, ground, tuning, address } = input;
  const best = judgement.recommended;
  const naive = judgement.naive;

  const lines: string[] = [
    `ADDRESS: ${address}`,
    `HAZARD: ${hazard.name} (${hazard.kind})`,
    `WIND: ${hazard.wind.speedKph} km/h from ${Math.round(hazard.wind.fromDeg)}°, pushing the fire toward ${Math.round(hazard.wind.toDeg)}°`,
    `PROJECTED SPREAD RATE: ${judgement.field.spreadRateKph} km/h`,
    `PERSON: ${tuning.label} — ${tuning.description}`,
    `DECISION (already made, use it): ${facts.decision}`,
  ];

  if (ground.exitCount != null) {
    lines.push(`ROADS OUT OF THIS AREA: ${ground.exitCount}`);
  }
  const originZone = input.official?.originZone;
  if (originZone) {
    lines.push(
      `OFFICIAL STATUS: this address is inside evacuation zone ${originZone.zoneId} — ${originZone.status.toUpperCase()}.` +
        (originZone.info ? ` Agency wording: "${originZone.info.slice(0, 200)}"` : ''),
    );
  }
  const blocking = (input.official?.closures ?? []).filter((c) => /mainline|connector/i.test(c.facility));
  if (blocking.length > 0) {
    lines.push(
      `OFFICIAL ROAD CLOSURES NEARBY: ${blocking.slice(0, 4).map((c) => `${c.road} (${c.reason})`).join('; ')}`,
    );
  }

  if (best) {
    lines.push(
      '',
      'RECOMMENDED ROUTE:',
      `  ${best.route.summary}`,
      `  heading ${COMPASS_LABELS[best.direction]} to ${best.route.destination.name}`,
      `  ${best.route.distanceKm.toFixed(1)} km, ~${Math.round(best.route.durationMinutes * tuning.paceMultiplier)} min for this person`,
      `  rating ${best.rating}`,
      best.minutesUntilCutoff !== null
        ? `  TIGHTEST POINT: ~${Math.round(best.minutesUntilCutoff)} min of slack before the hazard reaches this road`
        : '  no projected hazard contact within the forecast horizon',
      ...best.reasons.map((r) => `  - ${r}`),
    );
  } else {
    lines.push('', 'NO SAFE ROUTE EXISTS. Every candidate was rejected.');
  }

  if (naive && naive.rating === 'REJECTED') {
    lines.push(
      '',
      'REJECTED FASTEST ROUTE (this is the important one):',
      `  ${naive.route.summary} — ${Math.round(naive.route.durationMinutes)} min, the fastest option`,
      ...naive.reasons.map((r) => `  - ${r}`),
    );
  }

  const otherRejects = judgement.rejected.filter((r) => !r.isNaiveFastest);
  if (otherRejects.length > 0) {
    lines.push(
      '',
      `ALSO REJECTED: ${otherRejects.map((r) => r.route.summary).join('; ')}`,
    );
  }

  lines.push(
    '',
    `LEAVE WITHIN: ${facts.leaveWithinMinutes ?? 'unknown'} minutes`,
    `PERSONALIZATION: ${profileNote(input.profile, tuning)}`,
  );

  return lines.join('\n');
}

const PROSE_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    subhead: { type: 'string' },
    reasoning: { type: 'array', items: { type: 'string' } },
    rejectedSummary: { type: 'string' },
    profileNote: { type: 'string' },
  },
  required: ['headline', 'subhead', 'reasoning', 'rejectedSummary', 'profileNote'],
  additionalProperties: false,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE
// OWNER: DATA
// ═══════════════════════════════════════════════════════════════════════════

let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic {
  anthropicClient ??= new Anthropic({
    apiKey: env.anthropicKey,
    // SDK timeout is in MILLISECONDS. The resilient wrapper also has a deadline;
    // this one aborts the socket rather than just abandoning the promise.
    timeout: TIMEOUTS_MS.verdict,
    maxRetries: 1,
  });
  return anthropicClient;
}

async function callClaude(prompt: string, signal: AbortSignal): Promise<VerdictProse> {
  const client = getAnthropic();

  const params = {
    model: env.anthropicModel,
    // Thinking is on by default on Opus 5 and counts against max_tokens, so
    // leave real headroom even though the JSON we want back is tiny.
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    output_config: {
      // Latency matters more than depth here — the facts are already computed,
      // this is a writing task. Do NOT disable thinking to go faster: on Opus 5
      // that can leak reasoning into the visible output.
      effort: 'low',
      format: { type: 'json_schema', schema: PROSE_SCHEMA },
    },
    // Recommended default on Opus 5: on a policy decline the API re-runs the
    // request on Anthropic's recommended fallback model inside the same call.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user' as const, content: prompt }],
  };

  // The SDK's published types lag the newest beta fields (`fallbacks: "default"`).
  // The request shape is correct on the wire; this cast is the documented
  // workaround until the typings catch up.
  const response = await client.beta.messages.create(params as never, { signal });

  // Opus 5 safety classifiers can decline a request — that is an HTTP 200 with
  // stop_reason "refusal" and an empty content array. Reading content[0] first
  // would throw. Check the stop reason, then fall through to Groq.
  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined the request (stop_reason: refusal)');
  }

  const text = response.content
    .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  return parseProse(text);
}

// ═══════════════════════════════════════════════════════════════════════════
// GROQ — OpenAI-compatible endpoint, plain fetch, no extra dependency.
// OWNER: DATA
// ═══════════════════════════════════════════════════════════════════════════

async function callGroq(prompt: string, signal: AbortSignal): Promise<VerdictProse> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${env.groqKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.groqModel,
      response_format: { type: 'json_object' },
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: `${SYSTEM_PROMPT}\n\nRespond with a single JSON object with keys: headline, subhead, reasoning (array of strings), rejectedSummary, profileNote.`,
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`Groq HTTP ${res.status} ${res.statusText}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return parseProse(body.choices?.[0]?.message?.content ?? '');
}

/** Tolerant of fenced code blocks and stray prose around the JSON. */
function parseProse(raw: string): VerdictProse {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence?.[1]) text = fence[1].trim();
  if (!text.startsWith('{')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
  }

  const parsed = JSON.parse(text) as Partial<VerdictProse>;
  if (!parsed.headline || !parsed.subhead) {
    throw new Error('model response missing headline/subhead');
  }

  return {
    headline: String(parsed.headline).slice(0, 24),
    subhead: String(parsed.subhead).slice(0, 90),
    reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning.map(String).slice(0, 4) : [],
    rejectedSummary: String(parsed.rejectedSummary ?? ''),
    profileNote: String(parsed.profileNote ?? ''),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ASSEMBLY — computed facts always win over model text.
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_HEADLINES: Record<Decision, string> = {
  EVACUATE_NOW: 'EVACUATE NOW',
  EVACUATE_SOON: 'EVACUATE SOON',
  PREPARE: 'GET READY',
  SHELTER_IN_PLACE: 'DO NOT DRIVE',
  MONITOR: 'STAY ALERT',
};

function assemble(
  input: VerdictInput,
  facts: VerdictFacts,
  prose: VerdictProse | null,
  generatedBy: RouteVerdict['generatedBy'],
): RouteVerdict {
  const { judgement, tuning, profile } = input;
  const best = judgement.recommended;

  return {
    decision: facts.decision,
    headline: prose?.headline?.trim() || DEFAULT_HEADLINES[facts.decision],
    subhead: prose?.subhead?.trim() || templateSubhead(input, facts),
    direction: best?.direction ?? null,
    directionLabel: facts.directionLabel,
    // These four are NEVER taken from the model.
    minutesUntilCutoff: facts.minutesUntilCutoff,
    leaveWithinMinutes: facts.leaveWithinMinutes,
    confidence: facts.confidence,
    reasoning:
      prose && prose.reasoning.length > 0 ? prose.reasoning : templateReasoning(input, facts),
    rejectedSummary:
      prose?.rejectedSummary?.trim() || templateRejected(judgement),
    citations: facts.citations,
    generatedBy,
    profileNote: prose?.profileNote?.trim() || profileNote(profile, tuning),
  };
}

function templateSubhead(input: VerdictInput, facts: VerdictFacts): string {
  const best = input.judgement.recommended;
  if (!best) return 'No safe route out. Shelter and call 911.';
  return `Head ${COMPASS_LABELS[best.direction]} — ${best.route.summary}`;
}

function templateReasoning(input: VerdictInput, facts: VerdictFacts): string[] {
  const { judgement, hazard, ground } = input;
  const out: string[] = [];

  // An official order outranks anything we computed. Say it first.
  const zone = input.official?.originZone;
  if (zone?.status === 'order') {
    out.push(`You are inside a mandatory evacuation order (zone ${zone.zoneId}). Go.`);
  } else if (zone?.status === 'warning') {
    out.push(`You are inside an evacuation warning area (zone ${zone.zoneId}).`);
  }
  if (facts.minutesUntilCutoff !== null) {
    out.push(
      `About ${facts.minutesUntilCutoff} min before the fire reaches this road.`,
    );
  }
  out.push(
    `Wind ${hazard.wind.speedKph} km/h is pushing the fire ${COMPASS_LABELS[compassOf(hazard.wind.toDeg)]} at about ${judgement.field.spreadRateKph} km/h.`,
  );
  if (ground.exitCount === 1) {
    out.push('There is only one road out of this area. It will fill up.');
  }
  if (judgement.naiveWasRejected) {
    out.push('The fastest route was refused — it runs into the fire’s path.');
  }
  return out.slice(0, 4);
}

function templateRejected(judgement: JudgeResult): string | null {
  const naive = judgement.naive;
  if (!naive || naive.rating !== 'REJECTED') return null;
  // Rounding a −0.5 min deficit to "0 min before you would" reads as nonsense.
  // Under a minute, say it in words.
  const deficit = naive.minutesUntilCutoff;
  const when =
    deficit === null || deficit >= 0
      ? ''
      : Math.abs(deficit) < 1.5
        ? ' The fire reaches it at almost exactly the moment you would.'
        : ` The fire reaches it about ${Math.round(Math.abs(deficit))} min before you would.`;
  return `The fastest route (${naive.route.summary}, ${Math.round(naive.route.durationMinutes)} min) was rejected.${when}`;
}

function compassOf(deg: number) {
  const idx = Math.round((((deg % 360) + 360) % 360) / 45) % 8;
  return (['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const)[idx]!;
}
