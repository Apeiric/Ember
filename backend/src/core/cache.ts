/**
 * EMBER — in-process TTL cache.
 * OWNER: DATA
 *
 * Single-instance memory cache. Deliberately not Redis: on Render's free tier
 * we run one process, and a fire perimeter does not change between two demo
 * runs thirty seconds apart. Keeps us off rate limits during rehearsal.
 */

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): T {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

/**
 * Memoize an async producer. On a hit, `onHit` fires so the caller can flip
 * provenance from 'live' to 'cached' and keep the UI badge honest.
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  produce: () => Promise<T>,
  onHit?: () => void,
): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) {
    onHit?.();
    return hit;
  }
  return cacheSet(key, await produce(), ttlMs);
}

export function cacheClear(): void {
  store.clear();
}

export function cacheStats(): { size: number; keys: string[] } {
  return { size: store.size, keys: [...store.keys()] };
}
