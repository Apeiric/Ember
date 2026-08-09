/**
 * EMBER — THE PRIMARY SURFACE.
 * OWNER: FRONTEND
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE JOB: a frightened person glances for three seconds and knows what to do.
 *
 * Black card, off-white words, ONE line of color. The decision's color lives
 * in a thin left bar, the arrow, and the countdown — nowhere else. A wall of
 * orange is a poster; a black card with a red edge and a ticking red number
 * is an instrument. Only EVACUATE NOW is allowed to pulse.
 *
 * PLAIN LANGUAGE RULES — this component is the accessibility surface:
 *   • No jargon. Not "exposure score", not "cutoff", not "danger field".
 *   • Numbers get units a person uses: "23 minutes", never "23.4 min margin".
 *   • Say the road name, because that is what someone actually looks for.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import type { Decision, RouteVerdict, ScoredRoute } from '@ember/shared';

interface Props {
  verdict: RouteVerdict;
  recommended: ScoredRoute | null;
  compact?: boolean;
}

/**
 * Plain-English restatement of each decision. Deliberately NOT the enum name —
 * "SHELTER_IN_PLACE" means nothing to a person on their driveway.
 */
const SAY: Record<Decision, { title: string; means: string }> = {
  EVACUATE_NOW: { title: 'Leave now', means: 'Get in the car and go. Do not pack.' },
  EVACUATE_SOON: { title: 'Leave soon', means: 'Go while the road is still open.' },
  PREPARE: { title: 'Get ready', means: 'Load the car now so you can leave fast.' },
  SHELTER_IN_PLACE: { title: 'Stay inside', means: 'Every road out is cut. Call 911.' },
  MONITOR: { title: 'Stay alert', means: 'No road out is threatened yet.' },
};

/** The decision's single line of color: edge bar, arrow, countdown. */
const TONE: Record<Decision, { bar: string; accent: string; urgent: boolean }> = {
  EVACUATE_NOW: { bar: 'bg-alarm-500', accent: 'text-alarm-400', urgent: true },
  EVACUATE_SOON: { bar: 'bg-ember-500', accent: 'text-ember-400', urgent: false },
  PREPARE: { bar: 'bg-caution-400', accent: 'text-caution-400', urgent: false },
  SHELTER_IN_PLACE: { bar: 'bg-alarm-500', accent: 'text-alarm-400', urgent: true },
  MONITOR: { bar: 'bg-ash-400', accent: 'text-ash-200', urgent: false },
};

export function VerdictHero({ verdict, recommended, compact = false }: Props) {
  const say = SAY[verdict.decision];
  const tone = TONE[verdict.decision];
  const minutes = verdict.leaveWithinMinutes;
  const canGo = verdict.decision !== 'SHELTER_IN_PLACE' && verdict.direction !== null;

  // The deadline is REAL TIME: it started aging the moment the verdict landed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const anchor = useMemo(() => Date.now(), [verdict]);
  const [nowMs, setNowMs] = useState(anchor);
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remainingSec =
    minutes === null ? null : Math.max(0, Math.round(minutes * 60 - (nowMs - anchor) / 1000));

  return (
    <section
      aria-live="assertive"
      className={`animate-slam-in relative overflow-hidden rounded-xl border border-white/[0.08] bg-ash-900/95 ${
        tone.urgent ? 'animate-pulse-alarm' : ''
      }`}
    >
      {/* The one line of color. */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${tone.bar}`} />

      {/* ── 1. WHAT TO DO ─────────────────────────────────────────────── */}
      <div className={compact ? 'px-5 pb-4 pt-5' : 'px-6 pb-5 pt-6'}>
        <h1
          className={`font-black uppercase leading-[0.88] tracking-tight text-ash-50 ${
            compact ? 'text-[2rem]' : 'text-verdict'
          }`}
        >
          {say.title}
        </h1>
        <p className="mt-2 text-[0.95rem] font-medium leading-snug text-ash-300">{say.means}</p>
      </div>

      {/* ── 2. WHICH WAY  ·  3. HOW LONG ──────────────────────────────── */}
      <div className="grid grid-cols-2 divide-x divide-white/[0.07] border-t border-white/[0.07]">
        <div className="min-w-0 px-5 py-4 pl-6">
          <div className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ash-400">
            Which way
          </div>
          {canGo ? (
            <>
              <div className="mt-1.5 flex items-center gap-1.5">
                <Arrow direction={verdict.direction!} className={tone.accent} />
                <span className="min-w-0 text-[clamp(1rem,4.4vw,1.5rem)] font-black uppercase leading-none text-ash-50">
                  {verdict.directionLabel}
                </span>
              </div>
              {recommended && (
                <p className="mt-1.5 line-clamp-2 text-[0.72rem] leading-snug text-ash-300">
                  {plainRoute(recommended)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-ash-200">Nowhere safe to drive</p>
          )}
        </div>

        <div className="min-w-0 px-5 py-4">
          <div className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-ash-400">
            Time to go
          </div>
          {remainingSec === null ? (
            <p className="mt-2 text-sm font-semibold text-ash-200">No deadline yet</p>
          ) : remainingSec <= 0 ? (
            <div className={`mt-1 text-4xl font-black uppercase leading-none ${tone.accent}`}>
              Now
            </div>
          ) : (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className={`text-5xl font-black leading-none tabular-nums ${tone.accent}`}>
                {Math.floor(remainingSec / 60)}
                <span className="text-3xl">:{String(remainingSec % 60).padStart(2, '0')}</span>
              </span>
            </div>
          )}
          {verdict.minutesUntilCutoff !== null && verdict.minutesUntilCutoff > 0 && (
            <p className="mt-1.5 text-[0.72rem] leading-snug text-ash-300">
              The road closes in about {verdict.minutesUntilCutoff} minutes
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

/** Route summary with the arrows stripped — arrows read as noise out loud. */
function plainRoute(scored: ScoredRoute): string {
  return scored.route.summary.replace(/\s*→\s*/g, ', then ');
}

function Arrow({
  direction,
  className,
}: {
  direction: NonNullable<RouteVerdict['direction']>;
  className?: string;
}) {
  const DEG: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={`h-5 w-5 shrink-0 sm:h-6 sm:w-6 ${className ?? 'text-ash-50'}`}
      style={{ transform: `rotate(${DEG[direction] ?? 0}deg)` }}
    >
      <path d="M12 2 L19 21 L12 16.5 L5 21 Z" fill="currentColor" />
    </svg>
  );
}
