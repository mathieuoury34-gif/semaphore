// Regroupement des articles qui parlent du même événement en « sujets » (stories).
// Similarité de Jaccard sur les mots significatifs des titres, fenêtre de 72 h. Déterministe et testable.
import { sha, tokens } from './text.mjs';

const WINDOW_MS = 72 * 3600 * 1000;

export function similarity(a, b) {
  if (!a.size || !b.size) return { inter: 0, jaccard: 0, overlap: 0 };
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return { inter, jaccard: inter / union, overlap: inter / Math.min(a.size, b.size) };
}

/** Deux titres décrivent-ils le même sujet ? */
export function sameStory(a, b) {
  const { inter, jaccard, overlap } = similarity(a, b);
  if (inter >= 4 && jaccard >= 0.3) return true;
  if (inter >= 3 && jaccard >= 0.4 && overlap >= 0.6) return true;
  if (inter >= 2 && Math.max(a.size, b.size) <= 4 && jaccard >= 0.6) return true;
  return false;
}

export function storyId(url) {
  return 's' + sha(url, 9);
}

/**
 * Rattache de nouveaux éléments à des sujets existants ou en crée.
 * @param {object[]} stories sujets existants (modifiés sur place)
 * @param {object[]} items éléments neufs { url, title, date, snippet, sourceId, lang, sectors }
 * @param {Map<string, object>} sources
 * @returns {object[]} sujets créés ou modifiés
 */
export function attach(stories, items, sources) {
  const touched = new Set();
  const tok = new Map(); // story.id → jeux de jetons de ses titres
  const tokensOf = (st) => {
    let t = tok.get(st.id);
    if (!t) { t = st.items.map((i) => tokens(i.t)); tok.set(st.id, t); }
    return t;
  };
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date));
  for (const it of sorted) {
    const tt = tokens(it.title);
    if ([...tt].filter((w) => !/^\d+$/.test(w)).length < 2) continue; // titres vides de sens (« Émission du 23 octobre »)
    const when = Date.parse(it.date);
    let best = null, bestScore = 0;
    for (const st of stories) {
      if (Math.abs(when - Date.parse(st.date)) > WINDOW_MS) continue;
      // un même média ne publie pas deux fois le même sujet sous des titres différents : on tolère, mais on évite de fusionner
      // deux articles d'une même source si la similarité n'est pas très forte
      const sets = tokensOf(st);
      for (let k = 0; k < sets.length; k++) {
        if (!sameStory(tt, sets[k])) continue;
        const sc = similarity(tt, sets[k]).jaccard + (st.items[k].s === it.sourceId ? -0.15 : 0);
        if (sc > bestScore) { best = st; bestScore = sc; }
      }
    }
    const row = { u: it.url, t: it.title, s: it.sourceId, d: it.date, l: it.lang };
    if (best && !best.items.some((x) => x.u === it.url)) {
      best.items.push(row);
      tokensOf(best).push(tt);
      vote(best, it.sectors);
      best.rel = Math.max(best.rel ?? 0, it.rel ?? 0);
      if (it.date > best.date) best.date = it.date;
      touched.add(best);
      refreshLead(best, sources);
    } else if (!best) {
      const st = {
        id: storyId(it.url),
        title: it.title,
        sectors: [...it.sectors],
        votes: {},
        rel: it.rel ?? 0,
        date: it.date,
        first: it.date,
        lang: it.lang,
        snippet: it.snippet,
        summary: null,
        summaryBy: null,
        items: [row],
      };
      vote(st, it.sectors);
      stories.push(st);
      tok.set(st.id, [tt]);
      touched.add(st);
    }
  }
  return [...touched];
}

/** Secteurs d'un sujet par vote des articles : le premier secteur d'un article compte 1, les suivants 0,6. */
export function vote(st, sectors) {
  st.votes ??= Object.fromEntries(st.sectors.map((s, i) => [s, i === 0 ? 1 : 0.6]));
  sectors.forEach((sec, i) => { st.votes[sec] = Math.round(((st.votes[sec] ?? 0) + (i === 0 ? 1 : 0.6)) * 10) / 10; });
  const ranked = Object.entries(st.votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked[0]?.[1] ?? 0;
  st.sectors = ranked.filter(([, v], i) => i === 0 || v >= top * 0.45).slice(0, 3).map(([k]) => k);
}

/** Article « tête de sujet » : meilleure source (poids puis institution), à défaut le plus récent. */
export function refreshLead(st, sources) {
  const w = (i) => (sources.get(i.s)?.weight ?? 1) + (sources.get(i.s)?.kind === 'institution' ? 0.5 : 0);
  const lead = [...st.items].sort((a, b) => w(b) - w(a) || b.d.localeCompare(a.d))[0];
  if (lead && lead.t !== st.title && !st.titleLocked) {
    st.title = lead.t;
    st.lang = lead.l;
  }
}
