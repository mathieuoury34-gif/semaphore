// Mise à jour de l'APK. L'application Android embarque l'interface (elle s'ouvre donc hors connexion) : une nouvelle version du
// design ou des écrans demande de retélécharger l'APK. Le site publié contient version.json (empreinte du code, voir
// scripts/build.mjs) ; si elle diffère de celle de l'application installée, un bandeau propose le téléchargement.
import { useSyncExternalStore } from 'react';
import { apkUrl, native, siteUrl } from '../native/bridge';

let available = false;
const listeners = new Set<() => void>();
export const useUpdateAvailable = (): boolean => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => available);

async function check(): Promise<void> {
  if (!native.isApp() || !__BUILD_ID__) return;
  try {
    const r = await fetch(siteUrl() + 'version.json', { cache: 'no-store' });
    if (!r.ok) return;
    const remote = String(((await r.json()) as { id?: string }).id ?? '');
    const next = !!remote && remote !== __BUILD_ID__;
    if (next !== available) { available = next; listeners.forEach((l) => l()); }
  } catch { /* hors connexion : on réessaiera */ }
}

export function startUpdateCheck(): void {
  if (!native.isApp()) return;
  void check();
  window.addEventListener('online', () => void check());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void check(); });
}

export function downloadUpdate(): void {
  const url = apkUrl();
  if (url) void native.openBrowser(url);
}
