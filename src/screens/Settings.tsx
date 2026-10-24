// « Réglages » : secteurs suivis, apparence, compte, santé des sources, données.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Icon } from '../ui/icons';
import { AppHeader, Segmented, Switch, showToast } from '../ui/kit';
import { SECTORS, SECTOR_IDS } from '../ui/news';
import { loadStatus, useFeed } from '../data/feed';
import { resetRead, setFollowed, useUserState } from '../data/store';
import { signIn, signOut, syncNow, useSync } from '../data/sync';
import { onThemeChange, setThemePref, themePref, type ThemePref } from '../theme';
import { dateTimeFr, relTime } from '../domain/format';
import type { Status } from '../domain/types';
import { followedSectors } from '../domain/select';

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section className="card g8" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </section>
  );
}

function Sectors() {
  const user = useUserState();
  const followed = followedSectors(SECTOR_IDS, user.prefs);
  const toggle = (id: string, on: boolean) => {
    const next = on ? [...followed, id] : followed.filter((x) => x !== id);
    if (!next.length) { showToast('Gardez au moins un secteur', { error: true }); return; }
    setFollowed(SECTOR_IDS.filter((x) => next.includes(x)));
  };
  return (
    <Section id="s-sectors" title="Secteurs suivis">
      <p className="t-caption c-moderate">Les secteurs désactivés disparaissent de « À la une » et de la recherche.</p>
      <ul className="divided">
        {SECTORS.map((s) => (
          <li key={s.id} className="setting-row">
            <span className="digest-icon" style={{ ['--sc' as string]: `var(--sector-${s.id})` }}><Icon name={s.icon} size={18} /></span>
            <span className="grow" id={'sec-' + s.id}>{s.name}</span>
            <Switch checked={followed.includes(s.id)} onChange={(v) => toggle(s.id, v)} labelledBy={'sec-' + s.id} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Appearance() {
  const pref = useSyncExternalStore(onThemeChange, themePref);
  return (
    <Section id="s-theme" title="Apparence">
      <Segmented<ThemePref> label="Thème" value={pref} onChange={setThemePref} options={[['system', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']]} />
    </Section>
  );
}

function Account() {
  const sync = useSync();
  const [busy, setBusy] = useState(false);
  return (
    <Section id="s-account" title="Compte et synchronisation">
      {!sync.configured ? (
        <p className="c-neutral">Mode local : favoris et lectures restent sur cet appareil. Voir le README pour activer la synchronisation gratuite (Google).</p>
      ) : sync.user ? (
        <>
          <div className="row">
            {sync.user.photo && <img src={sync.user.photo} alt="" width={40} height={40} style={{ borderRadius: '50%' }} referrerPolicy="no-referrer" />}
            <div className="grow stack-4"><span className="t-strong">{sync.user.name || 'Compte Google'}</span><span className="t-caption c-moderate ellipsis">{sync.user.email}</span></div>
          </div>
          <p className={'t-caption ' + (sync.state === 'error' ? 'c-critical' : 'c-moderate')} role="status">
            {sync.state === 'syncing' ? 'Synchronisation…' : sync.state === 'error' ? sync.error : sync.lastSync ? `Synchronisé ${relTime(sync.lastSync)}` : 'Connecté'}
          </p>
          <div className="grid-2 btns">
            <button type="button" className="btn btn-secondary" onClick={() => void syncNow()}><Icon name="refresh" size={18} />Synchroniser</button>
            <button type="button" className="btn btn-secondary" onClick={() => void signOut()}><Icon name="logout" size={18} />Déconnexion</button>
          </div>
        </>
      ) : (
        <>
          <p className="c-neutral">Connectez-vous avec Google pour retrouver vos favoris et vos lectures sur le téléphone et l'ordinateur. Rien n'est partagé : seuls vos favoris, lectures et réglages sont stockés.</p>
          <button type="button" className="btn btn-primary" disabled={!sync.ready || busy} onClick={() => { setBusy(true); signIn().catch((e: Error) => showToast(e.message || 'Connexion impossible', { error: true })).finally(() => setBusy(false)); }}>
            <Icon name="cloud" size={18} />Continuer avec Google
          </button>
          {sync.state === 'error' && <p className="t-caption c-critical">{sync.error}</p>}
        </>
      )}
    </Section>
  );
}

function Summaries({ status }: { status: Status | null }) {
  const f = useFeed();
  const t = status?.totals.summaries;
  const llm = status?.llm;
  const mode = f.digest?.by === 'llm' || (t && t.llm > 0) ? 'ia' : 'extraits';
  return (
    <Section id="s-sum" title="Résumés">
      <p className="c-neutral">
        {mode === 'ia'
          ? 'Les résumés sont rédigés en français par une IA gratuite à partir du texte des articles.'
          : 'Les résumés sont pour l\'instant des extraits des articles (les sujets en anglais restent en anglais, repérés par « EN »). Pour des résumés rédigés en français, ajoutez une clé gratuite Gemini dans GitHub (voir le README).'}
      </p>
      {t && <p className="t-caption c-moderate">Dernière édition : {t.llm} résumé{t.llm > 1 ? 's' : ''} IA, {t.extractive} extrait{t.extractive > 1 ? 's' : ''}.{llm?.model ? ` Modèle : ${llm.model}.` : ''}</p>}
    </Section>
  );
}

function Sources({ status }: { status: Status | null }) {
  const f = useFeed();
  if (!status) return <Section id="s-src" title="Sources"><p className="c-moderate">Chargement de l'état des sources…</p></Section>;
  const bad = status.sources.filter((s) => !s.ok);
  return (
    <Section id="s-src" title="Sources">
      <p className="c-neutral">{status.totals.ok} source{status.totals.ok > 1 ? 's' : ''} sur {status.totals.sources} lue{status.totals.ok > 1 ? 's' : ''} lors de la dernière édition ({dateTimeFr(status.generatedAt)}).</p>
      {bad.length > 0 && (
        <ul className="divided" aria-label="Sources en échec">
          {bad.map((s) => (
            <li key={s.id} className="setting-row">
              <Icon name="alert" size={18} style={{ color: 'var(--warning-text)' }} />
              <span className="grow stack-4"><span className="t-strong">{s.name}</span><span className="t-caption c-moderate">{s.error || 'illisible'}</span></span>
            </li>
          ))}
        </ul>
      )}
      <details className="more">
        <summary>Toutes les sources<Icon name="down" size={18} /></summary>
        <ul className="divided">
          {status.sources.map((s) => (
            <li key={s.id} className="setting-row">
              <span className={'status-dot ' + (s.ok ? 'ok' : 'ko')} role="img" aria-label={s.ok ? 'Lue' : 'En échec'} />
              <span className="grow stack-4"><span className="t-body">{s.name}</span><span className="t-caption c-moderate">{f.sources.get(s.id)?.kind ?? ''}{s.lastOk ? ` · ${relTime(s.lastOk)}` : ''}</span></span>
              <span className="t-caption c-moderate">{s.ok ? `${s.items} art.` : '—'}</span>
            </li>
          ))}
        </ul>
      </details>
    </Section>
  );
}

function Data() {
  const user = useUserState();
  const f = useFeed();
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
    <Section id="s-data" title="Données">
      <p className="t-caption c-moderate">{Object.keys(user.read).length} sujets lus mémorisés (14 jours) · {f.feed ? f.feed.stories.length : 0} sujets en ligne{f.feed ? ` · édition du ${dateTimeFr(f.feed.generatedAt)}` : ''}</p>
      <div className="grid-2 btns">
        <button type="button" className="btn btn-secondary" onClick={() => { resetRead(); showToast('Lectures réinitialisées'); }}>Tout marquer non lu</button>
        <button type="button" className="btn btn-secondary" onClick={() => void reload()}>Recharger l'application</button>
      </div>
    </Section>
  );
}

export function SettingsScreen() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => { void loadStatus().then(setStatus); }, []);
  return (
    <div className="screen">
      <AppHeader title="Réglages" />
      <div className="content">
        <Sectors />
        <Summaries status={status} />
        <Appearance />
        <Account />
        <Sources status={status} />
        <Data />
        <p className="t-caption c-moderate center">Vigie · usage personnel · les titres et extraits appartiennent à leurs éditeurs.</p>
      </div>
    </div>
  );
}
