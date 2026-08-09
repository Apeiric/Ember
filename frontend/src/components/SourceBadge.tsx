/**
 * EMBER — data provenance badge.
 * OWNER: FRONTEND
 *
 * Small component, real purpose: it is how we stay honest. If the perimeter is
 * a reconstructed demo scenario, the screen says so, in the room, out loud.
 * Graceful degradation only counts if the user can see it happened.
 */

import type { DataSource, Provenance } from '@ember/shared';

const STYLE: Record<DataSource, { label: string; className: string }> = {
  live: { label: 'LIVE', className: 'bg-safe-500/15 text-safe-400 border-safe-500/30' },
  cached: { label: 'CACHED', className: 'bg-safe-500/10 text-safe-400/80 border-safe-500/20' },
  canned: { label: 'DEMO DATA', className: 'bg-ember-500/15 text-ember-300 border-ember-500/30' },
  mock: { label: 'NO DATA', className: 'bg-ash-600/25 text-ash-300 border-ash-600/40' },
};

export function SourceBadge({
  provenance,
  className = '',
}: {
  provenance: Provenance;
  className?: string;
}) {
  const style = STYLE[provenance.source];
  return (
    <span
      title={`${provenance.provider}${provenance.note ? ` — ${provenance.note}` : ''}`}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] ${style.className} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}

/** Header-level banner shown whenever any pipeline stage fell back. */
export function DegradedBanner({ degraded }: { degraded: boolean }) {
  if (!degraded) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-ember-500/30 bg-ember-500/10 px-3 py-2 text-xs text-ember-300">
      <span className="font-bold">DEMO DATA</span>
      <span className="text-ember-300/80">
        One or more live feeds were unavailable — this assessment used a reconstructed scenario.
      </span>
    </div>
  );
}
