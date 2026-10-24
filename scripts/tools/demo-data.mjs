// Données de démonstration pour contrôler l'application hors ligne (QA visuelle) : convertit public/data (v1 ou v2) en v2,
// ajoute des traductions fictives, des offres d'emploi, un digest bilingue et le catalogue de sources.
// Usage : node scripts/tools/demo-data.mjs <dossier de sortie> [--no-ai]   (ex. dist/data)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { migrateStory } from '../collect/stories.mjs';

const out = process.argv[2] || 'dist/data';
const noAi = process.argv.includes('--no-ai');
const read = (f) => JSON.parse(readFileSync(new URL(`../../public/data/${f}.json`, import.meta.url), 'utf8'));
const sources = JSON.parse(readFileSync(new URL('../../data-src/sources.json', import.meta.url), 'utf8')).filter((s) => s.enabled !== false);
const sectors = JSON.parse(readFileSync(new URL('../../data-src/sectors.json', import.meta.url), 'utf8'));
const feed = read('feed');
const now = new Date(feed.generatedAt);
const ago = (h) => new Date(now.getTime() - h * 3600000).toISOString();

const stories = feed.stories.map(migrateStory);
// quelques lectures « de gauche à droite » pour la couverture : on remplace des sources d'articles par des sources connues
const pol = sources.filter((s) => s.sectors.includes('politique') && s.lean);
stories.filter((s) => s.sectors[0] === 'politique').slice(0, 12).forEach((s, i) => {
  const extra = [pol[(i * 3) % pol.length], pol[(i * 3 + 1) % pol.length]].filter(Boolean);
  s.items.push(...extra.map((e, k) => ({ u: `https://demo.test/${s.id}/${k}`, t: s.title, s: e.id, d: ago(2 + k), l: e.lang })));
});
if (!noAi) {
  stories.forEach((s, i) => {
    if (i % 3 !== 0) return;
    const L = s.lang === 'en' ? 'fr' : 'en';
    const src = s.tx[s.lang];
    s.tx[L] = { t: (L === 'fr' ? 'Traduction (démo) : ' : 'Translation (demo): ') + src.t, tr: 1, s: L === 'fr' ? 'Résumé de démonstration rédigé en français à partir de l’article d’origine.' : 'Demo summary written in English from the original article.', by: 'llm', u: src.u, x: src.x };
  });
}
const jobs = [
  ['Ingénieur simulation CFD — Isar Aerospace · Munich', 'job-isar'], ['Stage — Propulsion cryogénique — Proxima Fusion · Munich', 'job-proxima'], ['Aerodynamics Engineer — Helsing · Munich', 'job-helsing'],
  ['Doctorant aéroacoustique — Latitude · Toulouse', 'job-latitude'], ['Thermal Engineer — Exotrail · Paris', 'job-exotrail'], ['Internship GNC — ICEYE · Munich', 'job-iceye'],
];
jobs.forEach(([title, sid], i) => {
  const src = sources.find((s) => s.id === sid);
  stories.push({ id: 'job' + i, title, lang: src.lang, sectors: ['emploi'], date: ago(20 + i * 30), first: ago(20 + i * 30), score: 2, votes: 1, rel: 0,
    tx: { [src.lang]: { t: title, n: 'Missions : modélisation numérique, essais, interface avec les équipes de conception. Profil : ingénieur ou doctorant, stage possible.', u: `https://demo.test/job${i}`, x: sid },
      [src.lang === 'en' ? 'fr' : 'en']: { t: title, tr: 1, s: 'Offre de démonstration : modélisation numérique, essais et interface avec les équipes de conception.', by: 'llm', u: `https://demo.test/job${i}`, x: sid } },
    items: [{ u: `https://demo.test/job${i}`, t: title, s: sid, d: ago(20 + i * 30), l: src.lang }] });
});
const visible = (L) => stories.filter((s) => s.tx[L]);
const digest = { v: 2, generatedAt: feed.generatedAt, by: noAi ? 'titres' : 'llm', briefBy: noAi ? 'titres' : 'llm', briefSig: 'demo', sectors: {}, brief: [] };
for (const sec of sectors) {
  const top = stories.filter((s) => s.sectors[0] === sec.id).sort((a, b) => b.score - a.score).slice(0, 3);
  digest.sectors[sec.id] = { by: digest.by, sig: 'demo', bullets: top.map((s) => ({ t: Object.fromEntries(['fr', 'en'].filter((L) => s.tx[L]).map((L) => [L, s.tx[L].t])), ids: [s.id] })) };
  top.slice(0, 1).forEach((s) => digest.brief.push({ sector: sec.id, t: Object.fromEntries(['fr', 'en'].filter((L) => s.tx[L]).map((L) => [L, s.tx[L].t])), ids: [s.id] }));
}
const catalog = sources.map((s) => ({ id: s.id, name: s.name, lang: s.lang, country: s.country, kind: s.kind, sectors: s.sectors, weight: s.weight, ...(s.lean ? { lean: s.lean } : {}) }));
const status = {
  v: 2, generatedAt: feed.generatedAt, durationMs: 90000,
  totals: { sources: catalog.length, ok: catalog.length - 3, newItems: 40, stories: stories.length, summaries: { llm: noAi ? 0 : 30, extractive: 40 }, languages: { fr: visible('fr').length, en: visible('en').length } },
  llm: noAi ? null : { used: 'gemini-demo', requests: 12, failures: 0 },
  sources: catalog.map((s, i) => ({ id: s.id, name: s.name, ok: i % 77 !== 5, items: 10 + (i % 9), new: 1, ms: 300, lastOk: feed.generatedAt, ...(i % 77 === 5 ? { error: 'HTTP 403' } : {}) })),
};
mkdirSync(out, { recursive: true });
const w = (f, d) => writeFileSync(`${out}/${f}.json`, JSON.stringify(d));
w('feed', { v: 2, generatedAt: feed.generatedAt, stories }); w('digest', digest); w('sources', { v: 2, sources: catalog }); w('status', status);
console.log('données de démonstration :', stories.length, 'sujets →', out);
