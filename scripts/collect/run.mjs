#!/usr/bin/env node
// Robot de collecte de Vigie : lit les flux, regroupe par sujet, classe par secteur, résume, écrit public/data/*.json.
//   node scripts/collect/run.mjs [--out public/data] [--prev-dir <dossier> | --prev-url <https://…/data/>]
//        [--only id,id] [--no-articles] [--no-llm] [--max-summaries 140] [--dry]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getText } from './http.mjs';
import { normalizeItems, parseFeed } from './feed.mjs';
import { compileRules, sectorsFor } from './classify.mjs';
import { attach, refreshLead } from './cluster.mjs';
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
const MAX_STORIES = 1000;
const SCHEMA = 1;

const t0 = Date.now();
const now = new Date();
const log = (...a) => console.log(...a);
const read = (p) => JSON.parse(readFileSync(p, 'utf8'));

// ------------------------------------------------------------------ configuration
const sectors = read('data-src/sectors.json');
const allSources = read('data-src/sources.json');
const rules = compileRules(read('data-src/rules.json'));
const sources = allSources.filter((s) => s.enabled !== false && (!ONLY || ONLY.includes(s.id)));
const sourceMap = new Map(allSources.map((s) => [s.id, s]));
const sectorName = Object.fromEntries(sectors.map((s) => [s.id, s.name]));

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
        const r = await getText(String(PREV_URL).replace(/\/?$/, '/') + n + '.json', { timeout: 20000, keepUA: true });
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
let stories = Array.isArray(prev.feed?.stories) && prev.feed.v === SCHEMA ? prev.feed.stories : [];
const prevStatus = new Map((prev.status?.sources ?? []).map((s) => [s.id, s]));
log(`Vigie – collecte du ${now.toISOString()}  (${stories.length} sujets déjà connus, ${sources.length} sources actives)`);

// ------------------------------------------------------------------ lecture des flux
// mémoire des articles déjà vus (même ceux dont le sujet a été écarté) : évite de les réintroduire au passage suivant
const today = now.toISOString().slice(0, 10);
const seen = { ...(prev.status?.seen ?? {}) };
const known = new Set(stories.flatMap((s) => s.items.map((i) => i.u)));
const isKnown = (url) => known.has(url) || sha(url, 8) in seen;
const remember = (url) => { known.add(url); seen[sha(url, 8)] = today; };
const cutoff = now.getTime() - RETENTION_DAYS * 86400000;
const raw = new Map(); // url → { snippet, text } pour les éléments de ce passage
const newItems = [];
const statusRows = [];

async function readSource(s) {
  const before = prevStatus.get(s.id) ?? {};
  const row = { id: s.id, name: s.name, ok: false, items: 0, new: 0, ms: 0, lastOk: before.lastOk ?? null, etag: before.etag, lastModified: before.lastModified };
  const t = Date.now();
  try {
    let r = await getText(s.url, { timeout: 20000, etag: before.etag, lastModified: before.lastModified });
    if (r.notModified) {
      row.ok = true; row.lastOk = now.toISOString(); row.note = 'inchangé';
      return row;
    }
    let parsed;
    try {
      parsed = parseFeed(r.text, s);
    } catch (e) {
      // page d'attente ou refus déguisé en 200 : nouvel essai avec une identité de navigateur
      r = await getText(s.url, { timeout: 20000, keepUA: true, headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' } });
      parsed = parseFeed(r.text, s);
    }
    let items = normalizeItems(parsed, s, now).filter((i) => Date.parse(i.date) >= cutoff);
    row.items = items.length;
    items.sort((a, b) => b.date.localeCompare(a.date));
    items = items.slice(0, s.limit ?? 40);
    for (const it of items) {
      const cl = sectorsFor(it, s, rules);
      it.sectors = cl.sectors; it.rel = cl.rel;
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
for (const st of touched) {
  refreshLead(st, sourceMap);
  const lead = st.items.find((i) => i.t === st.title) ?? st.items[0];
  const r = raw.get(lead.u);
  if (r?.snippet) st.snippet = clip(r.snippet, 260);
}
stories = stories.filter((st) => Date.parse(st.date) >= cutoff);
rankStories(stories, sourceMap, now.getTime());
if (stories.length > MAX_STORIES) stories = stories.sort((a, b) => b.score - a.score).slice(0, MAX_STORIES);
const byId = new Map(stories.map((s) => [s.id, s]));
log(`Sujets : ${stories.length} (${touched.length} créés ou enrichis)`);

// ------------------------------------------------------------------ résumés
const llm = NO_LLM ? null : createLLM(process.env, { log });
const wantRefresh = (st) => (!st.summary && st.summaryBy !== 'none') || (llm && st.summaryBy !== 'llm' && Date.now() - Date.parse(st.date) < 40 * 3600000);
const pickSet = new Map();
for (const sec of sectors) {
  const top = bySector(stories, sec.id).filter((st) => Date.now() - Date.parse(st.date) < 60 * 3600000).slice(0, sec.summaries ?? 10);
  for (const st of top) if (wantRefresh(st)) pickSet.set(st.id, st);
}
const candidates = [...pickSet.values()].sort((a, b) => b.score - a.score).slice(0, MAX_SUMMARIES);
log(`Résumés à produire : ${candidates.length}${llm ? ' (modèle gratuit disponible)' : ' (sans modèle : extraction de phrases)'}`);

const texts = new Map();
await pool(candidates, 6, async (st) => {
  const lead = st.items.find((i) => i.t === st.title) ?? st.items[0];
  const r = raw.get(lead.u);
  let text = r?.text && r.text.length >= 500 ? r.text : '';
  if (!text && FETCH_ARTICLES) {
    try {
      const a = await fetchArticle(lead.u);
      text = a.text.length >= 300 ? a.text : '';
      if (!text && a.description && a.description.length > (r?.snippet?.length ?? 0)) texts.set(st.id + ':desc', a.description);
    } catch { /* page inaccessible : on se contente de l'extrait du flux */ }
  }
  texts.set(st.id, text || texts.get(st.id + ':desc') || r?.snippet || st.snippet || st.title);
});

// extraction de phrases pour tous (repli permanent)
for (const st of candidates) {
  const text = texts.get(st.id) ?? st.snippet ?? '';
  let ext = extractiveSummary(text, { title: st.title }) || clip(st.snippet || text, 320);
  if (isUseless(ext, st.title)) ext = '';
  if (ext && (!st.summary || st.summaryBy !== 'llm')) {
    st.summary = ext;
    st.summaryBy = 'extractive';
    st.summaryLang = st.lang;
  } else if (!ext && !st.summary) {
    st.summaryBy = 'none'; // rien d'exploitable (titre seul) : inutile de réessayer à chaque passage
  }
}

// résumés par modèle (français)
let llmDone = 0;
if (llm && candidates.length) {
  const entries = candidates.map((st) => ({ id: st.id, title: st.title, source: sourceMap.get(st.items[0].s)?.name ?? '', lang: st.lang, text: texts.get(st.id) ?? st.snippet ?? '' }));
  const res = await llmSummaries(llm, entries);
  for (const [id, v] of res) {
    const st = byId.get(id);
    if (!st) continue;
    st.summary = v.resume; st.summaryBy = 'llm'; st.summaryLang = 'fr';
    if (v.titre && norm(v.titre) !== norm(st.title)) st.titleFr = v.titre; else delete st.titleFr;
    llmDone++;
  }
  log(`  résumés par modèle : ${llmDone}/${candidates.length}`);
}

// ------------------------------------------------------------------ digests par secteur et brief du jour
const digestRows = {};
const prevDigest = prev.digest?.v === SCHEMA ? prev.digest : { sectors: {}, brief: [] };
const sigOf = (list) => sha(list.map((st) => st.id + (st.summaryBy === 'llm' ? 'L' : 'e')).join('|'), 8);
const perSector = [];
for (const sec of sectors) {
  const list = bySector(stories, sec.id).filter((st) => st.summary).slice(0, 6);
  perSector.push({ id: sec.id, name: sec.name, stories: list, sig: sigOf(list) });
}
const stale = perSector.filter((p) => p.stories.length && prevDigest.sectors?.[p.id]?.sig !== p.sig);
let llmDigests = {};
if (llm && stale.length) llmDigests = await llmSectorDigests(llm, stale);
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
const outStories = stories
  .map((st) => ({
    id: st.id, title: st.title, ...(st.titleFr ? { titleFr: st.titleFr } : {}), sectors: st.sectors, date: st.date, first: st.first, lang: st.lang,
    snippet: st.snippet ? clip(st.snippet, 260) : '', summary: st.summary ?? null, summaryBy: st.summaryBy ?? null, summaryLang: st.summaryLang ?? null,
    score: st.score, votes: st.votes, rel: st.rel ?? 0, items: st.items.slice().sort((a, b) => b.d.localeCompare(a.d)).slice(0, 12),
  }))
  .sort((a, b) => b.date.localeCompare(a.date));

const sourceCatalog = allSources.filter((s) => s.enabled !== false).map((s) => ({ id: s.id, name: s.name, lang: s.lang, country: s.country, kind: s.kind, sectors: s.sectors, weight: s.weight }));
const outputs = {
  'feed.json': { v: SCHEMA, generatedAt, stories: outStories },
  'digest.json': { v: SCHEMA, generatedAt, by: briefBy, brief, briefSig, briefBy, sectors: digestRows },
  'status.json': {
    v: SCHEMA, generatedAt, durationMs: Date.now() - t0,
    totals: { sources: sources.length, ok: okCount, newItems: newItems.length, stories: stories.length, summaries: { llm: stories.filter((s) => s.summaryBy === 'llm').length, extractive: stories.filter((s) => s.summaryBy === 'extractive').length } },
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
log(`Terminé en ${Math.round((Date.now() - t0) / 1000)} s · feed.json ${kb} Ko · résumés : ${outputs['status.json'].totals.summaries.llm} par modèle, ${outputs['status.json'].totals.summaries.extractive} par extraction${DRY ? ' (essai à blanc, rien d\'écrit)' : ''}`);
