// Clés de stockage local de Sémaphore. L'application s'appelait « Vigie » : les anciennes clés « vigie:* » sont reprises
// une fois (copiées sous le nouveau nom, puis supprimées) pour ne rien perdre sur les appareils déjà utilisés.
export const KEY_STATE = 'semaphore:state';
export const KEY_DEVICE = 'semaphore:device';
export const KEY_THEME = 'semaphore:theme';

export function migrateKeys(): void {
  try {
    for (const k of ['state', 'device', 'theme']) {
      const old = localStorage.getItem('vigie:' + k);
      if (old === null) continue;
      if (localStorage.getItem('semaphore:' + k) === null) localStorage.setItem('semaphore:' + k, old);
      localStorage.removeItem('vigie:' + k);
    }
  } catch { /* stockage indisponible */ }
}
if (typeof localStorage !== 'undefined') migrateKeys();
