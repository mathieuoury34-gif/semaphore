// Chargement des données publiées par le robot (flux, digest, sources) et de leur état de santé.
import { useSyncExternalStore } from 'react';
import type { Digest, Feed, SourceInfo, Status, Story } from '../domain/types';
import { ageHours } from '../domain/format';
import { normalizeDigest, normalizeFeed } from '../domain/migrate';
import { native, siteUrl } from '../native/bridge';

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

/** Adresse des données : celles du site publié. Dans l'APK (interface embarquée), l'adresse complète du site. */
const dataUrl = (name: string): string => (native.isApp() ? siteUrl() : '') + `data/${name}.json`;
const CACHE = 'semaphore-data';

/**
 * Lit un fichier de données. Réseau d'abord ; hors connexion, la dernière copie connue (gardée par le service worker du navigateur,
 * ou par la page elle-même dans l'APK, qui n'a pas de service worker). `stale` signale une copie ancienne : l'écran affiche alors
 * un bandeau « Hors connexion – données du … » au lieu d'une page d'erreur.
 */
async function getJSON<T>(name: string, force: boolean): Promise<{ data: T; stale: boolean }> {
  const url = dataUrl(name);
  try {
    const r = await fetch(url, { cache: force ? 'reload' : 'no-cache' });
    if (!r.ok) throw new Error(`${name}.json : HTTP ${r.status}`);
    const stale = r.headers.get('x-semaphore-cache') === 'offline'; // copie rendue par le service worker faute de réseau
    if (!stale && (native.isApp() || !navigator.serviceWorker?.controller)) void keep(url, r.clone());
    return { data: (await r.json()) as T, stale };
  } catch (e) {
    const hit = await kept(url);
    if (hit) return { data: hit as T, stale: true };
    throw e;
  }
}
async function keep(url: string, r: Response): Promise<void> {
  try { await (await caches.open(CACHE)).put(url, r); } catch { /* stockage indisponible : sans conséquence */ }
}
async function kept(url: string): Promise<unknown> {
  try { const r = await (await caches.open(CACHE)).match(url); return r ? await r.json() : null; } catch { return null; }
}

let inflight: Promise<void> | null = null;

/** Recharge les données. Le service worker répond depuis son cache si le réseau est coupé. */
export function loadData(opts: { force?: boolean } = {}): Promise<void> {
  if (inflight) return inflight;
  set({ refreshing: true });
  inflight = (async () => {
    try {
      const [feedRes, digestRes, srcRes] = await Promise.all([
        getJSON<Feed>('feed', !!opts.force),
        getJSON<Digest>('digest', !!opts.force).catch(() => null),
        getJSON<{ sources: SourceInfo[] }>('sources', !!opts.force).catch(() => null),
      ]);
      const rawFeed = feedRes.data, rawDigest = digestRes?.data ?? null, srcs = srcRes?.data ?? { sources: [] as SourceInfo[] };
      if (!rawFeed || !Array.isArray(rawFeed.stories)) throw new Error('feed.json illisible');
      const feed = normalizeFeed(rawFeed);
      const digest = normalizeDigest(rawDigest);
      set({
        phase: 'ready', feed, digest, refreshing: false,
        // copie ancienne (hors connexion) : les données restent affichées, avec le bandeau « Hors connexion »
        error: feedRes.stale ? 'offline' : '',
        fetchedAt: feedRes.stale ? state.fetchedAt : Date.now(),
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
  try { return (await getJSON<Status>('status', false)).data; } catch { return null; }
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
