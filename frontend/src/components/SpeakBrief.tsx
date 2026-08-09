/**
 * EMBER — the brief, spoken.
 * OWNER: FRONTEND
 *
 * An evacuation brief that must be READ is useless to someone backing out of
 * a driveway. `speechSynthesis` ships in every browser, works offline, and
 * costs nothing — the phone simply says the plan out loud.
 *
 * The spoken text is assembled from the same judged facts as the screen:
 * verdict, direction, deadline, the steps, the tightest point, the refusal.
 * Nothing is spoken that is not shown.
 */

import { useEffect, useRef, useState } from 'react';
import type { ProfileTuning, RouteVerdict, ScoredRoute } from '@ember/shared';

interface Props {
  verdict: RouteVerdict;
  recommended: ScoredRoute | null;
  tuning: ProfileTuning;
  essentials?: string[];
  whyNot?: { name: string; reason: string } | null;
}

export function SpeakBrief({ verdict, recommended, tuning, essentials, whyNot }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // New verdict = stale speech. Stop rather than narrate the wrong escape.
  useEffect(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, [verdict]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!('speechSynthesis' in window)) return null;

  const toggle = () => {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(briefText({ verdict, recommended, tuning, essentials, whyNot }));
    u.rate = 1.02;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utteranceRef.current = u;
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className={`flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-[0.72rem] font-bold uppercase tracking-wider transition-colors ${
        speaking
          ? 'border-ember-400 bg-ember-500/20 text-ember-200'
          : 'border-ash-600/80 bg-ash-900/95 text-ash-200 hover:border-ember-500/60 hover:text-ember-300'
      }`}
    >
      <span className="text-sm leading-none">{speaking ? '◼' : '🔊'}</span>
      {speaking ? 'Stop reading' : 'Read my brief aloud'}
    </button>
  );
}

function briefText({ verdict, recommended, tuning, essentials, whyNot }: Props): string {
  const parts: string[] = [];
  parts.push(`${verdict.headline}.`);
  if (verdict.subhead) parts.push(`${verdict.subhead}.`);
  if (verdict.leaveWithinMinutes !== null && verdict.leaveWithinMinutes > 0) {
    parts.push(`You have about ${Math.round(verdict.leaveWithinMinutes)} minutes to go.`);
  }
  parts.push(`Take ${tuning.prepMinutes} minutes to get out the door.`);
  if (essentials?.length) parts.push(`Do not leave without: ${essentials.join(', ')}.`);
  if (recommended) {
    parts.push(`The route: ${recommended.route.summary.replace(/\s*→\s*/g, ', then ')}.`);
    if (recommended.pinch && recommended.pinch.slackMinutes > 0) {
      parts.push(
        `At the tightest point you pass about ${Math.round(recommended.pinch.slackMinutes)} minutes ahead of the danger.`,
      );
    }
  }
  if (whyNot) parts.push(`We are not sending you to ${whyNot.name}, because ${whyNot.reason}.`);
  parts.push('Follow instructions from emergency services.');
  return parts.join(' ');
}
