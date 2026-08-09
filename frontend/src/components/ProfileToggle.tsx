/**
 * EMBER — who is this person? CONTEXT.md §5 step 7.
 * OWNER: FRONTEND
 *
 * THIS IS THE DEMO KICKER. Flipping this control re-runs the assessment against
 * the identical fire and identical roads, and the verdict changes. Make it
 * obvious, make it one click, and make sure it is on screen when you say
 * "and it's personalized".
 */

import type { UserProfile } from '@ember/shared';

interface Props {
  profile: UserProfile;
  onChange: (profile: UserProfile) => void;
  disabled?: boolean;
}

const MOBILITY_OPTIONS = [
  { value: 'standard' as const, label: 'Healthy adult', hint: 'Drives, leaves in minutes' },
  { value: 'vulnerable' as const, label: 'Reduced mobility', hint: 'Elderly, disabled, or with kids' },
];

export function ProfileToggle({ profile, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <div className="label">Who is evacuating?</div>

      <div
        role="radiogroup"
        aria-label="Mobility"
        className="grid grid-cols-2 gap-2"
      >
        {MOBILITY_OPTIONS.map((option) => {
          const active = profile.mobility === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange({ ...profile, mobility: option.value })}
              className={`rounded-xl border px-3 py-2.5 text-left transition-all disabled:opacity-50 ${
                active
                  ? 'border-ember-500 bg-ember-500/15 shadow-[0_0_0_1px_rgba(255,107,10,0.35)]'
                  : 'border-ash-700 bg-ash-850 hover:border-ash-600 hover:bg-ash-800'
              }`}
            >
              <div
                className={`text-sm font-semibold ${active ? 'text-ember-100' : 'text-ash-200'}`}
              >
                {option.label}
              </div>
              <div className="mt-0.5 text-[0.68rem] leading-tight text-ash-400">{option.hint}</div>
            </button>
          );
        })}
      </div>

      <label
        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-all ${
          profile.hasCar
            ? 'border-ash-700 bg-ash-850'
            : 'border-alarm-500/40 bg-alarm-500/10'
        } ${disabled ? 'opacity-50' : 'hover:border-ash-600'}`}
      >
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-ember-500"
          checked={profile.hasCar}
          disabled={disabled}
          onChange={(e) => onChange({ ...profile, hasCar: e.target.checked })}
        />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ash-200">Has a vehicle</span>
          {!profile.hasCar && (
            <span className="block text-[0.68rem] leading-tight text-alarm-400">
              On foot — every route takes roughly 7x longer
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
