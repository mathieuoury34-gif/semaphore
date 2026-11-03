package com.mathieu.semaphore;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;

/**
 * Logique pure des notifications d'édition (aucune dépendance Android hors org.json) : calcul de l'heure du prochain
 * déclenchement, choix des titres de « L'essentiel », savoir si une nouvelle édition est attendue.
 */
final class EditionLogic {
    private EditionLogic() {}

    /** Le robot publie vers 4 h 50 et 16 h 50 UTC (cron GitHub Actions), soit vers 7 h et 19 h à Paris en été. */
    static final int[][] ROBOT_UTC = {{4, 50}, {16, 50}};
    /** Au-delà de ce délai après l'heure prévue du robot, on n'attend plus la nouvelle édition. */
    static final long ROBOT_WINDOW_MS = 100L * 60_000L;
    /** Une édition plus ancienne que cela n'est plus présentée comme « l'édition du jour ». */
    static final long MAX_AGE_MS = 20L * 3_600_000L;

    /** « 07:30 » → {7, 30} ; null si illisible. */
    static int[] parseTime(String s) {
        if (s == null) return null;
        String[] p = s.trim().split(":");
        if (p.length != 2) return null;
        try {
            int h = Integer.parseInt(p[0].trim()), m = Integer.parseInt(p[1].trim());
            return h >= 0 && h < 24 && m >= 0 && m < 60 ? new int[] {h, m} : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Prochain passage de h:m (heure locale du fuseau donné) strictement après `afterMs`. */
    static long nextTrigger(int h, int m, long afterMs, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz, Locale.ROOT);
        c.setTimeInMillis(afterMs);
        c.set(Calendar.HOUR_OF_DAY, h);
        c.set(Calendar.MINUTE, m);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= afterMs) c.add(Calendar.DAY_OF_MONTH, 1);
        return c.getTimeInMillis();
    }

    /** « 2026-10-28T23:00:13.193Z » → millisecondes (UTC) ; -1 si illisible. */
    static long parseIso(String iso) {
        if (iso == null || iso.length() < 19) return -1;
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.ROOT);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date d = f.parse(iso.substring(0, 19));
            return d == null ? -1 : d.getTime();
        } catch (Exception e) {
            return -1;
        }
    }

    /** Les édition du matin sont celles générées avant 14 h (heure locale), comme dans l'application. */
    static boolean isMorning(long generatedMs, TimeZone tz) {
        Calendar c = Calendar.getInstance(tz, Locale.ROOT);
        c.setTimeInMillis(generatedMs);
        return c.get(Calendar.HOUR_OF_DAY) < 14;
    }

    /**
     * Une édition vient-elle d'être attendue (le robot a dû passer il y a moins de ~1 h 40) sans qu'elle soit encore publiée ?
     * Dans ce cas, mieux vaut réessayer dans quelques minutes que présenter l'édition de la veille.
     */
    static boolean editionPending(long nowMs, long digestGeneratedMs) {
        Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"), Locale.ROOT);
        for (int dayShift = -1; dayShift <= 0; dayShift++) {
            for (int[] r : ROBOT_UTC) {
                c.setTimeInMillis(nowMs);
                c.add(Calendar.DAY_OF_MONTH, dayShift);
                c.set(Calendar.HOUR_OF_DAY, r[0]);
                c.set(Calendar.MINUTE, r[1]);
                c.set(Calendar.SECOND, 0);
                c.set(Calendar.MILLISECOND, 0);
                long expected = c.getTimeInMillis();
                if (nowMs >= expected && nowMs < expected + ROBOT_WINDOW_MS && digestGeneratedMs < expected) return true;
            }
        }
        return false;
    }

    /**
     * Titres de « L'essentiel » à présenter : ceux des secteurs suivis, dans la langue choisie (à défaut l'autre langue),
     * dans l'ordre du digest, sans doublon, au plus `max`. `sectors` vide ou nul : tous les secteurs.
     */
    static List<String> pickTitles(JSONObject digest, String lang, Set<String> sectors, int max) {
        List<String> out = new ArrayList<>();
        JSONArray brief = digest == null ? null : digest.optJSONArray("brief");
        if (brief == null) return out;
        String other = "fr".equals(lang) ? "en" : "fr";
        for (int i = 0; i < brief.length() && out.size() < max; i++) {
            JSONObject b = brief.optJSONObject(i);
            if (b == null) continue;
            String sector = b.optString("sector", "");
            if (sectors != null && !sectors.isEmpty() && !sectors.contains(sector)) continue;
            JSONObject t = b.optJSONObject("t");
            if (t == null) continue;
            String text = t.optString(lang, "").trim();
            if (text.isEmpty()) text = t.optString(other, "").trim();
            if (text.isEmpty() || out.contains(text)) continue;
            out.add(text);
        }
        return out;
    }
}
