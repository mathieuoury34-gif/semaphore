const DAY = 86400000;
const fmtDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtFull = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

/** « il y a 5 min », « il y a 3 h », « hier », « lun. 20 oct. ». */
export function relTime(iso: string, now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = now - t;
  if (d < 0 || d < 2 * 60000) return "à l'instant";
  if (d < 3600000) return `il y a ${Math.round(d / 60000)} min`;
  if (d < DAY) return `il y a ${Math.round(d / 3600000)} h`;
  if (d < 2 * DAY) return 'hier';
  return fmtDay.format(t).replace(/\.$/, '');
}

export function dateFull(iso: string | number): string {
  const s = fmtFull.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function dateTimeFr(iso: string): string {
  const d = new Date(iso);
  return `${fmtDay.format(d)} à ${fmtTime.format(d).replace(':', ' h ')}`;
}

/** Édition du jour, d'après l'heure de génération (heure locale) : matin avant 14 h, sinon soir. */
export function edition(iso: string): string {
  const h = new Date(iso).getHours();
  return h < 14 ? 'Édition du matin' : 'Édition du soir';
}

export function ageHours(iso: string, now = Date.now()): number {
  return (now - Date.parse(iso)) / 3600000;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n > 1 ? many : one}`;
}
