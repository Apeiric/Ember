/**
 * EMBER — responder mode.
 * OWNER: FRONTEND
 *
 * The civilian app asks: "route ME around the fire."
 * A crew asks the inverse: "whose last way out dies first?"
 *
 * Same engine, unchanged. The judge already computes minutes-until-cutoff for
 * every address it assesses; SORTING a neighbourhood by that number IS the
 * knock list. Nothing here is a new model — that is the point to make on
 * stage: one deterministic core, two products.
 */

import { useEffect, useState } from 'react';
import type { FamilyAssessment, FamilyMemberAssessment } from '@ember/shared';
import { fetchFamily } from '../lib/api';

export function ResponderView() {
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

  if (error) return <p className="text-sm text-alarm-400">Could not load triage: {error}</p>;
  if (!data) {
    return (
      <div className="flex items-center gap-3 p-2 text-sm text-ash-300">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-400" />
        Computing escape windows for the sector…
      </div>
    );
  }

  // Members arrive urgency-ranked from the backend; rank 1 = knock first.
  const rows = [...data.members].sort((a, b) => a.urgencyRank - b.urgencyRank);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-alarm-500/40 bg-alarm-500/10 px-4 py-3">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.16em] text-alarm-300">
          Knock order — {data.hazard.name}
        </p>
        <p className="mt-1 text-[0.78rem] leading-snug text-ash-100">
          Addresses sorted by when their <strong>last passable route</strong> closes. Send crews to
          the top of this list first; the bottom can still self-evacuate.
        </p>
      </div>

      <ol className="space-y-2">
        {rows.map((r, i) => (
          <TriageRow key={r.member.id} rank={i + 1} row={r} />
        ))}
      </ol>

      <div className="panel p-4">
        <p className="text-[0.72rem] leading-relaxed text-ash-200">
          <strong className="text-ash-50">Why this matters:</strong> this list is computed by the
          exact engine that routes civilians — no second model, no separate product. A county that
          deploys Ember for residents gets sector triage for crews on the same data: knock lists
          ordered by escape-window, staging suggestions where roads die latest, and a live record of
          which roads stayed passable at which minute — the dataset that does not exist today.
        </p>
      </div>
    </div>
  );
}

function TriageRow({ rank, row }: { rank: number; row: FamilyMemberAssessment }) {
  const cutOff = row.verdict.decision === 'SHELTER_IN_PLACE';
  const minutes = row.verdict.leaveWithinMinutes;
  const windowLabel = cutOff
    ? 'CUT OFF'
    : minutes === null
      ? 'open'
      : minutes <= 0
        ? 'closing now'
        : `~${minutes} min`;

  return (
    <li
      className={`flex items-stretch overflow-hidden rounded-2xl border ${
        cutOff ? 'border-alarm-500/60 bg-alarm-500/[0.08]' : 'border-ash-600 bg-ash-900/95'
      }`}
    >
      <div
        className={`flex w-12 shrink-0 items-center justify-center text-xl font-black ${
          cutOff ? 'bg-alarm-600 text-white' : rank === 1 ? 'bg-ember-600 text-white' : 'bg-ash-800 text-ash-200'
        }`}
      >
        {rank}
      </div>
      <div className="min-w-0 flex-1 px-3.5 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[0.9rem] font-bold text-ash-50">
            {row.member.name}
            <span className="ml-2 text-[0.68rem] font-medium text-ash-400">
              {row.member.address}
            </span>
          </p>
          <span
            className={`shrink-0 text-[0.78rem] font-black uppercase tracking-wide ${
              cutOff ? 'text-alarm-300' : 'text-caution-300'
            }`}
          >
            {windowLabel}
          </span>
        </div>
        <p className="mt-0.5 text-[0.7rem] leading-snug text-ash-300">
          {cutOff
            ? 'No passable route — needs a crew, not an alert.'
            : row.recommended
              ? `Last open: ${row.recommended.route.summary.replace(/\s*→\s*/g, ' → ')}`
              : 'Monitoring.'}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          <Chip
            label={row.member.profile.mobility === 'vulnerable' ? 'Moves slowly' : 'Moves quickly'}
            tone={row.member.profile.mobility === 'vulnerable' ? 'warn' : 'plain'}
          />
          {!row.member.profile.hasCar && <Chip label="No vehicle" tone="alarm" />}
          {(row.member.essentials?.length ?? 0) > 0 && (
            <Chip label={`Meds/equipment: ${row.member.essentials!.length}`} tone="warn" />
          )}
        </div>
      </div>
    </li>
  );
}

function Chip({ label, tone }: { label: string; tone: 'plain' | 'warn' | 'alarm' }) {
  const style =
    tone === 'alarm'
      ? 'border-alarm-500/50 bg-alarm-500/15 text-alarm-300'
      : tone === 'warn'
        ? 'border-caution-500/50 bg-caution-500/15 text-caution-300'
        : 'border-ash-600 bg-ash-800 text-ash-300';
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[0.56rem] font-bold uppercase tracking-wider ${style}`}
    >
      {label}
    </span>
  );
}
