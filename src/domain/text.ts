/** Minuscules sans accents, ponctuation remplacée par des espaces. */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Tous les mots de la requête figurent dans le texte (préfixes acceptés : « hydro » trouve « hydrogène »). */
export function matchesQuery(textNorm: string, query: string): boolean {
  const words = norm(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const hay = ' ' + textNorm;
  return words.every((w) => hay.includes(' ' + w));
}

export function clip(s: string, n: number): string {
  s = s.replace(/\s+/g, ' ').trim();
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n * 0.6)).replace(/[\s,;:.\-–]+$/, '') + '…';
}

export function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
}
