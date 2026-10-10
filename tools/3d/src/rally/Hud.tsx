// DOM over the court: the score, the head's speech bubble, pops, the big
// "your serve", a help line, and the cards (how to play, paused, the end of a game).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Store } from '../lib/store';
import type { HudState, Phase } from './engine';
import type { Ui } from './Scene';

export interface HudActions {
  again(): void;
  done(): void;
  resume(): void;
  /** Off the how to play card: the first serve, or back to the game. */
  howDone(): void;
}

/** The corner buttons' icons (open.tsx), drawn again on the phone's how to play card. */
export const ICONS = {
  how: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 9a3.4 3.4 0 1 1 4.9 3.05c-.95.47-1.5 1.25-1.5 2.2v.55"/><path d="M12 18.6v.05"/></svg>',
  on: '<svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  off: '<svg class="off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>'
};

export function Hud({ hud, ui, act, touch, reduce }: { hud: Store<HudState>; ui: Ui; act: HudActions; touch: boolean; reduce: boolean }) {
  const s = useSyncExternalStore(hud.subscribe, hud.get);
  const live = s.phase === 'serve' || s.phase === 'rally' || s.phase === 'point';
  return (
    <div className="rl-hud">
      <div className="rl-top" aria-hidden={s.phase === 'intro' || undefined} ref={(el) => void (ui.top = el)}>
        <div className="rl-side rl-you">
          <span>You</span>
          <b>{s.me}</b>
          <i className={live && s.server === 'me' ? 'on' : ''} />
        </div>
        <div className="rl-mid">
          <span className="lab">Rally</span>
          <span className="num">{s.rally}</span>
          <span className="bst">{s.best ? `best ${s.best}` : ''}</span>
        </div>
        <div className="rl-side rl-them">
          <i className={live && s.server === 'foe' ? 'on' : ''} />
          <b>{s.foe}</b>
          <span className="lg">The head</span>
          <span className="sm">Head</span>
        </div>
      </div>
      <p className="sr" aria-live="polite">
        {s.phase === 'end' ? `${s.won ? 'You win' : 'The head wins'}, ${s.me} to ${s.foe}.` : live ? `You ${s.me}, the head ${s.foe}.` : ''}
      </p>
      <div className="rl-say" aria-hidden="true" ref={(el) => void (ui.say = el)} />
      <div className="rl-pops" aria-hidden="true" ref={(el) => void (ui.pops = el)} />
      <div className="rl-caret" aria-hidden="true" ref={(el) => void (ui.caret = el)}>
        <svg viewBox="0 0 24 24">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </div>
      <div className={'rl-big' + (s.big && !s.card ? ' on' : '')} aria-hidden="true">
        {s.big}
        {s.bigSub && <small>{s.bigSub}</small>}
      </div>
      <p className={'rl-help' + (s.help && s.phase !== 'intro' && !s.card ? ' on' : '')}>
        {touch
          ? 'Drag to aim, up is deeper. Tap to swing as it reaches you.'
          : 'Point where you want it to go (higher is deeper). Click or space to swing as it reaches your racket.'}
      </p>
      {s.card === 'end' && <End s={s} act={act} />}
      {s.card === 'pause' && <Paused act={act} />}
      {s.card === 'how' && <How phase={s.phase} act={act} touch={touch} reduce={reduce} />}
      <p className={'rl-wait' + (s.phase === 'intro' && !s.card ? '' : ' off')}>
        The head is coming over...
        {s.rec.w + s.rec.l > 0 && (
          <small>
            Your record against it: {s.rec.w}-{s.rec.l}
          </small>
        )}
      </p>
    </div>
  );
}

function useFocusFirst() {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, []);
  return ref;
}

function End({ s, act }: { s: HudState; act: HudActions }) {
  const go = useFocusFirst();
  return (
    <div className="rl-card" role="group" aria-label="Game over">
      <p className="h">{s.won ? 'You win' : 'The head wins'}</p>
      <p className="p">
        {s.me} to {s.foe}
      </p>
      <div className="rl-stats">
        <span>
          Longest rally <b>{s.longest}</b>
        </span>
        <span>
          Best ever <b>{s.best}</b>
        </span>
        <span>
          Your record <b>{s.rec.w}-{s.rec.l}</b>
        </span>
      </div>
      <div className="rl-row">
        <button ref={go} className="rl-go big" type="button" onClick={act.again}>
          Play again
        </button>
        <button className="rl-alt" type="button" onClick={act.done}>
          Done
        </button>
      </div>
    </div>
  );
}

function Paused({ act }: { act: HudActions }) {
  const go = useFocusFirst();
  return (
    <div className="rl-card" role="group" aria-label="Paused">
      <p className="h">Paused</p>
      <div className="rl-row">
        <button ref={go} className="rl-go" type="button" onClick={act.resume}>
          Resume
        </button>
        <button className="rl-alt" type="button" onClick={act.done}>
          Quit
        </button>
      </div>
    </div>
  );
}

/** How to play: before the first serve the first time, and from the ? (paused). */
function How({ phase, act, touch, reduce }: { phase: Phase; act: HudActions; touch: boolean; reduce: boolean }) {
  const go = useFocusFirst();
  const icon = (k: keyof typeof ICONS) => <span className="rl-mini" dangerouslySetInnerHTML={{ __html: ICONS[k] }} />;
  return (
    <div className="rl-card rl-how" role="group" aria-label="How to play">
      <div className="rl-hd">
        <p className="h">How to play</p>
        <p className="p">First to 7 points wins</p>
      </div>
      <div className="rl-bd">
        <Timing reduce={reduce} />
        <div>
          <dl className="rl-keys">
            <div>
              <dt>Aim</dt>
              <dd>
                {touch ? (
                  'Drag anywhere. Up is deeper.'
                ) : (
                  'Point the mouse. Higher is deeper.'
                )}
              </dd>
            </div>
            <div>
              <dt>Swing</dt>
              <dd>
                {touch ? (
                  'Tap. Mid drag, tap with a second finger.'
                ) : (
                  <>
                    Click, <kbd>Space</kbd> or <kbd>Enter</kbd>
                  </>
                )}
              </dd>
            </div>
            <div>
              <dt>Timing</dt>
              <dd>{touch ? 'Right as it reaches your racket.' : 'Right as it reaches your racket. Too early or too late misses.'}</dd>
            </div>
          </dl>
          <p className="rl-more">
            {touch ? (
              <>
                <span>{icon('how')}pause</span>
                <span>{icon('on')}sound</span>
                <span>{icon('x')}quit</span>
              </>
            ) : (
              <>
                <span>
                  <kbd>P</kbd>pause
                </span>
                <span>
                  <kbd>M</kbd>sound
                </span>
                <span>
                  <kbd>?</kbd>help
                </span>
                <span>
                  <kbd>Esc</kbd>quit
                </span>
              </>
            )}
          </p>
        </div>
      </div>
      <div className="rl-row">
        <button ref={go} className="rl-go big" type="button" onClick={act.howDone}>
          {phase === 'intro' ? 'Serve' : phase === 'end' ? 'Back' : 'Resume'}
        </button>
        {!touch && (
          <span className="rl-hint">
            or <kbd>Space</kbd>
          </span>
        )}
      </div>
    </div>
  );
}

// The timing demo: the head's shot arcs over the net to your racket, which
// meets it in the "now" window and sends it back. A loop, or a still of the
// hit with reduced motion.
const P0 = [16, 66], Q = [118, -30], P1 = [252, 98];
const CU = 0.84; // contact, along the arc
const PIV = [250, 104]; // your hand
const at = (u: number, a = P0, q = Q, b = P1) => {
  const v = 1 - u;
  return [v * v * a[0] + 2 * u * v * q[0] + u * u * b[0], v * v * a[1] + 2 * u * v * q[1] + u * u * b[1]];
};
const tangent = (u: number, a = P0, q = Q, b = P1) => Math.atan2(2 * (1 - u) * (q[1] - a[1]) + 2 * u * (b[1] - q[1]), 2 * (1 - u) * (q[0] - a[0]) + 2 * u * (b[0] - q[0]));
const C = at(CU);
const RL = Math.hypot(C[0] - PIV[0], C[1] - PIV[1]); // hand to the middle of the strings
const A_HIT = (Math.atan2(C[0] - PIV[0], PIV[1] - C[1]) * 180) / Math.PI;
const A_REST = 14, A_THRU = -70;
const BACK_Q = [150, -20], BACK_B = [50, 44];
const seg = (u0: number, u1: number) => {
  let d = '';
  for (let i = 0; i <= 16; i++) {
    const p = at(u0 + ((u1 - u0) * i) / 16);
    d += (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
  }
  return d;
};
const ARC = seg(0, 1), WIN = seg(0.775, 0.895);
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

function Timing({ reduce }: { reduce: boolean }) {
  const sh = useRef<SVGGElement>(null);
  const rk = useRef<SVGGElement>(null);
  const win = useRef<SVGPathElement>(null);
  useEffect(() => {
    const put = (t: number) => {
      const s = sh.current, r = rk.current, w = win.current;
      if (!s || !r || !w) return;
      // 0 to 1s in, the hit at 1s, back out by 1.7s, then a rest.
      let p: number[], ang: number, op = 1;
      if (t < 1) {
        const u = CU * t;
        p = at(u);
        ang = tangent(u);
      } else if (t < 1.6) {
        const u = (t - 1) / 0.6;
        p = at(u, C, BACK_Q, BACK_B);
        ang = tangent(u, C, BACK_Q, BACK_B);
        op = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.5;
      } else {
        p = C;
        ang = 0;
        op = 0;
      }
      s.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)}) rotate(${((ang * 180) / Math.PI).toFixed(1)})`);
      s.style.opacity = op.toFixed(2);
      let a = A_REST;
      if (t >= 0.8 && t < 1) a = A_REST + (A_HIT - A_REST) * ((t - 0.8) / 0.2) ** 2;
      else if (t >= 1 && t < 1.14) a = A_HIT + (A_THRU - A_HIT) * (1 - (1 - (t - 1) / 0.14) ** 2);
      else if (t >= 1.14 && t < 1.8) a = A_THRU + (A_REST - A_THRU) * ease((t - 1.14) / 0.66);
      r.setAttribute('transform', `translate(${PIV[0]} ${PIV[1]}) rotate(${a.toFixed(1)})`);
      w.style.opacity = (t >= 1 && t < 1.6 ? 1 - 0.55 * ((t - 1) / 0.6) : 0.45).toFixed(2);
    };
    if (reduce) {
      put(1);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const loop = (now: number) => {
      put(((now - t0) / 1000) % 2.2);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [reduce]);
  const e = at(0.62), l = at(0.97);
  return (
    <svg className="rl-demo" viewBox="0 6 280 114" aria-hidden="true">
      <path className="fl" d="M4 104H276" />
      <path className="nt" d="M100 104V74" />
      <path className="arc" d={ARC} />
      <path className="win" d={WIN} ref={win} />
      <text x={e[0]} y="118" textAnchor="middle">
        early
      </text>
      <text className="now" x={C[0]} y="118" textAnchor="middle">
        now
      </text>
      <text x={l[0]} y="118" textAnchor="middle">
        late
      </text>
      <g ref={rk} className="rk" transform={`translate(${PIV[0]} ${PIV[1]}) rotate(${A_REST})`}>
        <path className="grip" d="M0 0V-15" />
        <path d={`M0 -15V${-RL + 13.5}`} />
        <ellipse cx="0" cy={-RL} rx="9.5" ry="13.5" />
      </g>
      <g ref={sh} className="sk" style={{ opacity: 0 }}>
        <path d="M-1 -2.6L-12.5 -6.2V6.2L-1 2.6" />
        <circle r="3.6" />
      </g>
    </svg>
  );
}

/** Keeps the speaker icon in step with the site's mute. */
export function useMuted(read: () => boolean) {
  const [m, setM] = useState(read);
  useEffect(() => {
    const t = setInterval(() => setM(read()), 500);
    return () => clearInterval(t);
  }, [read]);
  return m;
}

export const HUD_CSS = `
.rl { --rl-a: #88c0d0; position: fixed; inset: 0; z-index: 65; background: var(--bg); color: var(--t1); overflow: hidden;
  touch-action: none; overscroll-behavior: contain; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; outline: none; }
.rl [hidden] { display: none !important; }
/* An older talk.js without dlHead: keep its head out of the way instead. */
body:has(.rl.solo) .dl { visibility: hidden; }
.rl .p3d canvas { cursor: crosshair; }
.rl-hud { position: absolute; inset: 0; pointer-events: none; font-size: 15px; }
.rl-hud > * { position: absolute; }
.rl-top { top: max(12px, env(safe-area-inset-top)); left: 50%; transform: translateX(-50%); display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 18px;
  padding: 8px 18px; border-radius: 16px; background: var(--panel); box-shadow: 0 0 0 1px var(--rule), 0 10px 30px -18px rgba(0,0,0,0.35);
  -webkit-backdrop-filter: saturate(180%) blur(18px); backdrop-filter: saturate(180%) blur(18px); white-space: nowrap; }
.rl-side { display: flex; align-items: center; gap: 9px; min-width: 0; }
.rl-them { justify-content: flex-end; }
.rl-side span { color: var(--t3); font-size: 13px; }
.rl-side .sm { display: none; }
.rl-side b { font-size: 26px; font-weight: 500; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.rl-side i { width: 6px; height: 6px; border-radius: 50%; background: var(--rl-a); opacity: 0; transition: opacity 200ms ease; }
.rl-side i.on { opacity: 1; }
.rl-mid { display: flex; flex-direction: column; align-items: center; line-height: 1.15; min-width: 64px; }
.rl-mid .lab { font-size: 12px; color: var(--t3); }
.rl-mid .num { font-size: 20px; font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.rl-mid .bst { font-size: 11px; color: var(--t3); font-variant-numeric: tabular-nums; min-height: 1em; }
.rl-tools { position: absolute; z-index: 3; top: max(10px, env(safe-area-inset-top)); right: max(10px, env(safe-area-inset-right)); display: flex; gap: 4px; }
.rl-ic { display: grid; place-items: center; width: 42px; height: 42px; padding: 0; border: 0; border-radius: 50%; background: var(--panel); color: var(--t2); cursor: pointer;
  box-shadow: 0 0 0 1px var(--rule); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); }
.rl-ic:hover { color: var(--t1); }
.rl-ic:focus-visible { outline: 2px solid var(--rl-a); outline-offset: 2px; }
.rl-ic svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.rl-snd .off, .rl-snd.muted .on { display: none; }
.rl-snd.muted .off { display: block; }
.rl-say { left: 0; top: 0; z-index: 2; width: max-content; max-width: min(240px, 56vw); padding: 7px 12px; border-radius: 14px; background: var(--talk-paper, var(--bg)); color: var(--talk-ink, var(--t1));
  box-shadow: 0 0 0 1px var(--rule), 0 10px 28px -14px rgba(0,0,0,0.3); font-size: 14px; line-height: 1.35; opacity: 0; transition: opacity 160ms ease; }
.rl-say.on { opacity: 1; }
.rl-pops { inset: 0; }
/* On a chip: the net, the racket and the floor are all busy behind them. */
.rl-pop { position: absolute; left: 0; top: 0; padding: 6px 11px; border-radius: 999px; background: var(--panel); box-shadow: 0 0 0 1px var(--rule), 0 6px 18px -10px rgba(0,0,0,0.4);
  font-size: 15px; font-weight: 500; line-height: 1; color: var(--t1); white-space: nowrap; }
.rl-pop.good { font-weight: 600; }
.rl-caret { left: 0; top: 0; width: 30px; height: 30px; border-radius: 50%; display: grid; place-items: center; background: var(--panel); box-shadow: 0 0 0 1px var(--rule); opacity: 0; transition: opacity 120ms ease; }
.rl-caret.on { opacity: 1; }
.rl-caret svg { width: 16px; height: 16px; fill: none; stroke: var(--t1); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.rl-big { left: 0; right: 0; bottom: calc(max(16px, env(safe-area-inset-bottom)) + 64px); text-align: center; font-size: 28px; font-weight: 500; letter-spacing: -0.02em; opacity: 0; transition: opacity 200ms ease; text-shadow: 0 1px 14px var(--bg); }
.rl-big.on { opacity: 1; }
.rl-big small { display: block; margin-top: 6px; font-size: 14px; font-weight: 400; letter-spacing: 0; color: var(--t2); }
.rl-help { left: 50%; bottom: max(16px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: max-content; max-width: calc(100% - 32px); margin: 0; padding: 8px 14px; border-radius: 12px;
  background: var(--panel); box-shadow: 0 0 0 1px var(--rule); color: var(--t2); font-size: 13px; line-height: 1.4; text-align: center; opacity: 0; transition: opacity 400ms ease; }
.rl-help.on { opacity: 1; }
.rl-card { left: 50%; top: 60%; transform: translate(-50%, -50%); width: max-content; max-width: calc(100% - 32px); padding: 22px 30px 20px; border-radius: 18px; pointer-events: auto;
  background: var(--panel); box-shadow: 0 0 0 1px var(--rule), 0 24px 60px -28px rgba(0,0,0,0.45); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); text-align: center; }
.rl-card p { margin: 0; }
.rl-card .h { font-size: 24px; font-weight: 500; letter-spacing: -0.015em; }
.rl-card .p { margin-top: 2px; color: var(--t2); font-variant-numeric: tabular-nums; }
.rl-stats { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; margin-top: 12px; color: var(--t3); font-size: 13px; font-variant-numeric: tabular-nums; }
.rl-stats b { font-weight: 400; color: var(--t1); }
.rl-row { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 18px; }
.rl-go { padding: 10px 26px; border: 0; border-radius: 999px; background: var(--rl-a); color: #0e1a1f; font: inherit; font-weight: 500; cursor: pointer; transition: transform 120ms ease, filter 120ms ease; }
.rl-go.big { padding: 13px 36px; font-size: 17px; }
.rl-go:hover { filter: brightness(1.06); }
.rl-go:active { transform: scale(0.97); }
.rl-go:focus-visible, .rl-alt:focus-visible { outline: 2px solid var(--rl-a); outline-offset: 3px; }
.rl-alt { padding: 10px 14px; border: 0; border-radius: 999px; background: none; color: var(--t2); font: inherit; cursor: pointer; }
.rl-alt:hover { color: var(--t1); }
.rl-how { top: auto; bottom: max(20px, env(safe-area-inset-bottom)); transform: translateX(-50%); width: min(660px, calc(100% - 32px)); padding: 18px 24px 18px; text-align: left; }
.rl-hd { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.rl-card.rl-how .h { font-size: 22px; }
.rl-card.rl-how .p { margin: 0; font-size: 14px; }
.rl-bd { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: center; gap: 26px; margin-top: 12px; padding-top: 14px; border-top: 1px solid var(--rule); }
.rl-demo { display: block; width: 100%; height: auto; max-height: 132px; overflow: visible; }
.rl-demo .fl { stroke: var(--rule); stroke-width: 1.5; }
.rl-demo .nt { stroke: var(--t3); stroke-width: 2; stroke-linecap: round; }
.rl-demo .arc { fill: none; stroke: var(--t3); stroke-width: 2.2; stroke-dasharray: 0.1 6; stroke-linecap: round; }
.rl-demo .win { fill: none; stroke: var(--rl-a); stroke-width: 8; stroke-linecap: round; opacity: 0.45; }
.rl-demo text { font-size: 11px; fill: var(--t3); }
.rl-demo .now { font-weight: 600; fill: var(--t1); }
.rl-demo .rk { fill: none; stroke: var(--t1); stroke-width: 1.8; stroke-linecap: round; }
.rl-demo .rk ellipse { fill: var(--fill, transparent); }
.rl-demo .rk .grip { stroke-width: 5; }
.rl-demo .sk { fill: var(--panel); stroke: var(--t1); stroke-width: 1.3; stroke-linejoin: round; }
.rl-demo .sk circle { fill: var(--t1); stroke: none; }
.rl-keys { display: grid; gap: 8px; margin: 0; font-size: 14px; line-height: 1.45; }
.rl-keys div { display: grid; grid-template-columns: 50px minmax(0, 1fr); gap: 8px; align-items: baseline; }
.rl-keys dt { color: var(--t3); font-size: 13px; }
.rl-keys dd { margin: 0; color: var(--t1); }
.rl-hud kbd { display: inline-block; min-width: 22px; margin: 0 1px; padding: 0 6px; border-radius: 6px; font: inherit; font-size: 12px; line-height: 20px; text-align: center; color: var(--t1);
  background: var(--fill, transparent); box-shadow: inset 0 0 0 1px var(--rule), inset 0 -1.5px 0 var(--rule); white-space: nowrap; }
.rl-card .rl-more { display: flex; justify-content: space-between; gap: 6px; margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--rule); color: var(--t2); font-size: 13px; }
.rl-more span { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.rl-more kbd { margin: 0; }
.rl-mini { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; box-shadow: inset 0 0 0 1px var(--rule); color: var(--t1); }
.rl-mini svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.rl-mini .off { display: none; }
.rl-how .rl-row { gap: 14px; margin-top: 16px; }
.rl-how .rl-go.big { min-width: 200px; }
.rl-hint { color: var(--t3); font-size: 13px; }
.rl-wait { left: 0; right: 0; bottom: 18%; margin: 0; text-align: center; color: var(--t3); transition: opacity 300ms ease; }
.rl-wait.off { opacity: 0; }
.rl-wait small { display: block; margin-top: 4px; font-size: 13px; font-variant-numeric: tabular-nums; }
.rl .p3d-note { color: var(--t2); }
@media (max-width: 560px) {
  .rl-top { gap: 10px; padding: 6px 12px; top: max(10px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left)); transform: none; max-width: calc(100% - 174px); }
  .rl-side { gap: 6px; }
  .rl-side .lg { display: none; }
  .rl-side .sm { display: inline; }
  .rl-mid { min-width: 44px; }
  .rl-help { font-size: 12px; }
  .rl-side b { font-size: 22px; }
  .rl-side span { font-size: 12px; }
  .rl-mid .num { font-size: 18px; }
  .rl-big { font-size: 23px; }
  .rl-card { padding: 20px 22px 18px; }
  .rl-how { bottom: max(14px, env(safe-area-inset-bottom)); padding: 12px 16px; }
  .rl-card.rl-how .h { font-size: 19px; }
  .rl-card.rl-how .p { font-size: 13px; }
  .rl-bd { grid-template-columns: minmax(0, 1fr); gap: 10px; margin-top: 8px; padding-top: 8px; }
  .rl-demo { max-height: 86px; }
  .rl-keys { gap: 5px; }
  .rl-keys div { grid-template-columns: 46px minmax(0, 1fr); }
  .rl-card .rl-more { margin-top: 8px; padding-top: 8px; font-size: 12px; }
  .rl-mini { width: 24px; height: 24px; }
  .rl-how .rl-row { margin-top: 12px; }
  .rl-how .rl-go.big { width: 100%; min-height: 46px; padding: 11px 20px; }
}
/* A phone on its side. */
@media (max-height: 500px) {
  .rl-how { bottom: max(10px, env(safe-area-inset-bottom)); padding: 12px 20px; }
  .rl-card.rl-how .h { font-size: 19px; }
  .rl-bd { margin-top: 8px; padding-top: 8px; }
  .rl-card .rl-more { margin-top: 8px; padding-top: 8px; }
  .rl-how .rl-row { margin-top: 10px; }
  .rl-how .rl-go.big { padding: 10px 30px; }
}
/* Fingers: 44px to hit. */
@media (hover: none) and (pointer: coarse) {
  .rl-ic { width: 44px; height: 44px; }
}
@media (prefers-reduced-motion: reduce) {
  .rl-say, .rl-big, .rl-help, .rl-caret, .rl-wait { transition: none; }
}
`;
