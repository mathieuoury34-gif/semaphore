// Contenu de « Réglages › Aide » (FR et EN). Les sujets s'ouvrent comme des accordéons ; **gras** est reconnu dans les textes.
import type { Lang } from '../domain/types';

export type HelpBlock =
  | { k: 'p'; text: string }
  | { k: 'h'; text: string }
  | { k: 'ul'; items: string[] }
  | { k: 'ol'; items: string[] }
  | { k: 'apk' };           // les deux boutons : page de l'APK sur GitHub / téléchargement direct

export interface HelpTopic { id: string; icon: string; title: string; blocks: HelpBlock[] }

const FR: HelpTopic[] = [
  {
    id: 'start', icon: 'download', title: 'Démarrer et installer',
    blocks: [
      { k: 'p', text: "Sémaphore résume l'actualité par secteur : deux éditions par jour (vers 7 h et 19 h), avec **L'essentiel en 2 minutes** puis un résumé pour chaque secteur que vous suivez. Aucune donnée personnelle n'est envoyée à un tiers : vos lectures et vos favoris restent sur votre appareil et, si vous vous connectez, dans votre espace privé Firebase." },
      { k: 'h', text: 'Où l\'installer :' },
      { k: 'ul', items: [
        "**Android (téléphone)** : installez l'APK. C'est la version la plus complète : elle s'ouvre même sans réseau et elle seule peut envoyer les **notifications** d'édition.",
        "**PC** (Chrome ou Edge) : ouvrez le site, puis cliquez sur « Installer » dans la barre d'adresse.",
        "**iPhone** : ouvrez le site dans Safari, puis Partager › « Sur l'écran d'accueil ». Il n'y a ni APK ni notifications sur iPhone ; le reste fonctionne, et vos favoris se synchronisent avec le compte Google.",
      ] },
      { k: 'apk' },
      { k: 'p', text: "Au téléchargement, Android demande d'autoriser l'installation depuis le navigateur : acceptez, puis ouvrez le fichier. L'APK embarque l'application : elle s'ouvre sans réseau et les éditions se mettent à jour toutes seules. Seul un changement d'interface demande une réinstallation : un bandeau « Une nouvelle version de l'application est disponible » apparaît alors. Touchez **Télécharger**, puis installez par-dessus : vos favoris sont conservés." },
      { k: 'h', text: 'Premiers pas conseillés :' },
      { k: 'ol', items: [
        "Réglages › Compte : « Continuer avec Google », pour retrouver les mêmes favoris et réglages sur le téléphone et le PC.",
        "Réglages › Langue : le français ou l'anglais (toute l'application et les résumés passent dans cette langue).",
        "Réglages › Secteurs suivis : gardez seulement ceux qui vous intéressent.",
        "Sur Android : Réglages › Notifications, pour recevoir les titres de L'essentiel chaque matin et chaque soir.",
      ] },
    ],
  },
  {
    id: 'brief', icon: 'une', title: "Lire l'actualité (À la une)",
    blocks: [
      { k: 'p', text: "L'écran **À la une** commence par la carte **L'essentiel en 2 minutes** : un titre par secteur suivi, les plus importants de l'édition. Dessous, une carte par secteur avec quelques titres ; « Tout voir » ouvre le secteur complet." },
      { k: 'ul', items: [
        "Touchez un titre pour ouvrir la fiche du sujet.",
        "Un point de couleur signale un sujet **non lu** ; il disparaît quand vous l'ouvrez.",
        "L'édition affichée (matin ou soir) et sa date sont rappelées en haut de la carte. Le bouton d'actualisation de l'en-tête recharge les données.",
      ] },
    ],
  },
  {
    id: 'sectors', icon: 'secteurs', title: 'Secteurs, recherche et tri',
    blocks: [
      { k: 'p', text: "L'onglet **Secteurs** liste tous les secteurs, avec le nombre de sujets nouveaux. Le champ « Rechercher dans l'actualité » cherche dans tous les secteurs à la fois." },
      { k: 'ul', items: [
        "Dans un secteur, **Tri** : « Importants » (classés par importance) ou « Récents ».",
        "Le filtre **Non lus** n'affiche que ce que vous n'avez pas encore ouvert ; **Tout marquer comme lu** remet le secteur à zéro.",
        "Un champ de recherche propre au secteur permet de filtrer ses sujets.",
        "Un même sujet peut apparaître dans plusieurs secteurs.",
      ] },
    ],
  },
  {
    id: 'story', icon: 'eye', title: "La fiche d'un sujet",
    blocks: [
      { k: 'p', text: "Un sujet regroupe les articles de plusieurs journaux sur le même fait. La fiche donne un **résumé**, indique s'il a été rédigé par IA ou extrait des articles, puis liste les articles par journal." },
      { k: 'ul', items: [
        "**Lire sur …** ouvre l'article chez l'éditeur (il faut du réseau) ; le bouton de partage envoie le lien.",
        "L'étoile met le sujet de côté dans **Favoris**.",
        "Dans les secteurs d'opinion (Politique, International, Économie, Climat), la fiche montre la **répartition des sensibilités** (gauche, centre, droite) des journaux qui couvrent le sujet. Ce sont des repères indicatifs, pas des verdicts : comparez avec une autre couverture quand il n'y en a qu'une.",
        "Les sujets restent dans le flux environ 7 jours ; vos favoris, eux, restent aussi longtemps que vous le voulez.",
      ] },
    ],
  },
  {
    id: 'favs', icon: 'favoris', title: 'Favoris et mots suivis',
    blocks: [
      { k: 'ul', items: [
        "**Mis de côté** : touchez l'étoile d'un sujet pour le retrouver dans l'onglet Favoris, même quand il a disparu du flux. « Annuler » dans le message qui s'affiche rétablit un favori retiré par erreur.",
        "**Mots suivis** : tapez un nom, une entreprise ou un sujet, puis touchez « + ». Tous les sujets du flux qui le contiennent sont listés dans Favoris, tous secteurs confondus (30 mots au maximum). Touchez un mot pour le retirer.",
      ] },
    ],
  },
  {
    id: 'settings', icon: 'reglages', title: 'Secteurs suivis et sources',
    blocks: [
      { k: 'ul', items: [
        "**Secteurs suivis** : décochez un secteur pour ne plus le voir dans À la une (il reste accessible dans l'onglet Secteurs). Un secteur au moins doit rester suivi.",
        "**Sources** : pour chaque secteur, ouvrez la liste des journaux et masquez ceux que vous ne voulez plus lire dans ce secteur (ils restent visibles dans les autres). Un point vert ou rouge indique si le journal a pu être lu lors de la dernière édition.",
        "**Résumé** : indique si les résumés de la dernière édition sont rédigés par IA ou extraits des articles.",
      ] },
    ],
  },
  {
    id: 'lang', icon: 'globe', title: 'Langue et résumés',
    blocks: [
      { k: 'p', text: "Une **seule langue à la fois** : le français ou l'anglais, pour l'interface comme pour les contenus. Un sujet n'est affiché que s'il existe dans la langue choisie ; quand il vient d'un journal étranger, le titre et le résumé sont traduits par l'IA (mention « traduit par IA ») et le titre d'origine est rappelé." },
      { k: 'p', text: "Sans IA, les résumés sont des extraits des articles et l'application ne peut pas traduire : elle n'affiche alors que les sujets publiés dans la langue choisie." },
    ],
  },
  {
    id: 'account', icon: 'cloud', title: 'Compte et synchronisation',
    blocks: [
      { k: 'p', text: "Sans compte, tout reste sur l'appareil. Avec **Continuer avec Google**, vos favoris, mots suivis, lectures, langue, secteurs suivis et sources masquées sont synchronisés entre le téléphone et le PC (ligne verte « Synchronisé le … » dans Réglages › Compte). Rien d'autre n'est stocké, et rien n'est partagé." },
      { k: 'ul', items: [
        "Dans l'APK, la connexion s'ouvre dans le navigateur du téléphone (Google refuse les fenêtres intégrées), puis revient dans l'application toute seule.",
        "Les réglages propres à l'appareil (notifications) ne sont pas synchronisés.",
        "« Synchroniser » force un échange immédiat.",
      ] },
    ],
  },
  {
    id: 'offline', icon: 'refresh', title: 'Hors connexion',
    blocks: [
      { k: 'p', text: "L'application s'ouvre sans réseau et affiche la **dernière édition reçue**, avec le bandeau « Hors connexion – données du … ». Les liens vers les articles demandent du réseau. Il faut l'avoir ouverte au moins une fois avec du réseau." },
      { k: 'p', text: "Dans l'APK, l'application est embarquée. Dans Chrome (PC ou téléphone), l'application installée garde elle-même une copie." },
    ],
  },
  {
    id: 'notif', icon: 'bell', title: "Notifications d'édition (Android)",
    blocks: [
      { k: 'p', text: "Dans **Réglages › Notifications** (APK seulement), activez l'interrupteur, choisissez **1 ou 2 notifications par jour** et **l'heure de chacune** (7 h et 19 h par défaut). À l'heure choisie, le téléphone affiche 2 ou 3 titres de L'essentiel, pour vos secteurs suivis et dans votre langue. Touchez la notification pour ouvrir l'application." },
      { k: 'ul', items: [
        "Le robot publie une édition vers 7 h et vers 19 h (heure de Paris). Si la nouvelle édition n'est pas encore là, Sémaphore réessaie pendant environ 1 h 40 plutôt que d'afficher celle de la veille : choisissez donc des heures proches de 7 h et 19 h.",
        "Pour désactiver : l'interrupteur dans Réglages, ou les réglages de notifications d'Android.",
        "Pour que l'alarme arrive à l'heure, touchez « Autoriser en arrière-plan ». Sur Xiaomi, Redmi ou Poco, activez aussi « Démarrage automatique » et mettez l'économiseur de batterie sur « Aucune restriction » (Paramètres › Applications › Sémaphore).",
      ] },
    ],
  },
  {
    id: 'trouble', icon: 'alert', title: 'Dépannage',
    blocks: [
      { k: 'ul', items: [
        "**« Pas de nouvelle édition depuis … »** : le robot publie deux éditions par jour ; un retard est possible. Réglages › Données › « Recharger l'application » force la lecture des dernières données.",
        "**L'APK ne s'installe pas** : ouvrez le lien dans Chrome, autorisez « Installer des applications inconnues » pour Chrome quand Android le propose, puis rouvrez le fichier téléchargé. Installer par-dessus l'ancienne version conserve vos données.",
        "**La connexion Google échoue** : réessayez avec du réseau. Dans l'APK, la page de connexion s'ouvre dans le navigateur ; revenez ensuite dans Sémaphore.",
        "**Pas de notification** : vérifiez que l'interrupteur est activé, que les notifications ne sont pas bloquées dans Android (un bouton ouvre les réglages) et que l'application est autorisée en arrière-plan.",
        "**« Sujet introuvable »** : le sujet est sorti du flux (il est conservé 7 jours). Mettez-le en favori pour le garder.",
        "**Un secteur est vide** : vérifiez qu'il est suivi, que ses sources ne sont pas toutes masquées et que la langue choisie a des sujets.",
      ] },
    ],
  },
  {
    id: 'about', icon: 'info', title: 'À propos et confidentialité',
    blocks: [
      { k: 'p', text: "Sémaphore est une application personnelle et gratuite. Elle lit des flux publics de journaux, d'institutions et de sites spécialisés ; les titres et extraits appartiennent à leurs éditeurs, et chaque sujet renvoie vers l'article d'origine." },
      { k: 'p', text: "Les résumés sont produits par une IA gratuite ou par extraction automatique : ils peuvent contenir des erreurs, vérifiez dans l'article d'origine pour les sujets importants. Aucune publicité : seules vos données de synchronisation, si vous vous connectez, sont enregistrées dans votre espace privé." },
    ],
  },
];

const EN: HelpTopic[] = [
  {
    id: 'start', icon: 'download', title: 'Get started and install',
    blocks: [
      { k: 'p', text: "Semaphore summarises the news by sector: two editions a day (around 7 am and 7 pm), with **The essentials in 2 minutes** and then a summary for each sector you follow. No personal data is sent to a third party: your reading marks and saved stories stay on your device and, if you sign in, in your private Firebase space." },
      { k: 'h', text: 'Where to install it:' },
      { k: 'ul', items: [
        "**Android (phone)**: install the APK. It is the most complete version: it opens even without a network and it alone can send edition **notifications**.",
        "**PC** (Chrome or Edge): open the site, then click “Install” in the address bar.",
        "**iPhone**: open the site in Safari, then Share › “Add to Home Screen”. There is no APK and no notifications on iPhone; everything else works, and your saved stories sync through your Google account.",
      ] },
      { k: 'apk' },
      { k: 'p', text: "When you download, Android asks you to allow installing from the browser: accept, then open the file. The APK embeds the app: it opens offline and editions update by themselves. Only an interface change needs a reinstall: a “A new version of the app is available” banner then then appears. Tap **Download**, then install over the old one: your saved stories are kept." },
      { k: 'h', text: 'Suggested first steps:' },
      { k: 'ol', items: [
        'Settings › Account: “Continue with Google”, to get the same saved stories and settings on phone and PC.',
        'Settings › Language: French or English (the whole app and the summaries switch to that language).',
        'Settings › Followed sectors: keep only the ones you care about.',
        'On Android: Settings › Notifications, to get the headlines of The essentials every morning and evening.',
      ] },
    ],
  },
  {
    id: 'brief', icon: 'une', title: 'Reading the news (Top stories)',
    blocks: [
      { k: 'p', text: "The **Top stories** screen opens with the **The essentials in 2 minutes** card: one headline per followed sector, the most important of the edition. Below, one card per sector with a few headlines; “See all” opens the full sector." },
      { k: 'ul', items: [
        'Tap a headline to open the story.',
        'A coloured dot marks an **unread** story; it disappears once you open it.',
        'The edition shown (morning or evening) and its date are at the top of the card. The refresh button in the header reloads the data.',
      ] },
    ],
  },
  {
    id: 'sectors', icon: 'secteurs', title: 'Sectors, search and sorting',
    blocks: [
      { k: 'p', text: "The **Sectors** tab lists every sector with its number of new stories. The “Search the news” field searches all sectors at once." },
      { k: 'ul', items: [
        'In a sector, **Sort**: “Top” (ranked by importance) or “Latest”.',
        'The **Unread** filter shows only what you have not opened yet; **Mark all as read** resets the sector.',
        "A search field specific to the sector filters its stories.",
        'The same story can appear in several sectors.',
      ] },
    ],
  },
  {
    id: 'story', icon: 'eye', title: 'A story sheet',
    blocks: [
      { k: 'p', text: 'A story groups articles from several newspapers about the same event. The sheet gives a **summary**, says whether it was written by AI or extracted from the articles, then lists the articles by newspaper.' },
      { k: 'ul', items: [
        '**Read on …** opens the article at the publisher (a network is needed); the share button sends the link.',
        'The star saves the story in **Saved**.',
        "In opinion sectors (Politics, World, Economy, Climate) the sheet shows the **spread of leanings** (left, centre, right) of the newspapers covering the story. These are indicative markers, not verdicts: compare with other coverage when there is only one.",
        'Stories stay in the feed for about 7 days; your saved stories stay as long as you want.',
      ] },
    ],
  },
  {
    id: 'favs', icon: 'favoris', title: 'Saved stories and followed keywords',
    blocks: [
      { k: 'ul', items: [
        '**Saved**: tap a story’s star to find it in the Saved tab, even after it has left the feed. “Undo” in the message that appears restores a story removed by mistake.',
        '**Followed keywords**: type a name, a company or a topic, then tap “+”. Every story in the feed containing it is listed in Saved, across all sectors (30 keywords at most). Tap a keyword to remove it.',
      ] },
    ],
  },
  {
    id: 'settings', icon: 'reglages', title: 'Followed sectors and sources',
    blocks: [
      { k: 'ul', items: [
        '**Followed sectors**: untick a sector to stop seeing it in Top stories (it stays available in the Sectors tab). At least one sector must remain followed.',
        '**Sources**: for each sector, open the list of newspapers and hide those you no longer want to read in that sector (they stay visible in the others). A green or red dot shows whether the newspaper could be read in the latest edition.',
        '**Summary**: tells you whether the summaries of the latest edition are written by AI or extracted from the articles.',
      ] },
    ],
  },
  {
    id: 'lang', icon: 'globe', title: 'Language and summaries',
    blocks: [
      { k: 'p', text: 'Only **one language at a time**: French or English, for the interface and the content alike. A story is shown only if it exists in the chosen language; when it comes from a foreign newspaper, the title and summary are translated by AI (marked “translated by AI”) and the original title is shown.' },
      { k: 'p', text: 'Without AI, summaries are excerpts of the articles and the app cannot translate: it then shows only the stories published in the chosen language.' },
    ],
  },
  {
    id: 'account', icon: 'cloud', title: 'Account and sync',
    blocks: [
      { k: 'p', text: 'Without an account, everything stays on the device. With **Continue with Google**, your saved stories, keywords, reading marks, language, followed sectors and hidden sources sync between phone and PC (green line “Synced on …” in Settings › Account). Nothing else is stored, nothing is shared.' },
      { k: 'ul', items: [
        'In the APK, sign-in opens in the phone’s browser (Google refuses embedded windows), then returns to the app by itself.',
        'Device-specific settings (notifications) are not synced.',
        '“Sync” forces an exchange right away.',
      ] },
    ],
  },
  {
    id: 'offline', icon: 'refresh', title: 'Offline',
    blocks: [
      { k: 'p', text: 'The app opens without a network and shows the **latest edition received**, with the “Offline – data from …” banner. Links to articles need a network. You must have opened the app at least once online.' },
      { k: 'p', text: 'In the APK, the app is embedded. In Chrome (PC or phone), the installed app keeps its own copy.' },
    ],
  },
  {
    id: 'notif', icon: 'bell', title: 'Edition notifications (Android)',
    blocks: [
      { k: 'p', text: 'In **Settings › Notifications** (APK only), turn the switch on, choose **1 or 2 notifications a day** and **the time of each** (7 am and 7 pm by default). At that time the phone shows 2 or 3 headlines of The essentials, for your followed sectors and in your language. Tap the notification to open the app.' },
      { k: 'ul', items: [
        "The robot publishes an edition around 7 am and 7 pm (Paris time). If the new edition is not there yet, Semaphore retries for about 1 h 40 rather than showing yesterday’s: so pick times close to 7 am and 7 pm.",
        'To turn off: the switch in Settings, or Android’s notification settings.',
        'For the alarm to arrive on time, tap “Allow background activity”. On Xiaomi, Redmi or Poco, also turn on “Autostart” and set the battery saver to “No restrictions” (Settings › Apps › Semaphore).',
      ] },
    ],
  },
  {
    id: 'trouble', icon: 'alert', title: 'Troubleshooting',
    blocks: [
      { k: 'ul', items: [
        '**“No new edition since …”**: the robot publishes two editions a day; a delay is possible. Settings › Data › “Reload the app” forces a read of the latest data.',
        '**The APK will not install**: open the link in Chrome, allow “Install unknown apps” for Chrome when Android offers it, then reopen the downloaded file. Installing over the old version keeps your data.',
        '**Google sign-in fails**: try again with a network. In the APK the sign-in page opens in the browser; then come back to Semaphore.',
        '**No notification**: check that the switch is on, that notifications are not blocked in Android (a button opens the settings) and that the app is allowed in the background.',
        '**“Story not found”**: the story left the feed (kept for 7 days). Save it to keep it.',
        '**A sector is empty**: check that it is followed, that its sources are not all hidden and that the chosen language has stories.',
      ] },
    ],
  },
  {
    id: 'about', icon: 'info', title: 'About and privacy',
    blocks: [
      { k: 'p', text: 'Semaphore is a personal, free app. It reads public feeds from newspapers, institutions and specialist sites; headlines and excerpts belong to their publishers, and each story links to the original article.' },
      { k: 'p', text: 'Summaries are produced by a free AI or by automatic extraction: they may contain errors, so check the original article for important stories. No ads: only your sync data, if you sign in, is stored in your private space.' },
    ],
  },
];

export const helpTopics = (lang: Lang): HelpTopic[] => (lang === 'en' ? EN : FR);
