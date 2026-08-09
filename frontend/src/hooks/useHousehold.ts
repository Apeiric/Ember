/**
 * EMBER — the household, held in memory.
 * OWNER: FRONTEND
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE PRODUCT TRUTH THIS ENCODES:
 *
 * You set your family up BEFORE the fire, not during it. Nobody is going to
 * describe their grandmother's mobility to a form while the ridge is burning.
 * So the app opens with the household already there, and the only thing you do
 * in the emergency is say which of them you are.
 *
 * NO accounts, NO database, NO persistence — deliberately. Seeded from the
 * canned fixtures on load; edits live in this hook until you refresh. That is
 * the right amount of infrastructure for a demo, and it keeps the whole feature
 * inside the browser where it cannot break the pipeline.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useCallback, useEffect, useState } from 'react';
import type { FamilyMember, Mobility } from '@ember/shared';
import { fetchHousehold } from '../lib/api';

/** The fields a person can actually change in the UI. */
export interface MemberEdit {
  name: string;
  relationship: string;
  address: string;
  mobility: Mobility;
  hasCar: boolean;
  situation: string;
}

export function useHousehold() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchHousehold().then((seed) => {
      if (cancelled) return;
      setMembers(seed);
      // "You" is the sensible default — it is whose phone this is.
      setActiveId(seed.find((m) => m.id === 'self')?.id ?? seed[0]?.id ?? null);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const active = members.find((m) => m.id === activeId) ?? null;

  /**
   * Apply an edit and RETURN the merged member, so the caller can immediately
   * re-run an assessment with the new values instead of reading stale state.
   */
  const update = useCallback(
    (id: string, edit: MemberEdit): FamilyMember | null => {
      // Merge from the CURRENT list, not inside the setState updater — updaters
      // run during render, which would return null to the caller every time.
      const existing = members.find((m) => m.id === id);
      if (!existing) return null;
      const merged: FamilyMember = {
        ...existing,
        name: edit.name.trim() || existing.name,
        relationship: edit.relationship.trim() || existing.relationship,
        address: edit.address.trim() || existing.address,
        situation: edit.situation.trim() || undefined,
        profile: { ...existing.profile, mobility: edit.mobility, hasCar: edit.hasCar },
      };
      setMembers((prev) => prev.map((m) => (m.id === id ? merged : m)));
      return merged;
    },
    [members],
  );

  /** Move a member's map pin — called when an assessment geocodes their address. */
  const setLocation = useCallback((id: string, location: { lat: number; lng: number }) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id &&
        (Math.abs(m.location.lat - location.lat) > 1e-6 ||
          Math.abs(m.location.lng - location.lng) > 1e-6)
          ? { ...m, location }
          : m,
      ),
    );
  }, []);

  const add = useCallback(() => {
    const id = `member-${Date.now().toString(36)}`;
    setMembers((prev) => [
      ...prev,
      {
        id,
        name: 'New person',
        relationship: 'Family',
        address: '',
        // Placeholder coordinate. The pipeline geocodes `address` anyway — this
        // is only here to satisfy the shape until they type one.
        location: { lat: 0, lng: 0 },
        profile: { mobility: 'standard', hasCar: true },
        situation: '',
      },
    ]);
    return id;
  }, []);

  const remove = useCallback(
    (id: string) => {
      setMembers((prev) => {
        const next = prev.filter((m) => m.id !== id);
        // Never leave nobody selected — the app would have no profile to assess.
        setActiveId((cur) => (cur === id ? (next[0]?.id ?? null) : cur));
        return next;
      });
    },
    [],
  );

  return { members, active, activeId, setActiveId, update, setLocation, add, remove, loaded };
}
