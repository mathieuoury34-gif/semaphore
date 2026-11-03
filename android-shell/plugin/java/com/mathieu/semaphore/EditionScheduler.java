package com.mathieu.semaphore;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import java.util.TimeZone;

/** Programme les alarmes (une ou deux par jour, à l'heure locale choisie) et les nouvelles tentatives. */
final class EditionScheduler {
    static final String ACTION_EDITION = "com.mathieu.semaphore.EDITION";
    static final String EXTRA_ATTEMPT = "attempt";
    private static final int MAX_SLOTS = 2;
    private static final int RETRY_CODE = 10;
    static final long RETRY_MS = 8L * 60_000L;
    static final int MAX_ATTEMPTS = 14;

    private EditionScheduler() {}

    private static PendingIntent intent(Context c, int code, int attempt, boolean create) {
        Intent i = new Intent(c, EditionReceiver.class).setAction(ACTION_EDITION).putExtra(EXTRA_ATTEMPT, attempt);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        if (!create) flags = PendingIntent.FLAG_NO_CREATE | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(c, code, i, flags);
    }

    private static void set(Context c, long atMs, PendingIntent pi) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        // Alarme inexacte mais autorisée en veille profonde : aucune permission « alarme exacte » nécessaire.
        if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi);
        else am.set(AlarmManager.RTC_WAKEUP, atMs, pi);
    }

    static void cancelAll(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int s = 0; s < MAX_SLOTS; s++) {
            PendingIntent pi = intent(c, s, 0, false);
            if (pi != null) { am.cancel(pi); pi.cancel(); }
        }
        cancelRetry(c);
    }

    static void cancelRetry(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        PendingIntent pi = intent(c, RETRY_CODE, 0, false);
        if (am != null && pi != null) { am.cancel(pi); pi.cancel(); }
    }

    /** (Re)programme les prochains passages d'après les réglages enregistrés ; renvoie les heures programmées (ms), ou un tableau vide si désactivé. */
    static long[] scheduleAll(Context c) {
        cancelAll(c);
        EditionStore st = EditionStore.load(c);
        if (!st.on) return new long[0];
        long now = System.currentTimeMillis();
        long[] out = new long[Math.min(MAX_SLOTS, st.times.length)];
        int n = 0;
        for (int s = 0; s < out.length; s++) {
            int[] hm = EditionLogic.parseTime(st.times[s]);
            if (hm == null) continue;
            long at = EditionLogic.nextTrigger(hm[0], hm[1], now + 60_000L, TimeZone.getDefault());
            set(c, at, intent(c, s, 0, true));
            out[n++] = at;
        }
        return java.util.Arrays.copyOf(out, n);
    }

    /** Nouvelle tentative dans quelques minutes (édition pas encore publiée, ou pas de réseau). */
    static void scheduleRetry(Context c, int attempt) {
        set(c, System.currentTimeMillis() + RETRY_MS, intent(c, RETRY_CODE, attempt, true));
    }
}
