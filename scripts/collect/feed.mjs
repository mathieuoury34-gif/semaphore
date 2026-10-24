// Lecture des flux RSS 2.0 / Atom / RDF (RSS 1.0) → éléments bruts normalisés.
import { XMLParser } from 'fast-xml-parser';
import { canonicalUrl, clip, decodeEntities, stripHtml } from './text.mjs';
import { parseJobs } from './jobs.mjs';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  processEntities: true,
  htmlEntities: true,
});

const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
/** Valeur texte d'un nœud XML (chaîne, objet avec #text, ou liste). */
function text(n) {
  if (n == null) return '';
  if (Array.isArray(n)) return text(n[0]);
  if (typeof n === 'object') return text(n['#text'] ?? '');
  return String(n);
}

function parseDate(v) {
  const s = text(v).trim();
  if (!s) return null;
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  // formats approximatifs : « 2026-10-24 08:15:00 » sans fuseau
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(s);
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])) : null;
}

function atomLink(links) {
  const list = arr(links);
  const alt = list.find((l) => typeof l === 'object' && (!l['@_rel'] || l['@_rel'] === 'alternate') && l['@_href']);
  return alt?.['@_href'] ?? list.find((l) => typeof l === 'object' && l['@_href'])?.['@_href'] ?? (typeof list[0] === 'string' ? list[0] : '');
}

/** Retire les préfixes propres à certains flux (arXiv) pour ne garder que le résumé. */
function cleanSnippet(raw, sourceId) {
  let s = stripHtml(raw);
  s = s.replace(/^arXiv:\S+\s+Announce Type:\s*\S+\s*Abstract:\s*/i, '');
  s = s.replace(/^\s*\d+\s*(?:min(?:ute)?s?|mn)\.?\s*(?:de lecture|read)\s*/i, '');
  if (/^Publication date:/i.test(s) && /Author\(s\)/.test(s)) s = '';
  s = s.replace(/^(AIAA Journal|Journal of [A-Za-z ]+), Ahead of Print\.?$/i, '');
  s = s.replace(/(Continuer la lecture|Lire la suite|Read more|Read the full|The post .* appeared first on .*)\.?\s*$/i, '');
  s = s.replace(/\s*\[…\]\s*$|\s*\[\.\.\.\]\s*$/, '…');
  return s.trim();
}

/**
 * @returns {{ title: string, url: string, date: Date|null, snippet: string, text: string, categories: string[], announce?: string }[]}
 */
export function parseFeed(xml, source = {}) {
  if (source.type) return parseJobs(xml, source); // offres d'emploi (JSON ou XML des services de recrutement)
  let doc;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new Error('XML illisible : ' + (e.message || e));
  }
  const out = [];

  if (doc.rss || doc.rdf?.item || doc['rdf:RDF']) {
    const root = doc.rss?.channel ?? doc['rdf:RDF'] ?? doc.rdf;
    const channel = arr(root)[0] ?? {};
    const items = arr(channel.item).length ? arr(channel.item) : arr(doc['rdf:RDF']?.item);
    for (const it of items) {
      const link = text(it.link) || text(it.guid) || atomLink(it['atom:link']);
      const desc = text(it.description) || text(it['content:encoded']);
      const full = text(it['content:encoded']) || text(it.description);
      out.push({
        title: stripHtml(text(it.title)),
        url: link,
        date: parseDate(it.pubDate) ?? parseDate(it['dc:date']) ?? parseDate(it.date) ?? parseDate(it['dcterms:date']),
        snippet: cleanSnippet(desc, source.id),
        text: stripHtml(full),
        categories: arr(it.category).map((c) => stripHtml(text(c))).filter(Boolean),
        announce: /Announce Type:\s*(\S+)/i.exec(text(it.description))?.[1]?.toLowerCase(),
      });
    }
  } else if (doc.feed) {
    for (const it of arr(doc.feed.entry)) {
      const summary = text(it.summary);
      const content = text(it.content);
      out.push({
        title: stripHtml(text(it.title)),
        url: atomLink(it.link) || text(it.id),
        date: parseDate(it.published) ?? parseDate(it.updated) ?? parseDate(it['dc:date']),
        snippet: cleanSnippet(summary || content, source.id),
        text: stripHtml(content || summary),
        categories: arr(it.category).map((c) => (typeof c === 'object' ? c['@_term'] ?? text(c) : String(c))).filter(Boolean),
      });
    }
  } else {
    throw new Error('Format de flux non reconnu');
  }
  return out;
}

/** Éléments bruts → éléments normalisés prêts pour le regroupement. */
export function normalizeItems(raw, source, now = new Date()) {
  const items = [];
  const seen = new Set();
  const maxFuture = now.getTime() + 2 * 3600 * 1000;
  for (const r of raw) {
    const url = canonicalUrl(decodeEntities(r.url));
    const title = clip(r.title.replace(/\s+/g, ' ').replace(/ \(arXiv:[^)]*\)\s*$/i, ''), 220);
    if (!url || !title || title.length < 8 || seen.has(url)) continue;
    if (source.skipAnnounce && r.announce && source.skipAnnounce.includes(r.announce)) continue;
    seen.add(url);
    let date = r.date ?? now;
    if (date.getTime() > maxFuture) date = now;
    items.push({
      url,
      title,
      date: date.toISOString(),
      snippet: clip(r.snippet, 400),
      text: r.text.length > r.snippet.length + 200 ? clip(r.text, 6000) : '',
      categories: r.categories.slice(0, 6),
      sourceId: source.id,
      lang: source.lang || 'fr',
      ...(source.type || source.jobs || source.noCluster ? { noCluster: true } : {}),
    });
  }
  return items;
}
