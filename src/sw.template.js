// Service worker de Sémaphore : l'application et la dernière édition fonctionnent hors ligne.
const VERSION = '__VERSION__';
const SHELL = 'semaphore-shell-' + VERSION;
const RUNTIME = 'semaphore-runtime';
const DATA = 'semaphore-data';
const FILES = __FILES__;

/** Copie ancienne d'un fichier de données, signalée à l'application par un en-tête. */
function offline(res) {
  const h = new Headers(res.headers);
  h.set('x-semaphore-cache', 'offline');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}
/** Dernier recours : l'application n'a jamais été chargée avec du réseau, il n'y a donc rien à afficher hors connexion. */
function offlinePage() {
  const html = '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sémaphore</title>' +
    '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#2B2135;color:#ECE7F4;font:16px/1.5 system-ui,sans-serif;text-align:center;padding:24px">' +
    '<main><h1 style="font-size:24px">Sémaphore</h1><p>Hors connexion, et l’application n’a pas encore été chargée une première fois.<br>Ouvrez-la une fois avec du réseau : elle fonctionnera ensuite sans.</p>' +
    '<button onclick="location.reload()" style="height:44px;padding:0 20px;border-radius:999px;border:0;background:#ECE7F4;color:#2B2135;font-weight:600">Réessayer</button></main></body></html>';
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => (k.startsWith('semaphore-shell-') || k.startsWith('vigie-')) && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // polices Google : en cache après le premier chargement
  if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com' || url.host === 'www.gstatic.com') {
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((r) => { if (r.ok || r.type === 'opaque') c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.origin !== self.location.origin) return; // Firebase : toujours en direct
  if (url.pathname.endsWith('/version.json')) return; // version de l'application (contrôle de l'APK) : jamais en cache
  // données du robot : réseau d'abord (toujours la dernière édition), dernière copie connue si hors ligne
  if (url.pathname.includes('/data/') && url.pathname.endsWith('.json')) {
    // hors connexion (ou réponse en erreur) : dernière copie connue, marquée « offline » pour que l'application affiche son bandeau
    const fallback = (bad) => caches.open(DATA).then((c) => c.match(url.pathname)).then((hit) => (hit ? offline(hit) : bad || Response.error()));
    e.respondWith(fetch(req).then((r) => {
      if (!r.ok) return fallback(r);
      const copy = r.clone(); caches.open(DATA).then((c) => c.put(url.pathname, copy));
      return r;
    }).catch(() => fallback()));
    return;
  }
  if (req.mode === 'navigate') {
    // la page est servie tout de suite depuis le cache (démarrage instantané) et mise à jour en arrière-plan
    e.respondWith(caches.match('./').then((hit) => {
      const net = fetch(req).then((r) => { if (r.ok) { const copy = r.clone(); caches.open(SHELL).then((c) => c.put('./', copy)); } return r; });
      if (hit) { e.waitUntil(net.catch(() => undefined)); return hit; }
      return net.catch(() => offlinePage()); // jamais la page d'erreur du navigateur
    }));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
