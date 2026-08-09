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
