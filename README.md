# Sémaphore

Revue de presse personnelle, par secteur, entièrement en français **ou** entièrement en anglais (au choix). Deux éditions par jour (matin et soir), lisible sur téléphone et ordinateur, 0 € de coût.

- **À la une** : le brief du jour (lecture de 2 minutes), puis 3 points par secteur.
- **Secteurs** : le fil complet de chaque secteur (Politique, International, Économie, Climat & Énergie, **Sport**, IA & Numérique, Science, Espace, Aéro & Défense, Veille Métier, **Emploi**), tri « Importants » ou « Récents », recherche. *Sport* couvre le football, le rugby, le tennis et les grands événements, avec une attention particulière au triathlon et au parkour (flux Google Actualités, faute de flux dédiés). *Emploi* ne contient que des offres d'emploi et de stage (le reste de l'actualité spatiale est dans *Espace*).
- **Favoris** : les sujets mis de côté (gardés même quand ils sortent du fil, dans les deux langues) et des **mots suivis** (« Ariane 6 », « hydrogène »…).
- **Réglages** (dans cet ordre) : Compte & synchronisation, Thème, **Langue**, Secteurs suivis, **Sources** (tous les journaux suivis, secteur par secteur, avec une case à cocher pour chacun), Résumé, Données.

Plus de 220 sources en français et en anglais (presse, institutions, recherche, blogs, offres d'emploi). Dans les secteurs où l'on peut être trompé par un seul angle (Politique, International, Économie, Climat & Énergie), les sources couvrent **toutes les sensibilités**, de la gauche à la droite, plus des vérificateurs de faits ; une pastille indicative (Gauche, Centre gauche, Centre, Centre droit, Droite) accompagne chaque journal dans Réglages › Sources et sur la fiche d'un sujet, avec la répartition des sensibilités qui ont couvert ce sujet. Ces pastilles sont des repères, pas des verdicts. Un « robot » tourne sur GitHub deux fois par jour : il lit les flux RSS et les services d'offres d'emploi, regroupe les articles qui parlent du même événement, classe par secteur, résume, puis publie le tout sur GitHub Pages.

---

## 1. Essayer sur ton PC (facultatif)

Il faut Node 22 ou plus (`node -v` pour vérifier).

```powershell
cd C:\Users\mathi\Desktop\Documents\Perso\News
npm install
npm run dev
```

Ouvre <http://127.0.0.1:5173>. Les données affichées sont celles de `public/data/` (un exemple réel est fourni). Pour récupérer l'actualité du moment :

```powershell
npm run collect
```

Cela prend une à deux minutes et écrase `public/data/*.json`. Sans clé d'IA, les résumés sont des extraits des articles.

Autres commandes : `npm test` (tests), `npm run typecheck`, `npm run build` (version finale dans `dist/`).

---

## 2. Mettre en ligne (GitHub Pages, gratuit)

L'ordre compte : active Pages **avant** d'envoyer le code.

1. Sur <https://github.com>, clique sur **+** (en haut à droite) › **New repository**. Nom : `semaphore`. Choisis **Public** (Pages est gratuit pour les dépôts publics ; le code ne contient aucun secret). Ne coche rien d'autre. Clique **Create repository**.
2. Dans le dépôt : **Settings** › **Pages** (menu de gauche). Sous *Build and deployment*, **Source** : choisis **GitHub Actions**.
3. Dans PowerShell, envoie le code :
   ```powershell
   cd C:\Users\mathi\Desktop\Documents\Perso\News
   git init -b main
   git add .
   git commit -m "Sémaphore"
   git remote add origin https://github.com/mathieuoury34-gif/semaphore.git
   git push -u origin main
   ```
4. Onglet **Actions** : le workflow « Publier Sémaphore » démarre tout seul (3 à 6 minutes : tests, collecte, publication). S'il échoue parce que Pages n'était pas encore activé, clique dessus puis **Re-run all jobs**.
5. L'application est ensuite sur **https://mathieuoury34-gif.github.io/semaphore/**.

Ensuite, tout est automatique : une édition vers 6 h 50 et une vers 18 h 50 (heure de Paris en été ; une heure plus tôt en hiver). Pour une édition tout de suite : **Actions** › **Publier Sémaphore** › **Run workflow**.

> GitHub retarde parfois les tâches planifiées de quelques minutes (voire plus aux heures de pointe). Si le dépôt reste sans aucune activité, GitHub suspend les tâches planifiées après 60 jours : le workflow fait lui-même un commit vide environ tous les 40 jours pour l'éviter.

### Installer comme une application

- **Android (Chrome)** : ouvre l'adresse, menu **⋮** › **Installer l'application**.
- **iPhone (Safari)** : bouton **Partager** › **Sur l'écran d'accueil**.
- **PC (Chrome ou Edge)** : icône d'installation à droite de la barre d'adresse.
- **Android, vraie application (APK)** : la tâche « Publier Vigie » construit à chaque envoi de code une application Android (dossier `android-shell/`, Capacitor). Lien de téléchargement stable : `https://github.com/<compte>/<dépôt>/releases/download/apk/semaphore.apk` (ouvrir ce lien dans Chrome sur le téléphone, autoriser l'installation depuis Chrome, installer). **L'APK embarque l'application** : elle s'ouvre donc hors connexion, sans dépendre d'un service worker (absent des vues web Android d'application). Les actualités sont lues sur le site publié, et la dernière édition reçue est gardée sur le téléphone. Quand l'interface change (nouveau design, nouvel écran), l'application affiche « Une nouvelle version est disponible » : toucher **Télécharger**, puis installer par-dessus (les favoris sont conservés). Les mises à jour du contenu (éditions du robot) n'exigent rien. La connexion Google s'ouvre dans le navigateur du téléphone (Google refuse les vues intégrées) puis revient dans l'application par le lien `semaphore://auth`. L'APK est signée avec une clé de debug versionnée (`android-shell/keystore/`), sans valeur de sécurité : elle sert seulement à ce qu'une nouvelle version s'installe par-dessus l'ancienne. Les icônes se régénèrent avec `python3 scripts/tools/android-icons.py`.

---

## 3. Langue et résumés par une IA (gratuit, recommandé)

**Une seule langue à la fois.** Réglages › **Langue** : Français ou English. Tout ce qui s'affiche (boutons, titres, résumés, brief) est alors dans cette langue, sans mélange. Le choix est mémorisé et suit ton compte (synchronisation).

**Ce que l'IA change.** Sans clé d'IA, Sémaphore ne peut rien traduire : il affiche des **extraits** des articles et, en mode français, uniquement les sujets publiés par des journaux français (en mode anglais, uniquement ceux publiés par des journaux anglophones). La liste est donc plus courte. Avec une IA gratuite, chaque sujet reçoit un titre et un résumé de 2-3 phrases **dans les deux langues** en un seul appel, les sujets étrangers sont traduits (pastille « Traduit »), un sujet couvert par un journal français et un journal anglais est fusionné, et les puces de « À la une » sont rédigées.

**Option A — Gemini (Google AI Studio), la plus simple et la plus généreuse.**

1. Va sur <https://aistudio.google.com/apikey>, connecte-toi avec ton compte Google, clique **Create API key** et copie la clé.
2. Sur GitHub, dans ton dépôt `semaphore` : **Settings** › **Secrets and variables** › **Actions** › **New repository secret**. *Name* : `GEMINI_API_KEY`. *Secret* : colle la clé. **Add secret**.
3. **Actions** › **Publier Sémaphore** › **Run workflow**.

La clé reste dans GitHub : ne la colle jamais dans un message, un fichier du projet ou une conversation. Les modèles essayés par défaut sont `gemini-3.5-flash-lite`, puis `gemini-3.6-flash`, puis `gemini-3.1-flash-lite`. **Ces noms et les quotas gratuits sont à vérifier** (Google les fait évoluer) : si un modèle n'existe plus, le robot passe au suivant. Pour en imposer un autre : dépôt › **Settings** › **Secrets and variables** › **Actions** › onglet **Variables** › **New repository variable** › `GEMINI_MODEL` = le nom du modèle (plusieurs possibles, séparés par des virgules).

**Option B — GitHub Models** : rien à faire. Si aucune clé Gemini n'est définie, le robot essaie les modèles gratuits de GitHub avec le jeton du workflow (permission `models: read` déjà prévue). Le palier gratuit est très limité (environ 15 requêtes par minute et 150 par jour, **à vérifier**) : il suffit pour une partie des sujets seulement.

Dans tous les cas, si l'IA est indisponible ou son quota épuisé, l'édition est publiée quand même avec des extraits. Réglages › **Résumé** indique le mode de la dernière édition. Pour couper toute IA : variable `VIGIE_NO_LLM` = `1`.

---

## 4. Synchroniser les favoris (Google / Firebase, gratuit)

Les favoris, les articles lus et les réglages restent dans le navigateur de chaque appareil. Pour les retrouver partout : **Réglages › Compte et synchronisation › Continuer avec Google**. Les données de deux appareils sont **fusionnées** (rien n'est écrasé).

Sémaphore a son **propre projet Firebase**, `semaphore-c806a`, entièrement distinct de celui de PEAnalyze (comptes, base de données et règles séparés). Rien à configurer : tu te connectes avec Google dans Sémaphore, indépendamment des autres applications. Les données sont rangées sous `users/<ton id>/semaphore/main`.

Ce qui est en place dans la console Firebase : *Authentication* › Google activé ; domaine autorisé `mathieuoury34-gif.github.io` ; *Firestore* en mode production, emplacement `eur3` (Europe), règles = contenu de `firestore.rules` (chaque compte n'accède qu'à ses propres données).

Si le bouton Google affiche une erreur « unauthorized-domain » : [console Firebase](https://console.firebase.google.com) › projet `semaphore` › **Authentication** › **Settings** › **Authorized domains** › **Add domain** › `mathieuoury34-gif.github.io`.

> Pour recréer le projet (autre compte Google, par exemple) : console Firebase › **Add project** › activer **Authentication › Google**, créer **Firestore** (`eur3`, mode production), publier `firestore.rules`, enregistrer une application web et copier son `firebaseConfig` dans `src/data/firebase-config.ts` (ce ne sont pas des secrets).

Pour rester 100 % local : vide les valeurs de `src/data/firebase-config.ts`.

---

## 5. Personnaliser

Tout se règle dans `data-src/` (puis `git push`, ou « Run workflow » pour voir l'effet) :

| Fichier | Contenu |
|---|---|
| `sectors.json` | les secteurs (nom français et `en` anglais, icône, nombre de résumés par édition, `opinion: true` pour afficher les sensibilités) |
| `sources.json` | les sources : `url` du flux, `sectors`, `lang`, `kind`, `weight` (poids dans le classement), `lean` (sensibilité indicative : `left`, `center-left`, `center`, `center-right`, `right`), `enabled: false` pour en couper une |
| `rules.json` | les mots-clés qui rattachent un article à un secteur (`strong` : terme décisif ; `any` : indice) et les règles de tri `refine` (sport, politique étrangère) |

- **Tester une source** : `node scripts/collect/probe.mjs id-de-la-source` (sans argument : toutes).
- **Ajouter une entreprise dans Emploi** : une ligne dans `sources.json` avec `"sectors": ["emploi"]`, `"type"` (`greenhouse`, `ashby`, `lever`, `personio`, `recruitee` ou `workday`), `"board"` (l'identifiant de l'entreprise dans l'adresse de sa page « Carrières », ex. `isaraerospace` ; pour Workday : `locataire/serveur/site`, ex. `ag/wd3/Airbus`, avec `"facets"` ou `"searchText"` pour ne garder que la bonne filiale) et `"company"`. Ajouter `"france": true` si l'entreprise a au moins un site en France : ses offres passent devant, et celles situées en France encore plus. Les mots qui décident si une offre est retenue (ingénieur, simulation, stage…) sont dans `rules.json` › `jobs` (et, pour une entreprise précise, `include` / `exclude` / `locations`).
- **Ajouter un secteur** (ex. « Santé ») : une entrée dans `sectors.json`, des sources et des règles dans les deux autres fichiers, et une couleur `--sector-<id>` (clair et sombre) dans `src/styles/tokens.css` ; `python3 scripts/tools/design/check.py` vérifie le contraste (palette à déclarer dans `scripts/tools/design/palette.py`).
- **Changer la palette** : uniquement `src/styles/tokens.css`.

---

## 6. À savoir

- Le robot ne lit que ce que les sources publient dans leurs flux RSS (titre, chapeau) et, pour les sujets retenus, le texte accessible de l'article. Les articles payants donnent peu de texte : le résumé est alors plus court, voire absent.
- Quelques sources peuvent refuser les serveurs de GitHub ou être en panne : **Réglages › Sources** signale par un point orange celles qui ont échoué à la dernière édition. L'édition est publiée quand même.
- Les sujets sont conservés 7 jours (30 jours pour les offres d'emploi). Un favori garde sa propre copie (titre, résumé, lien).
- Les résumés automatiques peuvent se tromper : le lien vers l'article d'origine est toujours à portée.
- **Hors connexion** : l'application (installée depuis Chrome ou en APK) s'ouvre sans réseau et affiche la dernière édition reçue, avec le bandeau « Hors connexion – données du … » ; les liens vers les articles, eux, demandent du réseau. Il faut l'avoir ouverte une fois avec du réseau. Dans Chrome, un service worker (`src/sw.template.js`) garde l'application et les données ; dans l'APK, l'application est embarquée et la page garde elle-même les données. Les polices sont hébergées avec l'application (`src/fonts/`). Test automatique, avant de publier : `npm run build` puis `python3 scripts/tools/pwa-offline-check.py dist <dépôt> "à la une"` (arrête réellement le serveur après le premier chargement).
- **Classement par secteur** : chaque source a un ou plusieurs secteurs ; les mots-clés de `rules.json` peuvent en ajouter (3 au plus). La section `refine` fixe deux règles de tri : un sujet sportif (titre nettement sportif, ou rubrique sport d'un journal généraliste) va en **Sport**, qui remplace Politique, International, Économie et Climat ; un sujet de **Politique** dont le titre parle d'un pays ou d'un dirigeant étranger, sans repère français, va en **International**. Les sources de presse sportive sont exclusives (`"exclusive": true`). Changer `refine.version` fait reclasser, à l'édition suivante, tous les sujets déjà publiés. Le secteur Europe a été supprimé (Union européenne et Allemagne sont dans International).
- Sémaphore est pour un usage personnel ; les titres et extraits appartiennent à leurs éditeurs.

## 7. Dépannage

| Symptôme | Que faire |
|---|---|
| Le workflow est rouge | Onglet **Actions** › clique l'exécution › l'étape en échec. Pages non activé : refais l'étape 2 puis **Re-run all jobs**. |
| « Pas de nouvelle édition depuis… » | Le robot n'a pas publié depuis longtemps : **Actions** › **Run workflow**, et regarde si l'exécution précédente a échoué. |
| L'application affiche une ancienne version | **Réglages › Données › Recharger l'application**. |
| Peu de sujets, ou seulement des extraits | Aucune clé IA, ou quota épuisé : sans IA, seuls les sujets publiés dans la langue choisie s'affichent, en extraits. Voir la section 3. |
| Un journal ne m'intéresse pas dans un secteur | Réglages › Sources › le secteur › décoche le journal (il reste visible dans les autres secteurs). |
| Le bouton Google ne fait rien sur téléphone | Autorise les fenêtres surgissantes pour le site, ou ouvre Sémaphore dans Chrome plutôt que dans une application intégrée. |

## Structure

```
data-src/         secteurs, sources, règles (à modifier)
scripts/collect/  le robot (lecture des flux, regroupement, classement, résumés)
scripts/tools/    outils : contraste des couleurs, icônes, contrôle visuel
src/              l'application (React + TypeScript, build esbuild)
public/data/      données publiées par le robot (régénérées à chaque édition)
tests/            tests du robot et de la logique de l'application
.github/workflows/deploy.yml   les deux éditions quotidiennes + publication
```
