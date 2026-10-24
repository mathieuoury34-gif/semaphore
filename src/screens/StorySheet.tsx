// Fiche d'un sujet : résumé, tous les articles qui en parlent (avec la sensibilité indicative de chaque journal), favori, partage.
import { useEffect } from 'react';
import { Icon } from '../ui/icons';
import { Sheet, showToast } from '../ui/kit';
import { FavButton, LeanTag, SectorTag, TranslatedBadge, sectorById, useSourceName } from '../ui/news';
import { useFeed } from '../data/feed';
import { markRead, removeFavorite, useUserState } from '../data/store';
import { favIn, isFav } from '../domain/state';
import { dateTime, relTime } from '../domain/format';
import { hostOf } from '../domain/text';
import { leadItem, storyText, storyTitle, storySpread, textBy, txOf } from '../domain/select';
import { langName, useT } from '../i18n';

async function share(title: string, url: string, copied: string) {
  try {
    if (navigator.share) { await navigator.share({ title, url }); return; }
    await navigator.clipboard.writeText(url);
    showToast(copied);
  } catch { /* partage annulé */ }
}

export function StorySheet({ id }: { id: string }) {
  const f = useFeed();
  const user = useUserState();
  const name = useSourceName();
  const { t, lang } = useT();
  const st = f.byId.get(id);
  const fav = user.favorites[id];
  useEffect(() => { if (st) markRead(id); }, [id, st]);

  if (!st) {
    if (isFav(fav)) {
      const c = favIn(fav, lang);
      return (
        <Sheet title={t('story.favSheet')} footer={c.url ? <a className="btn btn-primary block" href={c.url} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} />{t('story.readOn', { src: c.source || hostOf(c.url) })}</a> : undefined}>
          <div className="stack-12 sheet-story">
            <span className="story-meta">{fav.sector && <SectorTag id={fav.sector} />}<span>{c.source}</span><span aria-hidden="true">·</span><span>{dateTime(fav.date, lang)}</span>{c.other && <span className="badge outline">{fav.lang.toUpperCase()}</span>}</span>
            <h3 className="t-h2" lang={c.other ? fav.lang : lang}>{c.title}</h3>
            {c.summary && <p className="story-full" lang={c.other ? fav.lang : lang}>{c.summary}</p>}
            <p className="t-caption c-moderate">{t('story.gone')}</p>
            <button type="button" className="btn btn-tertiary" onClick={() => removeFavorite(id)}><Icon name="trash" size={18} />{t('fav.remove')}</button>
          </div>
        </Sheet>
      );
    }
    return <Sheet title={t('story.notFound')}><p className="c-neutral" style={{ padding: 'var(--space-16) 0' }}>{t('story.notFoundText')}</p></Sheet>;
  }

  const lead = leadItem(st, lang);
  const items = [...st.items].sort((a, b) => (a === lead ? -1 : b === lead ? 1 : b.d.localeCompare(a.d)));
  const title = storyTitle(st, lang);
  const text = storyText(st, lang);
  const by = textBy(st, lang);
  const tx = txOf(st, lang);
  const origLang = langName(st.lang === 'en' ? 'en' : 'fr', lang);
  const opinion = st.sectors.some((s) => sectorById(s)?.opinion);
  const spread = opinion ? storySpread(st, f.sources) : null;
  const labelled = spread ? spread.left + spread.center + spread.right : 0;
  const camps = spread ? [spread.left, spread.center, spread.right].filter((n) => n > 0).length : 0;
  return (
    <Sheet title={t('story.sheet')} footer={
      <div className="row" style={{ gap: 'var(--space-8)' }}>
        {lead && <a className="btn btn-primary grow" href={lead.u} target="_blank" rel="noopener noreferrer"><Icon name="external" size={18} />{t('story.readOn', { src: name(lead.s) })}</a>}
        <FavButton st={st} size={24} />
        {lead && <button type="button" className="icon-btn neutral" aria-label={t('common.share')} onClick={() => void share(title, lead.u, t('common.copied'))}><Icon name="share" size={22} /></button>}
      </div>}>
      <div className="stack-12 sheet-story">
        <span className="story-meta">
          {st.sectors.map((s) => <SectorTag key={s} id={s} />)}
          <span>{relTime(st.date, lang)}</span>
          {tx?.tr && <TranslatedBadge />}
        </span>
        <h3 className="t-h2">{title}</h3>
        {tx?.tr && <p className="t-caption c-moderate">{t('story.origTitle', { lang: origLang, t: st.title })}</p>}
        {text && (
          <>
            <p className="story-full">{text}</p>
            <p className="t-caption c-moderate">
              {t(by === 'llm' ? 'story.by.llm' : by === 'extractive' ? 'story.by.extractive' : 'story.by.none')}
              {tx?.tr && ' ' + t('story.translated', { lang: origLang })}
            </p>
          </>
        )}
        {spread && labelled > 0 && (
          <div className="spread" role="group" aria-label={t('story.lean')}>
            <p className="t-caption">{t('story.spread', { l: spread.left, c: spread.center, r: spread.right })}</p>
            {camps === 1 && <p className="t-caption c-moderate">{t('story.oneSide')}</p>}
          </div>
        )}
        <h4 className="overline c-neutral" style={{ marginTop: 'var(--space-8)' }}>{t('story.articles', { n: st.items.length })}</h4>
        <ul className="src-list">
          {items.map((it) => {
            const lean = opinion ? f.sources.get(it.s)?.lean : undefined;
            return (
              <li key={it.u}>
                <a href={it.u} target="_blank" rel="noopener noreferrer" className="src-row" onClick={() => markRead(id)}>
                  <span className="grow stack-4">
                    <span className="t-strong src-name">{name(it.s)}<LeanTag lean={lean} /></span>
                    {it.l === lang
                      ? it.t !== title && <span className="t-caption c-neutral">{it.t}</span>
                      : <span className="t-caption c-moderate">{t('story.articleIn', { lang: langName(it.l === 'en' ? 'en' : 'fr', lang) })}</span>}
                    <span className="t-caption c-moderate">{relTime(it.d, lang)}</span>
                  </span>
                  <Icon name="external" size={18} />
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </Sheet>
  );
}
