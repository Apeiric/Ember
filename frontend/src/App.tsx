/**
 * EMBER — application shell.
 * OWNER: FRONTEND
 *
 * Layout: map fills the screen, control rail floats over it on the left.
 * On mobile the rail becomes a scrollable sheet under a shorter map.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEMO RUNS TOP TO BOTTOM DOWN THE LEFT RAIL — CONTEXT.md §4:
 *
 *   1. Address field           → type the demo address, hit the button
 *   2. Map                     → fire glows, red route runs INTO it
 *   3. Verdict card slams in   → EVACUATE / direction / countdown
 *   4. Rejected band           → "the fastest route was refused"
 *   5. Profile toggle          → flip to Reduced mobility, verdict changes live
 *
 * Rehearse it twice (CONTEXT.md §11).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useState } from 'react';
import type { ScenarioSummary, UserProfile } from '@ember/shared';
import { useAssessment } from './hooks/useAssessment';
import { fetchScenarios } from './lib/api';
import { AddressInput } from './components/AddressInput';
import { HazardSummary } from './components/HazardSummary';
import { MapView } from './components/MapView';
import { ProfileToggle } from './components/ProfileToggle';
import { RouteList } from './components/RouteList';
import { TracePanel } from './components/TracePanel';
import { VerdictCard } from './components/VerdictCard';
import { DegradedBanner } from './components/SourceBadge';

export default function App() {
  const { status, data, error, run, reprofile } = useAssessment();
  const [profile, setProfile] = useState<UserProfile>({ mobility: 'standard', hasCar: true });
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [address, setAddress] = useState('');

  useEffect(() => {
    void fetchScenarios().then(setScenarios);
  }, []);

  const loading = status === 'loading';

  function handleSubmit(next: string) {
    setAddress(next);
    void run({ address: next, profile });
  }

  /**
   * Changing who is evacuating re-runs immediately against the same address.
   * This is the demo kicker — it must feel instant, not like a new search.
   */
  function handleProfileChange(next: UserProfile) {
    setProfile(next);
    if (address) reprofile(next);
  }

  const rejectedCount = useMemo(
    () => data?.routes.filter((r) => r.rating === 'REJECTED').length ?? 0,
    [data],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden lg:relative">
      {/* ── MAP ────────────────────────────────────────────────────────── */}
      <div className="h-[45vh] shrink-0 lg:absolute lg:inset-0 lg:h-full">
        <MapView data={data} />
      </div>

      {/* ── CONTROL RAIL ───────────────────────────────────────────────── */}
      <div className="relative flex min-h-0 flex-1 flex-col lg:pointer-events-none lg:absolute lg:inset-0 lg:flex-row">
        {/* Block flow + space-y, NOT flex-col + gap: in a scrolling flex column
            the children shrink to fit instead of overflowing, which silently
            crushes the verdict card into a sliver. */}
        <div className="scroll-thin pointer-events-auto min-h-0 flex-1 space-y-3 overflow-y-auto bg-ash-950 p-3 lg:m-3 lg:w-[27rem] lg:flex-none lg:bg-transparent lg:p-0">
          <Header />

          <div className="panel p-4">
            <AddressInput
              onSubmit={handleSubmit}
              loading={loading}
              scenarios={scenarios}
              initialValue={address}
            />
          </div>

          <div className="panel p-4">
            <ProfileToggle profile={profile} onChange={handleProfileChange} disabled={loading} />
          </div>

          {error && (
            <div className="panel border-alarm-500/40 bg-alarm-500/10 p-4">
              <p className="text-sm font-semibold text-alarm-400">{error.message}</p>
              {error.detail && <p className="mt-1 text-xs text-ash-400">{error.detail}</p>}
            </div>
          )}

          {data && (
            <>
              <DegradedBanner degraded={data.trace.degraded} />

              <VerdictCard
                verdict={data.verdict}
                recommended={data.recommended}
                naive={data.naive}
              />

              <HazardSummary data={data} />

              <RouteList routes={data.routes} recommendedId={data.recommended?.route.id} />

              <TracePanel trace={data.trace} />

              {/* Boxed rather than loose: on desktop the rail is transparent and
                  bare text collides with the map's own caption underneath. */}
              <p className="rounded-xl bg-ash-950/80 px-3 py-2 text-[0.62rem] leading-snug text-ash-500 backdrop-blur-sm">
                Ember is a decision aid, not an official evacuation order. Always follow
                instructions from emergency services. {rejectedCount > 0 && `${rejectedCount} route`}
                {rejectedCount > 1 ? 's were' : rejectedCount === 1 ? ' was' : ''}
                {rejectedCount > 0 && ' rejected by the safety engine.'}
              </p>
            </>
          )}

          {!data && !error && <EmptyState />}
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="flex items-baseline justify-between gap-2 px-1 pt-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-black tracking-tight text-ember-500">EMBER</span>
        <span className="hidden text-[0.68rem] text-ash-400 sm:inline">
          the safe way out of a wildfire
        </span>
      </div>
    </header>
  );
}

function EmptyState() {
  return (
    <div className="panel p-4">
      <p className="text-[0.82rem] leading-relaxed text-ash-300">
        Everyone tells you a fire <em className="not-italic text-ash-100">exists</em>. Ember tells
        you the safe way <em className="not-italic text-ember-400">out</em>.
      </p>
      <p className="mt-2 text-[0.72rem] leading-relaxed text-ash-500">
        Routes are scored against where the fire is going, not where it is now — and against how
        fast <em className="not-italic">you</em> can actually move.
      </p>
    </div>
  );
}
