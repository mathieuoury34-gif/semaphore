// Chargement des données publiées par le robot (flux, digest, sources) et de leur état de santé.
import { useSyncExternalStore } from 'react';
import type { Digest, Feed, SourceInfo, Status, Story } from '../domain/types';
import { ageHours } from '../domain/format';
import { normalizeDigest, normalizeFeed } from '../domain/migrate';

export interface FeedState {
  phase: 'loading' | 'ready' | 'error';
  feed: Feed | null;
  digest: Digest | null;
  sources: Map<string, SourceInfo>;
  byId: Map<string, Story>;
  refreshing: boolean;
  error: string;     // dernière tentative échouée (les données précédentes restent affichées)
  fetchedAt: number; // dernière réussite
}

let state: FeedState = { phase: 'loading', feed: null, digest: null, sources: new Map(), byId: new Map(), refreshing: false, error: '', fetchedAt: 0 };
const listeners = new Set<() => void>();
const set = (p: Partial<FeedState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
export const useFeed = (): FeedState => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
export const getFeedState = (): FeedState => state;

async function getJSON<T>(name: string, force: boolean): Promise<T> {
  const r = await fetch(`data/${name}.json`, { cache: force ? 'reload' : 'no-cache' });
  if (!r.ok) throw new Error(`${name}.json : HTTP ${r.status}`);
  return (await r.json()) as T;
}

let inflight: Promise<void> | null = null;

/** Recharge les données. Le service worker répond depuis son cache si le réseau est coupé. */
export function loadData(opts: { force?: boolean } = {}): Promise<void> {
  if (inflight) return inflight;
  set({ refreshing: true });
  inflight = (async () => {
    try {
      const [rawFeed, rawDigest, srcs] = await Promise.all([
        getJSON<Feed>('feed', !!opts.force),
        getJSON<Digest>('digest', !!opts.force).catch(() => null),
        getJSON<{ sources: SourceInfo[] }>('sources', !!opts.force).catch(() => ({ sources: [] as SourceInfo[] })),
      ]);
      if (!rawFeed || !Array.isArray(rawFeed.stories)) throw new Error('feed.json illisible');
      const feed = normalizeFeed(rawFeed);
      const digest = normalizeDigest(rawDigest);
      set({
        phase: 'ready', feed, digest, error: '', refreshing: false, fetchedAt: Date.now(),
        sources: new Map(srcs.sources.map((s) => [s.id, s])),
        byId: new Map(feed.stories.map((s) => [s.id, s])),
      });
    } catch (e) {
      const msg = (e as Error).message || 'erreur réseau';
      set({ phase: state.feed ? 'ready' : 'error', error: navigator.onLine === false ? 'offline' : msg, refreshing: false });
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function loadStatus(): Promise<Status | null> {
  try { return await getJSON<Status>('status', false); } catch { return null; }
}

/** Les données publiées sont-elles anciennes ? (le robot passe deux fois par jour) */
export function staleHours(s: FeedState): number {
  return s.feed ? ageHours(s.feed.generatedAt) : 0;
}

export function startAutoRefresh(): void {
  void loadData();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - state.fetchedAt > 20 * 60000) void loadData();
  });
  window.addEventListener('online', () => void loadData());
}
