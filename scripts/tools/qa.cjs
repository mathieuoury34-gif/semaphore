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
const SCREENS = [['une', '#/une'], ['secteurs', '#/secteurs'], ['espace', '#/secteurs/espace'], ['emploi', '#/secteurs/emploi'], ['politique', '#/secteurs/politique'], ['story', '#/une?sheet=story:__ID__'], ['favoris', '#/favoris'], ['reglages', '#/reglages'], ['sources', '#/reglages', 'sources']];
// langue × thème × largeur : le français complet, l'anglais en mobile et ordinateur
const RUNS = [['fr', 'light', [360, 390, 412, 1280]], ['fr', 'dark', [390, 1280]], ['en', 'light', [390, 1280]], ['en', 'dark', [390]]];
(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const feed = JSON.parse(fs.readFileSync(path.join(dist, 'data/feed.json'), 'utf8'));
  const multi = feed.stories.find((s) => s.sectors[0] === 'politique' && s.items.length >= 3 && s.tx.fr && s.tx.en) || feed.stories.find((s) => s.items.length >= 3) || feed.stories[0];
  const browser = await chromium.launch();
  let bad = 0;
  for (const [lang, theme, widths] of RUNS) {
    for (const width of widths) {
      const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 800 }, colorScheme: theme, deviceScaleFactor: 1, hasTouch: width < 600 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|gstatic|ERR_/.test(m.text())) errors.push(m.text()); });
      await page.goto(base + '#/une');
      await page.waitForTimeout(1500);
      // état de démonstration : un favori, des mots suivis, la langue choisie, un journal masqué en politique
      await page.evaluate(([st, lang]) => {
        const now = new Date().toISOString();
        const tx = {};
        for (const L of ['fr', 'en']) if (st.tx[L]) tx[L] = { title: st.tx[L].t, summary: st.tx[L].s || '', url: st.items[0].u, source: 'Source' };
        localStorage.setItem('vigie:state', JSON.stringify({ v: 1, favorites: { [st.id]: { id: st.id, title: st.tx[lang]?.t || st.title, summary: '', sector: st.sectors[0], date: st.date, url: st.items[0].u, source: 'Source', lang: st.lang, tx, savedAt: now } }, read: {}, prefs: { followed: null, keywords: ['espace', 'Ariane'], lang, off: { politique: ['humanite'] }, at: now }, updatedAt: now }));
      }, [multi, lang]);
      for (const [name, hash, mode] of SCREENS) {
        await page.goto(base + hash.replace('__ID__', multi.id));
        await page.reload();
        await page.waitForTimeout(1800);
        if (mode === 'sources') {
          await page.evaluate(() => { const d = document.querySelectorAll('details.sector-sources'); d.forEach((x, i) => { if (i < 2) x.open = true; }); document.querySelector('#s-src')?.scrollIntoView(); });
          await page.waitForTimeout(300);
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        if (overflow > 0) { bad++; console.log(`DÉBORDEMENT ${lang} ${theme} ${width} ${name}: ${overflow}px`); }
        // aucun texte de l'autre langue dans les écrans de contenu (heuristique : mots-outils)
        if (['une', 'espace', 'emploi', 'politique'].includes(name)) {
          const txt = await page.evaluate(() => document.querySelector('.content')?.innerText || '');
          const other = lang === 'fr' ? /\b(the|and|with|from|will)\b/i : /\b(le|la|les|des|pour|dans|avec)\b/i;
          const hit = txt.split('\n').filter((l) => other.test(l) && !/Traduction|Translation/.test(l)).slice(0, 2);
          if (hit.length) { console.log(`MÉLANGE ? ${lang} ${name}:`, hit.map((l) => l.slice(0, 90))); }
        }
        await page.screenshot({ path: path.join(outDir, `${lang}-${theme}-${width}-${name}.png`), fullPage: false });
      }
      if (errors.length) { bad++; console.log(`ERREURS ${lang} ${theme} ${width}:`, errors.slice(0, 3)); }
      await ctx.close();
    }
  }
  await browser.close();
  server.close();
  console.log(bad ? `${bad} problème(s)` : 'QA : aucun débordement, aucune erreur');
  process.exit(bad ? 1 : 0);
})();
