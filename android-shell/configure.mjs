// Écrit capacitor.config.json. L'APK EMBARQUE l'application (dossier www/, copie de la version construite : voir prepare-www.mjs) :
// elle s'ouvre donc hors connexion, sans dépendre d'un service worker (absent des vues web Android d'application). Les données
// (feed.json…) et la page de connexion Google viennent du site publié (SITE_URL), l'application y est autorisée par CORS.
// SITE_URL : adresse publique de l'app, ex. https://mathieuoury34-gif.github.io/semaphore/
import { writeFileSync } from 'node:fs';
const url = process.env.SITE_URL;
if (!url) { console.error('SITE_URL manquant'); process.exit(1); }
const config = {
  appId: 'com.mathieu.semaphore',
  appName: 'Sémaphore',
  webDir: 'www',
  server: { androidScheme: 'https', cleartext: false },
  android: { backgroundColor: '#2B2135' },
};
writeFileSync('capacitor.config.json', JSON.stringify(config, null, 2));
console.log('capacitor.config.json (application embarquée, données depuis', url + ')');
