// Réglages des notifications d'édition (propres à l'appareil, non synchronisés) : activées ou non, une ou deux par jour, heure de chacune.
export interface NotifPrefs {
  on: boolean;
  count: 1 | 2;
  /** Heures « HH:MM » (heure locale) : la première sert pour 1 notification par jour, les deux pour 2. */
  times: [string, string];
}

/** Par défaut : désactivées ; le robot publie vers 7 h et 19 h (Paris, en été), d'où ces heures. */
export const NOTIF_DEFAULT: NotifPrefs = { on: false, count: 2, times: ['07:00', '19:00'] };

export const validTime = (s: unknown): s is string => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/** Réglages tolérants : tout champ absent ou invalide reprend sa valeur par défaut. */
export function normalizeNotif(raw: unknown): NotifPrefs {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const t = Array.isArray(r.times) ? r.times : [];
  return {
    on: r.on === true,
    count: r.count === 1 ? 1 : 2,
    times: [validTime(t[0]) ? t[0] : NOTIF_DEFAULT.times[0], validTime(t[1]) ? t[1] : NOTIF_DEFAULT.times[1]],
  };
}

/** Heures à programmer : une ou deux, sans doublon, de la plus tôt à la plus tard ; aucune si les notifications sont désactivées. */
export function activeTimes(p: NotifPrefs): string[] {
  if (!p.on) return [];
  const list = p.count === 1 ? [p.times[0]] : [p.times[0], p.times[1]];
  return [...new Set(list)].sort();
}
