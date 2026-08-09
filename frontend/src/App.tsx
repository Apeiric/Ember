/**
 * EMBER — application shell.
 * OWNER: FRONTEND
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * INFORMATION HIERARCHY — enforced by layout order, not by willpower.
 *
 *   PRIMARY    VerdictHero      what to do · which way · how long
 *   SECONDARY  the map          red route kills you, green route does not
 *   TERTIARY   <details>        pipeline, sources, why routes were rejected
 *
 * The technical proof is present for credibility and collapsed so it cannot
 * compete with the instruction. If a judge wants the receipts they are one tap
 * away; if a frightened person wants the answer it is the biggest thing on the
 * screen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Suspense, lazy, useEffect, useState } from 'react';
import type { MemberEdit } from './hooks/useHousehold';
import type { ScenarioSummary } from '@ember/shared';
import { useAssessment } from './hooks/useAssessment';
import { useHousehold } from './hooks/useHousehold';
import { fetchScenarios } from './lib/api';
import { AddressInput } from './components/AddressInput';
import { FamilyView } from './components/FamilyView';
import { FieldReportInput } from './components/FieldReportInput';
import { HazardSummary } from './components/HazardSummary';
import { Household } from './components/Household';
import { MapView } from './components/MapView';
import { RouteList } from './components/RouteList';
import { RoutePlan } from './components/RoutePlan';
import { TracePanel } from './components/TracePanel';
import { VerdictHero } from './components/VerdictHero';

const Scene3D = lazy(() =>
  import('./components/Scene3D').then((m) => ({ default: m.Scene3D })),
);

type View = 'map' | '3d' | 'family';

export default function App() {
  const { status, data, error, run, addReport } = useAssessment();
  const household = useHousehold();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [address, setAddress] = useState('');
  const [scenarioId, setScenarioId] = useState<string | undefined>(undefined);
  const [view, setView] = useState<View>('map');

  useEffect(() => {
    void fetchScenarios().then(setScenarios);
  }, []);

  const loading = status === 'loading';

  /** The profile the pipeline runs against — whoever is selected in the household. */
  const activeProfile = household.active?.profile ?? { mobility: 'standard' as const, hasCar: true };

  function handleSubmit(next: string, nextScenarioId?: string) {
    setAddress(next);
    setScenarioId(nextScenarioId);
    void run({ address: next, profile: activeProfile, scenarioId: nextScenarioId });
  }

  /**
   * Selecting a household member switches BOTH who we are assessing and where
   * they are — that is the whole point of pre-built profiles. The address box
   * stays editable underneath, which doubles as the "I'm not at home" override.
   */
  function handleSelectMember(id: string) {
    household.setActiveId(id);
    const member = household.members.find((m) => m.id === id);
    if (!member) return;
    const nextAddress = member.address.trim() || address;
    setAddress(nextAddress);
    if (nextAddress) void run({ address: nextAddress, profile: member.profile, scenarioId });
  }

  /**
   * Saving an edit must be VISIBLE. If the person on screen is the one who was
   * edited, re-run their assessment with the new address and profile — the
   * verdict updating is the proof the save took.
   */
  function handleMemberUpdate(id: string, edit: MemberEdit) {
    const merged = household.update(id, edit);
    if (!merged || id !== household.activeId) return;
    const nextAddress = merged.address.trim();
    if (!nextAddress) return;
    setAddress(nextAddress);
    void run({ address: nextAddress, profile: merged.profile, scenarioId });
  }

  // A member's pin should stand where their ADDRESS geocodes, not where the
  // fixture guessed. Live runs only: a pinned scenario resolves unknown
  // addresses to its canned demo origin, and "we could not place you, so we
  // moved your pin to the demo house" is exactly the wrong thing to display.
  useEffect(() => {
    if (data && household.activeId && !data.scenarioId) {
      household.setLocation(household.activeId, data.origin.location);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (view === 'family') {
    return <FamilyView onExit={() => setView('map')} />;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden lg:relative">
      {/* ── SECONDARY: the map ─────────────────────────────────────────── */}
      <div className="relative h-[38vh] shrink-0 lg:absolute lg:inset-0 lg:h-full">
        {view === '3d' ? (
          <Suspense fallback={<Loading label="Loading 3D…" />}>
            <Scene3D data={data} onExit={() => setView('map')} />
          </Suspense>
        ) : (
          <>
            <MapView
              data={data}
              members={household.members}
              activeId={household.activeId}
              onSelectMember={handleSelectMember}
            />
            {data && (
              <button
                type="button"
                onClick={() => setView('3d')}
                className="absolute right-3 top-3 z-10 rounded-lg border border-ash-600/80 bg-ash-900/85 px-3 py-1.5 text-xs font-semibold text-ash-200 backdrop-blur transition-colors hover:border-ember-500 hover:text-ember-300"
              >
                See it in 3D
              </button>
            )}
          </>
        )}
      </div>

      {/* ── The rail ───────────────────────────────────────────────────── */}
      <div className="relative z-30 flex min-h-0 flex-1 flex-col lg:pointer-events-none lg:absolute lg:inset-0 lg:flex-row">
        <div className="scroll-thin pointer-events-auto min-h-0 flex-1 space-y-3 overflow-y-auto bg-ash-950 p-3 lg:m-3 lg:w-[28rem] lg:flex-none lg:bg-transparent lg:p-0">
          <Header scenarioId={scenarioId} onFamily={() => setView('family')} hasData={Boolean(data)} />

          {/* ── PRIMARY: the verdict. First thing rendered once we have one. */}
          {data && (
            <VerdictHero
              verdict={data.verdict}
              recommended={data.recommended}
            />
          )}

          {/* The one thing we refused to send you down. Kept adjacent to the
              verdict because it is the reason to trust it. */}
          {data?.naive?.rating === 'REJECTED' && data.verdict.rejectedSummary && (
            <div className="rounded-2xl border border-alarm-500/50 bg-alarm-500/15 px-4 py-3">
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-alarm-300">
                We did not send you this way
              </p>
              <p className="mt-1 text-[0.82rem] leading-snug text-ash-100">
                {data.verdict.rejectedSummary}
              </p>
            </div>
          )}

          {/* The whole escape, step by step — not just the next turn. */}
          {data?.recommended && <RoutePlan recommended={data.recommended} tuning={data.tuning} />}

          {!data && !error && <Intro />}

          <div className="panel p-4">
            <AddressInput
              onSubmit={handleSubmit}
              loading={loading}
              scenarios={scenarios}
              initialValue={address}
            />
          </div>

          <Household
            members={household.members}
            activeId={household.activeId}
            onSelect={handleSelectMember}
            onUpdate={handleMemberUpdate}
            onAdd={household.add}
            onRemove={household.remove}
          />

          {data && (
            <FieldReportInput
              onSubmit={(text) => addReport(text)}
              loading={loading}
              reports={data.reports}
              impact={data.impact}
            />
          )}

          {error && (
            <div className="panel border-alarm-500/40 bg-alarm-500/10 p-4">
              <p className="text-sm font-semibold text-alarm-400">{error.message}</p>
              {error.detail && <p className="mt-1 text-xs text-ash-400">{error.detail}</p>}
            </div>
          )}

          {/* ── TERTIARY: the proof. Collapsed. ──────────────────────────── */}
          {data && (
            <details className="panel group overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 transition-colors hover:bg-ash-800/50">
                <span className="label">Show the working</span>
                <span className="flex items-center gap-2 text-[0.66rem] text-ash-300">
                  {data.routes.filter((r) => r.rating === 'REJECTED').length} route
                  {data.routes.filter((r) => r.rating === 'REJECTED').length === 1 ? '' : 's'} rejected
                  <span className="text-ash-400 transition-transform group-open:rotate-90">›</span>
                </span>
              </summary>
              <div className="space-y-3 border-t border-ash-700/60 p-3">
                <HazardSummary data={data} />
                <RouteList routes={data.routes} recommendedId={data.recommended?.route.id} />
                <TracePanel trace={data.trace} />
              </div>
            </details>
          )}

          {data && (
            <p className="rounded-xl bg-ash-950/90 px-3 py-2 text-[0.62rem] leading-snug text-ash-300 backdrop-blur-sm">
              Ember is a decision aid, not an official evacuation order. Always follow instructions
              from emergency services.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({
  scenarioId,
  onFamily,
  hasData,
}: {
  scenarioId?: string;
  onFamily: () => void;
  hasData: boolean;
}) {
  return (
    <header className="flex items-center justify-between gap-2 px-1 pt-1">
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-black tracking-tight text-ember-500">EMBER</span>
        <span
          title={
            scenarioId
              ? `Pinned to the "${scenarioId}" scenario — reproducible, no live feeds.`
              : 'Running against live feeds where available.'
          }
          className={`rounded-full border px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] ${
            scenarioId
              ? 'border-ember-500/40 bg-ember-500/10 text-ember-300'
              : 'border-safe-500/30 bg-safe-500/10 text-safe-400'
          }`}
        >
          {scenarioId ? 'Scenario' : 'Live'}
        </span>
      </div>
      <button
        type="button"
        onClick={onFamily}
        className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
          hasData
            ? 'border-ember-500/50 bg-ember-500/10 text-ember-300 hover:bg-ember-500/20'
            : 'border-ash-600 text-ash-300 hover:border-ember-500 hover:text-ember-300'
        }`}
      >
        Your people
      </button>
    </header>
  );
}

function Intro() {
  return (
    <div className="panel p-4">
      <p className="text-[0.9rem] leading-relaxed text-ash-200">
        Everyone tells you a fire <em className="not-italic text-ash-400">exists</em>.
        <br />
        Ember tells you the way <em className="not-italic font-semibold text-ember-400">out</em>.
      </p>
      <p className="mt-2 text-[0.75rem] leading-relaxed text-ash-300">
        We check where the fire will be when you get there — not where it is now — and how fast you
        can actually move.
      </p>
    </div>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-ash-950">
      <div className="text-center">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-ember-500/30 border-t-ember-400" />
        <p className="text-sm text-ash-300">{label}</p>
      </div>
    </div>
  );
}
