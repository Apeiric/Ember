/**
 * EMBER — personalization tuning. CONTEXT.md §5 step 7.
 * OWNER: JUDGE
 *
 * Pure. Turns "who is this person" into the numeric knobs the judge uses.
 *
 * This is the second half of the innovation: official alerts treat an entire
 * zone identically. An 80-year-old with a walker and a 25-year-old with a car
 * face the same fire and need different answers. Same hazard, same routes,
 * different verdict — because the arithmetic changes.
 */

import { NO_CAR_MODIFIER, PROFILE_TUNING, WALK_SPEED_KPH } from '@ember/shared';
import type { ProfileTuning, UserProfile } from '@ember/shared';

/** Average driving speed a route implies, used to convert driving time to walking time. */
const ASSUMED_DRIVE_KPH = 32;

export function tuningFor(profile: UserProfile): ProfileTuning {
  const base = PROFILE_TUNING[profile.mobility] ?? PROFILE_TUNING.standard;
  const tuning: ProfileTuning = { ...base };

  if (!profile.hasCar) {
    // On foot the whole calculus changes: a 15-minute drive is a two-hour walk,
    // and no amount of "leave early" makes a 20 km route survivable.
    tuning.paceMultiplier = base.paceMultiplier * (ASSUMED_DRIVE_KPH / WALK_SPEED_KPH);
    tuning.prepMinutes = base.prepMinutes + NO_CAR_MODIFIER.extraPrepMinutes;
    tuning.safetyMarginMinutes = base.safetyMarginMinutes + NO_CAR_MODIFIER.extraSafetyMinutes;
    tuning.label = `${base.label}, no vehicle`;
    tuning.description = `${base.description} Travelling on foot — every route takes roughly ${Math.round(
      ASSUMED_DRIVE_KPH / WALK_SPEED_KPH,
    )}x longer.`;
  }

  // Moving several people (and pets) out of a house takes real minutes. These
  // are small, honest adjustments — not a simulation.
  if (profile.householdSize && profile.householdSize > 2) {
    tuning.prepMinutes += Math.min(20, (profile.householdSize - 2) * 4);
  }
  if (profile.hasPets) {
    tuning.prepMinutes += 5;
  }

  return tuning;
}

/** One sentence explaining what this profile changed. Shown on the verdict card. */
export function profileNote(profile: UserProfile, tuning: ProfileTuning): string {
  const parts: string[] = [];

  if (profile.mobility === 'vulnerable') {
    parts.push('reduced mobility means a longer head start and a wider safety margin');
  }
  if (!profile.hasCar) {
    parts.push('travelling on foot multiplies every travel time');
  }
  if (profile.householdSize && profile.householdSize > 2) {
    parts.push(`a household of ${profile.householdSize} takes longer to move`);
  }
  if (profile.hasPets) {
    parts.push('pets add time at the door');
  }

  if (parts.length === 0) {
    return `Assessed as: ${tuning.label}. ${tuning.prepMinutes} min to get out the door, ${tuning.safetyMarginMinutes} min safety buffer.`;
  }
  return `Adjusted because ${parts.join(', ')} — ${tuning.prepMinutes} min to get out the door and a ${tuning.safetyMarginMinutes} min safety buffer.`;
}
