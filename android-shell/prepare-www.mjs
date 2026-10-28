// Copie la version construite de l'application (dist/, à la racine du dépôt) dans www/ : c'est ce que l'APK embarque.
// Les fichiers inutiles dans l'APK (données du robot, service worker, page de connexion web) sont écartés.
import { cpSync, existsSync, rmSync, mkdirSync } from 'node:fs';
const SRC = '../dist';
if (!existsSync(SRC + '/index.html')) { console.error('prepare-www : ../dist/index.html introuvable (lancer « npm run build » à la racine, avec SITE_URL)'); process.exit(1); }
rmSync('www', { recursive: true, force: true });
mkdirSync('www', { recursive: true });
cpSync(SRC, 'www', { recursive: true });
for (const f of ['data', 'sw.js', 'auth.html', 'auth.js', 'version.json']) rmSync('www/' + f, { recursive: true, force: true });
console.log('www/ prêt (application embarquée)');
