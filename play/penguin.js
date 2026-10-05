// Penguin Rally: my version of the Lumosity spatial orientation game.
//   <div class="play" data-play="penguin" data-v="N">
// Walk a penguin through a maze on an iceberg to the fish. Up always moves
// toward the orange arrow painted on the board, and the board turns on screen,
// so the controls have to be re-mapped on the fly. Like Lumosity's Penguin
// Rally, a session is Time Trials, then Races: two trials against the clock
// (bonus for every second under par, no hurry otherwise), then three races
// against a recording of me on the same maze, my penguin walking it the way I
// did, step for step. Race mazes, start corners and turns come from fixed seeds
// so the recording always fits. Recordings: /hobbies/lumosity/penguin-david.json,
// made by playing with #record-penguin on the page URL. Until a race has one,
// it's a rival penguin that walks the shortest path with the odd wrong turn.
// Card, tutorial, play, results. Scores: best.json has mine, localStorage the visitor's.

import { countdown } from './countdown.js';

const CSS_ID = 'play-penguin-css';
const KEY_BEST = 'dl-lumo-penguin';
const KEY_TUT = 'dl-lumo-penguin-tut';
const ICE = '#88c0d0';
const ARROW = '#d08770';
const NS = 'http://www.w3.org/2000/svg';
const C = 10; // cell size in board units
const DR = [-1, 0, 1, 0]; // north, east, south, west (board frame)
const DC = [0, 1, 0, -1];

// The session. Trials are fresh mazes each time; races are fixed by seed.
// spin: ms between mid-maze turns. Rival (no recording yet): base is ms per
// shortest-path step, err the chance of a wrong turn at a junction.
const PLAN = [
  { n: 5, kind: 'trial' },
  { n: 6, kind: 'trial', turned: true },
  { n: 7, kind: 'race', seed: 7101, spin: 7000, base: 560, err: 0.15 },
  { n: 8, kind: 'race', seed: 8202, spin: 6000, base: 500, err: 0.1 },
  { n: 9, kind: 'race', seed: 9303, spin: 5000, base: 450, err: 0.05 }
];
const RACES = PLAN.filter((p) => p.kind === 'race').length;
const GHOST_URL = '/hobbies/lumosity/penguin-david.json';

// Small seeded generator (mulberry32), so a race is the same maze for everyone.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CSS = `
.ppg { --ppg-me: #2e3440; max-width: 640px; }
[data-theme="dark"] .ppg { --ppg-me: #4c566a; }
.ppg-panel { padding: 22px; border-radius: 14px; background: var(--fill); }
.ppg-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.ppg-name { color: var(--t1); font-weight: 500; }
.ppg-what { color: var(--t2); }
.ppg-icon { flex: none; width: 56px; height: 56px; }
.ppg-lines { margin: 16px 0 20px; color: var(--t2); }
.ppg-lines b { font-weight: 400; color: var(--t1); }
.ppg-lines .say { margin-top: 8px; color: var(--t1); }
.ppg-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
.ppg-btn { min-height: 44px; padding: 8px 22px; border: 0; border-radius: 999px; background: var(--t1); color: var(--bg); font: inherit; cursor: pointer; transition: opacity 160ms ease; }
.ppg-btn:hover { opacity: 0.86; }
.ppg-link { min-height: 44px; padding: 4px 0; border: 0; background: none; color: var(--t2); font: inherit; cursor: pointer; }
.ppg-link:hover { color: var(--t1); }
.ppg :is(.ppg-btn, .ppg-link):focus-visible { border-radius: 999px; }
.ppg-hud { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; color: var(--t3); }
.ppg-hud span span { color: var(--t1); }
.ppg-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
.ppg-head p { min-height: 3.2em; }
.ppg-head .ppg-link { margin-top: -10px; flex: none; }
.ppg-stage { position: relative; overflow: hidden; touch-action: none; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.ppg-board { width: 100%; max-width: 420px; aspect-ratio: 1; margin: 0 auto; }
.ppg-tut .ppg-board { max-width: 300px; }
.ppg-board svg { display: block; width: 100%; height: 100%; overflow: visible; }
.ppg-flag { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 6px 14px; border-radius: 999px; background: var(--bg); color: var(--t1); box-shadow: 0 0 0 1px var(--rule); white-space: nowrap; pointer-events: none; opacity: 0; transition: opacity 160ms ease; }
.ppg-flag.on { opacity: 1; }
.ppg-line { min-height: 1.6em; margin-top: 10px; color: var(--t2); text-align: center; }
.ppg-keys { margin-top: 2px; color: var(--t3); text-align: center; }
.ppg-pad { display: none; grid-template-columns: repeat(3, 60px); grid-template-rows: repeat(2, 52px); gap: 6px; justify-content: center; margin-top: 12px; }
.ppg-pad button { display: flex; align-items: center; justify-content: center; border: 0; border-radius: 12px; background: var(--fill); color: var(--t1); touch-action: none; cursor: pointer; }
.ppg-pad button:active { background: var(--rule); }
.ppg-pad svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.ppg-pad .u { grid-area: 1 / 2; } .ppg-pad .l { grid-area: 2 / 1; } .ppg-pad .d { grid-area: 2 / 2; } .ppg-pad .r { grid-area: 2 / 3; }
@media (hover: none), (pointer: coarse) { .ppg-pad { display: grid; } .ppg-keys { display: none; } }
.ppg-ice { fill: color-mix(in srgb, ${ICE} 30%, var(--bg)); }
.ppg-floor { fill: color-mix(in srgb, ${ICE} 12%, var(--bg)); }
.ppg-dot { fill: var(--rule); }
.ppg-tag { font-size: 3.4px; font-weight: 600; fill: var(--t1); paint-order: stroke; stroke: var(--bg); stroke-width: 0.9px; stroke-linejoin: round; }
.ppg-clock { height: 3px; margin: -4px 0 10px; border-radius: 2px; background: var(--rule); overflow: hidden; }
.ppg-clock i { display: block; height: 100%; width: 100%; background: ${ICE}; transform-origin: left; transition: background 300ms ease; }
.ppg-clock.late i { background: ${ARROW}; }
.ppg-clock.off { visibility: hidden; }
.ppg-rec { margin: 0 0 10px; padding: 8px 12px; border-radius: 10px; background: color-mix(in srgb, ${ARROW} 16%, var(--fill)); color: var(--t1); }
.ppg-wall { fill: none; stroke: color-mix(in srgb, ${ICE} 45%, var(--t1)); stroke-linecap: round; stroke-linejoin: round; }
@media (max-width: 520px) { .ppg-panel { padding: 18px; } }
`;

function useCss(id, css) {
  let s = document.getElementById(id);
  if (!s) {
    s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }
  s.dataset.users = String(Number(s.dataset.users || 0) + 1);
  return () => {
    const n = Number(s.dataset.users || 1) - 1;
    if (n <= 0) s.remove();
    else s.dataset.users = String(n);
  };
}

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function sv(tag, attrs, parent) {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

const pick = (a, rnd = Math.random) => a[(rnd() * a.length) | 0];
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const touchy = () => window.matchMedia('(hover: none), (pointer: coarse)').matches;

function readBest() {
  try { const v = Number(localStorage.getItem(KEY_BEST)); return v > 0 ? v : 0; } catch (e) { return 0; }
}
function store(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
function tutDone() { try { return localStorage.getItem(KEY_TUT) === '1'; } catch (e) { return false; } }

// ---- Maze ----------------------------------------------------------------------
// open[cell] has bit d set when you can walk from that cell in direction d.

function genMaze(n, rnd = Math.random) {
  const open = new Uint8Array(n * n);
  const seen = new Uint8Array(n * n);
  const stack = [(rnd() * n * n) | 0];
  seen[stack[0]] = 1;
  while (stack.length) {
    const c = stack[stack.length - 1];
    const r = (c / n) | 0, k = c % n;
    const opts = [];
    for (let d = 0; d < 4; d++) {
      const nr = r + DR[d], nk = k + DC[d];
      if (nr >= 0 && nr < n && nk >= 0 && nk < n && !seen[nr * n + nk]) opts.push(d);
    }
    if (!opts.length) { stack.pop(); continue; }
    const d = pick(opts, rnd);
    const x = (r + DR[d]) * n + k + DC[d];
    open[c] |= 1 << d;
    open[x] |= 1 << ((d + 2) % 4);
    seen[x] = 1;
    stack.push(x);
  }
  return { n, open };
}

// Every passage open, then the listed walls put back: [cell, dir] pairs.
function openMaze(n, walls) {
  const m = { n, open: new Uint8Array(n * n) };
  for (let c = 0; c < n * n; c++) {
    for (let d = 0; d < 4; d++) {
      const r = ((c / n) | 0) + DR[d], k = (c % n) + DC[d];
      if (r >= 0 && r < n && k >= 0 && k < n) m.open[c] |= 1 << d;
    }
  }
  for (const [c, d] of walls) { m.open[c] &= ~(1 << d); m.open[stepOf(m, c, d)] &= ~(1 << ((d + 2) % 4)); }
  return m;
}

const stepOf = (m, c, d) => c + DR[d] * m.n + DC[d];
const exits = (m, c) => [0, 1, 2, 3].filter((d) => m.open[c] >> d & 1).map((d) => stepOf(m, c, d));

// Steps from every cell to the fish.
function distances(m, goal) {
  const dist = new Int16Array(m.n * m.n).fill(-1);
  dist[goal] = 0;
  const q = [goal];
  for (let i = 0; i < q.length; i++) {
    for (const x of exits(m, q[i])) if (dist[x] < 0) { dist[x] = dist[q[i]] + 1; q.push(x); }
  }
  return dist;
}

// ---- Drawing -------------------------------------------------------------------
// Sprites are drawn around 0,0 in board units, about a cell across.

function penguin(g, body, scarf) {
  sv('circle', { r: 5, fill: 'transparent' }, g);
  sv('ellipse', { cx: -1.6, cy: 3.9, rx: 1.4, ry: 0.7, fill: '#ebcb8b' }, g);
  sv('ellipse', { cx: 1.6, cy: 3.9, rx: 1.4, ry: 0.7, fill: '#ebcb8b' }, g);
  const b = sv('g', { style: 'fill: ' + body }, g);
  sv('ellipse', { cx: -3, cy: 1, rx: 0.9, ry: 2.2, transform: 'rotate(18 -3 1)' }, b);
  sv('ellipse', { cx: 3, cy: 1, rx: 0.9, ry: 2.2, transform: 'rotate(-18 3 1)' }, b);
  sv('ellipse', { cx: 0, cy: 0.6, rx: 3.2, ry: 3.8 }, b);
  sv('circle', { cx: 0, cy: -2.3, r: 2.6 }, b);
  sv('ellipse', { cx: 0, cy: 1.3, rx: 2.2, ry: 2.6, fill: '#fbfbfd' }, g);
  sv('ellipse', { cx: 0, cy: -2, rx: 1.9, ry: 1.5, fill: '#fbfbfd' }, g);
  sv('circle', { cx: -0.8, cy: -2.3, r: 0.42, fill: '#2e3440' }, g);
  sv('circle', { cx: 0.8, cy: -2.3, r: 0.42, fill: '#2e3440' }, g);
  sv('path', { d: 'M-0.7 -1.6 L0.7 -1.6 L0 -0.8 Z', fill: '#ebcb8b' }, g);
  if (scarf) sv('rect', { x: -2.6, y: -0.6, width: 5.2, height: 1, rx: 0.5, fill: scarf }, g);
}

function fish(g) {
  sv('circle', { r: 5, fill: 'transparent' }, g);
  sv('path', { d: 'M1.6 0 L4 -1.9 L4 1.9 Z', fill: '#5e81ac' }, g);
  sv('ellipse', { cx: -0.8, cy: 0, rx: 3, ry: 1.8, fill: '#5e81ac' }, g);
  sv('path', { d: 'M-1.4 -1.6 Q0 -2.9 1.2 -1.4 Z', fill: '#81a1c1' }, g);
  sv('circle', { cx: -2.5, cy: -0.3, r: 0.4, fill: '#fbfbfd' }, g);
}

// The board: an iceberg with a maze and the orange arrow on its north edge. It
// turns as a whole; sprites ride on it but counter-turn to stay upright. While
// it turns it shrinks so the corners never poke out of its square.
function makeBoard() {
  const wrap = h('div', 'ppg-board');
  const svg = sv('svg', { 'aria-hidden': 'true' }, wrap);
  const ground = sv('g', {}, svg);
  const top = sv('g', {}, svg);
  let sprites = [];
  let ang = { from: 0, to: 0, t0: 0, dur: 0 };
  let shown = 0, n = 0, M = 0;

  const center = (cell) => [M + (cell % n) * C + C / 2, M + ((cell / n) | 0) * C + C / 2];

  return {
    wrap,
    get rot() { return ang.to; },
    setMaze(m) {
      n = m.n;
      M = C * (0.7 + 0.06 * n);
      const S = n * C + 2 * M;
      svg.setAttribute('viewBox', `0 0 ${S} ${S}`);
      ground.textContent = '';
      top.textContent = '';
      sprites = [];
      sv('rect', { class: 'ppg-ice', width: S, height: S, rx: S * 0.07 }, ground);
      sv('rect', { class: 'ppg-floor', x: M, y: M, width: n * C, height: n * C, rx: 1 }, ground);
      for (let c = 0; c < n * n; c++) {
        const [x, y] = center(c);
        sv('circle', { class: 'ppg-dot', cx: x, cy: y, r: 0.5 }, ground);
      }
      const a = M * 0.7;
      sv('path', { d: `M${S / 2 - a} ${M * 0.82} L${S / 2 + a} ${M * 0.82} L${S / 2} ${M * 0.14} Z`, fill: ARROW, 'stroke-linejoin': 'round', stroke: ARROW, 'stroke-width': M * 0.08 }, ground);
      let d = `M${M} ${M}h${n * C}v${n * C}h${-n * C}Z`;
      for (let c = 0; c < n * n; c++) {
        const r = (c / n) | 0, k = c % n, x = M + k * C, y = M + r * C;
        if (k < n - 1 && !(m.open[c] >> 1 & 1)) d += `M${x + C} ${y}v${C}`;
        if (r < n - 1 && !(m.open[c] >> 2 & 1)) d += `M${x} ${y + C}h${C}`;
      }
      sv('path', { class: 'ppg-wall', d, 'stroke-width': S * 0.016 }, ground);
    },
    // kind: 'fish', or a penguin as [body, scarf, label, opacity]. A label
    // rides above it, upright like the penguin.
    add(kind, cell, scale) {
      const g = sv('g', {}, top);
      const inner = sv('g', {}, g);
      const art = sv('g', { transform: `scale(${scale || 1})` }, inner);
      if (kind === 'fish') fish(art); else penguin(art, kind[0], kind[1]);
      if (kind !== 'fish' && kind[2]) {
        const t = sv('text', { class: 'ppg-tag', y: -6.6 * (scale || 1), 'text-anchor': 'middle' }, inner);
        t.textContent = kind[2];
      }
      if (kind !== 'fish' && kind[3]) g.setAttribute('opacity', kind[3]);
      const [x, y] = center(cell);
      g.setAttribute('transform', `translate(${x} ${y})`);
      const sp = { g, inner, x, y, fx: x, fy: y, tx: x, ty: y, t0: 0, bump: -1, bt: 0 };
      sprites.push(sp);
      return sp;
    },
    put(sp, cell) {
      [sp.tx, sp.ty] = center(cell);
      sp.fx = sp.x; sp.fy = sp.y;
      sp.t0 = performance.now();
      if (reduced()) { sp.fx = sp.tx; sp.fy = sp.ty; }
    },
    bump(sp, d) { sp.bump = d; sp.bt = performance.now(); },
    turn(to, instant) {
      ang = { from: shown, to, t0: performance.now(), dur: instant || reduced() ? 0 : 750 };
    },
    frame(now) {
      const k = ang.dur ? Math.min(1, (now - ang.t0) / ang.dur) : 1;
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      shown = ang.from + (ang.to - ang.from) * e;
      const rad = shown * Math.PI / 180;
      const s = 1 / (Math.abs(Math.cos(rad)) + Math.abs(Math.sin(rad)));
      wrap.style.transform = `rotate(${shown}deg) scale(${s})`;
      for (const sp of sprites) {
        const t = Math.min(1, (now - sp.t0) / 110);
        sp.x = sp.fx + (sp.tx - sp.fx) * t;
        sp.y = sp.fy + (sp.ty - sp.fy) * t;
        let bx = 0, by = 0;
        if (sp.bump >= 0) {
          const b = (now - sp.bt) / 140;
          if (b >= 1 || reduced()) sp.bump = -1;
          else { const o = Math.sin(Math.PI * b) * 1.4; bx = DC[sp.bump] * o; by = DR[sp.bump] * o; }
        }
        sp.g.setAttribute('transform', `translate(${sp.x + bx} ${sp.y + by})`);
        sp.inner.setAttribute('transform', `rotate(${-shown})`);
      }
    }
  };
}

// A new on-screen orientation (0-3 quarter turns), the short way round.
function turnTo(board, avoidZero, rnd = Math.random) {
  const now = (((Math.round(board.rot / 90)) % 4) + 4) % 4;
  const opts = [0, 1, 2, 3].filter((o) => o !== now && !(avoidZero && o === 0));
  const diff = (pick(opts, rnd) - now + 4) % 4;
  board.turn(board.rot + (diff === 3 ? -90 : diff === 2 ? pick([180, -180], rnd) : 90));
}

const CHEV = ['M5 15l7-7 7 7', 'M9 5l7 7-7 7', 'M5 9l7 7 7-7', 'M15 5l-7 7 7 7'];
function padEl() {
  const pad = h('div', 'ppg-pad');
  ['u', 'r', 'd', 'l'].forEach((c, d) => {
    const b = h('button', c);
    b.type = 'button';
    b.dataset.dir = d;
    b.setAttribute('aria-label', ['Up', 'Right', 'Down', 'Left'][d]);
    b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${CHEV[d]}"/></svg>`;
    pad.appendChild(b);
  });
  return pad;
}

function icon() {
  const s = sv('svg', { class: 'ppg-icon', viewBox: '0 0 40 40', 'aria-hidden': 'true' });
  sv('rect', { class: 'ppg-ice', x: 4, y: 4, width: 32, height: 32, rx: 5, transform: 'rotate(-12 20 20)' }, s);
  sv('path', { d: 'M17 9.6 L23 8.3 L19.4 4.2 Z', fill: ARROW, transform: 'rotate(-12 20 20)' }, s);
  penguin(sv('g', { transform: 'translate(20 21) scale(1.9)' }, s), 'var(--ppg-me)', ICE);
  return s;
}

// ---- The piece -----------------------------------------------------------------

export function mount(el) {
  const release = useCss(CSS_ID, CSS);
  const ac = new AbortController();
  const on = (t, ev, fn, o) => t.addEventListener(ev, fn, Object.assign({ signal: ac.signal }, o));
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const root = h('div', 'ppg');
  let david = undefined; // undefined while loading, null if not set yet
  let state = 'card';
  let raf = 0;
  let board = null;
  let ctl = null; // { move(d), tick(now) } for the view with a board
  let held = -1, holdT = 0;

  const note = el.querySelector('.piece-note');
  if (note) note.remove();
  el.appendChild(root);

  fetch('/hobbies/lumosity/best.json', { signal: ac.signal, cache: 'no-cache' })
    .then((r) => r.json())
    .then((j) => { david = j && typeof j.penguin === 'number' ? j.penguin : null; if (state === 'card') showCard(); })
    .catch(() => { if (!ac.signal.aborted) { david = null; if (state === 'card') showCard(); } });


  function loop(now) {
    raf = requestAnimationFrame(loop);
    if (ctl && ctl.tick) ctl.tick(now);
    if (board) board.frame(now);
  }
  function view(node, withBoard) {
    stopHold();
    timers.forEach(clearTimeout);
    timers.clear();
    root.textContent = '';
    root.appendChild(node);
    if (withBoard && !raf) raf = requestAnimationFrame(loop);
    if (!withBoard) { cancelAnimationFrame(raf); raf = 0; board = null; ctl = null; }
  }

  // The stage: board, a flag over it, swipes on it, the pad and key hint under it.
  function stage(parent) {
    board = makeBoard();
    const st = h('div', 'ppg-stage');
    const flag = h('div', 'ppg-flag');
    st.append(board.wrap, flag);
    parent.appendChild(st);
    let sx = 0, sy = 0, sid = -1;
    on(st, 'pointerdown', (e) => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; });
    on(st, 'pointerup', (e) => {
      if (e.pointerId !== sid) return;
      sid = -1;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 22) return;
      press(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
      stopHold();
    });
    const line = h('p', 'ppg-line');
    const pad = padEl();
    on(pad, 'pointerdown', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.preventDefault();
      press(Number(b.dataset.dir));
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => on(pad, ev, stopHold));
    on(pad, 'contextmenu', (e) => e.preventDefault());
    parent.append(line, pad, h('p', 'ppg-keys', 'Arrow keys or WASD'));
    return {
      line,
      flag(text, ms) {
        flag.textContent = text;
        flag.classList.toggle('on', !!text);
        if (text && ms) later(() => flag.classList.remove('on'), ms);
      }
    };
  }

  // One press is one step; holding repeats at a walking pace.
  function press(d) {
    stopHold();
    if (!ctl) return;
    ctl.move(d);
    held = d;
    holdT = setTimeout(function rep() { if (ctl && held >= 0) { ctl.move(held); holdT = setTimeout(rep, 150); } }, 260);
  }
  function stopHold() { clearTimeout(holdT); held = -1; }

  const KEYS = { arrowup: 0, w: 0, arrowright: 1, d: 1, arrowdown: 2, s: 2, arrowleft: 3, a: 3 };
  on(window, 'keydown', (e) => {
    if (state !== 'play' && state !== 'tut') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const d = KEYS[e.key.toLowerCase()];
    if (d === undefined) return;
    e.preventDefault();
    if (!e.repeat) press(d);
  });
  on(window, 'keyup', (e) => { if (KEYS[e.key.toLowerCase()] === held) stopHold(); });
  on(window, 'blur', stopHold);

  // ---- Card ----
  function panel(what, rows, buttons) {
    const box = h('div', 'ppg-panel');
    const top = h('div', 'ppg-top');
    const t = h('div');
    t.append(h('p', 'ppg-name', 'Penguin Rally'), h('p', 'ppg-what', what));
    top.append(t, icon());
    const lines = h('div', 'ppg-lines');
    const row = h('div', 'ppg-row');
    for (const r of rows) lines.appendChild(r);
    for (const [cls, text, fn] of buttons) {
      const b = h('button', cls, text);
      b.type = 'button';
      on(b, 'click', fn);
      row.appendChild(b);
    }
    box.append(top, lines, row);
    return box;
  }
  function line(label, value, cls) {
    const p = h('p', cls);
    if (value == null) p.textContent = label;
    else p.append(label + ': ', h('b', '', value));
    return p;
  }
  const davidLine = () => typeof david === 'number' ? line("David's best", String(david)) : line(david === null ? "David hasn't set a score yet" : "David's best: ...");

  function showCard() {
    state = 'card';
    const mine = readBest();
    const buttons = [['ppg-btn', 'Play', () => (tutDone() ? startSession() : showTut(0))]];
    if (tutDone()) buttons.push(['ppg-link', 'How to play', () => showTut(0)]);
    const raced = PLAN.some((p) => ghostFor(p));
    const rows = [davidLine(), line('Your best', mine ? String(mine) : 'not set yet')];
    if (recording) rows.push(line('Recording mode: your races become the ghost.', null, 'say'));
    const box = panel('Trains spatial orientation: the board turns, and Up always means toward the orange arrow. '
      + (raced ? 'Two time trials, then three races against my penguin, replaying how I actually played them.' : 'Two time trials, then three races.'),
      rows, buttons);
    // The Lumosity page lays the three cards out in a row (styles.css .lumo-games).
    box.dataset.lumoCard = '';
    view(box, false);
  }

  // ---- Tutorial ----
  // 1: walk a 3x3 board to the fish. 2: the board turns; press Up and see it go
  // toward the arrow. 3: turned again, a real little maze.
  function showTut(step) {
    state = 'tut';
    const box = h('div', 'ppg-tut');
    const head = h('div', 'ppg-head');
    const say = h('p');
    const skip = h('button', 'ppg-link', 'Skip');
    skip.type = 'button';
    on(skip, 'click', () => { store(KEY_TUT, 1); startSession(); });
    head.append(say, skip);
    box.appendChild(head);
    view(box, true);
    const ui = stage(box);
    const move = touchy() ? 'Use the pad or swipe on the board' : 'Arrow keys or WASD';
    const steps = [
      { m: openMaze(3, [[6, 0], [3, 1]]), start: 6, rot: 0, text: `${move} to step one square. Walls block. Get the fish.` },
      { m: openMaze(3, []), start: 7, rot: 90, text: 'The board turned. Up always walks toward the orange arrow, not up the screen. Press Up.' },
      { m: genMaze(3), start: 8, rot: 180, text: 'In the real mazes it keeps turning. Get the fish once more.' }
    ];
    const s = steps[step];
    say.append(h('span', 't3', `${step + 1} of 3  `), document.createTextNode(s.text));
    board.setMaze(s.m);
    board.turn(step ? steps[step - 1].rot : 0, true);
    board.frame(performance.now());
    if (s.rot) later(() => board.turn(s.rot), 350);
    board.add('fish', 4);
    const me = board.add(['var(--ppg-me)', ICE], s.start);
    let cell = s.start, done = false;
    ctl = {
      move(d) {
        if (done) return;
        if (!(s.m.open[cell] >> d & 1)) { board.bump(me, d); return; }
        cell = stepOf(s.m, cell, d);
        board.put(me, cell);
        if (step === 1 && d !== 0) ui.line.textContent = 'Up is toward the orange arrow. Try it.';
        if (cell !== 4) return;
        done = true;
        ui.flag(step < 2 ? 'Nice' : 'Ready', 0);
        later(() => {
          if (step < 2) showTut(step + 1);
          else { store(KEY_TUT, 1); startSession(); }
        }, 800);
      }
    };
  }

  // ---- Play ----
  // Recording mode (#record-penguin): races run solo and my steps are kept,
  // to download at the end as penguin-david.json.
  const recording = /record-penguin/.test(location.hash);
  let ghosts = {}; // seed -> { start, time, steps: [[ms, cell], ...] }
  fetch(GHOST_URL, { signal: ac.signal, cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : {}))
    .then((j) => { ghosts = (j && j.races) || {}; if (state === 'card') showCard(); })
    .catch(() => {});
  const ghostFor = (cfg) => {
    const g = !recording && cfg.seed && ghosts[cfg.seed];
    return g && Array.isArray(g.steps) && g.steps.length && g.n === cfg.n ? g : null;
  };

  let G = null;
  function startSession() {
    state = 'play';
    const box = h('div', 'ppg-game');
    if (recording) box.appendChild(h('p', 'ppg-rec', 'Recording: your races will be saved as the ghost.'));
    const hud = h('div', 'ppg-hud');
    const hMaze = h('span'), hScore = h('span'), hTime = h('span');
    hud.append(hMaze, hScore, hTime);
    const clock = h('div', 'ppg-clock off');
    clock.appendChild(h('i'));
    box.append(hud, clock);
    view(box, true);
    const ui = stage(box);
    const g = G = { i: -1, total: 0, wins: 0, ui, hMaze, hScore, hTime, clock, shownT: '', rec: {} };
    G.hScore.innerHTML = 'Score <span>0</span>';
    if (root.getBoundingClientRect().top < 0 || root.getBoundingClientRect().bottom > innerHeight) {
      root.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    }
    // 3, 2, 1, go, then the first maze.
    countdown(box).then((ok) => {
      if (!ok || G !== g || state !== 'play') return;
      ctl = { move: playerMove, tick };
      nextMaze();
    });
  }

  function nextMaze() {
    G.i++;
    if (G.i >= PLAN.length) return showResults();
    const cfg = PLAN[G.i];
    const race = cfg.kind === 'race';
    // A race draws everything from its seed: maze, start corner, every turn.
    const rnd = race ? seeded(cfg.seed) : Math.random;
    const n = cfg.n;
    const m = genMaze(n, rnd);
    const fishAt = (n >> 1) * n + (n >> 1);
    const corners = [0, n - 1, n * (n - 1), n * n - 1];
    const start = corners[(rnd() * 4) | 0];
    const dist = distances(m, fishAt);
    const ghost = race ? ghostFor(cfg) : null;
    Object.assign(G, { cfg, race, rnd, m, fishAt, dist, ghost, phase: 'ready', cell: start, start, dStart: dist[start], t0: 0, hiddenAt: 0, steps: [], gi: 0 });
    board.setMaze(m);
    board.add('fish', fishAt);
    G.rivals = [];
    if (race && ghost) {
      // My penguin, walking the race the way I did, from the same corner.
      G.ghostSp = board.add(['#5e81ac', '#ebcb8b', 'David', 0.8], start, 0.92);
      G.ghostCell = start;
    } else if (race && !recording) {
      const other = corners.filter((c) => c !== start)[(rnd() * 3) | 0];
      G.rivals.push({ cell: other, prev: -1, stray: 0, due: 0, sp: board.add(['#8f9bb3', null], other, 0.9), every: cfg.base * G.dStart / Math.max(1, dist[other]) });
    }
    G.me = board.add(['var(--ppg-me)', ICE, race && (ghost || G.rivals.length) ? 'You' : '', 0], start);
    G.par = 3 + G.dStart * 0.55;
    if (cfg.turned || race) turnTo(board, true, rnd);
    G.hMaze.innerHTML = `${race ? 'Race' : 'Time trial'} <span>${race ? PLAN.slice(0, G.i + 1).filter((p) => p.kind === 'race').length : G.i + 1}</span> of ${race ? RACES : PLAN.length - RACES}`;
    G.hTime.innerHTML = '<span>0.0</span>s';
    G.clock.classList.toggle('off', race);
    G.clock.classList.remove('late');
    G.clock.firstChild.style.transform = 'scaleX(1)';
    const kind = race ? (ghost ? 'Race against David' : recording ? 'Race (recording)' : 'Race') : 'Time trial';
    G.ui.flag(kind, 0);
    G.ui.line.textContent = race
      ? (ghost ? 'Same maze I raced. Beat my penguin to the fish.' : recording ? 'Recording this one. Go fast.' : 'Beat the other penguin to the fish.')
      : (cfg.turned ? 'The board is turned. Up is still toward the orange arrow.' : 'Get to the fish before the bar runs out for a bonus.');
    later(() => {
      G.phase = 'go';
      G.t0 = performance.now();
      G.spinDue = G.t0 + (cfg.spin || 0);
      for (const rv of G.rivals) rv.due = G.t0 + rv.every;
      G.ui.flag('Go', 500);
    }, reduced() ? 900 : 1300);
  }

  function playerMove(d) {
    if (G.phase !== 'go') return;
    if (!(G.m.open[G.cell] >> d & 1)) { board.bump(G.me, d); return; }
    G.cell = stepOf(G.m, G.cell, d);
    board.put(G.me, G.cell);
    if (G.race) G.steps.push([Math.round(performance.now() - G.t0), G.cell]);
    if (G.cell === G.fishAt) finish('win');
  }

  // Rivals walk downhill on the distance map; early on they sometimes stray
  // a step or two into a wrong branch, then walk back.
  function rivalStep(rv) {
    const c = rv.cell, d = G.dist, nb = exits(G.m, c);
    let next = -1;
    if (rv.stray > 0) {
      const away = nb.filter((x) => d[x] > d[c] && x !== rv.prev);
      if (away.length) { next = pick(away); rv.stray--; } else rv.stray = 0;
    } else if (nb.length >= 3 && d[c] > 2 && Math.random() < G.cfg.err) {
      next = pick(nb.filter((x) => d[x] > d[c]));
      rv.stray = (Math.random() * 2) | 0;
    }
    if (next < 0) next = nb.find((x) => d[x] === d[c] - 1);
    rv.prev = c;
    rv.cell = next;
    board.put(rv.sp, next);
    if (next === G.fishAt) finish('lost');
  }

  function tick(now) {
    if (!G || G.phase !== 'go') return;
    const ms = now - G.t0;
    const t = ms / 1000;
    const shown = t.toFixed(1);
    if (shown !== G.shownT) { G.shownT = shown; G.hTime.firstChild.textContent = shown; }
    if (!G.race) {
      const left = Math.max(0, 1 - t / G.par);
      G.clock.firstChild.style.transform = `scaleX(${left})`;
      G.clock.classList.toggle('late', left <= 0);
    }
    // My recorded steps, at the times I took them.
    if (G.ghost) {
      const st = G.ghost.steps;
      while (G.gi < st.length && st[G.gi][0] <= ms) {
        G.ghostCell = st[G.gi][1];
        board.put(G.ghostSp, G.ghostCell);
        G.gi++;
        if (G.ghostCell === G.fishAt) { finish('lost'); return; }
      }
    }
    for (const rv of G.rivals) {
      while (G.phase === 'go' && now >= rv.due) { rivalStep(rv); rv.due += rv.every; }
    }
    if (G.phase !== 'go') return;
    if (G.cfg.spin && now >= G.spinDue) { turnTo(board, false, G.rnd); G.spinDue += G.cfg.spin; }
  }

  function finish(how) {
    const t = (performance.now() - G.t0) / 1000;
    const cfg = G.cfg;
    const base = 30 * cfg.n;
    G.phase = 'done';
    stopHold();
    let pts, line;
    if (how === 'win') {
      if (G.race) {
        const theirs = G.ghost ? G.ghost.time : null;
        const ahead = theirs != null ? Math.max(0, theirs - t) : 0;
        pts = base + 150 + Math.round(ahead * 20);
        if (G.ghost || G.rivals.length) G.wins++;
        line = G.ghost ? `You beat David by ${ahead.toFixed(1)}s.` : G.rivals.length ? `You beat the other penguin in ${t.toFixed(1)}s.` : `Fish in ${t.toFixed(1)}s.`;
        if (recording) G.rec[cfg.seed] = { n: cfg.n, start: G.start, time: Math.round(t * 100) / 100, steps: G.steps };
      } else {
        const spare = Math.max(0, G.par - t);
        pts = base + Math.round(spare * 25);
        line = spare > 0 ? `Fish in ${t.toFixed(1)}s, ${spare.toFixed(1)}s under par.` : `Fish in ${t.toFixed(1)}s.`;
      }
    } else {
      const got = Math.max(0, 1 - G.dist[G.cell] / G.dStart);
      pts = Math.round(base * (0.15 + 0.35 * got));
      line = G.ghost ? `David got there first, in ${G.ghost.time.toFixed(1)}s.` : 'The other penguin got there first.';
    }
    G.total += pts;
    G.hScore.innerHTML = `Score <span>${G.total}</span>`;
    G.ui.line.textContent = `${line} +${pts}`;
    G.ui.flag(how === 'win' ? `+${pts}` : 'So close', 0);
    later(nextMaze, 2400);
  }

  // Tab hidden mid-maze: the clock, the rivals and my recording wait.
  on(document, 'visibilitychange', () => {
    if (!G || state !== 'play' || G.phase !== 'go') return;
    const now = performance.now();
    if (document.hidden) { G.hiddenAt = now; return; }
    if (!G.hiddenAt) return;
    const gap = now - G.hiddenAt;
    G.hiddenAt = 0;
    G.t0 += gap;
    G.spinDue += gap;
    for (const rv of G.rivals) rv.due += gap;
  });

  // ---- Results ----
  function showResults() {
    state = 'result';
    const score = G.total;
    const prev = readBest();
    const best = Math.max(prev, score);
    if (score > prev && !recording) store(KEY_BEST, score);
    const vsDavid = PLAN.some((p) => ghostFor(p));
    const rows = [line('Score', String(score))];
    if (!recording) rows.push(line(vsDavid ? 'Races against David' : 'Races won', vsDavid ? `won ${G.wins} of ${RACES}` : `${G.wins} of ${RACES}`));
    rows.push(line('Your best', String(best)), davidLine());
    if (typeof david === 'number' && score > david) rows.push(line('You beat David.', null, 'say'));
    else if (score > prev && prev) rows.push(line('New personal best.', null, 'say'));
    const buttons = [['ppg-btn', 'Play again', startSession]];
    if (recording) {
      const n = Object.keys(G.rec).length;
      rows.push(line(`Recorded ${n} of ${RACES} races.`, null, 'say'));
      const rec = G.rec;
      buttons.push(['ppg-link', 'Download recording', () => {
        const merged = { _how: 'My penguin in each race, by seed: start corner, finish time (s) and every step as [ms since go, cell]. Made with #record-penguin.', races: Object.assign({}, ghosts, rec) };
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([JSON.stringify(merged)], { type: 'application/json' }));
        a.download = 'penguin-david.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }]);
    }
    const box = panel(`${PLAN.length - RACES} time trials and ${RACES} races done.`, rows, buttons);
    view(box, false);
    G = null;
    window.dispatchEvent(new CustomEvent('dl:lumo', { detail: { game: 'penguin', score, best, david: typeof david === 'number' ? david : null } }));
  }

  showCard();

  return function stop() {
    ac.abort();
    stopHold();
    timers.forEach(clearTimeout);
    timers.clear();
    cancelAnimationFrame(raf);
    raf = 0;
    ctl = null;
    G = null;
    root.remove();
    release();
  };
}
