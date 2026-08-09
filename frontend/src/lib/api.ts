/**
 * EMBER — backend client.
 * OWNER: FRONTEND
 *
 * In dev, Vite proxies `/api` to the backend, so `VITE_API_URL` can stay unset
 * and there is no CORS to think about. In production (Render static site +
 * separate web service) set `VITE_API_URL` to the backend's URL.
 */

import type {
  AssessRequest,
  AssessResponse,
  ApiError,
  FamilyAssessment,
  FamilyMember,
  ScenarioSummary,
} from '@ember/shared';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    // Almost always "the backend isn't running". Say that, not "Failed to fetch".
    throw new ApiRequestError(
      'Cannot reach the Ember backend',
      'Is it running? Try `npm run dev:api` from the repo root.',
    );
  }

  const payload = (await res.json().catch(() => null)) as T | ApiError | null;

  if (!res.ok || (payload && typeof payload === 'object' && 'ok' in payload && !payload.ok)) {
    const error = payload as ApiError | null;
    throw new ApiRequestError(
      error?.error ?? `Request failed (${res.status})`,
      error?.detail,
      res.status,
    );
  }
  if (!payload) throw new ApiRequestError('Empty response from backend');
  return payload as T;
}

/** THE call. Runs the whole pipeline and returns everything the UI needs. */
export function assess(req: AssessRequest, signal?: AbortSignal): Promise<AssessResponse> {
  return post<AssessResponse>('/api/assess', req, signal);
}

/** The pre-built household roster. No judging — just the profiles. */
export async function fetchHousehold(signal?: AbortSignal): Promise<FamilyMember[]> {
  try {
    const res = await fetch(`${BASE}/api/household`, { signal });
    if (!res.ok) return [];
    const body = (await res.json()) as { members?: FamilyMember[] };
    return body.members ?? [];
  } catch {
    // The household is the first thing on screen. If it cannot load, the app
    // still has to work — App seeds an empty list and the address box alone is
    // enough to get a verdict.
    return [];
  }
}

/** Canned four-person household, each scored by the same judge. */
export async function fetchFamily(signal?: AbortSignal): Promise<FamilyAssessment> {
  const res = await fetch(`${BASE}/api/family`, { signal });
  const body = (await res.json().catch(() => null)) as FamilyAssessment | ApiError | null;
  if (!res.ok || !body || ('ok' in body && !body.ok)) {
    const err = body as ApiError | null;
    throw new ApiRequestError(err?.error ?? `Request failed (${res.status})`, err?.detail);
  }
  return body as FamilyAssessment;
}

export async function fetchScenarios(signal?: AbortSignal): Promise<ScenarioSummary[]> {
  try {
    const res = await fetch(`${BASE}/api/scenarios`, { signal });
    if (!res.ok) return [];
    const body = (await res.json()) as { scenarios?: ScenarioSummary[] };
    return body.scenarios ?? [];
  } catch {
    // The scenario picker is a nice-to-have. Never let it break the app.
    return [];
  }
}
