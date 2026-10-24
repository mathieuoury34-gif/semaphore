// Requêtes réseau du robot : délai maximal, nouvelle tentative, requêtes conditionnelles (ETag / If-Modified-Since).
export const UA_FEED = 'Vigie/1.0 (lecteur de flux personnel; +https://github.com/)';
// Pages d'articles : certains sites refusent les robots déclarés. Usage strictement personnel.
export const UA_PAGE = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

async function once(url, { timeout = 15000, headers = {}, maxBytes = 3_000_000, method = 'GET', body } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(new Error('délai dépassé')), timeout);
  try {
    const res = await fetch(url, { method, body, headers, signal: ctl.signal, redirect: 'follow' });
    if (res.status === 304) return { status: 304, headers: res.headers, text: '' };
    const reader = res.body?.getReader();
    let size = 0;
    const chunks = [];
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { await reader.cancel(); break; }
        chunks.push(value);
      }
    }
    const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    return { status: res.status, ok: res.ok, headers: res.headers, buf };
  } finally {
    clearTimeout(timer);
  }
}

/** Décode en respectant l'encodage annoncé (en-tête ou déclaration XML/HTML), UTF-8 par défaut. */
export function decodeBody(buf, contentType = '') {
  let enc = /charset=([\w-]+)/i.exec(contentType)?.[1];
  if (!enc) {
    const head = buf.subarray(0, 600).toString('latin1');
    enc = /<\?xml[^>]*encoding=["']([\w-]+)["']/i.exec(head)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1];
  }
  try {
    return new TextDecoder((enc || 'utf-8').toLowerCase()).decode(buf);
  } catch {
    return buf.toString('utf8');
  }
}

/**
 * Récupère un texte. Réessaie une fois sur erreur réseau ou 5xx.
 * @returns {{status:number, text:string, etag?:string, lastModified?:string, notModified?:boolean}}
 */
export async function getText(url, opts = {}) {
  const headers = { 'User-Agent': UA_FEED, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5', 'Accept-Language': 'fr,en;q=0.8', ...(opts.headers || {}) };
  if (opts.etag) headers['If-None-Match'] = opts.etag;
  if (opts.lastModified) headers['If-Modified-Since'] = opts.lastModified;
  let lastErr;
  let browserUA = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await once(url, { ...opts, headers });
      if (r.status === 304) return { status: 304, text: '', notModified: true, etag: opts.etag, lastModified: opts.lastModified };
      if (r.status >= 500 && attempt === 0) { lastErr = new Error('HTTP ' + r.status); await new Promise((s) => setTimeout(s, 800)); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return {
        status: r.status,
        text: decodeBody(r.buf, r.headers.get('content-type') || ''),
        etag: r.headers.get('etag') || undefined,
        lastModified: r.headers.get('last-modified') || undefined,
        contentType: r.headers.get('content-type') || '',
      };
    } catch (e) {
      lastErr = e;
      // certains sites refusent le robot déclaré mais acceptent un navigateur ordinaire : une seule nouvelle tentative
      if (/HTTP 40[13]/.test(e.message) && !browserUA && !opts.keepUA) { browserUA = true; headers['User-Agent'] = UA_PAGE; continue; }
      if (/HTTP (4\d\d)/.test(e.message)) break; // inutile de réessayer une erreur client
      await new Promise((s) => setTimeout(s, 600));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

export async function postJSON(url, body, headers = {}, timeout = 60000) {
  const r = await once(url, { method: 'POST', timeout, headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), maxBytes: 4_000_000 });
  const text = r.buf ? r.buf.toString('utf8') : '';
  return { status: r.status, ok: r.ok, text, headers: r.headers };
}
