// Lecture tolérante des fichiers publiés : l'ancien format (v1 : un titre, un résumé) est converti en blocs par langue.
import type { Bullet, Digest, Feed, Lang, Story, Tx } from './types';
import { LANGS } from './types';

type Raw = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function migrateStory(st: Raw): Story {
  if (st.tx && typeof st.tx === 'object') return st as Story;
  const items = Array.isArray(st.items) ? st.items : [];
  const lead = items.find((i: Raw) => i.t === st.title) ?? items[0];
  const L: Lang = st.lang === 'en' ? 'en' : 'fr';
  const base = { u: lead?.u, x: lead?.s };
  const tx: Partial<Record<Lang, Tx>> = { [L]: { t: st.title, ...(st.snippet ? { n: st.snippet } : {}), ...base } };
  if (st.titleFr && L !== 'fr') tx.fr = { t: st.titleFr, tr: 1, ...base };
  if (st.summary) {
    const sl: Lang = st.summaryLang === 'en' ? 'en' : st.summaryLang === 'fr' ? 'fr' : L;
    const cur: Tx = (tx[sl] ??= { t: sl === 'fr' ? st.titleFr || st.title : st.title, ...base });
    cur.s = st.summary;
    cur.by = st.summaryBy === 'llm' ? 'llm' : 'extractive';
  }
  const { titleFr: _a, snippet: _b, summary: _c, summaryBy: _d, summaryLang: _e, ...rest } = st;
  return { ...rest, lang: L, tx, items } as Story;
}

export function normalizeFeed(raw: Raw): Feed {
  const stories = (Array.isArray(raw?.stories) ? raw.stories : []).filter((s: Raw) => s && typeof s.id === 'string' && Array.isArray(s.items)).map(migrateStory);
  return { v: 2, generatedAt: String(raw?.generatedAt ?? ''), stories };
}

function bullets(list: unknown): Bullet[] {
  if (!Array.isArray(list)) return [];
  return list.flatMap((b: Raw) => {
    if (!b || !Array.isArray(b.ids)) return [];
    const t: Partial<Record<Lang, string>> = {};
    if (b.t && typeof b.t === 'object') { for (const L of LANGS) if (typeof b.t[L] === 'string' && b.t[L]) t[L] = b.t[L]; }
    else if (typeof b.text === 'string' && b.text) t.fr = b.text; // v1
    return [{ ...b, t, ids: b.ids }];
  });
}

export function normalizeDigest(raw: Raw | null): Digest | null {
  if (!raw || typeof raw !== 'object') return null;
  const sectors: Digest['sectors'] = {};
  for (const [id, row] of Object.entries((raw.sectors ?? {}) as Record<string, Raw>)) sectors[id] = { by: String(row?.by ?? ''), bullets: bullets(row?.bullets) };
  return { v: 2, generatedAt: String(raw.generatedAt ?? ''), by: String(raw.by ?? ''), briefBy: raw.briefBy, brief: bullets(raw.brief) as Digest['brief'], sectors };
}
