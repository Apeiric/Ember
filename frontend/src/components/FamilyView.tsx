/**
 * EMBER — family coordination.
 * OWNER: FRONTEND
 *
 * One fire. One engine. Four people, four different answers, sorted so the
 * person with the least time is at the top.
 *
 * This is the accessibility argument made visible: an official alert tells this
 * whole household the same thing, and the household then has to work out — in
 * the worst ten minutes of their lives — that Grandma needs half an hour of
 * head start and the kids cannot leave at all. Ember does that arithmetic
 * first, and says who to deal with in what order.
 */

import { useEffect, useState } from 'react';
import type { FamilyAssessment, FamilyMemberAssessment } from '@ember/shared';
import { fetchFamily } from '../lib/api';

const DECISION_STYLE: Record<string, { chip: string; bar: string; say: string }> = {
  SHELTER_IN_PLACE: {
    chip: 'bg-alarm-600 text-white',
    bar: 'bg-alarm-500',
    say: 'Cannot get out',
  },
  EVACUATE_NOW: { chip: 'bg-alarm-500 text-white', bar: 'bg-alarm-400', say: 'Leave now' },
  EVACUATE_SOON: { chip: 'bg-ember-600 text-white', bar: 'bg-ember-500', say: 'Leave soon' },
  PREPARE: { chip: 'bg-caution-500 text-ash-950', bar: 'bg-caution-400', say: 'Get ready' },
  MONITOR: { chip: 'bg-ash-600 text-ash-100', bar: 'bg-ash-500', say: 'Stay alert' },
};

export function FamilyView({ onExit }: { onExit: () => void }) {
  const [data, setData] = useState<FamilyAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchFamily()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <Shell onExit={onExit}>
        <p className="text-sm text-alarm-400">Could not load the family view: {error}</p>
      </Shell>
    );
  }
  if (!data) {
    return (
      <Shell onExit={onExit}>
        <div className="flex items-center gap-3 text-sm text-ash-400">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-400" />
          Working out everyone’s verdict…
        </div>
      </Shell>
    );
  }

  return (
    <Shell onExit={onExit}>
      {/* ── WHAT TO DO FIRST ─────────────────────────────────────────── */}
      <section className="rounded-2xl border border-ember-500/30 bg-ember-500/[0.07] p-4">
        <h2 className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-ember-300">
          Do this in order
        </h2>
        <ol className="mt-2 space-y-2">
          {data.coordination.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-[0.85rem] leading-snug text-ash-100">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ember-600 text-[0.65rem] font-bold text-white">
                {i + 1}
              </span>
              {line}
            </li>
          ))}
        </ol>
      </section>

      {/* ── EVERYONE, MOST URGENT FIRST ──────────────────────────────── */}
      <div className="mt-3 space-y-2">
        {data.members.map((m) => (
          <PersonCard key={m.member.id} assessment={m} />
        ))}
      </div>

      <p className="mt-3 px-1 text-[0.62rem] leading-snug text-ash-400">
        Same fire, same engine, four different answers — the difference is how fast each person can
        actually move. Demo household on the reconstructed {data.hazard.name}.
      </p>
    </Shell>
  );
}

function PersonCard({ assessment }: { assessment: FamilyMemberAssessment }) {
  const { member, verdict, recommended } = assessment;
  const style = DECISION_STYLE[verdict.decision] ?? DECISION_STYLE.MONITOR!;
  const minutes = verdict.leaveWithinMinutes;

  return (
    <article className="overflow-hidden rounded-2xl border border-ash-700 bg-ash-900/80">
      <div className="flex items-stretch">
        {/* Urgency spine — scannable down the left edge. */}
        <div className={`w-1.5 shrink-0 ${style.bar}`} />

        <div className="min-w-0 flex-1 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-[0.95rem] font-bold text-ash-100">{member.name}</h3>
              <p className="truncate text-[0.68rem] text-ash-400">
                {member.relationship} · {member.address}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider ${style.chip}`}
            >
              {style.say}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <Stat
              value={
                minutes === null ? '—' : minutes <= 0 ? 'Now' : String(minutes)
              }
              unit={minutes === null || minutes <= 0 ? '' : minutes === 1 ? 'minute' : 'minutes'}
              label="to go"
            />
            <Stat
              value={verdict.directionLabel ?? 'Nowhere'}
              unit=""
              label={verdict.directionLabel ? 'head' : 'safe to drive'}
            />
          </div>

          {recommended && (
            <p className="mt-2 line-clamp-2 text-[0.72rem] leading-snug text-ash-300">
              {recommended.route.summary.replace(/\s*→\s*/g, ', then ')}
            </p>
          )}

          {/* Why this person's answer differs — the accessibility point, stated. */}
          {member.situation && (
            <p className="mt-2 border-t border-ash-700/60 pt-2 text-[0.68rem] leading-snug text-ash-300">
              {member.situation}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function Stat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-black leading-none text-ash-100">{value}</span>
        {unit && <span className="text-[0.7rem] text-ash-400">{unit}</span>}
      </div>
      <div className="text-[0.58rem] uppercase tracking-wider text-ash-300">{label}</div>
    </div>
  );
}

function Shell({ children, onExit }: { children: React.ReactNode; onExit: () => void }) {
  return (
    <div className="scroll-thin h-full overflow-y-auto bg-ash-950 p-3">
      <header className="mb-3 flex items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-lg font-black tracking-tight text-ash-100">Your people</h1>
          <p className="text-[0.68rem] text-ash-400">Most urgent first</p>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="rounded-lg border border-ash-600 px-3 py-1.5 text-xs font-semibold text-ash-200 transition-colors hover:border-ember-500 hover:text-ember-300"
        >
          ← Back
        </button>
      </header>
      {children}
    </div>
  );
}
