// Shared by the three Lumosity games (pinball.js, ebbflow.js, penguin.js).
// One game at a time: a game that leaves its card claims the stage and the
// others go back to theirs. A run tells the head's bus (window.dlBus) when it
// starts and when it ends, once each. The rest is feel: presses, flashes,
// bursts, a 3-2-1, a score that counts up, and a results board that cheers a
// new best. Motion is transform and opacity only. With reduced motion the
// feedback stays (colour, flashes, words) and the movement goes.

const CSS_ID = 'play-lumo-fx-css';
const CLAIM = 'dl:lumo-claim';

const CSS = `
.lfx { --lfx-hi: #5e81ac; --lfx-bad: #bf616a; }
[data-theme="dark"] .lfx { --lfx-hi: #88c0d0; --lfx-bad: #d0737c; }
.lfx-num { display: inline-block; }
.lfx-fx { position: absolute; left: 0; top: 0; width: 0; height: 0; z-index: 6; pointer-events: none; }
.lfx-p { position: absolute; left: 0; top: 0; border-radius: 50%; background: var(--lfx-hi); will-change: transform, opacity; }
.lfx-p.t1 { background: var(--t1); }
.lfx-p.bar { border-radius: 1px; }
.lfx-ring { position: absolute; left: 0; top: 0; border-radius: 50%; box-shadow: inset 0 0 0 2.5px var(--lfx-hi); will-change: transform, opacity; }
.lfx-ring.no { box-shadow: inset 0 0 0 2.5px var(--lfx-bad); }
.lfx-float { position: absolute; z-index: 6; color: var(--lfx-hi); font-weight: 500; white-space: nowrap; pointer-events: none; transform: translate(-50%, -50%); opacity: 0; }
.lfx-float.no { color: var(--lfx-bad); }
.lfx-float.big { font-size: 28px; letter-spacing: -0.02em; }
.lfx-flash { position: absolute; inset: 0; z-index: 2; border-radius: inherit; pointer-events: none; opacity: 0; background: color-mix(in srgb, var(--lfx-hi) 14%, transparent); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--lfx-hi) 65%, transparent); }
.lfx-flash.no { background: color-mix(in srgb, var(--lfx-bad) 13%, transparent); box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--lfx-bad) 60%, transparent); }
.lfx-hit { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; opacity: 0; background: color-mix(in srgb, var(--lfx-hi) 30%, transparent); box-shadow: inset 0 0 0 1.5px var(--lfx-hi); }
.lfx-hit.no { background: color-mix(in srgb, var(--lfx-bad) 26%, transparent); box-shadow: inset 0 0 0 1.5px var(--lfx-bad); }
.lfx-count { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; pointer-events: none; }
.lfx-count span { grid-area: 1 / 1; display: grid; place-items: center; min-width: 104px; height: 104px; padding: 0 22px; border-radius: 999px; background: color-mix(in srgb, var(--bg) 86%, transparent); box-shadow: 0 0 0 1px var(--rule), 0 18px 40px rgba(0, 0, 0, 0.22); font-size: 52px; font-weight: 500; line-height: 1; letter-spacing: -0.03em; color: var(--t1); }
.lfx-count span.go { color: var(--lfx-hi); }
.lfx-count span.say { height: 64px; padding: 0 26px; font-size: 26px; }
.lfx-res { margin: 18px 0 22px; }
.lfx-big { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.lfx-big b { font-size: 48px; font-weight: 500; line-height: 1.1; letter-spacing: -0.035em; color: var(--t1); transform-origin: 0 60%; }
.lfx-chip { padding: 2px 10px; border-radius: 999px; background: color-mix(in srgb, var(--lfx-hi) 18%, transparent); color: var(--lfx-hi); font-weight: 500; }
.lfx-extra { margin-top: 2px; color: var(--t2); }
.lfx-extra b { font-weight: 400; color: var(--t1); }
.lfx-vs { display: grid; grid-template-columns: max-content minmax(40px, 1fr) max-content; align-items: center; gap: 8px 12px; margin-top: 16px; color: var(--t2); }
.lfx-vs i { height: 6px; border-radius: 3px; background: var(--rule); overflow: hidden; }
.lfx-vs i b { display: block; width: 100%; height: 100%; border-radius: inherit; background: var(--t3); transform-origin: left; }
.lfx-vs .me i b { background: var(--lfx-hi); }
.lfx-vs .v { color: var(--t1); text-align: right; }
.lfx-vs .none { grid-column: 2 / -1; color: var(--t3); }
.lfx-say { margin-top: 12px; color: var(--t1); }
.lfx-x { display: grid; place-items: center; flex: none; width: 40px; height: 40px; margin: 0 -8px 0 0; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--t3); cursor: pointer; transition: color 140ms ease, background 140ms ease, transform 120ms ease; }
.lfx-x:hover { color: var(--t1); background: var(--fill); }
.lfx-x:active { transform: scale(0.88); }
.lfx-x:focus-visible { border-radius: 50%; }
.lfx-x svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
@media (max-width: 520px) { .lfx-big b { font-size: 40px; } .lfx-count span { min-width: 88px; height: 88px; font-size: 44px; } }
`;

export function useFx() {
  let s = document.getElementById(CSS_ID);
  if (!s) {
    s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  s.dataset.users = String(Number(s.dataset.users || 0) + 1);
  let done = false;
  return function release() {
    if (done) return;
    done = true;
    const t = document.getElementById(CSS_ID);
    if (!t) return;
    const n = Number(t.dataset.users || 1) - 1;
    if (n <= 0) t.remove();
    else t.dataset.users = String(n);
  };
}

const mq = (q) => window.matchMedia(q).matches;
export const reduced = () => mq('(prefers-reduced-motion: reduce)');
export const fmt = (n) => Number(n).toLocaleString('en-US');
const rand = (a, b) => a + Math.random() * (b - a);
function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
export const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>';
export function xButton(label, fn, signal) {
  const b = el('button', 'lfx-x');
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.innerHTML = X_ICON;
  b.addEventListener('click', fn, { signal });
  return b;
}

// A short buzz on phones. Android only; iOS has no vibrate.
export function buzz(p) {
  if (!mq('(pointer: coarse)')) return;
  try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {}
}

// ---- The head's bus and one game at a time -------------------------------------
export function emit(type, data) {
  try { if (window.dlBus && typeof window.dlBus.emit === 'function') window.dlBus.emit(type, data); } catch (e) {}
}
// game_start now; game_end once, whether it finished or was quit.
export function startRun(game) {
  let live = true;
  emit('game_start', { game });
  return {
    get live() { return live; },
    end(score, best, quit) {
      if (!live) return;
      live = false;
      emit('game_end', { game, result: { score, best, quit: !!quit } });
    }
  };
}
export function claim(game) { window.dispatchEvent(new CustomEvent(CLAIM, { detail: { game } })); }
export function onClaim(game, fn, signal) {
  window.addEventListener(CLAIM, (e) => { if (e.detail && e.detail.game !== game) fn(); }, { signal });
}
export function typing(t) { return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
// Esc goes to the game unless they're typing or something sits over the page.
export function escFor(e) {
  return e.key === 'Escape' && !e.defaultPrevented && !typing(e.target) && !document.documentElement.classList.contains('bringing') && !document.querySelector('.finds-panel');
}
// Scroll the game into view when its top is hidden or it runs off the bottom.
export function reveal(node) {
  const r = node.getBoundingClientRect();
  const m = parseFloat(getComputedStyle(node).scrollMarginTop) || 0;
  if (r.top < m - 2 || r.bottom > innerHeight + 2) node.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
}

// ---- Little motions ----------------------------------------------------------------
const EASE = 'cubic-bezier(.2, .8, .2, 1)';
const SPRING = 'cubic-bezier(.3, 1.5, .5, 1)';

export function enter(node, delay = 0) {
  if (!node || reduced()) return;
  node.animate([{ opacity: 0, transform: 'translateY(10px) scale(0.985)' }, { opacity: 1, transform: 'none' }], { duration: 320, delay, easing: EASE, fill: 'backwards' });
}
export function pop(node, k = 1.22, delay = 0) {
  if (!node) return;
  if (reduced()) { node.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 220, delay }); return; }
  node.animate([{ transform: 'scale(1)' }, { transform: `scale(${k})`, offset: 0.3 }, { transform: 'scale(1)' }], { duration: 360, delay, easing: 'cubic-bezier(.3, .7, .3, 1)' });
}
export function shake(node, px = 6) {
  if (!node || reduced()) return;
  node.animate([0, -px, px * 0.8, -px * 0.5, px * 0.3, 0].map((x) => ({ transform: `translateX(${x}px)` })), { duration: 340, easing: 'ease-out' });
}
export function press(node) {
  if (!node || reduced()) return;
  node.animate([{ transform: 'scale(0.88)' }, { transform: 'scale(1)' }], { duration: 220, easing: SPRING });
}
// A pad button lights up right (frost) or wrong (red).
export function hit(btn, ok) {
  if (!btn) return;
  let g = btn.querySelector(':scope > .lfx-hit');
  if (!g) { g = el('i', 'lfx-hit'); btn.appendChild(g); }
  g.classList.toggle('no', !ok);
  g.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ok ? 360 : 460, easing: 'ease-out' });
  if (ok) press(btn); else shake(btn, 4);
}
// The whole area washes right or wrong for a moment. host needs a position.
export function flash(host, ok, soft) {
  if (!host) return;
  let f = host.querySelector(':scope > .lfx-flash');
  if (!f) { f = el('i', 'lfx-flash'); host.appendChild(f); }
  f.classList.toggle('no', !ok);
  f.animate([{ opacity: soft ? 0.55 : 1 }, { opacity: 0 }], { duration: soft ? 260 : ok ? 340 : 460, easing: 'ease-out' });
}
// Where node's centre sits inside host, in px.
export function spot(host, node) {
  const a = host.getBoundingClientRect(), b = node.getBoundingClientRect();
  return [b.left + b.width / 2 - a.left, b.top + b.height / 2 - a.top];
}
function layer(host, ms) {
  const l = el('div', 'lfx-fx');
  host.appendChild(l);
  setTimeout(() => l.remove(), ms);
  return l;
}
// A ring that opens out from x, y.
export function ring(host, x, y, { r = 22, ok = true } = {}) {
  if (!host || reduced()) return;
  const l = layer(host, 700);
  const c = el('i', 'lfx-ring' + (ok ? '' : ' no'));
  c.style.width = c.style.height = r * 2 + 'px';
  l.appendChild(c);
  c.animate([
    { transform: `translate(${x - r}px, ${y - r}px) scale(0.35)`, opacity: 1 },
    { transform: `translate(${x - r}px, ${y - r}px) scale(1.2)`, opacity: 0.85, offset: 0.45 },
    { transform: `translate(${x - r}px, ${y - r}px) scale(1.6)`, opacity: 0 }
  ], { duration: 560, easing: 'cubic-bezier(.15, .7, .3, 1)', fill: 'forwards' });
}
// A burst of dots from x, y.
export function burst(host, x, y, { n = 12, spread = 50, size = 8 } = {}) {
  if (!host || reduced()) return;
  const l = layer(host, 900);
  for (let i = 0; i < n; i++) {
    const p = el('i', 'lfx-p' + (i % 4 === 3 ? ' t1' : ''));
    const s = size * rand(0.7, 1.2);
    p.style.width = p.style.height = s.toFixed(1) + 'px';
    l.appendChild(p);
    const a = (i / n) * Math.PI * 2 + rand(-0.25, 0.25), d = spread * rand(0.7, 1.15);
    const x0 = x - s / 2, y0 = y - s / 2, dx = Math.cos(a) * d, dy = Math.sin(a) * d;
    p.animate([
      { transform: `translate(${x0 + dx * 0.15}px, ${y0 + dy * 0.15}px) scale(0.6)`, opacity: 1 },
      { transform: `translate(${x0 + dx * 0.85}px, ${y0 + dy * 0.85}px) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${x0 + dx}px, ${y0 + dy}px) scale(0)`, opacity: 0 }
    ], { duration: rand(520, 720), easing: 'cubic-bezier(.2, .75, .35, 1)', fill: 'forwards' });
  }
}
// Confetti for a new best: thrown up from x, y, then it falls.
export function confetti(host, x, y, n = 40) {
  if (!host || reduced()) return;
  const l = layer(host, 2000);
  for (let i = 0; i < n; i++) {
    const p = el('i', 'lfx-p bar' + (i % 3 === 2 ? ' t1' : ''));
    const w = rand(4, 8), hgt = rand(3, 5);
    p.style.width = w.toFixed(1) + 'px';
    p.style.height = hgt.toFixed(1) + 'px';
    if (i % 5 === 4) p.style.opacity = '0.6';
    l.appendChild(p);
    const a = -Math.PI / 2 + rand(-1.15, 1.15), v = rand(90, 210);
    const ux = Math.cos(a) * v, uy = Math.sin(a) * v;
    const spin = rand(-720, 720);
    p.animate([
      { transform: `translate(${x}px, ${y}px) rotate(0deg)`, opacity: 1, easing: 'cubic-bezier(.15, .75, .35, 1)' },
      { transform: `translate(${x + ux}px, ${y + uy}px) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.38, easing: 'cubic-bezier(.45, 0, .8, .6)' },
      { transform: `translate(${x + ux * 1.35}px, ${y + uy + rand(150, 260)}px) rotate(${spin}deg)`, opacity: 0 }
    ], { duration: rand(1200, 1700), easing: 'linear', fill: 'forwards' });
  }
}
// Text that rises off x, y and fades: "+250", "x3", "Level up".
export function float(host, x, y, text, { bad = false, big = false, ms = big ? 1000 : 860 } = {}) {
  if (!host) return;
  const s = el('span', 'lfx-float' + (bad ? ' no' : '') + (big ? ' big' : ''), text);
  s.style.left = x + 'px';
  s.style.top = y + 'px';
  host.appendChild(s);
  const a = reduced()
    ? s.animate([{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.7 }, { opacity: 0 }], { duration: ms, fill: 'forwards' })
    : s.animate([
      { opacity: 0, transform: 'translate(-50%, -40%) scale(0.7)' },
      { opacity: 1, transform: 'translate(-50%, -90%) scale(1.08)', offset: 0.18 },
      { opacity: 1, transform: 'translate(-50%, -130%) scale(1)', offset: 0.65 },
      { opacity: 0, transform: 'translate(-50%, -170%) scale(1)' }
    ], { duration: ms, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'forwards' });
  a.onfinish = () => s.remove();
  setTimeout(() => s.remove(), ms + 200);
}

// A number that counts to its new value and pops.
const tallies = new WeakMap();
export function tally(node, to, { ms = 420, pop: k = 1.25 } = {}) {
  if (!node) return;
  const was = tallies.get(node);
  if (was) cancelAnimationFrame(was.raf);
  const from = was ? was.to : Number(String(node.textContent).replace(/[^\d.-]/g, '')) || 0;
  const t = { to, raf: 0 };
  tallies.set(node, t);
  pop(node, k);
  if (reduced() || from === to) { node.textContent = fmt(to); return; }
  const t0 = performance.now();
  const step = (now) => {
    const q = Math.min(1, (now - t0) / ms);
    const e = 1 - Math.pow(1 - q, 3);
    node.textContent = fmt(Math.round(from + (to - from) * e));
    if (q < 1) t.raf = requestAnimationFrame(step);
  };
  t.raf = requestAnimationFrame(step);
}

// Big words over host (needs a position): 3, 2, 1, Go, or "Time's up".
// later(fn, ms) is the game's timer so leaving the view cancels it.
function shout(box, text, cls, ms) {
  const s = el('span', cls, text);
  box.replaceChildren(s);
  if (reduced()) { s.animate([{ opacity: 1 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: ms, fill: 'forwards' }); return; }
  s.animate([
    { opacity: 0, transform: 'scale(1.7)' },
    { opacity: 1, transform: 'scale(1)', offset: 0.28 },
    { opacity: 1, transform: 'scale(0.97)', offset: 0.78 },
    { opacity: 0, transform: 'scale(0.86)' }
  ], { duration: ms, easing: 'cubic-bezier(.2, .8, .3, 1)', fill: 'forwards' });
}
export function countdown(host, later, done, { from = 3, step = 540 } = {}) {
  const box = el('div', 'lfx-count');
  box.setAttribute('aria-hidden', 'true');
  host.appendChild(box);
  let n = from;
  const tick = () => {
    if (n > 0) { shout(box, String(n), '', step); buzz(6); n--; later(tick, step); return; }
    shout(box, 'Go', 'go', step);
    buzz(16);
    later(() => box.remove(), step);
    done();
  };
  tick();
}
export function banner(host, text, ms = 900) {
  const box = el('div', 'lfx-count');
  box.setAttribute('aria-hidden', 'true');
  host.appendChild(box);
  shout(box, text, 'say', ms);
  setTimeout(() => box.remove(), ms + 50);
}

// ---- Results ---------------------------------------------------------------------
// The middle of a results panel: this run's score, your best and David's best
// as bars, and a line about it. play(host) once it's on the page: the score
// counts up, the bars grow, and a new best gets confetti over host.
export function scoreboard({ score, prev, david, extra }) {
  const best = Math.max(prev, score);
  const fresh = score > prev && score > 0;
  const beat = david != null && score > david;
  const box = el('div', 'lfx-res');
  const big = el('p', 'lfx-big');
  const num = el('b', 'lfx-num', reduced() ? fmt(score) : '0');
  big.appendChild(num);
  const chip = fresh && prev ? el('span', 'lfx-chip', 'New best') : null;
  if (chip) big.appendChild(chip);
  box.appendChild(big);
  if (extra) {
    const p = el('p', 'lfx-extra');
    p.innerHTML = extra;
    box.appendChild(p);
  }
  const top = Math.max(best, david || 0) || 1;
  const vs = el('div', 'lfx-vs');
  const row = (cls, label, v) => {
    const r = el('div', cls);
    r.style.display = 'contents';
    r.appendChild(el('span', '', label));
    if (v == null) { r.appendChild(el('span', 'none', "hasn't set a score yet")); return r; }
    const bar = el('i');
    const fill = el('b');
    fill.style.transform = `scaleX(${(v / top).toFixed(3)})`;
    bar.appendChild(fill);
    r.append(bar, el('span', 'v', fmt(v)));
    r.fill = fill;
    return r;
  };
  const me = row('me', 'Your best', best);
  const dl = row('dl', "David's best", david);
  vs.append(me, dl);
  box.appendChild(vs);
  // The chip already says New best; the line is about David, or a first run.
  let say = '';
  if (david != null) say = beat ? 'You beat David.' : score === david ? 'You tied David.' : 'David is still ahead by ' + fmt(david - score) + '.';
  if (fresh && !prev) say = (say ? say + ' ' : '') + 'Your first score. Now beat it.';
  if (say) box.appendChild(el('p', 'lfx-say', say));
  const bars = [me.fill, dl.fill].filter(Boolean);
  return {
    el: box,
    play(host) {
      if (reduced()) return;
      const ms = Math.min(1100, 500 + score / 8);
      bars.forEach((b, i) => b.animate([{ transform: 'scaleX(0)' }, { transform: b.style.transform }], { duration: 700, delay: 260 + i * 120, easing: EASE, fill: 'backwards' }));
      [...box.children].slice(1).forEach((c, i) => enter(c, 120 + i * 70));
      const t0 = performance.now();
      const step = (now) => {
        if (!num.isConnected) return;
        const q = Math.min(1, (now - t0) / ms);
        num.textContent = fmt(Math.round(score * (1 - Math.pow(1 - q, 3))));
        if (q < 1) { requestAnimationFrame(step); return; }
        pop(num, 1.12);
        if (!host || !host.isConnected) return;
        const [x, y] = spot(host, num);
        if ((fresh && prev) || beat) {
          if (chip) pop(chip, 1.3);
          confetti(host, x, y);
          buzz([20, 40, 30, 40, 60]);
        } else if (fresh) {
          ring(host, x, y, { r: 34 });
          burst(host, x, y, { n: 10, spread: 50 });
          buzz(20);
        }
      };
      requestAnimationFrame(step);
    }
  };
}
