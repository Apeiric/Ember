/**
 * EMBER — address entry.
 * OWNER: FRONTEND
 *
 * One field, one button, one obvious action. Nobody reads a form during an
 * evacuation.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { IconLocate } from './Icons';
import type { ScenarioSummary } from '@ember/shared';

interface Props {
  /** Device position chosen instead of an address. Coordinates skip geocoding. */
  onLocate?: (location: { lat: number; lng: number }) => void;
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

export function AddressInput({ onSubmit, onLocate, loading, initialValue = '', scenarios }: Props) {
  const [value, setValue] = useState(initialValue);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  function useMyLocation() {
    if (!navigator.geolocation) {
      setGeoError('This browser has no location service.');
      return;
    }
    setGeoError(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        onLocate?.({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setLocating(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — type an address instead.'
            : 'Could not get a position — type an address instead.',
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  }

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
          className="w-full rounded-xl border border-ash-700 bg-ash-850 px-4 py-3 pr-12 text-[0.95rem] text-ash-100 placeholder:text-ash-500 outline-none transition-colors focus:border-ash-300 focus:ring-1 focus:ring-ash-300/30"
        />
        {loading && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2">
            <span className="block h-4 w-4 animate-spin rounded-full border-2 border-ash-400/30 border-t-ash-100" />
          </span>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading || value.trim().length < 3}
          className="relative min-w-0 flex-1 overflow-hidden rounded-xl bg-ash-100 px-4 py-3.5 text-sm font-bold uppercase tracking-[0.1em] text-ash-950 transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Assessing…' : 'Find my way out'}
          {loading && (
            <span className="absolute inset-y-0 left-0 w-1/3 animate-sweep bg-black/10" />
          )}
        </button>
        {onLocate && (
          <button
            type="button"
            onClick={useMyLocation}
            disabled={loading || locating}
            title="Use my location"
            aria-label="Use my location"
            className="flex shrink-0 items-center rounded-lg border border-white/10 bg-ash-850 px-3.5 text-ash-300 transition-colors hover:border-white/25 hover:text-ash-100 disabled:opacity-40"
          >
            {locating ? (
              <span className="block h-4 w-4 animate-spin rounded-full border-2 border-ash-400/30 border-t-ash-100" />
            ) : (
              <IconLocate className="h-[18px] w-[18px]" />
            )}
          </button>
        )}
      </div>
      {geoError && <p className="text-[0.68rem] text-alarm-400">{geoError}</p>}

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
              className="rounded-lg border border-ash-700 bg-ash-850 px-2.5 py-1 text-[0.7rem] text-ash-200 transition-colors hover:border-ash-400 hover:text-ash-100 disabled:opacity-40"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
