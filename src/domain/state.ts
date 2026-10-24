// État personnel (favoris, lus, préférences) et fusion entre appareils : les ajouts de chaque appareil s'additionnent,
// aucune donnée n'est perdue quand on utilise le téléphone et l'ordinateur en même temps.
import type { Fav, FavTx, Lang, Prefs, Story, UserState } from './types';
import { LANGS } from './types';
import { leadItem, storyText, storyTitle } from './select';
import { clip } from './text';

const READ_KEEP_MS = 14 * 86400000;
const TOMB_KEEP_MS = 90 * 86400000;

export function emptyState(): UserState {
  return { v: 1, favorites: {}, read: {}, prefs: { followed: null, keywords: [], lang: 'fr', off: {}, at: '' }, updatedAt: '' };
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

function sanitizeOff(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [sec, list] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const ids = [...new Set(list.filter((x): x is string => typeof x === 'string'))].slice(0, 400);
    if (ids.length) out[sec] = ids;
  }
  return out;
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
      lang: r.prefs.lang === 'en' ? 'en' : 'fr',
      off: sanitizeOff(r.prefs.off),
      at: typeof r.prefs.at === 'string' ? r.prefs.at : '',
    };
  }
  e.updatedAt = typeof r.updatedAt === 'string' ? r.updatedAt : '';
  return e;
}

export function favFromStory(st: Story, sourceNames: (id: string) => string, now: string, lang: Lang = 'fr'): Fav {
  const tx: Partial<Record<Lang, FavTx>> = {};
  for (const L of LANGS) {
    if (!st.tx?.[L]) continue;
    const lead = leadItem(st, L);
    tx[L] = { title: storyTitle(st, L), summary: clip(storyText(st, L), 420), url: lead?.u ?? '', source: lead ? sourceNames(lead.s) : '' };
  }
  const main = tx[lang] ?? tx[st.lang === 'en' ? 'en' : 'fr'] ?? Object.values(tx)[0] ?? { title: st.title, summary: '', url: '', source: '' };
  return {
    id: st.id,
    title: main.title,
    summary: main.summary,
    sector: st.sectors[0] ?? '',
    date: st.date,
    url: main.url,
    source: main.source,
    lang: tx[lang] ? lang : st.lang,
    tx,
    savedAt: now,
  };
}

/** Copie d'un favori dans la langue choisie ; à défaut, sa langue d'origine (signalée par `other`). */
export function favIn(f: Fav, lang: Lang): { title: string; summary: string; url: string; source: string; other: boolean } {
  const t = f.tx?.[lang];
  if (t) return { ...t, other: false };
  return { title: f.title, summary: f.summary, url: f.url, source: f.source, other: !!f.lang && f.lang !== lang };
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
