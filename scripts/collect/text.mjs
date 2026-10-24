// Outils de texte du robot : nettoyage HTML, normalisation, jetons, URL canoniques, phrases.
import { createHash } from 'node:crypto';

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', acirc: 'â',
  ccedil: 'ç', icirc: 'î', iuml: 'ï', ocirc: 'ô', ugrave: 'ù', ucirc: 'û', uuml: 'ü', ouml: 'ö', auml: 'ä', szlig: 'ß',
  Eacute: 'É', Egrave: 'È', Agrave: 'À', Ccedil: 'Ç', euro: '€', copy: '©', reg: '®', deg: '°', middot: '·', times: '×',
  oelig: 'œ', OElig: 'Œ', thinsp: ' ', ensp: ' ', emsp: ' ', bull: '•', trade: '™', plusmn: '±', frac12: '½',
};

export function decodeEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => safeChar(parseInt(h, 16), m))
    .replace(/&#(\d+);/g, (m, d) => safeChar(parseInt(d, 10), m))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, n) => (n in NAMED ? NAMED[n] : m));
}
function safeChar(cp, fallback) {
  try { return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : fallback; } catch { return fallback; }
}

/** HTML (souvent échappé, parfois double) → texte brut sur une ligne. */
export function stripHtml(input) {
  let s = String(input ?? '');
  // certains flux échappent le HTML deux fois (&amp;lt;p&amp;gt;) : on décode tant que des balises échappées apparaissent
  for (let i = 0; i < 2 && /&lt;\/?[a-z]/i.test(s); i++) s = decodeEntities(s);
  s = s
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\s*(br|\/p|\/div|\/li|\/h[1-6]|\/tr)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return s.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Minuscules, sans accents, ponctuation → espaces. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export const STOP = new Set((
  // français
  'le la les un une des du de d l et en au aux ce cet cette ces se sa son ses leur leurs il elle ils elles on nous vous je tu ' +
  'qui que quoi dont ou est sont etait ete etre avoir a ont avait pas ne plus par pour sur sous dans avec sans entre vers chez ' +
  'mais donc or ni car si comme apres avant depuis pendant contre selon encore deja aussi tres tout tous toute toutes fait faire ' +
  'dit va vont peut peuvent doit doivent nouveau nouvelle nouveaux nouvelles premier premiere ans an jour jours annee ' +
  // anglais
  'the a an and or but of to in on at for from by with as is are was were be been being it its this that these those he she they ' +
  'we you i his her their our your not no new says say said will would could should can may might has have had do does did over ' +
  'after before into out up down about than then more most also how why what when where who which just now one two first ' +
  // bruit de titres
  'video photos photo live direct exclusif analyse opinion editorial emission edition replay podcast chronique interview ' +
  // jours et mois (titres d'émissions et de directs)
  'lundi mardi mercredi jeudi vendredi samedi dimanche janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre ' +
  'monday tuesday wednesday thursday friday saturday sunday january february march april june july august october december'
).split(/\s+/));

/** Jetons significatifs d'un titre (≥ 3 caractères ou nombres, hors mots vides). */
export function tokens(s) {
  const out = new Set();
  for (const w of norm(s).split(' ')) {
    if (!w || STOP.has(w)) continue;
    if (w.length >= 3 || /^\d+$/.test(w) && w.length >= 2) out.add(stem(w));
  }
  return out;
}
/** Racinisation très légère (pluriels) pour rapprocher « satellites »/« satellite ». */
function stem(w) {
  if (w.length > 4 && w.endsWith('s')) return w.slice(0, -1);
  return w;
}

const TRACKING = /^(utm_|fbclid|gclid|mc_|mkt_tok|xtor|xtref|at_|ref$|ref_|source$|cmpid|ocid|cid$|sref|smid|smtyp|partner|share|from$|igshid|wt\.|_ga|s_kwcid|amp$)/i;
export function canonicalUrl(u) {
  try {
    const url = new URL(String(u).trim());
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = '';
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, 'www.');
    for (const k of [...url.searchParams.keys()]) if (TRACKING.test(k)) url.searchParams.delete(k);
    url.searchParams.sort();
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

export function sha(s, n = 10) {
  return createHash('sha1').update(String(s)).digest('hex').slice(0, n);
}

/** Coupe à n caractères au dernier mot entier, avec une ellipse. */
export function clip(s, n) {
  const t = String(s ?? '').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n - 1);
  const sp = cut.lastIndexOf(' ');
  return (sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.\-–—]+$/, '') + '…';
}

/** Découpe en phrases (français/anglais). */
export function sentences(text) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?…])["»”)]?\s+(?=["«“(]?\s?[A-ZÀ-ÖØ-Þ0-9])/u);
  return parts.map((p) => p.trim()).filter(Boolean);
}

export function detectLang(text, fallback = 'fr') {
  const words = norm(text).split(' ').slice(0, 80);
  if (words.length < 5) return fallback;
  const fr = new Set('le la les des du un une et est sont dans pour sur avec par qui que au aux ce cette ont pas plus mais'.split(' '));
  const en = new Set('the of and to in is are for on with that this from by as at it be was were has have not but'.split(' '));
  let f = 0, e = 0;
  for (const w of words) { if (fr.has(w)) f++; if (en.has(w)) e++; }
  if (f === e) return fallback;
  return f > e ? 'fr' : 'en';
}

export function pool(items, limit, fn) {
  let i = 0;
  const results = new Array(items.length);
  const worker = async () => {
    while (i < items.length) {
      const k = i++;
      try { results[k] = await fn(items[k], k); } catch (e) { results[k] = { error: e }; }
    }
  };
  return Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)).then(() => results);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
