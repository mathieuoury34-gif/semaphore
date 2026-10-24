// Configuration Firebase (offre gratuite Spark, sans carte bancaire) pour la synchronisation des favoris.
// Ces valeurs ne sont pas secrètes : l'accès aux données est protégé par les règles Firestore (firestore.rules),
// qui réservent les données de chaque compte Google à ce seul compte.
//
// Projet Firebase DÉDIÉ à Sémaphore (« semaphore-c806a »), distinct de celui de PEAnalyze : aucun lien entre les deux.
// Les données sont rangées sous users/{uid}/semaphore/main.
// Pour rester 100 % local : vider ces valeurs (voir README, section « Synchronisation »).
export const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyClHeGu7cW4fId-nTToIHVZrXOGSjJ_Bhs',
  authDomain: 'semaphore-c806a.firebaseapp.com',
  projectId: 'semaphore-c806a',
  storageBucket: 'semaphore-c806a.firebasestorage.app',
  messagingSenderId: '418931475061',
  appId: '1:418931475061:web:bce57f202939cd515aee3c',
};
