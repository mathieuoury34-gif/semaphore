// « À la une » : le brief du jour (lecture de 2 minutes) puis un résumé par secteur suivi.
import { Icon } from '../ui/icons';
import { AppHeader, DataBanner, Empty } from '../ui/kit';
import { navigate, openSheet } from '../ui/router';
import { SECTORS, SectorTag, UnreadDot, sectorById, sectorStyle } from '../ui/news';
import { loadData, useFeed } from '../data/feed';
import { useUserState } from '../data/store';
import { dateFull, edition } from '../domain/format';
import { followedSectors, sectorStories, storyTitle } from '../domain/select';
import type { Bullet } from '../domain/types';

function BulletRow({ b, sector, light }: { b: Bullet; sector?: string; light?: boolean }) {
  const f = useFeed();
  const user = useUserState();
  const id = b.ids.find((i) => f.byId.has(i));
  const st = id ? f.byId.get(id) : undefined;
  const en = st && st.lang === 'en' && f.digest?.by !== 'llm' && !st.titleFr;
  const inner = (
    <>
      {sector && <span className="bullet-dot" style={sectorStyle(sector)} aria-hidden="true" />}
      <span className="bullet-text">
        {sector && <span className="bullet-sector">{sectorById(sector)?.short}</span>}
        {id && !user.read[id] && <UnreadDot />}
        {b.text}
        {en && <span className="badge outline en">EN</span>}
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
  const followed = followedSectors(SECTORS.map((s) => s.id), user.prefs);

  if (f.phase === 'loading') {
    return (
      <div className="screen">
        <AppHeader title="À la une" />
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
        <AppHeader title="À la une" />
        <Empty icon="alert" title="Données indisponibles" text={f.error ? `Impossible de charger l'actualité (${f.error}).` : 'Aucune édition publiée pour le moment.'}
          action={<button type="button" className="btn btn-primary" onClick={() => void loadData({ force: true })}>Réessayer</button>} />
      </div>
    );
  }

  const brief = (f.digest?.brief ?? []).filter((b) => followed.includes(b.sector));
  const fallback = !brief.length;
  const briefRows: { b: Bullet; sector: string }[] = fallback
    ? followed.slice(0, 8).flatMap((id) => sectorStories(f.feed!, id)[0] ? [{ sector: id, b: { text: storyTitle(sectorStories(f.feed!, id)[0]), ids: [sectorStories(f.feed!, id)[0].id] } }] : [])
    : brief.map((b) => ({ b, sector: b.sector }));

  return (
    <div className="screen">
      <AppHeader title="À la une" />
      <DataBanner />
      <div className="content">
        <section className="brief-card" aria-label="Brief du jour">
          <div className="stack-4">
            <span className="overline">{edition(f.feed.generatedAt)} · {dateFull(f.feed.generatedAt)}</span>
            <h2 className="t-h2">L'essentiel en 2 minutes</h2>
          </div>
          <div className="bullets">
            {briefRows.map((r, i) => <BulletRow key={i} b={r.b} sector={r.sector} light />)}
          </div>
          {!briefRows.length && <p>Rien à signaler dans les secteurs suivis.</p>}
        </section>

        <div className="digest-grid">
          {followed.map((id) => {
            const s = sectorById(id)!;
            const d = f.digest?.sectors[id];
            const bullets: Bullet[] = d?.bullets.length
              ? d.bullets
              : sectorStories(f.feed!, id).slice(0, 3).map((st) => ({ text: storyTitle(st), ids: [st.id] }));
            if (!bullets.length) return null;
            return (
              <section key={id} className="card g8 digest-card" style={sectorStyle(id)} aria-label={s.name}>
                <div className="between">
                  <h2 className="digest-title"><span className="digest-icon"><Icon name={s.icon} size={18} /></span>{s.name}</h2>
                  <button type="button" className="btn-tertiary see-all" onClick={() => navigate('/secteurs/' + id)}>Tout voir<Icon name="next" size={16} /></button>
                </div>
                <div className="bullets">
                  {bullets.map((b, i) => <BulletRow key={i} b={b} />)}
                </div>
              </section>
            );
          })}
        </div>
        {f.digest && f.digest.by !== 'llm' && (
          <p className="t-caption c-moderate center">Résumés générés à partir des titres : voir Réglages › Résumés pour activer les résumés en français par IA.</p>
        )}
      </div>
    </div>
  );
}

export { SectorTag };
