// État personnel persisté localement (localStorage) + synchronisation cloud facultative (voir sync.ts).
import { useSyncExternalStore } from 'react';
import type { Fav, Lang, Story, UserState } from '../domain/types';
import { emptyState, favFromStory, pruneRead, sanitize, withFav, withoutFav } from '../domain/state';

const KEY = 'vigie:state';
type Listener = () => void;

function load(): UserState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = sanitize(JSON.parse(raw));
      s.read = pruneRead(s.read);
      return s;
    }
  } catch { /* stockage indisponible : on repart de zéro */ }
  return emptyState();
}

let state: UserState = load();
const listeners = new Set<Listener>();
const hooks = new Set<(s: UserState, origin: 'local' | 'remote') => void>();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* quota ou navigation privée */ }
}
function emit(origin: 'local' | 'remote') {
  persist();
  listeners.forEach((l) => l());
  hooks.forEach((h) => h(state, origin));
}

export const getState = (): UserState => state;
export const subscribe = (l: Listener): (() => void) => { listeners.add(l); return () => listeners.delete(l); };
export const onStateChange = (fn: (s: UserState, origin: 'local' | 'remote') => void): (() => void) => { hooks.add(fn); return () => hooks.delete(fn); };
export const useUserState = (): UserState => useSyncExternalStore(subscribe, getState, getState);

export function update(fn: (s: UserState) => UserState): void {
  const next = fn(state);
  if (next === state) return;
  state = { ...next, updatedAt: new Date().toISOString() };
  emit('local');
}

/** Remplace l'état (fusion venue du cloud) sans le renvoyer au cloud. */
export function replaceState(next: UserState, origin: 'local' | 'remote' = 'remote'): void {
  state = next;
  emit(origin);
}

// ------------------------------------------------------------ actions
export function markRead(id: string): void {
  if (state.read[id]) return;
  update((s) => ({ ...s, read: { ...s.read, [id]: new Date().toISOString() } }));
}
export function markUnread(id: string): void {
  if (!state.read[id]) return;
  update((s) => { const read = { ...s.read }; delete read[id]; return { ...s, read }; });
}
export function markAllRead(ids: string[]): void {
  const now = new Date().toISOString();
  update((s) => ({ ...s, read: { ...s.read, ...Object.fromEntries(ids.filter((i) => !s.read[i]).map((i) => [i, now])) } }));
}
export function resetRead(): void {
  update((s) => ({ ...s, read: {} }));
}
export function toggleFavorite(st: Story, sourceName: (id: string) => string, lang: Lang = state.prefs.lang): boolean {
  const now = new Date().toISOString();
  const f = state.favorites[st.id];
  const on = !!f && (!f.removedAt || f.savedAt > f.removedAt);
  update((s) => (on ? withoutFav(s, st.id, now) : withFav(s, favFromStory(st, sourceName, now, lang))));
  return !on;
}
export function removeFavorite(id: string): void {
  update((s) => withoutFav(s, id, new Date().toISOString()));
}
export function restoreFavorite(f: Fav): void {
  update((s) => withFav(s, { ...f, savedAt: new Date().toISOString(), removedAt: undefined }));
}
export function setFollowed(followed: string[] | null): void {
  update((s) => ({ ...s, prefs: { ...s.prefs, followed, at: new Date().toISOString() } }));
}
export function setKeywords(keywords: string[]): void {
  update((s) => ({ ...s, prefs: { ...s.prefs, keywords, at: new Date().toISOString() } }));
}
export function setLang(lang: Lang): void {
  if (state.prefs.lang === lang) return;
  update((s) => ({ ...s, prefs: { ...s.prefs, lang, at: new Date().toISOString() } }));
}
/** Masque (off = true) ou réaffiche un journal dans un secteur précis. */
export function setSourceOff(sector: string, source: string, off: boolean): void {
  setSectorOff(sector, off ? [...new Set([...(state.prefs.off[sector] ?? []), source])] : (state.prefs.off[sector] ?? []).filter((x) => x !== source));
}
/** Remplace la liste des journaux masqués d'un secteur (liste vide : tous visibles). */
export function setSectorOff(sector: string, ids: string[]): void {
  update((s) => {
    const off = { ...s.prefs.off };
    if (ids.length) off[sector] = ids; else delete off[sector];
    return { ...s, prefs: { ...s.prefs, off, at: new Date().toISOString() } };
  });
}

// ------------------------------------------------------------ préférences propres à l'appareil (non synchronisées)
const PREF_KEY = 'vigie:device';
export interface DevicePrefs { syncedUid?: string }
export function getDevicePrefs(): DevicePrefs {
  try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}'); } catch { return {}; }
}
export function setDevicePrefs(p: Partial<DevicePrefs>): void {
  try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...getDevicePrefs(), ...p })); } catch { /* ignore */ }
}
