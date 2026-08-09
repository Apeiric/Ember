/**
 * EMBER — pipeline trace.
 * OWNER: FRONTEND
 *
 * Two audiences:
 *   • You, at 3am, working out which feed died.
 *   • The judges, who get to watch eight stages run and see exactly which ones
 *     fell back to canned data. It reads as engineering rather than a magic box,
 *     and it makes the honesty about degradation concrete.
 *
 * Collapsed by default — the verdict is the product, this is the receipt.
 */

import type { StageStatus, Trace } from '@ember/shared';

const STATUS_STYLE: Record<StageStatus, { dot: string; text: string }> = {
  ok: { dot: 'bg-safe-400', text: 'text-safe-400' },
  fallback: { dot: 'bg-ember-400', text: 'text-ember-300' },
  failed: { dot: 'bg-alarm-400', text: 'text-alarm-400' },
  skipped: { dot: 'bg-ash-500', text: 'text-ash-400' },
};

/** Human labels for the pipeline stages — CONTEXT.md §5. */
const STAGE_LABEL: Record<string, string> = {
  geocode: '1 · Locate',
  hazard: '2 · Threat',
  ground: '3 · Ground',
  project: '4 · Project',
  routing: '5 · Route',
  judge: '6 · Judge',
  verdict: '8 · Verdict',
};

export function TracePanel({ trace }: { trace: Trace }) {
  const slowest = Math.max(1, ...trace.stages.map((s) => s.ms));

  return (
    <details className="panel group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition-colors hover:bg-ash-800/50">
        <span className="label">Pipeline</span>
        <span className="flex items-center gap-2 font-mono text-[0.68rem] text-ash-400">
          {trace.degraded && (
            <span className="rounded border border-ember-500/30 bg-ember-500/10 px-1.5 py-0.5 text-[0.56rem] font-bold uppercase tracking-wider text-ember-300">
              Degraded
            </span>
          )}
          {trace.totalMs}ms
          <span className="text-ash-600 transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>

      <ul className="space-y-px border-t border-ash-700/60 px-4 py-3">
        {trace.stages.map((stage, i) => {
          const style = STATUS_STYLE[stage.status];
          return (
            <li key={`${stage.name}-${i}`} className="py-1">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                <span className="w-[5.5rem] shrink-0 truncate text-[0.7rem] font-medium text-ash-200">
                  {STAGE_LABEL[stage.name] ?? stage.name}
                </span>

                {/* Relative-duration bar — spot the slow stage at a glance. */}
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-ash-800">
                  <span
                    className={`block h-full rounded-full ${style.dot} opacity-60`}
                    style={{ width: `${Math.max(2, (stage.ms / slowest) * 100)}%` }}
                  />
                </span>

                <span className="w-10 shrink-0 text-right font-mono text-[0.64rem] text-ash-500">
                  {stage.ms}ms
                </span>
              </div>

              {(stage.provider || stage.note || stage.error) && (
                <div className="ml-[7.6rem] mt-0.5 truncate text-[0.62rem] text-ash-500">
                  {stage.provider && <span className={style.text}>{stage.provider}</span>}
                  {stage.error && <span className="text-alarm-400"> — {stage.error}</span>}
                  {stage.note && <span> — {stage.note}</span>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
