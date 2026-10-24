// Contenu d'un sujet par langue. Un sujet garde, pour chaque langue (fr, en), un bloc « tx » :
//   t = titre, n = extrait du flux, s = résumé, by = 'llm' | 'extractive', tr = 1 si le titre est traduit par l'IA,
//   u / x = adresse et source de l'article de tête dans cette langue.
// Un bloc « natif » vient d'un article réellement publié dans cette langue ; un bloc sans article natif n'existe que grâce à l'IA.
import { clip } from './text.mjs';

export const LANGS = ['fr', 'en'];

const weight = (sources, i) => (sources.get(i.s)?.weight ?? 1) + (sources.get(i.s)?.kind === 'institution' ? 0.5 : 0);

/** Article de tête : meilleure source (poids puis institution), à défaut le plus récent. */
export function pickLead(items, sources) {
  return [...items].sort((a, b) => weight(sources, b) - weight(sources, a) || b.d.localeCompare(a.d))[0];
}

/** Met à jour les blocs natifs (titre, extrait, article de tête) d'après les articles du sujet. */
export function refreshTx(st, sources, raw = new Map()) {
  st.tx ??= {};
  const lead = pickLead(st.items, sources);
  for (const L of LANGS) {
    const its = st.items.filter((i) => i.l === L);
    if (!its.length) continue;
    const l = pickLead(its, sources);
    const cur = (st.tx[L] ??= {});
    cur.t = l.t; cur.u = l.u; cur.x = l.s;
    delete cur.tr;
    const r = raw.get(l.u);
    if (r?.snippet) cur.n = clip(r.snippet, 260);
  }
  // langue sans article natif : le bloc (traduit) renvoie vers l'article de tête
  for (const L of LANGS) if (st.tx[L] && !st.items.some((i) => i.l === L)) { st.tx[L].u = lead.u; st.tx[L].x = lead.s; }
  return st;
}

export const hasSummary = (st) => LANGS.some((L) => st.tx?.[L]?.s);
export const hasNative = (st, L) => st.items.some((i) => i.l === L);

/** Bloc de lecture d'un sujet quel que soit la langue (le sien d'abord) : pour nourrir l'IA. */
export function anyTx(st) {
  const first = st.lang && st.tx[st.lang] ? st.tx[st.lang] : null;
  return first ?? st.tx.fr ?? st.tx.en ?? null;
}
export function anySummaryTx(st) {
  const order = [st.lang, ...LANGS];
  for (const L of order) if (st.tx?.[L]?.s) return st.tx[L];
  return anyTx(st);
}

/** Ancien format (v1 : titre / titleFr / résumé uniques) → blocs par langue. */
export function migrateStory(st) {
  if (st.tx) return st;
  const lead = st.items.find((i) => i.t === st.title) ?? st.items[0];
  const L = st.lang || lead?.l || 'fr';
  const base = { u: lead?.u, x: lead?.s };
  const tx = { [L]: { t: st.title, ...(st.snippet ? { n: st.snippet } : {}), ...base } };
  if (st.titleFr && L !== 'fr') tx.fr = { t: st.titleFr, tr: 1, ...base };
  if (st.summary) {
    const sl = st.summaryLang === 'fr' ? 'fr' : st.summaryLang === 'en' ? 'en' : L;
    tx[sl] ??= { t: sl === 'fr' ? st.titleFr || st.title : st.title, ...base };
    tx[sl].s = st.summary;
    tx[sl].by = st.summaryBy === 'llm' ? 'llm' : 'extractive';
  }
  const { titleFr, snippet, summary, summaryBy, summaryLang, ...rest } = st;
  return { ...rest, lang: L, ...(st.summaryBy === 'none' && !st.summary ? { noSummary: true } : {}), tx };
}

/** Forme publiée d'un sujet (sans les champs internes). */
export function publicStory(st) {
  return {
    id: st.id, title: st.title, lang: st.lang, sectors: st.sectors, date: st.date, first: st.first,
    score: st.score, votes: st.votes, rel: st.rel ?? 0,
    ...(st.noSummary ? { noSummary: true } : {}),
    tx: st.tx,
    items: st.items.slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 12),
  };
}

/** Garde les meilleurs sujets de chaque secteur (un secteur très prolifique n'étouffe pas les autres ; les offres d'emploi ont un quota plus large). */
export function capPerSector(list, max) {
  const groups = new Map();
  for (const st of list) {
    const k = st.sectors[0] ?? '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(st);
  }
  const keep = [];
  for (const [k, g] of groups) {
    const cap = k === 'emploi' ? Math.round(max * 1.6) : max;
    keep.push(...g.sort((a, b) => b.score - a.score || b.date.localeCompare(a.date)).slice(0, cap));
  }
  return keep;
}
