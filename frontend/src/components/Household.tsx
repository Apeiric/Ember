/**
 * EMBER — the household panel. Replaces the query-time mobility toggle.
 * OWNER: FRONTEND
 *
 * Before: "Who is evacuating? [Healthy adult] [Reduced mobility]" — asked in the
 * middle of an emergency, as if you would classify your own grandmother's
 * mobility while the ridge burns.
 *
 * After: the household is already there. You pick which of them you are, and
 * the assessment runs against that person's real profile and real address.
 * Editing exists so the demo can show it is yours, not a fixture — but the
 * setup is meant to have happened weeks ago.
 */

import { useEffect, useRef, useState } from 'react';
import type { FamilyMember } from '@ember/shared';
import type { MemberEdit } from '../hooks/useHousehold';

interface Props {
  members: FamilyMember[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, edit: MemberEdit) => void;
  onAdd: () => string;
  onRemove: (id: string) => void;
}

export function Household({ members, activeId, onSelect, onUpdate, onAdd, onRemove }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  // Brief "SAVED" flash so an edit is visibly acknowledged, not just silently kept.
  const [savedId, setSavedId] = useState<string | null>(null);
  const savedTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);

  return (
    <section className="panel p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="label">Your household</h2>
        <span className="text-[0.62rem] text-ash-400">set up before the fire</span>
      </div>
      <p className="mt-1.5 text-[0.72rem] leading-snug text-ash-300">
        Tap whoever you are. We use their address and how fast they can move.
      </p>

      <ul className="mt-3 space-y-1.5">
        {members.map((member) =>
          editingId === member.id ? (
            <li key={member.id}>
              <MemberForm
                member={member}
                onCancel={() => setEditingId(null)}
                onSave={(edit) => {
                  onUpdate(member.id, edit);
                  setEditingId(null);
                  setSavedId(member.id);
                  window.clearTimeout(savedTimer.current);
                  savedTimer.current = window.setTimeout(() => setSavedId(null), 1800);
                }}
                onRemove={
                  members.length > 1
                    ? () => {
                        onRemove(member.id);
                        setEditingId(null);
                      }
                    : undefined
                }
              />
            </li>
          ) : (
            <li key={member.id}>
              <MemberRow
                member={member}
                active={member.id === activeId}
                justSaved={member.id === savedId}
                onSelect={() => onSelect(member.id)}
                onEdit={() => setEditingId(member.id)}
              />
            </li>
          ),
        )}
      </ul>

      <button
        type="button"
        onClick={() => setEditingId(onAdd())}
        className="mt-2 w-full rounded-xl border border-dashed border-ash-500 px-3 py-2 text-[0.72rem] font-semibold text-ash-300 transition-colors hover:border-ash-400 hover:text-ash-100"
      >
        + Add someone
      </button>
    </section>
  );
}

function MemberRow({
  member,
  active,
  justSaved,
  onSelect,
  onEdit,
}: {
  member: FamilyMember;
  active: boolean;
  justSaved: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className={`flex items-stretch overflow-hidden rounded-xl border transition-all ${
        active
          ? 'border-ash-200 bg-ash-100/[0.06] shadow-[0_0_0_1px_rgba(236,236,239,0.25)]'
          : 'border-ash-700 bg-ash-850 hover:border-ash-600'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className="min-w-0 flex-1 px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${active ? 'bg-ash-100' : 'bg-ash-600'}`}
          />
          <span
            className={`truncate text-[0.85rem] font-semibold ${active ? 'text-ash-50' : 'text-ash-200'}`}
          >
            {member.name}
          </span>
          <span className="shrink-0 text-[0.62rem] text-ash-400">{member.relationship}</span>
          {justSaved && (
            <span className="shrink-0 rounded border border-safe-500/50 bg-safe-500/15 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-safe-400">
              Saved ✓
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate pl-4 text-[0.68rem] text-ash-300">
          {member.address || 'No address yet'}
        </div>
        <div className="mt-1 flex flex-wrap gap-1 pl-4">
          <Tag
            tone={member.profile.mobility === 'vulnerable' ? 'warn' : 'plain'}
            label={member.profile.mobility === 'vulnerable' ? 'Moves slowly' : 'Moves quickly'}
          />
          {!member.profile.hasCar && <Tag tone="alarm" label="No car" />}
        </div>
        {member.situation && (
          <p className="mt-1 line-clamp-2 pl-4 text-[0.65rem] leading-snug text-ash-400">
            {member.situation}
          </p>
        )}
        {(member.essentials?.length ?? 0) > 0 && (
          <p className="mt-1 pl-4 text-[0.63rem] leading-snug text-caution-300">
            Grab: {member.essentials!.join(' · ')}
          </p>
        )}
      </button>

      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${member.name}`}
        className="shrink-0 border-l border-ash-600 px-3 text-[0.65rem] font-bold uppercase tracking-wider text-ash-300 transition-colors hover:bg-ash-800 hover:text-ash-100"
      >
        Edit
      </button>
    </div>
  );
}

function MemberForm({
  member,
  onSave,
  onCancel,
  onRemove,
}: {
  member: FamilyMember;
  onSave: (edit: MemberEdit) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [edit, setEdit] = useState<MemberEdit>({
    name: member.name,
    relationship: member.relationship,
    address: member.address,
    mobility: member.profile.mobility,
    hasCar: member.profile.hasCar,
    situation: member.situation ?? '',
    essentials: (member.essentials ?? []).join(', '),
  });
  const set = <K extends keyof MemberEdit>(k: K, v: MemberEdit[K]) =>
    setEdit((p) => ({ ...p, [k]: v }));

  return (
    <div className="space-y-2 rounded-xl border border-ash-500 bg-ash-850 p-3">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name" value={edit.name} onChange={(v) => set('name', v)} />
        <Field
          label="Relationship"
          value={edit.relationship}
          onChange={(v) => set('relationship', v)}
        />
      </div>
      <Field
        label="Address"
        value={edit.address}
        onChange={(v) => set('address', v)}
        placeholder="1500 Palisades Dr, Pacific Palisades"
      />

      <div>
        <div className="label !text-[0.55rem]">How fast can they move?</div>
        <div className="mt-1 grid grid-cols-2 gap-1.5">
          {(
            [
              ['standard', 'Quickly', 'Drives, out in minutes'],
              ['vulnerable', 'Slowly', 'Elderly, disabled, or with kids'],
            ] as const
          ).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              onClick={() => set('mobility', value)}
              className={`rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                edit.mobility === value
                  ? 'border-ash-200 bg-ash-100/10'
                  : 'border-ash-700 bg-ash-900 hover:border-ash-600'
              }`}
            >
              <div className="text-[0.75rem] font-semibold text-ash-100">{label}</div>
              <div className="text-[0.6rem] leading-tight text-ash-400">{hint}</div>
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-ash-700 bg-ash-900 px-2.5 py-2">
        <input
          type="checkbox"
          className="h-4 w-4 accent-ash-200"
          checked={edit.hasCar}
          onChange={(e) => set('hasCar', e.target.checked)}
        />
        <span className="text-[0.75rem] text-ash-200">Has a vehicle</span>
      </label>

      <Field
        label="Anything we should know?"
        value={edit.situation}
        onChange={(v) => set('situation', v)}
        placeholder="Needs an oxygen tank. Has a cat."
      />

      <Field
        label="Can't leave without (comma-separated)"
        value={edit.essentials}
        onChange={(v) => set('essentials', v)}
        placeholder="Oxygen tank, EpiPen, medications, cat"
      />

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onSave(edit)}
          className="rounded-lg bg-ash-100 px-3 py-1.5 text-[0.72rem] font-bold uppercase tracking-wider text-ash-950 hover:bg-white"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-ash-600 px-3 py-1.5 text-[0.72rem] font-semibold text-ash-300 hover:border-ash-500"
        >
          Cancel
        </button>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto text-[0.68rem] font-semibold text-alarm-400 hover:text-alarm-300"
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="label !text-[0.55rem]">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-ash-700 bg-ash-900 px-2.5 py-1.5 text-[0.78rem] text-ash-100 placeholder:text-ash-600 outline-none focus:border-ash-300"
      />
    </label>
  );
}

function Tag({ label, tone }: { label: string; tone: 'plain' | 'warn' | 'alarm' }) {
  const style =
    tone === 'alarm'
      ? 'border-alarm-500/40 bg-alarm-500/10 text-alarm-400'
      : tone === 'warn'
        ? 'border-caution-500/40 bg-caution-500/10 text-caution-400'
        : 'border-ash-600 bg-ash-800 text-ash-400';
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider ${style}`}
    >
      {label}
    </span>
  );
}
