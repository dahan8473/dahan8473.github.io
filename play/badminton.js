/* Badminton against the head. Loaded by site.js on /hobbies/badminton/.
   mount(el) puts an invite in el and returns a cleanup function.

   Side view of a singles court: you on the left, the head on the right, the
   net in the middle. The shuttle flies on real-ish physics: quadratic drag
   with a low terminal speed, so it leaves the racket fast, dies, and falls
   steeply, and it flips so the cork leads. Physics runs in fixed steps on a
   game clock (pausing is just not advancing it), a little under real time.

   You move and time the swing. The shot picks itself from where you meet the
   shuttle: high and close to the net smashes, high at the back clears, low at
   the net plays a net shot, low at the back lifts, chest height drives. Hold
   up for a clear or down for a drop to override it. Swinging a beat before
   it reaches you hits it clean; early or late and it wobbles.
   The head plans its intercept from the same physics, so it reads the shot
   exactly but has to get there, and it misjudges and mishits now and then,
   less as a rally goes on. Rally scoring, first to 7.

   The site's floating head is the opponent: through window.dlHead (talk.js)
   it flies onto the court, this one takes over, and it flies home after.
   Without that API the floating head just hides while you play. */

const HEAD = { w: 269, h: 344 };
const FACES = {
  neutral: '/media/head.webp',
  blink: '/media/head-blink.webp',
  happy: '/media/head-happy.webp',
  sad: '/media/head-sad.webp',
  angry: '/media/head-angry.webp'
};
const FIST = { src: '/media/hands/fist.webp', w: 300, h: 400 };

const WIN = 7;
const COURT = 6.7; // back line, metres from the net
const SHORT = 1.98; // short service line
const NET = 1.55;
const NET_LOW = 0.79; // bottom of the mesh
const G = 9.8;
const VT = 7.6; // a shuttle's terminal speed, why it dies so fast
const KD = G / (VT * VT);
const STEP = 1 / 240;
const TS = 0.88; // the game runs a bit under real time so it's playable
const BEST_KEY = 'dl-badminton-best';

// Shots: launch angle (degrees above flat) and where they land, in metres past the net.
const SHOTS = {
  clear: { ang: 42, depth: [5.5, 6.4] },
  lift: { ang: 50, depth: [5.0, 6.3] },
  drop: { ang: 2, depth: [0.9, 2.1] },
  net: { ang: 38, depth: [0.45, 1.35] },
  drive: { ang: 3, depth: [4.4, 6.1] },
  smash: { v: 40, depth: [3.0, 5.8] },
  serveHigh: { ang: 52, depth: [5.7, 6.4] },
  serveShort: { ang: 24, depth: [2.25, 2.9] }
};

// Everything the head says. David's texting voice: lowercase, short, no em dashes.
const L = {
  hello: ['ok rally with me', 'first to 7. go easy on me', "ok let's hit"],
  yourServe: ['your serve', 'you serve first', 'serve whenever'],
  myServe: ['my serve', 'ok my serve', 'serving'],
  wait: ["whenever you're ready", "serve's yours", 'take your time'],
  smashYou: ['ok that smash 😭', 'too fast', "i didn't even see that", 'that had some wrist on it'],
  dropYou: ['ok ok nice drop shot', 'the drop 😭', 'i was way too far back', 'sneaky'],
  netYou: ['net shot!! clean', 'so tight at the net', "can't get that one"],
  clearYou: ['that went so deep', 'ok nice length', 'pushed me all the way back'],
  driveYou: ['that drive was flat', 'too quick for me', 'ok flat and fast'],
  tooGood: ['nope, too good', "couldn't get there", 'my legs said no'],
  headOut: ['that was out. i think. probably', "ok that's long", 'out. my bad', 'too much wrist lol'],
  headNet: ['into the net 😭', 'net. classic me', 'the tape got me', 'ugh net'],
  badLeave: ['wait that was in??', 'i thought that was going out 😭', 'bad leave, my fault'],
  goodLeave: ['out!', 'watched that one go out', 'long, my point i think'],
  headSmash: ['my smash is all wrist lol', 'sorry that one was fast', 'ok i had to'],
  headDrop: ['drop shot 👀', 'got you at the net', 'soft hands. kind of'],
  headWin: ['my point', 'lucky', 'phew', "ok i'll take it"],
  youOut: ['long!', 'just out i think', 'out. close though'],
  youNet: ['net', 'tape 😭', 'unlucky'],
  youShort: ["short serve, didn't reach the line", 'serve was short'],
  youMissed: ['swing a bit earlier', 'almost had it', 'so close'],
  long: ['this rally 😭', 'my legs', 'ok this is a real rally', "i'm so tired lol"],
  newBest: ['new best rally!!', "that's our longest one"],
  matchWin: ['good game. you got me', "ok you're better than me lol", "gg. don't tell my club"],
  matchLose: ['gg!! run it back?', 'i got lucky. again?', 'good game though. one more?'],
  paused: ['water break', 'take your time', 'tying my shoes']
};

const CSS = `
.bad, .bad-over { --bad-a: #88c0d0; color: var(--t1); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.bad { position: relative; max-width: 760px; }
:is(.bad, .bad-over) [hidden] { display: none !important; }
/* In the page: an empty court. The head waits in its corner until you rally. */
.bad-start { position: relative; isolation: isolate; display: grid; place-items: center; min-height: clamp(250px, 32vw, 300px); padding: 28px 20px 84px; border-radius: 16px; background: var(--fill); overflow: hidden; text-align: center; }
.bad-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 44px; background: var(--fill); }
.bad-floor::before { content: ''; position: absolute; left: 6%; right: 6%; top: 0; height: 1.5px; background: var(--t3); }
.bad-net { position: absolute; left: 50%; bottom: 44px; width: 6px; height: 26px; margin-left: -3px; border: 1px solid var(--t3); border-top: 2.5px solid var(--t2); border-bottom: 0; background: repeating-linear-gradient(45deg, transparent 0 2px, var(--rule) 2px 3px); }
.bad-start-in { position: relative; z-index: 1; }
.bad-start .h { font-weight: 500; }
.bad-start .p { max-width: 30em; margin-top: 2px; color: var(--t2); }
.bad-start .bad-go { margin-top: 18px; }
.bad-start .s { min-height: 1.45em; margin-top: 12px; color: var(--t3); font-size: 13px; line-height: 1.45; }
/* The game: over the whole page. */
.bad-over { position: fixed; inset: 0; z-index: 65; display: flex; flex-direction: column; padding: max(14px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); background: var(--bg); touch-action: none; overscroll-behavior: contain; }
.bad-over > * { flex: none; width: 100%; max-width: 1180px; margin-left: auto; margin-right: auto; }
.bad-over > .bad-court { flex: 1; min-height: 0; }
/* An older talk.js without dlHead: keep its head out of the way instead. */
body:has(.bad-over.solo) .dl { visibility: hidden; }
.bad-hud { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: end; gap: 18px; margin-bottom: 12px; }
.bad-side { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.bad-them { flex-direction: row-reverse; }
.bad-side span { color: var(--t3); font-size: 13px; white-space: nowrap; }
.bad-side b { font-size: 30px; font-weight: 500; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.bad-side i { width: 6px; height: 6px; border-radius: 50%; background: var(--bad-a); align-self: center; opacity: 0; transition: opacity 200ms ease; }
.bad-side i.on { opacity: 1; }
.bad-mid { display: flex; flex-direction: column; align-items: center; line-height: 1.2; }
.bad-mid .lab { font-size: 13px; color: var(--t3); }
.bad-mid .num { margin-top: 2px; font-size: 22px; font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.bad-mid .bst { margin-top: 1px; font-size: 12px; color: var(--t3); font-variant-numeric: tabular-nums; }
.bad-court { position: relative; isolation: isolate; border-radius: 16px; background: var(--fill); overflow: hidden; touch-action: none; cursor: pointer; }
.bad-court > * { position: absolute; left: 0; top: 0; }
.bad-cv { display: block; width: 100%; height: 100%; }
.bad-pop { z-index: 3; font-size: 13px; line-height: 1; color: var(--t2); white-space: nowrap; pointer-events: none; }
.bad-pop.good { color: var(--t1); font-weight: 500; }
.bad-say { z-index: 4; width: max-content; max-width: min(230px, 60%); padding: 7px 12px; border-radius: 14px; background: var(--talk-paper, var(--bg)); color: var(--talk-ink, var(--t1)); box-shadow: 0 0 0 1px var(--rule), 0 10px 28px -14px rgba(0, 0, 0, 0.3); font-size: 14px; line-height: 1.35; opacity: 0; transition: opacity 160ms ease; pointer-events: none; }
.bad-say.on { opacity: 1; }
.bad-big { z-index: 4; width: 100%; top: 16%; margin-top: -0.7em; text-align: center; font-size: 26px; font-weight: 500; letter-spacing: -0.02em; opacity: 0; transition: opacity 180ms ease; pointer-events: none; }
.bad-big.on { opacity: 1; }
.bad-big small { display: block; margin-top: 6px; font-size: 14px; font-weight: 400; letter-spacing: 0; color: var(--t2); }
.bad-card { z-index: 6; top: 50%; left: 50%; width: max-content; max-width: calc(100% - 28px); padding: 20px 28px 18px; border-radius: 16px; background: var(--panel); box-shadow: 0 0 0 1px var(--rule), 0 18px 40px -22px rgba(0, 0, 0, 0.35); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); text-align: center; transform: translate(-50%, -50%); cursor: default; }
.bad-card .h { color: var(--t1); font-size: 20px; font-weight: 500; letter-spacing: -0.01em; }
.bad-card .p { margin-top: 2px; color: var(--t2); }
.bad-card .bad-stats { display: flex; justify-content: center; gap: 16px; margin-top: 10px; color: var(--t3); font-size: 13px; font-variant-numeric: tabular-nums; }
.bad-card .bad-stats b { font-weight: 400; color: var(--t1); }
.bad-card .bad-row { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 16px; }
.bad-go { padding: 9px 26px; border: 0; border-radius: 999px; background: var(--bad-a); color: #0e1a1f; font: inherit; font-weight: 500; cursor: pointer; transition: transform 120ms ease, filter 120ms ease; }
.bad-go.big { padding: 12px 34px; font-size: 16px; }
.bad-go:hover { filter: brightness(1.06); }
.bad-go:active { transform: scale(0.97); }
:is(.bad, .bad-over) .bad-go:focus-visible { border-radius: 999px; }
.bad-alt { padding: 9px 12px; border: 0; background: none; color: var(--t2); font: inherit; cursor: pointer; }
.bad-alt:hover { color: var(--t1); }
.bad-tools { z-index: 7; top: 8px; left: auto; right: 8px; display: flex; gap: 2px; }
.bad-ic { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--t3); cursor: pointer; }
.bad-ic:hover { color: var(--t1); background: var(--rule); }
.bad-over .bad-ic:focus-visible { border-radius: 50%; }
.bad-ic svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.bad-snd .off, .bad-snd.muted .on { display: none; }
.bad-snd.muted .off { display: block; }
.bad-help { margin-top: 10px; color: var(--t3); font-size: 13px; line-height: 1.45; }
.bad-help .tc { display: none; }
@media (hover: none) and (pointer: coarse) { .bad-help .kb { display: none; } .bad-help .tc { display: inline; } }
@media (max-width: 560px) {
  .bad-hud { gap: 10px; margin-bottom: 10px; }
  .bad-side b { font-size: 26px; }
  .bad-mid .num { font-size: 20px; }
  .bad-card { padding: 18px 20px 16px; }
}
`;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));
const deg = Math.PI / 180;
const lastPicked = new WeakMap();
function pick(arr) {
  let i = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && i === lastPicked.get(arr)) i = (i + 1) % arr.length;
  lastPicked.set(arr, i);
  return arr[i];
}
// Weighted pick from { name: weight }.
function pickW(w) {
  let total = 0;
  for (const k in w) total += Math.max(0, w[k]);
  let r = Math.random() * total;
  for (const k in w) { r -= Math.max(0, w[k]); if (r <= 0) return k; }
  return Object.keys(w)[0];
}

// ---- Sound: pocks, net, floor taps and whooshes, synthesized ---------------
// Respects the site's mute (the head's speaker toggle writes dl-sound).
function makeSound() {
  let ctx = null;
  let out = null;
  let noise = null;
  const muted = () => {
    try { if (localStorage.getItem('dl-sound') === '0') return true; } catch (e) {}
    const dl = document.querySelector('.dl');
    return !!(dl && dl.classList.contains('muted'));
  };
  const live = () => ctx && ctx.state === 'running' && !muted();
  function env(g, t, vol, dur, attack = 0.003) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  const s = {
    muted,
    unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!ctx) {
        try { ctx = new AC(); } catch (e) { return; }
        out = ctx.createGain();
        out.gain.value = 0.7;
        out.connect(ctx.destination);
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    tone(f0, f1, dur, vol, type = 'sine', delay = 0) {
      if (!live()) return;
      const t = ctx.currentTime + delay;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, vol, dur);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + dur + 0.03);
    },
    hiss(dur, vol, type, f0, f1, q = 1, delay = 0) {
      if (!live()) return;
      const t = ctx.currentTime + delay;
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = noise;
      f.type = type;
      f.Q.value = q;
      f.frequency.setValueAtTime(f0, t);
      f.frequency.exponentialRampToValueAtTime(f1, t + dur);
      env(g, t, vol, dur, 0.004);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random() * 0.3);
      src.stop(t + dur + 0.03);
    },
    // Strings on cork: a short hollow pock, crisper the harder it's hit.
    pock(p = 1) {
      s.tone(1250 + 300 * p, 520, 0.035, 0.16 + 0.12 * p, 'triangle');
      s.hiss(0.028 + 0.012 * p, 0.14 + 0.16 * p, 'bandpass', 3400, 2300, 2.2);
      s.tone(420, 230, 0.05, 0.08 * p);
    },
    crack() { s.pock(1.5); s.hiss(0.05, 0.22, 'highpass', 5200, 3200, 0.8); },
    net() { s.hiss(0.18, 0.22, 'lowpass', 900, 220, 0.8); s.tone(160, 70, 0.14, 0.16); },
    floor(p = 1) { s.tone(300, 130, 0.05, 0.14 * p); s.hiss(0.035, 0.09 * p, 'bandpass', 1900, 900, 1.6); },
    whoosh(p = 1) { s.hiss(0.1 + 0.07 * p, 0.04 + 0.05 * p, 'bandpass', 520, 2600, 1.4); },
    point(good) {
      const [a, b] = good ? [587, 880] : [523, 392];
      s.tone(a, a, 0.12, 0.06, 'sine');
      s.tone(b, b, 0.2, 0.06, 'sine', 0.1);
    },
    close() {
      if (ctx) ctx.close().catch(() => {});
      ctx = out = noise = null;
    }
  };
  return s;
}

// ---- Shuttle physics ---------------------------------------------------------
// x is metres from the net (you're negative), y metres up. One fixed step:
// gravity plus drag that grows with the square of the speed.
function adv(s) {
  const v = Math.hypot(s.vx, s.vy);
  s.vx -= KD * v * s.vx * STEP;
  s.vy -= (G + KD * v * s.vy) * STEP;
  s.x += s.vx * STEP;
  s.y += s.vy * STEP;
}
// Where a shot goes: steps until it lands or meets the net. keep stores the
// path as [x0, y0, x1, y1, ...], one pair per step.
function fly(x, y, vx, vy, keep) {
  const s = { x, y, vx, vy };
  const pts = keep ? [] : null;
  let netY = null;
  for (let i = 1; i <= 1800; i++) {
    const px = s.x, py = s.y;
    adv(s);
    if ((px < 0) !== (s.x < 0)) {
      const ny = py + (s.y - py) * (px / (px - s.x));
      if (netY === null) netY = ny;
      if (ny < NET) return { end: 'net', x: 0, steps: i, netY: ny, pts };
    }
    if (keep) pts.push(s.x, s.y);
    if (s.y <= 0) return { end: 'floor', x: px + (s.x - px) * (py / (py - s.y)), steps: i, netY, pts };
  }
  return { end: 'floor', x: s.x, steps: 1800, netY, pts };
}
// Speed for a shot at a set angle to land `depth` past the net. If the net is
// in the way, the angle goes up until it clears.
function aim(x0, y0, dir, depth, ang) {
  let best = null;
  for (let a = ang; a <= 82; a += 5) {
    const cx = Math.cos(a * deg) * dir, cy = Math.sin(a * deg);
    let lo = 1, hi = 80;
    for (let i = 0; i < 20; i++) {
      const v = (lo + hi) / 2;
      const r = fly(x0, y0, cx * v, cy * v);
      const d = r.end === 'net' ? -1 : r.x * dir;
      if (d < depth) lo = v; else hi = v;
    }
    const v = (lo + hi) / 2;
    const r = fly(x0, y0, cx * v, cy * v);
    best = { vx: cx * v, vy: cy * v };
    if (r.end === 'floor' && r.netY !== null && r.netY >= NET + 0.12) return best;
  }
  return best;
}
// A smash has its speed; find the angle down that lands it at `depth`,
// flattening out if the net is in the way.
function aimSmash(x0, y0, dir, depth, v) {
  let lo = -70, hi = 12;
  for (let i = 0; i < 20; i++) {
    const a = (lo + hi) / 2;
    const r = fly(x0, y0, Math.cos(a * deg) * dir * v, Math.sin(a * deg) * v);
    const d = r.end === 'net' ? -1 : r.x * dir;
    if (d < depth) lo = a; else hi = a;
  }
  let a = (lo + hi) / 2;
  for (let k = 0; k < 14; k++) {
    const r = fly(x0, y0, Math.cos(a * deg) * dir * v, Math.sin(a * deg) * v);
    if (r.end === 'floor' && r.netY !== null && r.netY >= NET + 0.1) break;
    a += 2;
  }
  return { vx: Math.cos(a * deg) * dir * v, vy: Math.sin(a * deg) * v };
}

let styleUsers = 0;

export function mount(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let style = document.getElementById('bad-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'bad-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  styleUsers++;

  const readBest = () => { try { return parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { return 0; } };
  const root = document.createElement('div');
  root.className = 'bad';
  root.innerHTML = `
    <div class="bad-start">
      <div class="bad-floor" aria-hidden="true"></div>
      <div class="bad-net" aria-hidden="true"></div>
      <div class="bad-start-in">
        <p class="h">Rally with the head</p>
        <p class="p">First to ${WIN}, rally scoring. It'll come over when you're ready.</p>
        <button class="bad-go big" type="button">Rally</button>
        <p class="s"></p>
      </div>
    </div>`;
  el.appendChild(root);
  const startBtn = root.querySelector('.bad-go');
  const startNote = root.querySelector('.bad-start .s');
  let lastResult = '';
  function noteText() {
    const b = readBest();
    const best = b ? `Best rally: ${b} shots.` : '';
    return [lastResult, best].filter(Boolean).join(' ');
  }
  startNote.textContent = noteText();

  // The game lives in its own layer over the page, attached only while you play.
  const over = document.createElement('div');
  over.className = 'bad-over';
  over.setAttribute('role', 'dialog');
  over.setAttribute('aria-label', 'Badminton with the head');
  over.innerHTML = `
    <div class="bad-hud">
      <div class="bad-side bad-you"><span>You</span><b>0</b><i></i></div>
      <div class="bad-mid"><span class="lab">Rally</span><span class="num">0</span><span class="bst"></span></div>
      <div class="bad-side bad-them"><span>The head</span><b>0</b><i></i></div>
    </div>
    <div class="bad-court" aria-label="Badminton court">
      <canvas class="bad-cv" aria-hidden="true"></canvas>
      <div class="bad-say" aria-hidden="true"></div>
      <div class="bad-big" aria-hidden="true"></div>
      <div class="bad-card" hidden></div>
      <div class="bad-tools">
        <button class="bad-ic bad-snd" type="button" aria-label="Sound on or off">
          <svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>
          <svg class="off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>
        </button>
        <button class="bad-ic bad-x" type="button" aria-label="Stop playing"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button>
      </div>
    </div>
    <p class="sr bad-sr" aria-live="polite"></p>
    <p class="bad-help"><span class="kb">A and D or arrows to move, space or click to swing, a beat before it reaches you. Hold W for a clear, S for a drop. High and close to the net smashes.</span><span class="tc">Drag to move, tap to swing a beat before it reaches you. Flick up for a clear, down for a drop.</span></p>`;

  const $ = (q) => over.querySelector(q);
  const court = $('.bad-court');
  const cv = $('.bad-cv');
  const ctx = cv.getContext('2d');
  const sayEl = $('.bad-say');
  const srEl = $('.bad-sr');
  const big = $('.bad-big');
  const card = $('.bad-card');
  const snd = $('.bad-snd');
  const xBtn = $('.bad-x');
  const hud = {
    me: $('.bad-you b'), foe: $('.bad-them b'), meSv: $('.bad-you i'), foeSv: $('.bad-them i'),
    rally: $('.bad-mid .num'), best: $('.bad-mid .bst')
  };

  const sound = makeSound();
  const imgs = {};
  for (const f in FACES) { const i = new Image(); i.decoding = 'async'; i.src = FACES[f]; imgs[f] = i; }
  const fist = new Image();
  fist.src = FIST.src;

  // ---- Size -----------------------------------------------------------------
  // s is pixels per metre. On small screens the players and their reach grow
  // (k) so they stay readable; the court itself never changes.
  let W = 0, H = 0, dpr = 1, s = 40, ox = 0, fy = 0, k = 1, R = 1.1, RH = 1.15;
  let hwPx = 60, hhPx = 77, hwW = 1, hhW = 1.3, foeCy = 1.6, xMax = 7.6, foeMax = 7.2;
  function measure() {
    W = court.clientWidth;
    H = court.clientHeight;
    if (!W || !H) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    const floorH = clamp(H * 0.12, 26, 64);
    const half = W < 640 ? 7.35 : 8.1;
    s = Math.min(W / (half * 2), (H - floorH) / 7.2);
    ox = W / 2;
    fy = H - floorH;
    xMax = Math.min(7.6, W / 2 / s - 0.35);
    k = clamp(68 / (s * 1.75), 1, 1.7);
    R = 1.12 * k;
    RH = 1.15 * k;
    hwPx = clamp(s * 1.25, 50, 150);
    hhPx = (hwPx * HEAD.h) / HEAD.w;
    hwW = hwPx / s;
    hhW = hhPx / s;
    foeCy = Math.max(1.6, hhW / 2 + 0.55);
    foeMax = xMax - hwW * 0.45;
  }
  const PX = (x) => ox + x * s;
  const PY = (y) => fy - y * s;

  // ---- Colors ----------------------------------------------------------------
  const col = { t1: '#222', t2: '#777', t3: '#aaa', rule: '#eee', fill: '#f4f4f4', bg: '#fff', dark: false };
  function readColors() {
    const cs = getComputedStyle(over);
    for (const n of ['t1', 't2', 't3', 'rule', 'fill', 'bg']) col[n] = cs.getPropertyValue('--' + n).trim() || col[n];
    col.dark = document.documentElement.getAttribute('data-theme') === 'dark';
  }

  // ---- State -----------------------------------------------------------------
  // `clock` is game time in ms; it only moves while the game isn't paused.
  // Physics runs in STEP seconds of shuttle time, TS of a game second each.
  let clock = 0;
  let wall = 0;
  let raf = 0;
  let lastTs = 0;
  let acc = 0;
  let phase = 'idle'; // idle, enter, serve, rally, point, end
  let paused = false;
  let timers = [];
  const after = (ms, fn) => { timers.push({ at: clock + ms, fn }); };
  let score = { me: 0, foe: 0 };
  let server = 'me';
  let rally = 0;
  let gameBest = 0;
  let bestShown = false;
  let best = readBest();

  const sh = { x: 0, y: 0, vx: 0, vy: 0, ang: 0, av: 0, n: 0, last: '', kind: '', serve: false, netted: false, held: 'me', down: false, trail: [] };
  const me = { x: -2.6, vx: 0, swing: null, buffer: -1e9, jump: null, keyL: false, keyR: false, modUp: false, modDown: false, target: null, flick: '', walk: 0 };
  const foe = { x: 3.2, vx: 0, base: 3.2, plan: null, swing: null, jump: null, sqAt: -1e9 };
  const level = () => clamp(rally / 22, 0, 1) * 0.75 + clamp((score.me + score.foe) / 12, 0, 1) * 0.25;
  const other = (w) => (w === 'me' ? 'foe' : 'me');

  // Where things are, in metres. The head floats; its racket hangs off a
  // fist on its net side.
  const jumpY = (j) => {
    if (!j) return 0;
    const t = (clock - j.t0) / 440;
    return t < 0 || t > 1 ? 0 : Math.sin(t * Math.PI) * j.h;
  };
  const myShoulder = () => ({ x: me.x + 0.04 * k, y: 1.45 * k + jumpY(me.jump) });
  const foeHeadY = () => foeCy + jumpY(foe.jump) + (reduce ? 0 : Math.sin(clock / 300) * 0.04 * k);
  const foeShoulder = () => ({ x: foe.x - 0.42 * hwW, y: foeCy + jumpY(foe.jump) - 0.18 * hhW });

  // ---- Talking ---------------------------------------------------------------
  // Lines type out on wall time, so a pause doesn't freeze a sentence.
  const say = { text: '', chars: [], t0: 0, until: 0, prio: 0, shown: -1, w: 0, h: 0 };
  function speak(lines, { prio = 1, chance = 1, hold = 0 } = {}) {
    if (Math.random() > chance) return;
    const busy = wall < say.until;
    if (busy && prio < say.prio && wall - say.t0 < 1400) return;
    if (busy && prio <= 1 && wall - say.t0 < 1600) return;
    const text = Array.isArray(lines) ? pick(lines) : lines;
    say.text = text;
    say.chars = Array.from(text);
    say.t0 = wall;
    say.prio = prio;
    say.shown = -1;
    say.until = hold === Infinity ? Infinity : wall + 1200 + text.length * 45 + hold;
    sayEl.style.width = sayEl.style.height = '';
    sayEl.textContent = text;
    const box = sayEl.getBoundingClientRect();
    say.w = Math.ceil(box.width) + 1;
    say.h = Math.ceil(box.height);
    sayEl.style.width = say.w + 'px';
    sayEl.style.height = say.h + 'px';
    sayEl.textContent = '';
    if (prio >= 2) srEl.textContent = text;
  }
  function hush() { say.until = 0; }

  let faceWant = 'neutral';
  let faceUntil = 0;
  let blinkUntil = 0;
  let nextBlink = 0;
  function setFace(name, ms) { faceWant = name; faceUntil = ms ? clock + ms : Infinity; }
  function curFace() {
    let f = clock < faceUntil ? faceWant : 'neutral';
    if (f === 'neutral' && !reduce) {
      if (clock > nextBlink) { blinkUntil = clock + 120; nextBlink = clock + rand(2200, 5200); }
      if (clock < blinkUntil) f = 'blink';
    }
    return f;
  }

  // ---- Effects ---------------------------------------------------------------
  function pop(text, x, y, good) {
    const e = document.createElement('span');
    e.className = 'bad-pop' + (good ? ' good' : '');
    e.textContent = text;
    court.appendChild(e);
    const base = `translate(${clamp(PX(x), 30, W - 30).toFixed(1)}px,${clamp(PY(y), 14, H - 14).toFixed(1)}px) translate(-50%,-50%)`;
    const kf = reduce
      ? [{ transform: base, opacity: 0 }, { transform: base, opacity: 1, offset: 0.2 }, { transform: base, opacity: 0 }]
      : [{ transform: base + ' translateY(4px) scale(.9)', opacity: 0 }, { transform: base + ' scale(1)', opacity: 1, offset: 0.18 }, { transform: base + ' translateY(-22px)', opacity: 0 }];
    e.animate(kf, { duration: 950, easing: 'ease-out', fill: 'forwards' }).onfinish = () => e.remove();
  }
  function bigText(html) {
    if (html) big.innerHTML = html;
    big.classList.toggle('on', !!html);
  }
  let cardKind = '';
  let before = null;
  function showCard(kind, html) { cardKind = kind; card.innerHTML = html; card.hidden = false; }
  function hideCard() { cardKind = ''; card.hidden = true; card.innerHTML = ''; }
  function focusGo() {
    const b = card.querySelector('.bad-go');
    const a = document.activeElement;
    if (b && (!a || a === document.body || over.contains(a))) b.focus({ preventScroll: true });
  }

  // ---- Serving -----------------------------------------------------------------
  let waitAt = 0;
  let waitSaid = false;
  let firstServe = true;
  let lastServer = 'me';
  function heldAt() {
    if (sh.held === 'me') return { x: me.x + 0.4 * k, y: 1.02 * k };
    const S = foeShoulder();
    return { x: S.x - 0.2 * k, y: Math.max(0.95, S.y - 0.45 * k) };
  }
  function setupServe() {
    phase = 'serve';
    rally = 0;
    bestShown = false;
    Object.assign(sh, { held: server, serve: false, netted: false, down: false, last: '', kind: '', vx: 0, vy: 0, ang: -Math.PI / 2, av: 0 });
    sh.trail.length = 0;
    me.swing = me.jump = foe.swing = foe.jump = null;
    foe.base = server === 'foe' ? 2.7 : 3.1;
    foe.plan = { tx: foe.base, wait: 0, step: -1, vmax: 3.6 };
    const h = heldAt();
    sh.x = h.x;
    sh.y = h.y;
    waitAt = clock;
    waitSaid = false;
    if (!firstServe && server !== lastServer) speak(server === 'me' ? L.yourServe : L.myServe, { chance: 0.35 });
    lastServer = server;
    if (server === 'foe') after(rand(1300, 1900), foeServe);
    else if (firstServe) {
      firstServe = false;
      bigText(`Your serve<small>${matchMedia('(hover: none) and (pointer: coarse)').matches ? 'tap' : 'space or click'} to serve, hold ${matchMedia('(hover: none) and (pointer: coarse)').matches ? 'and flick down' : 'S'} for a short one</small>`);
      after(2600, () => { if (phase === 'serve' || phase === 'rally') bigText(''); });
    }
  }
  function serveMe() {
    const short = me.modDown || me.flick === 'drop';
    me.swing = { t0: clock - 150, kind: 'under', c: -40, prev: 0, hit: true };
    bigText('');
    sh.held = null;
    sh.serve = true;
    phase = 'rally';
    shoot('me', short ? 'serveShort' : 'serveHigh', 1);
  }
  function foeServe() {
    if (phase !== 'serve' || server !== 'foe') return;
    if (Math.abs(foe.x - foe.base) > 0.25) { after(200, foeServe); return; }
    const lv = level();
    foe.swing = { t0: clock - 150, kind: 'under', c: -40 };
    sh.held = null;
    sh.serve = true;
    phase = 'rally';
    const short = Math.random() < 0.6;
    if (Math.random() < 0.04) shootFoe(short ? 'serveShort' : 'serveHigh', short ? 1.5 : 7.1);
    else shootFoe(short ? 'serveShort' : 'serveHigh', short ? rand(2.15, 2.6 - 0.2 * lv) : rand(5.8, 6.5));
  }

  // ---- Hitting ---------------------------------------------------------------------
  function launch(who, kind, v) {
    sh.vx = v.vx;
    sh.vy = v.vy;
    sh.n = 0;
    sh.last = who;
    sh.kind = kind;
    sh.netted = false;
    if (!kind.startsWith('serve')) sh.serve = false;
    rally++;
    if (kind === 'smash') sound.crack(); else sound.pock(kind === 'drop' || kind === 'net' || kind === 'serveShort' ? 0.5 : kind === 'drive' ? 1 : 0.8);
    if (rally > best && best > 0 && !bestShown) {
      bestShown = true;
      pop('new best rally', who === 'me' ? -3.5 : 3.5, 4.2, true);
      speak(L.newBest, { prio: 2, chance: 0.7 });
    } else if (rally === 10 || rally === 16 || rally === 24 || rally === 34) speak(L.long, { prio: 2 });
    if (who === 'me') planFoe();
  }
  // Your shot: target from the shot table, then the timing wobble.
  function shoot(who, kind, q) {
    const S = SHOTS[kind];
    const depth = rand(S.depth[0], S.depth[1]);
    let v = kind === 'smash' ? aimSmash(sh.x, sh.y, 1, depth, S.v * (0.82 + 0.18 * q) + 2) : aim(sh.x, sh.y, 1, depth, S.ang);
    const err = 1 - q;
    if (err > 0.02) {
      // A mistimed smash mostly finds the tape, not the back wall.
      const a = Math.atan2(v.vy, v.vx) + (kind === 'smash' ? rand(-1, 0.4) : rand(-1, 1)) * err * 9 * deg;
      const sp = Math.hypot(v.vx, v.vy) * (1 + rand(-0.2, 0.14) * err);
      v = { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp };
    }
    launch(who, kind, v);
  }
  // The head's shot: aimed at a depth, with its own small wobble.
  function shootFoe(kind, depth, mess) {
    const lv = level();
    let v = kind === 'smash' ? aimSmash(sh.x, sh.y, -1, depth, 31 + 9 * lv) : aim(sh.x, sh.y, -1, depth, SHOTS[kind].ang);
    const a = Math.atan2(v.vy, v.vx) + rand(-1, 1) * (1.2 - lv) * deg + (mess === 'net' ? 7 * deg : 0);
    const sp = Math.hypot(v.vx, v.vy) * (mess === 'net' ? 0.62 : 1 + rand(-0.03, 0.03));
    launch('foe', kind, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp });
    foe.sqAt = clock;
    foe.base = kind === 'clear' || kind === 'lift' || kind === 'serveHigh' ? 3.6 : kind === 'net' || kind === 'drop' ? 2.6 : 3.2;
    foe.plan = { tx: foe.base, wait: Math.round(0.12 / STEP), step: -1, vmax: 3.4 + lv };
    if (kind === 'smash') setFace('angry', 500);
  }

  // Where your racket meets it cleanest for each swing.
  function sweet(kind, S) {
    if (kind === 'over') return { x: S.x + 0.3 * R, y: S.y + 0.8 * R };
    if (kind === 'under') return { x: S.x + 0.45 * R, y: S.y - 0.8 * R };
    return { x: S.x + 0.75 * R, y: S.y + 0.05 * R };
  }
  // Keep a contact angle on the side of the body its swing belongs to.
  function fitC(kind, c) {
    c = ((c + 540) % 360) - 180;
    if (kind === 'over') return clamp(c, 20, 165);
    if (kind === 'under') return c > 90 ? -170 : clamp(c, -170, -10);
    return clamp(c, -60, 60);
  }
  function swing() {
    if (!open || paused || !inCourt) return;
    if (phase === 'serve') { if (server === 'me') serveMe(); return; }
    if (phase !== 'rally') return;
    if (me.swing && clock - me.swing.t0 < 320) { me.buffer = clock; return; }
    me.buffer = -1e9;
    const S = myShoulder();
    // Peek ahead to shape the swing: overhead, side or underhand.
    let hy = sh.y, c = null;
    if (sh.last !== 'me' && !sh.down) {
      const p = { x: sh.x, y: sh.y, vx: sh.vx, vy: sh.vy };
      for (let i = 0; i < 100; i++) { adv(p); if (Math.hypot(p.x - S.x, p.y - S.y) < R * 1.1 || p.y <= 0) break; }
      hy = p.y;
      c = Math.atan2(p.y - S.y, p.x - S.x) / deg;
    }
    const kind = hy > S.y + 0.3 * R ? 'over' : hy < S.y - 0.45 * R ? 'under' : 'side';
    me.swing = { t0: clock, kind, c: c == null ? null : fitC(kind, c), prev: Infinity, hit: false };
    if (kind === 'over' && hy > S.y + 0.75 * R) me.jump = { t0: clock - 70, h: Math.min(0.5 * k, hy - S.y - 0.6 * R) };
    sound.whoosh(0.45);
  }
  function tryMyHit() {
    const sw = me.swing;
    if (!sw || sw.hit || sh.last === 'me' || sh.netted || sh.x > 0.03) return;
    const t = clock - sw.t0;
    if (t < 20 || t > 245) return;
    const S = myShoulder();
    const dx = sh.x - S.x, dy = sh.y - S.y;
    const inside = dx > -0.42 * k && Math.hypot(dx, dy) <= R;
    if (!inside && sw.prev === Infinity) return;
    const sp = sweet(sw.kind, S);
    const d = Math.hypot(sh.x - sp.x, sh.y - sp.y);
    // Wait for its closest pass by the sweet spot, unless it's leaving the zone.
    if (inside && d < sw.prev && t < 228) { sw.prev = d; return; }
    sw.hit = true;
    const qt = clamp(1 - Math.abs(t - 115) / 170, 0.35, 1);
    const qd = clamp(1.12 - (d / R) * 0.55, 0.55, 1);
    const q = qt * qd;
    const mod = me.modUp || me.flick === 'clear' ? 'clear' : me.modDown || me.flick === 'drop' ? 'drop' : '';
    const hi = dy > 0.3 * R, lo = dy < -0.45 * R, dn = -me.x;
    let kind;
    if (hi) kind = mod === 'drop' ? 'drop' : mod === 'clear' ? 'clear' : dn < 4.6 ? 'smash' : 'clear';
    else if (lo) kind = mod === 'drop' || (mod !== 'clear' && dn < 2.3) ? 'net' : 'lift';
    else kind = mod === 'drop' ? 'drop' : mod === 'clear' ? 'lift' : 'drive';
    sw.t0 = clock - 160; // snap the drawn swing to its contact pose, pointing at it
    sw.c = fitC(sw.kind, Math.atan2(dy, dx) / deg);
    shoot('me', kind, q);
    if (kind === 'smash') pop('smash', sh.x - 0.3, sh.y + 0.7 * k, true);
    else if (qt < 0.62) pop(t < 115 ? 'late' : 'early', me.x, 2.35 * k + 0.4, false);
  }

  // ---- The head --------------------------------------------------------------------
  // On your hit it runs the same physics forward, picks the best point on the
  // path it can get to in time (high and early, like a real player), and goes.
  function planFoe() {
    const lv = level();
    const f = fly(sh.x, sh.y, sh.vx, sh.vy, true);
    const react = ((250 - 120 * lv) / 1000) * TS;
    const vmax = 4.3 + 1.5 * lv;
    const p = { tx: foe.x, step: -1, wait: Math.round(react / STEP), leave: false, bad: false, miss: false, save: false, swingAt: -1, jumpAt: -1, jh: 0, kind: '', vmax };
    foe.plan = p;
    if (f.end === 'net' || f.x <= 0) { p.tx = clamp(foe.x, 1.4, 5); return; }
    const out = f.x > COURT;
    if (out && Math.random() < (f.x > COURT + 0.3 ? 0.92 : 0.72)) { p.leave = true; p.tx = clamp(f.x - 1, 1, foeMax); return; }
    if (!out && f.x > COURT - 0.3 && Math.random() < 0.1 * (1 - lv)) { p.leave = p.bad = true; p.tx = clamp(f.x - 1, 1, foeMax); return; }
    const Sy0 = foeCy - 0.18 * hhW;
    const off0 = 0.42 * hwW;
    const JH = 0.5 * k;
    let bestI = -1, bestSc = -Infinity, bestTx = 0, bestJ = 0;
    let lateI = -1, lateBy = Infinity, lateTx = 0;
    const n = f.pts.length / 2;
    for (let i = 4; i <= n; i += 2) {
      const x = f.pts[(i - 1) * 2], y = f.pts[(i - 1) * 2 + 1];
      if (x < 0.35 || y < 0.18) continue;
      let dy = y - Sy0, j = 0;
      if (dy > 0.72 * RH) { j = dy - 0.72 * RH; if (j > JH) continue; dy -= j; }
      if (dy < -0.9 * RH) continue;
      const reachX = Math.sqrt(Math.max(0, (0.84 * RH) ** 2 - dy * dy));
      const tx = clamp(x + reachX * 0.9 + off0, 0.5, foeMax);
      if (Math.hypot(x - (tx - off0), dy) > 0.95 * RH) continue;
      const t = i * STEP;
      const need = react + Math.abs(tx - foe.x) / vmax + 0.09;
      if (need <= t) {
        const sc = y - 0.6 * t - 1.2 * j + (dy > 0.3 * RH ? 0.5 : 0);
        if (sc > bestSc) { bestSc = sc; bestI = i; bestTx = tx; bestJ = j; }
      } else if (need - t < lateBy) { lateBy = need - t; lateI = i; lateTx = tx; }
    }
    if (bestI < 0) {
      if (lateI < 0) { p.miss = true; p.tx = clamp(f.x + 0.4, 0.5, foeMax); return; }
      p.tx = lateTx;
      if (lateBy < 0.13) { p.save = true; bestI = lateI; } else { p.miss = true; return; }
    } else { p.tx = bestTx; p.jh = bestJ; }
    p.step = bestI;
    const y = f.pts[(bestI - 1) * 2 + 1];
    p.kind = y - Sy0 > 0.3 * RH ? 'over' : y - Sy0 < -0.45 * RH ? 'under' : 'side';
    p.cx = f.pts[(bestI - 1) * 2];
    p.cy = y;
    p.swingAt = Math.max(1, bestI - Math.round((0.16 * TS) / STEP));
    p.jumpAt = Math.max(1, bestI - Math.round((0.22 * TS) / STEP));
  }
  function moveFoe() {
    const p = foe.plan;
    let tx = p ? p.tx : foe.base;
    if (p && p.wait > 0) { p.wait--; tx = foe.x; }
    const vmax = p ? p.vmax : 4;
    const want = clamp((tx - foe.x) * 9, -vmax, vmax);
    foe.vx += clamp(want - foe.vx, -40 * STEP, 40 * STEP);
    foe.x = clamp(foe.x + foe.vx * STEP, 0.5, foeMax);
    if (p && p.step > 0 && phase === 'rally' && sh.last === 'me') {
      if (sh.n === p.swingAt) foe.swing = { t0: clock, kind: p.kind, pt: { x: p.cx, y: p.cy } };
      if (p.jh > 0 && sh.n === p.jumpAt) foe.jump = { t0: clock, h: p.jh };
    }
  }
  function tryFoeHit() {
    const p = foe.plan;
    if (!p || p.step < 0 || sh.last !== 'me' || sh.netted || sh.n !== p.step) return;
    const S = foeShoulder();
    if (!p.save && Math.hypot(sh.x - S.x, sh.y - S.y) > RH * 1.08) { p.miss = true; p.step = -1; return; }
    p.step = -1;
    const lv = level();
    const dy = sh.y - S.y;
    if (foe.swing && foe.swing.pt) { foe.swing.t0 = clock - 160; foe.swing.c = fitC(foe.swing.kind, 180 - Math.atan2(dy, sh.x - S.x) / deg); foe.swing.pt = null; }
    const hi = dy > 0.3 * RH, lo = dy < -0.45 * RH;
    const dn = foe.x, meDn = -me.x;
    const youBack = meDn > 4.2, youFront = meDn < 2.6;
    let kind;
    if (p.save) kind = lo ? 'lift' : 'clear';
    else if (hi) kind = pickW({ smash: dn < 4.8 ? 0.8 + 2 * lv + (youBack ? 0.4 : 0) : 0.15 + 0.4 * lv, clear: youFront ? 2.2 : 1, drop: youBack ? 2.4 : 0.9 + lv });
    else if (lo) kind = dn < 2.6 ? pickW({ net: 1.8, lift: 1.2 }) : pickW({ lift: 2.4, net: youBack ? 1.4 : 0.5 });
    else kind = pickW({ drive: 2, drop: youBack ? 1.5 : 0.6, lift: 0.7 });
    // Mistakes: a steady trickle, more off your smashes and on a stretch.
    const pm = 0.11 - 0.03 * lv + (sh.kind === 'smash' ? 0.12 : 0) + (p.save ? 0.35 : 0);
    let mess = '';
    if (Math.random() < pm) mess = pickW({ net: 1, long: 1, weak: lo ? 0.3 : 0.9 });
    let depth;
    if (mess === 'long') depth = rand(6.95, 7.6);
    else if (mess === 'weak') { kind = 'lift'; depth = rand(2.8, 3.8); }
    else if (kind === 'smash') {
      // Away from you: deep if you're up, short if you're back.
      const spots = [2.6, 4.1, 5.6].sort((a, b) => Math.abs(b - meDn) - Math.abs(a - meDn));
      depth = spots[Math.random() < 0.7 ? 0 : 1] + rand(-0.3, 0.3);
    } else if (kind === 'clear' || kind === 'lift') depth = rand(5.4 + 0.4 * lv, 6.45);
    else if (kind === 'drop') depth = rand(0.8, 2 - 0.5 * lv);
    else if (kind === 'net') depth = rand(0.45, 1.2);
    else depth = rand(4.2, 6.1);
    shootFoe(kind, depth, mess === 'net' ? 'net' : '');
  }

  // ---- Flight, landing and points -------------------------------------------------
  function moveMe() {
    const vmax = 5.6;
    const want = me.target != null ? clamp((me.target - me.x) * 10, -vmax * 1.15, vmax * 1.15) : ((me.keyR ? 1 : 0) - (me.keyL ? 1 : 0)) * vmax;
    me.vx += clamp(want - me.vx, -48 * STEP, 48 * STEP);
    me.x += me.vx * STEP;
    const serving = phase === 'serve' && server === 'me';
    const lo = serving ? -6.4 : -xMax, hi = serving ? -2.2 : -0.3;
    if (me.x < lo) { me.x = lo; me.vx = Math.max(0, me.vx); }
    if (me.x > hi) { me.x = hi; me.vx = Math.min(0, me.vx); }
    me.walk += Math.abs(me.vx) * STEP * (3 / k);
  }
  function flyStep() {
    const px = sh.x, py = sh.y;
    adv(sh);
    sh.n++;
    if (!sh.netted && (px < 0) !== (sh.x < 0)) {
      const ny = py + (sh.y - py) * (px / (px - sh.x));
      if (ny < NET) {
        // Into the net: it drops back on the hitter's side.
        sh.netted = true;
        sh.x = px < 0 ? -0.06 : 0.06;
        sh.y = ny;
        sh.vx = -sh.vx * 0.1;
        sh.vy = Math.min(sh.vy, 0) * 0.3;
        sound.net();
        if (foe.plan) foe.plan.step = -1;
      }
    }
    if (phase === 'rally') { tryMyHit(); tryFoeHit(); }
    if (sh.y <= 0) {
      sh.x = px + (sh.x - px) * (py / Math.max(1e-6, py - sh.y));
      sh.y = 0;
      landed();
    }
  }
  function landed() {
    sh.down = true;
    sh.vx = sh.vy = 0;
    sound.floor(0.9);
    const x = sh.x, hitter = sh.last;
    let winner, why;
    if (sh.netted) { winner = other(hitter); why = 'net'; }
    else {
      const side = x < 0 ? 'me' : 'foe';
      const d = Math.abs(x);
      if (side === hitter) { winner = other(hitter); why = 'net'; }
      else if (d > COURT) { winner = side; why = 'out'; }
      else if (sh.serve && d < SHORT) { winner = side; why = 'short'; }
      else { winner = hitter; why = 'in'; }
    }
    point(winner, why, x);
  }
  function point(winner, why, x) {
    phase = 'point';
    score[winner]++;
    const d = Math.abs(x);
    if (why === 'out' || why === 'short') pop(why, x, 0.55, false);
    else if (why === 'net') pop('net', x < 0 ? -0.6 : 0.6, NET + 0.45, false);
    else if (d > COURT - 0.5) pop('in', x, 0.55, true);
    sound.point(winner === 'me');
    const p = foe.plan || {};
    if (winner === 'me') {
      setFace(why === 'in' ? 'sad' : 'angry', 1500);
      if (why === 'out') speak(L.headOut, { prio: 2 });
      else if (why === 'net') speak(L.headNet, { prio: 2 });
      else if (p.bad) speak(L.badLeave, { prio: 2 });
      else {
        const byKind = { smash: L.smashYou, drop: L.dropYou, net: L.netYou, clear: L.clearYou, lift: L.clearYou, drive: L.driveYou };
        speak(byKind[sh.kind] && Math.random() < 0.75 ? byKind[sh.kind] : L.tooGood, { prio: 2 });
      }
    } else {
      setFace(why === 'in' ? 'happy' : 'blink', 1500);
      if (why === 'out') speak(p.leave ? L.goodLeave : L.youOut, { prio: 2 });
      else if (why === 'net') speak(L.youNet, { prio: 2, chance: 0.8 });
      else if (why === 'short') speak(L.youShort, { prio: 2 });
      else if (sh.kind === 'smash') speak(L.headSmash, { prio: 2 });
      else if ((sh.kind === 'drop' || sh.kind === 'net') && Math.random() < 0.7) speak(L.headDrop, { prio: 2 });
      else if (me.swing && !me.swing.hit && clock - me.swing.t0 < 900) speak(L.youMissed, { prio: 2, chance: 0.8 });
      else speak(L.headWin, { prio: 2, chance: 0.7 });
    }
    gameBest = Math.max(gameBest, rally);
    if (rally > best) {
      best = rally;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    server = winner;
    if (score[winner] >= WIN) after(1500, finish);
    else after(1600, setupServe);
  }
  function startGame() {
    score = { me: 0, foe: 0 };
    gameBest = 0;
    server = lastServer = 'me';
    firstServe = true;
    hideCard();
    hush();
    setupServe();
    speak(L.hello, { prio: 3 });
  }
  function finish() {
    phase = 'end';
    timers = [];
    const won = score.me > score.foe;
    lastResult = `Last game: ${won ? 'you won' : 'the head won'} ${Math.max(score.me, score.foe)}-${Math.min(score.me, score.foe)}.`;
    setFace(won ? 'sad' : 'happy');
    showCard('end', `<p class="h">${won ? 'You win' : 'The head wins'}</p><p class="p">${score.me} to ${score.foe}</p>` +
      `<div class="bad-stats"><span>Longest rally <b>${gameBest}</b></span><span>Best ever <b>${best}</b></span></div>` +
      '<div class="bad-row"><button class="bad-go big" type="button" data-a="again">Play again</button><button class="bad-alt" type="button" data-a="quit">Done</button></div>');
    speak(won ? L.matchWin : L.matchLose, { prio: 3, hold: Infinity });
    focusGo();
  }
  function pause() {
    if (paused || !open || phase === 'end' || phase === 'idle' || phase === 'enter') return;
    paused = true;
    me.keyL = me.keyR = me.modUp = me.modDown = false;
    me.target = null;
    before = card.hidden ? null : { kind: cardKind, html: card.innerHTML };
    showCard('pause', '<p class="h">Paused</p><div class="bad-row"><button class="bad-go" type="button" data-a="resume">Resume</button><button class="bad-alt" type="button" data-a="quit">Quit</button></div>');
    speak(L.paused, { prio: 3, hold: Infinity });
  }
  function resume() {
    if (!paused) return;
    paused = false;
    if (before) showCard(before.kind, before.html);
    else hideCard();
    before = null;
    hush();
  }

  // ---- In and out of the court ------------------------------------------------------
  // Rally: the layer grows out of the start panel, the site's floating head flies
  // from its corner to its spot on the court, and ours takes over from there.
  // Done: the reverse, and the floating head goes home.
  const EASE = 'cubic-bezier(.45,.05,.25,1)';
  const site = () => {
    const a = window.dlHead;
    return a && typeof a.flyTo === 'function' && typeof a.away === 'function' && typeof a.home === 'function' ? a : null;
  };
  let open = false;
  let lent = false;
  let inCourt = false;
  let inAt = 0;
  let dead = false;
  let scrollWas = '';
  let shrink = null;
  function panelClip() {
    const r = root.getBoundingClientRect();
    const t = clamp(r.top, 0, innerHeight);
    const b = clamp(innerHeight - r.bottom, 0, innerHeight - t);
    return `inset(${t.toFixed(0)}px ${Math.max(0, innerWidth - r.right).toFixed(0)}px ${b.toFixed(0)}px ${Math.max(0, r.left).toFixed(0)}px round 16px)`;
  }
  const headBox = () => {
    const r = court.getBoundingClientRect();
    return { x: r.left + PX(foe.x) - hwPx / 2, y: r.top + PY(foeHeadY()) - hhPx / 2 };
  };
  async function openCourt() {
    if (open || dead) return;
    open = true;
    sound.unlock();
    if (shrink) { shrink.cancel(); shrink = null; }
    document.body.appendChild(over);
    scrollWas = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    measure();
    readColors();
    me.x = -2.6;
    me.vx = foe.vx = 0;
    foe.x = foe.base = 3.1;
    foe.plan = null;
    score = { me: 0, foe: 0 };
    rally = 0;
    sh.held = 'me';
    sh.down = false;
    const h = heldAt();
    sh.x = h.x; sh.y = h.y; sh.ang = -Math.PI / 2;
    hideCard();
    hush();
    bigText('');
    phase = 'enter';
    inCourt = false;
    if (!reduce) over.animate([{ clipPath: panelClip(), opacity: 0.6 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }], { duration: 460, easing: EASE });
    const s = site();
    solo = !s;
    over.classList.toggle('solo', solo);
    if (s) {
      lent = true;
      const b = headBox();
      try { await s.flyTo(b.x, b.y, hwPx, reduce ? 0 : 950); } catch (e) {}
      if (!open || dead) return;
      s.away(true);
    }
    inCourt = true;
    inAt = clock;
    foe.sqAt = clock;
    sound.floor(0.6);
    startGame();
  }
  // Hand the head back: the floating one appears where ours is and flies home.
  function giveBack(ms) {
    const s = site();
    if (lent && s) {
      try {
        if (inCourt) {
          const b = headBox();
          s.flyTo(b.x, b.y, hwPx, 0);
          s.away(false);
        }
        s.home(ms);
      } catch (e) {}
    }
    lent = false;
    inCourt = false;
  }
  function closeCourt() {
    if (!open) return;
    open = false;
    paused = false;
    timers = [];
    phase = 'idle';
    me.keyL = me.keyR = me.modUp = me.modDown = false;
    me.target = null;
    hush();
    giveBack(reduce ? 0 : 800);
    const back = over.contains(document.activeElement);
    const done = () => {
      over.remove();
      if (shrink) { shrink.cancel(); shrink = null; }
      document.documentElement.style.overflow = scrollWas;
    };
    if (reduce) done();
    else {
      shrink = over.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }, { clipPath: panelClip(), opacity: 0 }], { duration: 420, easing: EASE, fill: 'forwards' });
      shrink.finished.then(done, () => {});
    }
    startNote.textContent = noteText();
    if (back) startBtn.focus({ preventScroll: true });
  }

  // ---- Drawing --------------------------------------------------------------------
  // Swing arcs as racket angles in degrees for a player facing right (the head
  // mirrors them), built around c, the angle to where it meets the shuttle:
  // wind-up, contact, follow-through. Contact lands at 160ms.
  const ARC = { over: [90, -110], side: [170, -70], under: [-90, 100] };
  const C0 = { over: 80, side: 0, under: -40 };
  function racketAngle(sw, ready) {
    if (!sw) return ready;
    const t = (clock - sw.t0) / 320;
    if (t < 0 || t >= 1.3) return ready;
    const b = sw.c == null ? C0[sw.kind] : sw.c;
    const a = b + ARC[sw.kind][0], c = b + ARC[sw.kind][1];
    if (t < 0.25) return lerp(ready, a, easeOut(t / 0.25));
    if (t < 0.5) return lerp(a, b, easeInOut((t - 0.25) / 0.25));
    if (t < 0.8) return lerp(b, c, easeOut((t - 0.5) / 0.3));
    const r2 = ready + 360 * Math.round((c - ready) / 360);
    return lerp(c, r2, easeInOut((t - 0.8) / 0.5));
  }
  const SQUISH = [[0, 1, 1], [0.3, 1.1, 0.9], [0.65, 0.95, 1.06], [1, 1, 1]];
  function seg(x0, y0, x1, y1) { ctx.moveTo(PX(x0), PY(y0)); ctx.lineTo(PX(x1), PY(y1)); }
  function shadow(x, rx, a) {
    ctx.beginPath();
    ctx.ellipse(PX(x), fy + 1.5, Math.max(2, rx), Math.max(1.5, rx * 0.16), 0, 0, Math.PI * 2);
    ctx.fillStyle = col.dark ? `rgba(0,0,0,${(a * 2.6).toFixed(3)})` : `rgba(0,0,0,${a.toFixed(3)})`;
    ctx.fill();
  }

  function drawCourt() {
    ctx.fillStyle = col.fill;
    ctx.fillRect(0, fy, W, H - fy);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = col.rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, fy + 0.5);
    ctx.lineTo(W, fy + 0.5);
    ctx.stroke();
    ctx.strokeStyle = col.t3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PX(-COURT), fy + 1);
    ctx.lineTo(PX(COURT), fy + 1);
    for (const x of [-COURT, -SHORT, SHORT, COURT]) { ctx.moveTo(PX(x), fy); ctx.lineTo(PX(x), fy + 8); }
    ctx.stroke();
  }
  function drawNet() {
    const x = Math.round(PX(0)) + 0.5, top = PY(NET), bot = PY(NET_LOW), w = clamp(0.12 * s, 5, 10);
    ctx.lineCap = 'butt';
    ctx.strokeStyle = col.t2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, fy);
    ctx.lineTo(x, top - 1);
    ctx.stroke();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - w / 2, top, w, bot - top);
    ctx.clip();
    ctx.fillStyle = col.bg;
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - w / 2, top, w, bot - top);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = col.t3;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let yy = top - w; yy < bot + w; yy += 4) { ctx.moveTo(x - w / 2, yy); ctx.lineTo(x + w / 2, yy + w); ctx.moveTo(x + w / 2, yy); ctx.lineTo(x - w / 2, yy + w); }
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = col.t3;
    ctx.strokeRect(x - w / 2, top, w, bot - top);
    ctx.fillStyle = col.t1;
    ctx.fillRect(x - w / 2 - 1, top - 2, w + 2, 3);
  }
  // A racket hanging off shoulder S at world angle th (radians), len long.
  // Returns where the hand is.
  function drawRacket(S, th, len, frame, glow) {
    const ux = Math.cos(th), uy = Math.sin(th);
    const hand = { x: S.x + ux * 0.42 * len, y: S.y + uy * 0.42 * len };
    const neck = { x: hand.x + ux * 0.29 * len, y: hand.y + uy * 0.29 * len };
    const hc = { x: hand.x + ux * 0.45 * len, y: hand.y + uy * 0.45 * len };
    const ra = 0.165 * len * s, rb = 0.118 * len * s;
    ctx.lineCap = 'round';
    ctx.strokeStyle = col.t2;
    ctx.lineWidth = Math.max(1.5, 0.028 * len * s);
    ctx.beginPath();
    seg(hand.x, hand.y, neck.x, neck.y);
    ctx.stroke();
    ctx.save();
    ctx.translate(PX(hc.x), PY(hc.y));
    ctx.rotate(-th);
    ctx.beginPath();
    ctx.ellipse(0, 0, ra, rb, 0, 0, Math.PI * 2);
    ctx.fillStyle = frame;
    ctx.globalAlpha = glow ? 0.42 : 0.1;
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1;
    ctx.strokeStyle = frame;
    ctx.beginPath();
    for (const f of [-0.5, 0, 0.5]) { ctx.moveTo(-ra * Math.sqrt(1 - f * f), f * rb); ctx.lineTo(ra * Math.sqrt(1 - f * f), f * rb); ctx.moveTo(f * ra, -rb * Math.sqrt(1 - f * f)); ctx.lineTo(f * ra, rb * Math.sqrt(1 - f * f)); }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(1.6, 0.034 * len * s);
    ctx.beginPath();
    ctx.ellipse(0, 0, ra, rb, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return hand;
  }

  // You: a pictogram player with the one accent color on the racket.
  function drawMe() {
    const j = jumpY(me.jump);
    const mv = clamp(Math.abs(me.vx) / 3, 0, 1);
    const lean = clamp(me.vx / 5.6, -1, 1) * 0.1 * k;
    const S = myShoulder();
    S.x += lean;
    const hip = { x: me.x + lean * 0.3, y: 0.92 * k + j };
    const spread = 0.2 * k * (1 - mv), stride = reduce ? 0 : Math.sin(me.walk) * 0.3 * k * mv;
    const lift = (c) => j * 0.55 + (reduce ? 0 : Math.max(0, c) * 0.1 * k * mv);
    const feet = [
      { x: me.x - spread + stride, y: lift(Math.cos(me.walk)) },
      { x: me.x + spread - stride, y: lift(-Math.cos(me.walk)) }
    ];
    const lw = (m) => Math.max(2, m * k * s);
    ctx.strokeStyle = col.t1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw(0.13);
    ctx.beginPath();
    for (const f of feet) {
      const kx = (hip.x + f.x) / 2 + 0.09 * k, ky = (hip.y + f.y) / 2;
      ctx.moveTo(PX(hip.x), PY(hip.y));
      ctx.lineTo(PX(kx), PY(ky));
      ctx.lineTo(PX(f.x + 0.05 * k), PY(f.y));
    }
    ctx.stroke();
    ctx.lineWidth = lw(0.25);
    ctx.beginPath();
    seg(hip.x, hip.y, S.x, S.y - 0.04 * k);
    ctx.stroke();
    ctx.fillStyle = col.t1;
    ctx.beginPath();
    ctx.arc(PX(S.x + 0.03 * k + lean * 0.4), PY(S.y + 0.27 * k), 0.15 * k * s, 0, Math.PI * 2);
    ctx.fill();
    // The free arm points at the shuttle on an overhead, otherwise balances.
    const sw = me.swing;
    const ts = sw ? (clock - sw.t0) / 320 : 2;
    const offA = (sw && sw.kind === 'over' && ts < 0.5 ? 72 : 215 + (reduce ? 0 : Math.sin(me.walk) * 12 * mv)) * deg;
    ctx.lineWidth = lw(0.1);
    ctx.beginPath();
    seg(S.x, S.y, S.x + Math.cos(offA) * 0.5 * R, S.y + Math.sin(offA) * 0.5 * R);
    ctx.stroke();
    const ready = phase === 'serve' && sh.held === 'me' ? 250 : 58;
    const th = racketAngle(sw, ready) * deg;
    const hand = { x: S.x + Math.cos(th) * 0.42 * R, y: S.y + Math.sin(th) * 0.42 * R };
    const glow = phase === 'rally' && sh.last === 'foe' && !sh.down && !sh.netted && sh.x < 0.03 && Math.hypot(sh.x - S.x, sh.y - S.y) < R * 1.05;
    drawRacket(S, th, R, '#88c0d0', glow);
    ctx.strokeStyle = col.t1;
    ctx.lineWidth = lw(0.1);
    ctx.lineCap = 'round';
    ctx.beginPath();
    seg(S.x, S.y, hand.x, hand.y);
    ctx.stroke();
  }

  // The head: the cutout, floating, with its racket in a floating fist.
  let solo = false;
  function drawFoe() {
    if (!inCourt) return;
    const cy = foeHeadY();
    const S = foeShoulder();
    const ready = phase === 'serve' && sh.held === 'foe' ? 250 : 58;
    const fs = foe.swing;
    if (fs && fs.pt) fs.c = fitC(fs.kind, 180 - Math.atan2(fs.pt.y - S.y, fs.pt.x - S.x) / deg);
    const th = (180 - racketAngle(fs, ready)) * deg;
    const fade = solo && !reduce ? clamp((clock - inAt) / 220, 0, 1) : 1;
    ctx.globalAlpha = fade;
    const hand = drawRacket(S, th, RH, col.t2, false);
    let sx = 1, sy = 1;
    const q = (clock - foe.sqAt) / 360;
    if (!reduce && q >= 0 && q < 1) {
      for (let i = 1; i < SQUISH.length; i++) {
        const [t1, x1, y1] = SQUISH[i];
        const [t0, x0, y0] = SQUISH[i - 1];
        if (q <= t1) { const u = (q - t0) / (t1 - t0); sx = lerp(x0, x1, u); sy = lerp(y0, y1, u); break; }
      }
    }
    const tilt = reduce ? 0 : clamp(-foe.vx * 2.2, -9, 9) * deg;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(PX(foe.x), PY(cy) + hhPx / 2);
    ctx.rotate(tilt);
    ctx.scale(sx, sy);
    const img = imgs[curFace()];
    const im = img.complete && img.naturalWidth ? img : imgs.neutral;
    if (im.complete && im.naturalWidth) ctx.drawImage(im, -hwPx / 2, -hhPx, hwPx, hhPx);
    ctx.restore();
    if (fist.complete && fist.naturalWidth) {
      const fw = clamp(0.3 * hwPx, 14, 38), fh = (fw * FIST.h) / FIST.w;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(PX(hand.x), PY(hand.y));
      ctx.rotate(Math.PI / 2 - th);
      ctx.drawImage(fist, -fw / 2, -fh * 0.3, fw, fh);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // The shuttle: cork leads, skirt trails, and a fading streak behind it.
  function drawShuttle() {
    const x = PX(sh.x), y = PY(sh.y);
    const tr = sh.trail;
    if (tr.length > 3 && !reduce) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = col.t2;
      for (let i = 2; i < tr.length; i += 2) {
        const a = i / tr.length;
        ctx.globalAlpha = a * (sh.kind === 'smash' ? 0.5 : 0.28);
        ctx.lineWidth = 1 + a * (sh.kind === 'smash' ? 3 : 1.6);
        ctx.beginPath();
        ctx.moveTo(PX(tr[i - 2]), PY(tr[i - 1]));
        ctx.lineTo(PX(tr[i]), PY(tr[i + 1]));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    const Ls = clamp(s * 0.17, 11, 18), rc = Ls * 0.25;
    if (y < 2) {
      // Above the top: a caret where it'll come down.
      const cx = clamp(x, 10, W - 10);
      ctx.fillStyle = col.t2;
      ctx.beginPath();
      ctx.moveTo(cx, 6);
      ctx.lineTo(cx - 6, 15);
      ctx.lineTo(cx + 6, 15);
      ctx.closePath();
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-sh.ang);
    ctx.beginPath();
    ctx.moveTo(-rc * 0.3, -rc * 0.8);
    ctx.lineTo(-Ls, -Ls * 0.46);
    ctx.lineTo(-Ls, Ls * 0.46);
    ctx.lineTo(-rc * 0.3, rc * 0.8);
    ctx.closePath();
    ctx.fillStyle = col.dark ? 'rgba(255,255,255,0.9)' : '#fff';
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = col.dark ? 'rgba(255,255,255,0.9)' : col.t2;
    ctx.stroke();
    ctx.strokeStyle = col.dark ? 'rgba(0,0,0,0.35)' : col.t3;
    ctx.beginPath();
    for (const f of [-0.42, 0, 0.42]) { ctx.moveTo(-rc * 0.3, f * rc * 1.6); ctx.lineTo(-Ls, f * Ls * 0.95); }
    ctx.moveTo(-Ls * 0.55, -Ls * 0.32);
    ctx.lineTo(-Ls * 0.55, Ls * 0.32);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, rc, 0, Math.PI * 2);
    ctx.fillStyle = col.dark ? '#e5e9f0' : col.t1;
    ctx.fill();
    ctx.restore();
  }

  let hudKey = '';
  let sndCheck = 0;
  function render(dt) {
    if (!W || !H) return;
    // The cork swings round to lead: a stiff spring toward the flight direction.
    if (sh.held) { sh.ang = -Math.PI / 2; sh.av = 0; }
    else {
      const target = sh.down ? -Math.PI / 2 + (sh.x < 0 ? -0.5 : 0.5) : Math.atan2(sh.vy, sh.vx);
      if (reduce) sh.ang = target;
      else {
        for (let t = dt / 1000; t > 0; t -= 0.004) {
          const h = Math.min(0.004, t);
          const d = ((((target - sh.ang + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
          sh.av += (d * 1100 - sh.av * 46) * h;
          sh.ang += sh.av * h;
        }
      }
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    drawCourt();
    shadow(me.x, 0.36 * k * s * (1 - clamp(jumpY(me.jump) / 2, 0, 0.4)), 0.12);
    if (inCourt) shadow(foe.x, hwPx * 0.36 * (1 - clamp(jumpY(foe.jump) / 2, 0, 0.4)), 0.1);
    if (!sh.held && !sh.down && phase !== 'idle') shadow(sh.x, 6 * (1 - clamp(sh.y / 9, 0, 0.75)), 0.16 * (1 - clamp(sh.y / 10, 0, 0.8)));
    drawMe();
    drawNet();
    drawFoe();
    if (phase !== 'idle' && (sh.held !== 'foe' || inCourt)) drawShuttle();

    // What the head is saying, typed out, next to it.
    if (say.text) {
      const n = reduce ? say.chars.length : Math.min(say.chars.length, Math.floor((wall - say.t0) / 26));
      if (n !== say.shown) { sayEl.textContent = say.chars.slice(0, n).join(''); say.shown = n; }
    }
    const talking = wall < say.until && inCourt;
    sayEl.classList.toggle('on', talking);
    if (talking) {
      const hx = PX(foe.x), top = PY(foeHeadY()) - hhPx / 2;
      let bx = hx - hwPx * 0.3 - say.w, bt = top - say.h * 0.4;
      if (bx < 10) { bx = clamp(hx - say.w / 2, 10, W - say.w - 10); bt = top - say.h - 6; }
      sayEl.style.transform = `translate(${bx.toFixed(1)}px,${clamp(bt, 10, H - say.h - 10).toFixed(1)}px)`;
    }

    const key = [score.me, score.foe, rally, best, server, phase].join();
    if (key !== hudKey) {
      hudKey = key;
      hud.me.textContent = score.me;
      hud.foe.textContent = score.foe;
      const live = phase === 'serve' || phase === 'rally' || phase === 'point';
      hud.meSv.classList.toggle('on', live && server === 'me');
      hud.foeSv.classList.toggle('on', live && server === 'foe');
      hud.rally.textContent = rally;
      hud.best.textContent = best ? `best ${best}` : '';
    }
    if ((sndCheck += dt) > 500) { sndCheck = 0; snd.classList.toggle('muted', sound.muted()); }
  }

  // ---- Loop ---------------------------------------------------------------------------
  function runTimers() {
    if (!timers.some((t) => t.at <= clock)) return;
    const due = timers.filter((t) => t.at <= clock);
    timers = timers.filter((t) => t.at > clock);
    due.forEach((t) => t.fn());
  }
  function tick() {
    moveMe();
    moveFoe();
    if (sh.held) { const h = heldAt(); sh.x = h.x; sh.y = h.y; }
    else if (phase === 'rally' && !sh.down) flyStep();
  }
  function frame(ts) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = lastTs ? Math.min(50, ts - lastTs) : 16;
    lastTs = ts;
    wall += dt;
    if (!open) return;
    if (!paused) {
      clock += dt;
      runTimers();
      if (clock - me.buffer < 130 && me.swing && clock - me.swing.t0 >= 320) swing();
      acc += (dt / 1000) * TS;
      let n = 0;
      while (acc >= STEP && n < 60) { acc -= STEP; n++; tick(); }
      if (acc >= STEP) acc = 0;
      if (phase === 'rally' && !sh.down) {
        sh.trail.push(sh.x, sh.y);
        if (sh.trail.length > 24) sh.trail.splice(0, 2);
      } else if (sh.trail.length) sh.trail.splice(0, 2);
      if (phase === 'serve' && server === 'me' && !waitSaid && clock - waitAt > 7000) { waitSaid = true; speak(L.wait, { prio: 2 }); }
    }
    render(dt);
  }

  // ---- Input --------------------------------------------------------------------------
  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const keyOf = (e) => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key || '');
  function onKey(e) {
    if (!open || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    const k = keyOf(e);
    if (k === 'Escape') { e.preventDefault(); closeCourt(); return; }
    if (k === 'p') { if (paused) resume(); else pause(); e.preventDefault(); return; }
    // Buttons on the card keep their own Enter and Space.
    if ((k === ' ' || k === 'Enter') && e.target && e.target.closest && e.target.closest('.bad-card button')) return;
    if (k === 'a' || k === 'ArrowLeft') { me.keyL = true; me.target = null; }
    else if (k === 'd' || k === 'ArrowRight') { me.keyR = true; me.target = null; }
    else if (k === 'w' || k === 'ArrowUp') me.modUp = true;
    else if (k === 's' || k === 'ArrowDown') me.modDown = true;
    else if (k === ' ' || k === 'j' || k === 'k') { if (!e.repeat) { me.flick = ''; swing(); } }
    else return;
    e.preventDefault();
  }
  function onKeyUp(e) {
    const k = keyOf(e);
    if (k === 'a' || k === 'ArrowLeft') me.keyL = false;
    else if (k === 'd' || k === 'ArrowRight') me.keyR = false;
    else if (k === 'w' || k === 'ArrowUp') me.modUp = false;
    else if (k === 's' || k === 'ArrowDown') me.modDown = false;
  }
  function onBlur() { me.keyL = me.keyR = me.modUp = me.modDown = false; me.target = null; drag = null; }
  function onVis() { if (document.hidden) { onBlur(); pause(); } }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);

  // Pointer: press swings (a touch only when the shuttle is on its way to you),
  // dragging moves you like a trackpad, a quick flick up or down picks the shot.
  // Serving happens on release, so you can shuffle into place first.
  let drag = null;
  court.addEventListener('pointerdown', (e) => {
    if (!open || e.target.closest('button, .bad-card')) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    sound.unlock();
    me.flick = '';
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, me0: me.x, t0: wall };
    try { court.setPointerCapture(e.pointerId); } catch (err) {}
    if (paused || phase !== 'rally') return;
    if (e.pointerType === 'mouse' || (sh.last !== 'me' && !sh.down && sh.x < 2)) swing();
  });
  court.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id || paused) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (Math.abs(dx) > 6) me.target = drag.me0 + (dx / s) * 1.3;
    if (wall - drag.t0 < 400 && Math.abs(dy) > 24 && Math.abs(dy) > Math.abs(dx)) me.flick = dy < 0 ? 'clear' : 'drop';
  });
  const letGo = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    me.target = null;
    if (e.type === 'pointerup' && phase === 'serve' && server === 'me' && !paused && wall - d.t0 < 700 && Math.abs(e.clientX - d.x0) < 12) swing();
  };
  court.addEventListener('pointerup', letGo);
  court.addEventListener('pointercancel', letGo);
  court.addEventListener('contextmenu', (e) => e.preventDefault());
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    sound.unlock();
    const a = b.dataset.a;
    if (a === 'again') startGame();
    else if (a === 'resume') resume();
    else if (a === 'quit') closeCourt();
  });
  startBtn.addEventListener('click', openCourt);
  xBtn.addEventListener('click', closeCourt);
  snd.addEventListener('click', () => {
    sound.unlock();
    const siteMute = document.querySelector('.dl-mute');
    if (siteMute) siteMute.click();
    else { try { localStorage.setItem('dl-sound', sound.muted() ? '1' : '0'); } catch (err) {} }
    snd.classList.toggle('muted', sound.muted());
  });

  const ro = new ResizeObserver(() => { measure(); hudKey = ''; });
  ro.observe(court);
  const mo = new MutationObserver(readColors);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  // ---- Go -------------------------------------------------------------------------------
  raf = requestAnimationFrame(frame);

  return function stop() {
    if (dead) return;
    dead = true;
    cancelAnimationFrame(raf);
    removeEventListener('keydown', onKey);
    removeEventListener('keyup', onKeyUp);
    removeEventListener('blur', onBlur);
    document.removeEventListener('visibilitychange', onVis);
    ro.disconnect();
    mo.disconnect();
    timers = [];
    hush();
    sound.close();
    // Mid-rally page swap: the floating head still goes home.
    giveBack(reduce ? 0 : 800);
    if (shrink) shrink.cancel();
    if (over.isConnected) {
      over.remove();
      document.documentElement.style.overflow = scrollWas;
    }
    root.remove();
    styleUsers = Math.max(0, styleUsers - 1);
    if (!styleUsers) { const st = document.getElementById('bad-style'); if (st) st.remove(); }
  };
}
