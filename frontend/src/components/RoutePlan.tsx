/**
 * EMBER — the whole plan, not just the next turn.
 * OWNER: FRONTEND
 *
 * A frightened person does not want a breadcrumb; they want to see the shape
 * of the escape before they commit to it: which roads, in what order, how
 * long each takes, when they arrive — and where along it the race with the
 * fire is tightest. Every row is derived from the same time-stamped segments
 * the judge scored; nothing here is written by hand or by a language model.
 */

import type { ProfileTuning, ScoredRoute } from '@ember/shared';

interface Props {
  recommended: ScoredRoute;
  tuning: ProfileTuning;
  /** This person's grab-list — oxygen tank, EpiPen, the cat. */
  essentials?: string[];
  /** Why the OTHER destination lost — "why Oroville, not Chico", answered. */
  whyNot?: { name: string; reason: string } | null;
}

interface PlanStep {
  road: string;
  direction: string;
  km: number;
  minutes: number;
  /** Minutes on the clock (prep + paced driving) when this step ENDS. */
  etaMinutes: number;
  /** Minutes on the clock when this step STARTS. */
  startMinutes: number;
}

export function RoutePlan({ recommended, tuning, essentials, whyNot }: Props) {
  const steps = groupSegments(recommended, tuning);
  if (steps.length === 0) return null;

  // Attach the tightest-point note to exactly ONE step: the first whose time
  // window reaches it (boundaries otherwise catch it twice).
  const pinchAt = recommended.pinch?.minutesIntoTrip ?? null;
  const pinchStep =
    pinchAt === null ? -1 : steps.findIndex((s) => pinchAt <= s.etaMinutes + 0.25);
  const arrive = steps[steps.length - 1]!.etaMinutes;

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-baseline justify-between border-b border-white/[0.08] px-4 py-3">
        <h2 className="label">The whole plan</h2>
        <span className="text-[0.72rem] font-semibold text-ash-200">
          {Math.round(recommended.route.distanceKm)} km · about {Math.round(arrive)} min door to safe
        </span>
      </div>

      <ol className="px-4 py-3">
        {/* Step zero: prep. The fire does not wait while you pack. */}
        <PlanRow
          marker="●"
          markerClass="text-ash-200"
          title={`Get out the door`}
          detail={`${tuning.prepMinutes} min — ${tuning.label.toLowerCase()}`}
          eta={`min 0–${tuning.prepMinutes}`}
        />
        {(essentials?.length ?? 0) > 0 && (
          <div className="mb-2 ml-[2.05rem] rounded-lg border border-caution-500/40 bg-caution-500/10 px-2.5 py-1.5 text-[0.7rem] leading-snug text-caution-200">
            Don't leave without:{' '}
            <strong className="text-caution-100">{essentials!.join(' · ')}</strong>
          </div>
        )}

        {steps.map((s, i) => {
          const hasPinch = i === pinchStep;
          return (
            <li key={i} className="rise" style={{ animationDelay: `${i * 70}ms` }}>
              <PlanRow
                marker={String(i + 1)}
                markerClass="bg-ash-700 text-ash-100"
                numbered
                title={`${s.road} — head ${s.direction}`}
                detail={`${s.km.toFixed(1)} km · ${Math.max(1, Math.round(s.minutes))} min`}
                eta={`by min ${Math.round(s.etaMinutes)}`}
              />
              {hasPinch && recommended.pinch && (
                <div className="mb-2 ml-[2.05rem] rounded-lg border border-safe-500/40 bg-safe-500/10 px-2.5 py-1.5 text-[0.7rem] leading-snug text-safe-300">
                  ✓ Tightest point of the trip is on this road — you pass it about{' '}
                  <strong className="text-safe-200">
                    {Math.round(Math.abs(recommended.pinch.slackMinutes))} min ahead
                  </strong>{' '}
                  of the danger.
                </div>
              )}
            </li>
          );
        })}

        <PlanRow
          marker="★"
          markerClass="text-safe-400"
          title={`Arrive: ${recommended.route.destination.name}`}
          detail={recommended.rating === 'SAFE' ? 'Clear of the projected danger' : 'Keep monitoring — conditions change'}
          eta={`min ${Math.round(arrive)}`}
          last
        />
      </ol>

      {whyNot && (
        <div className="border-t border-white/[0.08] px-4 py-2.5">
          <p className="text-[0.72rem] leading-snug text-ash-200">
            <span className="font-bold uppercase tracking-wide text-ash-300">
              Why not {whyNot.name}?
            </span>{' '}
            Because {whyNot.reason}.
          </p>
        </div>
      )}
    </section>
  );
}

function PlanRow({
  marker,
  markerClass,
  numbered = false,
  title,
  detail,
  eta,
  last = false,
}: {
  marker: string;
  markerClass: string;
  numbered?: boolean;
  title: string;
  detail: string;
  eta: string;
  last?: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* timeline gutter */}
      <div className="flex w-6 flex-col items-center">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${
            numbered ? markerClass : `text-[0.95rem] ${markerClass}`
          }`}
        >
          {marker}
        </span>
        {!last && <span className="w-px flex-1 bg-ash-600/70" />}
      </div>
      <div className={`min-w-0 flex-1 ${last ? '' : 'pb-2.5'}`}>
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[0.85rem] font-semibold text-ash-100">{title}</p>
          <span className="shrink-0 text-[0.66rem] font-semibold uppercase tracking-wide text-ash-300">
            {eta}
          </span>
        </div>
        <p className="text-[0.72rem] text-ash-300">{detail}</p>
      </div>
    </div>
  );
}

/**
 * Rebuild human-readable legs from the scored segments: consecutive segments
 * sharing a road name collapse into one step, timed on THIS person's clock
 * (prep first, then driving scaled by their pace).
 */
function groupSegments(recommended: ScoredRoute, tuning: ProfileTuning): PlanStep[] {
  const segs = recommended.route.segments;
  if (segs.length === 0) return [];

  const steps: PlanStep[] = [];
  let current: { road: string; km: number; minutes: number; start: number } | null = null;

  const flush = (endCumulative: number) => {
    if (!current) return;
    steps.push({
      road: current.road,
      direction: compass(bearing(segs[current.start]!.start, segs[stepEnd(current.start, endCumulative)]!.end)),
      km: current.km,
      minutes: current.minutes * tuning.paceMultiplier,
      startMinutes: tuning.prepMinutes + (steps.length === 0 ? 0 : sum(steps)),
      etaMinutes: tuning.prepMinutes + sum(steps) + current.minutes * tuning.paceMultiplier,
    });
  };
  const sum = (arr: PlanStep[]) => arr.reduce((a, s) => a + s.minutes, 0);
  const stepEnd = (startIdx: number, endIdx: number) => Math.max(startIdx, endIdx);

  segs.forEach((seg, i) => {
    const road = seg.roadName ?? 'Continue';
    if (!current) {
      current = { road, km: seg.distanceKm, minutes: seg.durationMinutes, start: i };
    } else if (current.road === road) {
      current.km += seg.distanceKm;
      current.minutes += seg.durationMinutes;
    } else {
      flush(i - 1);
      current = { road, km: seg.distanceKm, minutes: seg.durationMinutes, start: i };
    }
  });
  flush(segs.length - 1);
  return steps;
}

function bearing(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function compass(deg: number): string {
  const points = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return points[Math.round(deg / 45) % 8]!;
}
