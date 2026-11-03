// Notifications d'édition de l'APK Android : l'application envoie ses réglages au plugin natif (SemaphoreNotifications),
// qui programme les alarmes, lit la dernière édition à l'heure choisie et affiche les titres de « L'essentiel ».
// Hors de l'APK (navigateur, PWA), tout ceci est inactif.
import { useEffect, useState } from 'react';
import { getDevicePrefs, getState, onStateChange, setDevicePrefs } from '../data/store';
import { activeTimes, normalizeNotif, type NotifPrefs } from '../domain/notif';
import { followedSectors } from '../domain/select';
import { SECTOR_IDS } from '../ui/news';
import { native, plugin, siteUrl } from './bridge';

export type NotifPermission = 'granted' | 'denied' | 'prompt';
export interface NotifStatus { permission: NotifPermission; batteryUnrestricted: boolean; manufacturer: string }

const p = () => plugin('SemaphoreNotifications');

/** Le plugin natif est-il présent (APK à jour) ? */
export const notifAvailable = (): boolean => native.isApp() && !!p();

export const getNotifPrefs = (): NotifPrefs => normalizeNotif(getDevicePrefs().notif);

export function saveNotifPrefs(next: Partial<NotifPrefs>): NotifPrefs {
  const merged = normalizeNotif({ ...getNotifPrefs(), ...next });
  setDevicePrefs({ notif: merged });
  void syncNotifications();
  return merged;
}

async function call<T>(method: string, arg?: unknown): Promise<T | null> {
  try { return (await p()?.[method]?.(arg)) as T; } catch { return null; }
}

export const notifStatus = (): Promise<NotifStatus | null> => call<NotifStatus>('getStatus');
export const notifRequestPermission = (): Promise<NotifStatus | null> => call<NotifStatus>('requestPermission');
export const notifOpenSettings = (): Promise<unknown> => call('openSettings');
export const notifOpenBattery = (): Promise<unknown> => call('openBatterySettings');

/** Affiche tout de suite la dernière édition. Renvoie null si tout va bien, sinon le message d'erreur. */
export async function notifTest(): Promise<string | null> {
  try { await p()?.test(); return null; } catch (e) { return (e as { message?: string })?.message || 'Échec'; }
}

/** Envoie au natif les réglages courants (activation, heures, langue, secteurs suivis, adresse du site). */
export async function syncNotifications(): Promise<void> {
  if (!notifAvailable()) return;
  const prefs = getNotifPrefs();
  const st = getState().prefs;
  await call('schedule', {
    on: prefs.on,
    times: activeTimes(prefs),
    lang: st.lang,
    sectors: followedSectors(SECTOR_IDS, st),
    site: siteUrl(),
  });
}

let started = false;
/** Au lancement et à chaque changement de langue ou de secteurs suivis : le natif garde ainsi les mêmes réglages que l'écran. */
export function startNotifications(): void {
  if (started || !native.isApp()) return;
  started = true;
  let last = '';
  let timer: ReturnType<typeof setTimeout> | undefined;
  const key = () => { const s = getState().prefs; return JSON.stringify([s.lang, s.followed]); };
  const sync = () => { last = key(); void syncNotifications(); };
  sync();
  onStateChange(() => { if (key() !== last) { clearTimeout(timer); timer = setTimeout(sync, 400); } });
}

/** État des autorisations Android, relu au retour dans l'application (après un passage par les réglages du téléphone). */
export function useNotifStatus(): NotifStatus | null {
  const [st, setSt] = useState<NotifStatus | null>(null);
  useEffect(() => {
    let live = true;
    const read = () => { void notifStatus().then((s) => { if (live && s) setSt(s); }); };
    read();
    const vis = () => { if (document.visibilityState === 'visible') read(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('focus', read);
    return () => { live = false; document.removeEventListener('visibilitychange', vis); window.removeEventListener('focus', read); };
  }, []);
  return st;
}
