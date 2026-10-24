// « Réglages » : compte, thème, langue, secteurs suivis, journaux par secteur, résumés, données (dans cet ordre).
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Icon } from '../ui/icons';
import { AppHeader, Segmented, Switch, showToast } from '../ui/kit';
import { LeanTag, SECTORS, SECTOR_IDS, sectorText } from '../ui/news';
import { loadStatus, useFeed } from '../data/feed';
import { resetRead, setFollowed, setLang, setSectorOff, useUserState } from '../data/store';
import { signIn, signOut, syncNow, useSync } from '../data/sync';
import { onThemeChange, setThemePref, themePref, type ThemePref } from '../theme';
import { dateTime, relTime } from '../domain/format';
import { LEANS, type Lang, type Sector, type SourceInfo, type Status } from '../domain/types';
import { followedSectors, leanSpread, sourcesOfSector } from '../domain/select';
import { useT, type Key } from '../i18n';

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section className="card g8" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

/** Les résumés viennent-ils d'une IA ? (d'après la dernière édition publiée) */
function useAiOn(status: Status | null): boolean {
  const f = useFeed();
  return f.digest?.by === 'llm' || f.digest?.briefBy === 'llm' || (status?.totals.summaries.llm ?? 0) > 0;
}

// ------------------------------------------------------------------ 1. Compte & synchronisation
function Account() {
  const sync = useSync();
  const { t, lang } = useT();
  const [busy, setBusy] = useState(false);
  return (
    <Section id="s-account" title={t('set.account')}>
      {!sync.configured ? (
        <p className="c-neutral">{t('account.local')}</p>
      ) : sync.user ? (
        <>
          <div className="row">
            {sync.user.photo && <img src={sync.user.photo} alt="" width={40} height={40} style={{ borderRadius: '50%' }} referrerPolicy="no-referrer" />}
            <div className="grow stack-4"><span className="t-strong">{sync.user.name || t('account.google')}</span><span className="t-caption c-moderate ellipsis">{sync.user.email}</span></div>
          </div>
          <p className={'t-caption ' + (sync.state === 'error' ? 'c-critical' : 'c-moderate')} role="status">
            {sync.state === 'syncing' ? t('account.syncing') : sync.state === 'error' ? sync.error : sync.lastSync ? t('account.synced', { when: relTime(sync.lastSync, lang) }) : t('account.connected')}
          </p>
          <div className="grid-2 btns">
            <button type="button" className="btn btn-secondary" onClick={() => void syncNow()}><Icon name="refresh" size={18} />{t('account.sync')}</button>
            <button type="button" className="btn btn-secondary" onClick={() => void signOut()}><Icon name="logout" size={18} />{t('account.logout')}</button>
          </div>
        </>
      ) : (
        <>
          <p className="c-neutral">{t('account.intro')}</p>
          <button type="button" className="btn btn-primary" disabled={!sync.ready || busy} onClick={() => { setBusy(true); signIn().catch((e: Error) => showToast(e.message || t('account.signinFail'), { error: true })).finally(() => setBusy(false)); }}>
            <Icon name="cloud" size={18} />{t('account.signin')}
          </button>
          {sync.state === 'error' && <p className="t-caption c-critical">{sync.error}</p>}
        </>
      )}
    </Section>
  );
}

// ------------------------------------------------------------------ 2. Thème
function Appearance() {
  const pref = useSyncExternalStore(onThemeChange, themePref);
  const { t } = useT();
  return (
    <Section id="s-theme" title={t('set.theme')}>
      <Segmented<ThemePref> label={t('theme.label')} value={pref} onChange={setThemePref} options={[['system', t('theme.system')], ['light', t('theme.light')], ['dark', t('theme.dark')]]} />
    </Section>
  );
}

// ------------------------------------------------------------------ 3. Langue
function Language({ aiOn }: { aiOn: boolean }) {
  const { t, lang } = useT();
  return (
    <Section id="s-lang" title={t('set.lang')}>
      <Segmented<Lang> label={t('lang.label')} value={lang} onChange={setLang} options={[['fr', t('common.fr')], ['en', t('common.en')]]} />
      <p className="t-caption c-moderate">{t('lang.help')}</p>
      {!aiOn && <p className="t-caption c-moderate">{t('lang.noAi')}</p>}
    </Section>
  );
}

// ------------------------------------------------------------------ 4. Secteurs suivis
function FollowedSectors() {
  const user = useUserState();
  const { t, lang } = useT();
  const followed = followedSectors(SECTOR_IDS, user.prefs);
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...followed, id] : followed.filter((x) => x !== id);
    if (!next.length) { showToast(t('followed.min'), { error: true }); return; }
    setFollowed(SECTOR_IDS.filter((x) => next.includes(x)));
  };
  return (
    <Section id="s-sectors" title={t('set.followed')}>
      <p className="t-caption c-moderate">{t('followed.help')}</p>
      <ul className="divided">
        {SECTORS.map((s) => (
          <li key={s.id} className="setting-row">
            <span className="digest-icon" style={{ ['--sc' as string]: `var(--sector-${s.id})` }}><Icon name={s.icon} size={18} /></span>
            <span className="grow" id={'sec-' + s.id}>{sectorText(s, lang).name}</span>
            <Switch checked={followed.includes(s.id)} onChange={(v) => toggle(s.id, v)} labelledBy={'sec-' + s.id} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

// ------------------------------------------------------------------ 5. Sources (journaux suivis, secteur par secteur)
function LeanBar({ list }: { list: SourceInfo[] }) {
  const { t } = useT();
  const sp = leanSpread(list);
  const total = sp.left + sp.center + sp.right;
  if (!total) return null;
  const seg = (n: number, cls: string) => (n ? <span className={'bar-' + cls} style={{ flexGrow: n }} /> : null);
  return (
    <div className="stack-4" role="group" aria-label={t('src.spread')}>
      <div className="spreadbar" aria-hidden="true">{seg(sp.left, 'left')}{seg(sp.center, 'center')}{seg(sp.right, 'right')}</div>
      <p className="t-caption c-moderate">
        {t('src.spreadLeft')} {sp.left} · {t('src.spreadCenter')} {sp.center} · {t('src.spreadRight')} {sp.right}{sp.unknown ? ` · ${t('src.spreadOther')} ${sp.unknown}` : ''}
      </p>
    </div>
  );
}

function SectorSources({ sector, sources, status }: { sector: Sector; sources: SourceInfo[]; status: Map<string, Status['sources'][number]> }) {
  const user = useUserState();
  const { t, lang } = useT();
  const off = user.prefs.off[sector.id] ?? [];
  const on = sources.filter((s) => !off.includes(s.id));
  const tx = sectorText(sector, lang);
  const set = (id: string, present: boolean) => setSectorOff(sector.id, present ? off.filter((x) => x !== id) : [...off, id]);
  return (
    <details className="more sector-sources" style={{ ['--sc' as string]: `var(--sector-${sector.id})` }}>
      <summary aria-label={t('src.sectorOpen', { name: tx.name })}>
        <span className="row" style={{ gap: 'var(--space-12)' }}>
          <span className="digest-icon"><Icon name={sector.icon} size={18} /></span>
          <span className="stack-4">
            <span>{tx.name}</span>
            <span className="t-caption c-moderate">{t('src.count', { on: on.length, total: sources.length })}{off.length ? ` · ${t('src.hiddenN', { n: off.length })}` : ''}</span>
          </span>
        </span>
        <Icon name="down" size={18} />
      </summary>
      <div className="stack-12" style={{ paddingBottom: 'var(--space-8)' }}>
        {sector.opinion && <LeanBar list={on} />}
        <div className="row" style={{ gap: 'var(--space-8)' }}>
          <button type="button" className="chip" onClick={() => setSectorOff(sector.id, [])} disabled={!off.length}>{t('src.allOn')}</button>
          <button type="button" className="chip" onClick={() => setSectorOff(sector.id, sources.map((s) => s.id))} disabled={off.length === sources.length}>{t('src.allOff')}</button>
        </div>
        <ul className="divided">
          {sources.map((s) => {
            const st = status.get(s.id);
            const failed = st ? !st.ok : false;
            return (
              <li key={s.id} className="setting-row source-row">
                <span className={'status-dot ' + (failed ? 'ko' : 'ok')} role="img" aria-label={failed ? t('src.fail') : t('src.ok')} />
                <span className="grow stack-4">
                  <span id={`src-${sector.id}-${s.id}`}>{s.name}</span>
                  <span className="t-caption c-moderate src-meta">
                    {sector.opinion && <LeanTag lean={s.lean} long />}
                    <span>{t(('kind.' + s.kind) as Key) === ('kind.' + s.kind) ? s.kind : t(('kind.' + s.kind) as Key)}</span>
                    <span className="badge outline">{s.lang.toUpperCase()}</span>
                    {failed && <span>· {st?.error || t('src.unreadable')}</span>}
                  </span>
                </span>
                <Switch checked={!off.includes(s.id)} onChange={(v) => set(s.id, v)} labelledBy={`src-${sector.id}-${s.id}`} />
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

function Sources({ status }: { status: Status | null }) {
  const f = useFeed();
  const { t, lang } = useT();
  const statusById = useMemo(() => new Map((status?.sources ?? []).map((s) => [s.id, s])), [status]);
  return (
    <Section id="s-src" title={t('set.sources')}>
      <p className="c-neutral">{t('src.intro')}</p>
      {status
        ? <p className="t-caption c-moderate">{t('src.status', { ok: status.totals.ok, total: status.totals.sources, date: dateTime(status.generatedAt, lang) })}</p>
        : <p className="t-caption c-moderate">{t('src.loadingStatus')}</p>}
      <p className="t-caption c-moderate">{t('src.disclaimer')}</p>
      <div className="divided">
        {SECTORS.map((s) => {
          const list = sourcesOfSector(f.sources, s.id);
          if (!list.length) return null;
          const ordered = s.opinion ? [...list].sort((a, b) => (a.lean ? LEANS.indexOf(a.lean) : 9) - (b.lean ? LEANS.indexOf(b.lean) : 9) || a.name.localeCompare(b.name)) : list;
          return <SectorSources key={s.id} sector={s} sources={ordered} status={statusById} />;
        })}
      </div>
    </Section>
  );
}

// ------------------------------------------------------------------ 6. Résumé
function Summaries({ status, aiOn }: { status: Status | null; aiOn: boolean }) {
  const { t, lang } = useT();
  const s = status?.totals.summaries;
  return (
    <Section id="s-sum" title={t('set.summary')}>
      <p className="c-neutral">{aiOn ? t('sum.ai') : t('sum.noAi', { lang: t(lang === 'fr' ? 'name.fr' : 'name.en') })}</p>
      {s && <p className="t-caption c-moderate">{t('sum.last', { llm: s.llm, ext: s.extractive })}{status?.llm?.used ? t('sum.model', { m: status.llm.used }) : ''}</p>}
    </Section>
  );
}

// ------------------------------------------------------------------ 7. Données
function Data() {
  const user = useUserState();
  const f = useFeed();
  const { t, lang } = useT();
  const reload = async () => {
    try {
      const regs = await navigator.serviceWorker?.getRegistrations?.();
      await Promise.all((regs ?? []).map((r) => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('vigie-')).map((k) => caches.delete(k)));
    } catch { /* pas de cache */ }
    location.reload();
  };
  return (
    <Section id="s-data" title={t('set.data')}>
      <p className="t-caption c-moderate">{t('data.line', { read: Object.keys(user.read).length, n: f.feed ? f.feed.stories.length : 0, ed: f.feed ? t('data.edition', { date: dateTime(f.feed.generatedAt, lang) }) : '' })}</p>
      <div className="grid-2 btns">
        <button type="button" className="btn btn-secondary" onClick={() => { resetRead(); showToast(t('data.resetDone')); }}>{t('data.resetRead')}</button>
        <button type="button" className="btn btn-secondary" onClick={() => void reload()}>{t('data.reload')}</button>
      </div>
    </Section>
  );
}

export function SettingsScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  const { t } = useT();
  useEffect(() => { void loadStatus().then(setStatus); }, []);
  const aiOn = useAiOn(status);
  return (
    <div className="screen">
      <AppHeader title={t('set.title')} />
      <div className="content">
        <Account />
        <Appearance />
        <Language aiOn={aiOn} />
        <FollowedSectors />
        <Sources status={status} />
        <Summaries status={status} aiOn={aiOn} />
        <Data />
        <p className="t-caption c-moderate center">{t('footer')}</p>
      </div>
    </div>
  );
}
