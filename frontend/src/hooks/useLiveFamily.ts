/**
 * EMBER — the live family layer.
 * OWNER: FRONTEND
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT IS REAL AND WHAT IS SIMULATED — keep this honest on stage.
 *
 * SIMULATED: the movement. Nobody's phone is feeding GPS in this demo, so
 * positions advance along each person's real assessed route at drive speed,
 * time-compressed (6×) so a 25-minute evacuation plays out in about four.
 *
 * REAL: everything decided about that movement. Who needs a pickup, who is
 * the best pickup at THIS moment, when that flips, and the ETAs — all
 * recomputed every tick from live positions with the same arithmetic the
 * judge uses. When "You" drive away from the school and Uncle Dev becomes
 * the closer adult, the reassignment is derived, not scripted.
 *
 * In production this hook's input becomes `watchPosition()` from each
 * household phone (per-incident opt-in — see SETTINGS); every line of the
 * decision logic below survives that swap unchanged.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FamilyAssessment, LatLng } from '@ember/shared';
import { fetchFamily } from '../lib/api';

const TICK_MS = 1200;
const TIME_SCALE = 6; // demo seconds → world seconds
const DRIVE_KPH = 34; // evacuation-realistic urban speed
const REASSIGN_HYSTERESIS_MIN = 1.5; // don't flap on a near-tie
/**
 * Diverting the phone-owner mid-escape is not free: they are already
 * committed to their own route, and a U-turn costs real minutes and real
 * risk. Another adult within this many minutes of parity takes the pickup —
 * which is exactly the "your uncle is better placed than you" feature.
 */
const SELF_DIVERT_PENALTY_MIN = 5;

export interface LiveRow {
  id: string;
  name: string;
  phase: 'moving' | 'sheltering' | 'waiting' | 'pickup' | 'arrived';
  text: string;
}

export interface LiveEvent {
  atSec: number;
  text: string;
  kind: 'assign' | 'reassign' | 'arrive' | 'info';
}

export interface Assignment {
  assigneeId: string;
  assigneeName: string;
  targetName: string;
  etaMinutes: number;
  /** WHY this person and not you — the decision, explained. */
  reason: string;
}

interface Track {
  id: string;
  name: string;
  hasCar: boolean;
  sheltering: boolean;
  /** The person who cannot leave alone (no car) — the pickup target. */
  needsPickup: boolean;
  path: LatLng[]; // their assessed evacuation route (may be empty)
  pos: LatLng;
  distAlongKm: number;
  totalKm: number;
}

export function useLiveFamily(onPositions: (positions: Record<string, LatLng>) => void) {
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<LiveRow[]>([]);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [clockSec, setClockSec] = useState(0);

  const tracks = useRef<Track[]>([]);
  const timer = useRef<number | undefined>(undefined);
  const startedAt = useRef(0);
  const currentAssignee = useRef<string | null>(null);
  const posCb = useRef(onPositions);
  posCb.current = onPositions;

  const stop = useCallback(() => {
    window.clearInterval(timer.current);
    setRunning(false);
  }, []);

  useEffect(() => () => window.clearInterval(timer.current), []);

  const start = useCallback(async () => {
    if (running) return;
    const family: FamilyAssessment = await fetchFamily();

    tracks.current = family.members.map((m) => {
      const path = m.recommended?.route.path ?? [];
      return {
        id: m.member.id,
        name: m.member.name,
        hasCar: m.member.profile.hasCar,
        sheltering: m.verdict.decision === 'SHELTER_IN_PLACE' && m.member.profile.hasCar,
        needsPickup: !m.member.profile.hasCar,
        path,
        pos: m.member.location,
        distAlongKm: 0,
        totalKm: pathLengthKm(path),
      };
    });

    currentAssignee.current = null;
    startedAt.current = Date.now();
    setEvents([]);
    setAssignment(null);
    setRunning(true);

    timer.current = window.setInterval(() => {
      const elapsedSec = Math.round(((Date.now() - startedAt.current) / 1000) * TIME_SCALE);
      setClockSec(elapsedSec);
      const dtKm = (DRIVE_KPH / 3600) * (TICK_MS / 1000) * TIME_SCALE;

      const target = tracks.current.find((t) => t.needsPickup);
      const assignee = currentAssignee.current;

      // ── advance the movers ────────────────────────────────────────────
      for (const t of tracks.current) {
        if (t.needsPickup || t.sheltering) continue;
        if (t.id === assignee && target) {
          // The assigned adult drives TOWARD the target, not to safety.
          t.pos = stepToward(t.pos, target.pos, dtKm);
        } else if (t.path.length >= 2 && t.distAlongKm < t.totalKm) {
          // Everyone else follows their own assessed escape route.
          t.distAlongKm = Math.min(t.totalKm, t.distAlongKm + dtKm);
          t.pos = pointAlong(t.path, t.distAlongKm);
        }
      }

      // ── the decision: who picks up the kids RIGHT NOW? ────────────────
      // Recomputed from live positions every tick. This is the aunt-is-
      // closer-than-you feature, and it is arithmetic, not a script.
      let nextAssignment: Assignment | null = null;
      if (target) {
        const candidates = tracks.current
          .filter((t) => t.hasCar && !t.needsPickup && !t.sheltering)
          .map((t) => {
            const rawEtaMin = (kmBetween(t.pos, target.pos) / DRIVE_KPH) * 60 + 2;
            return {
              t,
              rawEtaMin,
              etaMin: rawEtaMin + (t.id === 'self' ? SELF_DIVERT_PENALTY_MIN : 0),
            };
          });
        candidates.sort((a, b) => a.etaMin - b.etaMin);
        const best = candidates[0];
        if (best) {
          const incumbent = candidates.find((c) => c.t.id === currentAssignee.current);
          const keepIncumbent =
            incumbent && incumbent.t.id !== best.t.id
              ? incumbent.etaMin - best.etaMin < REASSIGN_HYSTERESIS_MIN
              : false;
          const chosen = keepIncumbent && incumbent ? incumbent : best;

          if (chosen.t.id !== currentAssignee.current) {
            const previous = tracks.current.find((t) => t.id === currentAssignee.current);
            const gain =
              incumbent && incumbent.t.id !== chosen.t.id
                ? ` — ${Math.max(1, Math.round(incumbent.etaMin - chosen.etaMin))} min closer than ${previous?.name ?? 'the previous plan'}`
                : '';
            setEvents((prev) => [
              {
                atSec: elapsedSec,
                kind: currentAssignee.current ? 'reassign' : 'assign',
                text: currentAssignee.current
                  ? `Pickup reassigned: ${chosen.t.name} → ${target.name}${gain}`
                  : `${chosen.t.name} is picking up ${target.name} (ETA ~${Math.round(chosen.etaMin)} min)`,
              },
              ...prev,
            ]);
            currentAssignee.current = chosen.t.id;
          }
          const selfCand = candidates.find((c) => c.t.id === 'self');
          nextAssignment = {
            assigneeId: chosen.t.id,
            assigneeName: chosen.t.name,
            targetName: target.name,
            etaMinutes: Math.round(chosen.rawEtaMin),
            reason:
              chosen.t.id !== 'self' && selfCand && selfCand.rawEtaMin < chosen.rawEtaMin
                ? `You are nearer on the map, but a U-turn mid-escape costs ~${SELF_DIVERT_PENALTY_MIN} min — ${chosen.t.name} covers it without breaking anyone's route.`
                : `Closest adult with a car, recomputed live.`,
          };

          // Arrival: within 300 m of the target.
          if (kmBetween(chosen.t.pos, target.pos) < 0.3) {
            setEvents((prev) =>
              prev[0]?.kind === 'arrive'
                ? prev
                : [
                    {
                      atSec: elapsedSec,
                      kind: 'arrive',
                      text: `${chosen.t.name} reached ${target.name} — picked up ✓`,
                    },
                    ...prev,
                  ],
            );
          }
        }
      }
      setAssignment(nextAssignment);

      // ── status lines + pins ───────────────────────────────────────────
      const positions: Record<string, LatLng> = {};
      const nextRows: LiveRow[] = tracks.current.map((t) => {
        positions[t.id] = t.pos;
        if (t.needsPickup) {
          const near = assignee && kmBetween(t.pos, tracks.current.find((x) => x.id === assignee)!.pos) < 0.3;
          return {
            id: t.id,
            name: t.name,
            phase: near ? 'arrived' : 'waiting',
            text: near ? 'Picked up ✓' : 'Waiting for pickup — cannot leave alone',
          };
        }
        if (t.sheltering) {
          return { id: t.id, name: t.name, phase: 'sheltering', text: 'Sheltering in place — roads cut' };
        }
        if (t.id === currentAssignee.current && target) {
          const km = kmBetween(t.pos, target.pos);
          return {
            id: t.id,
            name: t.name,
            phase: 'pickup',
            text:
              km < 0.3
                ? `At the school with ${target.name}`
                : `Driving to ${target.name} — ${km.toFixed(1)} km · ~${Math.max(1, Math.round((km / DRIVE_KPH) * 60))} min`,
          };
        }
        const leftKm = Math.max(0, t.totalKm - t.distAlongKm);
        return {
          id: t.id,
          name: t.name,
          phase: 'moving',
          text:
            leftKm <= 0.05
              ? 'Arrived at the evacuation point ✓'
              : `Evacuating — ${leftKm.toFixed(1)} km to go`,
        };
      });
      setRows(nextRows);
      posCb.current(positions);
    }, TICK_MS);
  }, [running]);

  return { running, rows, events, assignment, clockSec, start, stop };
}

// ── geometry helpers (frontend-local; the backend has its own) ─────────────

function kmBetween(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathLengthKm(path: LatLng[]): number {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += kmBetween(path[i - 1]!, path[i]!);
  return km;
}

function pointAlong(path: LatLng[], km: number): LatLng {
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = kmBetween(path[i - 1]!, path[i]!);
    if (walked + seg >= km) {
      const f = seg > 0 ? (km - walked) / seg : 0;
      return {
        lat: path[i - 1]!.lat + (path[i]!.lat - path[i - 1]!.lat) * f,
        lng: path[i - 1]!.lng + (path[i]!.lng - path[i - 1]!.lng) * f,
      };
    }
    walked += seg;
  }
  return path[path.length - 1]!;
}

function stepToward(from: LatLng, to: LatLng, km: number): LatLng {
  const total = kmBetween(from, to);
  if (total <= km) return to;
  const f = km / total;
  return { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f };
}
