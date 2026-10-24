// Sélection, tri et recherche de sujets : fonctions pures, testées.
// Règles d'affichage : un sujet n'apparaît que s'il existe dans la langue choisie (jamais de mélange français / anglais)
// et si au moins une de ses sources n'est pas masquée dans le secteur consulté.
import type { Bullet, Digest, Feed, Lang, Prefs, SourceInfo, Story, Tx } from './types';
import { matchesQuery, norm } from './text';

/** Ce qu'il faut savoir de l'utilisateur pour décider quoi afficher. */
export interface View { lang: Lang; off?: Record<string, string[]> }
export const viewOf = (p: Pick<Prefs, 'lang' | 'off'>): View => ({ lang: p.lang, off: p.off });

export const txOf = (st: Story, lang: Lang): Tx | undefined => st.tx?.[lang];
export const storyTitle = (st: Story, lang: Lang): string => txOf(st, lang)?.t ?? st.title;

/** Texte de lecture : le résumé s'il existe, sinon l'extrait du flux. */
export function storyText(st: Story, lang: Lang): string {
  const t = txOf(st, lang);
  return (t?.s || t?.n || '').trim();
}

/** Qui a écrit le texte affiché : « llm » (résumé IA), « extractive » (extraits), null (extrait du flux). */
export function textBy(st: Story, lang: Lang) {
  const t = txOf(st, lang);
  return t?.s ? t.by ?? 'extractive' : null;
}

const index = new Map<Lang, WeakMap<Story, string>>();
export function searchText(st: Story, lang: Lang): string {
  let m = index.get(lang);
  if (!m) index.set(lang, (m = new WeakMap()));
  let s = m.get(st);
  if (s === undefined) {
    const t = txOf(st, lang);
    s = norm([t?.t, t?.n, t?.s].filter(Boolean).join(' '));
    m.set(st, s);
  }
  return s;
}

export function followedSectors(all: string[], prefs: Pick<Prefs, 'followed'>): string[] {
  return prefs.followed ? all.filter((id) => prefs.followed!.includes(id)) : all;
}

export const inSector = (st: Story, id: string): boolean => st.sectors.includes(id);

export const isOff = (off: View['off'], sector: string, source: string): boolean => !!off?.[sector]?.includes(source);

/** Le sujet est lisible dans cette langue et au moins une de ses sources est active dans ce secteur. */
export function visibleIn(st: Story, sector: string, v: View): boolean {
  if (!st.tx?.[v.lang] || !inSector(st, sector)) return false;
  const off = v.off?.[sector];
  return !off?.length || st.items.some((i) => !off.includes(i.s));
}

/** Visible dans au moins un des secteurs donnés (par défaut : ceux du sujet). */
export function visibleAny(st: Story, v: View, sectors?: string[]): boolean {
  return (sectors ?? st.sectors).some((s) => visibleIn(st, s, v));
}

export type SortMode = 'top' | 'recent';
export function sortStories(list: Story[], sort: SortMode): Story[] {
  const out = [...list];
  if (sort === 'recent') out.sort((a, b) => b.date.localeCompare(a.date));
  else out.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date));
  return out;
}

export function sectorStories(feed: Feed, id: string, v: View, opts: { sort?: SortMode; unreadOnly?: boolean; read?: Record<string, string>; query?: string } = {}): Story[] {
  let list = feed.stories.filter((s) => visibleIn(s, id, v));
  if (opts.unreadOnly && opts.read) list = list.filter((s) => !opts.read![s.id]);
  if (opts.query) list = list.filter((s) => matchesQuery(searchText(s, v.lang), opts.query!));
  return sortStories(list, opts.sort ?? 'top');
}

export function searchAll(feed: Feed, query: string, sectors: string[], v: View, limit = 80): Story[] {
  return sortStories(feed.stories.filter((s) => visibleAny(s, v, sectors.filter((x) => inSector(s, x))) && matchesQuery(searchText(s, v.lang), query)), 'recent').slice(0, limit);
}

/** Sujets qui contiennent l'un des mots suivis. */
export function keywordMatches(feed: Feed, keywords: string[], v: View, limit = 60): Story[] {
  const ks = keywords.map((k) => ' ' + norm(k)).filter((k) => k.trim());
  if (!ks.length) return [];
  const out = feed.stories.filter((s) => {
    if (!visibleAny(s, v)) return false;
    const hay = ' ' + searchText(s, v.lang);
    return ks.some((k) => hay.includes(k));
  });
  return sortStories(out, 'recent').slice(0, limit);
}

/** Sujets récents non lus d'un secteur : la pastille de la page « Secteurs » (36 h ; 7 jours pour les offres d'emploi, qui se renouvellent lentement). */
export function newCount(feed: Feed, id: string, read: Record<string, string>, v: View, now = Date.now()): number {
  const since = now - (id === 'emploi' ? 7 * 24 : 36) * 3600000;
  let n = 0;
  for (const s of feed.stories) if (!read[s.id] && Date.parse(s.date) >= since && visibleIn(s, id, v)) n++;
  return n;
}

/** Article « tête de sujet » dans la langue choisie : celui du bloc de cette langue, sinon un article de cette langue, sinon le premier. */
export function leadItem(st: Story, lang: Lang) {
  const u = txOf(st, lang)?.u;
  return (u && st.items.find((i) => i.u === u)) || st.items.find((i) => i.l === lang) || st.items[0];
}

export function distinctSources(st: Story): string[] {
  return [...new Set(st.items.map((i) => i.s))];
}

export function sourceName(id: string, sources: Map<string, SourceInfo>): string {
  return sources.get(id)?.name ?? id;
}

/** Puces d'un digest dans la langue choisie : texte de cette langue, sujets lisibles et non masqués ; à défaut de texte, le titre du premier sujet. */
export function localBullets(list: (Bullet & { sector?: string })[], sector: string | undefined, v: View, byId: Map<string, Story>): { text: string; ids: string[]; sector?: string }[] {
  const out: { text: string; ids: string[]; sector?: string }[] = [];
  for (const b of list) {
    const sec = sector ?? b.sector;
    const ids = b.ids.filter((i) => { const st = byId.get(i); return !!st && (sec ? visibleIn(st, sec, v) : visibleAny(st, v)); });
    if (!ids.length) continue;
    const text = b.t[v.lang] || storyTitle(byId.get(ids[0])!, v.lang);
    out.push({ text, ids, sector: b.sector });
  }
  return out;
}

export const digestOf = (d: Digest | null, sector: string): Bullet[] => d?.sectors[sector]?.bullets ?? [];

// ------------------------------------------------------------------ sources par secteur
/** Sources du catalogue rattachées à un secteur, triées par nom. */
export function sourcesOfSector(sources: Map<string, SourceInfo>, sector: string): SourceInfo[] {
  return [...sources.values()].filter((s) => s.sectors.includes(sector)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/** Répartition des sensibilités parmi les sources actives d'un secteur. */
export function leanSpread(list: SourceInfo[]): { left: number; center: number; right: number; unknown: number } {
  const o = { left: 0, center: 0, right: 0, unknown: 0 };
  for (const s of list) {
    if (s.lean === 'left' || s.lean === 'center-left') o.left++;
    else if (s.lean === 'right' || s.lean === 'center-right') o.right++;
    else if (s.lean === 'center') o.center++;
    else o.unknown++;
  }
  return o;
}

/** Sensibilités des sources d'un sujet (pour afficher la diversité de la couverture). */
export function storySpread(st: Story, sources: Map<string, SourceInfo>) {
  return leanSpread(distinctSources(st).map((id) => sources.get(id)).filter((s): s is SourceInfo => !!s));
}
