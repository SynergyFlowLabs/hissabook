'use client';

/**
 * Stale-while-revalidate cache for screen payloads.
 *
 * Navigation is client-side now, so leaving a screen unmounts it and coming back
 * remounts it with `useState(null)` — which is why every visit showed the
 * full-screen "Preparing your workspace" loader even though the data had been
 * fetched a second earlier. The bytes were already in the browser; only the
 * component's memory was thrown away.
 *
 * Screens seed their state from here on mount and write the fresh result back
 * after each fetch. A returning visit paints the last payload immediately and
 * still revalidates, so the number the user reads is never stale by more than
 * one fetch. Entries are dropped by `forget()` after a mutation so an edit is
 * never masked by a cached snapshot.
 *
 * Deliberately tiny: a module-level Map, no timers, no network. It must stay
 * usable from a normal client component without a provider.
 */

const entries = new Map<string, unknown>();

export function readCache<T>(key: string): T | null {
  // The map is module state, so on the server it would outlive a request and
  // could hand one visitor another's payload. Server renders always start cold.
  if (typeof window === 'undefined') return null;
  return (entries.get(key) as T | undefined) ?? null;
}

export function writeCache<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  entries.set(key, value);
}

/**
 * Wipes every entry. Called on sign-out: the map outlives the session, so without
 * this the next person to sign in on the same device would see the previous
 * account's totals for one paint before revalidation replaced them.
 */
export function clearCache(): void {
  if (typeof window === 'undefined') return;
  entries.clear();
}

export function forgetCache(key: string): void {
  if (typeof window === 'undefined') return;
  entries.delete(key);
}
