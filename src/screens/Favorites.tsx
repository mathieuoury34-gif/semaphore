// « Favoris » : sujets mis de côté (conservés même après leur sortie du flux) et mots suivis.
import { useMemo, useState } from 'react';
import { Icon } from '../ui/icons';
import { AppHeader, Empty, showToast } from '../ui/kit';
import { openSheet } from '../ui/router';
import { NewsRow, PagedList, SectorTag } from '../ui/news';
import { useFeed } from '../data/feed';
import { removeFavorite, restoreFavorite, setKeywords, useUserState } from '../data/store';
import { activeFavorites } from '../domain/state';
import { keywordMatches } from '../domain/select';
import { relTime } from '../domain/format';
import { matchesQuery, norm } from '../domain/text';

export function FavoritesScreen() {
  const user = useUserState();
  const f = useFeed();
  const [q, setQ] = useState('');
  const [kw, setKw] = useState('');
  const favs = activeFavorites(user);
  const shown = useMemo(() => (q.trim() ? favs.filter((x) => matchesQuery(norm(x.title + ' ' + x.summary + ' ' + x.source), q)) : favs), [favs, q]);
  const matches = useMemo(() => (f.feed ? keywordMatches(f.feed, user.prefs.keywords) : []), [f.feed, user.prefs.keywords]);

  const addKw = (e: React.FormEvent) => {
    e.preventDefault();
    const v = kw.trim().slice(0, 40);
    if (!v) return;
    if (user.prefs.keywords.some((k) => norm(k) === norm(v))) { showToast('Déjà suivi'); return; }
    if (user.prefs.keywords.length >= 30) { showToast('30 mots suivis au maximum', { error: true }); return; }
    setKeywords([...user.prefs.keywords, v]);
    setKw('');
  };

  return (
    <div className="screen">
      <AppHeader title="Favoris" />
      <div className="content">
        <section className="card g8" aria-labelledby="kw-title">
          <h2 id="kw-title">Mots suivis</h2>
          <p className="t-caption c-moderate">Un nom, une entreprise, un sujet : tous les sujets du flux qui le contiennent sont listés ici, tous secteurs confondus.</p>
          <form className="row" onSubmit={addKw}>
            <input className="input grow" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="ex. Ariane 6, hydrogène, stage" aria-label="Nouveau mot suivi" maxLength={40} enterKeyHint="done" />
            <button type="submit" className="btn btn-primary" aria-label="Ajouter le mot"><Icon name="plus" size={20} /></button>
          </form>
          {user.prefs.keywords.length > 0 && (
            <div className="row wrap" style={{ gap: 'var(--space-6)' }}>
              {user.prefs.keywords.map((k) => (
                <button key={k} type="button" className="chip kw" aria-label={`Ne plus suivre « ${k} »`} onClick={() => setKeywords(user.prefs.keywords.filter((x) => x !== k))}>
                  {k}<Icon name="close" size={14} />
                </button>
              ))}
            </div>
          )}
          {user.prefs.keywords.length > 0 && f.feed && (
            <div className="stack-8">
              <h3 className="overline c-neutral">{matches.length ? `${matches.length} sujet${matches.length > 1 ? 's' : ''} correspondent` : 'Aucun sujet pour le moment'}</h3>
              <PagedList items={matches} step={8} render={(st) => <NewsRow key={st.id} st={st} summary={false} />} />
            </div>
          )}
        </section>

        <section className="stack-12" aria-labelledby="fav-title">
          <div className="between">
            <h2 id="fav-title" className="t-h3">Mis de côté</h2>
            <span className="t-caption c-moderate">{favs.length}</span>
          </div>
          {favs.length > 6 && (
            <label className="search">
              <Icon name="search" size={20} />
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher dans mes favoris" aria-label="Chercher dans les favoris" />
            </label>
          )}
          {!favs.length ? (
            <Empty icon="favoris" title="Aucun favori" text="Touchez l'étoile d'un sujet pour le garder ici, même quand il aura disparu du flux." />
          ) : (
            <div className="story-list">
              {shown.map((x) => (
                <article key={x.id} className="story" style={{ ['--sc' as string]: `var(--sector-${x.sector})` }}>
                  <button type="button" className="story-main" onClick={() => openSheet('story:' + x.id)}>
                    <span className="story-meta">
                      {x.sector && <SectorTag id={x.sector} />}
                      <span>{x.source}</span><span aria-hidden="true">·</span><time dateTime={x.date}>{relTime(x.date)}</time>
                    </span>
                    <span className="story-title">{x.title}</span>
                  </button>
                  <div className="story-actions">
                    <button type="button" className="icon-btn star on" aria-label="Retirer des favoris" onClick={() => { removeFavorite(x.id); showToast('Retiré des favoris', { undo: () => restoreFavorite(x) }); }}>
                      <Icon name="favoris" size={22} fill />
                    </button>
                    {x.url && <a className="icon-btn neutral" href={x.url} target="_blank" rel="noopener noreferrer" aria-label={`Lire sur ${x.source}`}><Icon name="external" size={20} /></a>}
                  </div>
                </article>
              ))}
              {!shown.length && <p className="c-neutral center">Aucun favori ne correspond.</p>}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
