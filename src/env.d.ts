declare module '*.css';

/** Identifiant du code de l'application (empreinte des sources), défini à la construction : sert à signaler une nouvelle version à l'APK. */
declare const __BUILD_ID__: string;
/** Adresse publique du site (GitHub Pages), définie pour l'APK qui embarque l'application ; vide sinon. */
declare const __SITE_URL__: string;
