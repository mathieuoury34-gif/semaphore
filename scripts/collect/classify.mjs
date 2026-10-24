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

export function compileRules(rules) {
  const out = {};
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
  if (source.exclusive ?? !!(source.type || source.jobs)) return { sectors: base.slice(0, 3), rel: 0.5 }; // offres d'emploi : secteur imposé par la source
  const matches = matchSectors(compiled, item.title, item.snippet);
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
  const rel = sectors.length ? Math.min(1, score(sectors[0]) / 6) : 0;
  return { sectors, rel: Math.round(rel * 100) / 100 };
}
