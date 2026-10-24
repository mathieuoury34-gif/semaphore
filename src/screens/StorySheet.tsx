// Fiche d'un sujet : résumé, tous les articles qui en parlent, favori, partage.
import { useEffect } from 'react';
import { Icon } from '../ui/icons';
import { Sheet, showToast } from '../ui/kit';
import { FavButton, LangBadge, SectorTag, useSourceName } from '../ui/news';
import { useFeed } from '../data/feed';
import { markRead, removeFavorite, useUserState } from '../data/store';
import { isFav } from '../domain/state';
import { relTime, dateTimeFr } from '../domain/format';
import { hostOf } from '../domain/text';
import { leadItem, storyText, storyTitle, textLang } from '../domain/select';

async function share(title: string, url: string) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url);
    showToast('Lien copié');
  } catch { /* partage annulé */ }
}

export function StorySheet({ id }: { id: string }) {
  const f = useFeed();
  const user = useUserState();
  const name = useSourceName();
  const st = f.byId.get(id);
  const fav = user.favorites[id];
  useEffect(() => { if (st) markRead(id); }, [id, st]);

  if (!st) {
    if (isFav(fav)) {
      return (
        <Sheet title="Favori" footer={<a className="btn btn-primary block" href={fav.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} />Lire sur {fav.source || hostOf(fav.url)}</a>}>
          <div className="stack-12 sheet-story">
            <span className="story-meta">{fav.sector && <SectorTag id={fav.sector} />}<span>{fav.source}</span><span aria-hidden="true">·</span><span>{dateTimeFr(fav.date)}</span><LangBadge lang={fav.lang} /></span>
            <h3 className="t-h2">{fav.title}</h3>
            {fav.summary && <p className="story-full">{fav.summary}</p>}
            <p className="t-caption c-moderate">Ce sujet n'est plus dans le flux (conservé 7 jours) ; votre copie reste ici.</p>
            <button type="button" className="btn btn-tertiary" onClick={() => removeFavorite(id)}><Icon name="trash" size={18} />Retirer des favoris</button>
          </div>
        </Sheet>
      );
    }
    return <Sheet title="Sujet introuvable"><p className="c-neutral" style={{ padding: 'var(--space-16) 0' }}>Ce sujet n'est plus dans le flux (il est conservé 7 jours).</p></Sheet>;
  }

  const lead = leadItem(st);
  const items = [...st.items].sort((a, b) => (a === lead ? -1 : b === lead ? 1 : b.d.localeCompare(a.d)));
  const text = storyText(st);
  const tl = textLang(st);
  const by = st.summary ? st.summaryBy : null;
  return (
    <Sheet title="Sujet" footer={
      <div className="row" style={{ gap: 'var(--space-8)' }}>
        {lead && <a className="btn btn-primary grow" href={lead.u} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} />Lire sur {name(lead.s)}</a>}
        <FavButton st={st} size={24} />
        {lead && <button type="button" className="icon-btn neutral" aria-label="Partager" onClick={() => void share(storyTitle(st), lead.u)}><Icon name="share" size={22} /></button>}
      </div>}>
      <div className="stack-12 sheet-story">
        <span className="story-meta">
          {st.sectors.map((s) => <SectorTag key={s} id={s} />)}
          <span>{relTime(st.date)}</span>
          <LangBadge lang={storyTitle(st) === st.title ? st.lang : 'fr'} />
        </span>
        <h3 className="t-h2">{storyTitle(st)}</h3>
        {storyTitle(st) !== st.title && <p className="t-caption c-moderate">Titre d'origine : {st.title}</p>}
        {text && (
          <>
            <p className="story-full" lang={tl}>{text}</p>
            <p className="t-caption c-moderate">
              {by === 'llm' ? 'Résumé rédigé par IA à partir de l\'article.' : by === 'extractive' ? 'Extraits de l\'article, sélectionnés automatiquement.' : 'Extrait du flux de la source.'}
              {tl === 'en' && ' Texte en anglais.'}
            </p>
          </>
        )}
        <h4 className="overline c-neutral" style={{ marginTop: 'var(--space-8)' }}>{st.items.length > 1 ? `${st.items.length} articles sur ce sujet` : 'Article'}</h4>
        <ul className="src-list">
          {items.map((it) => (
            <li key={it.u}>
              <a href={it.u} target="_blank" rel="noopener noreferrer" className="src-row" onClick={() => markRead(id)}>
                <span className="grow stack-4">
                  <span className="t-strong">{name(it.s)}</span>
                  {it.t !== storyTitle(st) && <span className="t-caption c-neutral">{it.t}</span>}
                  <span className="t-caption c-moderate">{relTime(it.d)}{it.l === 'en' ? ' · EN' : ''}</span>
                </span>
                <Icon name="external" size={18} />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
