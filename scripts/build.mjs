// Construction de Sémaphore dans dist/ (esbuild) ; --serve pour un serveur local de développement.
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const serve = process.argv.includes('--serve');

/** Empreinte du code de l'application (sources, icônes, secteurs ; pas les données du robot) : même valeur pour le site et l'APK construits depuis le même code. */
function buildId() {
  const h = createHash('sha256');
  const add = (p) => { for (const f of walkFiles(p).sort()) { h.update(f); h.update(readFileSync(f)); } };
  const walkFiles = (p) => (statSync(p).isDirectory()
    ? readdirSync(p).flatMap((n) => (p === 'public' && n === 'data' ? [] : walkFiles(join(p, n))))
    : [p]);
  for (const p of ['src', 'public', 'index.html', 'data-src/sectors.json', 'package-lock.json']) add(p);
  return h.digest('hex').slice(0, 10);
}
const BUILD_ID = buildId();
const SITE_URL = (process.env.SITE_URL || '').replace(/\/?$/, process.env.SITE_URL ? '/' : '');
rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('public', 'dist', { recursive: true });
cpSync('index.html', 'dist/index.html');

const options = {
  entryPoints: { app: 'src/main.tsx', auth: 'src/auth.ts' },
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]',
  target: ['es2020', 'chrome90', 'safari15'],
  minify: !serve,
  sourcemap: serve,
  loader: { '.json': 'json', '.woff2': 'file' },
  assetNames: 'assets/[name]-[hash]',
  define: { 'process.env.NODE_ENV': serve ? '"development"' : '"production"', __BUILD_ID__: JSON.stringify(BUILD_ID), __SITE_URL__: JSON.stringify(SITE_URL) },
  jsx: 'automatic',
  legalComments: 'none',
  logLevel: 'info',
};

function walk(dir, base = dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p, base) : [p.slice(base.length + 1).replace(/\\/g, '/')];
  });
}

function writeServiceWorker() {
  // les données (public/data/*.json) changent à chaque édition : jamais dans le cache de l'application, le service worker les gère à part
  const files = walk('dist').filter((f) => !f.endsWith('.map') && f !== 'sw.js' && f !== 'version.json' && f !== 'auth.html' && f !== 'auth.js' && !f.startsWith('data/'));
  const hash = createHash('sha256');
  for (const f of files) hash.update(readFileSync(join('dist', f)));
  const version = hash.digest('hex').slice(0, 10);
  const sw = readFileSync('src/sw.template.js', 'utf8')
    .replace('__VERSION__', version)
    .replace('__FILES__', JSON.stringify(['./', ...files.filter((f) => f !== 'index.html')]));
  writeFileSync('dist/sw.js', sw);
  writeFileSync('dist/version.json', JSON.stringify({ id: BUILD_ID }));
  console.log('service worker', version, files.length, 'fichiers');
}

if (serve) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  const { port } = await ctx.serve({ servedir: 'dist', port: 5173, host: '127.0.0.1' });
  console.log('http://127.0.0.1:' + port);
} else {
  await esbuild.build(options);
  writeServiceWorker();
}
