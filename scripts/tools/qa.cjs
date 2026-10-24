// Contrôle visuel : parcourt les écrans à plusieurs largeurs, en clair et en sombre, et vérifie l'absence de défilement horizontal.
// Usage : npm run build && node scripts/tools/qa.cjs [dossier-de-captures]
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const dist = path.resolve(__dirname, '../../dist');
const outDir = path.resolve(process.argv[2] || '/tmp/vigie-qa');
fs.mkdirSync(outDir, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(dist, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (e, b) => { if (e) { res.statusCode = 404; res.end(); } else { res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream'); res.end(b); } });
});
const SCREENS = [['une', '#/une'], ['secteurs', '#/secteurs'], ['espace', '#/secteurs/espace'], ['story', '#/une?sheet=story:__ID__'], ['favoris', '#/favoris'], ['reglages', '#/reglages']];
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const feed = JSON.parse(fs.readFileSync(path.join(dist, 'data/feed.json'), 'utf8'));
  const multi = feed.stories.find((s) => s.items.length >= 3 && s.summary) || feed.stories[0];
  const browser = await chromium.launch();
  let bad = 0;
  for (const theme of ['light', 'dark']) {
    for (const width of [360, 390, 412, 1280]) {
      const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 800 }, colorScheme: theme, deviceScaleFactor: 1, hasTouch: width < 600 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|gstatic|ERR_/.test(m.text())) errors.push(m.text()); });
      await page.goto(base + '#/une');
      await page.waitForTimeout(2200);
      // un favori de démonstration pour l'écran Favoris
      await page.evaluate((st) => {
        const now = new Date().toISOString();
        localStorage.setItem('vigie:state', JSON.stringify({ v: 1, favorites: { [st.id]: { id: st.id, title: st.title, summary: st.summary || '', sector: st.sectors[0], date: st.date, url: st.items[0].u, source: 'Source', lang: st.lang, savedAt: now } }, read: {}, prefs: { followed: null, keywords: ['espace', 'Ariane'], at: now }, updatedAt: now }));
      }, multi);
      for (const [name, hash] of SCREENS) {
        await page.goto(base + hash.replace('__ID__', multi.id));
        await page.reload();
        await page.waitForTimeout(2300);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 0) { bad++; console.log(`DÉBORDEMENT ${theme} ${width} ${name}: ${overflow}px`); }
        await page.screenshot({ path: path.join(outDir, `${theme}-${width}-${name}.png`), fullPage: false });
      }
      if (errors.length) { bad++; console.log(`ERREURS ${theme} ${width}:`, errors.slice(0, 3)); }
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  console.log(bad ? `${bad} problème(s)` : 'QA : aucun débordement, aucune erreur');
  process.exit(bad ? 1 : 0);
})();
