// Génère les icônes PWA (public/icons) avec Playwright – outil ponctuel, déjà exécuté ; les PNG sont versionnés.
const { chromium } = require('playwright');
const path = require('node:path');
const EYE = 'M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0';
const svg = (size, { maskable }) => {
  const scale = maskable ? 0.52 : 0.62; // zone sûre plus petite pour les icônes « maskable »
  const eye = size * scale;
  const o = (size - eye) / 2;
  const radius = maskable ? 0 : size * 0.22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5B52D6"/><stop offset="1" stop-color="#3730A3"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${o} ${o}) scale(${eye / 24})" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
    <path d="${EYE}"/><circle cx="12" cy="12" r="3.2" fill="#F59E0B" stroke="none"/>
  </g></svg>`;
};
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const out = path.join(__dirname, '../../public/icons');
  const jobs = [['icon-192.png', 192, false], ['icon-512.png', 512, false], ['icon-maskable-192.png', 192, true], ['icon-maskable-512.png', 512, true], ['apple-touch-icon.png', 180, true], ['favicon-32.png', 32, false]];
  for (const [name, size, maskable] of jobs) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0;background:transparent">${svg(size, { maskable })}</body>`);
    await page.screenshot({ path: path.join(out, name), omitBackground: true });
  }
  await browser.close();
})();
