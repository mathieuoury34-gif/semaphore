package com.mathieu.semaphore;

import android.Manifest;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** Pont JavaScript ↔ natif des notifications d'édition (window.Capacitor.Plugins.SemaphoreNotifications). */
@CapacitorPlugin(
    name = "SemaphoreNotifications",
    permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) }
)
public class SemaphoreNotificationsPlugin extends Plugin {

    private JSObject status() {
        JSObject r = new JSObject();
        boolean enabled = EditionNotifier.allowed(getContext());
        String perm;
        if (enabled) perm = "granted";
        else if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") == PermissionState.PROMPT) perm = "prompt";
        else perm = "denied";
        r.put("permission", perm);
        PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
        r.put("batteryUnrestricted", Build.VERSION.SDK_INT < 23 || (pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName())));
        r.put("sdk", Build.VERSION.SDK_INT);
        r.put("manufacturer", Build.MANUFACTURER == null ? "" : Build.MANUFACTURER);
        return r;
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        call.resolve(status());
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(status());
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionResult");
    }

    @PermissionCallback
    private void permissionResult(PluginCall call) {
        call.resolve(status());
    }

    /** Enregistre les réglages et programme les prochaines alarmes. Entrée : { on, times: ["07:00","19:00"], lang, sectors: [...], site }. */
    @PluginMethod
    public void schedule(PluginCall call) {
        JSObject d = call.getData();
        StringBuilder times = new StringBuilder();
        org.json.JSONArray arr = d.optJSONArray("times");
        if (arr != null) for (int i = 0; i < arr.length() && i < 2; i++) {
            String t = arr.optString(i, "");
            if (EditionLogic.parseTime(t) == null) continue;
            if (times.length() > 0) times.append(',');
            times.append(t.trim());
        }
        StringBuilder secs = new StringBuilder();
        org.json.JSONArray sa = d.optJSONArray("sectors");
        if (sa != null) for (int i = 0; i < sa.length(); i++) {
            String s = sa.optString(i, "").replace(",", "");
            if (s.isEmpty()) continue;
            if (secs.length() > 0) secs.append(',');
            secs.append(s);
        }
        EditionStore.save(getContext(), d.optBoolean("on", false), times.toString(), d.optString("lang", "fr"), secs.toString(), d.optString("site", ""));
        long[] next = EditionScheduler.scheduleAll(getContext());
        JSObject r = new JSObject();
        JSArray out = new JSArray();
        for (long n : next) out.put(n);
        r.put("next", out);
        call.resolve(r);
    }

    /** Affiche tout de suite la dernière édition (bouton « Envoyer une notification de test »). */
    @PluginMethod
    public void test(final PluginCall call) {
        final android.content.Context c = getContext().getApplicationContext();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (!EditionNotifier.allowed(c)) { call.reject("Les notifications sont bloquées pour Sémaphore sur ce téléphone.", "denied"); return; }
                    EditionNotifier.Outcome o = EditionNotifier.run(c, true);
                    JSObject r = new JSObject();
                    r.put("sent", o == EditionNotifier.Outcome.SENT);
                    call.resolve(r);
                } catch (Exception e) {
                    call.reject(e.getMessage() == null ? "Échec" : e.getMessage(), "network");
                }
            }
        }, "semaphore-test").start();
    }

    /** Ouvre les réglages de notification de l'application dans Android (pour réactiver après un refus). */
    @PluginMethod
    public void openSettings(PluginCall call) {
        Intent i = new Intent(Build.VERSION.SDK_INT >= 26 ? Settings.ACTION_APP_NOTIFICATION_SETTINGS : Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
        if (Build.VERSION.SDK_INT >= 26) i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
        else i.setData(Uri.parse("package:" + getContext().getPackageName()));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Demande à Android de ne pas restreindre l'application en arrière-plan (indispensable pour recevoir l'alarme à l'heure sur Xiaomi, Samsung…). */
    @PluginMethod
    public void openBatterySettings(PluginCall call) {
        android.content.Context c = getContext();
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + c.getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            c.startActivity(i);
        }
        call.resolve();
    }
}
