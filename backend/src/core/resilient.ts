/**
 * EMBER — the resilience primitive. CONTEXT.md §7.
 * OWNER: JUDGE (shared infrastructure) — used by every service.
 *
 * "Every external call: try primary → secondary → HARDCODED canned scenario."
 *
 * `resolve()` takes an ordered list of strategies and returns the first one that
 * succeeds, wrapped in provenance so the caller — and the UI — always knows
 * whether it got live data or a demo fallback.
 *
 * The contract every service upholds: THE LAST STRATEGY MUST NEVER FAIL.
 * Make it canned or mock data with no network dependency. Then the pipeline
 * cannot break on stage, full stop.
 */

import type { DataSource, Provenance, Sourced } from '@ember/shared';
import { recordResolved, type TraceRecorder } from './trace';
import { log } from '../logger';

export interface Strategy<T> {
  /** Provider name for provenance, e.g. "NIFC ArcGIS". */
  name: string;
  source: DataSource;
  /** Set false to skip (e.g. no API key configured). Skipped ≠ failed. */
  enabled?: boolean;
  timeoutMs?: number;
  note?: string;
  url?: string;
  run: (signal: AbortSignal) => Promise<T>;
}

export class AllStrategiesFailedError extends Error {
  constructor(
    readonly stage: string,
    readonly failures: { name: string; error: string }[],
  ) {
    super(
      `[${stage}] every strategy failed: ${failures.map((f) => `${f.name} (${f.error})`).join('; ')}`,
    );
    this.name = 'AllStrategiesFailedError';
  }
}

/** Race a promise against a hard deadline, aborting the underlying work. */
export async function withTimeout<T>(
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await Promise.race([
      fn(controller.signal),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms),
      ),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Try each strategy in order; return the first success with provenance attached.
 * Records exactly one trace stage naming the strategy that actually answered.
 */
export async function resolve<T>(
  stage: string,
  strategies: Strategy<T>[],
  trace: TraceRecorder,
  defaultTimeoutMs = 5_000,
): Promise<Sourced<T>> {
  const t0 = performance.now();
  const failures: { name: string; error: string }[] = [];

  for (const strategy of strategies) {
    if (strategy.enabled === false) {
      failures.push({ name: strategy.name, error: 'skipped (not configured)' });
      continue;
    }

    try {
      const data = await withTimeout(strategy.timeoutMs ?? defaultTimeoutMs, (signal) =>
        strategy.run(signal),
      );

      const provenance: Provenance = {
        source: strategy.source,
        provider: strategy.name,
        fetchedAt: new Date().toISOString(),
        note: strategy.note,
        url: strategy.url,
      };

      recordResolved(
        trace,
        stage,
        performance.now() - t0,
        strategy.name,
        strategy.source,
        failures.length > 0
          ? `fell back after ${failures.length} failure(s): ${failures.map((f) => f.name).join(', ')}`
          : strategy.note,
      );

      return { data, provenance };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push({ name: strategy.name, error: message });
      log.warn(`[${stage}] ${strategy.name} failed: ${message}`);
    }
  }

  trace.record({
    name: stage,
    status: 'failed',
    ms: Math.round(performance.now() - t0),
    error: failures.map((f) => `${f.name}: ${f.error}`).join(' | '),
  });
  throw new AllStrategiesFailedError(stage, failures);
}

/**
 * Run independent feeds concurrently without letting one dead API black out the
 * rest. CONTEXT.md §7: "Wrap feeds in Promise.allSettled: one dead API ≠ blackout."
 */
export async function settleAll<T extends Record<string, Promise<unknown>>>(
  tasks: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> | null }> {
  const keys = Object.keys(tasks) as (keyof T)[];
  const results = await Promise.allSettled(keys.map((k) => tasks[k]));
  const out = {} as { [K in keyof T]: Awaited<T[K]> | null };
  keys.forEach((key, i) => {
    const r = results[i]!;
    if (r.status === 'fulfilled') {
      out[key] = r.value as Awaited<T[typeof key]>;
    } else {
      out[key] = null;
      log.warn(`[settleAll] ${String(key)} rejected: ${r.reason}`);
    }
  });
  return out;
}

/** Last-resort wrapper: run `fn`, and on any throw return `fallback` instead. */
export async function guard<T>(fn: () => Promise<T>, fallback: T, label: string): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    log.warn(`[guard:${label}] ${err instanceof Error ? err.message : String(err)}`);
    return fallback;
  }
}

/** `fetch` with an abort signal and a non-2xx guard. */
export async function fetchJson<T>(
  url: string,
  signal: AbortSignal,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal,
    headers: {
      // weather.gov requires a descriptive User-Agent or it hard-rejects.
      'User-Agent': 'Ember/0.1 (wildfire evacuation routing; hackathon project)',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}
