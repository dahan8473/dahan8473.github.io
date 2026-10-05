// Pinball Recall: a working-memory game for the Lumosity page. A grid of
// diagonal bumpers shows for a few seconds, then hides, and only then does the
// arrow show where the ball rolls in. It turns 90 degrees at every bumper; call
// the edge it comes out of. 12 boards. Two right in a row moves you up a level,
// a miss drops you one, and every level is a bigger grid with more bumpers.
// From level 3 some bumpers carry a ring: they flip after the ball hits them.
//   <div class="play" data-play="pinball" data-v="N">
// David's best comes from /hobbies/lumosity/best.json (key pinball). The
// visitor's best lives in localStorage, and a finished run fires dl:lumo on window.

import { countdown } from './countdown.js';

const CSS_ID = 'play-pinball-css';
const KEY = 'dl-lumo-pinball';
const TUT_KEY = 'dl-lumo-pinball-tut';
const BOARDS = 12;
const MAX_LEVEL = 10;
const DR = [-1, 0, 1, 0]; // up, right, down, left
const DC = [0, 1, 0, -1];
const SIDES = ['top', 'right', 'bottom', 'left'];
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 7l5 5-5 5"/></svg>';
const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
// Card art: a tiny board with a ball's route through two bumpers.
const ART = '<svg viewBox="0 0 64 64" aria-hidden="true">'
  + [0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => `<rect x="${c * 16 + 1}" y="${r * 16 + 1}" width="14" height="14" rx="3"/>`).join('')).join('')
  + '<path class="p" d="M0 40h24V8h40"/><path class="m" d="M19 45l10-10M19 13l10-10M51 51l10 10"/><circle cx="44" cy="8" r="3.4"/></svg>';

const CSS = `
.ppb { max-width: 640px; scroll-margin-top: 24px; }
.ppb .ppb-board[style*="--n: 1"], .ppb .ppb-board[style*="--n: 9"] { --g: 3px; }
.ppb-panel { padding: 22px; border-radius: 14px; background: var(--fill); }
.ppb-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.ppb-name { color: var(--t1); font-weight: 500; }
.ppb-what { color: var(--t2); }
.ppb-art { flex: none; width: 56px; height: 56px; }
.ppb-art rect { fill: var(--rule); }
.ppb-art .m { fill: none; stroke: var(--t1); stroke-width: 2.4; stroke-linecap: round; }
.ppb-art .p { fill: none; stroke: #88c0d0; stroke-width: 2; stroke-linejoin: round; opacity: 0.8; }
.ppb-art circle { fill: #88c0d0; }
.ppb-lines { margin: 16px 0 20px; color: var(--t2); }
.ppb-lines b { font-weight: 400; color: var(--t1); }
.ppb-lines .say { margin-top: 8px; color: var(--t1); }
.ppb-btns { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
.ppb-go { min-height: 40px; padding: 8px 22px; border: 0; border-radius: 999px; background: var(--t1); color: var(--bg); font: inherit; cursor: pointer; transition: opacity 160ms ease; }
.ppb-go:hover { opacity: 0.86; }
.ppb-link { min-height: 40px; padding: 4px 0; border: 0; background: none; color: var(--t2); font: inherit; cursor: pointer; }
.ppb-link:hover { color: var(--t1); }
.ppb :is(.ppb-go, .ppb-link, .ppb-x):focus-visible { border-radius: 999px; }
.ppb-top { display: flex; align-items: center; gap: 4px 18px; min-height: 40px; margin-bottom: 10px; color: var(--t3); }
.ppb-top b { font-weight: 400; color: var(--t1); }
.ppb-top .end { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.ppb-x { display: grid; place-items: center; width: 40px; height: 40px; margin-right: -8px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--t3); cursor: pointer; }
.ppb-x:hover { color: var(--t1); background: var(--fill); }
.ppb-x svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
.ppb-say { margin-bottom: 14px; color: var(--t1); }
.ppb-timer { height: 2px; margin: 0 0 14px; border-radius: 2px; background: var(--rule); overflow: hidden; }
.ppb-timer i { display: block; height: 100%; background: #88c0d0; transform-origin: left; }
.ppb-timer.off { visibility: hidden; }
.ppb-msg { min-height: 1.6em; margin-top: 14px; color: var(--t2); text-align: center; }
.ppb-msg b { font-weight: 400; color: var(--t1); }

.ppb-board {
  --e: 40px; --g: 4px;
  display: grid; gap: var(--g); width: 100%; max-width: clamp(440px, calc(150px + var(--n) * 36px), 560px); aspect-ratio: 1; margin: 0 auto;
  grid-template-columns: var(--e) repeat(var(--n), minmax(0, 1fr)) var(--e);
  grid-template-rows: var(--e) repeat(var(--n), minmax(0, 1fr)) var(--e);
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; touch-action: manipulation;
}
.ppb-board.small { max-width: 300px; }
.ppb-cell { position: relative; border-radius: 8px; background: var(--fill); }
.ppb-panel .ppb-cell { background: var(--rule); }
.ppb-bump { position: absolute; inset: 0; display: grid; place-items: center; border-radius: 8px; transition: opacity 220ms ease; }
.ppb-bump.flip { box-shadow: inset 0 0 0 2px #88c0d0; }
.ppb-bump svg { width: 66%; height: 66%; overflow: visible; transition: transform 240ms cubic-bezier(.3, .7, .2, 1); }
.ppb-bump line { stroke: var(--t1); stroke-width: 3px; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.ppb-board.hide .ppb-bump:not(.seen) { opacity: 0; }
.ppb-slot { position: relative; display: grid; place-items: center; padding: 0; border: 0; border-radius: 10px; background: none; color: var(--t3); font: inherit; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.ppb-slot::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; transition: transform 140ms ease, background 140ms ease; }
.ppb-slot::after { content: ''; position: absolute; inset: calc(var(--g) / -2); }
.ppb-slot[data-side="0"]::after { top: -10px; }
.ppb-slot[data-side="1"]::after { right: -10px; }
.ppb-slot[data-side="2"]::after { bottom: -10px; }
.ppb-slot[data-side="3"]::after { left: -10px; }
.ppb-slot:disabled { cursor: default; }
.ppb-board.live .ppb-slot:not(:disabled) { color: var(--t2); }
@media (hover: hover) { .ppb-board.live .ppb-slot:not(:disabled):hover { background: var(--fill); color: #88c0d0; } }
.ppb-board.live .ppb-slot:not(:disabled):hover::before, .ppb-slot:focus-visible::before { transform: scale(1.8); }
.ppb-slot:focus-visible { outline: 2px solid #88c0d0; outline-offset: -2px; border-radius: 10px; }
.ppb-slot.start { color: var(--t1); }
.ppb-slot.start::before { display: none; }
.ppb-slot.start svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; transition: opacity 160ms ease; }
.ppb-board.study .ppb-slot.start svg { opacity: 0; }
.ppb-board:not(.study) .ppb-slot.start svg { animation: ppb-pop 360ms cubic-bezier(.3, 1.6, .5, 1); }
@keyframes ppb-pop { from { opacity: 0; scale: 0.4; } }
.ppb-slot.pick::before { transform: scale(2.2); background: none; box-shadow: inset 0 0 0 1.5px currentColor; }
.ppb-slot.pick { color: var(--t1); }
.ppb-slot.miss { color: #d08770; }
.ppb-slot.exit { color: #88c0d0; }
.ppb-slot.exit::before { transform: scale(2.2); background: currentColor; box-shadow: none; }
.ppb-board.won .ppb-slot.exit::before { animation: ppb-ring 700ms ease-out; }
@keyframes ppb-ring { 0% { box-shadow: 0 0 0 0 rgba(136, 192, 208, 0.7); } 100% { box-shadow: 0 0 0 14px rgba(136, 192, 208, 0); } }
.ppb-board.won .ppb-cell { animation: ppb-glow 600ms ease; }
@keyframes ppb-glow { 35% { background: color-mix(in srgb, #88c0d0 22%, var(--fill)); } }
.ppb-board.lost { animation: ppb-shake 300ms ease; }
@keyframes ppb-shake { 20% { transform: translateX(-7px); } 45% { transform: translateX(6px); } 70% { transform: translateX(-3px); } 90% { transform: translateX(1px); } }
.ppb-pts { position: absolute; left: 50%; top: 50%; color: var(--t1); font-weight: 500; white-space: nowrap; pointer-events: none; animation: ppb-pts 1000ms ease-out forwards; }
@keyframes ppb-pts { 0% { opacity: 0; transform: translate(-50%, -50%) scale(0.6); } 25% { opacity: 1; transform: translate(-50%, -120%) scale(1.1); } 100% { opacity: 0; transform: translate(-50%, -260%) scale(1); } }
.ppb.rm .ppb-board, .ppb.rm .ppb-cell, .ppb.rm .ppb-pts, .ppb.rm .ppb-slot.exit::before { animation: none !important; }
.ppb-layer { position: relative; margin: calc(var(--g) / -2); pointer-events: none; }
.ppb-trail { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.ppb-trail polyline { fill: none; stroke: #88c0d0; stroke-width: 2.5px; stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; opacity: 0.6; }
.ppb-ball { position: absolute; width: calc(100% / var(--n) * 0.32); aspect-ratio: 1; border-radius: 50%; background: #88c0d0; transform: translate(-50%, -50%); opacity: 0; transition: left var(--step, 130ms) linear, top var(--step, 130ms) linear, opacity 160ms ease; }
.ppb-ball.on { opacity: 1; }
.ppb.rm .ppb-ball, .ppb.rm .ppb-bump svg { transition: none; }
.ppb.rm .ppb-slot.start svg { animation: none; }
@media (max-width: 720px) { .ppb { scroll-margin-top: 72px; } }
@media (max-width: 560px) {
  .ppb-panel { padding: 18px; }
  .ppb-board { --e: 28px; --g: 3px; }
  .ppb-cell, .ppb-bump { border-radius: 6px; }
}
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
  let done = false;
  return function release() {
    if (done) return;
    done = true;
    const t = document.getElementById(id);
    if (!t) return;
    const n = Number(t.dataset.users || 1) - 1;
    if (n <= 0) t.remove();
    else t.dataset.users = String(n);
  };
}

function h(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}
const fmt = (n) => Number(n).toLocaleString('en-US');
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

// ---- Rules -------------------------------------------------------------------
// A board is { n, cells: [null | { t: '/' | '\\', f }], start: { side, i } }.
// Sides run 0 top, 1 right, 2 bottom, 3 left; i counts left to right / top to bottom.
// '/' swaps up<->right and down<->left (d ^ 1); '\' swaps up<->left and right<->down (3 - d).
function entry(n, s) {
  if (s.side === 0) return { r: -1, c: s.i, d: 2 };
  if (s.side === 1) return { r: s.i, c: n, d: 3 };
  if (s.side === 2) return { r: n, c: s.i, d: 0 };
  return { r: s.i, c: -1, d: 1 };
}
function slotAt(n, r, c) {
  if (r < 0) return { side: 0, i: c };
  if (c >= n) return { side: 1, i: r };
  if (r >= n) return { side: 2, i: c };
  return { side: 3, i: r };
}

// Rolls the ball. Steps are every cell it reaches, ending outside the grid.
// Returns null if it runs too long (a flip can trap it in a loop).
function trace(board) {
  const { n } = board;
  const t = board.cells.map((m) => m && m.t);
  let { r, c, d } = entry(n, board.start);
  const steps = [];
  const seen = {};
  let hits = 0, flipHits = 0, flipBack = false;
  for (;;) {
    r += DR[d]; c += DC[d];
    if (r < 0 || c < 0 || r >= n || c >= n) break;
    const k = r * n + c, m = board.cells[k];
    const step = { r, c, k };
    if (m) {
      d = t[k] === '/' ? d ^ 1 : 3 - d;
      step.hit = true;
      hits++;
      if (m.f) {
        t[k] = t[k] === '/' ? '\\' : '/';
        step.flip = true;
        flipHits++;
        if (seen[k]) flipBack = true;
      }
      seen[k] = true;
    }
    steps.push(step);
    if (steps.length > n * 6) return null;
  }
  steps.push({ r, c });
  return { steps, exit: slotAt(n, r, c), hits, flipHits, flipBack };
}

// Level 1 is 4x4 and every level adds a row and a column, up to 12x12.
const sizeFor = (level) => Math.min(12, 3 + level);
const studyFor = (level) => (level === 1 ? 0 : Math.max(2400, 4500 - 200 * (level - 2)));

// Random boards until one is worth playing: enough bounces, a flip that gets
// hit once flips exist, and from level 5 one the ball comes back to.
function generate(level) {
  const n = sizeFor(level);
  const count = Math.min(Math.round(n * n * 0.4), 3 + 2 * level);
  const flips = level < 3 ? 0 : Math.min(4, 1 + Math.floor((level - 3) / 2));
  const need = Math.min(1 + level, 7);
  const rnd = (k) => Math.floor(Math.random() * k);
  let spare = null;
  for (let tries = 0; tries < 800; tries++) {
    const cells = new Array(n * n).fill(null);
    const free = [...cells.keys()];
    for (let j = 0; j < count; j++) {
      const k = free.splice(rnd(free.length), 1)[0];
      cells[k] = { t: rnd(2) ? '/' : '\\', f: j < flips };
    }
    const board = { n, cells, start: { side: rnd(4), i: rnd(n) } };
    const t = trace(board);
    if (!t || (t.exit.side === board.start.side && t.exit.i === board.start.i)) continue;
    if (!spare && t.hits) spare = board;
    if (t.hits < need || (flips && !t.flipHits)) continue;
    if (level >= 5 && tries < 400 && !t.flipBack) continue;
    return board;
  }
  return spare;
}

// The three tutorial boards, hand-made on 3x3.
const TUT = [
  { say: 'The ball rolls in at the arrow and goes straight. A bumper turns it 90 degrees. Tap the edge where it comes out.',
    board: { n: 3, cells: [null, null, null, null, { t: '/' }, null, null, null, null], start: { side: 3, i: 1 } }, study: 0 },
  { say: 'In the game the bumpers hide after a few seconds, and only then does the arrow show where the ball starts. Remember them, then tap where it comes out.',
    board: { n: 3, cells: [null, null, null, { t: '/' }, null, { t: '\\' }, null, null, null], start: { side: 2, i: 0 } }, study: 3000 },
  { say: 'A bumper with a ring flips after the ball hits it. If the ball comes back to it, it bounces the other way.',
    board: { n: 3, cells: [null, { t: '/' }, null, null, null, null, null, { t: '/', f: true }, null], start: { side: 3, i: 2 } }, study: 0 }
];

// ---- Mount -------------------------------------------------------------------
export function mount(el) {
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const timers = new Set();
  const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers.clear(); };
  const release = useCss(CSS_ID, CSS);
  const root = h('div', 'ppb');
  let david = null;
  let game = null; // live session, or null outside play

  const best = () => { const v = parseInt(load(KEY), 10); return Number.isFinite(v) ? v : 0; };
  const hadFocus = () => root.contains(document.activeElement);
  function show(node, focusSel) {
    const keep = hadFocus();
    clearTimers();
    game = null;
    root.classList.toggle('rm', reduce.matches);
    root.replaceChildren(node);
    if (keep && focusSel) { const f = node.querySelector(focusSel); if (f) f.focus(); }
  }

  // One board on screen: cells, edge slots, the ball and its trail.
  function makeBoard(board, small) {
    const { n } = board;
    const wrap = h('div', 'ppb-board hide' + (small ? ' small' : ''));
    wrap.style.setProperty('--n', n);
    const slots = [], bumps = [];
    const st = board.start;
    for (let r = -1; r <= n; r++) {
      for (let c = -1; c <= n; c++) {
        const edge = r < 0 || c < 0 || r >= n || c >= n;
        const corner = (r < 0 || r >= n) && (c < 0 || c >= n);
        let node;
        if (corner) node = h('span');
        else if (edge) {
          const s = slotAt(n, r, c);
          node = h('button', 'ppb-slot');
          node.type = 'button';
          node.disabled = true;
          node.dataset.side = s.side;
          node.dataset.i = s.i;
          node.setAttribute('aria-label', SIDES[s.side] + ' edge, ' + (s.side % 2 ? 'row ' : 'column ') + (s.i + 1));
          if (s.side === st.side && s.i === st.i) {
            node.classList.add('start');
            node.innerHTML = ARROW;
            node.firstChild.style.transform = 'rotate(' + (entry(n, st).d * 90 - 90) + 'deg)';
            node.setAttribute('aria-label', 'Ball starts here, ' + node.getAttribute('aria-label'));
          } else slots.push({ el: node, side: s.side, i: s.i, r, c });
        } else {
          node = h('div', 'ppb-cell');
          const m = board.cells[r * n + c];
          if (m) {
            const b = h('div', 'ppb-bump' + (m.f ? ' flip' : ''), '<svg viewBox="0 0 10 10" aria-hidden="true"><line x1="1" y1="9" x2="9" y2="1"/></svg>');
            b.rot = m.t === '/' ? 0 : 90;
            b.firstChild.style.transform = 'rotate(' + b.rot + 'deg)';
            node.appendChild(b);
            bumps[r * n + c] = b;
          }
        }
        node.style.gridArea = (r + 2) + ' / ' + (c + 2);
        wrap.appendChild(node);
      }
    }
    const layer = h('div', 'ppb-layer', '<svg class="ppb-trail" preserveAspectRatio="none" aria-hidden="true"><polyline points=""/></svg><i class="ppb-ball"></i>');
    layer.style.gridArea = '2 / 2 / ' + (n + 2) + ' / ' + (n + 2);
    layer.firstChild.setAttribute('viewBox', '0 0 ' + n + ' ' + n);
    wrap.appendChild(layer);
    const line = layer.querySelector('polyline'), ball = layer.querySelector('.ppb-ball');
    const at = (v) => (v < 0 ? 'calc(var(--e) / -2 - var(--g) / 2)' : v >= n ? 'calc(100% + var(--e) / 2 + var(--g) / 2)' : ((v + 0.5) / n * 100) + '%');
    const pt = (r, c) => Math.min(n, Math.max(0, c + 0.5)) + ',' + Math.min(n, Math.max(0, r + 0.5));
    const put = (r, c) => { ball.style.left = at(c); ball.style.top = at(r); };
    let onPick = null;

    slots.forEach((s) => s.el.addEventListener('click', () => { if (onPick) onPick(s); }, sig));
    return {
      el: wrap, slots,
      hide(v) { wrap.classList.toggle('hide', v); },
      // While the bumpers are up the start arrow is hidden; it pops in when they go.
      study(v) { wrap.classList.toggle('study', v); },
      arm(fn) { onPick = fn; wrap.classList.add('live'); slots.forEach((s) => { s.el.disabled = false; }); },
      disarm() { onPick = null; wrap.classList.remove('live'); slots.forEach((s) => { s.el.disabled = true; }); },
      slot(side, i) { return slots.find((s) => s.side === side && s.i === i); },
      // Animates the path, revealing bumpers as the ball hits them.
      run(path, done) {
        const step = Math.max(90, 150 - n * 8);
        wrap.style.setProperty('--step', step + 'ms');
        const e = entry(n, st);
        const pts = [pt(e.r, e.c)];
        const hit = (s) => {
          if (!s.hit) return;
          const b = bumps[s.k];
          b.classList.add('seen');
          if (s.flip) { b.rot += 90; b.firstChild.style.transform = 'rotate(' + b.rot + 'deg)'; }
        };
        if (reduce.matches) {
          path.steps.forEach((s) => { hit(s); pts.push(pt(s.r, s.c)); });
          line.setAttribute('points', pts.join(' '));
          const last = path.steps[path.steps.length - 1];
          put(last.r, last.c);
          ball.classList.add('on');
          wrap.classList.remove('hide');
          later(done, 500);
          return;
        }
        ball.style.transition = 'none';
        put(e.r, e.c);
        void ball.offsetWidth;
        ball.style.transition = '';
        ball.classList.add('on');
        let k = 0;
        const next = () => {
          if (k >= path.steps.length) { wrap.classList.remove('hide'); later(done, 260); return; }
          const s = path.steps[k++];
          put(s.r, s.c);
          later(() => { hit(s); pts.push(pt(s.r, s.c)); line.setAttribute('points', pts.join(' ')); next(); }, step);
        };
        later(next, 180);
      }
    };
  }

  // Arrow keys walk the edge slots: the nearest one in that direction.
  function walk(bd, key) {
    const v = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[key];
    const cur = bd.slots.find((s) => s.el === document.activeElement);
    if (!cur) { bd.slots[0].el.focus(); return; }
    let pick = null, bestScore = Infinity;
    for (const s of bd.slots) {
      const dr = s.r - cur.r, dc = s.c - cur.c;
      const along = dr * v[0] + dc * v[1], off = Math.abs(dr * v[1] - dc * v[0]);
      if (along <= 0) continue;
      const score = along + off * 2;
      if (score < bestScore) { bestScore = score; pick = s; }
    }
    if (pick) pick.el.focus();
  }
  addEventListener('keydown', (e) => {
    if (!game || !game.bd || !game.answering || !e.key.startsWith('Arrow')) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    e.preventDefault();
    walk(game.bd, e.key);
  }, sig);

  function startTimer(bar, ms) {
    const i = bar.firstChild;
    bar.classList.toggle('off', !ms);
    if (!ms) return;
    i.style.transition = 'none';
    i.style.transform = 'scaleX(1)';
    void i.offsetWidth;
    i.style.transition = 'transform ' + ms + 'ms linear';
    i.style.transform = 'scaleX(0)';
  }

  // ---- Card ----------------------------------------------------------------
  function card() {
    const p = h('div', 'ppb-panel');
    const mine = best();
    p.innerHTML = `<div class="ppb-head"><div><p class="ppb-name">Pinball Recall</p>
      <p class="ppb-what">Trains working memory: hold a board of bumpers in your head and call where the ball comes out.</p></div>
      <div class="ppb-art">${ART}</div></div>
      <div class="ppb-lines"><p>${david == null ? 'David hasn\'t set a score yet' : 'David\'s best: <b>' + fmt(david) + '</b>'}</p>
      <p>Your best: <b>${mine ? fmt(mine) : 'not set yet'}</b></p></div>
      <div class="ppb-btns"><button class="ppb-go" type="button">Play</button>${load(TUT_KEY) ? '<button class="ppb-link" type="button">How to play</button>' : ''}</div>`;
    p.querySelector('.ppb-go').addEventListener('click', () => (load(TUT_KEY) ? play() : tutorial(0)), sig);
    const how = p.querySelector('.ppb-link');
    if (how) how.addEventListener('click', () => tutorial(0), sig);
    // The Lumosity page lays the three cards out in a row (styles.css .lumo-games).
    p.dataset.lumoCard = '';
    show(p, '.ppb-go');
  }

  // ---- Tutorial ------------------------------------------------------------
  function tutorial(step) {
    const t = TUT[step];
    const p = h('div', 'ppb-panel');
    p.innerHTML = `<div class="ppb-top"><span>How to play <b>${step + 1}</b> of ${TUT.length}</span>
      <span class="end"><button class="ppb-link" type="button" data-a="skip">Skip</button></span></div>
      <p class="ppb-say">${t.say}</p><div class="ppb-timer off"><i></i></div>`;
    const bd = makeBoard(t.board, true);
    const msg = h('p', 'ppb-msg');
    const btns = h('div', 'ppb-btns');
    btns.style.justifyContent = 'center';
    btns.style.marginTop = '14px';
    p.append(bd.el, msg, btns);
    const done = () => { save(TUT_KEY, '1'); play(); };
    p.querySelector('[data-a="skip"]').addEventListener('click', done, sig);
    show(p, '[data-a="skip"]');
    const path = trace(t.board);
    const ask = () => {
      p.querySelector('.ppb-timer').classList.add('off');
      bd.hide(t.study > 0);
      bd.study(false);
      msg.textContent = 'Where does it come out?';
      bd.arm((s) => {
        bd.disarm();
        msg.textContent = '';
        s.el.classList.add('pick');
        bd.run(path, () => {
          const ok = s.side === path.exit.side && s.i === path.exit.i;
          if (!ok) s.el.classList.add('miss');
          bd.slot(path.exit.side, path.exit.i).el.classList.add('exit');
          msg.innerHTML = ok ? '<b>Right.</b>' : 'It comes out <b>here</b>.';
          const last = step === TUT.length - 1;
          const go = h('button', 'ppb-go', last ? 'Start' : 'Next');
          go.type = 'button';
          go.addEventListener('click', () => (last ? done() : tutorial(step + 1)), sig);
          btns.appendChild(go);
          if (!ok) {
            const again = h('button', 'ppb-link', 'Try again');
            again.type = 'button';
            again.addEventListener('click', () => tutorial(step), sig);
            btns.appendChild(again);
          }
          go.focus({ preventScroll: true });
        });
      });
    };
    bd.hide(false);
    bd.study(t.study > 0);
    if (t.study) {
      msg.textContent = 'Remember the bumpers.';
      startTimer(p.querySelector('.ppb-timer'), t.study);
      later(ask, t.study);
    } else ask();
  }

  // ---- Play ----------------------------------------------------------------
  function play() {
    const g = { level: 1, streak: 0, round: 0, score: 0, bd: null, answering: false };
    const wrap = h('div');
    wrap.innerHTML = `<div class="ppb-top"><span>Board <b class="rd">1</b> of ${BOARDS}</span><span>Level <b class="lv">1</b></span>
      <span class="end"><span>Score <b class="sc">0</b></span><button class="ppb-x" type="button" aria-label="Stop">${X}</button></span></div>
      <div class="ppb-timer off"><i></i></div><div class="ppb-slotboard"></div><p class="ppb-msg" aria-live="polite"></p>`;
    const q = (s) => wrap.querySelector(s);
    const holder = q('.ppb-slotboard'), msg = q('.ppb-msg'), bar = q('.ppb-timer');
    q('.ppb-x').addEventListener('click', card, sig);
    show(wrap);
    game = g;

    const round = () => {
      if (g.round >= BOARDS) { results(g.score); return; }
      g.round++;
      q('.rd').textContent = g.round;
      q('.lv').textContent = g.level;
      const level = g.level;
      const board = generate(level);
      const path = trace(board);
      const bd = makeBoard(board);
      g.bd = bd;
      holder.replaceChildren(bd.el);
      // Keep the whole board on screen (phones have the nav bar across the top).
      const box = wrap.getBoundingClientRect();
      if (g.round === 1 && (box.top < (innerWidth <= 720 ? 64 : 0) || box.bottom > innerHeight)) root.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
      bd.hide(false);
      const study = studyFor(level);
      bd.study(study > 0);
      let t0 = 0;
      const ask = () => {
        bar.classList.add('off');
        bd.hide(level > 1);
        bd.study(false);
        msg.textContent = level > 1 ? 'Where does it come out? Tap the edge.' : 'Where does the ball come out? Tap the edge.';
        t0 = performance.now();
        g.answering = true;
        bd.arm((s) => {
          const ms = performance.now() - t0;
          g.answering = false;
          bd.disarm();
          msg.textContent = '';
          s.el.classList.add('pick');
          bd.run(path, () => {
            const ok = s.side === path.exit.side && s.i === path.exit.i;
            bd.slot(path.exit.side, path.exit.i).el.classList.add('exit');
            // The board celebrates or shakes; the points float up off the exit.
            bd.el.classList.add(ok ? 'won' : 'lost');
            if (ok) {
              const bonus = Math.round(25 * level * Math.min(1, Math.max(0, (7000 - ms) / 6000)));
              const pts = 100 * level + bonus;
              g.score += pts;
              const fly = h('span', 'ppb-pts', '+' + fmt(pts));
              bd.slot(path.exit.side, path.exit.i).el.appendChild(fly);
              q('.sc').textContent = fmt(g.score);
              g.streak++;
              if (g.streak >= 2 && g.level < MAX_LEVEL) { g.level++; g.streak = 0; }
              msg.innerHTML = '<b>Right.</b> +' + fmt(pts) + (bonus ? ' (speed +' + bonus + ')' : '') + (g.level > level ? '. Level up.' : '');
            } else {
              s.el.classList.add('miss');
              g.streak = 0;
              g.level = Math.max(1, g.level - 1);
              msg.innerHTML = 'Not this time. It comes out <b>here</b>.';
            }
            later(round, ok ? 1300 : 1900);
          });
        });
      };
      if (study) {
        msg.textContent = 'Remember the bumpers.';
        startTimer(bar, study);
        later(ask, study);
      } else ask();
    };
    // 3, 2, 1, go, then the first board.
    holder.style.minHeight = '260px';
    countdown(holder).then((ok) => { if (ok && game === g) { holder.style.minHeight = ''; round(); } });
  }

  // ---- Results -------------------------------------------------------------
  function results(score) {
    const prev = best();
    const top = Math.max(prev, score);
    if (score > prev) save(KEY, String(score));
    let say = '';
    if (david != null && score > david) say = 'You beat David.';
    else if (david != null && score === david) say = 'You tied David.';
    else if (david != null) say = 'David is still ahead by ' + fmt(david - score) + '.';
    if (score > prev && prev) say = (say ? say + ' ' : '') + 'New personal best.';
    const p = h('div', 'ppb-panel');
    p.innerHTML = `<div class="ppb-head"><div><p class="ppb-name">Pinball Recall</p><p class="ppb-what">${BOARDS} boards done.</p></div>
      <div class="ppb-art">${ART}</div></div>
      <div class="ppb-lines"><p>Score: <b>${fmt(score)}</b></p><p>Your best: <b>${fmt(top)}</b></p>
      <p>${david == null ? 'David hasn\'t set a score yet' : 'David\'s best: <b>' + fmt(david) + '</b>'}</p>${say ? '<p class="say">' + say + '</p>' : ''}</div>
      <div class="ppb-btns"><button class="ppb-go" type="button">Play again</button><button class="ppb-link" type="button">Done</button></div>`;
    p.querySelector('.ppb-go').addEventListener('click', play, sig);
    p.querySelector('.ppb-link').addEventListener('click', card, sig);
    show(p, '.ppb-go');
    window.dispatchEvent(new CustomEvent('dl:lumo', { detail: { game: 'pinball', score, best: top, david } }));
  }

  fetch('/hobbies/lumosity/best.json', { signal: ac.signal, cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((data) => {
      if (ac.signal.aborted) return;
      const v = data && data.pinball;
      david = typeof v === 'number' && Number.isFinite(v) ? v : null;
      const note = el.querySelector('.piece-note');
      if (note) note.remove();
      el.appendChild(root);
      card();
    });

  return function stop() {
    ac.abort();
    clearTimers();
    game = null;
    root.remove();
    release();
  };
}
