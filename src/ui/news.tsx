// Composants propres à l'information : ligne de sujet, étiquette de secteur, pastille « non lu », etc.
import { useState, type CSSProperties, type ReactNode } from 'react';
import sectorsJson from '../../data-src/sectors.json';
import type { Sector, Story } from '../domain/types';
import { Icon } from './icons';
import { openSheet } from './router';
import { showToast } from './kit';
import { useFeed } from '../data/feed';
import { toggleFavorite, useUserState, markRead } from '../data/store';
import { isFav } from '../domain/state';
import { relTime } from '../domain/format';
import { clip } from '../domain/text';
import { distinctSources, leadItem, sourceName, storyText, storyTitle, textLang } from '../domain/select';

export const SECTORS = sectorsJson as Sector[];
export const SECTOR_IDS = SECTORS.map((s) => s.id);
export const sectorById = (id: string): Sector | undefined => SECTORS.find((s) => s.id === id);
export const sectorStyle = (id: string): CSSProperties => ({ ['--sc' as string]: `var(--sector-${id})` });

export function useSourceName(): (id: string) => string {
  const { sources } = useFeed();
  return (id) => sourceName(id, sources);
}

export function SectorTag({ id, icon = true }: { id: string; icon?: boolean }) {
  const s = sectorById(id);
  if (!s) return null;
  return (
    <span className="sector-tag" style={sectorStyle(id)}>
      {icon && <Icon name={s.icon} size={14} />}{s.short}
    </span>
  );
}

export function UnreadDot() {
  return <span className="unread-dot" role="img" aria-label="Non lu" />;
}

export function LangBadge({ lang }: { lang: string }) {
  if (lang !== 'en') return null;
  return <span className="badge outline" title="Texte en anglais">EN</span>;
}

export function FavButton({ st, size = 22 }: { st: Story; size?: number }) {
  const user = useUserState();
  const name = useSourceName();
  const on = isFav(user.favorites[st.id]);
  return (
    <button type="button" className={'icon-btn star' + (on ? ' on' : '')} aria-pressed={on} aria-label={on ? 'Retirer des favoris' : 'Mettre en favori'}
      onClick={(e) => { e.stopPropagation(); const added = toggleFavorite(st, name); showToast(added ? 'Ajouté aux favoris' : 'Retiré des favoris'); }}>
      <Icon name="favoris" size={size} fill={on} />
    </button>
  );
}

/** Une ligne de l'actualité : secteur, nombre de sources, âge, titre, résumé court, actions. */
export function NewsRow({ st, showSector = true, summary = true }: { st: Story; showSector?: boolean; summary?: boolean }) {
  const user = useUserState();
  const name = useSourceName();
  const unread = !user.read[st.id];
  const n = distinctSources(st).length;
  const lead = leadItem(st);
  const text = summary ? storyText(st) : '';
  return (
    <article className={'story' + (unread ? ' unread' : '')} style={sectorStyle(st.sectors[0] ?? '')}>
      <button type="button" className="story-main" onClick={() => openSheet('story:' + st.id)}>
        <span className="story-meta">
          {unread && <UnreadDot />}
          {showSector && st.sectors[0] && <SectorTag id={st.sectors[0]} />}
          <span>{n > 1 ? `${n} sources` : name(lead?.s ?? '')}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={st.date}>{relTime(st.date)}</time>
          <LangBadge lang={storyTitle(st) === st.title ? st.lang : 'fr'} />
        </span>
        <span className="story-title">{storyTitle(st)}</span>
        {text && <span className="story-sum">{clip(text, 260)}{textLang(st) === 'en' && <span className="sr-only"> (en anglais)</span>}</span>}
      </button>
      <div className="story-actions">
        <FavButton st={st} />
        {lead && (
          <a className="icon-btn neutral" href={lead.u} target="_blank" rel="noopener noreferrer" aria-label={`Lire sur ${name(lead.s)}`} onClick={() => markRead(st.id)}>
            <Icon name="external" size={20} />
          </a>
        )}
      </div>
    </article>
  );
}

/** Liste paginée : « Voir plus » ajoute un lot. */
export function PagedList<T>({ items, render, step = 25, empty }: { items: T[]; render: (it: T) => ReactNode; step?: number; empty?: ReactNode }) {
  const [shown, setShown] = useState(step);
  if (!items.length) return <>{empty}</>;
  return (
    <>
      <div className="story-list">{items.slice(0, shown).map(render)}</div>
      {items.length > shown && (
        <button type="button" className="btn btn-secondary block" onClick={() => setShown(shown + step)}>
          Voir plus ({items.length - shown} restants)
        </button>
      )}
    </>
  );
}

export function Notice({ icon = 'info', children }: { icon?: string; children: ReactNode }) {
  return <div className="note"><Icon name={icon} size={20} /><div>{children}</div></div>;
}
