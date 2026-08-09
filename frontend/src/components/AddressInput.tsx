/**
 * EMBER — address entry.
 * OWNER: FRONTEND
 *
 * One field, one button, one obvious action. Nobody reads a form during an
 * evacuation.
 */

import { useEffect, useState, type FormEvent } from 'react';
import type { ScenarioSummary } from '@ember/shared';

interface Props {
  /**
   * `scenarioId` is set ONLY by the demo buttons. Typing an address leaves it
   * undefined, which runs the pipeline fully live. Without this the demo
   * buttons would geocode for real and load whatever fire is burning today
   * instead of the scenario they are named after.
   */
  onSubmit: (address: string, scenarioId?: string) => void;
  loading: boolean;
  initialValue?: string;
  /** Demo addresses, so you never have to type on stage. */
  scenarios: ScenarioSummary[];
}

export function AddressInput({ onSubmit, loading, initialValue = '', scenarios }: Props) {
  const [value, setValue] = useState(initialValue);

  /**
   * Selecting someone in the household changes the address out from under this
   * field. Without this sync the box would keep showing the previous person's
   * address — and, worse, submitting it would send the OLD address with the NEW
   * profile. Typing still wins; `initialValue` only moves when the parent
   * deliberately changes it.
   */
  useEffect(() => setValue(initialValue), [initialValue]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length >= 3) onSubmit(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="label">Your address</div>

      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1500 Palisades Drive, Pacific Palisades"
          autoComplete="street-address"
          spellCheck={false}
          className="w-full rounded-xl border border-ash-700 bg-ash-850 px-4 py-3 pr-12 text-[0.95rem] text-ash-100 placeholder:text-ash-500 outline-none transition-colors focus:border-ember-500 focus:ring-1 focus:ring-ember-500/40"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-400" />
          </span>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || value.trim().length < 3}
        className="relative w-full overflow-hidden rounded-xl bg-ember-600 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.1em] text-white transition-all hover:bg-ember-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Assessing…' : 'Find my way out'}
        {loading && (
          <span className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-white/20" />
        )}
      </button>

      {scenarios.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          <span className="self-center text-[0.65rem] uppercase tracking-wider text-ash-400">
            Demo:
          </span>
          {scenarios.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={loading}
              onClick={() => {
                setValue(s.demoAddress);
                onSubmit(s.demoAddress, s.id);
              }}
              className="rounded-lg border border-ash-700 bg-ash-850 px-2.5 py-1 text-[0.7rem] text-ash-200 transition-colors hover:border-ember-500/50 hover:text-ember-300 disabled:opacity-40"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
