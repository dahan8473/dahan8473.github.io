// DOM over the rackets: loading note, the hover card, the specs card of the
// zoomed racket (with Rally me), and a keyboard list.
import { useEffect, useRef, type ReactNode } from 'react';
import { usePiece } from '../lib/mountCanvas';
import { useNarrow } from '../lib/view';
import { COUNT, modelOf, nameOf, useRacket, useRacketStore, type RacketInfo, type RacketStore } from './store';
import { RACKET_FILE } from './Scene';

function tension(t: RacketInfo['tension']) {
  if (typeof t === 'number') return `${t} lbs`;
  return typeof t === 'string' && t.trim() ? t.trim() : '';
}
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

export function Overlay() {
  const store = useRacketStore();
  const { visible, root, el } = usePiece();
  const focus = useRacket((s) => s.focus);
  const playing = useRacket((s) => s.playing);
  useNarrow(root);
  const zoomed = focus != null;
  useEffect(() => {
    el.classList.toggle('rk-zoom', zoomed);
    if (!zoomed) return;
    // The rally's code comes in while you read the specs.
    import('../rally/open').catch(() => {});
    // Phones: the stage just grew; keep all of it (and Rally me) in view.
    if (root.classList.contains('narrow')) {
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }));
    }
  }, [zoomed, el, root]);
  useEffect(() => () => el.classList.remove('rk-zoom'), [el]);
  // Keyboard or pointer, last: keyboard users get moved into the specs card.
  useEffect(() => {
    const kb = () => void (store.refs.kb = true);
    const pt = () => void (store.refs.kb = false);
    document.addEventListener('keydown', kb, true);
    document.addEventListener('pointerdown', pt, true);
    return () => {
      document.removeEventListener('keydown', kb, true);
      document.removeEventListener('pointerdown', pt, true);
    };
  }, [store]);
  useEffect(() => {
    if (focus == null || !visible || playing) return;
    const key = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (e.key === 'Escape') zoomOut(store, root);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const n = store.get().focus!;
        store.set({ focus: (n + (e.key === 'ArrowLeft' ? COUNT - 1 : 1)) % COUNT });
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [focus, visible, playing, store, root]);
  return (
    <>
      <Wait />
      <Card />
      <Stats />
      <List />
    </>
  );
}

function zoomOut(store: RacketStore, root: HTMLElement) {
  const i = store.get().focus;
  const a = document.activeElement as HTMLElement | null;
  const inCard = !!a && !!store.refs.stats?.contains(a);
  store.set({ focus: null });
  if (!inCard) return;
  // Keyboard users land back on that racket in the list; a click just lets go.
  if (store.refs.kb && i != null) (root.querySelectorAll('.dl-sr button')[i] as HTMLElement | undefined)?.focus({ preventScroll: true });
  else a?.blur();
}

function Wait() {
  const ready = useRacket((s) => s.ready);
  return (
    <p className={'dl-wait' + (ready ? ' off' : '')} aria-hidden={ready || undefined}>
      Loading the rackets...
    </p>
  );
}

function mineOf(r: RacketInfo | undefined) {
  const out: string[] = [];
  if (str(r?.string)) out.push(str(r?.string));
  const t = tension(r?.tension);
  if (t) out.push('at ' + t);
  return out.join(' ');
}

function Card() {
  const store = useRacketStore();
  const i = useRacket((s) => (s.focus == null ? (s.pinned ?? s.hovered) : null));
  const rackets = useRacket((s) => s.rackets);
  const r = i == null ? undefined : rackets[i];
  const mine = mineOf(r);
  return (
    <div
      className="dl-card"
      ref={(el) => {
        store.refs.card = el;
      }}
      aria-hidden="true"
    >
      {i != null && (
        <>
          <p className="dl-card-kind">
            Racket {i + 1} of {COUNT}
          </p>
          <p className="dl-card-name">{nameOf(rackets, i)}</p>
          {(str(r?.balance) || str(r?.flex)) && (
            <ul className="dl-card-specs">
              {[str(r?.balance), str(r?.flex)].filter(Boolean).map((s) => (
                <li key={s}>{s}</li>
              ))}
              {mine && <li>{mine}</li>}
            </ul>
          )}
          <p className="dl-card-hint">{store.refs.kb ? 'Enter' : 'Click'} to look closer</p>
        </>
      )}
    </div>
  );
}

/** A slim scale with a dot: head light to head heavy, flexible to stiff. */
function Meter({ at, lo, hi }: { at: number | undefined; lo: string; hi: string }) {
  if (typeof at !== 'number' || !isFinite(at)) return null;
  const p = Math.max(0, Math.min(1, at)) * 100;
  return (
    <span className="rk-meter" aria-hidden="true">
      <span className="rk-bar">
        <i style={{ width: p + '%' }} />
        <b style={{ left: p + '%' }} />
      </span>
      <span className="rk-ends">
        <span>{lo}</span>
        <span>{hi}</span>
      </span>
    </span>
  );
}

function Stats() {
  const store = useRacketStore();
  const focus = useRacket((s) => s.focus);
  const playing = useRacket((s) => s.playing);
  const rackets = useRacket((s) => s.rackets);
  const { root } = usePiece();
  const shown = useRef<number>(0);
  if (focus != null) shown.current = focus;
  const i = shown.current;
  const r = rackets[i];
  const go = useRef<HTMLButtonElement>(null);
  const zoomed = focus != null;
  useEffect(() => {
    if (!zoomed) return;
    // Keyboard users: into the card once it's in, so Tab starts at Rally me.
    if (!store.refs.kb) return;
    const t = setTimeout(() => go.current?.focus({ preventScroll: true }), 450);
    return () => clearTimeout(t);
  }, [zoomed, store]);
  const lines = (v: string, by: RegExp) => v.split(by).map((s) => s.trim()).filter(Boolean);
  const rows: [string, ReactNode][] = [];
  if (str(r?.balance)) rows.push(['Balance', <>{str(r?.balance)}<Meter at={r?.scale?.balance} lo="head light" hi="head heavy" /></>]);
  if (str(r?.flex)) rows.push(['Flex', <>{str(r?.flex)}<Meter at={r?.scale?.stiffness} lo="flexible" hi="stiff" /></>]);
  if (str(r?.weight)) rows.push(['Weight', lines(str(r?.weight), /\s+\/\s+/).map((s) => <span key={s} className="ln">{s}</span>)]);
  if (str(r?.range)) rows.push(['Tension', lines(str(r?.range), /,\s+/).map((s) => <span key={s} className="ln">{s}</span>)]);
  if (str(r?.frame)) rows.push(['Frame', str(r?.frame)]);
  if (str(r?.shaft)) rows.push(['Shaft', str(r?.shaft)]);
  const mine = mineOf(r);
  const src = str(r?.source);
  const rally = () => {
    if (store.get().playing || focus == null) return;
    const rs = store.get().rackets;
    const from = go.current?.getBoundingClientRect() ?? null;
    store.set({ playing: true, hovered: null });
    import('../rally/open')
      .then((m) => {
        if (!store.get().playing) return;
        store.refs.game = m.openRally({
          model: modelOf(rs, focus, RACKET_FILE),
          foeModel: modelOf(rs, (focus + 2) % COUNT, RACKET_FILE),
          name: nameOf(rs, focus),
          from,
          onClose: () => {
            store.refs.game = null;
            store.set({ playing: false });
          }
        });
      })
      .catch(() => store.set({ playing: false }));
  };
  return (
    <div
      className={'rk-stats' + (focus != null && !playing ? ' on' : '')}
      ref={(el) => void (store.refs.stats = el)}
      role="group"
      aria-label={nameOf(rackets, i) + ' specs'}
      aria-hidden={focus == null || undefined}
      inert={focus == null || undefined}
    >
      <div className="rk-nav">
        <button type="button" className="rk-ic" aria-label="Previous racket" onClick={() => store.set({ focus: (i + COUNT - 1) % COUNT })}>
          <svg viewBox="0 0 24 24"><path d="M14.5 6.5L9 12l5.5 5.5" /></svg>
        </button>
        <span className="rk-of">
          {i + 1} of {COUNT}
        </span>
        <button type="button" className="rk-ic" aria-label="Next racket" onClick={() => store.set({ focus: (i + 1) % COUNT })}>
          <svg viewBox="0 0 24 24"><path d="M9.5 6.5L15 12l-5.5 5.5" /></svg>
        </button>
        <button type="button" className="rk-ic rk-x" aria-label="Back to all four" onClick={() => zoomOut(store, root)}>
          <svg viewBox="0 0 24 24"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
        </button>
      </div>
      <p className="rk-name">{nameOf(rackets, i)}</p>
      {str(r?.for) && <p className="rk-for">{str(r?.for)}</p>}
      {rows.length > 0 && (
        <dl className="rk-specs">
          {rows.map(([k, val]) => (
            <div key={k} className={k === 'Frame' || k === 'Shaft' ? 'wide' : undefined}>
              <dt>{k}</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
      )}
      {mine && <p className="rk-mine">Mine: {mine}</p>}
      <button type="button" className="rk-rally" ref={go} onClick={rally}>
        Rally me
      </button>
      <p className="rk-hint">First person, with this racket in your hand</p>
      {src && (
        <p className="rk-src">
          Specs from{' '}
          <a href={src} target="_blank" rel="noopener">
            {/web\.archive\.org/.test(src) ? "Yonex's archived page" : 'yonex.com'}
          </a>
        </p>
      )}
    </div>
  );
}

function List() {
  const store = useRacketStore();
  const rackets = useRacket((s) => s.rackets);
  return (
    <ul className="dl-sr" aria-label="Rackets">
      {Array.from({ length: COUNT }, (_, i) => {
        const r = rackets[i];
        const sub = [str(r?.balance), str(r?.flex)].filter(Boolean).join(', ');
        return (
          <li key={i}>
            <button
              type="button"
              onFocus={() => store.get().focus == null && store.set({ hovered: i })}
              onBlur={() => {
                if (store.get().hovered === i) store.set({ hovered: null });
              }}
              onClick={() => store.set({ focus: i, hovered: null })}
            >
              {nameOf(rackets, i)}
              {sub ? ': ' + sub : ''}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const css = `
.p3d-racket .rk-stats {
  position: absolute; z-index: 3; right: 3%; top: 50%; width: min(330px, 42%); max-height: calc(100% - 20px); overflow: auto; overscroll-behavior: contain;
  padding: 14px 18px 16px; border-radius: 16px; font-size: 13px; line-height: 1.45; color: var(--t1);
  background: var(--panel); box-shadow: 0 0 0 1px var(--rule), 0 18px 44px -24px rgba(0, 0, 0, 0.35);
  -webkit-backdrop-filter: saturate(180%) blur(16px); backdrop-filter: saturate(180%) blur(16px);
  opacity: 0; visibility: hidden; transform: translate(14px, -50%);
  transition: opacity 220ms ease, transform 420ms cubic-bezier(.2, .7, .2, 1), visibility 220ms;
}
.p3d-racket .rk-stats.on { opacity: 1; visibility: visible; transform: translate(0, -50%); transition-delay: 260ms, 260ms, 0ms; }
.p3d-racket .rk-stats p { margin: 0; }
.p3d-racket .rk-nav { display: flex; align-items: center; gap: 2px; margin: -6px -10px 4px -8px; color: var(--t3); }
.p3d-racket .rk-of { min-width: 3.6em; text-align: center; font-size: 12px; font-variant-numeric: tabular-nums; }
.p3d-racket .rk-ic { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--t3); cursor: pointer; }
.p3d-racket .rk-ic:hover { color: var(--t1); background: var(--fill); }
.p3d-racket .rk-ic:focus-visible, .p3d-racket .rk-rally:focus-visible, .p3d-racket .rk-src a:focus-visible { outline: 2px solid #88c0d0; outline-offset: 2px; }
.p3d-racket .rk-ic svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.p3d-racket .rk-x { margin-left: auto; }
.p3d-racket .rk-name { font-size: 19px; font-weight: 500; letter-spacing: -0.015em; line-height: 1.25; }
.p3d-racket .rk-for { margin-top: 4px !important; color: var(--t2); }
.p3d-racket .rk-specs { display: grid; gap: 7px; margin: 12px 0 0; padding: 11px 0 0; border-top: 1px solid var(--rule); }
.p3d-racket .rk-specs > div { display: grid; grid-template-columns: 62px minmax(0, 1fr); gap: 10px; }
.p3d-racket .rk-specs dt { color: var(--t3); }
.p3d-racket .rk-specs dd { margin: 0; color: var(--t1); }
.p3d-racket .rk-specs .ln { display: block; }
.p3d-racket .rk-meter { display: block; margin-top: 5px; }
.p3d-racket .rk-bar { position: relative; display: block; height: 4px; border-radius: 4px; background: var(--rule); }
.p3d-racket .rk-bar i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: linear-gradient(to right, transparent, rgba(136, 192, 208, 0.55)); }
.p3d-racket .rk-bar b { position: absolute; top: 50%; width: 9px; height: 9px; margin: -4.5px 0 0 -4.5px; border-radius: 50%; background: #88c0d0; box-shadow: 0 0 0 2px var(--bg); }
.p3d-racket .rk-ends { display: flex; justify-content: space-between; margin-top: 3px; font-size: 11px; color: var(--t3); }
.p3d-racket .rk-mine { margin-top: 10px !important; color: var(--t2); }
.p3d-racket .rk-rally {
  display: block; width: 100%; margin-top: 14px; padding: 12px 18px; border: 0; border-radius: 999px; background: #88c0d0; color: #0e1a1f;
  font: inherit; font-size: 16px; font-weight: 500; cursor: pointer; transition: transform 120ms ease, filter 120ms ease;
}
.p3d-racket .rk-rally:hover { filter: brightness(1.06); }
.p3d-racket .rk-rally:active { transform: scale(0.98); }
.p3d-racket .rk-hint { margin-top: 7px !important; text-align: center; font-size: 12px; color: var(--t3); }
.p3d-racket .rk-src { margin-top: 10px !important; padding-top: 9px; border-top: 1px solid var(--rule); font-size: 11px; color: var(--t3); }
.p3d-racket .rk-src a { color: var(--t2); }
.p3d-racket.narrow .rk-stats { left: 8px; right: 8px; top: auto; bottom: 8px; width: auto; max-height: calc(100% - 96px); padding: 10px 14px 12px; font-size: 12px; transform: translateY(14px); }
.p3d-racket.narrow .rk-stats.on { transform: none; }
.p3d-racket.narrow .rk-nav { margin-bottom: 0; }
.p3d-racket.narrow .rk-name { font-size: 16px; }
.p3d-racket.narrow .rk-specs { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px 14px; margin-top: 9px; padding-top: 9px; }
.p3d-racket.narrow .rk-specs > div { grid-template-columns: minmax(0, 1fr); gap: 0; }
.p3d-racket.narrow .rk-specs > div.wide { grid-column: 1 / -1; grid-template-columns: 44px minmax(0, 1fr); gap: 8px; }
.p3d-racket.narrow .rk-specs dt { font-size: 11px; }
.p3d-racket.narrow .rk-ends { font-size: 10px; }
.p3d-racket.narrow .rk-rally { margin-top: 11px; padding: 11px 14px; font-size: 15px; }
.p3d-racket.narrow .rk-hint { display: none; }
.p3d-racket.narrow .rk-src { margin-top: 8px !important; padding-top: 7px; }
/* Phones: the stage grows while a racket is zoomed, so the card fits beside it. */
@media (max-width: 600px) { .stage3d.rk-zoom { aspect-ratio: 2 / 3; } }
@media (prefers-reduced-motion: reduce) {
  .p3d-racket .rk-stats { transition: none; }
}
`;
