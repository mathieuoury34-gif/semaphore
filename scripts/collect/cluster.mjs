// Regroupement des articles qui parlent du même événement en « sujets » (stories).
// Similarité de Jaccard sur les mots significatifs des titres, fenêtre de 72 h. Déterministe et testable.
import { sha, tokens } from './text.mjs';
import { LANGS, pickLead } from './stories.mjs';
import { rankSectors } from './classify.mjs';

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
    for (const st of it.noCluster ? [] : stories) { // offres d'emploi : une offre = un sujet
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
        tx: { [it.lang]: { t: it.title, ...(it.snippet ? { n: it.snippet } : {}), u: it.url, x: it.sourceId } },
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
  applyVotes(st);
}

function applyVotes(st) {
  st.sectors = rankSectors(st.votes);
}

/**
 * Fusionne les sujets qui parlent du même événement dans deux langues. Le rapprochement se fait sur les titres TRADUITS par l'IA :
 * le titre français d'un sujet anglais est comparé aux titres des sujets français (et inversement), avec la même règle que pour une seule langue.
 * Le sujet « absorbé » disparaît ; ses articles rejoignent l'autre. @returns {{ stories: object[], merged: number }}
 */
export function mergeAcrossLanguages(stories, sources) {
  const dead = new Set();
  const native = (st, L) => st.items.some((i) => i.l === L);
  const cache = new Map();
  const tok = (st, L) => {
    const k = st.id + L;
    let t = cache.get(k);
    if (!t) { t = tokens(st.tx?.[L]?.t ?? ''); cache.set(k, t); }
    return t;
  };
  let merged = 0;
  for (const S of stories) {
    if (dead.has(S.id) || S.sectors[0] === 'emploi') continue;
    for (const L of LANGS) {
      if (!S.tx?.[L]?.tr || native(S, L)) continue; // titre traduit dans une langue où S n'a pas d'article
      const tt = tok(S, L);
      let target = null, best = 0;
      for (const T of stories) {
        if (T === S || dead.has(T.id) || T.sectors[0] === 'emploi' || !native(T, L)) continue;
        if (Math.abs(Date.parse(S.date) - Date.parse(T.date)) > WINDOW_MS) continue;
        const nt = tok(T, L);
        if (!sameStory(tt, nt)) continue;
        const sc = similarity(tt, nt).jaccard;
        if (sc > best) { best = sc; target = T; }
      }
      if (!target) continue;
      absorb(target, S, sources);
      dead.add(S.id); merged++;
      break;
    }
  }
  return { stories: stories.filter((s) => !dead.has(s.id)), merged };
}

function absorb(T, S, sources) {
  const have = new Set(T.items.map((i) => i.u));
  for (const it of S.items) if (!have.has(it.u)) T.items.push(it);
  T.votes ??= {};
  for (const [k, v] of Object.entries(S.votes ?? {})) T.votes[k] = Math.round(((T.votes[k] ?? 0) + v) * 10) / 10;
  applyVotes(T);
  T.rel = Math.max(T.rel ?? 0, S.rel ?? 0);
  if (S.date > T.date) T.date = S.date;
  if (S.first && (!T.first || S.first < T.first)) T.first = S.first;
  // les blocs de langue de S (résumés, titres) servent à T là où T n'en a pas
  for (const L of LANGS) if (S.tx?.[L] && !T.tx?.[L]) (T.tx ??= {})[L] = S.tx[L];
  refreshLead(T, sources);
}

/** Article « tête de sujet » : met à jour le titre et la langue d'origine du sujet. */
export function refreshLead(st, sources) {
  const lead = pickLead(st.items, sources);
  if (lead && lead.t !== st.title && !st.titleLocked) {
    st.title = lead.t;
    st.lang = lead.l;
  }
}
