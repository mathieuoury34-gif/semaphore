import { createRoot } from 'react-dom/client';
import { App } from './App';
import { startAutoRefresh } from './data/feed';
import { startSync } from './data/sync';
import { hideSplash } from './splash';
import { native } from './native/bridge';
import './styles/tokens.css';
import './styles/app.css';
import './styles/news.css';
import './theme';

createRoot(document.getElementById('root')!).render(<App />);

startAutoRefresh();
void startSync();
setTimeout(hideSplash, 8000); // sécurité : l'écran de lancement ne reste jamais bloqué

// Application hors ligne (service worker) – uniquement en production (https)
// Dans l'APK, jamais de service worker : une page servie par lui ne passe pas par Capacitor, qui n'y injecte alors
// pas son pont natif (connexion Google). On désinstalle donc un service worker resté d'avant.
if ('serviceWorker' in navigator && location.protocol === 'https:' && native.inWebView()) {
  navigator.serviceWorker.getRegistrations().then(async (regs) => {
    if (!regs.length) return;
    await Promise.all(regs.map((r) => r.unregister()));
    if (!native.isApp()) {
      try { if (sessionStorage.getItem('semaphore:sw-reload')) return; sessionStorage.setItem('semaphore:sw-reload', '1'); } catch { /* rien */ }
      location.reload();
    }
  }).catch(() => undefined);
} else if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
  // nouvelle version installée : on recharge une fois pour l'appliquer tout de suite
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloaded) return; reloaded = true; location.reload(); });
  }
}
