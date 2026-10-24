// Types partagés : format des fichiers publiés par le robot (public/data/*.json) et état personnel de l'utilisateur.

export interface Sector { id: string; name: string; short: string; icon: string; description: string; summaries: number }

export interface FeedItem { u: string; t: string; s: string; d: string; l: string }
export type SummaryBy = 'llm' | 'extractive' | 'none' | null;
export interface Story {
  id: string;
  title: string;
  titleFr?: string;
  sectors: string[];
  date: string;
  first: string;
  lang: string;
  snippet: string;
  summary: string | null;
  summaryBy: SummaryBy;
  summaryLang?: string;
  score: number;
  rel?: number;
  items: FeedItem[];
}
export interface Feed { v: number; generatedAt: string; stories: Story[] }

export interface Bullet { text: string; ids: string[] }
export interface Digest {
  v: number;
  generatedAt: string;
  by: string;
  brief: (Bullet & { sector: string })[];
  briefBy?: string;
  sectors: Record<string, { by: string; bullets: Bullet[] }>;
}

export interface SourceInfo { id: string; name: string; lang: string; country: string; kind: string; sectors: string[]; weight: number }
export interface SourceStatus { id: string; name: string; ok: boolean; items: number; new: number; ms: number; lastOk?: string; error?: string; note?: string }
export interface Status {
  v: number;
  generatedAt: string;
  durationMs: number;
  totals: { sources: number; ok: number; newItems: number; stories: number; summaries: { llm: number; extractive: number } };
  llm: { provider?: string; model?: string; requests?: number } | null;
  sources: SourceStatus[];
}

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
  savedAt: string;
  removedAt?: string; // « pierre tombale » : permet de fusionner proprement les suppressions entre appareils
}
export interface Prefs { followed: string[] | null; keywords: string[]; at: string } // followed = null : tous les secteurs
export interface UserState {
  v: 1;
  favorites: Record<string, Fav>;
  read: Record<string, string>; // id du sujet → date de lecture
  prefs: Prefs;
  updatedAt: string;
}
