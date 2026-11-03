package com.mathieu.semaphore;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.HashSet;
import java.util.Set;

/** Réglages des notifications, copiés depuis l'écran « Réglages » de l'application (stockés côté natif pour survivre au redémarrage). */
final class EditionStore {
    private static final String FILE = "semaphore_notifications";
    final boolean on;
    final String[] times;
    final String lang;
    final Set<String> sectors;
    final String site;
    final String lastGenerated;

    private EditionStore(SharedPreferences p) {
        on = p.getBoolean("on", false);
        String t = p.getString("times", "07:00");
        times = t.isEmpty() ? new String[0] : t.split(",");
        lang = p.getString("lang", "fr");
        String s = p.getString("sectors", "");
        sectors = new HashSet<>();
        for (String x : s.split(",")) if (!x.trim().isEmpty()) sectors.add(x.trim());
        site = p.getString("site", "");
        lastGenerated = p.getString("last", "");
    }

    static EditionStore load(Context c) {
        return new EditionStore(c.getSharedPreferences(FILE, Context.MODE_PRIVATE));
    }

    static void save(Context c, boolean on, String times, String lang, String sectors, String site) {
        c.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit()
            .putBoolean("on", on).putString("times", times).putString("lang", lang)
            .putString("sectors", sectors).putString("site", site).apply();
    }

    static void markNotified(Context c, String generatedAt) {
        c.getSharedPreferences(FILE, Context.MODE_PRIVATE).edit().putString("last", generatedAt).apply();
    }
}
