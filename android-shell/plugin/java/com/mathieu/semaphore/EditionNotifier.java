package com.mathieu.semaphore;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.TimeZone;

/** Lit la dernière édition publiée et affiche la notification avec les titres de « L'essentiel ». */
final class EditionNotifier {
    enum Outcome { SENT, SKIPPED, RETRY }

    static final String CHANNEL = "editions";
    private static final int MAX_TITLES = 3;
    private static final int ID_MORNING = 4101, ID_EVENING = 4102;

    private EditionNotifier() {}

    /** Télécharge digest.json sur le site publié. Lève une exception si le réseau ou la réponse est mauvais. */
    static JSONObject fetchDigest(String site) throws Exception {
        String base = site.endsWith("/") ? site : site + "/";
        HttpURLConnection c = (HttpURLConnection) new URL(base + "data/digest.json?t=" + System.currentTimeMillis()).openConnection();
        try {
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setUseCaches(false);
            c.setRequestProperty("Cache-Control", "no-cache");
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            InputStream in = c.getInputStream();
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            return new JSONObject(out.toString("UTF-8"));
        } finally {
            c.disconnect();
        }
    }

    static boolean allowed(Context c) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        return nm != null && (Build.VERSION.SDK_INT < 24 || nm.areNotificationsEnabled());
    }

    /**
     * Passage d'une alarme. `force` (bouton « tester ») : on affiche la dernière édition quoi qu'il arrive, sans tenir compte
     * ni de l'ancienneté ni des notifications déjà envoyées, et sans exiger que les notifications soient activées dans Réglages.
     */
    static Outcome run(Context c, boolean force) throws Exception {
        EditionStore st = EditionStore.load(c);
        if (!force && (!st.on || st.site.isEmpty())) return Outcome.SKIPPED;
        if (!allowed(c)) return Outcome.SKIPPED;
        JSONObject digest;
        try {
            digest = fetchDigest(st.site);
        } catch (Exception e) {
            if (force) throw e;
            return Outcome.RETRY; // pas de réseau (veille profonde, métro…) : on réessaie dans quelques minutes
        }
        String gen = digest.optString("generatedAt", "");
        long genMs = EditionLogic.parseIso(gen);
        long now = System.currentTimeMillis();
        if (!force) {
            if (genMs < 0 || now - genMs > EditionLogic.MAX_AGE_MS) return EditionLogic.editionPending(now, genMs) ? Outcome.RETRY : Outcome.SKIPPED;
            if (gen.equals(st.lastGenerated)) return EditionLogic.editionPending(now, genMs) ? Outcome.RETRY : Outcome.SKIPPED;
            if (EditionLogic.editionPending(now, genMs)) return Outcome.RETRY; // l'édition du jour n'est pas encore publiée
        }
        List<String> titles = EditionLogic.pickTitles(digest, st.lang, st.sectors, MAX_TITLES);
        if (titles.isEmpty()) titles = EditionLogic.pickTitles(digest, st.lang, null, MAX_TITLES);
        if (titles.isEmpty()) return Outcome.SKIPPED;
        show(c, titles, genMs < 0 ? now : genMs, st.lang);
        if (!force) EditionStore.markNotified(c, gen);
        return Outcome.SENT;
    }

    private static void show(Context c, List<String> titles, long genMs, String lang) {
        boolean fr = !"en".equals(lang);
        boolean morning = EditionLogic.isMorning(genMs, TimeZone.getDefault());
        String title = fr ? (morning ? "Sémaphore · Édition du matin" : "Sémaphore · Édition du soir")
                          : (morning ? "Sémaphore · Morning edition" : "Sémaphore · Evening edition");
        StringBuilder big = new StringBuilder();
        for (int i = 0; i < titles.size(); i++) {
            if (i > 0) big.append('\n');
            big.append("• ").append(titles.get(i));
        }
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        Notification.Builder b;
        if (Build.VERSION.SDK_INT >= 26) {
            if (nm.getNotificationChannel(CHANNEL) == null) {
                NotificationChannel ch = new NotificationChannel(CHANNEL, fr ? "Éditions du matin et du soir" : "Morning and evening editions", NotificationManager.IMPORTANCE_DEFAULT);
                ch.setDescription(fr ? "Les titres de L'essentiel à chaque nouvelle édition" : "Top headlines of each new edition");
                nm.createNotificationChannel(ch);
            }
            b = new Notification.Builder(c, CHANNEL);
        } else {
            b = new Notification.Builder(c);
            b.setPriority(Notification.PRIORITY_DEFAULT);
        }
        Intent open = c.getPackageManager().getLaunchIntentForPackage(c.getPackageName());
        if (open != null) open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = open == null ? null : PendingIntent.getActivity(c, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        int icon = c.getResources().getIdentifier("ic_stat_semaphore", "drawable", c.getPackageName());
        b.setSmallIcon(icon != 0 ? icon : c.getApplicationInfo().icon)
            .setContentTitle(title)
            .setContentText(titles.get(0))
            .setStyle(new Notification.BigTextStyle().bigText(big.toString()))
            .setWhen(genMs)
            .setShowWhen(true)
            .setAutoCancel(true)
            .setCategory(Notification.CATEGORY_RECOMMENDATION);
        if (Build.VERSION.SDK_INT >= 21) b.setColor(0xFF2B2135);
        if (pi != null) b.setContentIntent(pi);
        nm.notify(morning ? ID_MORNING : ID_EVENING, b.build());
    }
}
