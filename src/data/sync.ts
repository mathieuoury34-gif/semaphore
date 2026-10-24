// Synchronisation gratuite des favoris, lus et préférences : Firebase (Spark), connexion Google.
// Le SDK est chargé à la demande depuis gstatic ; tant que FIREBASE_CONFIG est vide, l'app reste 100 % locale.
// Les états des appareils sont FUSIONNÉS (union des favoris et des lus), jamais écrasés.
import { useSyncExternalStore } from 'react';
import { FIREBASE_CONFIG } from './firebase-config';
import { getDevicePrefs, getState, onStateChange, replaceState, setDevicePrefs } from './store';
import { mergeState, sanitize, stable } from '../domain/state';
import { native, siteUrl } from '../native/bridge';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
const load = (m: string): Promise<Any> => import(/* @vite-ignore */ SDK + m);

export interface SyncStatus {
  configured: boolean;
  ready: boolean;
  user: { name: string; email: string; photo: string } | null;
  state: 'off' | 'syncing' | 'ok' | 'error';
  lastSync: string;
  error: string;
}
const configured = !!FIREBASE_CONFIG.apiKey;
let status: SyncStatus = { configured, ready: !configured, user: null, state: 'off', lastSync: '', error: '' };
const listeners = new Set<() => void>();
const set = (s: Partial<SyncStatus>) => { status = { ...status, ...s }; listeners.forEach((l) => l()); };
export const useSync = (): SyncStatus => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status);

let auth: Any, db: Any, fa: Any, fs: Any;
let unsubDoc: (() => void) | null = null;
let lastSynced = '';
let pushTimer: ReturnType<typeof setTimeout> | undefined;

async function init(): Promise<boolean> {
  if (auth) return true;
  if (!configured) return false;
  try {
    const [app, a, f] = await Promise.all([load('firebase-app.js'), load('firebase-auth.js'), load('firebase-firestore.js')]);
    fa = a; fs = f;
    const fbApp = app.initializeApp(FIREBASE_CONFIG, 'semaphore');
    auth = a.getAuth(fbApp);
    auth.languageCode = 'fr';
    db = f.initializeFirestore(fbApp, { localCache: f.persistentLocalCache({ tabManager: f.persistentMultipleTabManager() }) });
    return true;
  } catch (e) {
    set({ ready: true, state: 'error', error: 'Service de synchronisation injoignable' });
    console.warn('[sync] init', e);
    return false;
  }
}

const docRef = (uid: string) => fs.doc(db, 'users', uid, 'semaphore', 'main');

/** Écrit l'état fusionné avec celui du cloud (transaction : deux appareils ne s'écrasent jamais). */
async function push(uid: string) {
  set({ state: 'syncing' });
  try {
    const ref = docRef(uid);
    const merged = await fs.runTransaction(db, async (tx: Any) => {
      const snap = await tx.get(ref);
      let m = getState();
      if (snap.exists()) {
        try { m = mergeState(m, sanitize(JSON.parse(snap.data().data))); } catch { /* document illisible : on le remplace */ }
      }
      tx.set(ref, { data: JSON.stringify(m), updatedAt: m.updatedAt, device: navigator.userAgent.slice(0, 120) });
      return m;
    });
    lastSynced = stable(merged);
    if (lastSynced !== stable(getState())) replaceState(merged, 'remote');
    set({ state: 'ok', lastSync: new Date().toISOString(), error: '' });
  } catch (e) {
    set({ state: 'error', error: 'Envoi impossible : ' + ((e as Error).message || 'erreur') });
  }
}

function watch(uid: string) {
  unsubDoc?.();
  unsubDoc = fs.onSnapshot(docRef(uid), (snap: Any) => {
    setDevicePrefs({ syncedUid: uid });
    if (!snap.exists()) { void push(uid); return; }
    try {
      const remote = sanitize(JSON.parse(snap.data().data));
      const local = getState();
      const merged = mergeState(local, remote);
      if (stable(merged) !== stable(local)) replaceState(merged, 'remote');
      lastSynced = stable(merged);
      if (stable(merged) !== stable(remote)) void push(uid); // le cloud n'a pas tout : on complète
    } catch { /* document illisible */ }
    set({ state: 'ok', lastSync: new Date().toISOString(), error: '' });
  }, (e: Error) => set({ state: 'error', error: e.message }));
}

export async function startSync(): Promise<void> {
  if (!(await init())) return;
  fa.getRedirectResult(auth).catch(() => undefined);
  fa.onAuthStateChanged(auth, (u: Any) => {
    if (u) {
      set({ ready: true, user: { name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' }, state: 'syncing' });
      watch(u.uid);
    } else {
      unsubDoc?.(); unsubDoc = null;
      set({ ready: true, user: null, state: 'off' });
    }
  });
  // APK : retour de la page de connexion ouverte dans le navigateur du téléphone
  native.onAuthLink(async (idToken, accessToken) => {
    try {
      await fa.signInWithCredential(auth, fa.GoogleAuthProvider.credential(idToken || null, accessToken || null));
    } catch (e) {
      set({ error: 'Connexion impossible : ' + (e as Error).message, state: 'error' });
    }
  });
  onStateChange((s, origin) => {
    if (origin !== 'local' || !auth?.currentUser) return;
    if (stable(s) === lastSynced) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => void push(auth.currentUser.uid), 1200);
  });
  window.addEventListener('online', () => { if (auth?.currentUser && stable(getState()) !== lastSynced) void push(auth.currentUser.uid); });
}

/**
 * Résout quand l'utilisateur revient dans l'app sans être connecté (fenêtre Google fermée, retour arrière) :
 * sur téléphone, la fermeture de la fenêtre de connexion n'est pas toujours détectée.
 */
function returnedWithoutLogin(): { promise: Promise<void>; cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let armed = false;
  let cleanup: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    const check = () => {
      if (!armed || document.visibilityState !== 'visible') return;
      clearTimeout(timer);
      timer = setTimeout(() => { if (!auth?.currentUser) { cleanup(); resolve(); } }, 3000);
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    const arm = setTimeout(() => { armed = true; }, 800);
    cleanup = () => { clearTimeout(arm); clearTimeout(timer); window.removeEventListener('focus', check); document.removeEventListener('visibilitychange', check); };
  });
  return { promise, cancel: () => cleanup() };
}

export async function signIn(): Promise<void> {
  if (!(await init())) throw new Error('Synchronisation non configurée');
  // APK : Google refuse la connexion dans une vue web intégrée → page de connexion dans le navigateur du téléphone
  if (native.isApp()) { await native.openBrowser(siteUrl() + 'auth.html?app=1&lang=' + (document.documentElement.lang || 'fr')); return; }
  const provider = new fa.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const back = returnedWithoutLogin();
  try {
    const popup: Promise<unknown> = fa.signInWithPopup(auth, provider);
    popup.catch(() => undefined);
    await Promise.race([popup, back.promise]);
  } catch (e) {
    const code = (e as { code?: string }).code || '';
    if (code.includes('popup-blocked') || code.includes('operation-not-supported')) await fa.signInWithRedirect(auth, provider);
    else if (!/popup-closed|cancelled-popup-request|user-cancelled/.test(code)) throw e;
  } finally {
    back.cancel();
  }
}

export async function signOut(): Promise<void> {
  if (auth) await fa.signOut(auth);
}

export async function syncNow(): Promise<void> {
  if (auth?.currentUser) await push(auth.currentUser.uid);
}

export const knownAccount = (): boolean => !!getDevicePrefs().syncedUid;
