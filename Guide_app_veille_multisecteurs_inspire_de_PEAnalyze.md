# Brief de construction : application de veille multi-secteurs, même ergonomie que PEAnalyze

> **À l'attention de l'assistant IA (Claude) qui reçoit ce fichier.**
> Mathieu veut créer une application qui donne **une vue globale de l'actualité et des informations de tous les secteurs** (politique, international, écologie, spatial, recherche, économie, etc.).
> Il a déjà construit et mis en production **PEAnalyze** (suivi de PEA/ETF). Il veut pour cette nouvelle app **exactement la même ergonomie et la même typographie**, mais **une colorimétrie différente**. Ce document transmet toute l'expérience acquise sur PEAnalyze : ce qu'il faut reprendre à l'identique, ce qu'il faut adapter à un produit d'**information** (et non de calcul financier), la charte de couleurs proposée, l'architecture technique et les pièges.
> Réponds en français. Mathieu est ingénieur (mécanique des fluides), pas développeur de métier : explique les étapes manuelles (console Firebase, secrets GitHub) clic par clic. **Coût visé : 0 €**, pour construire, héberger et utiliser.
> Les points marqués **« à vérifier »** sont des faits externes (API, quotas, licences, endpoints) que tu dois confirmer sur la documentation officielle avant de t'y engager : ils évoluent.

---

## 0. Démarrage recommandé : s'appuyer sur le code réel de PEAnalyze

Le dépôt de PEAnalyze est **public** : https://github.com/mathieuoury34-gif/peanalyze (site : https://mathieuoury34-gif.github.io/peanalyze/). C'est la meilleure référence possible pour « la même ergonomie » : lis le code plutôt que de le réinventer.

Fichiers à lire en priorité, et à **copier comme base de départ** dans un nouveau dépôt (puis renommer, retirer le métier boursier, changer les tokens de couleur) :

| Fichier du dépôt PEAnalyze | Ce que tu y trouves | À faire |
|---|---|---|
| `src/styles/tokens.css` | Tous les tokens (typo, couleurs, rayons, ombres, espacements, composants), clair + sombre | **Garder la structure et la typo, remplacer les couleurs** (§3) |
| `src/styles/app.css` | Layout (`.app-main`, `.tabbar`, `.fab`, `.card`, `.seg`, `.btn`, `.sheet`, grille desktop `.dgrid`…) | Garder tel quel |
| `src/ui/kit.tsx` | AppHeader, SubNav/Segmented, ChipGroup, TabBar, Fab, Sheet, Toast, Switch, Empty, DatePicker, Hero… | Garder, adapter les libellés |
| `src/ui/charts.tsx` | Sparkline, courbes, aires, donuts, barres (SVG maison) | Garder ceux utiles aux indicateurs |
| `src/ui/icons.tsx` | Jeu d'icônes SVG en ligne | Compléter (icônes de secteurs) |
| `src/ui/router.ts` | Routeur par hash + feuilles modales | Garder |
| `src/data/store.ts` | Store global + persistance locale | Garder, changer le modèle |
| `src/data/sync.ts` | Connexion Google + synchro Firestore | Garder, **nouveau projet Firebase** |
| `src/i18n.ts`, `i18n-en.ts`, `scripts/i18n/keys.mjs` | i18n par texte-clé | Garder |
| `scripts/build.mjs`, `src/sw.template.js` | Build esbuild + service worker versionné | Garder |
| `.github/workflows/deploy.yml` | Robots planifiés + test + build + déploiement | Adapter (§7) |
| `firestore.rules` | Règles de sécurité | Adapter (§6) |
| `tests/` | Exemples de tests purs de domaine | S'en inspirer |
| `docs/` + (documents du projet) `HANDOFF_design.md` | Méthode de passation design → code | S'en inspirer (§11) |

⚠️ **Ne pas recopier** : `src/data/firebase-config.ts` (c'est la config du Firebase de PEAnalyze : crée-en un nouveau pour cette app), les données, le domaine boursier (`src/domain/*`), les textes, le nom.
Un **dépôt « modèle » épuré** (coquille vide avec le kit, les tokens, la synchro, le build et la CI) est la meilleure première livraison : Mathieu peut demander à l'assistant de PEAnalyze de le préparer.

---

## 1. Concept produit et principes

**Promesse** : ouvrir l'app et, en 2 minutes, savoir ce qui compte dans le monde, par secteur, sans bruit.

Principes directeurs (hérités des leçons de PEAnalyze) :
1. **Lisible en 10 secondes** : une « une » courte (le briefing), puis on descend dans le détail seulement si on veut.
2. **Local d'abord, 0 € , sans serveur** : l'app lit des **fichiers JSON statiques** produits par un robot GitHub ; aucune API tierce n'est appelée depuis le navigateur.
3. **Le robot collecte, l'app affiche** : tout le « travail lourd » (récupérer, nettoyer, dédoublonner, classer) se fait côté robot ; l'app ne fait qu'afficher et personnaliser.
4. **On ne republie jamais un article** : titre, source, date, court extrait **fournis par le flux lui-même**, et un lien vers l'original (§8.1, droit d'auteur et droits voisins).
5. **Transparence sur les sources** : chaque item affiche sa source, sa date, sa langue ; un écran « Santé des sources » montre ce qui marche ; jamais d'« IA magique » opaque.
6. **Anti-surcharge** : quotas par secteur dans le briefing, marquage lu/non lu, regroupement des articles qui parlent de la même chose.
7. **Données personnelles minimales** : secteurs suivis, sources masquées, favoris, lu/non lu. Rien d'autre. Synchronisation entre appareils via Firebase, optionnelle.
8. **Pas de publicité, pas de suivi, pas de cookie tiers.**

### 1.1 Secteurs (liste de départ, extensible)
Politique · International · Écologie / climat · Spatial · Recherche / science · Économie · Santé · Numérique / IA · Énergie · Société. (D'autres peuvent s'ajouter : culture, défense, éducation…) Chaque secteur a **un identifiant stable**, un nom, une icône, une **couleur fixe** (§3.3) et ses sources.

### 1.2 Écrans proposés (à valider avec Mathieu avant de coder)
Même squelette que PEAnalyze : **4 onglets en barre du bas**, chacun avec une **sous-navigation en contrôle segmenté**, des **feuilles modales** (bottom-sheets) pour les actions, un **FAB** pour l'action principale.

| Onglet | Rôle | Sous-onglets possibles |
|---|---|---|
| **À la une** | Briefing du jour : « Hero » (date, nombre de nouveautés), 3 à 5 items clés par secteur suivi, bandeau « événements du monde » | Aujourd'hui · Cette semaine |
| **Secteurs** | Grille de tuiles (une par secteur, couleur + compteur de nouveautés) → flux filtrable d'un secteur ; recherche plein texte locale | Tous · Mes secteurs |
| **Indicateurs** | Tableau de bord de chiffres clés avec sparklines et courbes (CO₂, température mondiale, taux directeurs, séismes, lancements spatiaux, publications…) — c'est la partie « vue globale » chiffrée (§9) | Économie · Climat · Espace · Science |
| **Ma veille** | Favoris à lire plus tard, historique, mots-clés suivis, sources (activer/masquer), paramètres, compte | Favoris · Mots-clés · Sources |

Écrans de détail : **fiche item** en feuille (titre, source, date, extrait, bouton « Lire sur le site », favori, partager, « autres sources sur le même sujet »), **fiche indicateur** (courbe plein écran, périodes, définition, source de la donnée), **fiche secteur**.
FAB : « Ajouter un mot-clé / une source » (ou rien, si l'écran n'a pas d'action principale — le FAB n'est pas obligatoire).
Reprends les **états vide / chargement / erreur** de chaque écran, comme dans PEAnalyze (`Empty`, squelettes, bandeau d'erreur réseau « Données du jj/mm »).

---

## 2. Ergonomie : à reprendre à l'identique de PEAnalyze

Tout ce qui suit est **déjà implémenté** dans le dépôt de référence : copie, ne réécris pas.

### 2.1 Gabarit
- **Mobile-first, 390 × 844 px**, usage desktop correct (contenu centré, largeur max `--content-max`, grille `.dgrid` pour les cartes en colonnes).
- Fond d'application `--bg-surface-minimal` (gris très clair teinté) ; **cartes blanches** (`--bg-surface`) : rayon 16, padding 16, ombre `--shadow-s`.
- **En-tête** (64 px) : titre centré/aligné, ligne « mis à jour à hh:mm » ; il **se réduit à 44 px** au défilement.
- **Barre d'onglets fixe** (64 px + zone sûre) : 4 entrées, icône dans une « pilule » 56×32, libellé 11 px, indicateur de 3 px en haut de l'onglet actif.
- **Sous-navigation** : contrôle segmenté (`.seg`) sous l'en-tête ; règle de **compaction à 4 éléments** sur petit écran.
- **Bottom-sheets** glissables (rayon 20, poignée 36×4, voile, focus piégé, plein écran en option), fermables par le retour.
- **FAB** 56 px, 16 px au-dessus de la barre d'onglets.
- **Chips** de filtre (36 px), **boutons** pilule 40 px (libellés longs : **retour à la ligne autorisé**), **champs** 48 px, **toasts** avec « Annuler ».
- **Cibles tactiles ≥ 44 px**, focus visible, animations 150–200 ms coupées avec `prefers-reduced-motion`.
- **Tirer pour actualiser** ; balayage latéral sur une ligne (ex. « Mettre en favori / Masquer ») avec toast « Annuler ».
- **Thème clair / sombre / système**, pas d'éclair blanc au démarrage (script synchrone dans `index.html`).

### 2.2 Typographie : identique
- **Montserrat** (500/600/700) pour titres, chiffres, boutons, onglets ; **Open Sans** (400/600/700) pour le texte courant. Google Fonts chargées **non bloquantes**, avec repli système.
- Échelle : 11 · 12 · 14 · 16 · 18 · 24 · 28 · 34 · 40 px avec hauteurs de ligne associées ; **styles composés** `--type-display, h1, h2, h3, amount-l/m/s, button, overline, chip, body, body-strong, label, caption, legal, tab, badge` à appliquer avec la propriété raccourcie `font`.
- Pour l'actualité, ajoute deux styles composés **lecture** (optionnel) : `--type-headline` (Montserrat 700 16/22) pour les titres d'items, `--type-snippet` (Open Sans 400 14/21, couleur `--text-neutral`) pour les extraits. Les gros chiffres des indicateurs utilisent `--type-amount-*`.
- Formatage localisé via `Intl` (dates relatives « il y a 2 h », « hier », espaces insécables, `−` U+2212).

### 2.3 Composants spécifiques à l'information (à créer dans le même style)
- **`NewsRow`** : ligne de liste ≥ 64 px — pastille de secteur (couleur), titre sur 2 lignes max, ligne méta « Source · il y a 2 h », action favori. Une miniature 56×56 est optionnelle (voir §8.1 sur les images).
- **`SectorChip`** : chip arrondi à la couleur du secteur (fond teinté + texte coloré + icône) — **jamais la couleur seule** : toujours l'icône ou le libellé.
- **`SectorTile`** : tuile de la grille des secteurs (icône, nom, compteur de nouveautés).
- **`StoryCluster`** : « 5 sources sur ce sujet » repliable, regroupant les articles du même événement.
- **`IndicatorCard`** : libellé, valeur (`--type-amount-l`), variation ▲▼, sparkline, source et date de la donnée.
- **`SourceHealthRow`** : nom de la source, pastille ok / en retard / en panne, dernière réussite.
- **`UnreadDot`** et compteur de nouveautés (discret, jamais agressif).

---

## 3. Colorimétrie : nouvelle palette « Encre & ambre »

PEAnalyze utilise un **vert/pétrole** (#007461). La nouvelle app doit être **visiblement différente** : on propose un **indigo profond** (sérieux, éditorial, lisible) avec un **accent ambre** pour les points d'attention. Les neutres passent du gris-bleu au **gris légèrement indigo**.
Toutes les couleurs ci-dessous ont été **vérifiées en contraste WCAG** (texte ≥ 4,5:1, graphismes ≥ 3:1). Mathieu peut changer de teinte en **modifiant uniquement ce bloc de tokens** : le reste de l'app n'écrit jamais de couleur en dur.
Les noms de variables sont **identiques à ceux de PEAnalyze** (c'est ce qui permet de réutiliser `app.css` et `kit.tsx` sans modification).

> Si Mathieu préfère une autre ambiance, 3 alternatives prêtes à substituer à la couleur de marque (même méthode, à revérifier en contraste) : **bordeaux** `#9F1D3A`, **bleu nuit** `#1E4DB7`, **violet prune** `#6B2D8C`. Éviter le vert/pétrole (identité PEAnalyze) et le rouge pur (réservé aux états « critique »).

### 3.1 Mode clair
```css
:root {
  /* Marque */
  --brand-primary: #4338CA;          /* blanc dessus : 7,9:1 ; texte de marque sur blanc : 7,9:1 */
  --brand-primary-hover: #3730A3;
  --brand-primary-pressed: #2E2A85;
  --brand-secondary: #5B52D6;
  --brand-accent: #2E2A85;
  --brand-tertiary: #D97706;         /* ambre décoratif (pas pour du texte) */
  --brand-light: #C7C3F5;
  --primary-fg: var(--brand-primary);
  --primary-fg-hover: var(--brand-primary-hover);

  /* Fonds */
  --bg-page: #FFFFFF;
  --bg-surface: #FFFFFF;
  --bg-surface-minimal: #F5F6FA;     /* fond général de l'app */
  --bg-brand-minimal: #F1F0FD;
  --bg-brand-moderate: #DDDAF8;
  --bg-brand-neutral: #ECEDF6;
  --bg-blue-minimal: #E3EEFB;
  --bg-grey-minimal: #E9EAF2;        /* rail des contrôles segmentés */
  --bg-contrast: #1B1E3A;
  --bg-hover: #6B6FA033;
  --bg-pressed: #6B6FA04D;
  --bg-highlight: #4338CA14;
  --bg-overlay: #0B0D2280;
  --bg-reverse-subtle: #FFFFFF26;
  --bg-disabled: #E9EAF2;

  /* Textes */
  --text: #1B1E3A;
  --text-strong: #0B0D22;
  --text-neutral: #4A4F6A;           /* 8,0:1 */
  --text-moderate: #666B8A;          /* 5,2:1 sur blanc, 4,8:1 sur le fond général */
  --text-primary: #4338CA;
  --text-accent: #2E2A85;
  --text-blue: #1D5FA8;
  --text-reverse: #FFFFFF;
  --text-reverse-muted: #D9D6F7;
  --text-disabled: #666B8A;

  /* Bordures */
  --border: #666B8A;
  --border-minimal: #D9DBE8;
  --border-moderate: #AEB1C8;
  --border-primary: #4338CA;
  --divider: #AEB1C8;
  --divider-minimal: #E9EAF2;
  --divider-reverse: #FFFFFF33;
  --focus-indicator: #B45309;        /* anneau de focus ambre : 5,0:1 */

  /* États fonctionnels */
  --success: #1B7F3B;  --success-text: #166534;  --success-bg: #E8F6EC;
  --critical: #C62828; --critical-text: #A31515;  --critical-bg: #FDECEC;
  --warning: #B45309;  --warning-text: #92400E;   --warning-bg: #FEF3E2;
  --info: #1565C0;     --info-text: #0F4C97;      --info-bg: #E8F1FC;
  --notification: #D81B60;           /* pastille « nouveau » */

  /* Graphiques génériques */
  --chart-1: #4338CA;  --chart-2: #00A3B4;  --chart-3: #F2B01E;  --chart-4: #2E2A85;
  --chart-5: #9A93F0;  --chart-6: #E8590C;  --chart-7: #2E9E6B;  --chart-8: #BFD3F2;
  --chart-other: #B5B8D6;  --chart-grid: #E9EAF2;  --chart-axis: #666B8A;
  --chart-value: #4338CA;  --chart-value-area: #4338CA1A;
  --chart-ref-line: #666B8A;         /* ligne de référence pointillée (moyenne, seuil) */
  --chart-up: #1B7F3B;  --chart-down: #C62828;

  /* Formes : inchangées par rapport à PEAnalyze (rayons, espacements, ombres teintées indigo) */
  --shadow-xs: 0 1px 3px 0 #1B1E3A26;
  --shadow-s: 0 4px 16px 0 #1B1E3A1A;
  --shadow-m: 0 10px 60px 0 #1B1E3A26;
  --shadow-l: 0 20px 80px 0 #1B1E3A4D;
  --shadow-sticky: 0 -2px 12px 0 #1B1E3A1A;
  --shadow-fab: 0 6px 20px 0 #4338CA59;
  --input-border: 1px solid #666B8A;
  --input-border-focus: 2px solid #B45309;
  --input-border-error: 2px solid #C62828;
  --toast-bg: #1B7F3B;
  --tooltip-bg: #2E2A85;
}
```

### 3.2 Mode sombre
```css
:root[data-theme="dark"] {
  color-scheme: dark;
  --brand-primary: #4F46D8;          /* texte blanc dessus : 6,6:1 */
  --brand-primary-hover: #6158E8;
  --brand-primary-pressed: #4038B8;
  --brand-secondary: #7A72EA;
  --brand-accent: #2F2B7A;
  --brand-tertiary: #FBBF24;
  --brand-light: #B8B3F7;
  --primary-fg: #A5ACFF;             /* texte de marque sur fond sombre : 8,1:1 */
  --primary-fg-hover: #C4C9FF;

  --bg-page: #0E1020;
  --bg-surface: #171A2E;
  --bg-surface-minimal: #1E2238;
  --bg-brand-minimal: #1B1D45;
  --bg-brand-moderate: #2A2C66;
  --bg-brand-neutral: #1D2036;
  --bg-blue-minimal: #14283F;
  --bg-grey-minimal: #262A44;
  --bg-contrast: #E6E8F5;
  --bg-hover: #A5ACFF26;
  --bg-pressed: #A5ACFF40;
  --bg-highlight: #A5ACFF1F;
  --bg-overlay: #000000A6;
  --bg-reverse-subtle: #FFFFFF1F;
  --bg-disabled: #262A44;

  --text: #E6E8F5;                   /* 15,5:1 */
  --text-strong: #FFFFFF;
  --text-neutral: #B5B9D3;
  --text-moderate: #9498B8;          /* 6,1:1 */
  --text-primary: #A5ACFF;
  --text-accent: #C4C9FF;
  --text-blue: #7DB6F0;
  --text-reverse: #FFFFFF;
  --text-reverse-muted: #D2D0F5;
  --text-disabled: #6B7092;

  --border: #9498B8;
  --border-minimal: #2D3150;
  --border-moderate: #474C70;
  --border-primary: #A5ACFF;
  --divider: #474C70;
  --divider-minimal: #262A44;
  --divider-reverse: #FFFFFF2E;
  --focus-indicator: #FBBF24;

  --success: #1F9D50;  --success-text: #63D08D;  --success-bg: #12301F;
  --critical: #C93A33; --critical-text: #FF8F86; --critical-bg: #3A1B1B;
  --warning: #B8580F;  --warning-text: #F5A766;   --warning-bg: #3A2516;
  --info: #2B8FC0;     --info-text: #7CC6EA;      --info-bg: #13293A;
  --notification: #FF4D88;

  --chart-1: #8F88F5;  --chart-2: #22C3D3;  --chart-3: #F5C242;  --chart-4: #B8B3F7;
  --chart-5: #6A63E0;  --chart-6: #FF8A4C;  --chart-7: #3FC38B;  --chart-8: #7FA5D8;
  --chart-other: #5B6080;  --chart-grid: #292D48;  --chart-axis: #9498B8;
  --chart-value: #8F88F5;  --chart-value-area: #8F88F52E;
  --chart-ref-line: #A9ADC8;
  --chart-up: #63D08D;  --chart-down: #FF8F86;

  --shadow-xs: 0 1px 3px 0 #00000066;
  --shadow-s: 0 4px 16px 0 #00000059;
  --shadow-m: 0 10px 60px 0 #00000080;
  --shadow-l: 0 20px 80px 0 #00000099;
  --shadow-sticky: 0 -2px 12px 0 #00000066;
  --shadow-fab: 0 6px 20px 0 #00000080;
  --input-border: 1px solid #9498B8;
  --input-border-focus: 2px solid #FBBF24;
  --input-border-error: 2px solid #FF8F86;
  --toast-bg: #17803F;
  --tooltip-bg: #2F2B7A;
}
```
`theme-color` (barre du navigateur) : `#4338CA` en clair, `#0E1020` en sombre. Écran de démarrage (splash) : fond `--bg-page`, logo centré.

### 3.3 Couleurs des secteurs (une couleur FIXE par secteur, identique partout)
Utilisées pour la pastille, le chip, la tuile, la barre d'un graphique. Contraste ≥ 4,5:1 sur blanc (version claire) et ≥ 4,5:1 sur la surface sombre `#171A2E` (version sombre).

| Secteur | Variable | Clair | Sombre |
|---|---|---|---|
| Politique | `--sector-politique` | `#C2185B` | `#E84484` |
| International | `--sector-international` | `#1565C0` | `#2A83E8` |
| Écologie | `--sector-ecologie` | `#2E7D32` | `#38973C` |
| Spatial | `--sector-spatial` | `#007A85` | `#00919F` |
| Recherche | `--sector-recherche` | `#8E24AA` | `#C058DC` |
| Économie | `--sector-economie` | `#9E5F00` | `#BD7100` |
| Santé | `--sector-sante` | `#C2370F` | `#ED4717` |
| Numérique / IA | `--sector-numerique` | `#455A64` | `#698897` |
| Énergie | `--sector-energie` | `#6F6F00` | `#8F8F00` |
| Société | `--sector-societe` | `#6D4C41` | `#A67869` |

Fonds teintés des chips : `color-mix(in srgb, var(--sector-X) 12%, var(--bg-surface))`. Les teintes proches (politique/santé, spatial/écologie) sont **toujours accompagnées d'une icône et d'un libellé** — ne jamais coder l'information par la seule couleur. Pour un secteur ajouté plus tard : choisir une teinte, calculer le contraste, ajouter la variable.
**À revérifier** par un script de contraste après toute modification (la méthode : luminance relative WCAG ; un petit validateur Python suffit).

### 3.4 Identité
Nom, logo, icône : à définir avec Mathieu (ne rien reprendre de PEAnalyze). Icônes PWA 192/512 + variantes **maskable** (zone de sécurité centrale 80 %). Pas de marque ni de logo de média tiers dans l'app (sauf si la licence de la source l'autorise explicitement).

---

## 4. Stack technique (identique à PEAnalyze)

| Rôle | Choix |
|---|---|
| UI | React 19 + TypeScript strict, `useSyncExternalStore` |
| Build | esbuild (`scripts/build.mjs`) : ESM, code-splitting, cibles es2020/chrome90/safari15, copie de `public/` → `dist/`, **génération du service worker** avec version = hash du contenu |
| Tests | `node --import tsx --test tests/*.test.ts` (aucune lib) |
| Dépendances de l'app | **react, react-dom** seulement (+ jszip si export tableur) |
| Cloud | Firebase Spark (Auth Google + Firestore), SDK chargé **à la demande** depuis `gstatic.com` |
| Hébergement | GitHub Pages via GitHub Actions |
| Robot de collecte | Node 22 dans GitHub Actions (dépendances **réservées au robot**, jamais dans le bundle) |

Règle d'or : **aucune dépendance de plus** dans l'app sans raison forte. Routeur, store, graphiques, kit : tout est maison.

### Arborescence
```
.github/workflows/    deploy.yml (site) + collect.yml (robot de collecte)
data-src/sources.json liste déclarative des sources (§7.2)
scripts/              build.mjs · collect/*.mjs (robot) · i18n/keys.mjs
src/domain/           PUR : types, filtrage, regroupement, tri, dates, indicateurs, tests
src/data/             store, sync (Firebase), feed (lecture des JSON), seed, prefs
src/ui/               kit, charts, icons, router, news components
src/screens/          Today, Sectors, Sector, Indicators, Indicator, MyWatch, Settings, SourceHealth…
src/styles/           tokens.css, app.css
public/               manifest, icônes
tests/
firestore.rules
```
Dépendances autorisées : `domain` n'importe rien ; `data` importe `domain` ; `ui`/`screens` importent `data` et `domain`.

---

## 5. État, persistance, valeurs dérivées

Reprendre `store.ts` de PEAnalyze :
- Un seul `AppData` en mémoire, `update(fn)` sur un `structuredClone`, persistance `localStorage`, notification des abonnés, `useData()` via `useSyncExternalStore`.
- `DATA_VERSION` pour migrer proprement.
- **Séparer deux familles de données** :
  1. **Données publiques** (flux, indicateurs, liste des secteurs/sources) : *jamais* synchronisées dans le cloud, rechargées depuis les JSON publiés par le robot, mises en cache localement.
  2. **Données personnelles** (`AppData`) : secteurs suivis, mots-clés, sources masquées, favoris (liste d'ids + snapshot minimal titre/url/source/date pour qu'un favori survive à la purge du flux), ids lus (plafonnés et élagués, p. ex. 2 000 derniers), thème, langue. **Seules ces données-là vont dans Firestore.**
- **Valeurs dérivées jamais stockées** (compteurs de nouveautés, regroupements, tri).
- Clés `localStorage` : données, prefs (skipLogin, syncedUid), thème, langue — toujours dans `try/catch`.
- Un document personnel reste petit (< 200 Ko) : élaguer l'historique « lu » et les favoris trop anciens.

---

## 6. Connexion Google, Firebase, synchronisation

Reprendre `sync.ts` tel quel (c'est le résultat de nombreux correctifs terrain). Principes :

### 6.1 Mise en place (à guider clic par clic)
1. console.firebase.google.com → **Ajouter un projet** (sans Analytics). **Nouveau projet** : ne pas réutiliser celui de PEAnalyze.
2. **Authentication → Google → Activer** (e-mail d'assistance).
3. **Authentication → Paramètres → Domaines autorisés** : ajouter `<compte>.github.io`. *Oubli = `auth/unauthorized-domain`.*
4. **Firestore Database → Créer** (production, région Europe).
5. **Règles** : coller `firestore.rules` (ci-dessous).
6. **Paramètres du projet → Vos applications → Web** : copier le `firebaseConfig` dans `src/data/firebase-config.ts`.
> La config web Firebase est **publique par conception** (elle identifie le projet, ne donne aucun droit) ; la sécurité repose sur les **règles** et les **domaines autorisés**. Tant qu'elle est vide, l'app reste 100 % locale (bon mode de développement).

### 6.2 Règles Firestore (plus simples que PEAnalyze : pas de liste de suivi publique)
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    // tout le reste est interdit
  }
}
```
(La collection publique `watch/{uid}` de PEAnalyze servait à dire au robot quoi suivre. Ici le flux est **le même pour tout le monde** : pas besoin. Ne l'ajoute que si tu autorises des flux RSS personnels par utilisateur — voir §7.6 et ses risques.)

### 6.3 Modèle de synchro
- Un document `users/{uid}/state/main` = `{ data: JSON.stringify(personalData), updatedAt, device }`.
- **Dernier écrivain gagne** sur `updatedAt` ; envoi **différé 1,2 s** ; `onSnapshot` pour recevoir ; l'état reçu n'est pas ré-émis (`origin: 'remote'`).
- **Premier appareil avec données vides : le cloud gagne** (un téléphone neuf n'écrase jamais le cloud).
- Fusion plus fine que PEAnalyze recommandée ici : les favoris et « lus » sont des **ensembles** → fusionner par union (au lieu de « le plus récent gagne ») pour ne perdre aucun favori ajouté hors ligne sur deux appareils.

### 6.4 Connexion : pièges déjà résolus
- `signInWithPopup`, **repli `signInWithRedirect`** si popup bloquée ; `getRedirectResult` au démarrage ; `select_account`.
- **PWA installée / mobile** : la fenêtre Google peut se fermer sans que la promesse se termine → garde-fou `returnedWithoutLogin()` (`focus`/`visibilitychange` + délai de 3 s).
- **« Continuer sans compte »** toujours proposé (`skipLogin`).
- Appareil déjà connu → afficher tout de suite les données locales sans attendre Firebase.
- État `useSync()` : `configured, ready, user, state(off|syncing|ok|error), lastSync, error`.

---

## 7. Collecte des informations : le robot (cœur spécifique de cette app)

### 7.1 Principe
Un navigateur **ne peut pas** lire la plupart des flux RSS (CORS) et ne doit pas contenir de clés d'API. Donc : un **robot GitHub Actions** lit les sources, normalise, déduplique, classe, puis publie des **JSON statiques** que l'app consomme. Aucun appel tiers depuis l'app.

### 7.2 Déclaration des sources : `data-src/sources.json`
```jsonc
[
  { "id": "esa", "name": "ESA", "type": "rss", "url": "https://…", "sectors": ["spatial"], "lang": "en", "country": "EU", "weight": 1, "enabled": true },
  { "id": "lemonde-planete", "name": "Le Monde – Planète", "type": "rss", "url": "https://…", "sectors": ["ecologie"], "lang": "fr", "country": "FR", "weight": 1, "enabled": true }
]
```
Champs : identifiant stable, nom affiché, type (`rss` | `atom` | `json-api`), URL, **secteurs par défaut** (une source peut en avoir plusieurs), langue, pays, poids (priorité d'affichage), état. L'ajout d'une source = une ligne JSON, sans coder. **Les URL exactes des flux sont à vérifier** (elles changent et certains médias les ferment) ; proposer d'abord une liste courte (~25–40 sources) équilibrée par secteur et par pays, que Mathieu valide.

### 7.3 Pipeline du robot (`scripts/collect/*.mjs`)
1. **Lire** `sources.json`.
2. **Récupérer** chaque flux avec : timeout (10–15 s), `User-Agent` explicite (nom de l'app + contact), **`If-None-Match` / `If-Modified-Since`** (ETag mis en cache pour ne pas surcharger les éditeurs), concurrence limitée, **aucune erreur d'une source ne fait échouer le run**.
3. **Parser** RSS/Atom (une lib de parsing XML est acceptable *côté robot* uniquement, p. ex. `fast-xml-parser` — à vérifier).
4. **Normaliser** → `Item { id, url (canonique, sans utm_*), title, source, sourceId, sectors[], lang, date (ISO UTC), snippet (≤ 240 car., texte brut), image? }`. Nettoyer le HTML, décoder les entités, rejeter les dates futures, plafonner les longueurs.
5. **Dédoublonner** : par URL canonique, puis par titre normalisé (minuscules, sans accents ni ponctuation).
6. **Classer** : secteur(s) par défaut de la source ; règles de mots-clés **déclaratives** (`data-src/rules.json`) pour reclasser ou ajouter un secteur ; pas d'IA obligatoire.
7. **Regrouper** les récits proches (`clusterId`) : similarité de Jaccard sur les mots significatifs des titres (+ fenêtre de 48 h). Simple, déterministe, testable.
8. **Élaguer** : garder 7 jours (30 jours pour les favoris, qui embarquent leur snapshot), plafonner par source.
9. **Écrire** : `feed/index.json` (les ~500 derniers, léger), `feed/<secteur>.json` (par secteur), `indicators.json`, `status.json` (santé de chaque source : dernière réussite, nombre d'items, erreur), `meta.json` (date de génération, version de schéma).
10. **Publier** (§7.4).

### 7.4 Où publier les JSON (point d'architecture important)
Dans PEAnalyze, le robot **commite** `prices.json` dans `main` puis le site est **redéployé** : correct pour 2 mises à jour par jour, **mauvais pour des flux toutes les 30 min** (historique git qui gonfle, 48 déploiements/jour). Deux options, à trancher avec Mathieu :

- **Option A (recommandée) — branche `data` orpheline** : le robot régénère les JSON et les pousse en **force-push sur une branche `data` sans historique** (`git checkout --orphan`, un seul commit à chaque fois). Le dépôt ne grossit pas. L'app lit les fichiers via une URL publique de cette branche (`raw.githubusercontent.com/<compte>/<depot>/data/…` ou un CDN type jsDelivr). Le site (code) n'est redéployé que quand le code change. **À vérifier** : en-têtes CORS, durée de cache, limites d'usage de ces URL (raw n'est pas un CDN officiel ; jsDelivr met en cache les branches plusieurs heures sauf purge).
  Pour garder l'état entre deux runs (accumuler 7 jours), le robot relit les JSON précédents depuis cette branche (ou depuis `actions/cache`).
- **Option B — redéployer Pages** à chaque collecte (comme PEAnalyze) : plus simple, même origine (pas de CORS), mais déploiements fréquents (**à vérifier** : limites de déploiement Pages) et il faut exclure les JSON du précache du service worker.

Dans les deux cas : **le service worker ne précache jamais les JSON de données** (toujours réseau d'abord, repli sur le dernier cache pour le hors-ligne).

### 7.5 Workflow `collect.yml`
- `schedule` : toutes les 30 à 60 min (cron UTC, décalage possible de quelques minutes — ne pas compter sur la ponctualité) ; `workflow_dispatch` pour un lancement manuel ; `concurrency` pour éviter les chevauchements.
- Étapes : checkout → setup-node 22 → `npm ci` (robot) → `node scripts/collect/run.mjs` → publication (§7.4).
- Les dépôts publics ont des minutes Actions gratuites (**à vérifier** pour le plan de Mathieu). Les workflows planifiés sont **désactivés après 60 jours sans activité** du dépôt : prévoir une activité (le robot sur la branche `data` n'en est pas toujours une → ajouter un petit commit mensuel automatique ou un rappel).
- **Secrets** : toute clé d'API (NASA, etc.) dans *Settings → Secrets and variables → Actions*, jamais dans le code ni dans la conversation.
- Tests du robot (parsing sur des flux d'exemple figés, dédoublonnage, regroupement, classement) exécutés par `npm test` avant tout déploiement du site.

### 7.6 Flux personnels (option avancée, à discuter)
Laisser chaque utilisateur ajouter *son* flux RSS exigerait que le robot lise une liste d'URL publiée par les utilisateurs (comme `watch/{uid}` dans PEAnalyze). **Risques** : le robot ferait des requêtes vers des URL choisies par des inconnus (abus, SSRF, contenu illégal, charge). Si cela est voulu : liste blanche stricte (https uniquement, pas d'IP, pas de redirection hors domaine), plafond par utilisateur et au total, validation dans les règles Firestore, modération. **Par défaut : ne pas le faire**, et ajouter les sources via `sources.json` (revue humaine).

### 7.7 Résumés et IA
Aucune API de modèle gratuite n'est garantie. **Version de base sans IA** : titre + extrait du flux + regroupement. Un « résumé du jour » par un modèle est une **option payante/avec clé** (robot + secret) à ne proposer que si Mathieu accepte un coût ; le résultat serait stocké dans les JSON (jamais appelé depuis le navigateur). Dans ce cas, résumer *ses propres regroupements de titres* et citer toutes les sources.

---

## 8. Droit, éthique et fiabilité de l'information

### 8.1 Droits sur les contenus (**important**, à valider)
- On affiche **titre, source, date, extrait court fourni par le flux, lien vers l'original**. On **ne copie pas** le texte des articles, on ne contourne aucun mur payant, on ne « scrape » pas de pages non destinées à cela.
- Respecter les **conditions d'utilisation** de chaque flux et le `robots.txt` ; préférer les sources qui **autorisent explicitement la réutilisation** (agences et institutions : ESA, NASA, ONU, Commission européenne, ECB, Eurostat, INSEE, data.gouv.fr, revues en accès ouvert, etc.) ; noter la licence de chaque source dans `sources.json`.
- **Images** : ne pas les copier/héberger ; si on les affiche, ce n'est qu'en lien direct vers l'URL du flux et seulement si la source l'autorise ; par défaut, **pas de miniature** (plus léger, plus sûr, plus rapide).
- **Droits voisins des éditeurs de presse** (UE/France) : afficher plus que « de très courts extraits » ou des titres peut engager la responsabilité d'un agrégateur. **Usage personnel ou tests entre amis : risque faible ; diffusion large ou commerciale : demander un avis juridique.** Mathieu a évoqué une commercialisation de PEAnalyze : pour cette app, ce point est encore plus sensible.
- Mentionner dans l'app (écran « À propos / Sources ») : l'app est un agrégateur, les contenus appartiennent à leurs éditeurs, lien vers chaque source.

### 8.2 Éthique éditoriale
- Équilibre : ne pas charger la liste de sources dans une seule direction politique ; afficher **pays et langue** de chaque source ; ne pas classer les médias « de gauche/droite » (jugement subjectif) — montrer la **diversité** des sources d'un même sujet via le regroupement.
- Distinguer visuellement **information (presse)**, **données/institutions**, **recherche (preprints non relus)** : un petit badge « Preprint » sur arXiv évite de les présenter comme des faits établis.
- Pas de score de « fiabilité » inventé. Transparence sur la fraîcheur : toujours afficher « Mis à jour à hh:mm » et le bandeau d'erreur si les données ont du retard.
- RGPD : aucun suivi ; données personnelles limitées au document Firestore de l'utilisateur ; possibilité de **supprimer son compte et ses données** (bouton dans les réglages).

---

## 9. Onglet « Indicateurs » : la vue globale chiffrée

Le robot collecte des **séries temporelles** et les stocke dans `indicators.json` (`{ id, label, sector, unit, source, license, updatedAt, points:[[date, valeur]…], definition }`) ; l'app trace avec les graphiques SVG de PEAnalyze (Sparkline, courbe avec curseur/infobulle, périodes 1M/3M/1A/Max). Candidats **à vérifier** (disponibilité, format, licence, quotas, clé éventuelle) :

| Secteur | Indicateurs possibles | Sources candidates |
|---|---|---|
| Économie | taux de change EUR/USD, taux directeurs BCE, inflation zone euro, chômage | BCE (Data Portal / taux de référence), Eurostat, INSEE, Banque mondiale |
| Écologie | CO₂ atmosphérique (ppm), anomalie de température mondiale, étendue de la banquise | NOAA GML, NASA GISTEMP, Copernicus, NSIDC |
| Spatial | prochains lancements, agenda des missions | Launch Library 2 (The Space Devs), NASA/ESA (flux) |
| Science / Terre | séismes récents, événements naturels | USGS (flux GeoJSON), NASA EONET |
| Recherche | volume de publications par discipline | arXiv API, OpenAlex, Crossref |
| International | événements / tensions agrégés | GDELT (volumineux, à manier avec prudence), ONU, Banque mondiale |
| Politique | agendas parlementaires, textes en cours | data.gouv.fr, open data Assemblée nationale / Sénat, EUR-Lex |
| Énergie | mix électrique, consommation | RTE (éco2mix, clé), ENTSO-E (clé), Ember |
| Santé | alertes sanitaires | OMS, Santé publique France, ECDC |

Règles : pour chaque indicateur afficher **valeur, variation, date de la donnée, source, définition en une phrase** ; ne jamais afficher de chiffre sans sa date ; si la source est en panne, montrer la dernière valeur **datée**. Une **carte du monde** (événements géolocalisés : séismes, catastrophes, actualité) est une extension séduisante : la réaliser en SVG maison avec un fond de carte du domaine public (Natural Earth), pas avec une grosse bibliothèque — **phase 3**.

---

## 10. PWA, hors-ligne, performance

- **Manifest** : `display: standalone`, `start_url "./"`, `scope "./"`, icônes 192/512 + maskable, `lang: fr`, chemins **relatifs** (GitHub Pages sert sous `/depot/`).
- **Service worker** généré par le build : précache du shell versionné par hash, purge des anciens caches, navigation en stale-while-revalidate, polices en cache d'exécution, **JSON de données jamais précachés** (réseau d'abord, repli cache). Message « Nouvelle version disponible ».
- **Hors-ligne** : dernière version du flux consultable ; favoris lisibles (snapshot) ; bandeau « Hors connexion — données du jj/mm hh:mm ».
- **Performance** : JSON de flux < ~300 Ko compressé (liste légère ; le détail d'un item ne contient que ce qui est affiché) ; listes **virtualisées ou paginées** au-delà de ~100 lignes ; images absentes par défaut ; code-splitting des écrans lourds ; `content-visibility: auto` sur les longues listes.
- **Notifications** : pas de push (nécessite un serveur). Alternative gratuite : badge de nouveautés à l'ouverture + « briefing du jour ». Le rappel via periodicsync/notification de PEAnalyze (mensuel) montre le principe, mais la fiabilité varie selon les navigateurs.

---

## 11. Méthode de travail recommandée (celle qui a fonctionné pour PEAnalyze)

1. **Cadrage** avec Mathieu (liste de questions §14), puis un document de référence **`Dossier de reconstruction`** tenu à jour dans le projet (architecture, décisions, état d'avancement) — c'est ce qui permet de reprendre le travail après une coupure de conversation.
2. **Design d'abord** : maquettes de tous les écrans dans **Claude Design** à partir des tokens ci-dessus et de captures de PEAnalyze, puis un document **`HANDOFF_design`** (inventaire des écrans, graphiques, règles de formatage, comportements, décisions) ; en cas de conflit : décisions > brief > maquettes.
3. **Domaine pur + tests avant l'UI** (filtrage, regroupement, dates relatives, élagage, fusion de synchro).
4. **Livraisons courtes et déployées** : chaque étape est publiée sur GitHub Pages et testée sur le téléphone de Mathieu.
5. **QA mobile systématique** avec Playwright : viewports **360/390/412 px**, **FR et EN**, **clair et sombre** ; mesurer `scrollWidth > clientWidth` (le défilement horizontal est un bug) ; attendre ≥ 3 s après le chargement (splash) avant les captures.
6. **Tests dans la CI** avant chaque publication ; un test rouge bloque le déploiement.
7. **Revue des pièges** (§12) avant chaque mise en ligne.

---

## 12. Pièges rencontrés sur PEAnalyze (à éviter dès le départ)

1. `auth/unauthorized-domain` : domaine `*.github.io` oublié dans Firebase Authentication.
2. Connexion Google qui ne se termine jamais sur mobile / PWA installée → `returnedWithoutLogin`.
3. Téléphone neuf qui écrase le cloud avec du vide → « premier passage + local vide = le cloud gagne ».
4. Boucles de synchro (réception → renvoi) → paramètre `origin: 'remote'`, et mises à jour automatiques sans toucher `updatedAt`.
5. Chemins sous-répertoire GitHub Pages → tout en relatif ; routeur par hash (pas de réécriture d'URL sur Pages).
6. Service worker qui sert une vieille version → version = hash du build ; données exclues du précache.
7. Clé d'API dans le JS public → toujours via le robot + secret.
8. Crons GitHub : UTC, retards, désactivation après 60 jours sans activité, jamais deux déploiements en parallèle (`concurrency`).
9. Historique git qui explose → ne pas committer des données fréquentes dans `main` (§7.4).
10. **Débordements sur téléphone** : boutons à libellé long (autoriser le retour à la ligne), sous-onglets à 4 éléments, tableaux, infobulles trop larges → test Playwright.
11. Texte français modifié sans mettre à jour la clé du dictionnaire EN → traduction manquante ; doublons de clés → TS1117.
12. **Emoji / drapeaux** comme éléments d'interface : mal rendus sous Windows → icônes SVG et noms de pays.
13. Capture d'écran trop tôt (splash) → attendre 3 s.
14. Données de sites tiers présentées comme certaines → toujours dater, citer la source, marquer « à vérifier » si indicatif.
15. Dernier écrivain gagne = perte possible hors ligne sur deux appareils → fusion par union pour les ensembles (favoris, lus).
16. **Un robot de veille détecte et alerte, il ne réécrit jamais seul** des données de référence : ici, une source en panne est signalée (écran « Santé des sources »), pas supprimée automatiquement.

---

## 13. Feuille de route proposée

**Phase 0 — Cadrage & design** : réponses aux questions (§14), liste de sources validée, maquettes, `HANDOFF_design`.
**Phase 1 — Socle** : dépôt, kit/tokens (nouvelle palette), build, PWA, déploiement Pages, i18n FR (EN ensuite). *Livrable : coquille vide avec 4 onglets, thème clair/sombre.*
**Phase 2 — Collecte + lecture** : `sources.json`, robot (pipeline §7.3) + tests, publication des JSON (§7.4), écrans À la une / Secteurs / fiche item, favoris et lu/non lu en local, bandeau d'erreur, hors-ligne.
**Phase 3 — Compte & synchro** : Firebase, Google, règles, `sync.ts`, fusion par union, « continuer sans compte », suppression du compte.
**Phase 4 — Indicateurs** : `indicators.json`, onglet Indicateurs, fiches, définitions.
**Phase 5 — Confort** : mots-clés suivis, recherche locale, regroupement d'articles, santé des sources, briefing du jour, balayage, partage.
**Phase 6 — Extensions** : carte du monde, résumé IA (si budget accepté), flux personnels (si choix assumé), export/import des préférences.
À chaque phase : tests verts, QA mobile, déploiement, mise à jour du dossier de reconstruction.

---

## 14. Questions à poser à Mathieu avant de coder

1. **Nom** de l'app, ambiance de marque souhaitée (garder « Encre & ambre » ou une alternative §3 ?).
2. **Usage** : strictement personnel, partagé à quelques amis, ou ouvert au public (impacte §8.1 : droits, mentions légales) ?
3. **Langues** des sources (FR seulement, FR + EN, autres ?) et langue de l'interface (FR seul, ou FR/EN comme PEAnalyze).
4. **Secteurs** de départ (liste §1.1 à confirmer) et **pays/régions** à privilégier.
5. **Sources prioritaires** : médias qu'il lit déjà, institutions, revues ; sources à exclure.
6. **Fréquence de mise à jour** souhaitée (30 min, 1 h, 3 fois par jour ?).
7. **Indicateurs** qui l'intéressent vraiment (§9) — commencer par 6 à 10, pas 40.
8. **Compte Google** : connexion et synchro nécessaires dès la V1 ou plus tard ?
9. **Budget IA** : accepte-t-il une clé d'API payante pour un résumé du jour, ou reste-t-il à 0 € ?
10. **Plateformes** : Android (PWA suffit), iPhone (PWA via Safari), PC ; publication dans les stores (impose un emballage natif et des frais de compte développeur : à ne décider que plus tard).
11. **Design** : veut-il passer par Claude Design pour les maquettes avant le code (comme PEAnalyze) ?

*Mathieu crée lui-même les comptes (GitHub, Firebase) ; ne lui demande jamais de coller un secret dans la conversation — les clés vont directement dans les secrets GitHub.*

---

## 15. Ressources de référence (documentation officielle, versions à vérifier)

- Dépôt de référence : https://github.com/mathieuoury34-gif/peanalyze
- Firebase Auth (Google) : https://firebase.google.com/docs/auth/web/google-signin
- Règles Firestore : https://firebase.google.com/docs/firestore/security/get-started
- GitHub Pages via Actions : https://docs.github.com/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Événement `schedule` : https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#schedule
- PWA : https://web.dev/learn/pwa
- WCAG (contrastes) : https://www.w3.org/TR/WCAG21/#contrast-minimum
- esbuild : https://esbuild.github.io/api/

*En cas de doute entre « faire comme PEAnalyze » et « faire plus simple », choisis le plus simple qui respecte : local d'abord, zéro coût, aucun secret exposé, domaine testé, sources citées.*
