/**
 * EMBER — application shell.
 * OWNER: FRONTEND
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * COMPARTMENTS, NOT OVERLAYS.
 *
 * A person mid-evacuation must never fight a settings form. The app is four
 * tabs with one job each:
 *
 *   ESCAPE     the emergency surface: verdict → plan → map → live updates.
 *              Nothing else may appear here. Ever.
 *   PEOPLE     the peacetime surface: set up and edit the household, see
 *              everyone's status. Editing LIVES here, not over the map.
 *   RESPONDER  the same engine pointed the other way: which addresses lose
 *              their last way out soonest — a knock-list for crews.
 *   SETTINGS   scenarios, data sources, privacy stance, offline mode.
 *
 * Within ESCAPE the hierarchy is enforced by order: PRIMARY the verdict,
 * then the whole plan, SECONDARY the map, TERTIARY the collapsed proof.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { MemberEdit } from './hooks/useHousehold';
import type { ScenarioSummary } from '@ember/shared';
import { useAssessment } from './hooks/useAssessment';
import { useHousehold } from './hooks/useHousehold';
import { useLiveFamily } from './hooks/useLiveFamily';
import { fetchScenarios } from './lib/api';
import { AddressInput } from './components/AddressInput';
import { AssessingCard } from './components/AssessingCard';
import { FamilyBoard } from './components/FamilyView';
import { FieldReportInput } from './components/FieldReportInput';
import { HazardSummary } from './components/HazardSummary';
import { IconNavigate, IconPeople, IconShield, IconSliders } from './components/Icons';
import { Household } from './components/Household';
import { LiveFamily } from './components/LiveFamily';
import { MapView } from './components/MapView';
import { ResponderView } from './components/ResponderView';
import { RouteList } from './components/RouteList';
import { RoutePlan } from './components/RoutePlan';
import { SettingsView } from './components/SettingsView';
import { TracePanel } from './components/TracePanel';
import { VerdictHero } from './components/VerdictHero';

const Scene3D = lazy(() =>
  import('./components/Scene3D').then((m) => ({ default: m.Scene3D })),
);

type Tab = 'escape' | 'people' | 'responder' | 'settings';

export default function App() {
  const { status, data, error, run, addReport } = useAssessment();
  const household = useHousehold();
  const [scenarios, setScenarios] = useState<ScenarioSummary[]>([]);
  const [address, setAddress] = useState('');
  const [scenarioId, setScenarioId] = useState<string | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('escape');
  const [threeD, setThreeD] = useState(false);
  const [offline, setOffline] = useState(false);
  const live = useLiveFamily((positions) => {
    for (const [id, pos] of Object.entries(positions)) household.setLocation(id, pos);
  });

  useEffect(() => {
    void fetchScenarios().then(setScenarios);
  }, []);

  const loading = status === 'loading';

  /** The profile the pipeline runs against — whoever is selected in the household. */
  const activeProfile = household.active?.profile ?? { mobility: 'standard' as const, hasCar: true };

  function handleSubmit(next: string, nextScenarioId?: string) {
    setAddress(next);
    setScenarioId(nextScenarioId);
    setTab('escape');
    void run({ address: next, profile: activeProfile, scenarioId: nextScenarioId, forceOffline: offline });
  }

  /** Device GPS or a dropped pin — the point is the truth, no geocoding. */
  function handleLocate(location: { lat: number; lng: number }, label?: string) {
    const name = label ?? 'My location';
    setAddress(name);
    setTab('escape');
    void run({ address: name, location, profile: activeProfile, scenarioId, forceOffline: offline });
  }

  /**
   * Selecting a household member switches BOTH who we are assessing and where
   * they are. Selection is an emergency action and works from any tab (rows,
   * map pins); EDITING is a peacetime action and only exists on PEOPLE.
   */
  function handleSelectMember(id: string) {
    household.setActiveId(id);
    const member = household.members.find((m) => m.id === id);
    if (!member) return;
    const nextAddress = member.address.trim() || address;
    setAddress(nextAddress);
    if (nextAddress) {
      setTab('escape');
      void run({ address: nextAddress, profile: member.profile, scenarioId, forceOffline: offline });
    }
  }

  /**
   * Saving an edit must be VISIBLE. If the person on screen is the one who was
   * edited, re-run their assessment with the new address and profile.
   */
  function handleMemberUpdate(id: string, edit: MemberEdit) {
    const merged = household.update(id, edit);
    if (!merged || id !== household.activeId) return;
    const nextAddress = merged.address.trim();
    if (!nextAddress) return;
    setAddress(nextAddress);
    void run({ address: nextAddress, profile: merged.profile, scenarioId, forceOffline: offline });
  }

  // A member's pin should stand where their ADDRESS geocodes. Live runs only:
  // a pinned scenario resolves unknown addresses to its canned demo origin.
  useEffect(() => {
    if (data && household.activeId && !data.scenarioId) {
      household.setLocation(household.activeId, data.origin.location);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  /**
   * "Why not the place your phone would send you?" — when the fastest route's
   * DESTINATION differs from ours, say why theirs was refused. Derived from
   * the judge's own numbers, never authored.
   */
  const whyNot = useMemo(() => {
    const rec = data?.recommended;
    const naive = data?.naive;
    if (!rec || !naive || naive.rating !== 'REJECTED') return null;
    if (naive.route.destination.name === rec.route.destination.name) return null;
    const reason =
      naive.peakDanger >= 0.75
        ? 'the road there crosses ground that is burning or will be burning before you pass'
        : naive.minutesUntilCutoff !== null && naive.minutesUntilCutoff < 0
          ? `the fire cuts that road about ${Math.abs(Math.round(naive.minutesUntilCutoff))} min before you would pass`
          : 'it runs with the fire instead of away from it';
    return { name: naive.route.destination.name, reason };
  }, [data]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="relative min-h-0 flex-1">
        {tab === 'escape' && (
          <EscapeTab
            data={data}
            error={error}
            loading={loading}
            address={address}
            scenarioId={scenarioId}
            scenarios={scenarios}
            household={household}
            threeD={threeD}
            setThreeD={setThreeD}
            whyNot={whyNot}
            onSubmit={handleSubmit}
            onLocate={handleLocate}
            onSelectMember={handleSelectMember}
            onReport={(t) => addReport(t)}
            goPeople={() => setTab('people')}
            live={live}
          />
        )}

        {tab === 'people' && (
          <FullTab
            title="Your people"
            sub="Set this up before the fire. In the emergency you only tap a name."
          >
            <Household
              members={household.members}
              activeId={household.activeId}
              onSelect={handleSelectMember}
              onUpdate={handleMemberUpdate}
              onAdd={household.add}
              onRemove={household.remove}
            />
            <div className="mt-3">
              <FamilyBoard />
            </div>
          </FullTab>
        )}

        {tab === 'responder' && (
          <FullTab
            title="Responder mode"
            sub="The same engine, inverted: which addresses lose their last way out first."
          >
            <ResponderView />
          </FullTab>
        )}

        {tab === 'settings' && (
          <FullTab title="Settings" sub="Scenarios, data sources, and how we treat your location.">
            <SettingsView
              scenarios={scenarios}
              offline={offline}
              onOffline={setOffline}
              onRunScenario={(s) => handleSubmit(s.demoAddress, s.id)}
            />
          </FullTab>
        )}
      </div>

      <TabBar tab={tab} onTab={setTab} urgent={data?.verdict.decision === 'EVACUATE_NOW'} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ESCAPE — the emergency surface. Map behind, decisions in front.
// ═══════════════════════════════════════════════════════════════════════════

function EscapeTab({
  data,
  error,
  loading,
  address,
  scenarioId,
  scenarios,
  household,
  threeD,
  setThreeD,
  whyNot,
  onSubmit,
  onLocate,
  onSelectMember,
  onReport,
  goPeople,
  live,
}: {
  data: ReturnType<typeof useAssessment>['data'];
  error: ReturnType<typeof useAssessment>['error'];
  loading: boolean;
  address: string;
  scenarioId?: string;
  scenarios: ScenarioSummary[];
  household: ReturnType<typeof useHousehold>;
  threeD: boolean;
  setThreeD: (v: boolean) => void;
  whyNot: { name: string; reason: string } | null;
  onSubmit: (address: string, scenarioId?: string) => void;
  onLocate: (location: { lat: number; lng: number }, label?: string) => void;
  onSelectMember: (id: string) => void;
  onReport: (text: string) => void;
  goPeople: () => void;
  live: ReturnType<typeof useLiveFamily>;
}) {
  const active = household.active;
  return (
    <div className="flex h-full flex-col overflow-hidden lg:relative">
      {/* ── SECONDARY: the map ─────────────────────────────────────────── */}
      <div className="relative h-[36vh] shrink-0 lg:absolute lg:inset-0 lg:h-full">
        {threeD ? (
          <Suspense fallback={<Loading label="Loading 3D…" />}>
            <Scene3D data={data} onExit={() => setThreeD(false)} />
          </Suspense>
        ) : (
          <>
            <MapView
              data={data}
              members={household.members}
              activeId={household.activeId}
              onSelectMember={onSelectMember}
              onProbe={(p) =>
                onLocate(p, `Dropped pin (${p.lat.toFixed(4)}, ${p.lng.toFixed(4)})`)
              }
            />
            {data && (
              <button
                type="button"
                onClick={() => setThreeD(true)}
                className="absolute right-3 top-3 z-10 rounded-lg border border-ash-600/80 bg-ash-900/85 px-3 py-1.5 text-xs font-semibold text-ash-200 backdrop-blur transition-colors hover:border-ash-400 hover:text-ash-100"
              >
                Understand it in 3D
              </button>
            )}
          </>
        )}
      </div>

      {/* ── The rail ───────────────────────────────────────────────────── */}
      <div className="relative z-30 flex min-h-0 flex-1 flex-col lg:pointer-events-none lg:absolute lg:inset-0 lg:flex-row">
        <div className="scroll-thin pointer-events-auto min-h-0 flex-1 space-y-3 overflow-y-auto bg-ash-950 p-3 lg:m-3 lg:w-[28rem] lg:flex-none lg:bg-transparent lg:p-0 lg:pb-2">
          <Wordmark scenarioId={scenarioId} />

          {/* ── PRIMARY: the verdict ── */}
          {data && (
            <div className="rise">
              <VerdictHero verdict={data.verdict} recommended={data.recommended} />
            </div>
          )}

          {data?.naive?.rating === 'REJECTED' && data.verdict.rejectedSummary && (
            <div className="rise relative overflow-hidden rounded-xl border border-white/[0.08] bg-ash-900/95 px-4 py-3 pl-5">
              <span className="absolute inset-y-0 left-0 w-[3px] bg-alarm-500" />
              <p className="text-[0.62rem] font-bold uppercase tracking-[0.14em] text-alarm-400">
                We did not send you this way
              </p>
              <p className="mt-1 text-[0.82rem] leading-snug text-ash-100">
                {data.verdict.rejectedSummary}
              </p>
            </div>
          )}

          {/* The whole escape, step by step — not just the next turn. */}
          {data?.recommended && (
            <div className="rise">
              <RoutePlan
                recommended={data.recommended}
                tuning={data.tuning}
                essentials={active?.essentials}
                whyNot={whyNot}
              />
            </div>
          )}


          {data && scenarioId === 'palisades-2025' && (
            <LiveFamily
              running={live.running}
              rows={live.rows}
              events={live.events}
              assignment={live.assignment}
              clockSec={live.clockSec}
              onStart={() => void live.start()}
              onStop={live.stop}
            />
          )}

          {!data && !error && (loading ? (
            <AssessingCard />
          ) : (
            <Onboard onDemo={onSubmit} scenarios={scenarios} goPeople={goPeople} />
          ))}

          {/* Who this verdict is FOR — switching people is emergency-flow;
              editing them is not, so it lives on the PEOPLE tab. */}
          {active && (
            <button
              type="button"
              onClick={goPeople}
              className="flex w-full items-center justify-between rounded-xl border border-ash-600/80 bg-ash-900/95 px-4 py-2.5 text-left transition-colors hover:border-ash-400"
            >
              <span className="text-[0.78rem] text-ash-200">
                Assessing for{' '}
                <strong className="font-bold text-ash-50">{active.name}</strong>
                <span className="text-ash-400">
                  {' '}
                  · {active.profile.mobility === 'vulnerable' ? 'moves slowly' : 'moves quickly'}
                  {active.profile.hasCar ? '' : ' · no car'}
                </span>
              </span>
              <span className="text-[0.66rem] font-bold uppercase tracking-wider text-ash-300">
                Change →
              </span>
            </button>
          )}

          <div className="panel p-4">
            <AddressInput
              onSubmit={onSubmit}
              onLocate={(loc) => onLocate(loc)}
              loading={loading}
              scenarios={scenarios}
              initialValue={address}
            />
          </div>

          {data && (
            <FieldReportInput
              onSubmit={onReport}
              loading={loading}
              reports={data.reports}
              impact={data.impact}
            />
          )}

          {error && (
            <div className="panel border-alarm-500/40 bg-alarm-500/10 p-4">
              <p className="text-sm font-semibold text-alarm-400">{error.message}</p>
              {error.detail && <p className="mt-1 text-xs text-ash-300">{error.detail}</p>}
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
              <div className="space-y-3 border-t border-white/[0.07] p-3">
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

// ═══════════════════════════════════════════════════════════════════════════
// SHARED CHROME
// ═══════════════════════════════════════════════════════════════════════════

function Wordmark({ scenarioId }: { scenarioId?: string }) {
  return (
    <header className="flex items-baseline gap-2 px-1 pt-1">
      <span className="text-xl font-black tracking-tight text-ash-50">EMBER<span className="text-ember-500">.</span></span>
      <span
        title={
          scenarioId
            ? `Pinned to the "${scenarioId}" scenario — reproducible, no live feeds.`
            : 'Running against live feeds where available.'
        }
        className={`rounded-full border px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] ${
          scenarioId
            ? 'border-ash-500 bg-ash-800 text-ash-200'
            : 'border-safe-500/30 bg-safe-500/10 text-safe-400'
        }`}
      >
        {scenarioId ? 'Scenario' : 'Live'}
      </span>
    </header>
  );
}

/** Full-screen tab surface: its own scroll, its own header, no map underneath. */
function FullTab({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <div className="scroll-thin rise h-full overflow-y-auto bg-ash-950 p-3">
      <div className="mx-auto max-w-2xl">
        <header className="mb-3 px-1 pt-1">
          <h1 className="text-lg font-black tracking-tight text-ash-50">{title}</h1>
          <p className="text-[0.72rem] text-ash-300">{sub}</p>
        </header>
        {children}
      </div>
    </div>
  );
}

const TABS: { id: Tab; label: string; Icon: (p: { className?: string }) => JSX.Element }[] = [
  { id: 'escape', label: 'Escape', Icon: IconNavigate },
  { id: 'people', label: 'People', Icon: IconPeople },
  { id: 'responder', label: 'Responder', Icon: IconShield },
  { id: 'settings', label: 'Settings', Icon: IconSliders },
];

function TabBar({
  tab,
  onTab,
  urgent,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  urgent: boolean;
}) {
  return (
    <nav className="z-40 shrink-0 border-t border-white/[0.08] bg-ash-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTab(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 px-2 pb-2.5 pt-2 text-[0.62rem] font-bold uppercase tracking-wider transition-colors ${
                active ? 'text-ash-50' : 'text-ash-400 hover:text-ash-200'
              }`}
            >
              {/* active indicator on the top edge, where a thumb can see it */}
              <span
                className={`absolute inset-x-6 top-0 h-0.5 rounded-full ${active ? 'bg-ash-100' : 'bg-transparent'}`}
              />
              <t.Icon className="h-[18px] w-[18px]" />
              {t.label}
              {t.id === 'escape' && urgent && !active && (
                <span className="absolute right-1/4 top-1.5 h-2 w-2 animate-pulse rounded-full bg-alarm-500" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

/** First-run: what this is, and the one thing worth doing before a fire. */
function Onboard({
  scenarios,
  onDemo,
  goPeople,
}: {
  scenarios: ScenarioSummary[];
  onDemo: (address: string, scenarioId?: string) => void;
  goPeople: () => void;
}) {
  return (
    <div className="rise panel space-y-3 p-4">
      <p className="text-[0.95rem] leading-relaxed text-ash-100">
        Everyone tells you a fire <em className="not-italic text-ash-300">exists</em>.
        <br />
        Ember tells you the way <em className="not-italic font-semibold text-ember-400">out</em>.
      </p>
      <ol className="space-y-2">
        {[
          ['Set up your people once, in peacetime', 'addresses, mobility, medications — two minutes'],
          ['When it burns, tap who you are', 'we race the fire for every road, at your speed'],
          ['Follow one green line', 'and see exactly why we refused the others'],
        ].map(([head, sub], i) => (
          <li key={i} className="flex gap-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ash-100 text-[0.65rem] font-bold text-ash-950">
              {i + 1}
            </span>
            <span className="text-[0.8rem] leading-snug text-ash-200">
              <strong className="font-semibold text-ash-50">{head}</strong>
              <span className="text-ash-400"> — {sub}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={goPeople}
          className="rounded-xl bg-ash-100 px-3.5 py-2 text-[0.72rem] font-bold uppercase tracking-wider text-ash-950 transition-colors hover:bg-white"
        >
          Set up your household
        </button>
        {scenarios[0] && (
          <button
            type="button"
            onClick={() => onDemo(scenarios[0]!.demoAddress, scenarios[0]!.id)}
            className="rounded-xl border border-white/10 px-3.5 py-2 text-[0.72rem] font-bold uppercase tracking-wider text-ash-200 transition-colors hover:border-ash-400 hover:text-ash-100"
          >
            See the {scenarios[0].name} demo
          </button>
        )}
      </div>
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
