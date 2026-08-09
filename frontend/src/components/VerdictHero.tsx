/**
 * EMBER — THE PRIMARY SURFACE.
 * OWNER: FRONTEND
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE JOB: a frightened person glances for three seconds and knows what to do.
 *
 * Hierarchy, strictly enforced:
 *   1. WHAT TO DO      huge, uppercase, unmissable
 *   2. WHICH WAY       arrow + one direction word
 *   3. HOW LONG        one number
 * Everything else is smaller, quieter, or hidden.
 *
 * PLAIN LANGUAGE RULES — this component is the accessibility surface:
 *   • No jargon. Not "exposure score", not "cutoff", not "danger field".
 *   • Numbers get units a person uses: "23 minutes", never "23.4 min margin".
 *   • Say the road name, because that is what someone actually looks for.
 *   • Only the genuinely-urgent state animates. If everything pulses, nothing does.
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

const TONE: Record<Decision, { bg: string; ring: string; urgent: boolean }> = {
  EVACUATE_NOW: { bg: 'bg-alarm-600', ring: 'ring-alarm-400/40', urgent: true },
  EVACUATE_SOON: { bg: 'bg-ember-600', ring: 'ring-ember-400/40', urgent: false },
  PREPARE: { bg: 'bg-caution-500', ring: 'ring-caution-400/40', urgent: false },
  SHELTER_IN_PLACE: { bg: 'bg-alarm-700', ring: 'ring-alarm-400/40', urgent: true },
  MONITOR: { bg: 'bg-ash-700', ring: 'ring-ash-500/40', urgent: false },
};

export function VerdictHero({ verdict, recommended, compact = false }: Props) {
  const say = SAY[verdict.decision];
  const tone = TONE[verdict.decision];
  const minutes = verdict.leaveWithinMinutes;

  // The deadline is REAL TIME: it started aging the moment the verdict landed.
  // A static "24 minutes" still says 24 five minutes later; this one ticks.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const anchor = useMemo(() => Date.now(), [verdict]);
  const [nowMs, setNowMs] = useState(anchor);
  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const remainingSec =
    minutes === null ? null : Math.max(0, Math.round(minutes * 60 - (nowMs - anchor) / 1000));
  const canGo = verdict.decision !== 'SHELTER_IN_PLACE' && verdict.direction !== null;

  return (
    <section
      aria-live="assertive"
      className={`animate-slam-in overflow-hidden rounded-3xl ring-1 ${tone.ring} ${tone.bg} ${
        tone.urgent ? 'animate-pulse-alarm' : ''
      }`}
    >
      {/* ── 1. WHAT TO DO ─────────────────────────────────────────────── */}
      <div className={compact ? 'px-5 pb-4 pt-5' : 'px-6 pb-5 pt-7'}>
        <h1
          className={`font-black uppercase leading-[0.88] tracking-tight text-white ${
            compact ? 'text-[2rem]' : 'text-verdict'
          }`}
        >
          {say.title}
        </h1>
        <p className="mt-2 text-[0.95rem] font-medium leading-snug text-white/90">{say.means}</p>
      </div>

      {/* ── 2. WHICH WAY  ·  3. HOW LONG ──────────────────────────────── */}
      <div className="grid grid-cols-2 gap-px bg-white/15">
        <div className="min-w-0 bg-black/25 px-5 py-4">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/55">
            Which way
          </div>
          {canGo ? (
            <>
              {/* Scales with the column so "SOUTHEAST" never truncates — a
                  half-shown direction is worse than a smaller one. */}
              <div className="mt-1.5 flex items-center gap-1.5">
                <Arrow direction={verdict.direction!} />
                <span className="min-w-0 text-[clamp(1rem,4.4vw,1.5rem)] font-black uppercase leading-none text-white">
                  {verdict.directionLabel}
                </span>
              </div>
              {recommended && (
                <p className="mt-1.5 line-clamp-2 text-[0.72rem] leading-snug text-white/85">
                  {plainRoute(recommended)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-white/85">Nowhere safe to drive</p>
          )}
        </div>

        <div className="min-w-0 bg-black/25 px-5 py-4">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-white/55">
            Time to go
          </div>
          {remainingSec === null ? (
            <p className="mt-2 text-sm font-semibold text-white/85">No deadline yet</p>
          ) : remainingSec <= 0 ? (
            <div className="mt-1 text-4xl font-black uppercase leading-none text-white">Now</div>
          ) : (
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-5xl font-black leading-none tabular-nums text-white">
                {Math.floor(remainingSec / 60)}
                <span className="text-3xl">:{String(remainingSec % 60).padStart(2, '0')}</span>
              </span>
            </div>
          )}
          {verdict.minutesUntilCutoff !== null && verdict.minutesUntilCutoff > 0 && (
            <p className="mt-1.5 text-[0.72rem] leading-snug text-white/85">
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

function Arrow({ direction }: { direction: NonNullable<RouteVerdict['direction']> }) {
  const DEG: Record<string, number> = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-5 w-5 shrink-0 text-white sm:h-6 sm:w-6"
      style={{ transform: `rotate(${DEG[direction] ?? 0}deg)` }}
    >
      <path d="M12 2 L19 21 L12 16.5 L5 21 Z" fill="currentColor" />
    </svg>
  );
}
