// Textes de l'interface en français et en anglais. La langue choisie (Réglages › Langue) est aussi celle des contenus :
// jamais de mélange. Chaque clé existe dans les deux langues (le compilateur le vérifie).
import { useSyncExternalStore } from 'react';
import type { Lang } from './domain/types';
import { getState, subscribe } from './data/store';

type Val = string | [string, string]; // [singulier, pluriel] quand la valeur dépend d'un nombre {n}

const FR = {
  // ---- navigation et général
  'tab.une': 'À la une', 'tab.secteurs': 'Secteurs', 'tab.favoris': 'Favoris', 'tab.reglages': 'Réglages',
  'nav.main': 'Navigation principale',
  'common.refresh': 'Actualiser', 'common.back': 'Retour', 'common.close': 'Fermer', 'common.retry': 'Réessayer', 'common.undo': 'Annuler',
  'common.loading': 'Chargement…', 'common.unavailable': 'Données indisponibles', 'common.updated': 'Mis à jour {when}',
  'common.unread': 'Non lu', 'common.more': 'Voir plus ({n} restants)', 'common.share': 'Partager', 'common.copied': 'Lien copié',
  'name.fr': 'français', 'name.en': 'anglais',
  'common.clear': 'Effacer', 'common.search': 'Rechercher', 'common.all': 'Tout', 'common.fr': 'Français', 'common.en': 'English',
  'banner.offline': 'Hors connexion', 'banner.failed': 'Actualisation impossible', 'banner.old': '{why} – données du {date}',
  'banner.stale': 'Pas de nouvelle édition depuis {ago} (dernière : {date}).',
  'ago.days': ['{n} jour', '{n} jours'], 'ago.hours': '{n} h',
  'sources.n': ['{n} source', '{n} sources'], 'articles.n': ['{n} article', '{n} articles'],
  // ---- À la une
  'brief.title': 'À la une', 'brief.label': 'Brief du jour', 'brief.essential': "L'essentiel en 2 minutes",
  'brief.morning': 'Édition du matin', 'brief.evening': 'Édition du soir',
  'brief.nothing': 'Rien à signaler dans les secteurs suivis.', 'brief.all': 'Tout voir',
  'brief.noData': 'Aucune édition publiée pour le moment.', 'brief.loadFail': "Impossible de charger l'actualité ({err}).",
  'brief.plain': 'Résumés générés à partir des titres : voir Réglages › Résumé pour activer les résumés par IA.',
  'brief.onlyNative': "Sans IA, seuls les sujets publiés dans cette langue sont affichés : voir Réglages › Résumé.",
  // ---- Secteurs
  'sectors.title': 'Secteurs', 'sectors.search': "Rechercher dans l'actualité", 'sectors.results': ['{n} résultat', '{n} résultats'], 'sectors.latest': ' (les plus récents)',
  'sectors.noResultTitle': 'Aucun résultat', 'sectors.noResultText': 'Essayez un autre mot, ou moins de mots.',
  'sectors.new': ['{n} nouveau', '{n} nouveaux'], 'sectors.new99': '99+ nouveaux', 'sectors.upToDate': 'À jour',
  'sector.sort': 'Tri', 'sector.top': 'Importants', 'sector.recent': 'Récents', 'sector.unread': 'Non lus', 'sector.searchIn': 'Chercher en {name}', 'sector.searchAria': 'Rechercher dans le secteur',
  'sector.unknown': 'Secteur inconnu', 'sector.unknownText': "Ce secteur n'existe pas.",
  'sector.empty': 'Rien ici', 'sector.emptyText': 'Aucun sujet ne correspond.', 'sector.allRead': 'Tout est lu', 'sector.allReadText': 'Aucun sujet non lu dans ce secteur.',
  'sector.markAll': 'Tout marquer comme lu', 'sector.hidden': 'Certaines sources sont masquées dans ce secteur (Réglages › Sources).',
  'sector.fewLang': "Peu de sujets dans cette langue pour l'instant : l'IA n'a pas traduit les autres sujets (Réglages › Résumé).",
  // ---- Favoris
  'favs.title': 'Favoris', 'kw.title': 'Mots suivis', 'kw.help': 'Un nom, une entreprise, un sujet : tapez-le puis touchez « + ». Tous les sujets du flux qui le contiennent sont listés ici, tous secteurs confondus.',
  'kw.placeholder': 'ex. Ariane 6, hydrogène, stage', 'kw.aria': 'Nouveau mot suivi', 'kw.add': 'Ajouter le mot', 'kw.drop': 'Ne plus suivre « {k} »',
  'kw.already': 'Déjà suivi', 'kw.empty': 'Tapez d’abord un mot à suivre, puis touchez « + »', 'kw.added': '« {k} » est maintenant suivi', 'kw.max': '30 mots suivis au maximum', 'kw.count': ['{n} sujet correspond', '{n} sujets correspondent'], 'kw.none': 'Aucun sujet pour le moment',
  'favs.saved': 'Mis de côté', 'favs.search': 'Chercher dans mes favoris', 'favs.searchAria': 'Chercher dans les favoris',
  'favs.emptyTitle': 'Aucun favori', 'favs.emptyText': "Touchez l'étoile d'un sujet pour le garder ici, même quand il aura disparu du flux.", 'favs.noMatch': 'Aucun favori ne correspond.',
  'fav.add': 'Mettre en favori', 'fav.remove': 'Retirer des favoris', 'fav.added': 'Ajouté aux favoris', 'fav.removed': 'Retiré des favoris',
  'fav.otherLang': 'Enregistré en {lang}',
  // ---- Fiche d'un sujet
  'story.sheet': 'Sujet', 'story.favSheet': 'Favori', 'story.notFound': 'Sujet introuvable', 'story.notFoundText': "Ce sujet n'est plus dans le flux (il est conservé 7 jours).",
  'story.gone': "Ce sujet n'est plus dans le flux (conservé 7 jours) ; votre copie reste ici.",
  'story.readOn': 'Lire sur {src}', 'story.origTitle': "Titre d'origine ({lang}) : {t}", 'story.translated': 'Titre et résumé traduits par IA (original : {lang}).',
  'story.by.llm': "Résumé rédigé par IA à partir de l'article.", 'story.by.extractive': "Extraits de l'article, sélectionnés automatiquement.", 'story.by.none': 'Extrait du flux de la source.',
  'story.articles': ['Article', '{n} articles sur ce sujet'], 'story.articleIn': 'article en {lang}', 'story.lean': 'Sensibilités des sources',
  'story.spread': 'Couverture : {l} gauche · {c} centre · {r} droite', 'story.spreadHelp': 'Repères indicatifs, voir Réglages › Sources.',
  'story.oneSide': 'Une seule sensibilité parmi les sources de ce sujet : comparez avec une autre couverture.',
  'translated': 'Traduit', 'translatedTitle': "Titre traduit par IA",
  // ---- sensibilités et types de source
  'lean.left': 'Gauche', 'lean.center-left': 'Centre gauche', 'lean.center': 'Centre', 'lean.center-right': 'Centre droit', 'lean.right': 'Droite',
  'leanShort.left': 'G', 'leanShort.center-left': 'CG', 'leanShort.center': 'C', 'leanShort.center-right': 'CD', 'leanShort.right': 'D',
  'kind.presse': 'Presse', 'kind.institution': 'Institution', 'kind.verification': 'Vérification', 'kind.ong': 'ONG', 'kind.association': 'Association', 'kind.emploi': 'Offres', 'kind.recherche': 'Recherche', 'kind.preprint': 'Prépublication', 'kind.blog': 'Blog', 'kind.agence': 'Agence', 'kind.entreprise': 'Entreprise',
  // ---- Réglages
  'set.title': 'Réglages',
  'set.account': 'Compte & synchronisation', 'set.theme': 'Thème', 'set.lang': 'Langue', 'set.followed': 'Secteurs suivis', 'set.sources': 'Sources', 'set.summary': 'Résumé', 'set.data': 'Données',
  'account.local': 'Mode local : favoris et lectures restent sur cet appareil. Voir le README pour activer la synchronisation gratuite (Google).',
  'account.google': 'Compte Google', 'account.syncing': 'Synchronisation…', 'account.synced': 'Synchronisé {when}', 'account.connected': 'Connecté',
  'account.syncedAt': 'Synchronisé le {date} à {time} · téléphone et PC partagent les mêmes données', 'account.sync': 'Synchroniser', 'account.logout': 'Déconnexion',
  'account.intro': "Connectez-vous avec Google pour retrouver vos favoris, vos lectures et vos réglages (langue, sources) sur le téléphone et l'ordinateur. Rien n'est partagé : seules ces données sont stockées.",
  'account.signin': 'Continuer avec Google', 'account.signinFail': 'Connexion impossible',
  'theme.label': 'Thème', 'theme.system': 'Système', 'theme.light': 'Clair', 'theme.dark': 'Sombre',
  'lang.label': "Langue de l'application", 'lang.help': "Tout l'affichage (titres, résumés, boutons) est dans une seule langue, sans mélange. Les sujets publiés par des journaux d'une autre langue sont traduits par l'IA quand elle est active.",
  'lang.noAi': "Sans IA, seuls les sujets publiés dans la langue choisie sont affichés : c'est pourquoi la liste peut être plus courte. Voir « Résumé » ci-dessous.",
  'lang.changed': 'Langue : Français',
  'followed.help': 'Les secteurs désactivés disparaissent de « À la une » et de la recherche.', 'followed.min': 'Gardez au moins un secteur',
  'src.intro': 'Journaux et sites suivis, secteur par secteur. Décochez un journal pour ne plus le voir dans un secteur précis (il reste visible dans les autres).',
  'src.status': '{ok} sur {total} sources lues lors de la dernière édition ({date}).', 'src.loadingStatus': "Chargement de l'état des sources…",
  'src.count': '{on} / {total}', 'src.allOn': 'Tout activer', 'src.allOff': 'Tout masquer', 'src.hiddenN': ['{n} masquée', '{n} masquées'],
  'src.fail': 'En échec', 'src.ok': 'Lue', 'src.failList': 'Sources en échec', 'src.unreadable': 'illisible', 'src.noItems': 'rien de récent',
  'src.spread': 'Répartition des sensibilités (sources actives)', 'src.spreadLeft': 'gauche', 'src.spreadCenter': 'centre', 'src.spreadRight': 'droite', 'src.spreadOther': 'sans étiquette',
  'src.disclaimer': "Les étiquettes de sensibilité sont des repères indicatifs, établis d'après la ligne éditoriale généralement admise de chaque média ; elles ne remplacent pas votre jugement. Les sources sans étiquette (agences, institutions, vérificateurs, revues techniques) n'ont pas de ligne politique propre.",
  'src.show': 'Afficher les journaux', 'src.sectorOpen': 'Journaux de {name}',
  'sum.ai': "Les résumés sont rédigés par une IA gratuite à partir du texte des articles, en français et en anglais.",
  'sum.noAi': "Pour l'instant, les résumés sont des extraits des articles. Sans IA, l'application ne peut pas traduire : en mode {lang}, elle n'affiche que les sujets publiés par des journaux de cette langue. Pour avoir tous les sujets dans une seule langue, ajoutez une clé gratuite Gemini dans GitHub (voir le README).",
  'sum.last': 'Dernière édition — résumés IA : {llm} · extraits : {ext}.', 'sum.model': ' Modèle : {m}.',
  'data.line': '{read} sujets lus mémorisés (14 jours) · {n} sujets en ligne{ed}', 'data.edition': " · édition du {date}",
  'data.resetRead': 'Tout marquer non lu', 'data.reload': "Recharger l'application", 'data.resetDone': 'Lectures réinitialisées',
  'app.name': 'Sémaphore',
  'footer': "Sémaphore · usage personnel · les titres et extraits appartiennent à leurs éditeurs.",
} as const;

const EN: Record<keyof typeof FR, Val> = {
  'tab.une': 'Top stories', 'tab.secteurs': 'Sectors', 'tab.favoris': 'Saved', 'tab.reglages': 'Settings',
  'nav.main': 'Main navigation',
  'common.refresh': 'Refresh', 'common.back': 'Back', 'common.close': 'Close', 'common.retry': 'Retry', 'common.undo': 'Undo',
  'common.loading': 'Loading…', 'common.unavailable': 'Data unavailable', 'common.updated': 'Updated {when}',
  'common.unread': 'Unread', 'common.more': 'Show more ({n} left)', 'common.share': 'Share', 'common.copied': 'Link copied',
  'name.fr': 'French', 'name.en': 'English',
  'common.clear': 'Clear', 'common.search': 'Search', 'common.all': 'All', 'common.fr': 'Français', 'common.en': 'English',
  'banner.offline': 'Offline', 'banner.failed': 'Could not refresh', 'banner.old': '{why} – data from {date}',
  'banner.stale': 'No new edition for {ago} (latest: {date}).',
  'ago.days': ['{n} day', '{n} days'], 'ago.hours': '{n} h',
  'sources.n': ['{n} source', '{n} sources'], 'articles.n': ['{n} article', '{n} articles'],
  'brief.title': 'Top stories', 'brief.label': "Today's brief", 'brief.essential': 'The essentials in 2 minutes',
  'brief.morning': 'Morning edition', 'brief.evening': 'Evening edition',
  'brief.nothing': 'Nothing to report in the sectors you follow.', 'brief.all': 'See all',
  'brief.noData': 'No edition published yet.', 'brief.loadFail': 'Could not load the news ({err}).',
  'brief.plain': 'Summaries are built from headlines: see Settings › Summary to turn on AI summaries.',
  'brief.onlyNative': 'Without AI, only stories published in this language are shown: see Settings › Summary.',
  'sectors.title': 'Sectors', 'sectors.search': 'Search the news', 'sectors.results': ['{n} result', '{n} results'], 'sectors.latest': ' (most recent)',
  'sectors.noResultTitle': 'No results', 'sectors.noResultText': 'Try another word, or fewer words.',
  'sectors.new': ['{n} new', '{n} new'], 'sectors.new99': '99+ new', 'sectors.upToDate': 'Up to date',
  'sector.sort': 'Sort', 'sector.top': 'Top', 'sector.recent': 'Latest', 'sector.unread': 'Unread', 'sector.searchIn': 'Search {name}', 'sector.searchAria': 'Search this sector',
  'sector.unknown': 'Unknown sector', 'sector.unknownText': "This sector doesn't exist.",
  'sector.empty': 'Nothing here', 'sector.emptyText': 'No story matches.', 'sector.allRead': 'All read', 'sector.allReadText': 'No unread story in this sector.',
  'sector.markAll': 'Mark all as read', 'sector.hidden': 'Some sources are hidden in this sector (Settings › Sources).',
  'sector.fewLang': "Few stories in this language for now: the AI has not translated the other stories (Settings › Summary).",
  'favs.title': 'Saved', 'kw.title': 'Followed keywords', 'kw.help': 'A name, a company, a topic: type it, then tap “+”. Every story containing it is listed here, across all sectors.',
  'kw.placeholder': 'e.g. Ariane 6, hydrogen, internship', 'kw.aria': 'New keyword', 'kw.add': 'Add keyword', 'kw.drop': 'Stop following "{k}"',
  'kw.already': 'Already followed', 'kw.empty': 'Type a keyword first, then tap “+”', 'kw.added': '“{k}” is now followed', 'kw.max': '30 keywords maximum', 'kw.count': ['{n} story matches', '{n} stories match'], 'kw.none': 'No story for now',
  'favs.saved': 'Saved stories', 'favs.search': 'Search my saved stories', 'favs.searchAria': 'Search saved stories',
  'favs.emptyTitle': 'Nothing saved', 'favs.emptyText': "Tap a story's star to keep it here, even after it has left the feed.", 'favs.noMatch': 'No saved story matches.',
  'fav.add': 'Save', 'fav.remove': 'Remove from saved', 'fav.added': 'Saved', 'fav.removed': 'Removed from saved',
  'fav.otherLang': 'Saved in {lang}',
  'story.sheet': 'Story', 'story.favSheet': 'Saved story', 'story.notFound': 'Story not found', 'story.notFoundText': 'This story is no longer in the feed (kept for 7 days).',
  'story.gone': 'This story is no longer in the feed (kept for 7 days); your copy stays here.',
  'story.readOn': 'Read on {src}', 'story.origTitle': 'Original title ({lang}): {t}', 'story.translated': 'Title and summary translated by AI (original: {lang}).',
  'story.by.llm': 'AI-written summary based on the article.', 'story.by.extractive': 'Passages from the article, selected automatically.', 'story.by.none': "Excerpt from the source's feed.",
  'story.articles': ['Article', '{n} articles on this story'], 'story.articleIn': 'article in {lang}', 'story.lean': 'Source leanings',
  'story.spread': 'Coverage: {l} left · {c} centre · {r} right', 'story.spreadHelp': 'Indicative markers, see Settings › Sources.',
  'story.oneSide': 'Only one leaning among the sources of this story: compare with other coverage.',
  'translated': 'Translated', 'translatedTitle': 'Title translated by AI',
  'lean.left': 'Left', 'lean.center-left': 'Centre-left', 'lean.center': 'Centre', 'lean.center-right': 'Centre-right', 'lean.right': 'Right',
  'leanShort.left': 'L', 'leanShort.center-left': 'CL', 'leanShort.center': 'C', 'leanShort.center-right': 'CR', 'leanShort.right': 'R',
  'kind.presse': 'Press', 'kind.institution': 'Institution', 'kind.verification': 'Fact-check', 'kind.ong': 'NGO', 'kind.association': 'Association', 'kind.emploi': 'Jobs', 'kind.recherche': 'Research', 'kind.preprint': 'Preprint', 'kind.blog': 'Blog', 'kind.agence': 'Agency', 'kind.entreprise': 'Company',
  'set.title': 'Settings',
  'set.account': 'Account & sync', 'set.theme': 'Theme', 'set.lang': 'Language', 'set.followed': 'Followed sectors', 'set.sources': 'Sources', 'set.summary': 'Summary', 'set.data': 'Data',
  'account.local': 'Local mode: saved stories and reading marks stay on this device. See the README to turn on free sync (Google).',
  'account.google': 'Google account', 'account.syncing': 'Syncing…', 'account.synced': 'Synced {when}', 'account.connected': 'Signed in',
  'account.syncedAt': 'Synced on {date} at {time} · phone and PC share the same data', 'account.sync': 'Sync now', 'account.logout': 'Sign out',
  'account.intro': 'Sign in with Google to get your saved stories, reading marks and settings (language, sources) on your phone and computer. Nothing is shared: only this data is stored.',
  'account.signin': 'Continue with Google', 'account.signinFail': 'Sign-in failed',
  'theme.label': 'Theme', 'theme.system': 'System', 'theme.light': 'Light', 'theme.dark': 'Dark',
  'lang.label': 'App language', 'lang.help': 'Everything shown (headlines, summaries, buttons) is in a single language, never mixed. Stories from newspapers in the other language are translated by the AI when it is on.',
  'lang.noAi': 'Without AI, only stories published in the chosen language are shown, so the list can be shorter. See "Summary" below.',
  'lang.changed': 'Language: English',
  'followed.help': 'Sectors you switch off disappear from "Top stories" and from search.', 'followed.min': 'Keep at least one sector',
  'src.intro': 'Newspapers and sites followed, sector by sector. Untick a newspaper to stop seeing it in one particular sector (it stays visible in the others).',
  'src.status': '{ok} of {total} sources read in the latest edition ({date}).', 'src.loadingStatus': 'Loading source status…',
  'src.count': '{on} / {total}', 'src.allOn': 'Turn all on', 'src.allOff': 'Hide all', 'src.hiddenN': ['{n} hidden', '{n} hidden'],
  'src.fail': 'Failed', 'src.ok': 'Read', 'src.failList': 'Failed sources', 'src.unreadable': 'unreadable', 'src.noItems': 'nothing recent',
  'src.spread': 'Spread of leanings (active sources)', 'src.spreadLeft': 'left', 'src.spreadCenter': 'centre', 'src.spreadRight': 'right', 'src.spreadOther': 'unlabelled',
  'src.disclaimer': "Leaning labels are indicative markers based on each outlet's generally recognised editorial line; they do not replace your own judgement. Unlabelled sources (agencies, institutions, fact-checkers, technical journals) have no political line of their own.",
  'src.show': 'Show newspapers', 'src.sectorOpen': 'Newspapers in {name}',
  'sum.ai': 'Summaries are written by a free AI from the article text, in French and in English.',
  'sum.noAi': 'For now, summaries are excerpts from the articles. Without AI the app cannot translate: in {lang} mode it only shows stories published by newspapers in that language. To get every story in a single language, add a free Gemini key in GitHub (see the README).',
  'sum.last': 'Latest edition — AI summaries: {llm} · excerpts: {ext}.', 'sum.model': ' Model: {m}.',
  'data.line': '{read} read stories remembered (14 days) · {n} stories online{ed}', 'data.edition': ' · edition of {date}',
  'data.resetRead': 'Mark all unread', 'data.reload': 'Reload the app', 'data.resetDone': 'Reading marks reset',
  'app.name': 'Semaphore',
  'footer': 'Semaphore · personal use · headlines and excerpts belong to their publishers.',
};

export type Key = keyof typeof FR;
const DICT: Record<Lang, Record<Key, Val>> = { fr: FR as unknown as Record<Key, Val>, en: EN };

export type Vars = Record<string, string | number>;
export type T = (key: Key, vars?: Vars) => string;

export function translate(lang: Lang, key: Key, vars: Vars = {}): string {
  let v: Val = DICT[lang][key] ?? DICT.fr[key] ?? key;
  if (Array.isArray(v)) {
    const n = Number(vars.n ?? 0);
    v = (lang === 'en' ? n === 1 : n < 2) ? v[0] : v[1];
  }
  return v.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export const makeT = (lang: Lang): T => (key, vars) => translate(lang, key, vars);

export const getLang = (): Lang => getState().prefs.lang;
/** Langue de l'application (préférence synchronisée avec le compte). */
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}
const bound: Record<Lang, { t: T; lang: Lang }> = { fr: { t: makeT('fr'), lang: 'fr' }, en: { t: makeT('en'), lang: 'en' } };
/** `const { t, lang } = useT()` : traduction et langue courante. */
export function useT(): { t: T; lang: Lang } {
  return bound[useLang()];
}
/** Nom d'une langue, écrit dans la langue de l'interface (« anglais » / « English »). */
export const langName = (lang: Lang, ui: Lang): string => translate(ui, lang === 'fr' ? 'name.fr' : 'name.en');
