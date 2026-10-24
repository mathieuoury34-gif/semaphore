// Teste chaque source de data-src/sources.json : « node scripts/collect/probe.mjs [id…] »
// Affiche pour chacune le code HTTP, le nombre d'éléments lus et le plus récent. Utile après l'ajout d'une source.
import { readFileSync } from 'node:fs';
import { getText } from './http.mjs';
import { parseFeed, normalizeItems } from './feed.mjs';
import { pool } from './text.mjs';

const only = process.argv.slice(2);
const sources = JSON.parse(readFileSync('data-src/sources.json', 'utf8')).filter((s) => !only.length || only.includes(s.id));
const rows = await pool(sources, 8, async (s) => {
  const t0 = Date.now();
  try {
    const r = await getText(s.url, { timeout: 20000 });
    const items = normalizeItems(parseFeed(r.text, s), s);
    const newest = items.map((i) => i.date).sort().at(-1);
    return { id: s.id, ok: items.length > 0, n: items.length, newest: newest?.slice(0, 16) ?? '-', ms: Date.now() - t0, note: items.length ? '' : 'aucun élément' };
  } catch (e) {
    return { id: s.id, ok: false, n: 0, newest: '-', ms: Date.now() - t0, note: String(e.message || e).slice(0, 70) };
  }
});
for (const r of rows) console.log((r.ok ? 'OK  ' : 'ÉCHEC') + ' ' + r.id.padEnd(24) + String(r.n).padStart(4) + ' éléments  récent ' + r.newest + '  ' + r.ms + ' ms  ' + r.note);
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} sources opérationnelles`);
