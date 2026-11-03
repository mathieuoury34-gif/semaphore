package com.mathieu.semaphore;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Réveil de l'alarme (notification d'édition), et reprogrammation après redémarrage, mise à jour de l'application ou changement d'heure. */
public class EditionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(final Context context, Intent intent) {
        final String action = intent == null ? null : intent.getAction();
        if (action == null) return;
        if (EditionScheduler.ACTION_EDITION.equals(action)) {
            final int attempt = intent.getIntExtra(EditionScheduler.EXTRA_ATTEMPT, 0);
            final PendingResult pending = goAsync();
            final Context app = context.getApplicationContext();
            new Thread(new Runnable() {
                @Override
                public void run() {
                    try {
                        // L'alarme du jour est passée : programmer d'abord celle du lendemain (la nouvelle tentative, elle, ne reprogramme rien)...
                        if (attempt == 0) EditionScheduler.scheduleAll(app);
                        EditionNotifier.Outcome o = EditionNotifier.run(app, false);
                        // ...puis, au besoin, une nouvelle tentative (scheduleAll annule les tentatives en cours, d'où cet ordre).
                        if (o == EditionNotifier.Outcome.RETRY && attempt < EditionScheduler.MAX_ATTEMPTS) EditionScheduler.scheduleRetry(app, attempt + 1);
                    } catch (Throwable ignored) {
                        // une notification manquée ne doit jamais faire planter l'application
                    } finally {
                        pending.finish();
                    }
                }
            }, "semaphore-edition").start();
        } else {
            // BOOT_COMPLETED, MY_PACKAGE_REPLACED, TIMEZONE_CHANGED, TIME_SET
            EditionScheduler.scheduleAll(context.getApplicationContext());
        }
    }
}
