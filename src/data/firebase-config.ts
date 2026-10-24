// Configuration Firebase (offre gratuite Spark, sans carte bancaire) pour la synchronisation des favoris.
// Ces valeurs ne sont pas secrètes : l'accès aux données est protégé par les règles Firestore (firestore.rules),
// qui réservent les données de chaque compte Google à ce seul compte.
//
// Par défaut : le projet Firebase de PEAnalyze (même compte Google, même domaine github.io, rien à configurer).
// Les données de Vigie sont rangées à part (users/{uid}/vigie/main) et ne touchent pas à celles de PEAnalyze.
// Pour un projet séparé : remplacer ces valeurs (voir README, section « Synchronisation »), ou les vider pour rester 100 % local.
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCQ16BJF7JckaXpY8D5ZSULlFAfnG9Qh8k',
  authDomain: 'peanalyze.firebaseapp.com',
  projectId: 'peanalyze',
  storageBucket: 'peanalyze.firebasestorage.app',
  messagingSenderId: '135432168590',
  appId: '1:135432168590:web:d92d168498da9ba83215df',
};
