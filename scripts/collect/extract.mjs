// Texte lisible d'une page d'article (usage personnel) : Readability sur le HTML récupéré.
import { getText, UA_PAGE } from './http.mjs';
import { clip } from './text.mjs';

let deps = null;
async function load() {
  if (!deps) {
    const [{ JSDOM, VirtualConsole }, { Readability }] = await Promise.all([import('jsdom'), import('@mozilla/readability')]);
    deps = { JSDOM, VirtualConsole, Readability };
  }
  return deps;
}

const NOISE = /^(lire aussi|à lire aussi|read more|related|advertisement|publicité|sign up|subscribe|abonnez|newsletter|partager|share|suivez|follow|copyright|©|tous droits|all rights)/i;

/** Nettoie le texte brut renvoyé par Readability : paragraphes courts et mentions parasites retirés. */
export function cleanArticleText(raw) {
  const paras = String(raw ?? '').split(/\n+/).map((p) => p.replace(/\s+/g, ' ').trim()).filter((p) => p.length >= 40 && !NOISE.test(p));
  return paras.join('\n');
}

/**
 * @returns {Promise<{ text: string, description: string }>} texte vide si la page n'est pas exploitable
 */
export async function fetchArticle(url, { timeout = 12000 } = {}) {
  const r = await getText(url, { timeout, keepUA: true, maxBytes: 2_500_000, headers: { 'User-Agent': UA_PAGE, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' } });
  if (!/html|xml/i.test(r.contentType || 'html')) return { text: '', description: '' };
  const { JSDOM, VirtualConsole, Readability } = await load();
  const dom = new JSDOM(r.text, { url, virtualConsole: new VirtualConsole() });
  try {
    const doc = dom.window.document;
    const description = doc.querySelector('meta[property="og:description"], meta[name="description"]')?.getAttribute('content') ?? '';
    const art = new Readability(doc, { charThreshold: 200 }).parse();
    return { text: clip(cleanArticleText(art?.textContent), 7000), description: description.trim() };
  } finally {
    dom.window.close();
  }
}
