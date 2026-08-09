/**
 * EMBER — every route we considered, including the ones we threw away.
 * OWNER: FRONTEND
 *
 * Showing the rejected routes is not a debug view — it is the argument. Anyone
 * can draw a green line. Proving that we looked at the fast route, scored it,
 * and refused it is what separates this from a map with a route on it.
 */

import type { ScoredRoute } from '@ember/shared';
import { RATING_STYLE, formatKm, formatMinutes } from '../lib/format';

export function RouteList({
  routes,
  recommendedId,
}: {
  routes: ScoredRoute[];
  recommendedId?: string;
}) {
  if (routes.length === 0) return null;

  return (
    <section className="panel p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="label">Routes considered</h2>
        <span className="text-[0.68rem] text-ash-500">
          {routes.filter((r) => r.rating === 'REJECTED').length} of {routes.length} rejected
        </span>
      </div>

      <ul className="space-y-2">
        {routes.map((scored) => (
          <RouteRow
            key={scored.route.id}
            scored={scored}
            isRecommended={scored.route.id === recommendedId}
          />
        ))}
      </ul>
    </section>
  );
}

function RouteRow({ scored, isRecommended }: { scored: ScoredRoute; isRecommended: boolean }) {
  const style = RATING_STYLE[scored.rating];

  return (
    <li
      className={`animate-rise rounded-xl border p-3 transition-colors ${
        isRecommended
          ? 'border-safe-500/40 bg-safe-500/[0.07]'
          : scored.rating === 'REJECTED'
            ? 'border-alarm-500/25 bg-alarm-500/[0.05]'
            : 'border-ash-700 bg-ash-850/60'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded border px-1.5 py-0.5 text-[0.56rem] font-bold uppercase tracking-wider ${style.chip}`}
            >
              {scored.rating}
            </span>
            {scored.isNaiveFastest && (
              <span className="rounded border border-ash-600 bg-ash-800 px-1.5 py-0.5 text-[0.56rem] font-bold uppercase tracking-wider text-ash-300">
                Fastest
              </span>
            )}
            {isRecommended && (
              <span className="rounded border border-safe-500/40 bg-safe-500/15 px-1.5 py-0.5 text-[0.56rem] font-bold uppercase tracking-wider text-safe-400">
                Take this
              </span>
            )}
          </div>

          <p className="mt-1.5 truncate text-[0.82rem] font-medium text-ash-100">
            {scored.route.summary}
          </p>

          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.66rem] text-ash-400">
            <span>{formatKm(scored.route.distanceKm)}</span>
            <span>{Math.round(scored.route.durationMinutes)} min</span>
            <span>head {scored.direction}</span>
            {scored.minutesUntilCutoff != null && (
              <span className={scored.minutesUntilCutoff < 0 ? 'text-alarm-400' : ''}>
                slack {formatMinutes(scored.minutesUntilCutoff)}
              </span>
            )}
          </div>
        </div>

        {/* Peak danger as a compact vertical gauge. */}
        <div className="shrink-0 text-right">
          <div className="label !text-[0.55rem] !tracking-wider">Peak</div>
          <div className={`font-mono text-sm font-bold ${style.text}`}>
            {scored.peakDanger.toFixed(2)}
          </div>
          <div className="mt-1 h-1 w-10 overflow-hidden rounded-full bg-ash-700">
            <div
              className={`h-full rounded-full ${style.dot}`}
              style={{ width: `${Math.min(100, scored.peakDanger * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {scored.reasons.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-ash-700/60 pt-2">
          {scored.reasons.map((reason, i) => (
            <li key={i} className="flex gap-2 text-[0.7rem] leading-snug text-ash-400">
              <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${style.dot}`} />
              {reason}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
