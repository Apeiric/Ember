/**
 * EMBER — environment configuration.
 * OWNER: DATA
 *
 * NEVER hardcode a secret. Locally: `backend/.env.local`. On Render: the
 * Environment tab in the dashboard (CONTEXT.md §8 — set them there too, not
 * just locally; that is a classic day-of-demo failure).
 *
 * This module never throws on a missing key. A missing key disables that
 * provider's strategy, and `resolve()` falls through to the next one. The app
 * boots and demos correctly with an entirely empty environment.
 */

import { config } from 'dotenv';

// .env.local wins over .env; neither is committed.
config({ path: '.env.local' });
config();

const str = (name: string): string | undefined => {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v.trim() : undefined;
};

const bool = (name: string, fallback: boolean): boolean => {
  const v = str(name)?.toLowerCase();
  if (v === undefined) return fallback;
  return v === '1' || v === 'true' || v === 'yes';
};

export const env = {
  nodeEnv: str('NODE_ENV') ?? 'development',
  port: Number(str('PORT') ?? 8787),
  /** Comma-separated allowlist. Empty = allow all (fine for a hackathon). */
  corsOrigins: (str('CORS_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean),

  // ── External providers (all optional) ────────────────────────────────────
  googleMapsKey: str('GOOGLE_MAPS_API_KEY'),
  firmsKey: str('NASA_FIRMS_API_KEY'),
  mireyeKey: str('MIREYE_API_KEY'),
  mireyeBaseUrl: str('MIREYE_BASE_URL') ?? 'https://api.mireye.ai',
  anthropicKey: str('ANTHROPIC_API_KEY'),
  anthropicModel: str('ANTHROPIC_MODEL') ?? 'claude-opus-5',
  groqKey: str('GROQ_API_KEY'),
  groqModel: str('GROQ_MODEL') ?? 'llama-3.3-70b-versatile',

  // ── Behaviour switches ───────────────────────────────────────────────────
  /**
   * Master kill switch for outbound network calls. Turn this ON before you walk
   * on stage if the venue wifi is hostile — everything runs on canned data and
   * the demo is byte-for-byte reproducible.
   */
  forceOffline: bool('EMBER_FORCE_OFFLINE', false),
  defaultScenarioId: str('EMBER_DEFAULT_SCENARIO') ?? 'palisades-2025',
  logLevel: str('LOG_LEVEL') ?? 'info',
} as const;

/** Which providers are actually wired up. Surfaced at GET /api/health. */
export const capabilities = {
  geocoding: Boolean(env.googleMapsKey),
  directions: Boolean(env.googleMapsKey),
  hotspots: Boolean(env.firmsKey),
  ground: Boolean(env.mireyeKey),
  claude: Boolean(env.anthropicKey),
  groq: Boolean(env.groqKey),
  /** NIFC perimeters and NWS wind need no key. */
  perimeters: true,
  wind: true,
} as const;

export function isOffline(requestOverride?: boolean): boolean {
  return env.forceOffline || requestOverride === true;
}
