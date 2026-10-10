/* Climb the page. Loaded by site.js on /hobbies/climbing/.
   mount(el) puts an invite in el and returns a cleanup function.

   Starting pops a V2 route onto the page itself: an absolute layer over the
   whole document, so the holds sit on the real page and scroll with it. The
   head hangs off the start holds by its two hands. Tap a hold inside the
   reach ring (or drag a hand onto it) and the lower hand goes. Every move
   costs grip, small holds cost a little more to hang on, jugs give it back.
   One gap is a dyno: tap when the ring lands on the hold. Run out of grip or
   blow the dyno and it falls to the mat, then gets back on at the start or
   the last jug it reached. Both hands on the top hold is a send.
   The site's floating head is the climber: through window.dlHead (talk.js) it
   flies onto the start holds, this one takes over, and it flies home after.
   Without that API the floating head just hides while climbing. */

const HEAD = { w: 269, h: 344, mouth: 0.795, mouthX: [0.35, 0.669], cut: [0.152, 0.829] };
const FACES = {
  neutral: '/media/head.webp',
  blink: '/media/head-blink.webp',
  happy: '/media/head-happy.webp',
  sad: '/media/head-sad.webp',
  angry: '/media/head-angry.webp'
};
const FIST = { src: '/media/hands/fist.webp', w: 300, h: 400, at: [0.5, 0.3] };
const PALM = { src: '/media/hands/palm.webp', w: 298, h: 400, at: [0.5, 0.3] };
const ROUTE = '#88c0d0';
const BITS = ['#88c0d0', '#a9d4e0', '#5f9fb3'];
const DECO = ['#bf616a', '#d08770', '#ebcb8b', '#a3be8c', '#b48ead', '#5e81ac'];

// Hold kinds. r: size, shape: [width, height] of the blob, drain: grip a
// second for each hand hanging on it (negative gives it back), cost: extra
// grip to latch it.
const KINDS = {
  start: { name: 'start hold', r: 1, shape: [1.3, 0.72], drain: 0.4, cost: 0 },
  jug: { name: 'jug', r: 1.12, shape: [1.35, 0.9], drain: -6, cost: 0, lip: true, rest: true },
  edge: { name: 'edge', r: 0.86, shape: [1.4, 0.62], drain: 0.7, cost: 1 },
  crimp: { name: 'crimp', r: 0.72, shape: [1.5, 0.44], drain: 1.6, cost: 4 },
  sloper: { name: 'sloper', r: 0.95, shape: [1.12, 0.96], drain: 1.3, cost: 3, dome: true },
  pinch: { name: 'pinch', r: 0.82, shape: [0.6, 1.3], drain: 1, cost: 2 },
  top: { name: 'top hold', r: 1.2, shape: [1.4, 0.92], drain: -3, cost: 0, lip: true }
};

// The problem: [kind, across (-1 left, 1 right), up (0 start, 1 top)].
// Left-hand holds sit left of the right-hand ones, so the lower hand always
// goes next. The gap into hold 7 is three moves tall: that's the dyno, and
// nothing above it counts until a hand has caught it.
const PROBLEM = [
  ['start', -0.18, 0],
  ['start', 0.18, 0],
  ['crimp', 0.32, 0.075],
  ['sloper', -0.12, 0.15],
  ['edge', 0.28, 0.225],
  ['jug', -0.05, 0.3],
  ['pinch', 0.3, 0.375],
  ['edge', -0.15, 0.6],
  ['jug', 0.2, 0.58],
  ['sloper', -0.18, 0.69],
  ['crimp', 0.22, 0.77],
  ['edge', -0.12, 0.85],
  ['crimp', 0.15, 0.925],
  ['top', 0, 1]
];
const DYNO = 7;
const TOP = PROBLEM.length - 1;

// Everything the head says. Lowercase, short, no em dashes.
const SAY = {
  start: ['ok ok i got this', 'ok. v2. we got this', "chalked up. let's go"],
  how: 'tap a hold in my circle. the big ones are jugs, rest on those',
  far: ["i can't reach that 😭", 'my arms are not that long', 'too far lol'],
  jug: ['jug!! ok resting', 'ahh a jug. shaking out', 'jug. thank god'],
  crimp: ['ow crimpy', 'this is so small 😭'],
  sloper: ['slopey..', 'why is it round'],
  pump: ['my forearms 😭', 'pump is real. jug pls', "i'm cooked"],
  pumped: ['my forearms 😭', 'nope. pumped', 'arms gone'],
  dyno: 'ok this one is a dyno. tap when the ring hits the hold',
  dynoAgain: ['dyno. tap on the ring', 'ok ok. timing'],
  caught: ['WAIT I CAUGHT IT', 'no way', 'hehe caught it'],
  early: 'jumped too early lol',
  late: 'too late 😭',
  slip: 'nooo',
  mat: ['ow', 'man i can only do a v2 :(', 'that hold is greasy i swear', 'the mat is my friend'],
  again: ['ok again', 'one more go', 'from the start. ok'],
  back: ['ok back on the jug', 'jug restart. thank u'],
  match: 'match it! both hands on the top',
  sent: 'SENT IT. ok that was my max lol'
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const f2 = (n) => Math.round(n * 100) / 100;
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clock(ms) {
  const s = Math.max(0, ms) / 1000;
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r < 10 ? '0' : ''}${r.toFixed(1)}`;
}

// A plastic hold: a lumpy blob, a shadow on the wall, a shine and a bolt.
function blob(rx, ry, rnd) {
  const n = 9;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + (rnd() - 0.5) * 0.35;
    const j = 0.86 + rnd() * 0.22;
    pts.push([Math.cos(a) * rx * j, Math.sin(a) * ry * j]);
  }
  let d = `M${f2(pts[0][0])},${f2(pts[0][1])}`;
  for (let k = 0; k < n; k++) {
    const p0 = pts[(k + n - 1) % n], p1 = pts[k], p2 = pts[(k + 1) % n], p3 = pts[(k + 2) % n];
    d += `C${f2(p1[0] + (p2[0] - p0[0]) / 6)},${f2(p1[1] + (p2[1] - p0[1]) / 6)} ${f2(p2[0] - (p3[0] - p1[0]) / 6)},${f2(p2[1] - (p3[1] - p1[1]) / 6)} ${f2(p2[0])},${f2(p2[1])}`;
  }
  return d + 'Z';
}
function holdSVG(kind, color, seed) {
  const K = KINDS[kind];
  const rnd = rng(seed);
  const [rx, ry] = K.shape;
  const d = blob(rx, ry, rnd);
  const bx = f2((rnd() - 0.5) * rx * 0.5);
  const by = f2(K.lip ? ry * 0.3 : (rnd() - 0.5) * ry * 0.4);
  let s = '<svg viewBox="-1.7 -1.7 3.4 3.4" aria-hidden="true">';
  s += `<path d="${d}" transform="translate(.07 .17)" fill="var(--climb-shade)"/>`;
  s += `<path d="${d}" fill="${color}" stroke="rgba(0,0,0,.2)" stroke-width=".05"/>`;
  if (K.lip) s += `<ellipse cx="0" cy="${f2(-ry * 0.22)}" rx="${f2(rx * 0.62)}" ry="${f2(ry * 0.26)}" fill="rgba(0,0,0,.3)"/>`;
  s += `<path d="${d}" transform="translate(${f2(-rx * 0.16)} ${f2(-ry * 0.26)}) scale(.52)" fill="#fff" opacity="${K.dome ? 0.36 : 0.26}"/>`;
  s += `<circle cx="${bx}" cy="${by}" r=".13" fill="rgba(0,0,0,.42)"/><circle cx="${bx}" cy="${by}" r=".06" fill="rgba(255,255,255,.25)"/>`;
  return s + '</svg>';
}

const CSS = `
.climb-invite { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; }
.climb-ask { color: var(--t1); }
.climb-hint { max-width: 34em; color: var(--t3); }
.climb-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 14px; }
.climb-primary, .climb-quiet { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 48px; padding: 0 24px; border: 0; border-radius: 999px; font: inherit; font-weight: 500; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: transform 140ms ease, background 160ms ease, box-shadow 160ms ease; }
.climb-primary { padding-left: 20px; background: ${ROUTE}; color: #0a0907; box-shadow: 0 10px 24px -12px rgba(136, 192, 208, 0.95), inset 0 -2px 0 rgba(0, 0, 0, 0.1); }
.climb-primary:hover { background: #9acbd9; box-shadow: 0 14px 30px -12px rgba(136, 192, 208, 1), inset 0 -2px 0 rgba(0, 0, 0, 0.1); }
.climb-primary svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.climb-quiet { font-weight: 400; background: var(--fill); box-shadow: inset 0 0 0 1px var(--rule); color: var(--t1); }
.climb-quiet:hover { background: var(--rule); }
.climb-primary:active, .climb-quiet:active { transform: scale(0.97); }
.climb-primary:focus-visible, .climb-quiet:focus-visible { outline: 2px solid #0071e3; outline-offset: 3px; }

.climb-card { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; width: min(380px, 100%); padding: 20px 22px 22px; border-radius: 18px; background: var(--panel, rgba(255, 255, 255, 0.92)); box-shadow: 0 0 0 1px var(--rule), 0 18px 44px -20px rgba(0, 0, 0, 0.35); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); white-space: normal; line-height: 1.5; }
.climb-tag { padding: 4px 12px 5px; border-radius: 999px; background: ${ROUTE}; color: #0a0907; font-size: 11px; font-weight: 600; line-height: 1; letter-spacing: 0.08em; text-transform: uppercase; rotate: -4deg; box-shadow: 0 2px 0 rgba(0, 0, 0, 0.08); }
.climb-line { color: var(--t2); }
.climb-stats { display: flex; flex-wrap: wrap; gap: 8px 28px; }
.climb-stats b { display: block; color: var(--t1); font-size: 1.5em; font-weight: 500; line-height: 1.2; letter-spacing: -0.02em; }
.climb-stats span { color: var(--t3); }
.climb-stats .new span { color: var(--t1); }
.climb-stats .new span::before { content: ''; display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: ${ROUTE}; vertical-align: 1px; }
.climb-card .climb-actions { align-self: stretch; margin-top: 4px; }
.climb-card .climb-primary { flex: 1; }

body:has(> .climb-wall.hide-dl) .dl, body:has(> .climb-wall.hide-dl) .dl * { visibility: hidden !important; }

.climb-wall { position: absolute; left: 0; top: 0; width: 100%; z-index: 45; overflow: hidden; pointer-events: none; --climb-shade: rgba(0, 0, 0, 0.2); --climb-ring: #4f8ea3; }
[data-theme="dark"] .climb-wall { --climb-shade: rgba(0, 0, 0, 0.6); --climb-ring: ${ROUTE}; }
.climb-wall > * { position: absolute; left: 0; top: 0; }
.climb-wall [hidden] { display: none !important; }

.climb-mat { border-radius: 10px; background: var(--fill); box-shadow: inset 0 0 0 1px var(--rule), 0 6px 14px -10px rgba(0, 0, 0, 0.3); animation: climb-fade 300ms ease both; }
.climb-mat::before, .climb-mat::after { content: ''; position: absolute; top: 4px; bottom: 4px; width: 1px; background: var(--rule); }
.climb-mat::before { left: 33.3%; }
.climb-mat::after { left: 66.6%; }

.climb-reach { border-radius: 50%; border: 1.5px dashed var(--climb-ring); background: radial-gradient(closest-side, rgba(136, 192, 208, 0.1), rgba(136, 192, 208, 0.03)); transition: transform 380ms cubic-bezier(.2, .8, .2, 1), opacity 220ms ease; }
.climb-reach.off { opacity: 0; }
[data-theme="dark"] .climb-reach { border-color: rgba(136, 192, 208, 0.75); }

.climb-hold { display: grid; place-items: center; padding: 0; margin: 0; border: 0; border-radius: 50%; background: none; pointer-events: auto; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; animation: climb-pop 420ms cubic-bezier(.34, 1.56, .64, 1) both; animation-delay: var(--d, 0ms); }
.climb-hold svg { display: block; width: var(--s); height: var(--s); overflow: visible; pointer-events: none; transition: transform 160ms ease, opacity 220ms ease; }
.climb-hold::before { content: ''; position: absolute; left: 50%; top: 50%; width: var(--ring); height: var(--ring); margin: calc(var(--ring) / -2) 0 0 calc(var(--ring) / -2); box-sizing: border-box; border-radius: 50%; border: 2px solid var(--climb-ring); opacity: 0; transition: opacity 200ms ease; pointer-events: none; }
.climb-hold.in::before { opacity: 1; animation: climb-ring 1.6s ease-in-out infinite; }
.climb-hold.dy::before { opacity: 0.95; border-style: dashed; }
.climb-hold.dy::after { content: 'dyno'; position: absolute; left: 50%; top: calc(50% + var(--ring) / 2 + 4px); padding: 2px 6px 3px; border-radius: 999px; background: ${ROUTE}; color: #0a0907; font-size: 10px; line-height: 1; letter-spacing: 0.06em; transform: translateX(-50%); pointer-events: none; white-space: nowrap; }
.climb-hold.aim::before { opacity: 1; border-style: solid; animation: none; }
.climb-hold.far svg { opacity: 0.7; }
.climb-hold.hot svg, .climb-hold.in:hover svg, .climb-hold.dy:hover svg { transform: scale(1.1); }
.climb-hold:focus-visible { outline: 2px solid #0071e3; outline-offset: 2px; }
.climb-hold.deco { pointer-events: none; cursor: default; }
.climb-hold.deco svg { opacity: 0.5; }
[data-theme="dark"] .climb-hold.deco svg { opacity: 0.42; }

.climb-tape { padding: 2px 5px 3px; border-radius: 2px; background: ${ROUTE}; color: #0a0907; font-size: 10px; font-weight: 600; line-height: 1; letter-spacing: 0.06em; rotate: -7deg; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15); animation: climb-pop 420ms cubic-bezier(.34, 1.56, .64, 1) both; animation-delay: var(--d, 0ms); }

.climb-head { width: var(--hw); height: var(--hh); transform-origin: 50% 30%; will-change: transform; --m: ${HEAD.mouth}; --cx0: ${HEAD.cut[0]}; --cx1: ${HEAD.cut[1]}; }
.climb-head .sk, .climb-head .jw { position: absolute; inset: 0; }
.climb-head .sk { z-index: 2; transform-origin: 18% calc(var(--m) * 100%); }
.climb-head .jw { z-index: 3; }
.climb-head img { position: absolute; inset: 0; width: 100%; height: 100%; display: block; user-select: none; -webkit-user-drag: none; pointer-events: none; }
.climb-head .sk img { clip-path: inset(0 0 calc((1 - var(--m)) * 100% - 1px) 0); }
.climb-head .jw img { clip-path: inset(calc(var(--m) * 100%) 0 0 0); }
.climb-head .cav { position: absolute; z-index: 1; left: calc(var(--cx0) * 100% + 1.5%); right: calc((1 - var(--cx1)) * 100% + 1.5%); top: calc((var(--m) - 0.2) * 100%); height: 21%; border-radius: 12% 12% 46% 46% / 20% 20% 70% 70%; background: radial-gradient(ellipse 34% 30% at 50% 100%, #b23a4a 0 98%, transparent 100%), linear-gradient(#120707, #3a1216); }

.climb-hand { width: var(--nw); height: var(--nh); pointer-events: auto; touch-action: none; cursor: grab; will-change: transform; filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2)); -webkit-tap-highlight-color: transparent; }
.climb-hand.grab { cursor: grabbing; }
.climb-hand img { position: absolute; inset: 0; width: 100%; height: 100%; user-select: none; -webkit-user-drag: none; pointer-events: none; }
.climb-hand.l img { transform: scaleX(-1); }

.climb-dring { box-sizing: border-box; border-radius: 50%; border: 3px solid var(--climb-ring); opacity: 0; }

.climb-say { max-width: min(230px, 62vw); padding: 8px 13px 9px; border-radius: 16px 16px 16px 5px; background: var(--talk-paper, #fffdf7); color: var(--talk-ink, #2b2925); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.04), 0 10px 26px -8px rgba(0, 0, 0, 0.3); font-size: 14px; line-height: 1.35; opacity: 0; transition: opacity 160ms ease; width: max-content; }
.climb-say.on { opacity: 1; }
.climb-say.left { border-radius: 16px 16px 5px 16px; }

.climb-bit { width: 7px; height: 4px; border-radius: 1px; }

.climb-catch { position: fixed; inset: 0; z-index: 54; cursor: pointer; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }

.climb-hud { position: fixed; left: 50%; bottom: calc(14px + env(safe-area-inset-bottom, 0px)); z-index: 55; display: flex; align-items: center; gap: 14px; padding: 7px 7px 7px 16px; border-radius: 14px; background: var(--panel, rgba(255, 255, 255, 0.92)); box-shadow: 0 0 0 1px var(--rule), 0 14px 36px -16px rgba(0, 0, 0, 0.3); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); color: var(--t2); font-size: 14px; line-height: 1; white-space: nowrap; transform: translateX(-50%); animation: climb-up 320ms cubic-bezier(.2, .8, .2, 1) both; }
.climb-hud b { font-weight: 500; color: var(--t1); }
.climb-meter { display: inline-flex; align-items: center; gap: 8px; }
.climb-k { color: var(--t3); }
.climb-bar { position: relative; width: 84px; height: 6px; border-radius: 3px; background: var(--fill); box-shadow: inset 0 0 0 1px var(--rule); overflow: hidden; }
.climb-bar i { position: absolute; inset: 0; border-radius: inherit; background: ${ROUTE}; transform-origin: 0 50%; }
.climb-hud.low .climb-bar i { animation: climb-blink 450ms ease-in-out infinite alternate; }
.climb-hud.low .climb-k { color: var(--t1); }
.climb-time { min-width: 3.6em; color: var(--t1); }
.climb-hud > button { padding: 7px 12px; border: 0; border-radius: 9px; background: var(--fill); color: var(--t1); font: inherit; line-height: 1; cursor: pointer; }
.climb-hud > button:hover { background: var(--rule); }
.climb-hud.done { display: block; width: min(380px, calc(100vw - 32px)); padding: 0; border-radius: 18px; background: none; box-shadow: none; -webkit-backdrop-filter: none; backdrop-filter: none; }
.climb-hud.done .climb-card { width: 100%; background: var(--bg); }
@media (max-width: 480px) {
  .climb-hud { gap: 10px; padding-left: 12px; }
  .climb-bar { width: 56px; }
}

@keyframes climb-pop { from { scale: 0; } 60% { scale: 1.15; } to { scale: 1; } }
@keyframes climb-ring { 50% { scale: 1.12; opacity: 0.5; } }
@keyframes climb-fade { from { opacity: 0; } }
@keyframes climb-up { from { opacity: 0; translate: 0 12px; } }
@keyframes climb-blink { to { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .climb-hold, .climb-tape, .climb-mat, .climb-hud, .climb-hold.in::before { animation: none; }
  .climb-primary, .climb-quiet { transition: none; }
  .climb-reach { transition: none; }
}
`;

const UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
function cardHTML(r, inline) {
  // A first send's best is just its time, so it only shows once there's one to beat.
  const best = r.best == null || !r.prior ? '' : `<div class="${r.isBest ? 'new' : ''}"><b>${clock(r.best)}</b><span>${r.isBest ? 'new best' : 'best'}</span></div>`;
  return '<div class="climb-card" role="group" aria-label="Sent it">' +
    '<span class="climb-tag">Sent it</span><p class="climb-line">ok that was my max lol</p>' +
    `<div class="climb-stats"><div><b>${clock(r.ms)}</b><span>time</span></div><div><b>${r.tries}</b><span>${r.tries === 1 ? 'try' : 'tries'}</span></div>${best}</div>` +
    `<div class="climb-actions"><button type="button" class="climb-primary" data-go>${UP}Climb again</button>${inline ? '' : '<button type="button" class="climb-quiet" data-done>Done</button>'}</div></div>`;
}
// The floating head (talk/talk.js) can lend itself: it flies onto the start
// holds and goes away while this head climbs, then flies home. Without that
// API the floating head is just hidden while climbing.
function headApi() {
  const a = window.dlHead;
  return a && typeof a.flyTo === 'function' && typeof a.away === 'function' ? a : null;
}
const within = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => setTimeout(r, ms))]);

let styleUsers = 0;
function addStyle() {
  styleUsers++;
  if (document.getElementById('climb-style')) return;
  const s = document.createElement('style');
  s.id = 'climb-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}
function dropStyle() {
  styleUsers = Math.max(0, styleUsers - 1);
  if (!styleUsers) { const s = document.getElementById('climb-style'); if (s) s.remove(); }
}

export function mount(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  addStyle();
  const invite = document.createElement('div');
  invite.className = 'climb-invite';
  el.appendChild(invite);
  let game = null;
  let lastResult = null;
  // In the page: an invite, a quiet stop button while climbing, the last send after.
  function render(state, focus) {
    const had = focus || invite.contains(document.activeElement);
    invite.dataset.state = state === 'climbing' ? 'climbing' : lastResult ? 'sent' : 'idle';
    if (state === 'climbing') {
      invite.innerHTML = "<p class=\"climb-ask\">ok we're on the wall</p><p class=\"climb-hint\">Exit or Esc gets you off.</p>" +
        '<div class="climb-actions"><button type="button" class="climb-quiet" data-go>Stop climbing</button></div>';
    } else if (lastResult) {
      invite.innerHTML = cardHTML(lastResult, true);
    } else {
      invite.innerHTML = '<p class="climb-ask">climb with me?</p><p class="climb-hint">A V2 straight up this page. Tap a hold inside the ring or drag a hand onto it, and rest on the jugs.</p>' +
        `<div class="climb-actions"><button type="button" class="climb-primary" data-go>${UP}Start climbing</button></div>`;
    }
    const btn = invite.querySelector('[data-go]');
    if (had && btn) btn.focus({ preventScroll: true });
    return btn;
  }
  const onGo = (e) => {
    if (!e.target.closest('[data-go]')) return;
    if (game) game.end(true); else game = climb();
  };
  invite.addEventListener('click', onGo);
  // The head starts it (talk/talk.js pitch) when the invite is hidden.
  el.addEventListener('dl:start', () => { if (!game) game = climb(); });
  render('idle');

  function climb() {
    const now = () => performance.now();
    const off = [];
    const on = (t, type, fn, o) => { t.addEventListener(type, fn, o); off.push(() => t.removeEventListener(type, fn, o)); };
    const timers = new Set();
    const later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); return id; };
    let raf = 0;
    let dead = false;
    let sentRun = null;
    // Said here, not when the head lands: getting off before it does still ends a game that started.
    try { if (window.dlBus) window.dlBus.emit('game_start', { game: 'climb' }); } catch (e) { /* fine */ }

    // ---- Build -----------------------------------------------------------
    const wall = document.createElement('div');
    wall.className = 'climb-wall';
    wall.setAttribute('role', 'group');
    wall.setAttribute('aria-label', 'Climbing wall, V2');
    const mat = document.createElement('div');
    mat.className = 'climb-mat';
    const reachEl = document.createElement('div');
    reachEl.className = 'climb-reach off';
    wall.append(mat, reachEl);

    const holds = PROBLEM.map(([kind, u, v], i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'climb-hold';
      b.innerHTML = holdSVG(kind, ROUTE, 11 + i * 7);
      b.style.setProperty('--d', (reduce ? 0 : 120 + i * 55) + 'ms');
      wall.appendChild(b);
      return { i, kind, K: KINDS[kind], u, v, x: 0, y: 0, r: 0, el: b };
    });
    const tapes = [[0, 'S'], [1, 'S'], [TOP, 'TOP']].map(([i, t]) => {
      const e = document.createElement('div');
      e.className = 'climb-tape';
      e.textContent = t;
      e.style.setProperty('--d', (reduce ? 0 : 200 + i * 55) + 'ms');
      wall.appendChild(e);
      return { i, el: e };
    });
    // Other people's routes, in other colours. Just for looks.
    const rnd = rng(7);
    const decos = [];
    const nDeco = innerWidth < 640 ? 10 : 18;
    for (let n = 0; n < nDeco; n++) {
      const kind = ['jug', 'edge', 'crimp', 'sloper', 'pinch', 'edge'][n % 6];
      const e = document.createElement('div');
      e.className = 'climb-hold deco';
      e.innerHTML = holdSVG(kind, DECO[n % DECO.length], 101 + n * 13);
      e.style.setProperty('--d', (reduce ? 0 : Math.round(rnd() * 600)) + 'ms');
      wall.insertBefore(e, holds[0].el);
      decos.push({ el: e, K: KINDS[kind], fx: rnd(), fy: rnd(), s: 0.7 + rnd() * 0.35, rot: Math.round((rnd() - 0.5) * 70) });
    }

    const head = document.createElement('div');
    head.className = 'climb-head';
    head.setAttribute('aria-hidden', 'true');
    head.innerHTML = '<div class="cav"></div><div class="sk"></div><div class="jw"></div>';
    const sk = head.querySelector('.sk'), jw = head.querySelector('.jw');
    const faceImgs = [];
    [sk, jw].forEach((part) => {
      Object.keys(FACES).forEach((name) => {
        const img = document.createElement('img');
        img.src = FACES[name];
        img.alt = '';
        img.dataset.f = name;
        img.hidden = name !== 'neutral';
        part.appendChild(img);
        faceImgs.push(img);
      });
    });
    const handEl = {};
    ['l', 'r'].forEach((k) => {
      const e = document.createElement('div');
      e.className = 'climb-hand ' + k;
      e.setAttribute('aria-hidden', 'true');
      e.innerHTML = `<img src="${FIST.src}" alt="" data-g="fist"><img src="${PALM.src}" alt="" data-g="palm" hidden>`;
      handEl[k] = e;
    });
    const dring = document.createElement('div');
    dring.className = 'climb-dring';
    const sayEl = document.createElement('div');
    sayEl.className = 'climb-say';
    sayEl.setAttribute('role', 'status');
    sayEl.setAttribute('aria-live', 'polite');
    wall.append(head, handEl.l, handEl.r, dring, sayEl);

    const hud = document.createElement('div');
    hud.className = 'climb-hud';
    hud.setAttribute('role', 'group');
    hud.setAttribute('aria-label', 'Climb');
    document.body.append(wall, hud);

    function hudClimb() {
      hud.className = 'climb-hud';
      hud.innerHTML =
        '<b>V2</b><span class="climb-meter" role="meter" aria-label="Grip" aria-valuemin="0" aria-valuemax="100"><span class="climb-k">Grip</span><span class="climb-bar"><i></i></span></span>' +
        '<span class="climb-time">0:00.0</span><span class="climb-tries">Try 1</span><button type="button" class="x">Exit</button>';
      hud.querySelector('.x').addEventListener('click', () => end(true));
      hudBits = { meter: hud.querySelector('.climb-meter'), bar: hud.querySelector('.climb-bar i'), time: hud.querySelector('.climb-time'), tries: hud.querySelector('.climb-tries') };
      lastTime = lastGrip = '';
    }
    let hudBits = null, lastTime = '', lastGrip = '';

    // ---- Layout ------------------------------------------------------------
    // Everything is in document coordinates, measured off the real page: the
    // route runs from just above the footer up to my name in the header.
    const G = {};
    function restOf(a, b) {
      const lo = Math.max(a.y, b.y), hi = Math.min(a.y, b.y);
      return { x: (a.x + b.x) / 2, y: lo * 0.6 + hi * 0.4 + G.hang };
    }
    // Which hand the obvious beta moves: the other one when matching, else the lower.
    function beta(l, r, i) {
      if (l === i) return 'r';
      if (r === i) return 'l';
      const L = holds[l], R = holds[r];
      if (Math.abs(L.y - R.y) < 2) return holds[i].x < (L.x + R.x) / 2 ? 'l' : 'r';
      return L.y > R.y ? 'l' : 'r';
    }
    // Reach is set by the hardest static move of the obvious beta.
    function tune() {
      let l = 0, r = 1, need = 0, jump = 0;
      const walk = [];
      for (let i = 2; i <= TOP; i++) walk.push(i);
      walk.push(TOP);
      for (const i of walk) {
        const d = dist(restOf(holds[l], holds[r]), holds[i]);
        if (i === DYNO) jump = d; else need = Math.max(need, d);
        if (beta(l, r, i) === 'l') l = i; else r = i;
      }
      G.reach = Math.max(need * 1.1, G.hh * 1.45);
      G.jump = Math.max(jump * 1.25, G.reach * 1.3);
    }
    function measure() {
      wall.style.height = '0px';
      const de = document.documentElement;
      G.vw = de.clientWidth;
      G.docH = Math.max(de.scrollHeight, innerHeight);
      const sm = innerWidth < 640;
      G.hw = sm ? 62 : 84;
      G.hh = Math.round((G.hw * HEAD.h) / HEAD.w);
      G.nh = Math.round(G.hh * 0.5);
      G.nw = Math.round((G.nh * FIST.w) / FIST.h);
      G.hang = G.hh * 0.72;
      G.base = G.hw * 0.24;
      G.bar = innerWidth <= 720 ? 58 : 0;
      G.hud = 76;
      const main = document.querySelector('main') || document.querySelector('.page') || document.body;
      const mr = main.getBoundingClientRect();
      G.colL = mr.left + scrollX;
      G.colR = mr.right + scrollX;
      const name = document.querySelector('.top .me');
      const nr = name && name.getBoundingClientRect();
      const top = nr && nr.width
        ? { x: nr.left + scrollX + nr.width / 2, y: nr.top + scrollY + nr.height / 2 }
        : { x: G.colL + 60, y: mr.top + scrollY + 30 };
      top.y = Math.max(top.y, G.bar + G.base * 1.6);
      const low = G.docH - G.hud - G.hang - G.hh / 2 - 34;
      const span = clamp(low - top.y, G.hh * 4.5, G.hh * 7.2);
      G.y0 = top.y + span;
      G.half = Math.max(60, Math.min((G.colR - G.colL) / 2 - 16, G.hh * 1.9));
      G.cx0 = clamp(G.colL + G.half + 40, G.colL + G.half, Math.max(G.colL + G.half, G.colR - G.half));
      holds.forEach((h) => {
        h.r = G.base * h.K.r;
        if (h.i === TOP) { h.x = top.x; h.y = top.y; return; }
        h.x = clamp(lerp(G.cx0, top.x, h.v) + h.u * G.half, G.colL + h.r * 0.6, G.colR - h.r * 0.6);
        h.y = G.y0 - h.v * span;
      });
      tune();
      G.matTop = G.y0 + G.hang + G.hh / 2 + 10;
      G.floor = G.matTop + 6;
      G.wallH = Math.max(G.docH, G.matTop + 22 + G.hud);
      wall.style.height = G.wallH + 'px';
    }
    function place() {
      wall.style.setProperty('--hw', G.hw + 'px');
      wall.style.setProperty('--hh', G.hh + 'px');
      wall.style.setProperty('--nw', G.nw + 'px');
      wall.style.setProperty('--nh', G.nh + 'px');
      const mc = (holds[0].x + holds[1].x) / 2;
      const mx0 = Math.max(8, mc - G.hw * 2.6), mx1 = Math.min(G.vw - 8, mc + G.hw * 2.6);
      Object.assign(mat.style, { left: mx0 + 'px', top: G.matTop + 'px', width: mx1 - mx0 + 'px', height: '22px' });
      reachEl.style.width = reachEl.style.height = G.reach * 2 + 'px';
      reachEl.style.margin = `${-G.reach}px 0 0 ${-G.reach}px`;
      holds.forEach((h) => {
        const s = h.r * 3.4;
        const hit = Math.max(44, h.r * 2.6);
        Object.assign(h.el.style, { left: h.x - hit / 2 + 'px', top: h.y - hit / 2 + 'px', width: hit + 'px', height: hit + 'px' });
        h.el.style.setProperty('--s', s + 'px');
        h.el.style.setProperty('--ring', Math.round(h.r * 2.9 + 8) + 'px');
      });
      tapes.forEach(({ i, el: t }) => {
        const h = holds[i];
        if (i === TOP) Object.assign(t.style, { left: Math.max(4, h.x - h.r * 1.6 - 34) + 'px', top: h.y - 8 + 'px' });
        else Object.assign(t.style, { left: h.x - 6 + 'px', top: h.y + h.r * 1.1 + 4 + 'px' });
      });
      // Decor fills the wall but keeps off the route.
      const x0 = G.colL - 10, x1 = G.colR + 10, y0 = holds[TOP].y - 10, y1 = G.matTop - 24;
      decos.forEach((d) => {
        const r = G.base * d.K.r * d.s;
        const x = lerp(x0, x1, d.fx), y = lerp(y0, y1, d.fy);
        const clash = holds.some((h) => Math.hypot(h.x - x, h.y - y) < h.r * 1.6 + r * 1.6 + G.base * 1.4);
        d.el.hidden = clash || x < 6 || x > G.vw - 6;
        const s = r * 3.4;
        Object.assign(d.el.style, { left: x - s / 2 + 'px', top: y - s / 2 + 'px', width: s + 'px', height: s + 'px', rotate: d.rot + 'deg' });
        d.el.style.setProperty('--s', s + 'px');
      });
      dring.style.width = dring.style.height = '0px';
    }

    // ---- State -------------------------------------------------------------
    const S = {
      phase: 'intro',
      hands: { l: { hold: 0, p: { x: 0, y: 0 }, anim: null, free: null }, r: { hold: 1, p: { x: 0, y: 0 }, anim: null, free: null } },
      head: { x: 0, y: 0, vx: 0, vy: 0, rot: 0, vr: 0, scale: 1 },
      grip: 100, tries: 1, t0: 0, tEnd: 0, check: null, said: {}, drag: null, dyno: null, fallAt: 0, landed: false, bits: []
    };
    const hold = (k) => holds[S.hands[k].hold];
    // Where a hand grips: matched hands sit side by side on the hold.
    function spot(k, i) {
      const h = holds[i];
      if (S.hands[k === 'l' ? 'r' : 'l'].hold !== i) return { x: h.x, y: h.y };
      return { x: h.x + (k === 'l' ? -1 : 1) * h.r * 0.6, y: h.y };
    }
    const rest = () => restOf(hold('l'), hold('r'));

    // Faces swap whole photos, like the floating head. Temporary ones fall back.
    let face = 'neutral', faceTimer = 0, nextBlink = 0;
    function setFace(name, ms) {
      clearTimeout(faceTimer);
      timers.delete(faceTimer);
      if (ms) faceTimer = later(() => setFace(S.phase === 'sent' ? 'happy' : 'neutral'), ms);
      if (name === face) return;
      face = name;
      faceImgs.forEach((img) => { img.hidden = img.dataset.f !== name; });
    }
    function grip(k, g) {
      handEl[k].querySelectorAll('img').forEach((img) => { img.hidden = img.dataset.g !== g; });
    }

    // Speech: a bubble beside the head, the mouth flaps while it lasts.
    let sayTimer = 0, talkUntil = 0, sayW = 0, sayH = 0;
    function say(text, ms) {
      if (!text) return;
      sayEl.textContent = text;
      sayW = sayEl.offsetWidth;
      sayH = sayEl.offsetHeight;
      sayEl.classList.add('on');
      talkUntil = now() + Math.min(1400, text.length * 55);
      clearTimeout(sayTimer);
      timers.delete(sayTimer);
      sayTimer = later(() => sayEl.classList.remove('on'), ms || 1500 + text.length * 40);
    }
    function once(key, text, ms) {
      if (S.said[key]) return;
      S.said[key] = true;
      say(text, ms);
    }

    // ---- Moving ------------------------------------------------------------
    function startClock() { if (!S.t0) S.t0 = now(); }
    function plan(i, k) {
      const { l, r } = S.hands;
      if (l.hold === i && r.hold === i) return null;
      if (!k) k = beta(l.hold, r.hold, i);
      return reachOf(i, k);
    }
    // The crux can't be skipped: from under it, hold 7 is a dyno and
    // everything above it is out of reach.
    function reachOf(i, k) {
      const d = dist(rest(), holds[i]);
      const under = Math.max(S.hands.l.hold, S.hands.r.hold) < DYNO;
      let kind = d <= G.reach ? 'reach' : 'far';
      if (under && i === DYNO) kind = d <= G.jump ? 'dyno' : 'far';
      else if (under && i > DYNO) kind = 'far';
      return { k, d, kind };
    }
    function tryMove(i, k, from) {
      if (S.phase !== 'climb') return;
      const p = plan(i, k);
      if (!p) return snapBack(k, from);
      if (p.kind === 'reach') return reachTo(p.k, i, p.d, from);
      if (p.kind === 'dyno') { snapBack(p.k, from); return dyno(p.k, i); }
      snapBack(k, from);
      tooFar(i);
    }
    function snapBack(k, from) {
      if (!k || !from) return;
      const H = S.hands[k];
      H.anim = { from, to: spot(k, H.hold), t0: now(), dur: reduce ? 1 : 160, arc: 0, done: () => grip(k, 'fist') };
    }
    function tooFar(i) {
      const e = holds[i].el;
      if (!reduce) e.animate([{ translate: '0 0' }, { translate: '-4px 0' }, { translate: '4px 0' }, { translate: '-2px 0' }, { translate: '0 0' }], { duration: 280 });
      if (now() - (S.farAt || 0) > 2500) { S.farAt = now(); say(pick(SAY.far)); }
      setFace('sad', 700);
    }
    function reachTo(k, i, d, from) {
      startClock();
      S.phase = 'move';
      const H = S.hands[k];
      const other = S.hands[k === 'l' ? 'r' : 'l'];
      const fromP = from || { x: H.p.x, y: H.p.y };
      const cost = other.hold === i ? 3 : 4 + (6 * d) / G.reach + holds[i].K.cost;
      grip(k, 'palm');
      const len = dist(fromP, holds[i]);
      H.anim = { from: fromP, to: spot(k, i), t0: now(), dur: reduce ? 1 : clamp(190 + len * 0.7, 220, 420), arc: Math.min(28, len * 0.16), done: () => land(k, i, cost) };
      refresh();
    }
    function land(k, i, cost) {
      if (S.phase === 'off') return;
      const H = S.hands[k];
      H.hold = i;
      grip(k, 'fist');
      if (!reduce) handEl[k].animate([{ scale: '1.18' }, { scale: '1' }], { duration: 160, easing: 'ease-out' });
      S.grip -= cost;
      if (S.grip <= 0) { S.grip = 0; return fall('pump'); }
      S.phase = 'climb';
      const h = holds[i];
      if (S.hands.l.hold === TOP && S.hands.r.hold === TOP) return send();
      if (h.K.rest) {
        S.check = i;
        if (S.grip < 80 || !S.said['jug' + i]) { S.said['jug' + i] = true; say(pick(SAY.jug)); setFace('happy', 900); }
      } else if (i === TOP) once('match', SAY.match, 2600);
      else if (h.kind === 'crimp' && Math.random() < 0.5) once('crimp', pick(SAY.crimp));
      else if (h.kind === 'sloper' && Math.random() < 0.5) once('sloper', pick(SAY.sloper));
      refresh();
      follow();
    }

    // The dyno: the ring closes on the hold, tap when they meet. A tap anywhere
    // counts, timed from when it went down. A finger has to lift where it
    // landed, so a swipe or a scroll isn't a jump. After it's decided the layer
    // stays a beat (soak) so a late tap doesn't land on a link under the wall.
    let catcher = null, press = null, soak = null;
    function dyno(k, i) {
      startClock();
      S.phase = 'dyno';
      const first = !S.said.dynoHow;
      S.said.dynoHow = true;
      say(first ? SAY.dyno : pick(SAY.dynoAgain), first ? 3000 : 1300);
      const t = now() + (first ? 1100 : 450);
      const dur = reduce ? 1500 : 1000;
      S.dyno = { k, i, t0: t, T: t + dur, win: reduce ? 210 : 140 };
      holds[i].el.classList.add('aim');
      const ring = Math.round(holds[i].r * 2.9 + 8);
      Object.assign(dring.style, { width: ring + 'px', height: ring + 'px', margin: `${-ring / 2}px 0 0 ${-ring / 2}px`, opacity: '0' });
      if (soak) { soak.remove(); soak = null; }
      press = null;
      catcher = document.createElement('div');
      catcher.className = 'climb-catch';
      catcher.setAttribute('aria-hidden', 'true');
      catcher.addEventListener('pointerdown', catchDown);
      catcher.addEventListener('pointermove', catchMove);
      catcher.addEventListener('pointerup', catchUp);
      catcher.addEventListener('pointercancel', () => { press = null; });
      document.body.appendChild(catcher);
      refresh();
    }
    function catchDown(e) {
      if (e.button) return;
      if (e.pointerType === 'mouse') { e.preventDefault(); dynoTap(now()); return; }
      press = { id: e.pointerId, x: e.clientX, y: e.clientY, t: now() };
    }
    function catchMove(e) {
      if (press && e.pointerId === press.id && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 10) press = null;
    }
    function catchUp(e) {
      const p = press;
      press = null;
      if (!p || e.pointerId !== p.id || Math.hypot(e.clientX - p.x, e.clientY - p.y) > 10 || now() - p.t > 450) return;
      dynoTap(p.t);
    }
    function dynoTap(at) {
      const d = S.dyno;
      if (!d || at < d.t0) return;
      const off = at - d.T;
      dynoGo(Math.abs(off) <= d.win, off);
    }
    function dynoDone() {
      press = null;
      if (catcher) {
        if (soak) soak.remove();
        soak = catcher;
        catcher = null;
        later(() => { if (soak) { soak.remove(); soak = null; } }, 450);
      }
      if (S.dyno) holds[S.dyno.i].el.classList.remove('aim');
      dring.style.opacity = '0';
      S.dyno = null;
    }
    function dynoGo(ok, off) {
      const { k, i } = S.dyno;
      dynoDone();
      S.phase = 'move';
      const H = S.hands[k];
      const to = holds[i];
      grip(k, 'palm');
      if (!reduce) S.head.vy -= 650;
      if (ok) {
        H.anim = { from: { x: H.p.x, y: H.p.y }, to, t0: now(), dur: reduce ? 1 : 190, arc: 8, done: () => {
          land(k, i, 14 + to.K.cost);
          if (S.phase === 'climb') { say(pick(SAY.caught)); setFace('happy', 1100); }
        } };
      } else {
        const short = { x: lerp(H.p.x, to.x, 0.7), y: lerp(H.p.y, to.y, 0.7) };
        H.anim = { from: { x: H.p.x, y: H.p.y }, to: short, t0: now(), dur: reduce ? 1 : 190, arc: 8, done: () => fall(off < 0 ? 'early' : 'late') };
      }
    }

    // ---- Falling, getting back on, sending -----------------------------------
    function fall(why) {
      if (S.phase === 'fall' || S.phase === 'sent' || S.phase === 'off') return;
      dynoDone();
      endDrag();
      S.phase = 'fall';
      S.fallAt = now();
      S.landed = false;
      setFace(why === 'pump' ? 'sad' : 'angry', why === 'pump' ? 0 : 500);
      if (why !== 'pump') later(() => { if (S.phase === 'fall') setFace('sad'); }, 520);
      say(why === 'pump' ? pick(SAY.pumped) : why === 'early' ? SAY.early : why === 'late' ? SAY.late : SAY.slip, 1300);
      ['l', 'r'].forEach((k, n) => {
        const H = S.hands[k];
        H.anim = null;
        grip(k, 'palm');
        H.free = { x: H.p.x, y: H.p.y, vx: (n ? 1 : -1) * (40 + Math.random() * 60), vy: -80 - Math.random() * 80, rot: 0, vr: (n ? 1 : -1) * 240, down: false };
      });
      S.head.vx = (Math.random() - 0.5) * 80;
      S.head.vy = Math.min(S.head.vy, 0) - 60;
      S.head.vr = (Math.random() < 0.5 ? -1 : 1) * 90;
      S.head.down = false;
      refresh();
      if (reduce) {
        S.head.y = G.floor - G.hh / 2;
        ['l', 'r'].forEach((k) => { S.hands[k].free.y = G.floor; S.hands[k].free.down = true; });
      }
      scrollTo({ top: clamp(G.matTop + 30 + G.hud - innerHeight, 0, Math.max(0, G.wallH - innerHeight)), behavior: reduce ? 'instant' : 'smooth' });
    }
    function onMat() {
      if (S.landed) return;
      S.landed = true;
      later(() => { if (S.phase === 'fall') say(pick(SAY.mat), 1200); }, 250);
      later(respawn, 1500);
    }
    function respawn() {
      if (S.phase !== 'fall') return;
      S.tries++;
      S.grip = 100;
      S.said.pump = S.said.match = false;
      const c = S.check;
      S.hands.l.hold = c == null ? 0 : c;
      S.hands.r.hold = c == null ? 1 : c;
      ['l', 'r'].forEach((k) => {
        const H = S.hands[k];
        H.free = null;
        H.anim = null;
        H.p = spot(k, H.hold);
        grip(k, 'fist');
      });
      const r = rest();
      Object.assign(S.head, { x: r.x, y: r.y + 20, vx: 0, vy: 0, rot: 0, vr: 0 });
      if (!reduce) [head, handEl.l, handEl.r].forEach((e) => e.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' }));
      setFace('neutral');
      S.phase = 'climb';
      refresh();
      follow(true);
      say(c == null ? pick(SAY.again) : pick(SAY.back), 1300);
    }
    function send() {
      S.phase = 'sent';
      S.tEnd = now();
      setFace('happy');
      say(SAY.sent, 4500);
      refresh();
      confetti();
      if (!reduce) { S.head.vy -= 420; later(() => { S.head.vy -= 360; }, 520); }
      const ms = S.tEnd - S.t0;
      let best = null, prior = null;
      try {
        prior = parseFloat(localStorage.getItem('dl-climb-best')) || null;
        best = prior && prior <= ms ? prior : ms;
        if (best === ms) localStorage.setItem('dl-climb-best', String(Math.round(ms)));
      } catch (e) { /* no storage, no best */ }
      lastResult = sentRun = { ms, tries: S.tries, best, prior, isBest: best === ms };
      if (window.dlFound) window.dlFound('climb');
      hud.className = 'climb-hud done';
      hud.innerHTML = cardHTML(lastResult, false);
      hud.querySelector('[data-go]').addEventListener('click', () => reset('again'));
      hud.querySelector('[data-done]').addEventListener('click', () => end(true));
      hudBits = null;
      hud.querySelector('[data-go]').focus({ preventScroll: true });
    }
    function confetti() {
      if (reduce) return;
      const t = S.head;
      for (let n = 0; n < 44; n++) {
        const e = document.createElement('i');
        e.className = 'climb-bit';
        e.style.background = BITS[n % BITS.length];
        wall.appendChild(e);
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 3;
        const sp = 220 + Math.random() * 380;
        S.bits.push({ el: e, x: t.x, y: t.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: Math.random() * 360, vr: (Math.random() - 0.5) * 900, t: 0, life: 1.3 + Math.random() * 0.9 });
      }
    }

    // ---- Showing what's in reach -------------------------------------------
    function refresh() {
      const live = S.phase === 'climb';
      const hd = rest();
      const L = S.hands.l.hold, R = S.hands.r.hold;
      holds.forEach((h, i) => {
        const held = L === i || R === i;
        const both = L === i && R === i;
        const kind = reachOf(i).kind;
        const can = live && !both && kind === 'reach' && (!held || i === TOP);
        const dy = live && !held && kind === 'dyno';
        h.el.classList.toggle('in', can);
        h.el.classList.toggle('dy', dy);
        h.el.classList.toggle('far', live && !held && !can && !dy);
        h.el.setAttribute('aria-label', h.K.name + (i === TOP ? ', top' : '') + (held ? ', holding' : can ? ', in reach' : dy ? ', dyno' : ', out of reach'));
      });
      reachEl.classList.toggle('off', !live);
      reachEl.style.transform = `translate3d(${hd.x}px,${hd.y}px,0)`;
    }
    // Keep the head and every hold it can go for between the top bar and the
    // HUD (and down to `low`, a page y, when given), so the next move always
    // shows. Moves only when something's cut off.
    function follow(force, low) {
      const r = rest();
      let hi = r.y - G.hh * 0.5;
      const lo = Math.max(r.y + G.hh * 0.6, low || 0);
      holds.forEach((h) => { if (reachOf(h.i).kind !== 'far') hi = Math.min(hi, h.y - h.r * 2.4); });
      const top = G.bar + 12, bot = innerHeight - G.hud - 12;
      if (!force && hi - scrollY >= top && lo - scrollY <= bot) return;
      const fits = lo - hi <= bot - top;
      const want = clamp(fits ? (hi + lo) / 2 - (top + bot) / 2 : hi - top, 0, Math.max(0, document.documentElement.scrollHeight - innerHeight));
      if (Math.abs(want - scrollY) >= 4) scrollTo({ top: want, behavior: reduce ? 'instant' : 'smooth' });
    }
    // Resolves once the page has stopped scrolling, or after ms.
    function settle(ms) {
      return new Promise((done) => {
        const t0 = now();
        let y = scrollY, still = 0;
        const tick = () => {
          still = scrollY === y ? still + 1 : 0;
          y = scrollY;
          if (dead || still >= 3 || now() - t0 > ms) done(); else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    }

    // mode: 'mat' drops the head in from the crash pad, 'fly' borrows the
    // floating head (it flies onto the start holds first), 'again' swoops back
    // down from wherever it is.
    // lent: the floating head, from the moment this climb asks for it, so
    // getting off at any point gives it back. swapped: ours stands in for it.
    let taught = false, lent = null, swapped = false;
    function reset(mode) {
      dynoDone();
      endDrag();
      S.bits.forEach((b) => b.el.remove());
      Object.assign(S, { phase: 'intro', grip: 100, tries: 1, t0: 0, tEnd: 0, check: null, said: {}, landed: false, bits: [] });
      hudClimb();
      setFace('neutral');
      ['l', 'r'].forEach((k, n) => { S.hands[k].hold = n; S.hands[k].anim = null; });
      const r = rest();
      const park = (k, n, at) => {
        const H = S.hands[k];
        H.free = { x: at.x + (n ? 1 : -1) * G.hw * 0.62, y: at.y, vx: 0, vy: 0, rot: (n ? 1 : -1) * 20, vr: 0, down: true };
        H.p = { x: H.free.x, y: H.free.y };
        grip(k, 'palm');
      };
      if (mode === 'again') {
        ['l', 'r'].forEach((k) => { const H = S.hands[k]; H.free = { x: H.p.x, y: H.p.y, vx: 0, vy: 0, rot: 0, vr: 0, down: true }; grip(k, 'palm'); });
        Object.assign(S.head, { vx: 0, vy: 0, vr: 0, down: false });
        refresh();
        follow(true);
        render('climbing');
        grab(150);
        return;
      }
      Object.assign(S.head, { x: r.x, y: G.floor - G.hh / 2 + 4, vx: 0, vy: 0, rot: 0, vr: 0, down: false, scale: 1 });
      ['l', 'r'].forEach((k, n) => park(k, n, { x: r.x, y: G.floor - 4 }));
      refresh();
      follow(true, G.matTop + 22);
      const api = mode === 'fly' && headApi();
      if (!api) {
        wall.classList.add('hide-dl');
        grab(500);
        return;
      }
      lent = api;
      // Hidden until the floating head lands on the start holds, then swap.
      // It aims once the page is done scrolling there, or it lands off them.
      [head, handEl.l, handEl.r].forEach((e) => { e.style.opacity = '0'; });
      later(async () => {
        await settle(1200);
        if (dead) return;
        const at = rest();
        try { await within(api.flyTo(at.x - scrollX - G.hw / 2, at.y - scrollY - G.hh / 2, G.hw, reduce ? 0 : 850), 1800); } catch (e) { /* fall through */ }
        if (dead) return;
        let from = { x: at.x, y: at.y }, scale = 1;
        try {
          const b = api.rect && api.rect();
          if (b && b.width > 0) { from = { x: b.left + b.width / 2 + scrollX, y: b.top + b.height / 2 + scrollY }; scale = b.width / G.hw; }
        } catch (e) { /* use the target */ }
        try { api.away(true); } catch (e) { /* hidden below anyway */ }
        swapped = true;
        wall.classList.add('hide-dl');
        Object.assign(S.head, { x: from.x, y: from.y, vx: 0, vy: 0, rot: 0, vr: 0, scale: clamp(scale, 0.5, 2) });
        // Hands at hanging height, so it doesn't sag before they reach up.
        ['l', 'r'].forEach((k, n) => park(k, n, { x: from.x, y: from.y - G.hang }));
        // Drawn there before it shows, or the first frame is wherever it waited.
        pose();
        [head, handEl.l, handEl.r].forEach((e) => { e.style.opacity = ''; });
        grab(60);
      }, reduce ? 0 : 450);
    }
    // Both hands go up to the start holds, then it's on.
    function grab(delay) {
      later(() => {
        ['l', 'r'].forEach((k, n) => {
          const H = S.hands[k];
          const from = { x: H.p.x, y: H.p.y };
          H.free = null;
          H.anim = { from, to: spot(k, H.hold), t0: now() + n * 120, dur: reduce ? 1 : 380, arc: 18, done: () => grip(k, 'fist') };
        });
      }, reduce ? 0 : delay);
      later(() => { S.phase = 'climb'; refresh(); say(pick(SAY.start), 1700); }, reduce ? 60 : delay + 600);
      if (!taught) {
        taught = true;
        later(() => { if (S.phase === 'climb' && !S.t0) say(SAY.how, 4600); }, reduce ? 1900 : delay + 2400);
      }
    }

    // ---- Input ---------------------------------------------------------------
    const docPt = (e) => ({ x: e.clientX + scrollX, y: e.clientY + scrollY });
    function nearest(p) {
      let best = null, bd = Infinity;
      holds.forEach((h) => {
        const d = dist(p, h);
        if (d < h.r * 1.5 + 22 && d < bd) { bd = d; best = h.i; }
      });
      return best;
    }
    function handDown(e, k) {
      if (S.phase !== 'climb' || (e.button && e.button !== 0)) return;
      e.preventDefault();
      S.drag = { k, id: e.pointerId, x0: e.clientX, y0: e.clientY, p: { x: S.hands[k].p.x, y: S.hands[k].p.y }, moved: false, hot: null };
      try { handEl[k].setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      handEl[k].classList.add('grab');
    }
    function handMove(e) {
      const d = S.drag;
      if (!d || e.pointerId !== d.id) return;
      if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
      if (!d.moved) { d.moved = true; grip(d.k, 'palm'); }
      const p = docPt(e);
      const r = rest();
      const dd = dist(p, r);
      if (dd > G.jump) { p.x = r.x + ((p.x - r.x) * G.jump) / dd; p.y = r.y + ((p.y - r.y) * G.jump) / dd; }
      d.p = p;
      const hot = nearest(docPt(e));
      if (hot !== d.hot) {
        if (d.hot != null) holds[d.hot].el.classList.remove('hot');
        d.hot = hot;
        if (hot != null) holds[hot].el.classList.add('hot');
      }
    }
    function handUp(e) {
      const d = S.drag;
      if (!d || e.pointerId !== d.id) return;
      endDrag();
      if (S.phase !== 'climb') return;
      const pt = docPt(e);
      if (!d.moved) {
        const i = nearest(pt);
        if (i != null) tryMove(i);
        return;
      }
      const i = e.type === 'pointercancel' ? null : nearest(pt);
      if (i == null || i === S.hands[d.k].hold) return snapBack(d.k, d.p);
      tryMove(i, d.k, d.p);
    }
    function endDrag() {
      const d = S.drag;
      if (!d) return;
      S.drag = null;
      handEl[d.k].classList.remove('grab');
      if (d.hot != null) holds[d.hot].el.classList.remove('hot');
      try { handEl[d.k].releasePointerCapture(d.id); } catch (err) { /* fine */ }
    }
    holds.forEach((h) => on(h.el, 'click', () => tryMove(h.i)));
    // A tap that just misses a hold lands on the page under it, often a link.
    // Close enough counts as the hold, and the link stays put.
    on(document, 'click', (e) => {
      if (!e.isTrusted || !e.detail || S.phase === 'sent' || !e.target.closest || !e.target.closest('.page') || invite.contains(e.target)) return;
      const i = nearest(docPt(e));
      if (i == null) return;
      e.preventDefault();
      e.stopPropagation();
      tryMove(i);
    }, true);
    ['l', 'r'].forEach((k) => {
      on(handEl[k], 'pointerdown', (e) => handDown(e, k));
      on(handEl[k], 'pointermove', handMove);
      on(handEl[k], 'pointerup', handUp);
      on(handEl[k], 'pointercancel', handUp);
    });
    on(window, 'keydown', (e) => {
      if (S.dyno && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); dynoTap(now()); }
    }, true);
    let relay = 0;
    const relayout = () => {
      clearTimeout(relay);
      timers.delete(relay);
      relay = later(() => { measure(); place(); refresh(); }, 120);
    };
    on(window, 'resize', relayout);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(relayout) : null;
    if (ro) ro.observe(document.body);

    // ---- One loop ------------------------------------------------------------
    let last = now(), mouth = 0, triesShown = 0;
    function frame(t) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.033, Math.max(0, (t - last) / 1000));
      last = t;
      const falling = S.phase === 'fall';

      ['l', 'r'].forEach((k) => {
        const H = S.hands[k];
        if (S.drag && S.drag.k === k && S.drag.moved) { H.p = S.drag.p; return; }
        if (H.anim) {
          const a = H.anim;
          const u = clamp((t - a.t0) / a.dur, 0, 1);
          const e = 1 - Math.pow(1 - u, 3);
          const lift = Math.sin(Math.PI * e) * a.arc;
          H.p = { x: lerp(a.from.x, a.to.x, e) + (k === 'l' ? -lift : lift), y: lerp(a.from.y, a.to.y, e) - lift * 0.4 };
          if (u >= 1) {
            H.anim = null;
            H.p = { x: a.to.x, y: a.to.y };
            if (a.done) a.done();
          }
          return;
        }
        if (H.free) {
          const F = H.free;
          if (falling && !F.down) {
            F.vy += 2600 * dt;
            F.x += F.vx * dt;
            F.y += F.vy * dt;
            F.rot += F.vr * dt;
            if (F.y >= G.floor) {
              F.y = G.floor;
              if (F.vy > 320) { F.vy *= -0.25; F.vx *= 0.5; } else { F.down = true; F.vy = 0; }
            }
          }
          H.p = { x: F.x, y: F.y };
          return;
        }
        const g = spot(k, H.hold);
        const ease = reduce ? 1 : Math.min(1, dt * 18);
        H.p = { x: lerp(H.p.x, g.x, ease), y: lerp(H.p.y, g.y, ease) };
      });

      const hd = S.head;
      const L = S.hands.l.p, R = S.hands.r.p;
      if (falling) {
        const fl = G.floor - G.hh / 2 + 4;
        if (!hd.down) {
          hd.vy += 2600 * dt;
          hd.x += hd.vx * dt;
          hd.y += hd.vy * dt;
          hd.rot += hd.vr * dt;
          if (hd.y >= fl) {
            hd.y = fl;
            if (hd.vy > 320) { hd.vy *= -0.3; hd.vr *= 0.5; } else { hd.down = true; hd.vy = 0; hd.vr = 0; }
          }
        } else {
          const lie = hd.rot >= 0 ? 16 : -16;
          hd.rot += (lie - hd.rot) * Math.min(1, dt * 6);
        }
        const fl2 = S.hands.l.free, fr2 = S.hands.r.free;
        if (!S.landed && hd.down && (!fl2 || fl2.down) && (!fr2 || fr2.down)) onMat();
        if (!S.landed && t - S.fallAt > 2600) onMat();
      } else {
        let tx = (L.x + R.x) / 2;
        let ty = Math.max(L.y, R.y) * 0.6 + Math.min(L.y, R.y) * 0.4 + G.hang;
        ty = Math.min(ty, G.floor - G.hh / 2 + 4);
        if (S.dyno) ty += 12 * clamp((t - S.dyno.t0 + 400) / (S.dyno.T - S.dyno.t0 + 400), 0, 1);
        if (!reduce) tx += Math.sin(t / 900) * 2;
        if (reduce) { hd.x = tx; hd.y = ty; hd.vx = hd.vy = 0; } else {
          hd.vx += ((tx - hd.x) * 140 - hd.vx * 13) * dt;
          hd.vy += ((ty - hd.y) * 140 - hd.vy * 13) * dt;
          hd.x += hd.vx * dt;
          hd.y += hd.vy * dt;
        }
        const tilt = clamp((L.y - R.y) * 0.08, -12, 12) + (reduce ? 0 : clamp(hd.vx * 0.02, -10, 10));
        hd.rot += (tilt - hd.rot) * Math.min(1, dt * 10);
      }

      // Grip: hanging costs a little, jugs give it back. Nothing until the first move.
      if (S.t0 && (S.phase === 'climb' || S.phase === 'move' || S.phase === 'dyno')) {
        S.grip = clamp(S.grip - (hold('l').K.drain + hold('r').K.drain) * dt, 0, 100);
        if (S.grip > 60) S.said.pump = false;
        if (S.grip < 30 && S.phase === 'climb' && !S.said.pump) { S.said.pump = true; say(pick(SAY.pump)); setFace('sad', 1500); }
        if (S.grip <= 0 && S.phase === 'climb') fall('pump');
      }

      if (S.dyno && t >= S.dyno.t0) {
        const d = S.dyno, h = holds[d.i];
        const u = (t - d.t0) / (d.T - d.t0);
        const ring = (h.r * 2.9 + 8) * Math.max(0.4, 1 + (1 - u) * 1.8);
        Object.assign(dring.style, {
          width: ring + 'px', height: ring + 'px', margin: `${-ring / 2}px 0 0 ${-ring / 2}px`,
          transform: `translate3d(${h.x}px,${h.y}px,0)`,
          opacity: String(clamp(u * 4, 0, 1) * (u > 1 ? clamp(1 - (u - 1) * 5, 0, 1) : 1))
        });
        // A finger that went down in time gets to lift before it counts as late.
        const held = press && press.t <= d.T + d.win && t - press.t < 450;
        if (t > d.T + d.win && !held) dynoGo(false, t - d.T);
      }

      for (let n = S.bits.length - 1; n >= 0; n--) {
        const b = S.bits[n];
        b.t += dt;
        b.vy += 700 * dt;
        b.vx *= 1 - dt * 0.8;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.r += b.vr * dt;
        b.el.style.transform = `translate3d(${b.x}px,${b.y}px,0) rotate(${b.r}deg)`;
        b.el.style.opacity = String(clamp((b.life - b.t) / 0.4, 0, 1));
        if (b.t >= b.life) { b.el.remove(); S.bits.splice(n, 1); }
      }

      // Draw.
      if (hd.scale !== 1) hd.scale = Math.abs(1 - hd.scale) < 0.01 || reduce ? 1 : hd.scale + (1 - hd.scale) * Math.min(1, dt * 6);
      pose();
      const open = t < talkUntil ? Math.abs(Math.sin(t / 75)) * 0.85 : 0;
      mouth += (open - mouth) * 0.5;
      sk.style.transform = `translateY(${(-mouth * 13).toFixed(2)}%) rotate(${(-mouth * 5).toFixed(2)}deg)`;
      jw.style.transform = `translateY(${(mouth * 3).toFixed(2)}%)`;
      if (t > nextBlink) {
        nextBlink = t + (Math.random() < 0.2 ? 260 : 2200 + Math.random() * 3800);
        if (face === 'neutral') setFace('blink', 120);
      }
      if (sayEl.classList.contains('on')) {
        let x = hd.x + G.hw / 2 + 4, y = hd.y - G.hh / 2 - sayH * 0.4, left = false;
        if (x + sayW > G.vw - 8) {
          x = hd.x - G.hw / 2 - 4 - sayW;
          left = true;
          if (x < 8) { x = clamp(hd.x - sayW / 2, 8, G.vw - 8 - sayW); y = hd.y - G.hh / 2 - sayH - 8; }
        }
        sayEl.classList.toggle('left', left);
        sayEl.style.transform = `translate3d(${x}px,${Math.max(4, y)}px,0)`;
      }

      if (hudBits) {
        const ts = clock(S.t0 ? (S.tEnd || t) - S.t0 : 0);
        if (ts !== lastTime) { lastTime = ts; hudBits.time.textContent = ts; }
        const g = Math.round(S.grip);
        if (g !== lastGrip) {
          lastGrip = g;
          hudBits.bar.style.transform = `scaleX(${g / 100})`;
          hudBits.meter.setAttribute('aria-valuenow', g);
          hud.classList.toggle('low', g < 30);
        }
        if (triesShown !== S.tries) { triesShown = S.tries; hudBits.tries.textContent = 'Try ' + S.tries; }
      }
    }

    // Head and hands where the state has them.
    function pose() {
      const hd = S.head;
      head.style.transform = `translate3d(${hd.x - G.hw / 2}px,${hd.y - G.hh / 2}px,0) rotate(${hd.rot.toFixed(2)}deg) scale(${hd.scale.toFixed(3)})`;
      const shake = S.phase === 'climb' && S.grip < 25 && !reduce ? (1 - S.grip / 25) * 1.8 : 0;
      ['l', 'r'].forEach((k) => {
        const H = S.hands[k];
        const x = H.p.x + (shake ? (Math.random() - 0.5) * shake * 2 : 0);
        const y = H.p.y + (shake ? (Math.random() - 0.5) * shake * 2 : 0);
        const ax = FIST.at[0] * G.nw, ay = FIST.at[1] * G.nh;
        const ang = H.free ? H.free.rot : clamp((Math.atan2(-(hd.x - x), hd.y - y) * 180) / Math.PI, -70, 70);
        handEl[k].style.transformOrigin = `${ax}px ${ay}px`;
        handEl[k].style.transform = `translate3d(${x - ax}px,${y - ay}px,0) rotate(${ang.toFixed(2)}deg)`;
      });
    }

    // ---- Off the wall ------------------------------------------------------
    // user: they got off (Exit, Done, Esc, Stop). Otherwise the page is going away.
    function end(user) {
      if (dead) return;
      dead = true;
      S.phase = 'off';
      cancelAnimationFrame(raf);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      off.forEach((fn) => fn());
      if (ro) ro.disconnect();
      if (catcher) catcher.remove();
      if (soak) soak.remove();
      wall.remove();
      hud.remove();
      game = null;
      // Hand the head back, wherever it got to: if ours took over, the floating
      // one appears where ours is first. Mid-flight it just turns around.
      // keep: it's itself again, not a new game. game_end goes before home(),
      // which would otherwise close the game without a result.
      if (lent && swapped) {
        try { lent.flyTo(S.head.x - scrollX - G.hw / 2, S.head.y - scrollY - G.hh / 2, G.hw, 0, { keep: true }); } catch (e) { /* it still goes home */ }
      }
      const bus = window.dlBus;
      if (bus && typeof bus.emit === 'function') {
        try { bus.emit('game_end', { game: 'climb', result: score() }); } catch (e) { /* fine */ }
      }
      if (lent) {
        try { lent.away(false); } catch (e) { /* home shows it too */ }
        try { if (lent.home) lent.home(); } catch (e) { /* fine */ }
      }
      if (user) {
        render('idle', true);
        const b = invite.getBoundingClientRect();
        if (b.top < G.bar || b.bottom > innerHeight - 16) invite.scrollIntoView({ block: 'center', behavior: reduce ? 'instant' : 'smooth' });
      }
    }
    // The last send this time on the wall, else how far this go got.
    function score() {
      let best = null;
      try { best = parseFloat(localStorage.getItem('dl-climb-best')) || null; } catch (e) { /* no storage, no best */ }
      if (sentRun) return { sent: true, ms: Math.round(sentRun.ms), tries: sentRun.tries, best };
      return { sent: false, ms: S.t0 ? Math.round(now() - S.t0) : 0, tries: S.tries, best };
    }

    on(window, 'keydown', (e) => { if (e.key === 'Escape') end(true); }, true);
    // The page's own copy changes size first, so the route is measured off the final page.
    render('climbing');
    measure();
    place();
    reset(headApi() ? 'fly' : 'mat');
    raf = requestAnimationFrame(frame);
    return { end };
  }

  return function stop() {
    if (game) game.end(false);
    invite.removeEventListener('click', onGo);
    invite.remove();
    dropStyle();
  };
}
