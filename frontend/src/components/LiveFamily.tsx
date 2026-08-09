/**
 * EMBER — live family coordination, on the emergency surface.
 * OWNER: FRONTEND
 *
 * "Where is everyone RIGHT NOW, and who is getting the kids?" — answered
 * without anyone typing anything. Pins move on the map above; this card is
 * the words for what they are doing, plus the one decision that matters:
 * the pickup assignment, recomputed live, with the moment it flips called
 * out ("Uncle Dev is now 7 min closer than you — reassigned").
 *
 * Monochrome like the rest of the chrome. The only colored things are the
 * LIVE dot and genuinely-alarming states.
 */

import type { Assignment, LiveEvent, LiveRow } from '../hooks/useLiveFamily';

interface Props {
  running: boolean;
  rows: LiveRow[];
  events: LiveEvent[];
  assignment: Assignment | null;
  clockSec: number;
  onStart: () => void;
  onStop: () => void;
}

export function LiveFamily({ running, rows, events, assignment, clockSec, onStart, onStop }: Props) {
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
        <h2 className="label flex items-center gap-2">
          {running && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-safe-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-safe-400" />
            </span>
          )}
          Your people, live
        </h2>
        <div className="flex items-center gap-2">
          {running && (
            <span className="font-mono text-[0.62rem] tabular-nums text-ash-400">
              T+{Math.floor(clockSec / 60)}:{String(clockSec % 60).padStart(2, '0')} · sim 6×
            </span>
          )}
          <button
            type="button"
            onClick={running ? onStop : onStart}
            className={`rounded-lg px-3 py-1.5 text-[0.66rem] font-bold uppercase tracking-wider transition-colors ${
              running
                ? 'border border-ash-500 text-ash-200 hover:border-ash-300'
                : 'bg-ash-100 text-ash-950 hover:bg-white'
            }`}
          >
            {running ? 'Pause' : '▶ Go live'}
          </button>
        </div>
      </div>

      {!running && rows.length === 0 ? (
        <p className="px-4 py-3 text-[0.72rem] leading-snug text-ash-300">
          See everyone move at once — who is evacuating, who is sheltering, and who should collect
          the kids, reassigned live as positions change. Positions are simulated for the demo; the
          assignment math is the real engine.
        </p>
      ) : (
        <>
          {/* THE decision. If it flips mid-demo, that flip is the product. */}
          {assignment && (
            <div className="border-b border-white/[0.08] bg-ash-800/60 px-4 py-2.5">
              <p className="text-[0.78rem] leading-snug text-ash-50">
                <strong className="font-bold">{assignment.assigneeName}</strong>
                <span className="text-ash-300"> → picking up </span>
                <strong className="font-bold">{assignment.targetName}</strong>
                <span className="text-ash-300"> · ETA ~{assignment.etaMinutes} min</span>
              </p>
              <p className="mt-0.5 text-[0.66rem] leading-snug text-ash-400">{assignment.reason}</p>
            </div>
          )}

          <ul className="divide-y divide-ash-700/50 px-4">
            {rows.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 text-[0.78rem] font-semibold text-ash-100">
                    {r.name}
                  </span>
                  <span
                    className={`min-w-0 truncate text-right text-[0.7rem] ${
                      r.phase === 'sheltering'
                        ? 'font-semibold text-alarm-400'
                        : r.phase === 'arrived'
                          ? 'font-semibold text-safe-400'
                          : 'text-ash-300'
                    }`}
                  >
                    {r.text}
                  </span>
                </div>
                {r.progress !== undefined && r.progress > 0 && (
                  <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-[width] duration-500 ${
                        r.phase === 'pickup' ? 'bg-ash-100' : 'bg-white/40'
                      }`}
                      style={{ width: `${Math.round(r.progress * 100)}%` }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {events.length > 0 && (
            <div className="border-t border-white/[0.08] px-4 py-2.5">
              <p className="text-[0.58rem] font-bold uppercase tracking-[0.16em] text-ash-400">
                Updates
              </p>
              <ul className="mt-1.5 space-y-1">
                {events.slice(0, 3).map((e, i) => (
                  <li key={i} className="flex gap-2 text-[0.7rem] leading-snug">
                    <span className="shrink-0 font-mono tabular-nums text-ash-500">
                      T+{Math.floor(e.atSec / 60)}:{String(e.atSec % 60).padStart(2, '0')}
                    </span>
                    <span
                      className={
                        e.kind === 'reassign'
                          ? 'font-semibold text-ash-50'
                          : e.kind === 'arrive'
                            ? 'font-semibold text-safe-400'
                            : 'text-ash-200'
                      }
                    >
                      {e.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
