// Adapte le projet Android généré par `npx cap add android` (dossier android/, jamais versionné) :
//  - lien semaphore://auth (retour de la connexion Google ouverte dans le navigateur du téléphone) ;
//  - keystore de debug versionné : les mises à jour s'installent par-dessus l'APK précédent ;
//  - icônes et écran de lancement de Sémaphore (fond #2B2135 + pictogramme) ;
//  - notifications d'édition : plugin Capacitor (plugin/java), récepteur d'alarmes, permissions, pictogramme de la barre d'état.
// Le script est idempotent : le relancer ne duplique rien.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const A = 'android';
const APP = join(A, 'app');
const read = (p) => readFileSync(p, 'utf8');
const write = (p, s) => writeFileSync(p, s);
const must = (cond, msg) => { if (!cond) { console.error('patch-android : ' + msg); process.exit(1); } };
must(existsSync(APP), 'dossier android/app introuvable (lancer « npx cap add android » avant)');

// ---------------------------------------------------------------- manifeste : lien semaphore://auth
const manifestPath = join(APP, 'src/main/AndroidManifest.xml');
let m = read(manifestPath);
if (!m.includes('android:scheme="semaphore"')) {
  const filter = `
            <intent-filter android:autoVerify="false">
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="semaphore" android:host="auth" />
            </intent-filter>
`;
  const i = m.indexOf('</activity>');
  must(i > 0, 'balise </activity> introuvable dans le manifeste');
  m = m.slice(0, i) + filter + '        ' + m.slice(i);
}

// notifications d'édition : permissions + récepteur (alarmes, redémarrage du téléphone, mise à jour de l'application)
const perms = ['android.permission.POST_NOTIFICATIONS', 'android.permission.RECEIVE_BOOT_COMPLETED', 'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS'];
for (const perm of perms) {
  if (m.includes(perm)) continue;
  const i = m.lastIndexOf('</manifest>');
  must(i > 0, 'balise </manifest> introuvable dans le manifeste');
  m = m.slice(0, i) + `    <uses-permission android:name="${perm}" />\n` + m.slice(i);
}
if (!m.includes('.EditionReceiver')) {
  const receiver = `
        <receiver android:name=".EditionReceiver" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
                <action android:name="android.intent.action.TIMEZONE_CHANGED" />
                <action android:name="android.intent.action.TIME_SET" />
            </intent-filter>
        </receiver>
`;
  const i = m.indexOf('</application>');
  must(i > 0, 'balise </application> introuvable dans le manifeste');
  m = m.slice(0, i) + receiver + '    ' + m.slice(i);
}
write(manifestPath, m);

// ---------------------------------------------------------------- signature : keystore de debug versionné
const appGradle = join(APP, 'build.gradle');
let g = read(appGradle);
if (!g.includes('semaphore-debug.keystore')) {
  g = g.replace(/android\s*\{/, `android {
    signingConfigs {
        debug {
            storeFile file('../../keystore/semaphore-debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`);
  must(g.includes('semaphore-debug.keystore'), 'bloc android { introuvable dans app/build.gradle');
}
write(appGradle, g);

// ---------------------------------------------------------------- MainActivity : écran de lancement natif
write(join(APP, 'src/main/java/com/mathieu/semaphore/MainActivity.java'), `package com.mathieu.semaphore;

import android.os.Bundle;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        SplashScreen.installSplashScreen(this);
        registerPlugin(SemaphoreNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`);

// ---------------------------------------------------------------- notifications : sources Java du plugin et pictogramme
const javaDir = join(APP, 'src/main/java/com/mathieu/semaphore');
mkdirSync(javaDir, { recursive: true });
const pluginSrc = 'plugin/java/com/mathieu/semaphore';
must(existsSync(pluginSrc), 'sources du plugin de notifications introuvables (' + pluginSrc + ')');
for (const f of readdirSync(pluginSrc)) cpSync(join(pluginSrc, f), join(javaDir, f));
cpSync('plugin/res', join(APP, 'src/main/res'), { recursive: true });

// ---------------------------------------------------------------- icônes
cpSync('res', join(APP, 'src/main/res'), { recursive: true });
mkdirSync(join(APP, 'src/main/res/values'), { recursive: true });
write(join(APP, 'src/main/res/values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#2B2135</color>\n</resources>\n`);

// ---------------------------------------------------------------- écran de lancement natif
// Fond #2B2135 + pictogramme au lieu de l'écran blanc du modèle ; la page web (même fond) prend ensuite le relais sans flash.
const stylesPath = join(APP, 'src/main/res/values/styles.xml');
let st = read(stylesPath);
const launch = `<style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">#2B2135</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
    </style>`;
must(/<style name="AppTheme.NoActionBarLaunch"/.test(st), 'style AppTheme.NoActionBarLaunch introuvable dans styles.xml');
st = st.replace(/<style name="AppTheme\.NoActionBarLaunch"[\s\S]*?<\/style>/, launch);
if (!/AppTheme\.NoActionBar"[^>]*>\s*<item name="android:windowBackground">/.test(st)) {
  st = st.replace(/(<style name="AppTheme\.NoActionBar"[^>]*>)/, '$1\n        <item name="android:windowBackground">#2B2135</item>');
}
write(stylesPath, st);

console.log('Projet Android adapté pour Sémaphore.');
