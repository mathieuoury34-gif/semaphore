// Réorganisation par appui long, comme les icônes d'un écran d'accueil : on maintient un élément, il se soulève et suit le doigt,
// les autres glissent pour lui faire de la place, et on relâche pour le poser. Aucune dépendance.
import { useEffect, useRef, type RefObject } from 'react';

/** Déplace l'élément d'indice `from` à l'indice `to` (copie). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [x] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, x!);
  return out;
}

/** Indice de la case qui contient le point, sinon de la case la plus proche (distance au centre). */
export function slotAt(slots: readonly { x: number; y: number; w: number; h: number }[], px: number, py: number): number {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    if (px >= s.x && px <= s.x + s.w && py >= s.y && py <= s.y + s.h) return i;
    const d = (px - (s.x + s.w / 2)) ** 2 + (py - (s.y + s.h / 2)) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

interface Opts {
  ids: string[];
  onCommit: (ids: string[]) => void;
  holdMs?: number;
  /** Sélecteur des éléments déplaçables, qui portent `data-rid`. */
  item?: string;
}

const MOVE_TOLERANCE = 10;   // px : au-delà, c'est un défilement et non un appui long
const EDGE = 72;             // px : zone proche du bord de l'écran qui fait défiler la page

function scroller(el: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return (document.scrollingElement as HTMLElement) ?? document.documentElement;
}

/**
 * À brancher sur le conteneur des éléments (`ref`). Chaque élément porte `data-rid="<id>"`.
 * Pendant le glissement le conteneur reçoit la classe `reordering` et l'élément saisi la classe `dragging`.
 */
export function useLongPressReorder(ref: RefObject<HTMLElement | null>, opts: Opts): void {
  const latest = useRef(opts);
  latest.current = opts;

  useEffect(() => {
    const box = ref.current;
    if (!box) return;
    const sel = latest.current.item ?? '[data-rid]';
    let timer = 0;
    let press: { id: string; pid: number; x: number; y: number } | null = null;
    let drag: null | {
      id: string; from: number; ids: string[]; els: HTMLElement[]; slots: { x: number; y: number; w: number; h: number }[];
      grab: { x: number; y: number }; to: number; x: number; y: number; raf: number; sc: HTMLElement;
    } = null;
    let swallowClick = false;

    const rel = (clientX: number, clientY: number) => {
      const r = box.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    };

    const paint = () => {
      if (!drag) return;
      const d = drag;
      const p = rel(d.x, d.y);
      const home = d.slots[d.from]!;
      d.to = slotAt(d.slots, p.x, p.y);
      const order = moveItem(d.ids, d.from, d.to);
      d.els.forEach((el, i) => {
        const id = d.ids[i]!;
        if (id === d.id) {
          el.style.transform = `translate(${p.x - d.grab.x - home.x}px, ${p.y - d.grab.y - home.y}px) scale(1.04)`;
          return;
        }
        const at = d.slots[order.indexOf(id)]!;
        const was = d.slots[i]!;
        el.style.transform = at === was ? '' : `translate(${at.x - was.x}px, ${at.y - was.y}px)`;
      });
    };

    const loop = () => {
      if (!drag) return;
      const d = drag;
      // défilement automatique près des bords
      const isDoc = d.sc === document.scrollingElement || d.sc === document.documentElement;
      const top = isDoc ? 0 : d.sc.getBoundingClientRect().top;
      const bottom = isDoc ? window.innerHeight : d.sc.getBoundingClientRect().bottom;
      let dy = 0;
      if (d.y < top + EDGE) dy = -Math.ceil(((top + EDGE - d.y) / EDGE) * 14);
      else if (d.y > bottom - EDGE) dy = Math.ceil(((d.y - (bottom - EDGE)) / EDGE) * 14);
      if (dy) d.sc.scrollBy(0, dy);
      paint();
      d.raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!press) return;
      const els = [...box.querySelectorAll<HTMLElement>(sel)];
      const ids = els.map((e) => e.dataset.rid!);
      const from = ids.indexOf(press.id);
      if (from < 0 || ids.length < 2) { press = null; return; }
      const br = box.getBoundingClientRect();
      const slots = els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left - br.left, y: r.top - br.top, w: r.width, h: r.height }; });
      const p = rel(press.x, press.y);
      drag = { id: press.id, from, ids, els, slots, grab: { x: p.x - slots[from]!.x, y: p.y - slots[from]!.y }, to: from, x: press.x, y: press.y, raf: 0, sc: scroller(box) };
      try { box.setPointerCapture(press.pid); } catch { /* sans importance */ }
      navigator.vibrate?.(18);
      box.classList.add('reordering');
      els[from]!.classList.add('dragging');
      drag.raf = requestAnimationFrame(loop);
    };

    const finish = (commit: boolean) => {
      window.clearTimeout(timer);
      const d = drag;
      const hadPress = press;
      drag = null;
      press = null;
      if (!d) { void hadPress; return; }
      cancelAnimationFrame(d.raf);
      // on retire les transformations sans transition : le nouvel ordre est déjà celui du DOM après le rendu
      box.classList.add('dropping');
      d.els.forEach((el) => { el.style.transform = ''; el.classList.remove('dragging'); });
      box.classList.remove('reordering');
      const next = moveItem(d.ids, d.from, d.to);
      swallowClick = true;
      window.setTimeout(() => { swallowClick = false; }, 60);
      if (commit && d.to !== d.from) latest.current.onCommit(next);
      requestAnimationFrame(() => requestAnimationFrame(() => box.classList.remove('dropping')));
    };

    const onDown = (e: PointerEvent) => {
      if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(sel);
      if (!el || !box.contains(el) || !el.dataset.rid) return;
      press = { id: el.dataset.rid, pid: e.pointerId, x: e.clientX, y: e.clientY };
      window.clearTimeout(timer);
      timer = window.setTimeout(start, latest.current.holdMs ?? 380);
    };
    const onMove = (e: PointerEvent) => {
      if (drag) { drag.x = e.clientX; drag.y = e.clientY; return; }
      if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_TOLERANCE) { window.clearTimeout(timer); press = null; }
      else if (press) { press.x = e.clientX; press.y = e.clientY; }
    };
    const onUp = () => { if (drag) finish(true); else { window.clearTimeout(timer); press = null; } };
    const onCancel = () => { if (drag) finish(false); else { window.clearTimeout(timer); press = null; } };
    // une fois l'élément saisi, le doigt ne doit plus faire défiler la page
    const onTouchMove = (e: TouchEvent) => { if (drag && e.cancelable) e.preventDefault(); };
    const onContext = (e: Event) => { if (press || drag) e.preventDefault(); };
    const onClick = (e: MouseEvent) => { if (swallowClick) { e.preventDefault(); e.stopPropagation(); } };
    const onKey = (e: KeyboardEvent) => {
      // équivalent clavier : Alt + flèches déplacent l'élément en cours
      if (!e.altKey || !/^Arrow(Left|Right|Up|Down)$/.test(e.key)) return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(sel);
      if (!el?.dataset.rid) return;
      const ids = [...box.querySelectorAll<HTMLElement>(sel)].map((x) => x.dataset.rid!);
      const i = ids.indexOf(el.dataset.rid);
      const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
      const j = i + step;
      if (j < 0 || j >= ids.length) return;
      e.preventDefault();
      latest.current.onCommit(moveItem(ids, i, j));
      requestAnimationFrame(() => box.querySelector<HTMLElement>(`[data-rid="${CSS.escape(el.dataset.rid!)}"]`)?.focus());
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && drag) finish(false); };

    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    box.addEventListener('pointercancel', onCancel);
    box.addEventListener('touchmove', onTouchMove, { passive: false });
    box.addEventListener('contextmenu', onContext);
    box.addEventListener('click', onClick, true);
    box.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.clearTimeout(timer);
      if (drag) cancelAnimationFrame(drag.raf);
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp);
      box.removeEventListener('pointercancel', onCancel);
      box.removeEventListener('touchmove', onTouchMove);
      box.removeEventListener('contextmenu', onContext);
      box.removeEventListener('click', onClick, true);
      box.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onEsc);
    };
  }, [ref]);
}
