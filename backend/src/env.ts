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
import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

// ─────────────────────────────────────────────────────────────────────────────
// Locate the env files RELATIVE TO THIS MODULE, not to process.cwd().
//
// cwd differs depending on how you start us:
//   npm run dev              → cwd is backend/
//   node backend/dist/...    → cwd is the repo root
// A cwd-relative lookup silently finds nothing in the second case, and you get
// a "why are all my keys missing" bug five minutes before the demo.
// ─────────────────────────────────────────────────────────────────────────────
const here = dirname(fileURLToPath(import.meta.url));
for (const dir of [
  resolvePath(here, '..'), // backend/ when running from src/ or dist/
  resolvePath(here, '../..'), // repo root
  process.cwd(),
]) {
  for (const file of ['.env.local', '.env']) {
    const path = resolvePath(dir, file);
    // .env.local wins over .env; first file found for a given key wins overall
    // (dotenv does not overwrite already-set vars).
    if (existsSync(path)) config({ path });
  }
}

/**
 * Read the first env var that is actually set.
 *
 * Aliases exist because the key names in a shared .env do not always match what
 * the code was written against. Accepting both is one line here and saves a
 * silent "provider disabled" that looks identical to a missing key.
 */
const str = (...names: string[]): string | undefined => {
  for (const name of names) {
    const v = process.env[name];
    if (v && v.trim().length > 0) return v.trim();
  }
  return undefined;
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
  /** Geocoding + Directions. One key, both APIs must be enabled on the project. */
  googleMapsKey: str('MAPS_API_KEY', 'GOOGLE_MAPS_API_KEY'),
  firmsKey: str('FIRMS_API_KEY', 'NASA_FIRMS_API_KEY'),
  mireyeKey: str('MIREYE_API_KEY'),
  // api.mireye.com — verified against https://mireye.ai/docs and the live
  // OpenAPI at /v1/openapi.json. NOT api.mireye.ai, which does not resolve.
  mireyeBaseUrl: str('MIREYE_BASE_URL') ?? 'https://api.mireye.com',
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
