// Types partagés : format des fichiers publiés par le robot (public/data/*.json) et état personnel de l'utilisateur.

export type Lang = 'fr' | 'en';
export const LANGS: Lang[] = ['fr', 'en'];

export interface SectorText { name: string; short: string; description: string }
export interface Sector extends SectorText { id: string; icon: string; summaries: number; opinion?: boolean; en?: SectorText }

export interface FeedItem { u: string; t: string; s: string; d: string; l: string }
export type SummaryBy = 'llm' | 'extractive';
/** Contenu d'un sujet dans une langue : titre, extrait du flux, résumé, article de tête. */
export interface Tx {
  t: string;
  n?: string;           // extrait du flux
  s?: string;           // résumé
  by?: SummaryBy;
  tr?: 1;               // titre / résumé traduits par l'IA (aucun article publié dans cette langue)
  u?: string;           // article de tête dans cette langue
  x?: string;           // source de cet article
}
export interface Story {
  id: string;
  title: string;        // titre de l'article de tête, dans sa langue d'origine
  lang: string;         // langue d'origine
  sectors: string[];
  date: string;
  first: string;
  score: number;
  votes?: number;
  rel?: number;
  noSummary?: boolean;
  tx: Partial<Record<Lang, Tx>>;
  items: FeedItem[];
}
export interface Feed { v: number; generatedAt: string; stories: Story[] }

export interface Bullet { t: Partial<Record<Lang, string>>; ids: string[] }
export interface DigestRow { by: string; bullets: Bullet[] }
export interface Digest {
  v: number;
  generatedAt: string;
  by: string;
  brief: (Bullet & { sector: string })[];
  briefBy?: string;
  sectors: Record<string, DigestRow>;
}

export type Lean = 'left' | 'center-left' | 'center' | 'center-right' | 'right';
export const LEANS: Lean[] = ['left', 'center-left', 'center', 'center-right', 'right'];
export interface SourceInfo { id: string; name: string; lang: string; country: string; kind: string; sectors: string[]; weight: number; lean?: Lean }
export interface SourceStatus { id: string; name: string; ok: boolean; items: number; new: number; ms: number; lastOk?: string; error?: string; note?: string }
export interface Status {
  v: number;
  generatedAt: string;
  durationMs: number;
  totals: { sources: number; ok: number; newItems: number; stories: number; summaries: { llm: number; extractive: number }; languages?: Record<string, number> };
  llm: { used?: string; requests?: number; failures?: number } | null;
  sources: SourceStatus[];
}

/** Copie d'un sujet dans une langue (titre, résumé, article) : le favori reste lisible quand le sujet sort du flux. */
export interface FavTx { title: string; summary: string; url: string; source: string }
/** Un favori garde une copie de l'essentiel : le sujet peut disparaître du flux (conservé 7 jours) sans que le favori soit perdu. */
export interface Fav {
  id: string;
  title: string;
  summary: string;
  sector: string;
  date: string;
  url: string;
  source: string;
  lang: string;
  tx?: Partial<Record<Lang, FavTx>>;
  savedAt: string;
  removedAt?: string; // « pierre tombale » : permet de fusionner proprement les suppressions entre appareils
}
export interface Prefs {
  followed: string[] | null;               // null : tous les secteurs
  keywords: string[];
  lang: Lang;                              // langue de l'application et des contenus
  off: Record<string, string[]>;           // secteur → sources masquées dans ce secteur
  at: string;
}
export interface UserState {
  v: 1;
  favorites: Record<string, Fav>;
  read: Record<string, string>; // id du sujet → date de lecture
  prefs: Prefs;
  updatedAt: string;
}
