// DOM for the guitar: the pointer and keyboard playing, and the chord bar.
import { useEffect } from 'react';
import { usePiece } from '../lib/mountCanvas';
import { useNarrow } from '../lib/view';
import { CHORD_NAMES, gesture, pluck, setChord, shapeOf, strum, useGuitar, useGuitarStore, whereFor, type GuitarStore, type Seg } from './store';

type Pt = { x: number; y: number; t: number };

/** Where segment p0-p1 crosses segment a-b: [t along p, u along ab] or null. */
function cross(p0: Pt, p1: Pt, s: Seg): [number, number] | null {
  const rx = p1.x - p0.x, ry = p1.y - p0.y;
  const sx = s.bx - s.ax, sy = s.by - s.ay;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return null;
  const qx = s.ax - p0.x, qy = s.ay - p0.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

/** Nearest string to a point and its position along it, if close enough. */
function nearest(segs: Seg[], x: number, y: number): { s: number; u: number } | null {
  if (segs.length < 6) return null;
  let best = -1, bestD = Infinity, bestU = 0;
  segs.forEach((g, i) => {
    const sx = g.bx - g.ax, sy = g.by - g.ay;
    const l2 = sx * sx + sy * sy || 1;
    const u = ((x - g.ax) * sx + (y - g.ay) * sy) / l2;
    if (u < -0.02 || u > 1.02) return;
    const px = g.ax + sx * u, py = g.ay + sy * u;
    const d = Math.hypot(x - px, y - py);
    if (d < bestD) { bestD = d; best = i; bestU = u; }
  });
  if (best < 0) return null;
  // Half the gap to the neighbouring string, at least 7 px.
  const nb = segs[best === 5 ? 4 : best + 1];
  const g = segs[best];
  const gap = Math.hypot((g.ax + (g.bx - g.ax) * bestU) - (nb.ax + (nb.bx - nb.ax) * bestU), (g.ay + (g.by - g.ay) * bestU) - (nb.ay + (nb.by - nb.ay) * bestU));
  return bestD <= Math.max(7, gap * 0.55) ? { s: best, u: bestU } : null;
}

function whereAt(store: GuitarStore, s: number, u: number) {
  const geom = store.refs.geom;
  const L = geom?.scale ?? 0.65;
  const f = shapeOf(store)[s] ?? 0;
  const vibrating = L - (f > 0 && geom ? geom.frets[f] : 0);
  return whereFor((1 - u) * L, vibrating);
}

export function Overlay() {
  const store = useGuitarStore();
  const { root, visible } = usePiece();
  useNarrow(root, 520);

  // Pointer: crossing a string plucks it (hover or drag), a press plucks the nearest.
  useEffect(() => {
    let last: Pt | null = null;
    let pressed = false;
    const pending = new Map<number, () => void>();
    const rel = (e: PointerEvent): Pt => {
      const r = root.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp };
    };
    const inBar = (e: Event) => !!(e.target as HTMLElement)?.closest?.('.gt-bar');
    const play = (from: Pt, to: Pt, drag: boolean) => {
      const segs = store.refs.segs;
      const hits: { s: number; t: number; u: number }[] = [];
      segs.forEach((g, s) => {
        const c = cross(from, to, g);
        if (c) hits.push({ s, t: c[0], u: c[1] });
      });
      if (!hits.length) return;
      hits.sort((a, b) => a.t - b.t);
      const dt = Math.max(1, to.t - from.t);
      const speed = Math.hypot(to.x - from.x, to.y - from.y) / dt; // px per ms
      const v = Math.min(drag ? 1 : 0.78, Math.max(0.28, 0.3 + speed * 0.32));
      const t0 = hits[0].t;
      for (const h of hits) {
        // Keep the roll of a fast sweep (capped so it never drags).
        const delay = Math.min(60, (h.t - t0) * dt);
        const go = () => pluck(store, h.s, v, whereAt(store, h.s, h.u));
        if (delay < 4) go();
        else {
          const id = window.setTimeout(() => {
            pending.delete(id);
            go();
          }, delay);
          pending.set(id, go);
        }
      }
    };
    // A new pointer event plays anything still rolling from the last one first, so
    // notes never come out of order.
    const flush = () => {
      pending.forEach((go, id) => {
        clearTimeout(id);
        go();
      });
      pending.clear();
    };
    const move = (e: PointerEvent) => {
      flush();
      if (inBar(e)) {
        last = null;
        store.refs.hover = -1;
        return;
      }
      const p = rel(e);
      const touch = e.pointerType === 'touch';
      if (last && (!touch || pressed)) play(last, p, pressed);
      last = p;
      if (!touch) {
        const n = nearest(store.refs.segs, p.x, p.y);
        store.refs.hover = n ? n.s : -1;
        root.style.cursor = n ? 'pointer' : '';
      }
    };
    const down = (e: PointerEvent) => {
      if (inBar(e) || e.button > 0) return;
      gesture(store);
      pressed = true;
      const p = rel(e);
      last = p;
      if (e.pointerType === 'touch' && !store.get().armed) store.set({ armed: true });
      const n = nearest(store.refs.segs, p.x, p.y);
      if (n) pluck(store, n.s, 0.72, whereAt(store, n.s, n.u));
    };
    const up = () => {
      pressed = false;
    };
    const leave = () => {
      pressed = false;
      last = null;
      store.refs.hover = -1;
      root.style.cursor = '';
    };
    root.addEventListener('pointermove', move);
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', leave);
    root.addEventListener('pointerleave', leave);
    return () => {
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointerup', up);
      root.removeEventListener('pointercancel', leave);
      root.removeEventListener('pointerleave', leave);
      pending.forEach((_, id) => clearTimeout(id));
      pending.clear();
      root.style.cursor = '';
    };
  }, [root, store]);

  // Touch: once armed, swipes on the guitar strum instead of scrolling the page.
  // A touch anywhere else on the page, or scrolling it away, disarms.
  const armed = useGuitar((s) => s.armed);
  useEffect(() => {
    const canvas = root.querySelector('canvas');
    const set = (v: string) => {
      root.style.touchAction = v;
      if (canvas) canvas.style.touchAction = v;
    };
    if (!armed) {
      set('');
      if (canvas) canvas.style.touchAction = 'pan-y';
      return;
    }
    set('none');
    const away = (e: PointerEvent) => {
      if (!root.contains(e.target as Node)) store.set({ armed: false });
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [armed, root, store]);
  useEffect(() => {
    if (!visible && store.get().armed) store.set({ armed: false });
  }, [visible, store]);

  // Keyboard, while the guitar (or a chord button) has focus.
  useEffect(() => {
    root.tabIndex = 0;
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Guitar. Keys 1 to 6 pluck the strings, 1 is the high E. Space strums. Left and right arrows change the chord.');
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const onButton = (e.target as HTMLElement)?.tagName === 'BUTTON';
      if (/^[1-6]$/.test(e.key)) {
        gesture(store);
        pluck(store, 6 - Number(e.key), 0.75, 0.55);
        e.preventDefault();
      } else if (e.key === ' ' && !onButton) {
        gesture(store);
        strum(store, { velocity: 0.8 });
        e.preventDefault();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        gesture(store);
        const cur = store.get().chord;
        const i = cur ? CHORD_NAMES.indexOf(cur) : -1;
        const n = CHORD_NAMES.length;
        const next = e.key === 'ArrowRight' ? (i + 1) % n : (i - 1 + n) % n;
        setChord(store, CHORD_NAMES[next]);
        strum(store, { down: true, velocity: 0.7 });
        e.preventDefault();
      } else if (e.key === 'Escape' && store.get().chord) {
        setChord(store, null);
        store.refs.engine?.damp();
      }
    };
    root.addEventListener('keydown', key);
    return () => {
      root.removeEventListener('keydown', key);
      root.removeAttribute('tabindex');
      root.removeAttribute('role');
      root.removeAttribute('aria-label');
    };
  }, [root, store]);

  return (
    <>
      <Wait />
      <Bar />
    </>
  );
}

function Wait() {
  const ready = useGuitar((s) => s.ready);
  return (
    <p className={'dl-wait' + (ready ? ' off' : '')} aria-hidden={ready || undefined}>
      Loading the guitar...
    </p>
  );
}

function Bar() {
  const store = useGuitarStore();
  const chord = useGuitar((s) => s.chord);
  const armed = useGuitar((s) => s.armed);
  const muted = useGuitar((s) => s.muted);
  const played = useGuitar((s) => s.played > 0);
  const ready = useGuitar((s) => s.ready);
  const hint = muted
    ? 'Sound is muted on this site'
    : armed
      ? 'Swipe across the strings to strum'
      : played
        ? 'Pick a chord, then strum'
        : 'Drag across the strings, or keys 1 to 6';
  return (
    <div className={'gt-bar' + (ready ? '' : ' off')}>
      <p className="gt-hint" aria-live="polite">
        {hint}
      </p>
      <div className="gt-chords" role="group" aria-label="Chord">
        {CHORD_NAMES.map((name) => (
          <button
            key={name}
            type="button"
            className="gt-chord"
            aria-pressed={chord === name}
            onClick={() => {
              gesture(store);
              if (chord === name) {
                setChord(store, null);
                return;
              }
              setChord(store, name);
              strum(store, { down: true, velocity: 0.72 });
            }}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

export const css = `
.p3d-guitar:focus { outline: none; }
.p3d-guitar:focus-visible { outline: 2px solid rgba(136, 192, 208, 0.7); outline-offset: 2px; border-radius: 12px; }
.p3d-guitar .gt-bar {
  position: absolute; left: 0; right: 0; bottom: 8px; z-index: 2;
  display: flex; align-items: center; justify-content: center; gap: 14px;
  padding: 0 12px; pointer-events: none; transition: opacity 300ms ease;
}
.p3d-guitar .gt-bar.off { opacity: 0; }
.p3d-guitar .gt-hint { margin: 0; font-size: 12px; color: var(--t3); white-space: nowrap; }
.p3d-guitar .gt-chords {
  display: flex; gap: 2px; padding: 3px; border-radius: 999px; pointer-events: auto;
  background: var(--panel); box-shadow: 0 0 0 1px var(--rule), 0 6px 18px rgba(0, 0, 0, 0.08);
  -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
}
.p3d-guitar .gt-chord {
  min-width: 36px; height: 26px; padding: 0 9px; border: 0; border-radius: 999px;
  background: transparent; color: var(--t2); font-size: 13px; font-weight: 500; cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.p3d-guitar .gt-chord:hover { color: var(--t1); background: var(--fill); }
.p3d-guitar .gt-chord[aria-pressed="true"] { background: #88c0d0; color: #0d1417; }
.p3d-guitar .gt-chord:focus-visible { outline: 2px solid rgba(136, 192, 208, 0.8); outline-offset: 1px; }
.p3d-guitar.narrow .gt-bar { bottom: 6px; flex-direction: column; gap: 4px; }
.p3d-guitar.narrow .gt-hint { order: 2; font-size: 11px; }
.p3d-guitar.narrow .gt-chord { min-width: 0; height: 24px; padding: 0 7px; font-size: 12px; }
@media (prefers-reduced-motion: reduce) { .p3d-guitar .gt-bar { transition: none; } }
`;
