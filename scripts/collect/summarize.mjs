// Résumés : extraction de phrases (sans IA, toujours disponible) et résumés par modèle de langage (facultatifs, gratuits).
import { clip, norm, sentences, tokens } from './text.mjs';

// ------------------------------------------------------------------ extraction de phrases
const BOILER = /(lire aussi|à lire aussi|abonnez|s'abonner|newsletter|cookies?|©|copyright|tous droits|all rights|sign up|subscribe|advertisement|publicité|cliquez ici|click here|photo\s*:|crédit\s*:|image\s*:|source\s*:|suivez[- ]nous|follow us|partager cet article|share this|getty images|photo illustration|\(photo|image credit|credit:|\d+\s*min(ute)?s?\s*read)/i;

export function goodSentence(s) {
  return s.length >= 40 && s.length <= 420 && !BOILER.test(s) && !/^[\W\d_]+$/.test(s);
}

/** Un « résumé » qui ne fait que répéter le titre (ou une métadonnée) n'apporte rien : mieux vaut ne rien afficher. */
export function isUseless(summary, title) {
  const a = norm(summary), b = norm(title);
  if (!a) return true;
  if (/^publication date /.test(a)) return true;
  return a === b || (a.startsWith(b) && a.length < b.length + 25) || (b.startsWith(a) && a.length > b.length * 0.8);
}

/**
 * Résumé par extraction : les phrases les plus représentatives (fréquence des mots, proximité du titre, début de texte).
 * @returns {string} 1 à 3 phrases, 380 caractères au plus ; '' si rien d'exploitable
 */
export function extractiveSummary(text, { title = '', max = 380, maxSentences = 3 } = {}) {
  const all = sentences(text).filter(goodSentence);
  if (!all.length) return '';
  if (all.length <= 2) return clip(all.join(' '), max);
  const tt = tokens(title);
  const sets = all.map((s) => tokens(s));
  const freq = new Map();
  for (const set of sets) for (const w of set) freq.set(w, (freq.get(w) ?? 0) + 1);
  const scored = all.map((s, i) => {
    const set = sets[i];
    if (!set.size) return { i, s, sc: 0 };
    let f = 0, t = 0;
    for (const w of set) { f += freq.get(w) ?? 0; if (tt.has(w)) t++; }
    const sc = f / Math.sqrt(set.size) + t * 1.5 + (i < 4 ? (4 - i) * 0.8 : 0) - (s.length > 300 ? 1 : 0);
    return { i, s, sc };
  });
  const picked = [];
  let len = 0;
  for (const c of [...scored].sort((a, b) => b.sc - a.sc)) {
    if (picked.length >= maxSentences) break;
    if (len + c.s.length > max && picked.length) continue;
    picked.push(c);
    len += c.s.length + 1;
  }
  return clip(picked.sort((a, b) => a.i - b.i).map((c) => c.s).join(' '), max);
}

// ------------------------------------------------------------------ résumés par modèle (français ET anglais en un seul appel)
const SYSTEM_SUMMARY =
  "Tu rédiges une revue de presse personnelle bilingue pour un ingénieur curieux. Pour chaque article reçu, produis DANS LES DEUX LANGUES (« fr » = français, « en » = anglais) :\n" +
  "- « titre » : un titre clair et neutre (reprends tel quel le titre d'origine quand il est déjà dans cette langue) ;\n" +
  "- « resume » : 2 à 3 phrases factuelles (entre 220 et 420 caractères) : ce qui s'est passé, les chiffres et noms essentiels, le contexte utile.\n" +
  "Pour une offre d'emploi (« type » = « offre »), résume le poste : entreprise, lieu, mission, profil recherché, type de contrat (stage, CDI, thèse…).\n" +
  "Règles : n'invente rien, aucune opinion, ne dis jamais « l'article explique » ; conserve noms propres, chiffres et unités exacts ; " +
  "les deux versions disent la même chose ; si le texte fourni est trop pauvre, fais une seule phrase à partir du titre sans rien ajouter.\n" +
  'Réponds UNIQUEMENT par un objet JSON : {"items":[{"id":"…","fr":{"titre":"…","resume":"…"},"en":{"titre":"…","resume":"…"}}]}.';

const oneLine = (x) => String(x ?? '').replace(/\s+/g, ' ').trim();

/** Valide un lot de résumés. @returns {Map<string,{fr?:{titre:string,resume:string},en?:{titre:string,resume:string}}>} */
export function readSummaries(obj, ids) {
  const out = new Map();
  const list = Array.isArray(obj?.items) ? obj.items : Array.isArray(obj) ? obj : [];
  for (const it of list) {
    if (!it || !ids.has(String(it.id))) continue;
    const row = {};
    for (const L of ['fr', 'en']) {
      const v = it[L];
      const resume = oneLine(v?.resume ?? v?.summary);
      const titre = oneLine(v?.titre ?? v?.title);
      if (resume.length < 40 || resume.length > 900) continue;
      row[L] = { titre: titre && titre.length <= 220 ? titre : '', resume: clip(resume, 600) };
    }
    if (row.fr || row.en) out.set(String(it.id), row);
  }
  return out;
}

/**
 * Résume des sujets par lots. Chaque entrée : { id, title, source, lang, text, type? }.
 * @returns {Promise<Map<string,{fr?:{titre,resume},en?:{titre,resume}}>>}
 */
export async function llmSummaries(llm, entries, { batch = 6 } = {}) {
  const out = new Map();
  for (let i = 0; i < entries.length; i += batch) {
    if (!llm.available) break;
    const part = entries.slice(i, i + batch);
    const user = JSON.stringify(part.map((e) => ({ id: e.id, ...(e.type ? { type: e.type } : {}), source: e.source, langue: e.lang, titre: e.title, texte: clip(e.text, 1300) })));
    const obj = await llm.json({ system: SYSTEM_SUMMARY, user, maxTokens: 4200 });
    if (!obj) continue;
    for (const [k, v] of readSummaries(obj, new Set(part.map((e) => e.id)))) out.set(k, v);
  }
  return out;
}

// ------------------------------------------------------------------ digests (puces par secteur + brief du jour), dans les deux langues
const SYSTEM_DIGEST =
  "Tu rédiges la revue de presse du jour pour un lecteur pressé. On te donne, pour plusieurs secteurs, des sujets numérotés avec leur résumé. " +
  "Pour chaque secteur, écris 3 puces (4 s'il y a vraiment beaucoup à dire), chacune de 150 caractères au plus, en style télégraphique et factuel, " +
  "DANS LES DEUX LANGUES (« fr » et « en », même contenu), avec dans « refs » les numéros des sujets concernés (1 à 2). Ne regroupe pas des sujets sans lien. N'invente rien. " +
  'Réponds UNIQUEMENT en JSON : {"secteurs":{"<id>":[{"fr":"…","en":"…","refs":[1]}]}}.';

const SYSTEM_BRIEF =
  "Tu rédiges le « brief du jour » d'une revue de presse. On te donne les puces des secteurs. " +
  "Retiens les 6 à 8 faits les plus importants, tous secteurs confondus (au plus 2 par secteur), chacun en 170 caractères maximum, style télégraphique et factuel, " +
  "DANS LES DEUX LANGUES (« fr » et « en »). Indique pour chacun l'identifiant du secteur et le numéro de la puce (« ref »). " +
  'Réponds UNIQUEMENT en JSON : {"brief":[{"secteur":"<id>","fr":"…","en":"…","ref":1}]}.';

/** Textes d'une puce dans chaque langue : { fr?, en? } (une langue absente ou trop courte est omise). */
function langTexts(b, max) {
  const t = {};
  for (const L of ['fr', 'en']) {
    const x = oneLine(typeof b === 'string' ? (L === 'fr' ? b : '') : b?.[L] ?? b?.texte?.[L] ?? (L === 'fr' ? b?.texte : ''));
    if (x.length >= 15) t[L] = clip(x, max);
  }
  return t;
}

function cleanBullets(list, max, refMap) {
  const out = [];
  for (const b of Array.isArray(list) ? list : []) {
    const t = langTexts(b, 220);
    if (!t.fr && !t.en) continue;
    const refs = (Array.isArray(b?.refs) ? b.refs : []).map((n) => refMap[Number(n) - 1]).filter(Boolean).slice(0, 2);
    out.push({ t, ids: [...new Set(refs)] });
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Digests par secteur via le modèle. @param sectors [{id, name, stories:[{id,title,summary}]}]
 * @returns {Promise<Record<string, {t:{fr?:string,en?:string}, ids:string[]}[]>>}
 */
export async function llmSectorDigests(llm, sectors, { chunk = 5, perSector = 6 } = {}) {
  const res = {};
  const todo = sectors.filter((s) => s.stories.length >= 2);
  for (let i = 0; i < todo.length; i += chunk) {
    if (!llm.available) break;
    const part = todo.slice(i, i + chunk);
    const payload = Object.fromEntries(part.map((s) => [s.id, { nom: s.name, sujets: s.stories.slice(0, perSector).map((st, k) => ({ n: k + 1, titre: clip(st.title, 120), resume: clip(st.summary || '', 260) })) }]));
    const obj = await llm.json({ system: SYSTEM_DIGEST, user: JSON.stringify(payload), maxTokens: 4000 });
    if (!obj?.secteurs) continue;
    for (const s of part) {
      const bullets = cleanBullets(obj.secteurs[s.id], 4, s.stories.slice(0, perSector).map((x) => x.id));
      if (bullets.length >= 2) res[s.id] = bullets;
    }
  }
  return res;
}

export async function llmBrief(llm, digests, names) {
  if (!llm.available || !Object.keys(digests).length) return null;
  const pick = (t) => t.fr ?? t.en ?? '';
  const payload = Object.fromEntries(Object.entries(digests).map(([id, bl]) => [id, { nom: names[id] ?? id, puces: bl.map((b, k) => ({ n: k + 1, texte: pick(b.t) })) }]));
  const obj = await llm.json({ system: SYSTEM_BRIEF, user: JSON.stringify(payload), maxTokens: 3000 });
  if (!Array.isArray(obj?.brief)) return null;
  const out = [];
  for (const b of obj.brief) {
    const sector = String(b?.secteur ?? '');
    const t = langTexts(b, 220);
    if (!digests[sector] || (!t.fr && !t.en)) continue;
    const src = digests[sector][Number(b.ref) - 1];
    out.push({ sector, t, ids: src?.ids ?? [] });
    if (out.length >= 8) break;
  }
  return out.length >= 3 ? out : null;
}

// ------------------------------------------------------------------ repli sans modèle
/** Puces de secours : titres des meilleurs sujets, dans chaque langue où le sujet existe. */
export function plainDigest(stories, n = 3) {
  const out = [];
  for (const st of stories) {
    const t = {};
    for (const L of ['fr', 'en']) if (st.tx?.[L]?.t) t[L] = clip(st.tx[L].t, 200);
    if (t.fr || t.en) out.push({ t, ids: [st.id] });
    if (out.length >= n) break;
  }
  return out;
}

export function plainBrief(sectorOrder, digests, max = 8) {
  const out = [];
  const used = new Set();
  for (const id of sectorOrder) {
    const b = (digests[id] ?? []).find((x) => x.ids.every((i) => !used.has(i)));
    if (!b) continue;
    b.ids.forEach((i) => used.add(i));
    out.push({ sector: id, t: b.t, ids: b.ids });
    if (out.length >= max) break;
  }
  return out;
}
