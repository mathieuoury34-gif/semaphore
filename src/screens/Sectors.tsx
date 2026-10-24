// « Secteurs » : grille des secteurs, recherche, puis flux d'un secteur.
import { useMemo, useState } from 'react';
import { Icon } from '../ui/icons';
import { AppHeader, DataBanner, Empty, Segmented, SubHeader } from '../ui/kit';
import { navigate } from '../ui/router';
import { NewsRow, PagedList, SECTORS, SECTOR_IDS, sectorById, sectorStyle } from '../ui/news';
import { useFeed } from '../data/feed';
import { markAllRead, useUserState } from '../data/store';
import { followedSectors, newCount, searchAll, sectorStories, type SortMode } from '../domain/select';
import { plural } from '../domain/format';

export function SectorsScreen() {
  const f = useFeed();
  const user = useUserState();
  const [q, setQ] = useState('');
  const followed = followedSectors(SECTOR_IDS, user.prefs);
  const results = useMemo(() => (f.feed && q.trim().length >= 2 ? searchAll(f.feed, q, followed) : null), [f.feed, q, followed]);

  return (
    <div className="screen">
      <AppHeader title="Secteurs" />
      <DataBanner />
      <div className="content">
        <label className="search">
          <Icon name="search" size={20} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher dans l'actualité" aria-label="Rechercher" enterKeyHint="search" />
          {q && <button type="button" className="icon-btn neutral" aria-label="Effacer" style={{ width: 32, height: 32, margin: '0 -8px 0 0' }} onClick={() => setQ('')}><Icon name="close" size={18} /></button>}
        </label>
        {results ? (
          <>
            <p className="t-caption c-moderate">{plural(results.length, 'résultat')}{results.length >= 80 ? ' (les plus récents)' : ''}</p>
            <PagedList items={results} render={(st) => <NewsRow key={st.id} st={st} />} empty={<Empty icon="search" title="Aucun résultat" text="Essayez un autre mot, ou moins de mots." />} />
          </>
        ) : (
          <div className="tiles">
            {followed.map((id) => {
              const s = sectorById(id)!;
              const n = f.feed ? newCount(f.feed, id, user.read) : 0;
              return (
                <button key={id} type="button" className="sector-tile" style={sectorStyle(id)} onClick={() => navigate('/secteurs/' + id)}>
                  <span className="tile-icon"><Icon name={s.icon} size={24} /></span>
                  <span className="tile-name">{s.name}</span>
                  <span className="tile-desc">{s.description}</span>
                  <span className={'tile-count' + (n ? ' has' : '')}>{n ? (n > 99 ? '99+ nouveaux' : plural(n, 'nouveau', 'nouveaux')) : 'À jour'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function SectorScreen({ id }: { id: string }) {
  const f = useFeed();
  const user = useUserState();
  const s = sectorById(id);
  const [sort, setSort] = useState<SortMode>('top');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => (f.feed ? sectorStories(f.feed, id, { sort, unreadOnly, read: user.read, query: q.trim() }) : []), [f.feed, id, sort, unreadOnly, user.read, q]);
  if (!s) { return <div className="screen"><SubHeader title="Secteur" fallback="/secteurs" /><Empty title="Secteur inconnu" text="Ce secteur n'existe pas." action={<button className="btn btn-primary" onClick={() => navigate('/secteurs', { replace: true })}>Retour</button>} /></div>; }
  const unread = list.filter((st) => !user.read[st.id]);
  return (
    <div className="screen">
      <SubHeader title={s.name} fallback="/secteurs" />
      <DataBanner />
      <div className="subnav bordered" style={sectorStyle(id)}>
        <Segmented<SortMode> label="Tri" value={sort} onChange={setSort} options={[['top', 'Importants'], ['recent', 'Récents']]} />
        <div className="row wrap" style={{ gap: 'var(--space-8)' }}>
          <button type="button" className="chip" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(!unreadOnly)}>Non lus</button>
          <label className="search small grow">
            <Icon name="search" size={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Chercher en ${s.short}`} aria-label="Rechercher dans le secteur" />
          </label>
        </div>
      </div>
      <div className="content">
        <p className="t-caption c-moderate">{s.description}</p>
        <PagedList items={list} render={(st) => <NewsRow key={st.id} st={st} showSector={false} />}
          empty={<Empty icon={unreadOnly ? 'success' : 'inbox'} title={unreadOnly ? 'Tout est lu' : 'Rien ici'} text={unreadOnly ? 'Aucun sujet non lu dans ce secteur.' : 'Aucun sujet ne correspond.'} />} />
        {unread.length > 0 && !q && (
          <button type="button" className="btn btn-tertiary" onClick={() => markAllRead(unread.map((u) => u.id))}>
            <Icon name="check" size={18} />Tout marquer comme lu
          </button>
        )}
      </div>
    </div>
  );
}

export { SECTORS };
