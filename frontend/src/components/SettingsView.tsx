/**
 * EMBER — settings.
 * OWNER: FRONTEND
 *
 * Deliberately thin. Everything a person must touch during an emergency lives
 * on ESCAPE; everything about who they are lives on PEOPLE. What remains here
 * is the demo machinery, the data-honesty story, and the privacy stance —
 * the three things a judge (or a buyer) asks about after the demo.
 */

import type { ScenarioSummary } from '@ember/shared';

interface Props {
  scenarios: ScenarioSummary[];
  offline: boolean;
  onOffline: (v: boolean) => void;
  onRunScenario: (s: ScenarioSummary) => void;
}

export function SettingsView({ scenarios, offline, onOffline, onRunScenario }: Props) {
  return (
    <div className="space-y-3">
      {/* ── Scenarios ── */}
      <section className="panel p-4">
        <h2 className="label">Demo scenarios</h2>
        <p className="mt-1.5 text-[0.72rem] leading-snug text-ash-300">
          Reconstructed real events, pinned and reproducible — every stage runs on canned data, no
          keys, no network. What you demo is what you get, every time.
        </p>
        <div className="mt-3 space-y-2">
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onRunScenario(s)}
              className="w-full rounded-xl border border-ash-600 bg-ash-900 px-3.5 py-2.5 text-left transition-colors hover:border-ash-400"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[0.85rem] font-bold text-ash-50">{s.name}</span>
                <span className="text-[0.62rem] uppercase tracking-wider text-ash-400">
                  {s.date} · {s.region}
                </span>
              </div>
              <p className="mt-0.5 text-[0.7rem] leading-snug text-ash-300">{s.headline}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ── Offline mode ── */}
      <section className="panel p-4">
        <h2 className="label">Guaranteed-offline mode</h2>
        <label className="mt-2 flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-ash-600 bg-ash-900 px-3.5 py-3">
          <span className="text-[0.8rem] leading-snug text-ash-100">
            Force every stage onto canned data
            <span className="block text-[0.66rem] text-ash-400">
              For demos with no network — or to prove the resilience story on purpose.
            </span>
          </span>
          <input
            type="checkbox"
            checked={offline}
            onChange={(e) => onOffline(e.target.checked)}
            className="h-5 w-5 accent-ash-200"
          />
        </label>
      </section>

      {/* ── Data honesty ── */}
      <section className="panel p-4">
        <h2 className="label">Where the data comes from</h2>
        <ul className="mt-2 space-y-1.5 text-[0.74rem] leading-snug text-ash-200">
          {[
            ['Fire perimeters', 'NIFC ArcGIS (live) → canned reconstruction'],
            ['Satellite hotspots', 'NASA FIRMS (live) → canned'],
            ['Wind', 'Open-Meteo (live) → canned Santa Ana event'],
            ['Terrain & exits', 'Mireye ground context (live) → canned'],
            ['Road closures', 'Caltrans LCS (live, keyless) → canned'],
            ['Evacuation zones', 'CAL FIRE / Cal OES (live, keyless) → canned'],
            ['Roads & geocoding', 'Google Directions/Geocoding (live) → road-true canned geometry'],
            ['Reasoning prose', 'Claude — reads reports & phrases verdicts; never decides'],
          ].map(([k, v]) => (
            <li key={k} className="flex justify-between gap-3">
              <span className="shrink-0 font-semibold text-ash-100">{k}</span>
              <span className="text-right text-ash-300">{v}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 border-t border-ash-700/60 pt-2 text-[0.68rem] leading-snug text-ash-300">
          Every value carries provenance (live / cached / canned) and the Escape tab's "show the
          working" panel displays it. When a feed is down we degrade loudly, never silently.
        </p>
      </section>

      {/* ── Privacy stance ── */}
      <section className="panel p-4">
        <h2 className="label">Your location, our rules</h2>
        <ul className="mt-2 space-y-1.5 text-[0.74rem] leading-snug text-ash-200">
          <li>• Peacetime: location off. Profiles are static text you control.</li>
          <li>• Emergency: sharing is opt-in per event, visible only to your household.</li>
          <li>• When the incident closes, live traces auto-delete.</li>
          <li>• Precise location is never sold. Aggregate road-survivability data only.</li>
        </ul>
        <p className="mt-2.5 border-t border-ash-700/60 pt-2 text-[0.68rem] leading-snug text-ash-300">
          In a fire, your location is medical data. We treat it that way.
        </p>
      </section>

      {/* ── About ── */}
      <section className="panel p-4">
        <h2 className="label">What Ember is</h2>
        <p className="mt-2 text-[0.8rem] leading-relaxed text-ash-100">
          Everyone tells you a fire exists. Ember tells you the safe way out — by racing the fire's
          projected arrival against <em className="not-italic font-semibold">your</em> arrival on
          every road, at your speed, with your constraints. A deterministic judge makes the
          life-or-death call; AI reads the messy world and explains the answer. It never decides.
        </p>
      </section>
    </div>
  );
}
