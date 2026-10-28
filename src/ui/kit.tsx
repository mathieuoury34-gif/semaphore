// Composants partagés (mêmes composants et mêmes classes que PEAnalyze)
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Icon, Logo, Picto } from './icons';
import { back, closeSheet, navigate, tabOf, useRoute, type Tab } from './router';
import { loadData, staleHours, useFeed } from '../data/feed';
import { downloadUpdate, useUpdateAvailable } from '../data/appUpdate';
import { dateTime, relTime } from '../domain/format';
import { useT, type Key } from '../i18n';

// ------------------------------------------------------------------ en-têtes
export function useScrolled(threshold = 20): boolean {
  const [s, setS] = useState(false);
  useEffect(() => {
    let raf = 0;
    const on = () => { raf = 0; setS(window.scrollY >= threshold); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(on); };
    on();
    window.addEventListener('scroll', schedule, { passive: true });
    return () => { window.removeEventListener('scroll', schedule); if (raf) cancelAnimationFrame(raf); };
  }, [threshold]);
  return s;
}

export function useUpdatedText(): string {
  const f = useFeed();
  const { t, lang } = useT();
  if (!f.feed) return f.phase === 'error' ? t('common.unavailable') : t('common.loading');
  return t('common.updated', { when: relTime(f.feed.generatedAt, lang) });
}

export function AppHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  const compact = useScrolled();
  const updated = useUpdatedText();
  const f = useFeed();
  const { t } = useT();
  return (
    <header className={'app-header' + (compact ? ' compact' : '')}>
      <div className="bar">
        <span className="header-mark"><Picto size={32} /></span>
        <div className="titles">
          <h1>{title}</h1>
          <span className="updated">{updated}</span>
        </div>
        <div className="actions">
          {actions}
          <button type="button" className={'icon-btn' + (f.refreshing ? ' spin' : '')} aria-label={t('common.refresh')} onClick={() => void loadData({ force: true })} disabled={f.refreshing}>
            <Icon name="refresh" />
          </button>
        </div>
      </div>
    </header>
  );
}

export function SubHeader({ title, fallback, right }: { title: string; fallback: string; right?: ReactNode }) {
  const { t } = useT();
  return (
    <header className="sub-header bordered">
      <div className="bar">
        <button type="button" className="icon-btn" aria-label={t('common.back')} onClick={() => back(fallback)}>
          <Icon name="back" />
        </button>
        <h1>{title}</h1>
        {right || <span />}
      </div>
    </header>
  );
}

/** Bandeau : échec du dernier chargement, ou données anciennes (le robot n'a pas publié depuis longtemps). */
export function DataBanner() {
  const f = useFeed();
  const { t, lang } = useT();
  const update = useUpdateAvailable();
  if (update) {
    return (
      <div role="status" className="banner-info">
        <Icon name="info" size={20} />
        <span>{t('update.available')}</span>
        <button type="button" onClick={downloadUpdate}>{t('update.get')}</button>
      </div>
    );
  }
  if (f.error && f.feed) {
    return (
      <div role="alert" className="banner-error">
        <Icon name="alert" size={20} />
        <span>{t('banner.old', { why: f.error === 'offline' ? t('banner.offline') : t('banner.failed'), date: dateTime(f.feed.generatedAt, lang) })}</span>
        <button type="button" onClick={() => void loadData({ force: true })}>{t('common.retry')}</button>
      </div>
    );
  }
  const h = staleHours(f);
  if (f.feed && h > 30) {
    const d = Math.round(h / 24);
    return (
      <div role="status" className="banner-info">
        <Icon name="info" size={20} />
        <span>{t('banner.stale', { ago: d >= 2 ? t('ago.days', { n: d }) : t('ago.hours', { n: Math.round(h) }), date: dateTime(f.feed.generatedAt, lang) })}</span>
        <span />
      </div>
    );
  }
  return null;
}

// ------------------------------------------------------------------ contrôles
export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="seg">
      {options.map(([id, l]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>{l}</button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, labelledBy, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; labelledBy?: string; label?: string; disabled?: boolean }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-labelledby={labelledBy} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)} />;
}

export function Empty({ icon = 'inbox', title, text, action }: { icon?: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-icon"><Icon name={icon} size={40} /></span>
      <h2 className="t-h3">{title}</h2>
      <p className="c-neutral">{text}</p>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ navigation principale
const TABS: { id: Exclude<Tab, 'none'>; label: Key; to: string }[] = [
  { id: 'une', label: 'tab.une', to: '/une' },
  { id: 'secteurs', label: 'tab.secteurs', to: '/secteurs' },
  { id: 'favoris', label: 'tab.favoris', to: '/favoris' },
  { id: 'reglages', label: 'tab.reglages', to: '/reglages' },
];

export function TabBar() {
  const route = useRoute();
  const { t } = useT();
  const active = tabOf(route.path);
  const go = (to: string) => (e: React.MouseEvent) => { e.preventDefault(); if (route.path !== to) navigate(to); };
  return (
    <>
      <nav aria-label={t('nav.main')} className="tabbar">
        {TABS.map((tab) => (
          <a key={tab.id} href={'#' + tab.to} aria-current={active === tab.id ? 'page' : undefined} onClick={go(tab.to)}>
            <span className="pill"><Icon name={tab.id} /></span>
            {t(tab.label)}
          </a>
        ))}
      </nav>
      <aside className="sidenav" aria-label={t('nav.main')}>
        <Logo size={20} name={t('app.name')} />
        <nav>
          {TABS.map((tab) => (
            <a key={tab.id} href={'#' + tab.to} aria-current={active === tab.id ? 'page' : undefined} onClick={go(tab.to)}>
              <Icon name={tab.id} />{t(tab.label)}
            </a>
          ))}
        </nav>
        <SideFoot />
      </aside>
    </>
  );
}

function SideFoot() {
  return <div className="foot">{useUpdatedText()}</div>;
}

// ------------------------------------------------------------------ feuilles
export function Sheet({ title, children, footer, full, onClose = closeSheet, head }: { title: string; children: ReactNode; footer?: ReactNode; full?: boolean; onClose?: () => void; head?: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const { t } = useT();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [onClose]);
  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <section ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className={'sheet' + (full ? ' full' : '')} style={{ outline: 'none' }}>
        <span className="handle" aria-hidden="true" />
        <div className="sheet-head" style={full ? { borderBottom: '1px solid var(--divider-minimal)' } : undefined}>
          <div className="between">
            <h2 className="t-h3 sheet-title">{title}</h2>
            <button type="button" className="icon-btn neutral" aria-label={t('common.close')} onClick={onClose} style={{ marginRight: 'calc(-1 * var(--space-10))' }}>
              <Icon name="close" />
            </button>
          </div>
          {head}
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </section>
    </>
  );
}

// ------------------------------------------------------------------ toasts
interface ToastState { id: number; text: string; undo?: () => void; error?: boolean }
let toast: ToastState | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const toastListeners = new Set<() => void>();
export function showToast(text: string, opts: { undo?: () => void; error?: boolean } = {}) {
  toast = { id: Date.now(), text, ...opts };
  toastListeners.forEach((l) => l());
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast = null; toastListeners.forEach((l) => l()); }, opts.undo ? 6000 : 3000);
}
export function ToastHost() {
  const t = useSyncExternalStore((l) => { toastListeners.add(l); return () => toastListeners.delete(l); }, () => toast);
  const tr = useT();
  if (!t) return null;
  return (
    <div role="status" className={'toast' + (t.error ? ' error' : '')} key={t.id}>
      <Icon name={t.error ? 'alert' : 'success'} />
      <span className="t-strong">{t.text}</span>
      {t.undo ? <button type="button" onClick={() => { t.undo!(); toast = null; toastListeners.forEach((l) => l()); }}>{tr.t('common.undo')}</button> : <span />}
    </div>
  );
}
