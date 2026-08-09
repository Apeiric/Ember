/**
 * EMBER — what is burning, and where the ground puts you.
 * OWNER: FRONTEND
 *
 * The context strip under the verdict. The `exitCount === 1` case gets its own
 * treatment — "one road out" is the most damning fact we can put on screen and
 * it should never be a number in a row of numbers.
 */

import type { AssessResponse } from '@ember/shared';
import { SourceBadge } from './SourceBadge';
import { relativeTime } from '../lib/format';

export function HazardSummary({ data }: { data: AssessResponse }) {
  const { hazard, ground, field } = data;

  return (
    <section className="panel space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate text-[0.95rem] font-bold text-ash-100">{hazard.name}</h2>
          <p className="mt-0.5 text-[0.68rem] text-ash-400">
            {hazard.acres ? `${hazard.acres.toLocaleString()} acres · ` : ''}
            {hazard.containmentPct ?? 0}% contained ·{' '}
            {relativeTime(hazard.provenance.perimeter.fetchedAt)}
          </p>
        </div>
        <SourceBadge provenance={hazard.provenance.perimeter} />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Wind" value={`${hazard.wind.speedKph}`} unit="km/h" />
        <Stat label="Spreading" value={`${field.spreadRateKph}`} unit="km/h" />
        <Stat
          label="Slope"
          value={ground.slopePct != null ? ground.slopePct.toFixed(0) : '—'}
          unit={ground.slopePct != null ? '%' : ''}
        />
      </div>

      {/* THE NUMBER. One road out is the whole product in one integer. */}
      {ground.exitCount === 1 ? (
        <div className="rounded-xl border border-alarm-500/40 bg-alarm-500/10 px-3 py-2.5">
          <div className="text-[0.6rem] font-bold uppercase tracking-[0.14em] text-alarm-400">
            One road out
          </div>
          <p className="mt-0.5 text-[0.72rem] leading-snug text-ash-300">
            {ground.exits[0]?.name ?? 'A single route'} is the only way out of this area. If it
            closes, or fills, there is no second option.
          </p>
        </div>
      ) : (
        ground.exitCount != null && (
          <div className="rounded-xl border border-ash-700 bg-ash-850/60 px-3 py-2">
            <span className="text-[0.72rem] text-ash-300">
              <span className="font-bold text-ash-100">{ground.exitCount}</span> roads out of this
              area
            </span>
          </div>
        )
      )}

      <p className="border-t border-white/[0.07] pt-2.5 text-[0.64rem] leading-snug text-ash-400">
        {field.disclaimer}
      </p>
    </section>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border border-ash-700 bg-ash-850/60 px-2.5 py-2">
      <div className="label !text-[0.55rem]">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-0.5">
        <span className="font-mono text-base font-bold text-ash-100">{value}</span>
        <span className="text-[0.6rem] text-ash-400">{unit}</span>
      </div>
    </div>
  );
}
