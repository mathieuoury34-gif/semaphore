// Sélection, tri et recherche de sujets : fonctions pures, testées.
import type { Feed, Prefs, Story, SourceInfo } from './types';
import { matchesQuery, norm } from './text';

export const storyTitle = (st: Story): string => st.titleFr || st.title;

/** Texte de lecture d'un sujet : résumé s'il existe et apporte quelque chose, sinon l'extrait du flux. */
export function storyText(st: Story): string {
  return (st.summary || st.snippet || '').trim();
}

/** Langue du texte affiché (le résumé d'un sujet anglais reste en anglais sans modèle de langage). */
export function textLang(st: Story): string {
  if (st.summary) return st.summaryLang || st.lang;
  return st.lang;
}

const index = new WeakMap<Story, string>();
export function searchText(st: Story): string {
  let s = index.get(st);
  if (s === undefined) {
    s = norm([st.title, st.titleFr, st.snippet, st.summary].filter(Boolean).join(' '));
    index.set(st, s);
  }
  return s;
}

export function followedSectors(all: string[], prefs: Prefs): string[] {
  return prefs.followed ? all.filter((id) => prefs.followed!.includes(id)) : all;
}

export function inSector(st: Story, id: string): boolean {
  return st.sectors.includes(id);
}

export type SortMode = 'top' | 'recent';

export function sectorStories(feed: Feed, id: string, opts: { sort?: SortMode; unreadOnly?: boolean; read?: Record<string, string>; query?: string } = {}): Story[] {
  let list = feed.stories.filter((s) => inSector(s, id));
  if (opts.unreadOnly && opts.read) list = list.filter((s) => !opts.read![s.id]);
  if (opts.query) list = list.filter((s) => matchesQuery(searchText(s), opts.query!));
  return sortStories(list, opts.sort ?? 'top');
}

export function sortStories(list: Story[], sort: SortMode): Story[] {
  const out = [...list];
  if (sort === 'recent') out.sort((a, b) => b.date.localeCompare(a.date));
  else out.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
  return out;
}

export function searchAll(feed: Feed, query: string, sectors: string[], limit = 80): Story[] {
  const allowed = new Set(sectors);
  return sortStories(feed.stories.filter((s) => s.sectors.some((x) => allowed.has(x)) && matchesQuery(searchText(s), query)), 'recent').slice(0, limit);
}

/** Sujets qui contiennent l'un des mots suivis. */
export function keywordMatches(feed: Feed, keywords: string[], limit = 60): Story[] {
  const ks = keywords.map((k) => norm(k)).filter(Boolean);
  if (!ks.length) return [];
  const re = ks.map((k) => ' ' + k);
  const out = feed.stories.filter((s) => {
    const hay = ' ' + searchText(s);
    return re.some((k) => hay.includes(k));
  });
  return sortStories(out, 'recent').slice(0, limit);
}

/** Sujets des dernières 36 h non lus d'un secteur : la pastille de la page « Secteurs ». */
export function newCount(feed: Feed, id: string, read: Record<string, string>, now = Date.now()): number {
  const since = now - 36 * 3600000;
  let n = 0;
  for (const s of feed.stories) if (inSector(s, id) && !read[s.id] && Date.parse(s.date) >= since) n++;
  return n;
}

/** Article « tête de sujet » : celui dont le titre est celui du sujet, sinon le premier. */
export function leadItem(st: Story) {
  return st.items.find((i) => i.t === st.title) ?? st.items[0];
}

export function distinctSources(st: Story): string[] {
  return [...new Set(st.items.map((i) => i.s))];
}

export function sourceName(id: string, sources: Map<string, SourceInfo>): string {
  return sources.get(id)?.name ?? id;
}
