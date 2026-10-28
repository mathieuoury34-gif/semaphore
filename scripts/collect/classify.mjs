// Classement par secteur : secteurs par défaut de la source + règles de mots-clés (data-src/rules.json).
import { norm } from './text.mjs';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Compile une liste de termes en matchers {test(textNorm, textRaw)→bool, term}. */
function compile(terms) {
  return terms.map((t) => {
    if (t.startsWith('re:')) {
      const re = new RegExp(t.slice(3), 'u');
      return { term: t, test: (n) => re.test(n) };
    }
    if (t.startsWith('cs:')) {
      const w = t.slice(3);
      const re = new RegExp(`(?<![\\p{L}\\p{N}])${esc(w)}(?![\\p{L}\\p{N}])`, 'u');
      return { term: t, test: (_n, raw) => re.test(raw) };
    }
    const re = new RegExp(`(?:^| )${esc(norm(t))}(?: |$)`);
    return { term: t, test: (n) => re.test(n) };
  });
}

/** Secteurs d'actualité générale qui cèdent la place au Sport quand un sujet est sportif. */
export const SPORT_OVER = ['politique', 'international', 'economie', 'climat'];
/** Adresse d'un article rangé par son journal dans sa rubrique sport. */
const SPORT_URL = /\/(sports?|football|foot|rugby|tennis|cricket|formule-1|formula-?1|cyclisme|basket|handball)(\/|-|$)/i;
export const isSportUrl = (url = '') => { try { return SPORT_URL.test(new URL(url).pathname); } catch { return false; } };

/** Clé (symbole, donc ignorée par Object.entries) sous laquelle sont rangés les réglages « refine » compilés. */
export const REFINE = Symbol('refine');

export function compileRules(rules) {
  const out = {};
  const rf = rules.refine || {};
  out[REFINE] = { foreign: compile(rf.foreign || []), french: compile(rf.french || []), version: rf.version || 1 };
  for (const [id, r] of Object.entries(rules.sectors || {})) {
    out[id] = { strong: compile(r.strong || []), any: compile(r.any || []), exclude: compile(r.exclude || []) };
  }
  return out;
}

/**
 * Secteurs déclenchés par les mots-clés pour un texte donné.
 * @returns {{ sector: string, score: number }[]} triés par score décroissant
 */
export function matchSectors(compiled, title, snippet = '') {
  const tN = norm(title), tR = title;
  const bodyR = snippet.slice(0, 600);
  const bN = norm(bodyR);
  const res = [];
  for (const [id, r] of Object.entries(compiled)) {
    if (r.exclude.some((m) => m.test(tN, tR) || m.test(bN, bodyR))) continue; // « exclude » : hors sujet pour ce secteur, même si un mot-clé correspond
    let score = 0;
    for (const m of r.strong) {
      if (m.test(tN, tR)) score += 3;
      else if (m.test(bN, bodyR)) score += 1;
    }
    const anyTitle = r.any.filter((m) => m.test(tN, tR)).length;
    const anyBody = r.any.filter((m) => m.test(bN, bodyR)).length;
    score += anyTitle * 1.5 + (anyBody >= 2 ? 1 : 0);
    // seuils : un terme fort dans le titre, ou assez d'indices dans le titre et le résumé
    const strongTitle = r.strong.some((m) => m.test(tN, tR));
    if (strongTitle || score >= 3) res.push({ sector: id, score });
  }
  return res.sort((a, b) => b.score - a.score);
}

/** Un terme « fort » du secteur figure-t-il dans le titre ? */
export function strongInTitle(compiled, sector, title) {
  const r = compiled[sector];
  if (!r) return false;
  const tN = norm(title);
  return r.strong.some((m) => m.test(tN, title));
}

/**
 * Dernier tri des secteurs d'un élément (règles « refine » de rules.json) :
 *  1. un titre nettement sportif range le sujet en Sport, qui prend la place de la politique, de l'international, etc. ;
 *  2. un sujet de politique dont le titre parle d'un pays ou d'un dirigeant étranger, sans aucun repère français, relève de l'International.
 */
export function refineSectors(sectors, title, snippet, compiled, url = '') {
  const rf = compiled[REFINE];
  if (!rf || !sectors.length) return sectors;
  let out = [...sectors];
  const sporty = isSportUrl(url) || strongInTitle(compiled, 'sport', title);
  if (sporty && !out.includes('sport')) out.push('sport'); // rubrique sport d'un journal généraliste
  if (out.includes('sport') && sporty) {
    out = ['sport', ...out.filter((x) => x !== 'sport' && !SPORT_OVER.includes(x))];
  }
  if (out.includes('politique')) {
    const tN = norm(title), bN = norm(snippet.slice(0, 300));
    const foreign = rf.foreign.some((m) => m.test(tN, title));
    const french = rf.french.some((m) => m.test(tN, title)) || (foreign && rf.french.some((m) => m.test(bN, snippet)));
    if (french && !foreign && strongInTitle(compiled, 'politique', title)) out = ['politique', ...out.filter((x) => x !== 'politique')]; // politique française relayée par un média étranger ou européen
    if (foreign && !french) {
      out = out.filter((x) => x !== 'politique');
      if (!out.includes('international')) out.unshift('international');
      else out = ['international', ...out.filter((x) => x !== 'international')];
    }
  }
  return out.slice(0, 3);
}

/** Le texte est-il explicitement hors sujet pour ce secteur ? (liste « exclude » de rules.json) */
export function isExcluded(compiled, sector, title, snippet = '') {
  const r = compiled[sector];
  if (!r?.exclude.length) return false;
  const body = snippet.slice(0, 600);
  return r.exclude.some((m) => m.test(norm(title), title) || m.test(norm(body), body));
}

/**
 * Secteurs d'un élément et pertinence (0 à 1) pour son secteur principal.
 *  - mode « fixed » (défaut) : secteurs de la source, plus un secteur secondaire si le titre le justifie (3 au plus) ;
 *  - mode « keywords » : secteurs déclenchés par les mots-clés, repli sur le premier secteur de la source ;
 *    avec « onlyMatched », l'élément est écarté s'il ne relève d'aucun secteur de la source.
 * @returns {{ sectors: string[], rel: number }}
 */
export function sectorsFor(item, source, compiled) {
  const base = source.sectors || [];
  const matches = matchSectors(compiled, item.title, item.snippet);
  // secteur imposé par la source (offres d'emploi, presse sportive) : aucun secteur ajouté par les mots-clés
  if (source.exclusive ?? !!(source.type || source.jobs)) {
    const sc = matches.find((m) => m.sector === base[0])?.score ?? 0;
    return { sectors: base.slice(0, 3), rel: source.type || source.jobs ? 0.5 : Math.round(Math.min(1, sc / 6) * 100) / 100 };
  }
  const score = (sec) => matches.find((m) => m.sector === sec)?.score ?? 0;
  let sectors;
  if ((source.mode || 'fixed') === 'keywords') {
    sectors = matches.map((m) => m.sector);
    if (source.onlyMatched) {
      if (!sectors.some((s) => base.includes(s))) return { sectors: [], rel: 0 };
      sectors = [...sectors.filter((s) => base.includes(s)), ...sectors.filter((s) => !base.includes(s))];
    } else if (!sectors.length) sectors = base.slice(0, 1);
    sectors = sectors.slice(0, 3);
  } else {
    sectors = [...base];
    for (const m of matches) {
      if (sectors.length >= 3) break;
      if (!sectors.includes(m.sector) && m.score >= 3) sectors.push(m.sector);
    }
    sectors = sectors.slice(0, 3);
  }
  sectors = refineSectors(sectors, item.title, item.snippet || '', compiled, item.url);
  const rel = sectors.length ? Math.min(1, score(sectors[0]) / 6) : 0;
  return { sectors, rel: Math.round(rel * 100) / 100 };
}

/**
 * Reclasse un sujet déjà publié d'après les articles issus de sources à secteurs fixes et les règles actuelles (appelé une fois par
 * version des règles, voir « refine.version » de rules.json). Les articles de sources « par mots-clés » ne sont pas rejugés sur leur
 * seul titre (le résumé du flux, perdu, comptait) : sans article à secteurs fixes, on garde les secteurs d'origine, passés par les
 * mêmes règles de tri (secteurs disparus écartés, sport, politique étrangère).
 */
export function reclassifyStory(st, sourceMap, compiled, validSectors) {
  if (st.sectors[0] === 'emploi') return;
  const votes = {};
  let lead = '';
  for (const it of st.items || []) {
    const src = sourceMap.get(it.s);
    if (!src || (src.mode || 'fixed') === 'keywords') continue;
    lead ||= it.u;
    sectorsFor({ title: it.t, snippet: '', url: it.u }, src, compiled).sectors.forEach((sec, i) => {
      votes[sec] = Math.round(((votes[sec] ?? 0) + (i === 0 ? 1 : 0.6)) * 10) / 10;
    });
  }
  if (Object.keys(votes).length) {
    st.votes = votes;
    st.sectors = rankSectors(votes);
  } else {
    const kept = st.sectors.filter((x) => validSectors.has(x));
    const anyUrl = (st.items || []).find((it) => isSportUrl(it.u))?.u ?? '';
    st.sectors = refineSectors(kept.length ? kept : ['international'], st.title, '', compiled, anyUrl);
    if (st.votes) for (const k of Object.keys(st.votes)) if (!validSectors.has(k)) delete st.votes[k];
  }
}

/** Secteurs d'un sujet d'après ses votes : le meilleur, puis ceux qui pèsent au moins 45 % du meilleur (3 au plus) ; le Sport prime sur l'actualité générale. */
export function rankSectors(votes) {
  const ranked = Object.entries(votes).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const top = ranked[0]?.[1] ?? 0;
  let out = ranked.filter(([, v], i) => i === 0 || v >= top * 0.45).map(([k]) => k);
  if (out.includes('sport')) out = ['sport', ...out.filter((x) => x !== 'sport' && !SPORT_OVER.includes(x))];
  return out.slice(0, 3);
}
