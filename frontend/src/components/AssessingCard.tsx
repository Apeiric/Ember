/**
 * EMBER — the wait, narrated.
 * OWNER: FRONTEND
 *
 * The first assessment takes ten to twenty seconds, and they are the most
 * anxious seconds in the product. Dead air here reads as "is it broken?".
 * So the wait explains the machinery: each line is a real pipeline stage, in
 * the order the backend actually runs them. The user finishes the wait
 * already understanding HOW the answer was made — which is the trust the
 * verdict then spends.
 *
 * Timing is cosmetic (we do not stream stage completion — yet); the CONTENT
 * is honest. Never list a stage we do not run.
 */

import { useEffect, useState } from 'react';

const STAGES = [
  ['Finding your address', 'geocoding'],
  ['Reading the fire', 'perimeter · satellite hotspots · wind'],
  ['Projecting where it goes', 'minute-by-minute spread rings'],
  ['Checking official sources', 'road closures · evacuation zones'],
  ['Racing every road', 'fire’s arrival vs yours, point by point'],
  ['Writing it plainly', 'so it can be read in three seconds'],
] as const;

const STAGE_MS = 1700;

export function AssessingCard() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t = window.setInterval(
      () => setStage((s) => Math.min(s + 1, STAGES.length - 1)),
      STAGE_MS,
    );
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="rise panel p-4" role="status" aria-live="polite">
      <h2 className="label">Working out your way out</h2>
      <ol className="mt-3 space-y-2">
        {STAGES.map(([title, detail], i) => {
          const done = i < stage;
          const now = i === stage;
          return (
            <li key={title} className={`flex items-start gap-2.5 ${i > stage ? 'opacity-35' : ''}`}>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                {done ? (
                  <span className="text-[0.9rem] font-bold text-safe-400">✓</span>
                ) : now ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-400" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-ash-600" />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block text-[0.82rem] font-semibold leading-tight ${
                    done ? 'text-ash-300' : now ? 'text-ash-50' : 'text-ash-200'
                  }`}
                >
                  {title}
                </span>
                <span className="block text-[0.66rem] leading-snug text-ash-400">{detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
