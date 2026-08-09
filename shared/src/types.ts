/**
 * EMBER — canonical shared types. SINGLE SOURCE OF TRUTH.
 *
 * OWNER: ALL THREE (changes here require a 30-second heads-up in chat —
 * this file is the contract between the three of you).
 *
 * `backend/src/types.ts` and `frontend/src/types.ts` both re-export this file,
 * so there is exactly one definition of every shape in the system.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * HAZARD-AGNOSTIC DESIGN NOTE (this is a pitch point — read it):
 *
 * The judge (`backend/src/services/judge.ts`) never sees the word "fire". It
 * consumes a `DangerField`: a set of polygons, each with a severity 0..1 and an
 * "arrives in N minutes" timestamp. Wildfire is one producer of a DangerField.
 * Flood (water rising downhill over time) and earthquake (aftershock / liquefaction
 * zones) are *different producers of the same structure*. Swapping hazards =
 * swapping the projector in `hazards.ts` + `project.ts`. The routing engine,
 * the scoring, the personalization, and the verdict are unchanged.
 *
 * TODAY WE BUILD FIRE ONLY. See CONTEXT.md §9 SCOPE DISCIPLINE.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ═══════════════════════════════════════════════════════════════════════════
// GEOMETRY
// ═══════════════════════════════════════════════════════════════════════════

export interface LatLng {
  lat: number;
  lng: number;
}

/** A closed ring of points. First/last need not be identical — we close it for you. */
export type Polygon = LatLng[];

/** Bounding box in [west, south, east, north] order (GeoJSON convention). */
export type BBox = [number, number, number, number];

export type CompassDirection = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

// ═══════════════════════════════════════════════════════════════════════════
// PROVENANCE — every piece of data says where it came from.
//
// This is not decoration. It powers the "LIVE DATA" / "DEMO DATA" badge in the
// UI, it keeps us honest on stage when an API is down, and it is a genuine
// differentiator: we degrade loudly rather than lying quietly.
// ═══════════════════════════════════════════════════════════════════════════

export type DataSource =
  /** Fetched from the real upstream API just now. */
  | 'live'
  /** Served from our in-process TTL cache (was live within the last few minutes). */
  | 'cached'
  /** Hardcoded real-world scenario. Real event, frozen snapshot. Demo-safe. */
  | 'canned'
  /** Synthetic placeholder. Not a real measurement. */
  | 'mock';

export interface Provenance {
  source: DataSource;
  /** Human-readable provider name, e.g. "NIFC ArcGIS", "NASA FIRMS", "canned:palisades-2025". */
  provider: string;
  fetchedAt: string;
  /** Shown in the trace panel — say something true and specific. */
  note?: string;
  url?: string;
}

export interface Sourced<T> {
  data: T;
  provenance: Provenance;
}

// ═══════════════════════════════════════════════════════════════════════════
// HAZARD — what is burning, and which way the weather is pushing it.
// OWNER: DATA
// ═══════════════════════════════════════════════════════════════════════════

export type HazardKind = 'wildfire' | 'flood' | 'earthquake';

export interface Wind {
  speedKph: number;
  gustKph?: number;
  /** Meteorological convention: the direction the wind blows FROM. */
  fromDeg: number;
  /** Direction the wind blows TOWARD = (fromDeg + 180) % 360. Fire travels this way. */
  toDeg: number;
  observedAt: string;
  station?: string;
}

export interface Hotspot {
  location: LatLng;
  /** 0..1 detection confidence from FIRMS. */
  confidence: number;
  brightnessK?: number;
  detectedAt: string;
}

export interface Hazard {
  id: string;
  kind: HazardKind;
  name: string;
  /** Multipolygon: a fire can have several disjoint burn areas. */
  perimeter: Polygon[];
  hotspots: Hotspot[];
  wind: Wind;
  discoveredAt: string;
  acres?: number;
  containmentPct?: number;
  /** Per-feed provenance — the perimeter can be live while the wind is canned. */
  provenance: {
    perimeter: Provenance;
    hotspots: Provenance;
    wind: Provenance;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DANGER FIELD — THE HAZARD-AGNOSTIC INTERFACE. The judge consumes only this.
//
// A DangerField answers exactly one question:
//   "How dangerous is point P at time T minutes from now?"
//
// It is a set of nested time rings. Zone with arrivesInMinutes=0 is burning NOW;
// arrivesInMinutes=30 is where the projection says fire reaches in half an hour.
// ═══════════════════════════════════════════════════════════════════════════

export interface DangerZone {
  id: string;
  polygon: Polygon;
  /** 0..1. >= LETHAL_DANGER (see constants) means "do not route through here, ever". */
  severity: number;
  /** Minutes from now until this zone becomes dangerous. 0 = already dangerous. */
  arrivesInMinutes: number;
  /** Shown to the user, e.g. "Active fire perimeter", "Projected spread @ 30 min". */
  label: string;
  /**
   * Advisory zones count toward cumulative exposure but never trigger a cutoff
   * or a rejection.
   *
   * Needed for evacuation-order areas. An order means "leave here", not "this
   * ground is lethal" — and the person we are routing is usually standing
   * inside one. Treating it as ordinary danger makes their own doorstep a
   * hazard, drives `minutesUntilCutoff` negative before they move, and returns
   * SHELTER IN PLACE to someone who has simply been told to evacuate.
   *
   * As exposure, it does the right thing for free: a route that leaves the
   * ordered area quickly accrues little, one that drives deep into it accrues a
   * lot, and the judge prefers the former without any special-casing.
   */
  advisory?: boolean;
  /**
   * How far outside the polygon this hazard still hurts you, km.
   * Defaults to `DANGER_FALLOFF_KM` when omitted.
   *
   * This is per-zone because reach genuinely differs by hazard. You cannot
   * stand 50 m from a fire front, so a fire zone has a wide shoulder. A
   * gridlocked road or a downed line has almost none — the next street over is
   * fine. Using the fire shoulder for a road closure closes every road within
   * 800 m of it, which is how one traffic report strands a whole family.
   */
  falloffKm?: number;
}

export interface DangerField {
  hazardId: string;
  kind: HazardKind;
  /** Ordered ascending by `arrivesInMinutes` — the judge relies on this. */
  zones: DangerZone[];
  /** Bearing the hazard is travelling toward, degrees from north. */
  spreadBearingDeg: number;
  /** Estimated rate of spread, km/h. */
  spreadRateKph: number;
  /** How far into the future the field is defined. Beyond this we return `null`, not a guess. */
  horizonMinutes: number;
  /** Identifier for the projection model used. Keep this honest. */
  model: string;
  /**
   * Plain-English statement of what this projection is and is not.
   * Rendered in the UI and quoted in the pitch. DO NOT delete to save space.
   */
  disclaimer: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUND TRUTH — terrain + physical exits. OWNER: DATA (Mireye)
// ═══════════════════════════════════════════════════════════════════════════

export interface Exit {
  name: string;
  bearingDeg: number;
  direction: CompassDirection;
  kind: 'highway' | 'arterial' | 'residential' | 'unknown';
}

export interface GroundContext {
  elevationM: number | null;
  /** Slope of the terrain at the origin, percent. Fire runs ~2x faster per +10°. */
  slopePct: number | null;
  /** Downhill aspect, degrees from north. */
  aspectDeg: number | null;
  terrain: string | null;
  /**
   * How many distinct roads lead out of this neighbourhood.
   * `1` is the Paradise/Palisades Highlands death-trap case — call it out loudly.
   */
  exitCount: number | null;
  exits: Exit[];
  provenance: Provenance;
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES — OWNER: JUDGE
// ═══════════════════════════════════════════════════════════════════════════

export type DestinationKind = 'shelter' | 'city' | 'highway' | 'coast' | 'safe-zone';

export interface Destination {
  id: string;
  name: string;
  location: LatLng;
  kind: DestinationKind;
}

export interface RouteSegment {
  index: number;
  start: LatLng;
  end: LatLng;
  distanceKm: number;
  durationMinutes: number;
  /** Minutes from departure until you REACH `end`. This is what makes routing time-aware. */
  cumulativeMinutes: number;
  /**
   * Road this segment is on, e.g. "Sunset Blvd". From Google's step
   * instructions, or authored on canned routes.
   *
   * Load-bearing for field reports: without it, "Sunset Blvd is blocked" can
   * only be resolved to a whole ROUTE, and blocking a whole route also blocks
   * the shared spine every other route leaves the house on — so one report
   * strands you completely. With it, the block lands on the actual road.
   */
  roadName?: string;
  /** Filled in by ground.ts when Mireye terrain data is available. */
  gradePct?: number;
  elevationGainM?: number;
}

export interface Route {
  id: string;
  /** Short human label, e.g. "Sunset Blvd → PCH South". */
  summary: string;
  path: LatLng[];
  segments: RouteSegment[];
  distanceKm: number;
  durationMinutes: number;
  destination: Destination;
  provenance: Provenance;
}

// ═══════════════════════════════════════════════════════════════════════════
// JUDGEMENT — THE CORE. OWNER: JUDGE
// ═══════════════════════════════════════════════════════════════════════════

export type RouteRating =
  /** Clears the danger field with margin to spare. */
  | 'SAFE'
  /** Passable but tight — you would be cutting it close, or brushing high danger. */
  | 'MARGINAL'
  /** Crosses lethal danger, or the hazard arrives before you do. Do not take it. */
  | 'REJECTED';

/** The moment a route meets danger. This is the "betrayal" data point. */
export interface DangerContact {
  segmentIndex: number;
  location: LatLng;
  /** Minutes into the trip when you would be here. */
  minutesIntoTrip: number;
  /** Danger value 0..1 at that place and time. */
  danger: number;
  zoneId: string;
  zoneLabel: string;
}

export interface ScoredRoute {
  route: Route;
  rating: RouteRating;
  /**
   * CUMULATIVE danger integrated over the whole escape (danger x minutes exposed).
   * Lower is safer. This is the number that makes us different from snapshot routing.
   */
  exposureScore: number;
  /** Worst single danger value encountered anywhere on the route. */
  peakDanger: number;
  /** First place the route meets meaningful danger, or null if it never does. */
  firstContact: DangerContact | null;
  /**
   * Minutes of slack: the smallest gap anywhere on the route between when danger
   * arrives at a point and when YOU arrive at that point. Negative = fire wins.
   * `null` = the route never meets danger inside the projection horizon.
   * THIS IS THE NUMBER ON THE VERDICT CARD ("~40 min before this road is cut off").
   */
  minutesUntilCutoff: number | null;
  /** Same as above, after subtracting this profile's safety buffer + prep time. */
  marginMinutes: number | null;
  /** Machine-generated, human-readable justifications. Feed straight to Claude. */
  reasons: string[];
  /** Straight-line bearing origin → destination. Drives "head WEST". */
  bearingDeg: number;
  direction: CompassDirection;
  /** True for the route Google would have picked (fastest by duration). */
  isNaiveFastest: boolean;
  /** Total climb, metres. Used to prefer flatter routes for vulnerable profiles. */
  climbM: number;
  /**
   * WHERE the race is decided: the exact point on this route with the least
   * slack between your arrival and the danger's. On a rejected route this is
   * the spot the fire beats you to — the map marks it, because a rejection you
   * can point at is believable and an invisible one is not.
   * `null` when the route never meets projected danger.
   */
  pinch: {
    location: LatLng;
    /** Slack at that point, minutes. Negative = the hazard gets there first. */
    slackMinutes: number;
    /** How far into YOUR trip that point is, minutes (prep included). */
    minutesIntoTrip: number;
  } | null;
}

export interface JudgeResult {
  /** Every candidate, best-first. Includes rejected ones — we show our work. */
  scored: ScoredRoute[];
  /** The route we tell the user to take. `null` if every option is lethal. */
  recommended: ScoredRoute | null;
  /** Fastest route regardless of safety — "what your phone would do". */
  naive: ScoredRoute | null;
  rejected: ScoredRoute[];
  /** True when nothing survived. Verdict flips to SHELTER_IN_PLACE. */
  allRoutesDangerous: boolean;
  /** True when the naive route was rejected: the demo's money shot. */
  naiveWasRejected: boolean;
  field: DangerField;
}

// ═══════════════════════════════════════════════════════════════════════════
// PERSONALIZATION — OWNER: JUDGE
// ═══════════════════════════════════════════════════════════════════════════

export type Mobility = 'standard' | 'vulnerable';

export interface UserProfile {
  mobility: Mobility;
  hasCar: boolean;
  householdSize?: number;
  hasPets?: boolean;
}

/** Numeric knobs derived from a UserProfile. Pure data — see `profiles.ts`. */
export interface ProfileTuning {
  label: string;
  description: string;
  /** Travel-time multiplier. 1.0 = healthy adult driving. Walking is ~8x. */
  paceMultiplier: number;
  /** Minutes to actually get out the door before wheels move. */
  prepMinutes: number;
  /** Extra buffer required between you and the fire before we call a route SAFE. */
  safetyMarginMinutes: number;
  /** How much a steep route is penalised (0 = don't care). */
  slopePenalty: number;
  /** Danger above this on any route point is unacceptable for this person. */
  maxTolerableDanger: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// VERDICT — what the human actually reads. OWNER: DATA (Claude) + FRONTEND (UI)
// ═══════════════════════════════════════════════════════════════════════════

export type Decision =
  | 'EVACUATE_NOW'
  | 'EVACUATE_SOON'
  | 'PREPARE'
  | 'SHELTER_IN_PLACE'
  | 'MONITOR';

export interface Citation {
  label: string;
  source: string;
  url?: string;
  retrievedAt?: string;
}

export interface RouteVerdict {
  decision: Decision;
  /** ONE instruction, huge, on screen. e.g. "EVACUATE NOW". Max ~18 chars. */
  headline: string;
  /** e.g. "Head WEST on Sunset Blvd toward the coast". Max ~60 chars. */
  subhead: string;
  direction: CompassDirection | null;
  directionLabel: string | null;
  minutesUntilCutoff: number | null;
  leaveWithinMinutes: number | null;
  confidence: 'high' | 'moderate' | 'low';
  /** 2–4 short bullets. Why this verdict. */
  reasoning: string[];
  /** One line about the route we threw away. This is the betrayal, in words. */
  rejectedSummary: string | null;
  citations: Citation[];
  generatedBy: 'claude' | 'groq' | 'template';
  /** How this verdict differs because of who the user is. Drives the demo kicker. */
  profileNote: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// FIELD REPORTS — messy human language, structured by Claude.
//
// ─────────────────────────────────────────────────────────────────────────────
// THE DIVISION OF LABOUR, AND WHY IT IS THE WHOLE PITCH:
//
//   Claude reads   "the fire jumped Sunset, it's blocked, heavy smoke east side"
//   and produces   RoadBlock{ road: "Sunset Blvd" }, ReportedDanger{ east side }
//
//   Then GEOMETRY decides whether to believe it. An extracted road only counts
//   if it actually intersects a candidate route we already hold. A model that
//   hallucinates "Mildred Ave" gets silently dropped, because no route touches
//   it. Claude proposes; geometry disposes.
//
//   Then the JUDGE — completely unchanged — re-runs. A blocked road enters the
//   system as a lethal DangerZone, which the judge already knows how to reject.
//   The language model never decides whether a route is safe.
// ─────────────────────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

export type ReportConfidence = 'high' | 'medium' | 'low';

export interface RoadBlock {
  /** Road name exactly as the human said it, e.g. "Sunset Blvd". */
  road: string;
  /** Where we managed to place it. `null` = named but not locatable. */
  location: LatLng | null;
  /** Why it is impassable, in the reporter's words. */
  reason: string;
  confidence: ReportConfidence;
  /**
   * TRUE only once we matched this road against real route geometry.
   * Unverified blocks are shown to the user but NEVER fed to the judge.
   */
  verified: boolean;
  /** Route ids this block actually sits on. Empty ⇒ we could not corroborate it. */
  affectsRouteIds: string[];
  /**
   * Exactly which segments are shut, as `{routeId, segmentIndex}` pairs. The
   * judge only sees danger over THESE segments, so a closure on one road does
   * not silently close every route that happens to share a driveway.
   */
  affectedSegments: { routeId: string; segmentIndex: number }[];
}

export interface ReportedDanger {
  description: string;
  location: LatLng | null;
  radiusKm: number;
  /** 0..1, mapped from how the human described it. */
  severity: number;
  confidence: ReportConfidence;
  verified: boolean;
}

export interface FieldReport {
  id: string;
  /** Exactly what the human typed. Never paraphrased — this is the audit record. */
  rawText: string;
  receivedAt: string;
  blocks: RoadBlock[];
  dangers: ReportedDanger[];
  /** One-line reading of the report, for the UI. */
  summary: string;
  /** Things Claude flagged but we could not place on the map. Shown, not used. */
  unresolved: string[];
  interpretedBy: 'claude' | 'groq' | 'heuristic';
}

/** What changed after a report was folded in. Drives the "watch the route change" beat. */
export interface ReportImpact {
  report: FieldReport;
  /** Route the user was on before the report arrived. */
  previousRouteId: string | null;
  /** Route they are on now. Different ⇒ we rerouted them. */
  currentRouteId: string | null;
  rerouted: boolean;
  /** Routes this report knocked out. */
  newlyRejectedRouteIds: string[];
  /** Minutes of slack before vs after. */
  previousCutoffMinutes: number | null;
  currentCutoffMinutes: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// OFFICIAL GROUND TRUTH — closures and evacuation orders from the agencies
// that actually own those decisions.
//
// A field report is one person's claim. THIS is the state saying a road is shut
// or an area must be cleared. It carries more weight and needs no verification
// step — the authority IS the verification.
// ═══════════════════════════════════════════════════════════════════════════

export interface RoadClosure {
  id: string;
  /** State route designation, e.g. "SR-1", "I-405". */
  road: string;
  /** Human location, e.g. "Pacific Coast Hwy near Topanga Canyon Blvd". */
  description: string;
  from: LatLng;
  to: LatLng;
  /** Why it is shut, e.g. "Roadway Excavation", "Permanent Road Closure of Hwy". */
  reason: string;
  /** Mainline / On Ramp / Off Ramp / Connector — a shut ramp is not a shut freeway. */
  facility: string;
  startsAt: string | null;
  endsAt: string | null;
  indefinite: boolean;
}

export type EvacuationStatus = 'order' | 'warning' | 'advisory' | 'unknown';

export interface EvacuationZone {
  id: string;
  /** Agency zone code, e.g. "LFD-1239". What officials say on the radio. */
  zoneId: string;
  status: EvacuationStatus;
  county: string | null;
  city: string | null;
  /** The agency's own wording. Quote it — do not paraphrase an official order. */
  info: string | null;
  polygon: Polygon;
}

export interface OfficialContext {
  closures: RoadClosure[];
  zones: EvacuationZone[];
  /** The evacuation zone the user is standing in, if any. Drives the verdict. */
  originZone: EvacuationZone | null;
  provenance: {
    closures: Provenance;
    zones: Provenance;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FAMILY COORDINATION — same fire, same engine, one verdict per person.
//
// Canned and deterministic. No multi-user infrastructure, no live tracking:
// four real profiles at four real locations, each scored by the same judge.
// The point is that ACCESSIBILITY and COORDINATION fall out of the same maths.
// ═══════════════════════════════════════════════════════════════════════════

export interface FamilyMember {
  id: string;
  name: string;
  /** "You", "Grandmother", "Uncle", "Kids". */
  relationship: string;
  address: string;
  location: LatLng;
  profile: UserProfile;
  /** The human sentence this profile came from. Shown in the UI as provenance. */
  situation?: string;
  /**
   * The things this person CANNOT leave without — oxygen tank, EpiPen, meds,
   * the cat. Surfaced as a grab-list in the escape plan's "get out the door"
   * step, because forgetting the EpiPen means going back into the smoke.
   */
  essentials?: string[];
}

export interface FamilyMemberAssessment {
  member: FamilyMember;
  verdict: RouteVerdict;
  recommended: ScoredRoute | null;
  naive: ScoredRoute | null;
  routes: ScoredRoute[];
  tuning: ProfileTuning;
  /** Ascending = act on this person first. Computed, not authored. */
  urgencyRank: number;
}

export interface FamilyAssessment {
  ok: true;
  scenarioId: string;
  hazard: Hazard;
  field: DangerField;
  /** Sorted most-urgent-first. */
  members: FamilyMemberAssessment[];
  /** Plain-language coordination plan derived from the sorted verdicts. */
  coordination: string[];
  trace: Trace;
}

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE TRACE — observability. Renders as the debug panel; judges love it.
// ═══════════════════════════════════════════════════════════════════════════

export type StageStatus = 'ok' | 'fallback' | 'failed' | 'skipped';

export interface TraceStage {
  name: string;
  status: StageStatus;
  ms: number;
  provider?: string;
  source?: DataSource;
  note?: string;
  error?: string;
}

export interface Trace {
  id: string;
  startedAt: string;
  totalMs: number;
  stages: TraceStage[];
  /** True if ANY stage fell back. The UI shows a "DEGRADED / DEMO DATA" badge. */
  degraded: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// API CONTRACT — POST /api/assess
// ═══════════════════════════════════════════════════════════════════════════

export interface AssessRequest {
  address: string;
  profile: UserProfile;
  /** Pin a specific canned scenario. Omit to auto-select the nearest active fire. */
  scenarioId?: string;
  /** Demo switch: skip every network call and run purely on canned data. */
  forceOffline?: boolean;
  /**
   * Skip the language-model prose pass and answer with the deterministic
   * template immediately. Used for field-report re-runs: when someone says a
   * road is blocked, the re-judged routes should appear in seconds — polish
   * can wait, the decision cannot.
   */
  fastVerdict?: boolean;
  /**
   * Free-text situation reports gathered so far, oldest first. Each is parsed by
   * Claude into structured facts, geometrically verified, and folded into the
   * danger field before the judge runs.
   */
  reports?: string[];
}

export interface Origin {
  query: string;
  formattedAddress: string;
  location: LatLng;
  provenance: Provenance;
}

export interface AssessResponse {
  ok: true;
  scenarioId: string | null;
  origin: Origin;
  hazard: Hazard;
  field: DangerField;
  profile: UserProfile;
  tuning: ProfileTuning;
  ground: GroundContext;
  /** Every candidate route, scored, best-first. */
  routes: ScoredRoute[];
  recommended: ScoredRoute | null;
  /** The route Google would have given you. Draw this in RED. */
  naive: ScoredRoute | null;
  verdict: RouteVerdict;
  /** Official closures and evacuation orders in effect around the origin. */
  official: OfficialContext;
  /** Structured facts extracted from any field reports supplied with the request. */
  reports: FieldReport[];
  /** What the most recent report changed. `null` when no report was supplied. */
  impact: ReportImpact | null;
  trace: Trace;
}

export interface ApiError {
  ok: false;
  error: string;
  detail?: string;
  trace?: Trace;
}

export type AssessResult = AssessResponse | ApiError;

/** Lightweight scenario descriptor for the demo scenario picker. */
export interface ScenarioSummary {
  id: string;
  name: string;
  region: string;
  date: string;
  demoAddress: string;
  headline: string;
  center: LatLng;
}
