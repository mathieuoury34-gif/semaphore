// « Favoris » : sujets mis de côté (conservés même après leur sortie du flux) et mots suivis.
import { useMemo, useRef, useState } from 'react';
import { Icon } from '../ui/icons';
import { AppHeader, Empty, showToast } from '../ui/kit';
import { openSheet } from '../ui/router';
import { NewsRow, PagedList, SectorTag } from '../ui/news';
import { useFeed } from '../data/feed';
import { removeFavorite, restoreFavorite, setKeywords, useUserState } from '../data/store';
import { activeFavorites, favIn } from '../domain/state';
import { keywordMatches, viewOf } from '../domain/select';
import { langName, useT } from '../i18n';
import { relTime } from '../domain/format';
import { matchesQuery, norm } from '../domain/text';

export function FavoritesScreen() {
  const user = useUserState();
  const f = useFeed();
  const { t, lang } = useT();
  const [q, setQ] = useState('');
  const [kw, setKw] = useState('');
  const kwInput = useRef<HTMLInputElement>(null);
  const favs = activeFavorites(user);
  const shown = useMemo(() => (q.trim() ? favs.filter((x) => { const c = favIn(x, lang); return matchesQuery(norm(c.title + ' ' + c.summary + ' ' + c.source), q); }) : favs), [favs, q, lang]);
  const v = useMemo(() => viewOf(user.prefs), [user.prefs]);
  const matches = useMemo(() => (f.feed ? keywordMatches(f.feed, user.prefs.keywords, v) : []), [f.feed, user.prefs.keywords, v]);

  const addKw = (e: React.FormEvent) => {
    e.preventDefault();
    const v = kw.trim().slice(0, 40);
    if (!v) { showToast(t('kw.empty')); kwInput.current?.focus(); return; }
    if (user.prefs.keywords.some((k) => norm(k) === norm(v))) { showToast(t('kw.already')); return; }
    if (user.prefs.keywords.length >= 30) { showToast(t('kw.max'), { error: true }); return; }
    setKeywords([...user.prefs.keywords, v]);
    setKw('');
    showToast(t('kw.added', { k: v }));
  };

  return (
    <div className="screen">
      <AppHeader title={t('favs.title')} />
      <div className="content">
        <section className="card g8" aria-labelledby="kw-title">
          <h2 id="kw-title">{t('kw.title')}</h2>
          <p className="t-caption c-moderate">{t('kw.help')}</p>
          <form className="row" onSubmit={addKw}>
            <input ref={kwInput} className="input grow" value={kw} onChange={(e) => setKw(e.target.value)}  placeholder={t('kw.placeholder')} aria-label={t('kw.aria')} maxLength={40} enterKeyHint="done" />
            <button type="submit" className="btn btn-primary" aria-label={t('kw.add')}><Icon name="plus" size={20} /></button>
          </form>
          {user.prefs.keywords.length > 0 && (
            <div className="row wrap" style={{ gap: 'var(--space-6)' }}>
              {user.prefs.keywords.map((k) => (
                <button key={k} type="button" className="chip kw" aria-label={t('kw.drop', { k })} onClick={() => setKeywords(user.prefs.keywords.filter((x) => x !== k))}>
                  {k}<Icon name="close" size={14} />
                </button>
              ))}
            </div>
          )}
          {user.prefs.keywords.length > 0 && f.feed && (
            <div className="stack-8">
              <h3 className="overline c-neutral">{matches.length ? t('kw.count', { n: matches.length }) : t('kw.none')}</h3>
              <PagedList items={matches} step={8} render={(st) => <NewsRow key={st.id} st={st} summary={false} />} />
            </div>
          )}
        </section>

        <section className="stack-12" aria-labelledby="fav-title">
          <div className="between">
            <h2 id="fav-title" className="t-h3">{t('favs.saved')}</h2>
            <span className="t-caption c-moderate">{favs.length}</span>
          </div>
          {favs.length > 6 && (
            <label className="search">
              <Icon name="search" size={20} />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)}  placeholder={t('favs.search')} aria-label={t('favs.searchAria')} />
            </label>
          )}
          {!favs.length ? (
            <Empty icon="favoris" title={t('favs.emptyTitle')} text={t('favs.emptyText')} />
          ) : (
            <div className="story-list">
              {shown.map((x) => {
                const c = favIn(x, lang);
                return (
                  <article key={x.id} className="story" style={{ ['--sc' as string]: `var(--sector-${x.sector})` }}>
                    <button type="button" className="story-main" onClick={() => openSheet('story:' + x.id)}>
                      <span className="story-meta">
                        {x.sector && <SectorTag id={x.sector} />}
                        <span>{c.source}</span><span aria-hidden="true">·</span><time dateTime={x.date}>{relTime(x.date, lang)}</time>
                        {c.other && <span className="badge outline" title={t('fav.otherLang', { lang: langName(x.lang === 'en' ? 'en' : 'fr', lang) })}>{x.lang.toUpperCase()}</span>}
                      </span>
                      <span className="story-title">{c.title}</span>
                    </button>
                    <div className="story-actions">
                      <button type="button" className="icon-btn star on" aria-label={t('fav.remove')} onClick={() => { removeFavorite(x.id); showToast(t('fav.removed'), { undo: () => restoreFavorite(x) }); }}>
                        <Icon name="favoris" size={22} fill />
                      </button>
                      {c.url && <a className="icon-btn neutral" href={c.url} target="_blank" rel="noopener noreferrer" aria-label={t('story.readOn', { src: c.source })}><Icon name="external" size={20} /></a>}
                    </div>
                  </article>
                );
              })}
              {!shown.length && <p className="c-neutral center">{t('favs.noMatch')}</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
