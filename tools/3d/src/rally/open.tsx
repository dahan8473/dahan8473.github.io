// "Rally me": a full screen first person rally against the head, with the
// racket you picked in your hand. Lazy loaded by the racket viewer.
//
// openRally() puts a layer over the page, mounts the court in it, flies the
// site's floating head (window.dlHead, talk.js) onto the far side and takes
// over with the same head drawn in 3D, and returns close(). close() flies the
// head home and takes everything down (immediately when asked, for a page
// swap mid-rally). Without dlHead the floating head just hides while you play.
//
// The rally owns its lifecycle on the site's bus (window.dlBus, talk.js):
// game_start once when it opens, game_end once (with the score) when it closes.
//
// The first time (HOW_KEY), how to play comes up once the head has landed and
// the first serve waits for it. The ? in the corner brings it back, paused.
import { NeutralToneMapping } from 'three';
import { mountCanvas } from '../lib/mountCanvas';
import { createStore } from '../lib/store';
import { Rally, readBest, WIN, type HudState } from './engine';
import { Hud, HUD_CSS, ICONS } from './Hud';
import { nickname } from './lines';
import { RallyScene, type Ui } from './Scene';
import { makeSound } from './sound';

interface HeadApi {
  rect(): DOMRect;
  away(on: boolean): void;
  flyTo(x: number, y: number, w: number, ms?: number): Promise<void>;
  home(ms?: number): Promise<void>;
}

export interface RallyOptions {
  /** Your racket's model. */
  model: string;
  /** The head's racket. */
  foeModel: string;
  name: string;
  /** Grow out of this rect (the Rally me button). */
  from?: DOMRect | null;
  onClose: () => void;
}

const EASE = 'cubic-bezier(.45,.05,.25,1)';
const HOW_KEY = 'dl-badminton-how';
const site = (): HeadApi | null => {
  const a = (window as unknown as { dlHead?: HeadApi }).dlHead;
  return a && typeof a.flyTo === 'function' && typeof a.away === 'function' && typeof a.home === 'function' ? a : null;
};
const tell = (type: string, data: unknown) => {
  const b = (window as unknown as { dlBus?: { emit?: (type: string, data: unknown) => void } }).dlBus;
  try {
    if (b && typeof b.emit === 'function') b.emit(type, data);
  } catch {}
};

export function openRally(o: RallyOptions): (now?: boolean) => void {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const over = document.createElement('div');
  over.className = 'rl';
  over.tabIndex = -1;
  over.setAttribute('role', 'dialog');
  over.setAttribute('aria-modal', 'true');
  over.setAttribute('aria-label', 'Badminton with the head');
  const style = document.createElement('style');
  style.textContent = HUD_CSS;
  over.appendChild(style);
  // The tools live outside React so x works even when 3D can't.
  const tools = document.createElement('div');
  tools.className = 'rl-tools';
  // Space and Enter swing while you play, so these also have keys: ?, M and Escape.
  tools.innerHTML =
    `<button class="rl-ic rl-how-btn" type="button" aria-label="How to play" aria-keyshortcuts="?" title="How to play (?)" hidden>${ICONS.how}</button>` +
    `<button class="rl-ic rl-snd" type="button" aria-label="Sound on or off" aria-keyshortcuts="M" title="Sound (M)">${ICONS.on}${ICONS.off}</button>` +
    `<button class="rl-ic rl-x" type="button" aria-label="Stop playing" aria-keyshortcuts="Escape" title="Stop playing (Esc)">${ICONS.x}</button>`;
  over.appendChild(tools);
  const snd = tools.querySelector('.rl-snd') as HTMLButtonElement;
  const xBtn = tools.querySelector('.rl-x') as HTMLButtonElement;
  const howBtn = tools.querySelector('.rl-how-btn') as HTMLButtonElement;
  document.body.appendChild(over);
  const scrollWas = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  const before = document.activeElement as HTMLElement | null;
  over.focus({ preventScroll: true });

  if (!reduce) {
    const r = o.from;
    const clip = r
      ? `inset(${Math.max(0, r.top).toFixed(0)}px ${Math.max(0, innerWidth - r.right).toFixed(0)}px ${Math.max(0, innerHeight - r.bottom).toFixed(0)}px ${Math.max(0, r.left).toFixed(0)}px round 28px)`
      : 'inset(40% 40% 40% 40% round 24px)';
    over.animate([{ clipPath: clip, opacity: 0.5 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }], { duration: 520, easing: EASE });
  }

  const sound = makeSound();
  sound.unlock();
  const hud = createStore<HudState>({ me: 0, foe: 0, rally: 0, best: readBest(), server: 'me', phase: 'intro', card: '', won: false, longest: 0, big: '', bigSub: '', help: true });
  const g = new Rally({ sound, reduce, hud, touch, racket: nickname(o.name) });
  g.stage();
  // For poking at it from the console or a test: document.querySelector('.rl').rally
  (over as unknown as { rally: Rally }).rally = g;

  let closed = false;
  let lent = false;
  let arrived = false;
  let started = false;
  // Over the end card, the how to play card goes back to it; otherwise it resumes.
  let howFrom: HudState['card'] = '';
  const ui: Ui = {
    say: null,
    pops: null,
    caret: null,
    top: null,
    head: null,
    onReady: () => {
      if (closed) return;
      // Wait out the layer's own entrance, then bring the head over.
      setTimeout(bringHead, reduce ? 0 : 380);
    }
  };
  async function bringHead() {
    if (closed || arrived) return;
    const s = site();
    const r = ui.head;
    if (s && r) {
      lent = true;
      try {
        await s.flyTo(r.x, r.y, r.w, reduce ? 0 : 950);
        // The view may have settled a little while it flew: land exactly.
        const q = ui.head;
        if (!closed && q && Math.hypot(q.x - r.x, q.y - r.y) + Math.abs(q.w - r.w) > 6) await s.flyTo(q.x, q.y, q.w, reduce ? 0 : 140);
      } catch {}
      if (closed) return;
    } else over.classList.add('solo');
    arrived = true;
    g.arrive();
    howBtn.hidden = false;
    // Hide the floating one once ours has drawn in its place.
    requestAnimationFrame(() => requestAnimationFrame(() => !closed && lent && s?.away(true)));
    let seen = false;
    try {
      seen = localStorage.getItem(HOW_KEY) === '1';
    } catch {}
    if (seen) start();
    else hud.set({ card: 'how' });
  }
  function start() {
    if (closed || started) return;
    started = true;
    try {
      localStorage.setItem(HOW_KEY, '1');
    } catch {}
    g.begin();
  }

  // The cards' buttons go with the card: keep focus in the layer, not on the page.
  const offCard = () => {
    if (document.activeElement?.closest('.rl-card')) over.focus({ preventScroll: true });
  };
  const act = {
    again: () => {
      sound.unlock();
      offCard();
      g.startGame();
    },
    done: () => close(),
    resume: () => {
      offCard();
      g.resume();
    },
    howDone: () => {
      if (closed || hud.get().card !== 'how') return;
      sound.unlock();
      offCard();
      if (!started) {
        hud.set({ card: '' });
        start();
      } else if (howFrom) hud.set({ card: howFrom });
      else g.resume();
    }
  };
  // The ?: how to play over a paused game, or off again.
  const howToggle = () => {
    if (closed || !arrived) return;
    const c = hud.get().card;
    if (c === 'how') return act.howDone();
    howFrom = c === 'end' ? c : '';
    if (c) hud.set({ card: 'how' });
    else g.pause('how');
  };
  const stop = mountCanvas(over, {
    className: 'p3d-rally',
    camera: { fov: 60, near: 0.04, far: 120, position: [0.5, 1.62, 3.9] },
    scene: <RallyScene g={g} ui={ui} model={o.model} foeModel={o.foeModel} />,
    html: <Hud hud={hud} ui={ui} act={act} touch={touch} reduce={reduce} />,
    canvas: {
      style: { position: 'absolute', inset: 0, touchAction: 'none' },
      onCreated: ({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
      }
    },
    fallback: 'The rally needs 3D graphics, which this browser has turned off. Press Escape to go back.'
  });
  // mountCanvas puts its style and root after ours; keep the tools on top.
  over.appendChild(tools);

  // ---- Input ---------------------------------------------------------------------
  // Desktop: the pointer aims (its spot on the screen), click or space swings.
  // Touch: drag aims like a trackpad, a tap swings (when it's coming to you;
  // otherwise a press starts aiming), a second finger always swings, and your
  // serve goes on release so you can aim first.
  const aimFrom = (x: number, y: number) => {
    const r = over.getBoundingClientRect();
    g.aim.x = Math.max(-1, Math.min(1, ((x - r.left) / r.width - 0.5) / 0.38));
    g.aim.y = Math.max(-1, Math.min(1, (0.52 - (y - r.top) / r.height) / 0.3));
  };
  let drag: { id: number; x0: number; y0: number; ax: number; ay: number; t0: number; moved: boolean } | null = null;
  const onDown = (e: PointerEvent) => {
    const t = e.target as Element;
    if (closed || t.closest('button, .rl-card')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    sound.unlock();
    if (e.pointerType === 'mouse') {
      aimFrom(e.clientX, e.clientY);
      g.swing();
      return;
    }
    if (drag) {
      g.swing();
      return;
    }
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ax: g.aim.x, ay: g.aim.y, t0: performance.now(), moved: false };
    try {
      over.setPointerCapture(e.pointerId);
    } catch {}
    if (g.phase === 'rally' && g.untilContact() < 0.75) g.swing();
  };
  const onMove = (e: PointerEvent) => {
    if (closed || g.paused) return;
    if (e.pointerType === 'mouse') {
      aimFrom(e.clientX, e.clientY);
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    const r = over.getBoundingClientRect();
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (Math.hypot(dx, dy) > 8) drag.moved = true;
    g.aim.x = Math.max(-1, Math.min(1, drag.ax + dx / (r.width * 0.32)));
    g.aim.y = Math.max(-1, Math.min(1, drag.ay - dy / (r.height * 0.22)));
  };
  const onUp = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    // A tap (not an aiming drag) serves.
    if (e.type === 'pointerup' && g.phase === 'serve' && g.server === 'me' && !d.moved && performance.now() - d.t0 < 900) g.swing();
  };
  const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  // A point is on: Space and Enter swing even with a button focused (the
  // cards' buttons and the tools press as usual when it's paused or over).
  const playing = () => !g.paused && (g.phase === 'serve' || g.phase === 'rally' || g.phase === 'point');
  let took = '';
  const onKey = (e: KeyboardEvent) => {
    if (closed || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    // Everything here is ours while the court is up.
    e.stopPropagation();
    if (k === 'Escape') {
      e.preventDefault();
      close();
      return;
    }
    // Keep Tab inside the layer.
    if (k === 'Tab') {
      const f = [...over.querySelectorAll<HTMLElement>('button')].filter((b) => b.offsetParent !== null);
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      f[e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i + 1) % f.length].focus();
      e.preventDefault();
      return;
    }
    const onButton = e.target instanceof Element && !!e.target.closest('button');
    const press = k === ' ' || k === 'Enter';
    if (press && onButton && !playing()) return;
    if (press) took = k;
    if (press && hud.get().card === 'how') {
      if (!e.repeat) act.howDone();
    } else if (k === '?') howToggle();
    else if (k === 'p') {
      if (g.paused) act.resume();
      else g.pause();
    } else if (press || k === 'j' || k === 'k') {
      if (!e.repeat) g.swing();
    } else if (k === 'm') snd.click();
    else if (k === 'ArrowLeft' || k === 'a') g.aim.x = Math.max(-1, g.aim.x - 0.2);
    else if (k === 'ArrowRight' || k === 'd') g.aim.x = Math.min(1, g.aim.x + 0.2);
    else if (k === 'ArrowUp' || k === 'w') g.aim.y = Math.min(1, g.aim.y + 0.25);
    else if (k === 'ArrowDown' || k === 's') g.aim.y = Math.max(-1, g.aim.y - 0.25);
    else return;
    e.preventDefault();
  };
  // A focused button presses on Space's keyup: not when its keydown swung.
  const onKeyUp = (e: KeyboardEvent) => {
    if (closed || !took || e.key !== took) return;
    took = '';
    e.stopPropagation();
    e.preventDefault();
  };
  const onVis = () => {
    if (document.hidden) g.pause();
  };
  const onCtx = (e: Event) => e.preventDefault();
  over.addEventListener('pointerdown', onDown);
  over.addEventListener('pointermove', onMove);
  over.addEventListener('pointerup', onUp);
  over.addEventListener('pointercancel', onUp);
  over.addEventListener('contextmenu', onCtx);
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('keyup', onKeyUp, true);
  document.addEventListener('visibilitychange', onVis);
  const sndSync = () => snd.classList.toggle('muted', sound.muted());
  sndSync();
  const sndTimer = setInterval(sndSync, 500);
  snd.addEventListener('click', () => {
    sound.unlock();
    const siteMute = document.querySelector('.dl-mute') as HTMLElement | null;
    if (siteMute) siteMute.click();
    else {
      try {
        localStorage.setItem('dl-sound', sound.muted() ? '1' : '0');
      } catch {}
    }
    sndSync();
  });
  xBtn.addEventListener('click', () => close());
  howBtn.addEventListener('click', howToggle);

  // ---- Out ----------------------------------------------------------------------------
  // The floating head appears where ours is, the game ends, and it flies home.
  // In that order: talk.js takes a flyTo outside a game for a new one, and
  // ends one on home() by itself (without the score) if nobody has.
  function giveBack(ms: number) {
    const s = lent ? site() : null;
    const r = ui.head;
    if (s && arrived && r) {
      try {
        s.flyTo(r.x, r.y, r.w, 0);
      } catch {}
    }
    const decided = g.phase === 'end' || Math.max(g.score.me, g.score.foe) >= WIN;
    tell('game_end', { game: 'rally', result: { won: decided ? g.score.me > g.score.foe : null, you: g.score.me, me: g.score.foe, longest: Math.max(g.gameBest, g.rally) } });
    if (!s) return;
    lent = false;
    try {
      s.away(false);
      s.home(ms);
    } catch {}
  }
  function close(now = false) {
    if (closed) return;
    closed = true;
    g.paused = true;
    g.hush();
    clearInterval(sndTimer);
    over.removeEventListener('pointerdown', onDown);
    over.removeEventListener('pointermove', onMove);
    over.removeEventListener('pointerup', onUp);
    over.removeEventListener('pointercancel', onUp);
    over.removeEventListener('contextmenu', onCtx);
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('keyup', onKeyUp, true);
    document.removeEventListener('visibilitychange', onVis);
    giveBack(reduce ? 0 : 800);
    const done = () => {
      stop();
      sound.close();
      over.remove();
      document.documentElement.style.overflow = scrollWas;
    };
    if (now || reduce) done();
    else {
      over.style.pointerEvents = 'none';
      over.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 320, easing: 'ease', fill: 'forwards' }).finished.then(done, done);
    }
    o.onClose();
    // Back to where they were (Rally me) once its card is showing again,
    // unless they've gone somewhere else meanwhile.
    const back = (n: number) => {
      const a = document.activeElement;
      if (!before || before === document.body || !document.contains(before) || (a && a !== document.body && !over.contains(a))) return;
      before.focus({ preventScroll: true });
      if (document.activeElement !== before && n < 10) setTimeout(() => back(n + 1), 50);
    };
    if (!now) setTimeout(() => back(0), 0);
  }
  tell('game_start', { game: 'rally' });
  return close;
}
