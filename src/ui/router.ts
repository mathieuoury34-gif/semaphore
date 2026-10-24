// Navigation par hash (#/une, #/secteurs/espace…) avec l'historique du navigateur :
// le bouton retour d'Android ferme les feuilles et revient à l'écran précédent.
import { useSyncExternalStore } from 'react';

export interface Route {
  path: string;
  parts: string[];
  query: URLSearchParams;
  key: string;
}

export const HOME = '/une';

function parse(): Route {
  const h = location.hash.replace(/^#/, '') || HOME;
  const [p, q = ''] = h.split('?');
  const path = p.startsWith('/') ? p : '/' + p;
  return { path, parts: path.split('/').filter(Boolean), query: new URLSearchParams(q), key: h };
}

// À l'ouverture de l'application (nouveau lancement, pas un simple rechargement), on arrive toujours sur « À la une ».
try {
  const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
  if ((!nav || nav.type === 'navigate') && location.hash.replace(/^#/, '').split('?')[0] !== HOME) history.replaceState(null, '', '#' + HOME);
} catch { /* navigateur ancien */ }

let current = parse();
const listeners = new Set<() => void>();
const depth = () => ((history.state as { vg?: number } | null)?.vg ?? 0);
if (history.state?.vg === undefined) history.replaceState({ vg: 0 }, '');

function emit(scrollTop: boolean) {
  const prevPath = current.path;
  current = parse();
  listeners.forEach((l) => l());
  if (scrollTop && prevPath !== current.path) window.scrollTo(0, 0);
}
window.addEventListener('popstate', () => emit(true));
window.addEventListener('hashchange', () => { if (parse().key !== current.key) emit(true); });

export function useRoute(): Route {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => current);
}

export function navigate(to: string, opts: { replace?: boolean } = {}): void {
  if (opts.replace) history.replaceState({ vg: depth() }, '', '#' + to);
  else history.pushState({ vg: depth() + 1 }, '', '#' + to);
  emit(true);
}

/** Retour : historique interne s'il existe, sinon écran parent. */
export function back(fallback: string): void {
  if (depth() > 0) history.back();
  else navigate(fallback, { replace: true });
}

export function openSheet(name: string): void {
  const r = parse();
  r.query.set('sheet', name);
  history.pushState({ vg: depth() + 1 }, '', '#' + r.path + '?' + r.query.toString());
  emit(false);
}

export function closeSheet(): void {
  const r = parse();
  if (!r.query.get('sheet')) return;
  if (depth() > 0) { history.back(); return; }
  r.query.delete('sheet');
  const q = r.query.toString();
  history.replaceState({ vg: 0 }, '', '#' + r.path + (q ? '?' + q : ''));
  emit(false);
}

export type Tab = 'une' | 'secteurs' | 'favoris' | 'reglages' | 'none';
export function tabOf(path: string): Tab {
  const p = path.split('/')[1];
  if (p === 'une' || p === 'secteurs' || p === 'favoris' || p === 'reglages') return p;
  return 'none';
}

// Retour dans l'application après plus de 15 minutes en arrière-plan : comme une nouvelle ouverture, on revient à « À la une ».
let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt > 15 * 60 * 1000 && current.path !== HOME) {
    history.replaceState({ vg: 0 }, '', '#' + HOME);
    emit(true);
  }
  hiddenAt = 0;
});
