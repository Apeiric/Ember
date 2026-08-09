/**
 * EMBER — display formatting + the decision→visual-language mapping.
 * OWNER: FRONTEND
 *
 * One place decides what each decision LOOKS like, so the map, the verdict card
 * and the route list can never disagree about whether this is an emergency.
 */

import type { Decision, RouteRating } from '@ember/shared';

export interface DecisionStyle {
  /** Full-bleed background for the verdict card. */
  bg: string;
  /** Accent used for the countdown and the border. */
  accent: string;
  border: string;
  /** True only for the one state that should physically pulse. */
  urgent: boolean;
  kicker: string;
}

export const DECISION_STYLE: Record<Decision, DecisionStyle> = {
  EVACUATE_NOW: {
    bg: 'bg-gradient-to-br from-alarm-600 via-alarm-700 to-ash-950',
    accent: 'text-white',
    border: 'border-alarm-400/60',
    urgent: true,
    kicker: 'Leave immediately. Do not pack.',
  },
  EVACUATE_SOON: {
    bg: 'bg-gradient-to-br from-ember-600 via-ember-700 to-ash-950',
    accent: 'text-white',
    border: 'border-ember-400/60',
    urgent: false,
    kicker: 'Go now while the road is open.',
  },
  PREPARE: {
    bg: 'bg-gradient-to-br from-caution-500 via-ember-700 to-ash-950',
    accent: 'text-white',
    border: 'border-caution-400/50',
    urgent: false,
    kicker: 'Load the car. Be ready to move.',
  },
  SHELTER_IN_PLACE: {
    bg: 'bg-gradient-to-br from-ash-700 via-alarm-700 to-ash-950',
    accent: 'text-white',
    border: 'border-alarm-400/60',
    urgent: true,
    kicker: 'Every route out is cut. Call 911.',
  },
  MONITOR: {
    bg: 'bg-gradient-to-br from-ash-700 via-ash-800 to-ash-950',
    accent: 'text-ash-100',
    border: 'border-ash-600',
    kicker: 'No immediate threat on your routes.',
    urgent: false,
  },
};

export const RATING_STYLE: Record<RouteRating, { text: string; chip: string; dot: string }> = {
  SAFE: {
    text: 'text-safe-400',
    chip: 'bg-safe-500/15 text-safe-400 border-safe-500/30',
    dot: 'bg-safe-400',
  },
  MARGINAL: {
    text: 'text-caution-400',
    chip: 'bg-caution-500/15 text-caution-400 border-caution-500/30',
    dot: 'bg-caution-400',
  },
  REJECTED: {
    text: 'text-alarm-400',
    chip: 'bg-alarm-500/15 text-alarm-400 border-alarm-500/30',
    dot: 'bg-alarm-400',
  },
};

/** Map line colours. Red = what your phone would do. Green = what we say. */
export const ROUTE_COLORS = {
  recommended: '#3ddc84',
  naive: '#f01e1e',
  other: '#6b7689',
  perimeter: '#ff3b1f',
  projection: '#ff8f33',
} as const;

export function formatMinutes(min: number | null | undefined): string {
  if (min == null) return '—';
  const rounded = Math.round(min);
  if (rounded <= 0) return 'NOW';
  if (rounded < 60) return `${rounded} min`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** Big countdown: number and unit rendered separately so they can be sized apart. */
export function splitCountdown(min: number | null | undefined): { value: string; unit: string } {
  if (min == null) return { value: '—', unit: '' };
  const rounded = Math.round(min);
  if (rounded <= 0) return { value: 'NOW', unit: '' };
  if (rounded < 60) return { value: String(rounded), unit: 'min' };
  return { value: (rounded / 60).toFixed(1), unit: 'hr' };
}

export function formatKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

export function formatDecision(d: Decision): string {
  return d.replace(/_/g, ' ');
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'unknown';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  if (days <= 30) return `${days} d ago`;
  // A canned scenario is months or years old. "579 d ago" is technically true
  // and completely useless — show the date the event actually happened.
  return new Date(then).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
