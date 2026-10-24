// État personnel (favoris, lus, préférences) et fusion entre appareils : les ajouts de chaque appareil s'additionnent,
// aucune donnée n'est perdue quand on utilise le téléphone et l'ordinateur en même temps.
import type { Fav, Prefs, Story, UserState } from './types';
import { storyTitle, storyText, leadItem } from './select';
import { clip } from './text';

const READ_KEEP_MS = 14 * 86400000;
const TOMB_KEEP_MS = 90 * 86400000;

export function emptyState(): UserState {
  return { v: 1, favorites: {}, read: {}, prefs: { followed: null, keywords: [], at: '' }, updatedAt: '' };
}

/** Stringify avec clés triées : deux états identiques donnent le même texte. */
export function stable(v: unknown): string {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) : x));
}

export const isFav = (f: Fav | undefined): boolean => !!f && (!f.removedAt || f.savedAt > f.removedAt);
const stamp = (f: Fav) => (f.removedAt && f.removedAt > f.savedAt ? f.removedAt : f.savedAt);

export function activeFavorites(s: UserState): Fav[] {
  return Object.values(s.favorites).filter((f) => isFav(f)).sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function mergeState(a: UserState, b: UserState, now = Date.now()): UserState {
  const favorites: Record<string, Fav> = {};
  for (const id of new Set([...Object.keys(a.favorites), ...Object.keys(b.favorites)])) {
    const x = a.favorites[id], y = b.favorites[id];
    const pick = !x ? y : !y ? x : stamp(x) >= stamp(y) ? x : y;
    if (!isFav(pick) && now - Date.parse(pick.removedAt ?? pick.savedAt) > TOMB_KEEP_MS) continue; // vieille pierre tombale
    favorites[id] = pick;
  }
  const read: Record<string, string> = {};
  for (const src of [a.read, b.read]) {
    for (const [id, at] of Object.entries(src)) {
      if (now - Date.parse(at) > READ_KEEP_MS) continue;
      if (!read[id] || at > read[id]) read[id] = at;
    }
  }
  const prefs: Prefs = a.prefs.at >= b.prefs.at ? a.prefs : b.prefs;
  return { v: 1, favorites, read, prefs: structuredClone(prefs), updatedAt: a.updatedAt >= b.updatedAt ? a.updatedAt : b.updatedAt };
}

/** Nettoie un état lu depuis le stockage ou le cloud. */
export function sanitize(raw: unknown): UserState {
  const e = emptyState();
  if (!raw || typeof raw !== 'object') return e;
  const r = raw as Partial<UserState>;
  if (r.favorites && typeof r.favorites === 'object') {
    for (const [id, f] of Object.entries(r.favorites)) if (f && typeof f.title === 'string' && typeof f.savedAt === 'string') e.favorites[id] = f;
  }
  if (r.read && typeof r.read === 'object') for (const [id, at] of Object.entries(r.read)) if (typeof at === 'string') e.read[id] = at;
  if (r.prefs && typeof r.prefs === 'object') {
    e.prefs = {
      followed: Array.isArray(r.prefs.followed) ? r.prefs.followed.filter((x) => typeof x === 'string') : null,
      keywords: Array.isArray(r.prefs.keywords) ? r.prefs.keywords.filter((x) => typeof x === 'string').slice(0, 30) : [],
      at: typeof r.prefs.at === 'string' ? r.prefs.at : '',
    };
  }
  e.updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : '';
  return e;
}

export function favFromStory(st: Story, sourceNames: (id: string) => string, now: string): Fav {
  const lead = leadItem(st);
  return {
    id: st.id,
    title: storyTitle(st),
    summary: clip(storyText(st), 420),
    sector: st.sectors[0] ?? '',
    date: st.date,
    url: lead?.u ?? '',
    source: lead ? sourceNames(lead.s) : '',
    lang: st.lang,
    savedAt: now,
  };
}

export function withFav(s: UserState, fav: Fav): UserState {
  return { ...s, favorites: { ...s.favorites, [fav.id]: fav } };
}

export function withoutFav(s: UserState, id: string, now: string): UserState {
  const f = s.favorites[id];
  if (!f) return s;
  return { ...s, favorites: { ...s.favorites, [id]: { ...f, removedAt: now > f.savedAt ? now : f.savedAt } } };
}

export function pruneRead(read: Record<string, string>, now = Date.now()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, at] of Object.entries(read)) if (now - Date.parse(at) <= READ_KEEP_MS) out[id] = at;
  return out;
}
