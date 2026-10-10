// DOM over the court: the score, the head's speech bubble, pops, the big
// "your serve", a help line, and the cards (paused, the end of a game).
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Store } from '../lib/store';
import type { HudState } from './engine';
import type { Ui } from './Scene';

export interface HudActions {
  again(): void;
  done(): void;
  resume(): void;
}

export function Hud({ hud, ui, act, touch }: { hud: Store<HudState>; ui: Ui; act: HudActions; touch: boolean }) {
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
      <div className={'rl-big' + (s.big ? ' on' : '')} aria-hidden="true">
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
      <p className={'rl-wait' + (s.phase === 'intro' ? '' : ' off')}>The head is coming over...</p>
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
.rl-stats { display: flex; justify-content: center; gap: 18px; margin-top: 12px; color: var(--t3); font-size: 13px; font-variant-numeric: tabular-nums; }
.rl-stats b { font-weight: 400; color: var(--t1); }
.rl-row { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 18px; }
.rl-go { padding: 10px 26px; border: 0; border-radius: 999px; background: var(--rl-a); color: #0e1a1f; font: inherit; font-weight: 500; cursor: pointer; transition: transform 120ms ease, filter 120ms ease; }
.rl-go.big { padding: 13px 36px; font-size: 17px; }
.rl-go:hover { filter: brightness(1.06); }
.rl-go:active { transform: scale(0.97); }
.rl-go:focus-visible, .rl-alt:focus-visible { outline: 2px solid var(--rl-a); outline-offset: 3px; }
.rl-alt { padding: 10px 14px; border: 0; border-radius: 999px; background: none; color: var(--t2); font: inherit; cursor: pointer; }
.rl-alt:hover { color: var(--t1); }
.rl-wait { left: 0; right: 0; bottom: 18%; margin: 0; text-align: center; color: var(--t3); transition: opacity 300ms ease; }
.rl-wait.off { opacity: 0; }
.rl .p3d-note { color: var(--t2); }
@media (max-width: 560px) {
  .rl-top { gap: 10px; padding: 6px 12px; top: max(10px, env(safe-area-inset-top)); left: max(10px, env(safe-area-inset-left)); transform: none; max-width: calc(100% - 128px); }
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
}
@media (prefers-reduced-motion: reduce) {
  .rl-say, .rl-big, .rl-help, .rl-caret, .rl-wait { transition: none; }
}
`;
