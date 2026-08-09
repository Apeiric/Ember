/**
 * EMBER — THE VERDICT CARD.
 * OWNER: FRONTEND
 *
 * Design + presentation is 45% of the score (CONTEXT.md §11). This component is
 * most of that. It has one job:
 *
 *   A frightened person glances at a phone for three seconds and knows
 *   WHAT TO DO and WHICH WAY TO GO.
 *
 * Rules this component follows, in priority order:
 *   1. ONE instruction, enormous. Everything else is subordinate.
 *   2. The direction is the second thing you see, never buried in prose.
 *   3. The countdown is a number, not a sentence.
 *   4. Only EVACUATE NOW is allowed to pulse. If everything is urgent, nothing is.
 *   5. Reasoning is present but quiet — it earns trust without competing.
 */

import type { RouteVerdict, ScoredRoute } from '@ember/shared';
import { DECISION_STYLE, formatMinutes, splitCountdown } from '../lib/format';

interface Props {
  verdict: RouteVerdict;
  recommended: ScoredRoute | null;
  naive: ScoredRoute | null;
}

export function VerdictCard({ verdict, recommended, naive }: Props) {
  const style = DECISION_STYLE[verdict.decision];
  const countdown = splitCountdown(verdict.leaveWithinMinutes);
  const showBetrayal = naive?.rating === 'REJECTED';

  return (
    <section
      aria-live="assertive"
      className={`animate-slam-in overflow-hidden rounded-xl border ${style.border} ${style.bg} ${
        style.urgent ? 'animate-pulse-alarm' : ''
      }`}
    >
      {/* ── THE INSTRUCTION ────────────────────────────────────────────── */}
      <div className="px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <span className="label !text-white/85">Verdict</span>
          <span className="rounded-full border border-white/20 bg-black/20 px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-white/70">
            {verdict.confidence} confidence
          </span>
        </div>

        <h1
          className={`mt-2 hyphens-none break-words text-verdict font-black uppercase ${style.accent}`}
          style={{ textWrap: 'balance' }}
        >
          {verdict.headline}
        </h1>

        <p className="mt-2 text-[0.95rem] font-medium leading-snug text-white/90">
          {verdict.subhead}
        </p>
        <p className="mt-1 text-xs text-white/85">{style.kicker}</p>
      </div>

      {/* ── DIRECTION + COUNTDOWN ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px border-y border-white/10 bg-white/10">
        {/* min-w-0: grid children default to min-width:auto, so a long word like
            SOUTHEAST would otherwise blow past the column into the countdown. */}
        <div className="min-w-0 bg-black/30 px-5 py-4 sm:px-6">
          <div className="label !text-white/80">Go</div>
          <div className="mt-1 flex items-center gap-1.5">
            {verdict.direction && <CompassArrow direction={verdict.direction} />}
            <span className="min-w-0 text-lg font-black uppercase leading-none tracking-tight text-white sm:text-xl">
              {verdict.directionLabel ?? '—'}
            </span>
          </div>
          {recommended && (
            <div className="mt-1 truncate text-[0.7rem] text-white/85">
              {recommended.route.destination.name}
            </div>
          )}
        </div>

        <div className="min-w-0 bg-black/30 px-5 py-4 sm:px-6">
          <div className="label !text-white/80">Leave within</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className="text-countdown font-black tabular-nums text-white">
              {countdown.value}
            </span>
            {countdown.unit && (
              <span className="text-lg font-bold uppercase text-white/85">{countdown.unit}</span>
            )}
          </div>
          {verdict.minutesUntilCutoff != null && (
            <div className="mt-1 text-[0.7rem] text-white/85">
              road cut off in ~{formatMinutes(verdict.minutesUntilCutoff)}
            </div>
          )}
        </div>
      </div>

      {/* ── THE BETRAYAL ───────────────────────────────────────────────── */}
      {/* The single most important secondary element on the screen. This is the
          sentence the whole demo builds toward, so it gets its own band. */}
      {showBetrayal && verdict.rejectedSummary && (
        <div className="border-b border-white/10 bg-black/40 px-5 py-3 sm:px-6">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 shrink-0 rounded border border-alarm-400/50 bg-alarm-500/20 px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider text-alarm-400">
              Rejected
            </span>
            <p className="text-[0.8rem] leading-snug text-white/85">{verdict.rejectedSummary}</p>
          </div>
        </div>
      )}

      {/* ── WHY ────────────────────────────────────────────────────────── */}
      {verdict.reasoning.length > 0 && (
        <ul className="space-y-1.5 bg-black/25 px-5 py-4 sm:px-6">
          {verdict.reasoning.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-[0.8rem] leading-snug text-white/80">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/40" />
              {line}
            </li>
          ))}
        </ul>
      )}

      {/* ── PERSONALIZATION + PROVENANCE ───────────────────────────────── */}
      <div className="space-y-2 bg-black/40 px-5 py-3 sm:px-6">
        {verdict.profileNote && (
          <p className="text-[0.72rem] leading-snug text-white/85">
            <span className="font-semibold uppercase tracking-wider text-white/80">
              Personalized ·{' '}
            </span>
            {verdict.profileNote}
          </p>
        )}
        <details className="group">
          <summary className="cursor-pointer list-none text-[0.66rem] uppercase tracking-[0.14em] text-white/75 transition-colors hover:text-white/70">
            Sources ({verdict.citations.length}) · written by {verdict.generatedBy}
          </summary>
          <ul className="mt-2 space-y-1">
            {verdict.citations.map((c, i) => (
              <li key={i} className="text-[0.68rem] leading-snug text-white/55">
                <span className="text-white/75">{c.label}</span>
                <span className="text-white/35"> — {c.source}</span>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

/** Rotates to the actual bearing. Reads instantly and needs no legend. */
function CompassArrow({ direction }: { direction: NonNullable<RouteVerdict['direction']> }) {
  const DEGREES: Record<string, number> = {
    N: 0,
    NE: 45,
    E: 90,
    SE: 135,
    S: 180,
    SW: 225,
    W: 270,
    NW: 315,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-7 w-7 shrink-0 text-white sm:h-8 sm:w-8"
      style={{ transform: `rotate(${DEGREES[direction] ?? 0}deg)` }}
    >
      <path d="M12 2 L19 21 L12 16.5 L5 21 Z" fill="currentColor" />
    </svg>
  );
}
