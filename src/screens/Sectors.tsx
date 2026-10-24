// « Secteurs » : grille des secteurs, recherche, puis flux d'un secteur.
import { useMemo, useState } from 'react';
import { Icon } from '../ui/icons';
import { AppHeader, DataBanner, Empty, Segmented, SubHeader } from '../ui/kit';
import { navigate } from '../ui/router';
import { NewsRow, PagedList, SECTORS, SECTOR_IDS, sectorById, sectorStyle, sectorText } from '../ui/news';
import { useFeed } from '../data/feed';
import { markAllRead, useUserState } from '../data/store';
import { followedSectors, newCount, searchAll, sectorStories, viewOf, type SortMode } from '../domain/select';
import { useT } from '../i18n';

export function SectorsScreen() {
  const f = useFeed();
  const user = useUserState();
  const { t, lang } = useT();
  const [q, setQ] = useState('');
  const followed = followedSectors(SECTOR_IDS, user.prefs);
  const v = useMemo(() => viewOf(user.prefs), [user.prefs]);
  const results = useMemo(() => (f.feed && q.trim().length >= 2 ? searchAll(f.feed, q, followed, v) : null), [f.feed, q, followed, v]);

  return (
    <div className="screen">
      <AppHeader title={t('sectors.title')} />
      <DataBanner />
      <div className="content">
        <label className="search">
          <Icon name="search" size={20} />
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('sectors.search')} aria-label={t('common.search')} enterKeyHint="search" />
          {q && <button type="button" className="icon-btn neutral" aria-label={t('common.clear')} style={{ width: 32, height: 32, margin: '0 -8px 0 0' }} onClick={() => setQ('')}><Icon name="close" size={18} /></button>}
        </label>
        {results ? (
          <>
            <p className="t-caption c-moderate">{t('sectors.results', { n: results.length })}{results.length >= 80 ? t('sectors.latest') : ''}</p>
            <PagedList items={results} render={(st) => <NewsRow key={st.id} st={st} />} empty={<Empty icon="search"  title={t('sectors.noResultTitle')} text={t('sectors.noResultText')} />} />
          </>
        ) : (
          <div className="tiles">
            {followed.map((id) => {
              const s = sectorById(id)!;
              const n = f.feed ? newCount(f.feed, id, user.read, v) : 0;
              const tx = sectorText(s, lang);
              return (
                <button key={id} type="button" className="sector-tile" style={sectorStyle(id)} onClick={() => navigate('/secteurs/' + id)}>
                  <span className="tile-icon"><Icon name={s.icon} size={24} /></span>
                  <span className="tile-name">{tx.name}</span>
                  <span className="tile-desc">{tx.description}</span>
                  <span className={'tile-count' + (n ? ' has' : '')}>{n ? (n > 99 ? t('sectors.new99') : t('sectors.new', { n })) : t('sectors.upToDate')}</span>
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
  const { t, lang } = useT();
  const s = sectorById(id);
  const v = useMemo(() => viewOf(user.prefs), [user.prefs]);
  const [sort, setSort] = useState<SortMode>('top');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [q, setQ] = useState('');
  const list = useMemo(() => (f.feed ? sectorStories(f.feed, id, v, { sort, unreadOnly, read: user.read, query: q.trim() }) : []), [f.feed, id, v, sort, unreadOnly, user.read, q]);
  if (!s) { return <div className="screen"><SubHeader title={t('tab.secteurs')} fallback="/secteurs" /><Empty title={t('sector.unknown')} text={t('sector.unknownText')} action={<button className="btn btn-primary" onClick={() => navigate('/secteurs', { replace: true })}>{t('common.back')}</button>} /></div>; }
  const unread = list.filter((st) => !user.read[st.id]);
  const tx = sectorText(s, lang);
  const hidden = user.prefs.off[id]?.length ?? 0;
  return (
    <div className="screen">
      <SubHeader title={tx.name} fallback="/secteurs" />
      <DataBanner />
      <div className="subnav bordered" style={sectorStyle(id)}>
        <Segmented<SortMode> label={t('sector.sort')} value={sort} onChange={setSort} options={[['top', t('sector.top')], ['recent', t('sector.recent')]]} />
        <div className="row wrap" style={{ gap: 'var(--space-8)' }}>
          <button type="button" className="chip" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(!unreadOnly)}>{t('sector.unread')}</button>
          <label className="search small grow">
            <Icon name="search" size={18} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)}  placeholder={t('sector.searchIn', { name: tx.short })} aria-label={t('sector.searchAria')} />
          </label>
        </div>
      </div>
      <div className="content">
        <p className="t-caption c-moderate">{tx.description}</p>
        {hidden > 0 && <p className="t-caption c-moderate">{t('sector.hidden')}</p>}
        <PagedList items={list} render={(st) => <NewsRow key={st.id} st={st} showSector={false} />}
          empty={<Empty icon={unreadOnly ? 'success' : 'inbox'} title={unreadOnly ? t('sector.allRead') : t('sector.empty')} text={unreadOnly ? t('sector.allReadText') : t('sector.emptyText')} />} />
        {unread.length > 0 && !q && (
          <button type="button" className="btn btn-tertiary" onClick={() => markAllRead(unread.map((u) => u.id))}>
            <Icon name="check" size={18} />{t('sector.markAll')}
          </button>
        )}
      </div>
    </div>
  );
}

export { SECTORS };
