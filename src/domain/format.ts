// Dates et durées lisibles, dans la langue de l'application.
import type { Lang } from './types';

const DAY = 86400000;
const LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(lang: Lang, kind: 'day' | 'full' | 'time'): Intl.DateTimeFormat {
  const k = lang + kind;
  let f = cache.get(k);
  if (!f) {
    const o: Intl.DateTimeFormatOptions = kind === 'day' ? { weekday: 'short', day: 'numeric', month: 'short' } : kind === 'full' ? { weekday: 'long', day: 'numeric', month: 'long' } : { hour: '2-digit', minute: '2-digit' };
    f = new Intl.DateTimeFormat(LOCALE[lang], o);
    cache.set(k, f);
  }
  return f;
}

/** « il y a 5 min », « il y a 3 h », « hier », « lun. 20 oct. » (« 5 min ago », « yesterday », « Mon 20 Oct »). */
export function relTime(iso: string, lang: Lang = 'fr', now = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const d = now - t;
  const en = lang === 'en';
  if (d < 0 || d < 2 * 60000) return en ? 'just now' : "à l'instant";
  if (d < 3600000) return en ? `${Math.round(d / 60000)} min ago` : `il y a ${Math.round(d / 60000)} min`;
  if (d < DAY) return en ? `${Math.round(d / 3600000)} h ago` : `il y a ${Math.round(d / 3600000)} h`;
  if (d < 2 * DAY) return en ? 'yesterday' : 'hier';
  return fmt(lang, 'day').format(t).replace(/\.$/, '').replace(',', '');
}

export function dateFull(iso: string | number, lang: Lang = 'fr'): string {
  const s = fmt(lang, 'full').format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** « mar. 24 oct. à 7 h 12 » / « Tue 24 Oct at 07:12 ». */
export function dateTime(iso: string, lang: Lang = 'fr'): string {
  const d = new Date(iso);
  const day = fmt(lang, 'day').format(d).replace(',', '');
  return lang === 'en' ? `${day} at ${fmt(lang, 'time').format(d)}` : `${day} à ${fmt(lang, 'time').format(d).replace(':', ' h ')}`;
}

/** Édition du jour, d'après l'heure de génération (heure locale) : matin avant 14 h, sinon soir. */
export function edition(iso: string): 'morning' | 'evening' {
  return new Date(iso).getHours() < 14 ? 'morning' : 'evening';
}

export function ageHours(iso: string, now = Date.now()): number {
  return (now - Date.parse(iso)) / 3600000;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n > 1 ? many : one}`;
}
