/**
 * EMBER — icons.
 * OWNER: FRONTEND
 *
 * Inline stroke icons, 24-box, 1.8px stroke, currentColor — the Cursor
 * school: quiet line-work, no emoji, no icon font, no dependency. Each is
 * hand-trimmed to the few strokes that read at 16px.
 */

interface IconProps {
  className?: string;
}

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** Escape: a navigation arrow — the way out. */
export function IconNavigate({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 3 L19 20 L12 16 L5 20 Z" />
    </svg>
  );
}

/** People: two heads, one household. */
export function IconPeople({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="9" cy="8.5" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" />
      <path d="M15.5 5.8a3.2 3.2 0 0 1 0 5.4" />
      <path d="M17.5 14.9c1.8.8 3 2.3 3 4.6" />
    </svg>
  );
}

/** Responder: a shield — the crew's view. */
export function IconShield({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M12 3.5 L19 6.5 V11.5 C19 16 16 19.2 12 20.5 C8 19.2 5 16 5 11.5 V6.5 Z" />
      <path d="M9.5 11.5 L11.3 13.3 L14.8 9.8" />
    </svg>
  );
}

/** Settings: two sliders — controls, not gears. */
export function IconSliders({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <path d="M4 8 H20 M4 16 H20" />
      <circle cx="9" cy="8" r="2.2" fill="#0a0a0b" />
      <circle cx="15" cy="16" r="2.2" fill="#0a0a0b" />
    </svg>
  );
}

/** Locate: a crosshair — "use my position". */
export function IconLocate({ className }: IconProps) {
  return (
    <svg {...base} className={className} aria-hidden>
      <circle cx="12" cy="12" r="6.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <path d="M12 2.5v3 M12 18.5v3 M2.5 12h3 M18.5 12h3" />
    </svg>
  );
}
