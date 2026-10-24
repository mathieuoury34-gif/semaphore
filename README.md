# Vigie

Revue de presse personnelle, par secteur, résumée en français. Deux éditions par jour (matin et soir), lisible sur téléphone et ordinateur, 0 € de coût.

- **À la une** : le brief du jour (lecture de 2 minutes), puis 3 points par secteur.
- **Secteurs** : le fil complet de chaque secteur (Politique, International, Europe, Économie, Climat & énergie, Science, IA & numérique, Espace, Aéro & défense, Veille métier), tri « Importants » ou « Récents », recherche.
- **Favoris** : les sujets mis de côté (gardés même quand ils sortent du fil) et des **mots suivis** (« Ariane 6 », « hydrogène »…).
- **Réglages** : secteurs suivis, thème clair/sombre, compte Google (synchronisation), état des sources.

Environ 120 sources en français et en anglais (presse, institutions, recherche, blogs). Un « robot » tourne sur GitHub deux fois par jour : il lit les flux RSS, regroupe les articles qui parlent du même événement, classe par secteur, résume, puis publie le tout sur GitHub Pages.

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

1. Sur <https://github.com>, clique sur **+** (en haut à droite) › **New repository**. Nom : `vigie`. Choisis **Public** (Pages est gratuit pour les dépôts publics ; le code ne contient aucun secret). Ne coche rien d'autre. Clique **Create repository**.
2. Dans le dépôt : **Settings** › **Pages** (menu de gauche). Sous *Build and deployment*, **Source** : choisis **GitHub Actions**.
3. Dans PowerShell, envoie le code :
   ```powershell
   cd C:\Users\mathi\Desktop\Documents\Perso\News
   git init -b main
   git add .
   git commit -m "Vigie"
   git remote add origin https://github.com/mathieuoury34-gif/vigie.git
   git push -u origin main
   ```
4. Onglet **Actions** : le workflow « Publier Vigie » démarre tout seul (3 à 6 minutes : tests, collecte, publication). S'il échoue parce que Pages n'était pas encore activé, clique dessus puis **Re-run all jobs**.
5. L'application est ensuite sur **https://mathieuoury34-gif.github.io/vigie/**.

Ensuite, tout est automatique : une édition vers 6 h 50 et une vers 18 h 50 (heure de Paris en été ; une heure plus tôt en hiver). Pour une édition tout de suite : **Actions** › **Publier Vigie** › **Run workflow**.

> GitHub retarde parfois les tâches planifiées de quelques minutes (voire plus aux heures de pointe). Si le dépôt reste sans aucune activité, GitHub suspend les tâches planifiées après 60 jours : le workflow fait lui-même un commit vide environ tous les 40 jours pour l'éviter.

### Installer comme une application

- **Android (Chrome)** : ouvre l'adresse, menu **⋮** › **Installer l'application**.
- **iPhone (Safari)** : bouton **Partager** › **Sur l'écran d'accueil**.
- **PC (Chrome ou Edge)** : icône d'installation à droite de la barre d'adresse.

---

## 3. Résumés rédigés en français par une IA (gratuit, recommandé)

Sans IA, Vigie affiche des **extraits** des articles ; les sujets en anglais restent en anglais (repérés par une pastille « EN »). Avec une IA gratuite, chaque sujet reçoit un titre français et un résumé de 2-3 phrases, et les puces de « À la une » sont rédigées.

**Option A — Gemini (Google AI Studio), la plus simple et la plus généreuse.**

1. Va sur <https://aistudio.google.com/apikey>, connecte-toi avec ton compte Google, clique **Create API key** et copie la clé.
2. Sur GitHub, dans ton dépôt `vigie` : **Settings** › **Secrets and variables** › **Actions** › **New repository secret**. *Name* : `GEMINI_API_KEY`. *Secret* : colle la clé. **Add secret**.
3. **Actions** › **Publier Vigie** › **Run workflow**.

La clé reste dans GitHub : ne la colle jamais dans un message, un fichier du projet ou une conversation. Les modèles essayés par défaut sont `gemini-3.5-flash-lite`, puis `gemini-3.6-flash`, puis `gemini-3.1-flash-lite`. **Ces noms et les quotas gratuits sont à vérifier** (Google les fait évoluer) : si un modèle n'existe plus, le robot passe au suivant. Pour en imposer un autre : dépôt › **Settings** › **Secrets and variables** › **Actions** › onglet **Variables** › **New repository variable** › `GEMINI_MODEL` = le nom du modèle (plusieurs possibles, séparés par des virgules).

**Option B — GitHub Models** : rien à faire. Si aucune clé Gemini n'est définie, le robot essaie les modèles gratuits de GitHub avec le jeton du workflow (permission `models: read` déjà prévue). Le palier gratuit est très limité (environ 15 requêtes par minute et 150 par jour, **à vérifier**) : il suffit pour une partie des sujets seulement.

Dans tous les cas, si l'IA est indisponible ou son quota épuisé, l'édition est publiée quand même avec des extraits. Réglages › **Résumés** indique le mode de la dernière édition. Pour couper toute IA : variable `VIGIE_NO_LLM` = `1`.

---

## 4. Synchroniser les favoris (Google / Firebase, gratuit)

Les favoris, les articles lus et les réglages restent dans le navigateur de chaque appareil. Pour les retrouver partout : **Réglages › Compte et synchronisation › Continuer avec Google**. Les données de deux appareils sont **fusionnées** (rien n'est écrasé).

Par défaut, Vigie utilise le **projet Firebase de PEAnalyze** (même compte Google, même domaine `github.io`) : il n'y a rien à configurer. Les données de Vigie sont rangées à part (`users/<ton id>/vigie/main`) et ne touchent pas à celles de PEAnalyze. Tu te connectes une fois dans chaque application.

Si le bouton Google affiche une erreur « unauthorized-domain » : [console Firebase](https://console.firebase.google.com) › projet `peanalyze` › **Authentication** › **Settings** › **Authorized domains** › **Add domain** › `mathieuoury34-gif.github.io`.

**Projet Firebase séparé (facultatif)**

1. Console Firebase › **Add project** › nom `vigie` › désactive Google Analytics › **Create project**.
2. **Build** › **Authentication** › **Get started** › **Google** › active, choisis ton adresse e-mail › **Save**. Puis **Settings** › **Authorized domains** : vérifie la présence de `mathieuoury34-gif.github.io`.
3. **Build** › **Firestore Database** › **Create database** › emplacement `eur3` (Europe) › mode production › **Enable**. Onglet **Rules** : colle le contenu du fichier `firestore.rules` › **Publish**.
4. Engrenage ⚙ › **Project settings** › *Your apps* › icône web **</>** › nom `vigie` › **Register app**. Copie le bloc `firebaseConfig` dans `src/data/firebase-config.ts` (ce ne sont pas des secrets), puis `git add . && git commit -m "Firebase" && git push`.

> Si tu gardes le projet de PEAnalyze, **ne publie pas** `firestore.rules` : ses règles contiennent aussi la liste de suivi des ETF et celles de PEAnalyze suffisent.

Pour rester 100 % local : vide les valeurs de `src/data/firebase-config.ts`.

---

## 5. Personnaliser

Tout se règle dans `data-src/` (puis `git push`, ou « Run workflow » pour voir l'effet) :

| Fichier | Contenu |
|---|---|
| `sectors.json` | les secteurs (nom, icône, nombre de résumés par édition) |
| `sources.json` | les sources : `url` du flux, `sectors`, `lang`, `weight` (poids dans le classement), `enabled: false` pour en couper une |
| `rules.json` | les mots-clés qui rattachent un article à un secteur (`strong` : terme décisif ; `any` : indice) |

- **Tester une source** : `node scripts/collect/probe.mjs id-de-la-source` (sans argument : toutes).
- **Ajouter un secteur** (ex. « Emploi ») : une entrée dans `sectors.json`, des sources et des règles dans les deux autres fichiers, et une couleur `--sector-<id>` (clair et sombre) dans `src/styles/tokens.css` ; `python3 scripts/tools/contrast.py` vérifie le contraste.
- **Changer la palette** : uniquement `src/styles/tokens.css`.

---

## 6. À savoir

- Le robot ne lit que ce que les sources publient dans leurs flux RSS (titre, chapeau) et, pour les sujets retenus, le texte accessible de l'article. Les articles payants donnent peu de texte : le résumé est alors plus court, voire absent.
- Quelques sources peuvent refuser les serveurs de GitHub ou être en panne : **Réglages › Sources** liste celles qui ont échoué à la dernière édition. L'édition est publiée quand même.
- Les sujets sont conservés 7 jours. Un favori garde sa propre copie (titre, résumé, lien).
- Les résumés automatiques peuvent se tromper : le lien vers l'article d'origine est toujours à portée.
- Vigie est pour un usage personnel ; les titres et extraits appartiennent à leurs éditeurs.

## 7. Dépannage

| Symptôme | Que faire |
|---|---|
| Le workflow est rouge | Onglet **Actions** › clique l'exécution › l'étape en échec. Pages non activé : refais l'étape 2 puis **Re-run all jobs**. |
| « Pas de nouvelle édition depuis… » | Le robot n'a pas publié depuis longtemps : **Actions** › **Run workflow**, et regarde si l'exécution précédente a échoué. |
| L'application affiche une ancienne version | **Réglages › Données › Recharger l'application**. |
| Tout est en anglais ou en extraits | Aucune clé IA, ou quota épuisé : voir la section 3. |
| Le bouton Google ne fait rien sur téléphone | Autorise les fenêtres surgissantes pour le site, ou ouvre Vigie dans Chrome plutôt que dans une application intégrée. |

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
