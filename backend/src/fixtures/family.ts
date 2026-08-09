/**
 * EMBER — canned family, for the coordination view.
 * OWNER: FRONTEND (demo) + JUDGE (profiles)
 *
 * Four real people at four real Los Angeles locations, all inside the Palisades
 * scenario. Canned and deterministic — no accounts, no live tracking, no
 * multi-user infrastructure. The demo needs a household, not a backend.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS THE ACCESSIBILITY ARGUMENT, NOT JUST A FEATURE:
 *
 * One fire. One engine. Four people who get four different answers, because
 * "evacuate" is not one instruction — it depends on how fast you can actually
 * move. An official alert tells this entire family the same thing. Ember tells
 * the grandmother she is already out of time while telling her grandson he has
 * half an hour, and it says so BEFORE anyone has to work that out under stress.
 *
 * Each `situation` field is the plain sentence a human would say. It is what the
 * onboarding flow turns into `profile` numbers — shown in the UI so the user can
 * see exactly why their grandmother's verdict is harsher than theirs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { FamilyMember } from '@ember/shared';

export const FAMILY: FamilyMember[] = [
  {
    id: 'self',
    name: 'You',
    relationship: 'You',
    address: '1500 Palisades Dr, Pacific Palisades',
    // The canned Palisades origin — same house the single-person demo uses.
    location: { lat: 34.0709, lng: -118.5556 },
    profile: { mobility: 'standard', hasCar: true, householdSize: 1 },
    situation: 'Healthy adult, car in the driveway, can leave in a few minutes.',
  },
  {
    id: 'grandma',
    name: 'Grandma Rose',
    relationship: 'Grandmother',
    address: '881 Alma Real Dr, Pacific Palisades',
    // A few hundred metres down the hill, still in the Highlands.
    location: { lat: 34.0466, lng: -118.5223 },
    profile: { mobility: 'vulnerable', hasCar: true, householdSize: 1, hasPets: true },
    situation:
      'Eighty-one, uses a walker and is on oxygen. Drives, but slowly, and needs help loading the tank. Has a cat.',
  },
  {
    id: 'kids',
    name: 'Maya & Sam',
    relationship: 'Kids at school',
    address: 'Palisades Charter High School',
    location: { lat: 34.0407, lng: -118.5265 },
    // No car, and children move as a group at the pace of the slowest.
    profile: { mobility: 'vulnerable', hasCar: false, householdSize: 2 },
    situation: 'Both at school, no vehicle. Cannot leave until an adult reaches them.',
  },
  {
    id: 'uncle',
    name: 'Uncle Dev',
    relationship: 'Uncle (across town)',
    address: 'Brentwood, Los Angeles',
    // East of the fire, on the far side of Sunset — a different problem entirely.
    location: { lat: 34.0522, lng: -118.4712 },
    profile: { mobility: 'standard', hasCar: true, householdSize: 2 },
    situation: 'Across town in Brentwood with a car. Can drive to collect someone.',
  },
];

export const FAMILY_SCENARIO_ID = 'palisades-2025';

export function getFamily(): FamilyMember[] {
  return FAMILY;
}
