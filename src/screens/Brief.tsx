// « À la une » : le brief du jour (lecture de 2 minutes) puis un résumé par secteur suivi.
import { Icon } from '../ui/icons';
import { AppHeader, DataBanner, Empty } from '../ui/kit';
import { navigate, openSheet } from '../ui/router';
import { SECTORS, SectorTag, UnreadDot, sectorById, sectorStyle, sectorText } from '../ui/news';
import { loadData, useFeed } from '../data/feed';
import { useUserState } from '../data/store';
import { dateFull, edition } from '../domain/format';
import { digestOf, followedSectors, localBullets, sectorStories, storyTitle, viewOf } from '../domain/select';
import { useT } from '../i18n';

interface Row { text: string; ids: string[] }

function BulletRow({ b, sector, light }: { b: Row; sector?: string; light?: boolean }) {
  const user = useUserState();
  const { lang } = useT();
  const id = b.ids[0];
  const inner = (
    <>
      {sector && <span className="bullet-dot" style={sectorStyle(sector)} aria-hidden="true" />}
      <span className="bullet-text">
        {sector && <span className="bullet-sector">{sectorText(sectorById(sector)!, lang).short}</span>}
        {id && !user.read[id] && <UnreadDot />}
        {b.text}
      </span>
      {id && <Icon name="next" size={18} />}
    </>
  );
  const cls = 'bullet' + (light ? ' light' : '');
  return id
    ? <button type="button" className={cls} onClick={() => openSheet('story:' + id)}>{inner}</button>
    : <div className={cls}>{inner}</div>;
}

export function BriefScreen() {
  const f = useFeed();
  const user = useUserState();
  const { t, lang } = useT();
  const followed = followedSectors(SECTORS.map((s) => s.id), user.prefs);
  const v = viewOf(user.prefs);

  if (f.phase === 'loading') {
    return (
      <div className="screen">
        <AppHeader title={t('brief.title')} />
        <div className="content" aria-busy="true">
          <div className="skel" style={{ height: 280, borderRadius: 16 }} />
          <div className="skel" style={{ height: 160, borderRadius: 16 }} />
          <div className="skel" style={{ height: 160, borderRadius: 16 }} />
        </div>
      </div>
    );
  }
  if (!f.feed) {
    return (
      <div className="screen">
        <AppHeader title={t('brief.title')} />
        <Empty icon="alert" title={t('common.unavailable')} text={f.error ? t('brief.loadFail', { err: f.error }) : t('brief.noData')}
          action={<button type="button" className="btn btn-primary" onClick={() => void loadData({ force: true })}>{t('common.retry')}</button>} />
      </div>
    );
  }
  const feed = f.feed;

  const fromDigest = localBullets((f.digest?.brief ?? []).filter((b) => followed.includes(b.sector)), undefined, v, f.byId);
  const briefRows: { b: Row; sector: string }[] = fromDigest.length
    ? fromDigest.map((b) => ({ b, sector: b.sector! }))
    : followed.slice(0, 8).flatMap((id) => {
      const top = sectorStories(feed, id, v)[0];
      return top ? [{ sector: id, b: { text: storyTitle(top, lang), ids: [top.id] } }] : [];
    });
  const aiOn = f.digest?.briefBy === 'llm' || f.digest?.by === 'llm';

  return (
    <div className="screen">
      <AppHeader title={t('brief.title')} />
      <DataBanner />
      <div className="content">
        <section className="brief-card" aria-label={t('brief.label')}>
          <div className="stack-4">
            <span className="overline">{t(edition(feed.generatedAt) === 'morning' ? 'brief.morning' : 'brief.evening')} · {dateFull(feed.generatedAt, lang)}</span>
            <h2 className="t-h2">{t('brief.essential')}</h2>
          </div>
          <div className="bullets">
            {briefRows.map((r, i) => <BulletRow key={i} b={r.b} sector={r.sector} light />)}
          </div>
          {!briefRows.length && <p>{t('brief.nothing')}</p>}
        </section>

        <div className="digest-grid">
          {followed.map((id) => {
            const s = sectorById(id)!;
            let bullets: Row[] = localBullets(digestOf(f.digest, id), id, v, f.byId);
            if (!bullets.length) bullets = sectorStories(feed, id, v).slice(0, 3).map((st) => ({ text: storyTitle(st, lang), ids: [st.id] }));
            if (!bullets.length) return null;
            return (
              <section key={id} className="card g8 digest-card" style={sectorStyle(id)} aria-label={sectorText(s, lang).name}>
                <div className="between">
                  <h2 className="digest-title"><span className="digest-icon"><Icon name={s.icon} size={18} /></span>{sectorText(s, lang).name}</h2>
                  <button type="button" className="btn-tertiary see-all" onClick={() => navigate('/secteurs/' + id)}>{t('brief.all')}<Icon name="next" size={16} /></button>
                </div>
                <div className="bullets">
                  {bullets.map((b, i) => <BulletRow key={i} b={b} />)}
                </div>
              </section>
            );
          })}
        </div>
        {!aiOn && <p className="t-caption c-moderate center">{t('brief.plain')}</p>}
      </div>
    </div>
  );
}

export { SectorTag };
