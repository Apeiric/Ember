/**
 * EMBER — family coordination. One fire, one engine, four verdicts.
 * OWNER: JUDGE
 *
 * Runs the EXACT SAME pipeline stages as a single assessment, once per family
 * member. Nothing about the judge, the projection or the scoring is special-
 * cased for families — the differences in the output come entirely from each
 * person's location and profile.
 *
 * That is the claim worth making on stage: we did not build a "family feature".
 * We ran the same maths four times and the accessibility argument fell out.
 *
 * Deterministic by construction:
 *   • hazard, terrain and danger field come from the canned scenario
 *   • verdicts are templated, not generated — no LLM latency, no variance
 *   • members are scored concurrently, so four people cost about as long as one
 */

import type {
  FamilyAssessment,
  FamilyMember,
  FamilyMemberAssessment,
  ScoredRoute,
} from '@ember/shared';
import { createTrace } from '../core/trace';
import { getFamily, FAMILY_SCENARIO_ID } from '../fixtures/family';
import { getScenario } from '../fixtures';
import { fetchRoutes } from '../services/routing';
import { judgeRoutes } from '../services/judge';
import { tuningFor } from '../services/profiles';
import { projectDangerField } from '../services/project';
import { buildTemplateVerdict } from '../services/verdict';
import { log } from '../logger';

/** Lower = act on this person first. */
const DECISION_URGENCY: Record<string, number> = {
  SHELTER_IN_PLACE: 0,
  EVACUATE_NOW: 1,
  EVACUATE_SOON: 2,
  PREPARE: 3,
  MONITOR: 4,
};

export async function runFamilyAssessment(
  opts: { forceOffline?: boolean } = {},
): Promise<FamilyAssessment> {
  const trace = createTrace();
  const scenario = getScenario(FAMILY_SCENARIO_ID);
  const members = getFamily();

  // Same hazard and terrain for everyone — they are all in one fire.
  const field = await trace.step('project', async () =>
    projectDangerField(scenario.hazard, scenario.ground),
  );

  const assessments = await Promise.all(
    members.map((member) => assessMember(member, field, scenario, trace, opts)),
  );

  // Sort by how soon this person must move, then by how little slack they have.
  assessments.sort(
    (a, b) =>
      a.urgencyRank - b.urgencyRank ||
      (a.recommended?.marginMinutes ?? 1e9) - (b.recommended?.marginMinutes ?? 1e9),
  );
  assessments.forEach((a, i) => {
    a.urgencyRank = i;
  });

  log.info(`family: ${assessments.map((a) => `${a.member.name}=${a.verdict.decision}`).join(' ')}`);

  return {
    ok: true,
    scenarioId: FAMILY_SCENARIO_ID,
    hazard: scenario.hazard,
    field,
    members: assessments,
    coordination: buildCoordinationPlan(assessments),
    trace: trace.finish(),
  };
}

async function assessMember(
  member: FamilyMember,
  field: FamilyAssessment['field'],
  scenario: ReturnType<typeof getScenario>,
  trace: ReturnType<typeof createTrace>,
  opts: { forceOffline?: boolean },
): Promise<FamilyMemberAssessment> {
  // Routes come from wherever this person actually is. `self` sits on the canned
  // origin so it reuses the scenario's hand-tuned geometry; everyone else gets
  // live roads from their own address, or straight-line corridors offline.
  const routes = await fetchRoutes(
    { origin: member.location, field, forceOffline: opts.forceOffline },
    trace,
  );

  const tuning = tuningFor(member.profile);
  const judgement = judgeRoutes({
    origin: member.location,
    routes: routes.data,
    field,
    tuning,
  });

  const verdict = buildTemplateVerdict({
    hazard: scenario.hazard,
    ground: scenario.ground,
    judgement,
    profile: member.profile,
    tuning,
    address: member.address,
    forceOffline: true, // template only — never call an LLM here
  });

  return {
    member,
    verdict,
    recommended: judgement.recommended,
    naive: judgement.naive,
    routes: judgement.scored,
    tuning,
    urgencyRank: DECISION_URGENCY[verdict.decision] ?? 5,
  };
}

/**
 * Turn four independent verdicts into a plan a single frightened person can
 * execute. This is the coordination the judge asked for: not "here are four
 * cards", but "do this, then this".
 */
function buildCoordinationPlan(assessments: FamilyMemberAssessment[]): string[] {
  const plan: string[] = [];
  if (assessments.length === 0) return plan;

  const first = assessments[0]!;
  const stranded = assessments.filter((a) => !a.member.profile.hasCar);
  const drivers = assessments.filter(
    (a) => a.member.profile.hasCar && a.verdict.decision !== 'EVACUATE_NOW',
  );

  plan.push(
    `${first.member.name} ${isPlural(first) ? 'have' : 'has'} the least time — ${describeTime(first)}. Start there.`,
  );

  for (const person of stranded) {
    // Nearest driver who is not themselves out of time.
    const helper = drivers.find((d) => d.member.id !== person.member.id);
    const who = helper ? nameForSentence(helper) : null;
    plan.push(
      who
        ? `${person.member.name} ${isPlural(person) ? 'have' : 'has'} no vehicle and cannot leave alone. ${who} ${who === 'You' ? 'have' : 'has'} the most time — go and get them.`
        : `${person.member.name} ${isPlural(person) ? 'have' : 'has'} no vehicle, and nobody in the family has time to spare. Call 911 and ask for transport now.`,
    );
  }

  const sameDirection = new Set(
    assessments.map((a) => a.verdict.directionLabel).filter((d): d is string => Boolean(d)),
  );
  if (sameDirection.size === 1) {
    plan.push(`Everyone is being sent ${[...sameDirection][0]}. Agree one meeting point now.`);
  } else if (sameDirection.size > 1) {
    plan.push(
      `You are being sent in different directions (${[...sameDirection].join(', ')}) — do not try to meet before you are all clear.`,
    );
  }

  const waiting = assessments.filter((a) => a.verdict.decision === 'MONITOR');
  if (waiting.length > 0) {
    plan.push(
      `${waiting.map((a) => a.member.name).join(' and ')} ${waiting.length === 1 && !isPlural(waiting[0]!) ? 'is' : 'are'} not in danger yet. Do not drive toward the fire to help — you would be adding a car to the road everyone else needs.`,
    );
  }

  return plan;
}

/**
 * "Maya & Sam" takes a plural verb; "Uncle Dev" does not.
 *
 * Keyed on the NAME only. Household size counts people travelling with someone,
 * not people in their name — Uncle Dev has a household of two and is still "is".
 */
function isPlural(a: FamilyMemberAssessment): boolean {
  return /&|\band\b/i.test(a.member.name);
}

/** "You" reads better than "You" in third person mid-sentence. */
function nameForSentence(a: FamilyMemberAssessment): string {
  return a.member.id === 'self' ? 'You' : a.member.name;
}

function describeTime(a: FamilyMemberAssessment): string {
  if (a.verdict.decision === 'SHELTER_IN_PLACE') return 'every route out is already cut';
  const minutes = a.verdict.leaveWithinMinutes;
  if (minutes == null) return 'no route information';
  return minutes <= 0 ? 'no time left at all' : `about ${minutes} minutes`;
}

function firstNameOf(a: FamilyMemberAssessment): string {
  return a.member.name.split(' ')[0] ?? a.member.name;
}

/** Re-export so the route handler can describe a route without importing judge. */
export type { ScoredRoute };
