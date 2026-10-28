#!/usr/bin/env node
// Robot de collecte de Sémaphore : lit les flux, regroupe par sujet, classe par secteur, résume, écrit public/data/*.json.
//   node scripts/collect/run.mjs [--out public/data] [--prev-dir <dossier> | --prev-url <https://…/data/>]
//        [--only id,id] [--no-articles] [--no-llm] [--max-summaries 140] [--dry]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getText } from './http.mjs';
import { normalizeItems, parseFeed } from './feed.mjs';
import { compileRules, isExcluded, reclassifyStory, REFINE, sectorsFor } from './classify.mjs';
import { attach, mergeAcrossLanguages, refreshLead } from './cluster.mjs';
import { fetchWorkday, jobFilter } from './jobs.mjs';
import { loadRules, loadSectors, loadSources } from './config.mjs';
import { LANGS, anySummaryTx, capPerSector, hasSummary, migrateStory, pickLead, publicStory, refreshTx } from './stories.mjs';
import { rankStories, bySector } from './rank.mjs';
import { fetchArticle } from './extract.mjs';
import { extractiveSummary, isUseless, llmBrief, llmSectorDigests, llmSummaries, plainBrief, plainDigest } from './summarize.mjs';
import { createLLM } from './llm.mjs';
import { clip, norm, pool, sha } from './text.mjs';

const argv = process.argv.slice(2);
const arg = (name, def) => { const i = argv.indexOf('--' + name); return i < 0 ? def : (argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[i + 1]); };
const OUT = arg('out', 'public/data');
const PREV_DIR = arg('prev-dir', null);
const PREV_URL = arg('prev-url', process.env.VIGIE_PREV_URL || null);
const ONLY = arg('only', null)?.split(',');
const FETCH_ARTICLES = !argv.includes('--no-articles');
const NO_LLM = argv.includes('--no-llm');
const DRY = argv.includes('--dry');
const MAX_SUMMARIES = Number(arg('max-summaries', 140));
const RETENTION_DAYS = Number(process.env.VIGIE_RETENTION_DAYS) || 7;
const MAX_PER_SECTOR = Number(process.env.VIGIE_MAX_PER_SECTOR) || 180; // sujets conservés par secteur (le plus important d'abord)
const SCHEMA = 2;

const t0 = Date.now();
const now = new Date();
const log = (...a) => console.log(...a);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ------------------------------------------------------------------ configuration
const sectors = loadSectors();
const allSources = loadSources();
const rulesJson = loadRules();
const rules = compileRules(rulesJson);
const sources = allSources.filter((s) => s.enabled !== false && (!ONLY || ONLY.includes(s.id)));
const sourceMap = new Map(allSources.map((s) => [s.id, s]));
const sectorName = Object.fromEntries(sectors.map((s) => [s.id, s.name]));
const sectorCfg = Object.fromEntries(sectors.map((s) => [s.id, s]));
/** Durée de conservation d'un sujet : 7 jours, plus pour les secteurs qui le demandent (offres d'emploi). */
const keepDays = (sectorIds) => Math.max(RETENTION_DAYS, ...sectorIds.slice(0, 1).map((id) => sectorCfg[id]?.retentionDays ?? 0));

// ------------------------------------------------------------------ état précédent (le site publié sert de mémoire)
async function loadPrev() {
  const names = ['feed', 'digest', 'status'];
  const out = {};
  for (const n of names) {
    try {
      if (PREV_DIR) {
        const p = join(PREV_DIR, n + '.json');
        if (existsSync(p)) out[n] = read(p);
      } else if (PREV_URL) {
        const r = await getText(String(PREV_URL).replace(/\/?$/, '/') + n + '.json', { timeout: 30000, keepUA: true, maxBytes: 40_000_000 });
        out[n] = JSON.parse(r.text);
      } else if (existsSync(join(OUT, n + '.json'))) {
        out[n] = read(join(OUT, n + '.json'));
      }
    } catch (e) {
      log(`  (état précédent « ${n} » indisponible : ${String(e.message || e).slice(0, 80)})`);
    }
  }
  return out;
}

const prev = await loadPrev();
let stories = Array.isArray(prev.feed?.stories) && (prev.feed.v === SCHEMA || prev.feed.v === 1) ? prev.feed.stories.map(migrateStory) : [];
// reclassement : à chaque changement des règles de classement (refine.version), les sujets déjà publiés sont reclassés d'après leurs articles
const validSectors = new Set(sectors.map((s) => s.id));
const CV = rules[REFINE].version;
let reclassified = 0;
for (const st of stories) {
  if (st.cv === CV && st.sectors.every((x) => validSectors.has(x))) continue;
  reclassifyStory(st, sourceMap, rules, validSectors);
  reclassified++;
}
if (reclassified) log(`  ${reclassified} sujets reclassés (règles de classement v${CV})`);
// règles « exclude » : un sujet déjà publié perd son secteur secondaire devenu hors sujet (ex. cryogénie dans Climat & énergie)
for (const st of stories) {
  const text = st.tx ? Object.values(st.tx).map((x) => x?.n || '').join(' ') : '';
  const keep = st.sectors.filter((sec, i) => i === 0 || !isExcluded(rules, sec, st.title, text));
  if (keep.length !== st.sectors.length) {
    for (const sec of st.sectors) if (!keep.includes(sec) && st.votes) delete st.votes[sec];
    st.sectors = keep;
  }
}
const prevStatus = new Map((prev.status?.sources ?? []).map((s) => [s.id, s]));
log(`Sémaphore – collecte du ${now.toISOString()}  (${stories.length} sujets déjà connus, ${sources.length} sources actives)`);

// ------------------------------------------------------------------ lecture des flux
// mémoire des articles déjà vus (même ceux dont le sujet a été écarté) : évite de les réintroduire au passage suivant
const today = now.toISOString().slice(0, 10);
const seen = { ...(prev.status?.seen ?? {}) };
const known = new Set(stories.flatMap((s) => s.items.map((i) => i.u)));
const isKnown = (url) => known.has(url) || sha(url, 8) in seen;
const remember = (url) => { known.add(url); seen[sha(url, 8)] = today; };
const cutoffFor = (days) => now.getTime() - days * 86400000;
const raw = new Map(); // url → { snippet, text } pour les éléments de ce passage
const newItems = [];
const statusRows = [];

async function readSource(s) {
  const before = prevStatus.get(s.id) ?? {};
  const row = { id: s.id, name: s.name, ok: false, items: 0, new: 0, ms: 0, lastOk: before.lastOk ?? null, etag: before.etag, lastModified: before.lastModified };
  const t = Date.now();
  try {
    const load = (extra = {}) => (s.type === 'workday'
      ? fetchWorkday(s).then((text) => ({ status: 200, text }))
      : getText(s.url, { timeout: 20000, etag: before.etag, lastModified: before.lastModified, maxBytes: s.type || s.jobs ? 12_000_000 : undefined, ...extra }));
    let r = await load();
    if (r.notModified) {
      row.ok = true; row.lastOk = now.toISOString(); row.note = 'inchangé';
      return row;
    }
    let parsed;
    try {
      parsed = parseFeed(r.text, s);
    } catch (e) {
      // page d'attente ou refus déguisé en 200 : nouvel essai avec une identité de navigateur
      if (s.type === 'workday') throw e;
      r = await getText(s.url, { timeout: 20000, keepUA: true, headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
      parsed = parseFeed(r.text, s);
    }
    if (s.type || s.jobs) { const keep = jobFilter(rulesJson.jobs, s); parsed = parsed.filter(keep); } // offres : seulement celles qui correspondent au profil
    const since = cutoffFor(Math.max(RETENTION_DAYS, s.retentionDays ?? keepDays(s.sectors)));
    let items = normalizeItems(parsed, s, now).filter((i) => Date.parse(i.date) >= since);
    row.items = items.length;
    items.sort((a, b) => b.date.localeCompare(a.date));
    items = items.slice(0, s.limit ?? 40);
    for (const it of items) {
      const cl = sectorsFor(it, s, rules);
      it.sectors = cl.sectors; it.rel = cl.rel;
      // offres : celles situées en France passent devant, puis celles d'entreprises qui ont un site en France, puis les autres
      if (s.type || s.jobs) it.rel = it.fr ? 1 : s.france ? 0.7 : 0.3;
      if (!it.sectors.length) continue;
      raw.set(it.url, { snippet: it.snippet, text: it.text });
      if (!isKnown(it.url)) { newItems.push(it); remember(it.url); row.new++; }
    }
    row.ok = true; row.lastOk = now.toISOString();
    row.etag = r.etag; row.lastModified = r.lastModified;
  } catch (e) {
    row.error = String(e.message || e).slice(0, 140);
  } finally {
    row.ms = Date.now() - t;
  }
  return row;
}

statusRows.push(...(await pool(sources, 10, readSource)));
const okCount = statusRows.filter((r) => r.ok).length;
log(`Flux lus : ${okCount}/${sources.length} · ${newItems.length} nouveaux articles`);
for (const r of statusRows.filter((x) => !x.ok)) log(`  ✗ ${r.id} : ${r.error}`);

// ------------------------------------------------------------------ regroupement, élagage, classement
const touched = attach(stories, newItems, sourceMap);
for (const st of touched) refreshLead(st, sourceMap);
for (const st of stories) refreshTx(st, sourceMap, raw); // blocs natifs par langue (titre, extrait, article de tête)
stories = stories.filter((st) => Date.parse(st.date) >= cutoffFor(keepDays(st.sectors)));
for (const st of stories) st.cv = CV;
rankStories(stories, sourceMap, now.getTime());
stories = capPerSector(stories, MAX_PER_SECTOR, Object.fromEntries(sectors.filter((s) => s.capFactor).map((s) => [s.id, s.capFactor])));
const byId = new Map(stories.map((s) => [s.id, s]));
log(`Sujets : ${stories.length} (${touched.length} créés ou enrichis)`);

// ------------------------------------------------------------------ résumés
const llm = NO_LLM ? null : createLLM(process.env, { log });
const llmDone = (st) => LANGS.every((L) => st.tx?.[L]?.by === 'llm');
const freshMs = (st) => (sectorCfg[st.sectors[0]]?.freshHours ?? 60) * 3600000;
const wantRefresh = (st) => (!hasSummary(st) && !st.noSummary) || (llm && !llmDone(st) && Date.now() - Date.parse(st.date) < Math.max(40 * 3600000, freshMs(st) * 0.7));
const pickSet = new Map();
for (const sec of sectors) {
  const top = bySector(stories, sec.id).filter((st) => Date.now() - Date.parse(st.date) < freshMs(st)).slice(0, sec.summaries ?? 10);
  for (const st of top) if (wantRefresh(st)) pickSet.set(st.id, st);
}
const candidates = [...pickSet.values()].sort((a, b) => b.score - a.score).slice(0, MAX_SUMMARIES);
log(`Résumés à produire : ${candidates.length}${llm ? ' (modèle gratuit disponible)' : ' (sans modèle : extraction de phrases)'}`);

const texts = new Map();
await pool(candidates, 6, async (st) => {
  const lead = pickLead(st.items, sourceMap);
  const r = raw.get(lead.u);
  let text = r?.text && r.text.length >= 500 ? r.text : '';
  if (!text && FETCH_ARTICLES && !sourceMap.get(lead.s)?.type && !sourceMap.get(lead.s)?.gnews) {
    try {
      const a = await fetchArticle(lead.u);
      text = a.text.length >= 300 ? a.text : '';
      if (!text && a.description && a.description.length > (r?.snippet?.length ?? 0)) texts.set(st.id + ':desc', a.description);
    } catch { /* page inaccessible : on se contente de l'extrait du flux */ }
  }
  texts.set(st.id, text || texts.get(st.id + ':desc') || r?.snippet || anySummaryTx(st)?.n || lead.t);
});

// extraction de phrases pour tous (repli permanent), dans la langue de l'article de tête
for (const st of candidates) {
  const lead = pickLead(st.items, sourceMap);
  const L = lead.l;
  const tx = (st.tx[L] ??= { t: lead.t, u: lead.u, x: lead.s });
  const text = texts.get(st.id) ?? tx.n ?? '';
  let ext = extractiveSummary(text, { title: lead.t }) || clip(tx.n || text, 320);
  if (isUseless(ext, lead.t)) ext = '';
  if (ext && tx.by !== 'llm') {
    tx.s = ext; tx.by = 'extractive';
  } else if (!ext && !hasSummary(st)) {
    st.noSummary = true; // rien d'exploitable (titre seul) : inutile de réessayer à chaque passage
  }
}

// résumés par modèle : français et anglais en un seul appel
let llmCount = 0;
if (llm && candidates.length) {
  const need = candidates.filter((st) => !llmDone(st));
  const entries = need.map((st) => {
    const lead = pickLead(st.items, sourceMap);
    return { id: st.id, ...(st.sectors[0] === 'emploi' ? { type: 'offre' } : {}), title: lead.t, source: sourceMap.get(lead.s)?.name ?? '', lang: lead.l, text: texts.get(st.id) ?? anySummaryTx(st)?.n ?? '' };
  });
  const res = await llmSummaries(llm, entries);
  for (const [id, v] of res) {
    const st = byId.get(id);
    if (!st) continue;
    const lead = pickLead(st.items, sourceMap);
    for (const L of LANGS) {
      if (!v[L]) continue;
      const native = st.items.some((i) => i.l === L);
      const tx = (st.tx[L] ??= { u: lead.u, x: lead.s });
      tx.s = v[L].resume; tx.by = 'llm';
      if (!tx.t) { tx.t = v[L].titre || lead.t; if (v[L].titre) tx.tr = 1; } // titre traduit seulement quand aucun article n'existe dans cette langue
      else if (!native && v[L].titre && norm(v[L].titre) !== norm(tx.t)) { tx.t = v[L].titre; tx.tr = 1; }
    }
    llmCount++;
  }
  log(`  résumés par modèle : ${llmCount}/${need.length}`);
}

// sujets du même événement publiés en français et en anglais : fusion d'après les titres traduits
{
  const r = mergeAcrossLanguages(stories, sourceMap);
  if (r.merged) {
    stories = r.stories;
    for (const st of stories) refreshTx(st, sourceMap, raw);
    rankStories(stories, sourceMap, now.getTime());
    log(`  sujets fusionnés entre langues : ${r.merged}`);
  }
}

// ------------------------------------------------------------------ digests par secteur et brief du jour (deux langues)
const digestRows = {};
const prevDigest = prev.digest?.v === SCHEMA ? prev.digest : { sectors: {}, brief: [] };
const sigOf = (list) => sha(list.map((st) => st.id + LANGS.map((L) => st.tx[L]?.by?.[0] ?? '-').join('')).join('|'), 8);
const perSector = [];
for (const sec of sectors) {
  const list = bySector(stories, sec.id).filter((st) => hasSummary(st)).slice(0, 6);
  perSector.push({ id: sec.id, name: sec.name, stories: list, sig: sigOf(list) });
}
const stale = perSector.filter((p) => p.stories.length && prevDigest.sectors?.[p.id]?.sig !== p.sig);
let llmDigests = {};
if (llm && stale.length) {
  const forModel = stale.map((p) => ({ ...p, stories: p.stories.map((st) => ({ id: st.id, title: anySummaryTx(st)?.t ?? st.title, summary: anySummaryTx(st)?.s ?? '' })) }));
  llmDigests = await llmSectorDigests(llm, forModel);
}
for (const p of perSector) {
  if (!p.stories.length) continue;
  const old = prevDigest.sectors?.[p.id];
  if (old && old.sig === p.sig) digestRows[p.id] = old;
  else if (llmDigests[p.id]) digestRows[p.id] = { sig: p.sig, by: 'llm', bullets: llmDigests[p.id] };
  else digestRows[p.id] = { sig: p.sig, by: 'titres', bullets: plainDigest(p.stories, 3) };
}
const briefSig = sha(JSON.stringify(Object.entries(digestRows).map(([k, v]) => k + v.sig)), 8);
let brief = null, briefBy = 'titres';
if (prevDigest.briefSig === briefSig && prevDigest.brief?.length) { brief = prevDigest.brief; briefBy = prevDigest.briefBy ?? 'titres'; }
else if (llm) {
  brief = await llmBrief(llm, Object.fromEntries(Object.entries(digestRows).map(([k, v]) => [k, v.bullets])), sectorName);
  if (brief) briefBy = 'llm';
}
if (!brief) brief = plainBrief(sectors.map((s) => s.id), Object.fromEntries(Object.entries(digestRows).map(([k, v]) => [k, v.bullets])));

// ------------------------------------------------------------------ écriture
const generatedAt = now.toISOString();
const outStories = stories.map(publicStory).sort((a, b) => b.date.localeCompare(a.date));
const countBy = (by) => stories.filter((s) => LANGS.some((L) => s.tx[L]?.by === by)).length;

const sourceCatalog = allSources.filter((s) => s.enabled !== false).map((s) => ({
  id: s.id, name: s.name, lang: s.lang, country: s.country, kind: s.kind, sectors: s.sectors, weight: s.weight,
  ...(s.lean ? { lean: s.lean } : {}),
}));
const outputs = {
  'feed.json': { v: SCHEMA, generatedAt, stories: outStories },
  'digest.json': { v: SCHEMA, generatedAt, by: briefBy, brief, briefSig, briefBy, sectors: digestRows },
  'status.json': {
    v: SCHEMA, generatedAt, durationMs: Date.now() - t0,
    totals: {
      sources: sources.length, ok: okCount, newItems: newItems.length, stories: stories.length,
      summaries: { llm: countBy('llm'), extractive: countBy('extractive') },
      languages: Object.fromEntries(LANGS.map((L) => [L, stories.filter((s) => s.tx[L]).length])),
    },
    llm: llm ? { used: llm.label, requests: llm.requests, failures: llm.failures } : null,
    sources: statusRows,
    seen: Object.fromEntries(Object.entries({ ...Object.fromEntries(stories.flatMap((s) => s.items.map((i) => [sha(i.u, 8), today]))), ...seen }).filter(([, d]) => Date.parse(d) >= now.getTime() - 14 * 86400000)),
  },
  'sources.json': { v: SCHEMA, sources: sourceCatalog },
};

if (!stories.length) {
  console.error('Aucun sujet : abandon (rien n\'est publié).');
  process.exit(1);
}
if (!DRY) {
  mkdirSync(OUT, { recursive: true });
  for (const [name, obj] of Object.entries(outputs)) writeFileSync(join(OUT, name), JSON.stringify(obj));
}
const kb = Math.round(Buffer.byteLength(JSON.stringify(outputs['feed.json'])) / 1024);
const tt = outputs['status.json'].totals;
log(`Terminé en ${Math.round((Date.now() - t0) / 1000)} s · feed.json ${kb} Ko · résumés : ${tt.summaries.llm} par modèle, ${tt.summaries.extractive} par extraction · sujets en français : ${tt.languages.fr}, en anglais : ${tt.languages.en}${DRY ? ' (essai à blanc, rien d\'écrit)' : ''}`);
