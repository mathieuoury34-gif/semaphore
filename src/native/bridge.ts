// Pont vers le natif quand l'app tourne dans l'APK Android (Capacitor). Rien n'est importé : les modules
// natifs sont exposés par Capacitor sur `window.Capacitor.Plugins`. Sur PC et iPhone, tout ceci est absent
// et l'app fonctionne normalement.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function cap(): Any {
  return typeof window !== 'undefined' ? (window as Any).Capacitor : undefined;
}
function plugin(name: string): Any {
  return cap()?.Plugins?.[name];
}

/** Adresse publique de l'app web (GitHub Pages), d'où l'APK charge l'interface. */
export function siteUrl(): string {
  if (typeof location === 'undefined') return '';
  const u = new URL(location.href);
  u.hash = '';
  u.search = '';
  return u.href.replace(/[^/]*$/, '');
}

const authCallbacks = new Set<(idToken: string, accessToken: string) => void>();
let linkListening = false;

function parseAuthLink(url: string) {
  if (!url.startsWith('semaphore://auth')) return;
  const frag = url.includes('#') ? url.slice(url.indexOf('#') + 1) : url.slice(url.indexOf('?') + 1);
  const p = new URLSearchParams(frag);
  const id = p.get('id_token') || '', acc = p.get('access_token') || '';
  if (id || acc) authCallbacks.forEach((cb) => cb(id, acc));
  plugin('Browser')?.close?.().catch?.(() => undefined);
}

export const native = {
  /** Vue web Android d'une application (l'APK), par opposition à Chrome ou à l'app installée depuis Chrome. */
  inWebView(): boolean {
    return typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent) && /; wv\)/.test(navigator.userAgent);
  },
  /** Application Android (APK) : Capacitor natif. */
  isApp(): boolean {
    return !!cap()?.isNativePlatform?.() && cap()?.getPlatform?.() === 'android';
  },
  async openBrowser(url: string): Promise<void> {
    const b = plugin('Browser');
    if (b) await b.open({ url, presentationStyle: 'popover' });
    else window.open(url, '_blank');
  },
  /** Retour de la page de connexion ouverte dans le navigateur (lien semaphore://auth#id_token=…). */
  onAuthLink(cb: (idToken: string, accessToken: string) => void) {
    authCallbacks.add(cb);
    const app = plugin('App');
    if (!app || linkListening) return;
    linkListening = true;
    app.addListener('appUrlOpen', (e: { url: string }) => parseAuthLink(e.url));
    app.getLaunchUrl?.().then((r: { url?: string } | undefined) => r?.url && parseAuthLink(r.url)).catch(() => undefined);
  },
};
