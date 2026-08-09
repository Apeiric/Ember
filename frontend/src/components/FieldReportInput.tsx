/**
 * EMBER — real-time situation reports.
 * OWNER: FRONTEND
 *
 * The demo beat: paste a message from a neighbour, watch the route change.
 *
 * What this surfaces, and why it matters more than the reroute itself:
 * every extracted fact is labelled USED or IGNORED. When Claude invents a road
 * that does not exist, the user watches it get thrown out. That visible
 * rejection is the proof of the whole architecture — the model reads, the map
 * decides.
 */

import { useState, type FormEvent } from 'react';
import type { FieldReport, ReportImpact } from '@ember/shared';

interface Props {
  onSubmit: (text: string) => void;
  loading: boolean;
  reports: FieldReport[];
  impact: ReportImpact | null;
}

/** One-tap demo reports. Typing a paragraph on stage is a way to lose the room. */
const EXAMPLES = [
  {
    label: 'Neighbour text',
    text: 'my sister just called — PCH south toward Santa Monica is gridlocked, downed power line across it, nobody is moving. someone also said Mildred Ave is closed but I doubt that',
  },
  {
    label: '911 dispatch',
    text: 'Dispatch: fire has jumped Sunset Blvd, Sunset is impassable eastbound, heavy smoke on the east side, units rerouting',
  },
];

export function FieldReportInput({ onSubmit, loading, reports, impact }: Props) {
  const [text, setText] = useState('');

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length >= 4) {
      onSubmit(trimmed);
      setText('');
    }
  }

  return (
    <section className="panel p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="label">Something changed?</h2>
        <span className="text-[0.62rem] text-ash-400">read by Claude · checked against the map</span>
      </div>
      <p className="mt-1.5 text-[0.72rem] leading-snug text-ash-400">
        Paste a text, a 911 update, anything you have heard. Write it however you like.
      </p>

      <form onSubmit={submit} className="mt-3 space-y-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          disabled={loading}
          placeholder="the fire jumped Sunset, it's blocked, heavy smoke on the east side"
          className="w-full resize-none rounded-xl border border-ash-700 bg-ash-850 px-3 py-2.5 text-[0.85rem] leading-snug text-ash-100 placeholder:text-ash-500 outline-none transition-colors focus:border-ember-500 focus:ring-1 focus:ring-ember-500/40 disabled:opacity-50"
        />
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex.label}
              type="button"
              disabled={loading}
              onClick={() => setText(ex.text)}
              className="rounded-lg border border-ash-700 bg-ash-850 px-2.5 py-1 text-[0.68rem] text-ash-300 transition-colors hover:border-ember-500/50 hover:text-ember-300 disabled:opacity-40"
            >
              {ex.label}
            </button>
          ))}
          <button
            type="submit"
            disabled={loading || text.trim().length < 4}
            className="ml-auto rounded-lg bg-ember-600 px-3.5 py-1.5 text-[0.72rem] font-bold uppercase tracking-wider text-white transition-colors hover:bg-ember-500 disabled:opacity-40"
          >
            {loading ? 'Reading…' : 'Send update'}
          </button>
        </div>
      </form>

      {impact && <ImpactBanner impact={impact} />}
      {reports.length > 0 && <ReportLog reports={reports} />}
    </section>
  );
}

function ImpactBanner({ impact }: { impact: ReportImpact }) {
  const changed = impact.rerouted;
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-2.5 ${
        changed
          ? 'border-safe-500/40 bg-safe-500/10'
          : 'border-ash-700 bg-ash-850/60'
      }`}
    >
      <p className="text-[0.78rem] font-semibold text-ash-100">
        {changed
          ? impact.currentRouteId === null
            ? 'That closes your last way out.'
            : 'Your route changed.'
          : 'Your route is unchanged.'}
      </p>
      <p className="mt-0.5 text-[0.7rem] leading-snug text-ash-400">
        {changed
          ? impact.currentRouteId === null
            ? 'Every road we checked is now blocked or on fire. Stay inside and call 911.'
            : 'We moved you off the road that was reported blocked.'
          : 'Nothing in that report affects the road you are on.'}
      </p>
    </div>
  );
}

/**
 * The audit trail. Every fact shows whether it was USED or IGNORED — this is
 * where "the model never decides" stops being a claim and becomes visible.
 */
function ReportLog({ reports }: { reports: FieldReport[] }) {
  return (
    <ul className="mt-3 space-y-2 border-t border-ash-700/60 pt-3">
      {reports.map((report) => (
        <li key={report.id} className="rounded-xl bg-ash-850/60 p-2.5">
          <p className="text-[0.72rem] italic leading-snug text-ash-400">“{report.rawText}”</p>
          <p className="mt-1.5 text-[0.75rem] leading-snug text-ash-200">{report.summary}</p>

          <div className="mt-2 space-y-1">
            {report.blocks.map((block, i) => (
              <Fact
                key={`b${i}`}
                used={block.verified}
                label={block.road}
                detail={
                  block.verified
                    ? `on ${block.affectsRouteIds.length} of your routes`
                    : 'not on any road we can route you along'
                }
              />
            ))}
            {report.dangers.map((danger, i) => (
              <Fact
                key={`d${i}`}
                used={danger.verified}
                label={danger.description}
                detail={danger.verified ? 'placed on the map' : 'could not place it on the map'}
              />
            ))}
          </div>

          <p className="mt-2 text-[0.6rem] uppercase tracking-wider text-ash-400">
            read by {report.interpretedBy} · every fact checked against the map
          </p>
        </li>
      ))}
    </ul>
  );
}

function Fact({ used, label, detail }: { used: boolean; label: string; detail: string }) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-px shrink-0 rounded px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider ${
          used
            ? 'bg-safe-500/15 text-safe-400'
            : 'bg-ash-700 text-ash-400 line-through decoration-ash-500'
        }`}
      >
        {used ? 'Used' : 'Ignored'}
      </span>
      <span className="min-w-0 text-[0.7rem] leading-snug text-ash-300">
        <span className={used ? 'text-ash-100' : 'text-ash-400'}>{label}</span>
        <span className="text-ash-400"> — {detail}</span>
      </span>
    </div>
  );
}
