/* Muay Thai sparring against the head. Loaded by site.js on /hobbies/muay-thai/.
   mount(el) builds the game inside el and returns a cleanup function.
   Everything runs off one rAF loop on a game clock, so pausing is just not
   advancing the clock. Sounds are synthesized, no files.

   How a fight reads: the head shifts between stances, and each one is beaten
   by a different tool.
     open   anything lands
     guard  punches get blocked, teeps and kicks go through
     slip   straight punches miss, hooks catch it
     knee   kicks get checked (hurts you), punches land
   It winds up before it throws: slip the punches, block the kicks. */

const HEAD = { w: 269, h: 344, mouth: 0.795, mouthX: [0.35, 0.669], cut: [0.152, 0.829] };
const FACES = {
  neutral: '/media/head.webp',
  blink: '/media/head-blink.webp',
  angry: '/media/head-angry.webp',
  sad: '/media/head-sad.webp',
  happy: '/media/head-happy.webp'
};
const FIST = { src: '/media/hands/fist.webp', w: 300, h: 400 };

const ROUNDS = 3;
const ROUND_MS = 45000;
const BREAK_MS = 8000;

// hit: ms from press to contact. rec: ms to get back. st: stamina. pts: what
// the judges give a clean one (they like kicks).
const MOVES = {
  jab: { name: 'jab', key: 'j', hit: 120, rec: 170, st: 4, dmg: 0.65, pts: 1, hand: 'l' },
  cross: { name: 'cross', key: 'k', hit: 170, rec: 240, st: 6, dmg: 1.1, pts: 1.5, hand: 'r' },
  hook: { name: 'hook', key: 'l', hit: 230, rec: 290, st: 8, dmg: 1.45, pts: 2, hand: 'l' },
  teep: { name: 'teep', key: 'u', hit: 240, rec: 320, st: 7, dmg: 0.9, pts: 1.5, leg: true },
  kick: { name: 'kick', key: 'i', hit: 320, rec: 420, st: 12, dmg: 2, pts: 3, leg: true }
};
const ORDER = ['jab', 'cross', 'hook', 'teep', 'kick'];

// The head's own strikes on you.
const ATTACKS = {
  jab: { wind: 560, go: 120, back: 380, dmg: 4, pts: 1, st: 6, side: 1 },
  cross: { wind: 720, go: 130, back: 420, dmg: 6, pts: 1.5, st: 9, side: -1 },
  kick: { wind: 800, go: 170, back: 460, dmg: 8, pts: 3, st: 13, side: -1 }
};

// Everything the head says. David's texting voice: lowercase, short, no em dashes.
const L = {
  round: [
    ['ok light work. touch gloves', 'round 1. nice and easy'],
    ["round 2. i'm warmed up now", "ok round 2, let's move"],
    ["last round. let's have fun", 'final round. empty the tank']
  ],
  jab: ['ooo nice jab', "jab's working", 'pew', 'ok that jab is annoying'],
  cross: ['my nose 😭', 'ow ok', 'that one had something on it', 'ok the cross 😭'],
  hook: ['wait wait', 'not the ears 😭', 'ooo the hook', 'bro aimed for my ears'],
  teep: ['the teep!! textbook', 'pushed me like a door', 'rude. fair, but rude', 'ok push kick, i see you'],
  kick: ['ooo the kick 😭', "that's gonna bruise", 'my ribs', 'kicks score big btw. ow'],
  caught: ['caught me slipping. literally', 'ok the hook found me', 'you read that 😭'],
  counter: ['ooo counter', 'you timed that', 'ok i walked into that'],
  broke: ['guard broken 😭', 'teep through the guard, smart'],
  blocked: ["guard's up", 'nope', 'high guard baby', 'blocked'],
  miss: ['missed me', 'whiff', 'too slow', 'over here'],
  checked: ['checked 😬 shin ok?', "check!! that hurts you more than me", "don't kick the knee 😭", 'shin on shin. ouch'],
  stopped: ["knee's up", 'nope, knee'],
  read: ['saw that coming', 'same one again? 👀', "i'm learning", "you're predictable 😅"],
  slipped: ['ooo slick', "where'd you go", 'ok you slipped that', 'nice head movement'],
  blockYou: ['good guard', 'nice block', 'hands up, good'],
  hitYou: ['sorry!! you ok?', 'keep your hands up', 'hands up!', 'chin down', 'my bad that was a bit fast'],
  kickYou: ["block the kicks, you can't slip those", 'sorry that was meant to be light', 'body kick 😅'],
  combo: ['wait wait wait', 'ok combo 😭', 'ok you got me', 'timeout timeout'],
  gassed: ["breathe, you're gassing", 'breathe', 'pace yourself'],
  tired: ["i'm so gassed", 'cardio check', 'hold on i need air'],
  hurt: ["ok i'm hurting", 'i see stars', 'be gentle 😭'],
  roundYou: ['ok that round was yours', 'you took that one', 'you won that round fr'],
  roundHead: ['i think i took that one 😅', 'my round i think', "that one's mine. sorry"],
  roundEven: ['close round', 'even round'],
  tip: {
    hit: ['tip: glove pulls back, slip it. knee swings out, block it', 'tip: slip my punches, block my kicks'],
    checked: ["tip: don't kick when my knee's up. punch it", 'tip: knee up means punches, not kicks'],
    blocked: ["tip: when my guard's up, kick or teep through it", 'tip: high guard? go to the body'],
    miss: ['tip: hooks catch me when i slip', 'tip: if i lean, throw the hook'],
    nokick: ['tip: kicks score the most. judges love them', 'tip: throw some kicks, they score big'],
    gassed: ["tip: watch your stamina, tired strikes don't do much", 'tip: slow down a bit, breathe between combos'],
    good: ["you're doing great. breathe", 'hands up, chin down. looking good', "nice. keep mixing it up"]
  },
  win: ['good fight. you got me', "ok you won. don't tell my beginner class", 'good spar!! you won that'],
  ko: ['ok you got me', "i'm seeing stars 😵", 'lights out. good fight'],
  lose: ['i edged that one. run it back?', 'good spar though. again?', "ok that one's mine. again?"],
  koYou: ['oh no you ok?? 😭', 'sorry!! hands up next time', 'that one was too hard, my bad'],
  draw: ['draw. fair', 'even. run it back?'],
  paused: ['take your time', 'water break', 'shake it out']
};

const CSS = `
.mt, .mt-over { --mt-a: #88c0d0; color: var(--t1); -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
.mt { position: relative; max-width: 760px; }
:is(.mt, .mt-over) [hidden] { display: none !important; }
/* In the page: an empty ring. The head waits in its corner until you spar. */
.mt-start { position: relative; isolation: isolate; display: grid; place-items: center; min-height: clamp(230px, 32vw, 290px); padding: 32px 20px; border-radius: 16px; background: var(--fill); overflow: hidden; text-align: center; }
.mt-start > .mt-ropes, .mt-start > .mt-floor { position: absolute; left: 0; }
.mt-start > .mt-ropes { top: 0; }
.mt-start-in { position: relative; z-index: 1; }
.mt-start .h { font-weight: 500; }
.mt-start .p { max-width: 30em; margin-top: 2px; color: var(--t2); }
.mt-start .mt-go { margin-top: 18px; }
.mt-start .s { min-height: 1.45em; margin-top: 12px; color: var(--t3); font-size: 13px; line-height: 1.45; }
/* The fight: over the whole page. */
.mt-over { position: fixed; inset: 0; z-index: 65; display: flex; flex-direction: column; padding: max(14px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left)); background: var(--bg); touch-action: none; overscroll-behavior: contain; }
.mt-over > * { flex: none; width: 100%; max-width: 1180px; margin-left: auto; margin-right: auto; }
.mt-over > .mt-ring { flex: 1; min-height: 0; }
/* An older talk.js without dlHead: keep its head out of the way instead. */
body:has(.mt-over.solo) .dl { visibility: hidden; }
.mt-hud { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: end; gap: 22px; margin-bottom: 14px; }
.mt-who { display: flex; justify-content: space-between; gap: 8px; color: var(--t3); font-size: 13px; line-height: 1.2; }
.mt-them .mt-who { flex-direction: row-reverse; }
.mt-who b { font-weight: 400; color: var(--t2); }
.mt-bar { position: relative; height: 5px; margin-top: 7px; border-radius: 3px; background: var(--fill); overflow: hidden; }
.mt-bar i { position: absolute; inset: 0; border-radius: inherit; background: var(--t1); transform-origin: 0 50%; }
.mt-bar i.trail { background: var(--t3); }
.mt-them .mt-bar i { transform-origin: 100% 50%; }
.mt-bar.st { height: 3px; margin-top: 5px; }
.mt-bar.st i { background: var(--mt-a); }
.mt-bar.st.low i { background: var(--t3); }
.mt-clock { display: flex; flex-direction: column; align-items: center; line-height: 1.2; }
.mt-clock .r { font-size: 13px; color: var(--t3); }
.mt-clock .tm { margin-top: 3px; font-size: 22px; font-weight: 500; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.mt-ring { position: relative; isolation: isolate; border-radius: 16px; background: var(--fill); overflow: hidden; touch-action: manipulation; }
.mt-ring > * { position: absolute; left: 0; top: 0; }
.mt-ropes { width: 100%; height: 100%; pointer-events: none; }
.mt-ropes i { position: absolute; left: -10%; width: 120%; height: 1px; background: var(--rule); }
.mt-floor { top: auto; bottom: 0; width: 100%; height: 34%; background: var(--fill); }
.mt-shadow { z-index: 1; border-radius: 50%; background: rgba(0, 0, 0, 0.13); filter: blur(4px); }
[data-theme="dark"] .mt-shadow { background: rgba(0, 0, 0, 0.5); }
.mt-hd, .mt-glove, .mt-knee, .mt-my { will-change: transform; pointer-events: none; }
.mt-hd { z-index: 3; }
.mt-glove { z-index: 4; }
.mt-glove.go { z-index: 7; }
.mt-knee { z-index: 2; }
.mt-knee svg { display: block; width: 100%; height: 100%; overflow: visible; }
.mt-knee .pad { fill: var(--t1); }
.mt-knee .seam { fill: none; stroke: var(--bg); stroke-width: 1.4; stroke-linecap: round; opacity: 0.5; }
.mt-sq { position: absolute; inset: 0; transform-origin: 50% 100%; }
.mt-skull, .mt-jaw { position: absolute; inset: 0; }
.mt-skull { z-index: 2; transform-origin: 18% 79.5%; }
.mt-jaw { z-index: 3; }
.mt-over .mt-skull img, .mt-over .mt-jaw img, .mt-over .mt-glove img, .mt-over .mt-my img { position: absolute; inset: 0; width: 100%; height: 100%; max-width: none; pointer-events: none; -webkit-user-drag: none; }
.mt-over .mt-skull img { z-index: 2; clip-path: inset(0 0 19.9% 0); }
.mt-over .mt-jaw img { clip-path: inset(79.5% 0 0 0); }
.mt-cavity { position: absolute; z-index: 1; left: 16.7%; right: 18.6%; top: 59.5%; height: 21%; border-radius: 12% 12% 46% 46% / 20% 20% 70% 70%; background: radial-gradient(ellipse 34% 30% at 50% 100%, #b23a4a 0 98%, transparent 100%), linear-gradient(#120707, #3a1216); }
.mt-teeth { position: absolute; z-index: 1; left: 37%; right: 35.1%; top: calc(79.5% - 1px); height: 3.6%; border-radius: 0 0 5px 5px; background: #f7f3ea; }
.mt-fx { z-index: 5; width: 100%; height: 100%; overflow: visible; pointer-events: none; }
.mt-fx path { fill: none; stroke-linecap: round; }
.mt-my { z-index: 6; }
.mt-flash { z-index: 8; width: 100%; height: 100%; opacity: 0; pointer-events: none; background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.32)); }
[data-theme="dark"] .mt-flash { background: radial-gradient(ellipse at 50% 50%, transparent 40%, rgba(0, 0, 0, 0.7)); }
.mt-pop { z-index: 8; font-size: 13px; line-height: 1; color: var(--t2); white-space: nowrap; pointer-events: none; }
.mt-pop.good { color: var(--t1); font-weight: 500; }
.mt-ping { z-index: 8; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; border: 2px solid var(--mt-a); pointer-events: none; }
.mt-say { z-index: 9; width: max-content; max-width: min(230px, 64%); padding: 7px 12px; border-radius: 14px; background: var(--talk-paper, var(--bg)); color: var(--talk-ink, var(--t1)); box-shadow: 0 0 0 1px var(--rule), 0 10px 28px -14px rgba(0, 0, 0, 0.3); font-size: 14px; line-height: 1.35; opacity: 0; transition: opacity 160ms ease; pointer-events: none; }
.mt-say.on { opacity: 1; }
.mt-big { z-index: 9; width: 100%; top: 14%; margin-top: -0.7em; text-align: center; font-size: 26px; font-weight: 500; letter-spacing: -0.02em; opacity: 0; transition: opacity 180ms ease; pointer-events: none; }
.mt-big.on { opacity: 1; }
.mt-card { z-index: 10; top: auto; left: 50%; bottom: 14px; width: max-content; max-width: calc(100% - 28px); padding: 14px 22px; border-radius: 14px; background: var(--panel); box-shadow: 0 0 0 1px var(--rule), 0 18px 40px -22px rgba(0, 0, 0, 0.35); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); text-align: center; transform: translateX(-50%); }
.mt-card .h { color: var(--t1); font-weight: 500; }
.mt-card .p { margin-top: 2px; color: var(--t2); }
.mt-card .s { margin-top: 10px; color: var(--t3); font-size: 13px; line-height: 1.45; }
.mt-card .cards { display: flex; justify-content: center; gap: 14px; margin-top: 8px; color: var(--t3); font-size: 13px; font-variant-numeric: tabular-nums; }
.mt-card .cards b { font-weight: 400; color: var(--t1); }
.mt-card .row { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 14px; }
.mt-go { padding: 9px 26px; border: 0; border-radius: 999px; background: var(--mt-a); color: #0e1a1f; font: inherit; font-weight: 500; cursor: pointer; transition: transform 120ms ease, filter 120ms ease; }
.mt-go:hover { filter: brightness(1.06); }
.mt-go:active { transform: scale(0.97); }
:is(.mt, .mt-over) .mt-go:focus-visible { border-radius: 999px; }
.mt-over .mt-btn:focus-visible { border-radius: 12px; }
.mt-over .mt-ic:focus-visible { border-radius: 50%; }
.mt-alt { padding: 9px 12px; border: 0; background: none; color: var(--t2); font: inherit; cursor: pointer; }
.mt-alt:hover { color: var(--t1); }
.mt-tools { z-index: 11; top: 8px; left: auto; right: 8px; display: flex; gap: 2px; }
.mt-ic { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--t3); cursor: pointer; }
.mt-ic:hover { color: var(--t1); background: var(--rule); }
.mt-ic svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.mt-snd .off, .mt-snd.muted .on { display: none; }
.mt-snd.muted .off { display: block; }
.mt-help { margin-top: 10px; color: var(--t3); font-size: 13px; line-height: 1.45; }
.mt-pad { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 5fr); gap: 8px; margin-top: 12px; transition: opacity 200ms ease; }
.mt-pad.off { opacity: 0.4; pointer-events: none; }
.mt-grp { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); gap: 8px; }
.mt-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; height: 56px; padding: 0 4px; border: 0; border-radius: 12px; background: var(--fill); color: var(--t1); font: inherit; font-size: 14px; line-height: 1.1; cursor: pointer; touch-action: none; transition: background 120ms ease, transform 90ms ease, color 120ms ease; }
.mt-btn kbd { font: inherit; font-size: 11px; color: var(--t3); text-transform: uppercase; }
.mt-def .mt-btn { color: var(--t2); }
.mt-btn.on { background: var(--rule); color: var(--t1); transform: scale(0.96); }
.mt-btn.low { color: var(--t3); }
@media (hover: hover) { .mt-btn:hover { background: var(--rule); } }
@media (hover: none) { .mt-btn kbd { display: none; } }
@media (max-width: 560px) {
  .mt-hud { gap: 12px; }
  .mt-clock .tm { font-size: 20px; }
  .mt-pad { grid-template-columns: minmax(0, 1fr); }
  .mt-def { order: 2; }
  .mt-btn { height: 52px; }
}
`;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - (1 - t) * (1 - t);
const lastPicked = new WeakMap();
function pick(arr) {
  let i = Math.floor(Math.random() * arr.length);
  if (arr.length > 1 && i === lastPicked.get(arr)) i = (i + 1) % arr.length;
  lastPicked.set(arr, i);
  return arr[i];
}

// ---- Sound: thuds, whooshes and a bell, synthesized ----------------------
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
  function env(g, t, vol, dur, attack = 0.004) {
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
      env(g, t, vol, dur, 0.006);
      src.connect(f).connect(g).connect(out);
      src.start(t, Math.random() * 0.3);
      src.stop(t + dur + 0.03);
    },
    thud(p = 1) { s.tone(150, 46, 0.16, 0.55 * p); s.hiss(0.07, 0.3 * p, 'lowpass', 1500, 260); },
    slap(p = 1) { s.thud(p); s.hiss(0.05, 0.22 * p, 'highpass', 2600, 1800); },
    tok() { s.tone(300, 170, 0.07, 0.22, 'triangle'); s.hiss(0.045, 0.1, 'bandpass', 900, 600, 2); },
    check() { s.tone(620, 340, 0.1, 0.25, 'triangle'); s.thud(0.6); },
    whoosh(p = 1) { s.hiss(0.1 + 0.08 * p, 0.07 + 0.05 * p, 'bandpass', 450, 2200, 1.3); },
    hurt() { s.tone(120, 40, 0.24, 0.6); s.hiss(0.12, 0.3, 'lowpass', 1000, 180); },
    blip() { s.tone(rand(380, 520), rand(300, 360), 0.05, 0.035, 'square'); },
    bell(n = 1) {
      for (let i = 0; i < n; i++) {
        [[903, 0.22, 1.6], [1478, 0.12, 1.2], [2357, 0.07, 0.8], [3121, 0.04, 0.5]].forEach(([f, v, d]) => s.tone(f, f * 0.995, d, v, 'sine', i * 0.34));
      }
    },
    close() {
      if (ctx) ctx.close().catch(() => {});
      ctx = out = noise = null;
    }
  };
  return s;
}

let styleUsers = 0;
let uid = 0;

export function mount(el) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const id = ++uid;
  let style = document.getElementById('mt-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'mt-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  styleUsers++;

  const faces = Object.keys(FACES).map((f, i) => `<img alt="" draggable="false" data-f="${f}" src="${FACES[f]}"${i ? ' hidden' : ''}>`).join('');
  const fist = (flip) => `<img alt="" draggable="false" src="${FIST.src}"${flip ? ' style="transform:scaleX(-1)"' : ''}>`;
  const bar = (k) => `<div class="mt-bar hp"><i class="trail"></i><i class="fill"></i></div><div class="mt-bar st"><i></i></div>`;
  const ropes3 = '<i style="top:21%"></i><i style="top:32%"></i><i style="top:43%"></i>';
  const root = document.createElement('div');
  root.className = 'mt';
  root.innerHTML = `
    <div class="mt-start">
      <div class="mt-ropes" aria-hidden="true">${ropes3}</div>
      <div class="mt-floor" aria-hidden="true"></div>
      <div class="mt-start-in">
        <p class="h">Spar with the head</p>
        <p class="p">Three ${ROUND_MS / 1000} second rounds, light contact. It'll come over when you're ready.</p>
        <button class="mt-go" type="button" data-a="spar">Spar</button>
        <p class="s"></p>
      </div>
    </div>`;
  el.appendChild(root);
  const startBtn = root.querySelector('.mt-start .mt-go');
  const startNote = root.querySelector('.mt-start .s');

  // The fight lives in its own layer over the page, attached only while you spar.
  const over = document.createElement('div');
  over.className = 'mt-over';
  over.setAttribute('role', 'dialog');
  over.setAttribute('aria-label', 'Sparring with the head');
  over.innerHTML = `
    <div class="mt-hud">
      <div class="mt-side mt-you"><div class="mt-who"><span>You</span><b></b></div>${bar()}</div>
      <div class="mt-clock"><span class="r">Round 1 of ${ROUNDS}</span><span class="tm">0:45</span></div>
      <div class="mt-side mt-them"><div class="mt-who"><span>The head</span><b></b></div>${bar()}</div>
    </div>
    <div class="mt-ring" aria-label="Sparring ring">
      <div class="mt-ropes" aria-hidden="true">${ropes3}</div>
      <div class="mt-floor" aria-hidden="true"></div>
      <div class="mt-shadow" aria-hidden="true"></div>
      <div class="mt-knee" aria-hidden="true"><svg viewBox="0 0 40 88"><path class="pad" d="M6 14Q6 2 20 2T34 14L33 54Q33 62 28 68L27 72Q37 75 38 83Q38 87 33 87H9Q5 87 6 83L13 72L12 68Q7 62 7 54Z"/><path class="seam" d="M8 28Q20 34 32 28M20 36V64"/></svg></div>
      <div class="mt-hd" aria-hidden="true"><div class="mt-sq"><div class="mt-cavity"></div><div class="mt-skull"><div class="mt-teeth"></div>${faces}</div><div class="mt-jaw">${faces}</div></div></div>
      <div class="mt-glove a" aria-hidden="true">${fist(true)}</div>
      <div class="mt-glove b" aria-hidden="true">${fist(false)}</div>
      <svg class="mt-fx" aria-hidden="true">
        <defs>
          <linearGradient id="mt-gm${id}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#88c0d0" stop-opacity="0.15"/><stop offset="0.6" stop-color="#88c0d0" stop-opacity="0.8"/><stop offset="1" stop-color="#88c0d0" stop-opacity="1"/></linearGradient>
          <linearGradient id="mt-gf${id}" gradientUnits="userSpaceOnUse"><stop offset="0" style="stop-color:var(--t1)" stop-opacity="0"/><stop offset="1" style="stop-color:var(--t1)" stop-opacity="0.55"/></linearGradient>
        </defs>
        <path class="sw-ghost" style="stroke:var(--t3)"/>
        <path class="sw-foe" stroke="url(#mt-gf${id})"/>
        <path class="sw-me" stroke="url(#mt-gm${id})"/>
      </svg>
      <div class="mt-my l" aria-hidden="true">${fist(true)}</div>
      <div class="mt-my r" aria-hidden="true">${fist(false)}</div>
      <div class="mt-flash" aria-hidden="true"></div>
      <div class="mt-say" aria-hidden="true"></div>
      <div class="mt-big" aria-hidden="true"></div>
      <div class="mt-card"></div>
      <div class="mt-tools">
        <button class="mt-ic mt-snd" type="button" aria-label="Sound on or off">
          <svg class="on" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>
          <svg class="off" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>
        </button>
        <button class="mt-ic mt-x" type="button" aria-label="Stop sparring"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg></button>
      </div>
    </div>
    <div class="mt-pad off">
      <div class="mt-grp mt-def">
        <button class="mt-btn" type="button" data-k="block">Block<kbd>S</kbd></button>
        <button class="mt-btn" type="button" data-k="slip">Slip<kbd>Space</kbd></button>
      </div>
      <div class="mt-grp mt-str">${ORDER.map((k) => `<button class="mt-btn" type="button" data-k="${k}">${k[0].toUpperCase() + k.slice(1)}<kbd>${MOVES[k].key}</kbd></button>`).join('')}</div>
    </div>
    <p class="sr mt-sr" aria-live="polite"></p>
    <p class="mt-help">Slip punches, block kicks. Kick through a high guard, punch a lifted knee, hook a slip.</p>`;

  const $ = (s) => over.querySelector(s);
  const ring = $('.mt-ring');
  const hd = $('.mt-hd');
  const sq = $('.mt-sq');
  const skull = $('.mt-skull');
  const jaw = $('.mt-jaw');
  const faceImgs = [...over.querySelectorAll('.mt-hd img')];
  const gA = $('.mt-glove.a');
  const gB = $('.mt-glove.b');
  const knee = $('.mt-knee');
  const shadow = $('.mt-shadow');
  const ropes = $('.mt-ropes');
  const fx = $('.mt-fx');
  const swMe = $('.sw-me');
  const swFoe = $('.sw-foe');
  const swGhost = $('.sw-ghost');
  const gradMe = $(`#mt-gm${id}`);
  const gradFoe = $(`#mt-gf${id}`);
  const myL = $('.mt-my.l');
  const myR = $('.mt-my.r');
  const flash = $('.mt-flash');
  const sayEl = $('.mt-say');
  const srEl = $('.mt-sr');
  const big = $('.mt-big');
  const card = $('.mt-card');
  const snd = $('.mt-snd');
  const pad = $('.mt-pad');
  const btns = {};
  over.querySelectorAll('.mt-btn').forEach((b) => { btns[b.dataset.k] = b; });
  const xBtn = $('.mt-x');
  const hud = {
    clockR: $('.mt-clock .r'),
    clockT: $('.mt-clock .tm'),
    me: { hp: $('.mt-you .hp .fill'), trail: $('.mt-you .hp .trail'), st: $('.mt-you .st i'), stBar: $('.mt-you .st'), tag: $('.mt-you .mt-who b') },
    foe: { hp: $('.mt-them .hp .fill'), trail: $('.mt-them .hp .trail'), st: $('.mt-them .st i'), stBar: $('.mt-them .st'), tag: $('.mt-them .mt-who b') }
  };

  const sound = makeSound();

  // ---- Size ---------------------------------------------------------------
  let W = 0, H = 0, hw = 0, hh = 0, gw = 0, gh = 0, mw = 0, mh = 0;
  function measure() {
    W = ring.clientWidth;
    H = ring.clientHeight;
    hw = clamp(Math.min(W * 0.19, H * 0.28), 92, 180);
    hh = (hw * HEAD.h) / HEAD.w;
    gw = hw * 0.46;
    gh = (gw * FIST.h) / FIST.w;
    mw = clamp(hw * 0.85, 72, 150);
    mh = (mw * FIST.h) / FIST.w;
    const px = (e, w, h) => { e.style.width = w + 'px'; e.style.height = h + 'px'; };
    px(hd, hw, hh);
    px(gA, gw, gh);
    px(gB, gw, gh);
    px(knee, hw * 0.32, hw * 0.7);
    px(shadow, hw * 0.8, hw * 0.13);
    px(myL, mw, mh);
    px(myR, mw, mh);
    fx.setAttribute('viewBox', `0 0 ${W} ${H}`);
  }

  // ---- State --------------------------------------------------------------
  // `clock` is game time in ms. It only moves while the game isn't paused.
  let clock = 0;
  let raf = 0;
  let lastTs = 0;
  let phase = 'intro'; // intro, ready, fight, ko, break, end
  let paused = false;
  let round = 1;
  let roundLeft = ROUND_MS;
  let breakEnd = 0;
  let timers = [];
  const after = (ms, fn) => { timers.push({ at: clock + ms, fn }); };
  const spd = () => [1, 0.88, 0.78][round - 1] || 0.78;
  const tele = () => [200, 170, 145][round - 1] || 145;

  const me = { hp: 100, st: 100, act: null, buffer: null, blockKey: false, blockBtn: false, slip: null, slipSide: 1, counterUntil: 0, combo: 0, comboAt: -1e9, lastLand: -1e9, regenAt: 0, hist: [], hitAt: -1e9, hitPow: 0, joltAt: -1e9, gassedAt: -1e9, down: false };
  const foe = { hp: 100, st: 100, pose: 'open', poseT: 0, until: 0, side: 1, atk: null, stunUntil: 0, nextAtk: 0, kbAt: -1e9, kbPow: 0, sqAt: -1e9, oofAt: -1e9, ko: false, read: false, hurtSaid: false, tiredAt: -1e9 };
  let score = { me: 0, foe: 0 };
  let cards = [];
  let stats = null;
  let koAt = 0;
  const blocking = () => (me.blockKey || me.blockBtn) && !me.act && phase === 'fight';

  // ---- The head's stances -------------------------------------------------
  function setPose(p, dur, side) {
    foe.pose = p;
    foe.poseT = clock;
    foe.until = clock + dur;
    if (side) foe.side = side;
  }
  // What a strike meets if it lands right now. A stance takes `tele` ms to
  // settle, and while it's moving it's open.
  function foeDef() {
    if (foe.atk) return foe.atk.phase === 'back' ? 'open' : 'wind';
    if (clock < foe.stunUntil) return 'stun';
    if (clock - foe.poseT < tele()) return 'open';
    return foe.pose;
  }
  function planPose() {
    const h = me.hist;
    const c = (n) => h.filter((x) => x === n).length;
    const tired = foe.st < 30;
    if (foe.pose !== 'open' && Math.random() < 0.3) {
      setPose('open', rand(450, 900) * spd());
      return;
    }
    const w = {
      open: Math.max(0.8, 1.8 - (round - 1) * 0.4) + (tired ? 1.5 : 0),
      guard: 2 + (c('jab') + c('cross') + c('hook')) * 0.22 + (tired ? 1.5 : 0),
      slip: 1.6 + (c('jab') + c('cross')) * 0.22,
      check: 1.1 + c('kick') * 0.45 + c('teep') * 0.2
    };
    if (foe.pose !== 'open') w[foe.pose] *= 0.3;
    let r = Math.random() * (w.open + w.guard + w.slip + w.check);
    let p = 'open';
    for (const k of ['open', 'guard', 'slip', 'check']) { r -= w[k]; if (r <= 0) { p = k; break; } }
    const dur = { open: rand(500, 1000), guard: rand(700, 1300), slip: rand(450, 800), check: rand(550, 950) }[p] * spd();
    setPose(p, dur, foe.pose === 'slip' ? -foe.side : Math.random() < 0.5 ? -1 : 1);
  }
  // Throw the same thing three times and it starts reading you.
  function maybeRead(m) {
    if (foe.atk || clock < foe.stunUntil || m.name === 'jab') return;
    const h = me.hist;
    const n = h.length;
    if (n < 3 || h[n - 1] !== h[n - 2] || h[n - 2] !== h[n - 3]) return;
    if (Math.random() > [0.35, 0.5, 0.62][round - 1]) return;
    const p = m.leg ? 'check' : m.name === 'hook' ? 'guard' : pick(['guard', 'slip']);
    setPose(p, rand(600, 900) * spd(), Math.random() < 0.5 ? -1 : 1);
    foe.read = true;
  }

  // ---- The head throws ----------------------------------------------------
  function startAttack(kind, quick) {
    const A = ATTACKS[kind];
    const wind = A.wind * spd() * (quick ? 0.6 : 1) * (foe.st < 25 ? 1.2 : 1);
    const side = kind === 'kick' ? (Math.random() < 0.5 ? -1 : 1) : A.side;
    foe.atk = { kind, A, side, t0: clock, wind, go: A.go, back: A.back, phase: 'wind', follow: null };
    foe.st = Math.max(0, foe.st - A.st);
    if (kind === 'jab' && Math.random() < 0.12 + 0.12 * round) foe.atk.follow = 'cross';
    setFace('angry', wind + 260);
    if (kind === 'kick') foeSwoosh(foe.atk);
  }
  function updateFoe(dt) {
    if (!foe.atk) foe.st = Math.min(100, foe.st + (7 * dt) / 1000);
    const a = foe.atk;
    if (a) {
      const e = clock - a.t0;
      if (a.phase === 'wind' && e >= a.wind) {
        a.phase = 'go';
        sound.whoosh(a.kind === 'kick' ? 1 : 0.6);
      }
      if (a.phase === 'go' && e >= a.wind + a.go) {
        a.phase = 'back';
        foeLands(a);
        if (phase !== 'fight') return;
      }
      if (a.phase === 'back' && e >= a.wind + a.go + a.back) {
        foe.atk = null;
        if (a.follow) startAttack(a.follow, true);
        else {
          setPose('open', rand(350, 700) * spd());
          foe.nextAtk = clock + rand(2000, 3800) * spd();
        }
      }
      return;
    }
    if (clock < foe.stunUntil) return;
    if (clock >= foe.until) planPose();
    if (me.st < 15 && foe.nextAtk - clock > 1400) foe.nextAtk = clock + rand(700, 1400);
    if (clock >= foe.nextAtk && foe.st > 14 && clock - foe.poseT > tele()) {
      const r = Math.random();
      const kick = 0.24 + 0.05 * round;
      startAttack(r < kick ? 'kick' : r < kick + (1 - kick) * 0.58 ? 'jab' : 'cross');
    }
    if (foe.st < 20 && clock - foe.tiredAt > 9000) { foe.tiredAt = clock; speak(L.tired, { chance: 0.7 }); }
  }
  function foeLands(a) {
    const A = a.A;
    const se = me.slip ? clock - me.slip.t0 : -1;
    const slipping = se >= 30 && se <= 340;
    const hx = W / 2;
    const hy = H * 0.72;
    if (slipping && a.kind !== 'kick') {
      me.counterUntil = clock + 800;
      foe.stunUntil = clock + 380;
      score.me += 0.4;
      stats.slips++;
      sound.whoosh(0.5);
      pop('slipped', hx, H * 0.5, true);
      setFace('blink', 380);
      speak(L.slipped, { chance: 0.6 });
      return;
    }
    if (blocking()) {
      me.hp -= A.dmg * (a.kind === 'kick' ? 0.3 : 0.2);
      me.st = Math.max(0, me.st - 4);
      if (a.kind === 'kick') score.foe += 0.5;
      stats.blocks++;
      me.joltAt = clock;
      sound.tok();
      pop('blocked', hx, hy, false);
      speak(L.blockYou, { chance: 0.3 });
    } else {
      me.hp -= A.dmg;
      me.st = Math.max(0, me.st - 3);
      score.foe += A.pts;
      stats.hit++;
      me.hitAt = clock;
      me.hitPow = a.kind === 'kick' ? 1.2 : a.kind === 'cross' ? 1 : 0.75;
      if (me.act && !me.act.done) me.act = null;
      sound.hurt();
      if (slipping) speak(L.kickYou[0], { prio: 2 });
      else speak(a.kind === 'kick' ? L.kickYou : L.hitYou, { chance: 0.5 });
    }
    if (me.hp <= 0) { me.hp = 0; ko('foe'); }
  }

  // ---- You throw ------------------------------------------------------------
  function strike(name) {
    if (phase !== 'fight' || paused) return;
    if (me.act || (me.slip && clock - me.slip.t0 < 260)) { me.buffer = { name, at: clock }; return; }
    const m = MOVES[name];
    const tired = me.st < m.st;
    const mult = tired ? 0.25 : 0.75 + 0.25 * (me.st / 100);
    me.st = Math.max(0, me.st - m.st);
    me.regenAt = clock + 350;
    const hit = m.hit * (tired ? 1.35 : 1);
    me.act = { m, t0: clock, hit, end: hit + m.rec * (tired ? 1.25 : 1), mult, tired, done: false, out: '', tx: 0, ty: 0 };
    me.hist.push(name);
    if (me.hist.length > 8) me.hist.shift();
    stats.thrown++;
    sound.whoosh(m.leg ? 0.9 : 0.4);
    if (m.leg) mySwoosh(m);
    maybeRead(m);
    if (tired) {
      stats.gassed++;
      if (clock - me.gassedAt > 7000) { me.gassedAt = clock; speak(L.gassed, { prio: 2 }); }
    }
  }
  function slip() {
    if (phase !== 'fight' || paused) return;
    if (me.slip && clock - me.slip.t0 < 420) return;
    if (me.act) {
      if (clock - me.act.t0 < me.act.hit) return;
      me.act = null;
    }
    me.slipSide = foe.atk ? -foe.atk.side : -me.slipSide;
    me.slip = { t0: clock, side: me.slipSide };
    me.st = Math.max(0, me.st - 3);
    sound.whoosh(0.3);
  }
  function updateMe(dt) {
    const a = me.act;
    if (a) {
      const e = clock - a.t0;
      if (!a.done && e >= a.hit) land(a);
      if (phase !== 'fight') return;
      if (me.act && e >= a.end) me.act = null;
    }
    if (me.slip && clock - me.slip.t0 > 420) me.slip = null;
    if (!me.act && me.buffer && !(me.slip && clock - me.slip.t0 < 260)) {
      const b = me.buffer;
      me.buffer = null;
      if (clock - b.at < 280) strike(b.name);
    }
    const rate = blocking() ? 3 : clock < me.regenAt ? 0 : 13;
    me.st = Math.min(100, me.st + (rate * dt) / 1000);
  }

  // Where things meet on the head, in ring pixels.
  const headAt = () => ({ x: W / 2 + cam.x + fp.hx * hw, y: cy + cam.y + fp.hy * hh });

  function land(a) {
    a.done = true;
    const m = a.m;
    const def = foeDef();
    let out;
    if (def === 'stun' || def === 'open') out = 'clean';
    else if (def === 'wind') out = 'counter';
    else if (def === 'guard') out = m.name === 'teep' ? 'break' : m.leg ? 'clean' : 'blocked';
    else if (def === 'slip') out = m.name === 'hook' ? 'caught' : m.leg ? 'clean' : 'miss';
    else out = m.name === 'kick' ? 'checked' : m.name === 'teep' ? 'stopped' : 'clean';
    if (out === 'clean' && clock < me.counterUntil) out = 'counter';
    a.out = out;
    const read = foe.read;
    foe.read = false;
    const h = headAt();
    let x = h.x + rand(-0.12, 0.12) * hw;
    let y = h.y + rand(-0.05, 0.12) * hh;
    if (m.name === 'kick') { x = h.x - hw * 0.4; y = h.y + hh * 0.55; }
    if (m.name === 'teep') { x = h.x; y = h.y + hh * 0.6; }
    const good = out === 'clean' || out === 'counter' || out === 'caught' || out === 'break';
    if (good) {
      const k = { clean: 1, counter: 1.5, caught: 1.4, break: 1 }[out];
      const dmg = m.dmg * k * a.mult;
      foe.hp = Math.max(0, foe.hp - dmg);
      foe.st = Math.max(0, foe.st - 2 - dmg);
      score.me += m.pts * (out === 'counter' ? 1.4 : out === 'caught' ? 1.3 : 1) * (a.tired ? 0.3 : 1);
      stats.landed++;
      if (m.leg) stats.kicks++;
      foe.kbAt = foe.sqAt = foe.oofAt = clock;
      foe.kbPow = m.name === 'teep' ? 1.8 : m.leg ? 1.1 : 0.45 + dmg * 0.18;
      setFace(m.leg ? 'sad' : pick(['blink', 'angry', 'sad']), 520);
      if (m.leg) sound.slap(m.name === 'kick' ? 1 : 0.7);
      else sound.thud(0.45 + m.dmg * 0.22);
      ping(x, y, m.leg ? 1.3 : 0.6 + m.dmg * 0.2);
      pop(out === 'counter' ? 'counter' : out === 'caught' ? 'caught it' : out === 'break' ? 'guard broken' : m.name, x, y - hh * 0.35, true);
      if (out === 'counter' && foe.atk && foe.atk.phase !== 'back' && m.name === 'teep') {
        foe.atk = null;
        foe.stunUntil = clock + 650;
        foe.until = foe.stunUntil;
        foe.nextAtk = clock + rand(1600, 2800) * spd();
      }
      if (out === 'break') { foe.stunUntil = clock + 650; foe.until = foe.stunUntil; }
      me.combo = clock - me.lastLand < 900 && !a.tired ? me.combo + 1 : 1;
      me.lastLand = clock;
      if (me.combo >= 3 && clock - me.comboAt > 4000) {
        me.combo = 0;
        me.comboAt = clock;
        foe.stunUntil = clock + 700;
        foe.until = Math.max(foe.until, foe.stunUntil);
        foe.atk = null;
        speak(L.combo, { prio: 2 });
      } else if (out === 'caught') speak(L.caught, { prio: 2 });
      else if (out === 'counter') speak(L.counter, { prio: 2, chance: 0.7 });
      else if (out === 'break') speak(L.broke, { prio: 2, chance: 0.7 });
      else if (foe.hp < 30 && !foe.hurtSaid) { foe.hurtSaid = true; speak(L.hurt, { prio: 2 }); }
      else speak(L[m.name], { chance: m.name === 'jab' || m.name === 'cross' ? 0.4 : 0.6 });
      if (foe.hp <= 0) ko('me');
      return;
    }
    if (out === 'checked') {
      me.hp = Math.max(0, me.hp - 4);
      me.st = Math.max(0, me.st - 8);
      score.foe += 1.5;
      stats.checked++;
      me.hitAt = clock;
      me.hitPow = 0.5;
      sound.check();
      ping(h.x + fp.kx * hw, h.y + fp.ky * hh, 1);
      pop('checked', h.x, h.y - hh * 0.6, false);
      setFace('happy', 700);
      speak(read ? L.read : L.checked, { prio: 2, chance: 0.85 });
      if (me.hp <= 0) { ko('foe'); return; }
    } else if (out === 'blocked') {
      stats.blocked++;
      sound.tok();
      pop('blocked', h.x, h.y - hh * 0.6, false);
      speak(read ? L.read : L.blocked, { chance: read ? 0.8 : 0.3 });
    } else if (out === 'miss') {
      stats.miss++;
      pop('miss', W / 2 + cam.x, cy - hh * 0.6, false);
      setFace('happy', 450);
      speak(read ? L.read : L.miss, { chance: read ? 0.8 : 0.35 });
    } else if (out === 'stopped') {
      sound.tok();
      pop('stopped', h.x, h.y - hh * 0.6, false);
      speak(L.stopped, { chance: 0.4 });
    }
    // It defended, so it might fire straight back.
    if (!foe.atk && clock >= foe.stunUntil && Math.random() < 0.3 + 0.1 * round) startAttack(Math.random() < 0.6 ? 'jab' : 'cross', true);
  }

  // ---- Talking --------------------------------------------------------------
  // Lines type out on wall time, so a pause doesn't freeze a sentence.
  let wall = 0;
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
    say.until = hold === Infinity ? Infinity : wall + 1100 + text.length * 45 + hold;
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

  let face = 'neutral';
  let faceWant = 'neutral';
  let faceUntil = 0;
  let blinkUntil = 0;
  let nextBlink = 0;
  function setFace(name, ms) { faceWant = name; faceUntil = ms ? clock + ms : Infinity; }
  function restFace() {
    if (foe.ko) return 'blink';
    if (phase !== 'intro' && phase !== 'end' && (foe.hp < 30 || foe.st < 20)) return 'sad';
    return 'neutral';
  }
  function showFace(name) {
    if (name === face) return;
    face = name;
    faceImgs.forEach((img) => { img.hidden = img.dataset.f !== name; });
  }

  // ---- Effects --------------------------------------------------------------
  function pop(text, x, y, good) {
    const e = document.createElement('span');
    e.className = 'mt-pop' + (good ? ' good' : '');
    e.textContent = text;
    ring.appendChild(e);
    const base = `translate(${clamp(x, 44, W - 44).toFixed(1)}px,${clamp(y, 16, H - 16).toFixed(1)}px) translate(-50%,-50%)`;
    const kf = reduce
      ? [{ transform: base, opacity: 0 }, { transform: base, opacity: 1, offset: 0.2 }, { transform: base, opacity: 0 }]
      : [{ transform: base + ' translateY(4px) scale(.9)', opacity: 0 }, { transform: base + ' scale(1)', opacity: 1, offset: 0.18 }, { transform: base + ' translateY(-26px)', opacity: 0 }];
    e.animate(kf, { duration: 850, easing: 'ease-out', fill: 'forwards' }).onfinish = () => e.remove();
  }
  function ping(x, y, s) {
    if (reduce) return;
    const e = document.createElement('i');
    e.className = 'mt-ping';
    ring.appendChild(e);
    const base = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
    e.animate([{ transform: base + ' scale(.3)', opacity: 1 }, { transform: base + ` scale(${(1.4 * s).toFixed(2)})`, opacity: 0 }], { duration: 340, easing: 'ease-out', fill: 'forwards' }).onfinish = () => e.remove();
  }
  function grad(g, x0, y0, x1, y1) {
    g.setAttribute('x1', x0); g.setAttribute('y1', y0); g.setAttribute('x2', x1); g.setAttribute('y2', y1);
  }
  // Kicks and teeps draw as a trail from the bottom of the view.
  const sw = { me: 0, foe: 0 };
  function mySwoosh(m) {
    const h = headAt();
    const kick = m.name === 'kick';
    const x0 = kick ? W * 0.98 : W * 0.6;
    const y0 = H + mh * 0.3;
    const x1 = kick ? h.x - hw * 0.5 : h.x + hw * 0.05;
    const y1 = h.y + hh * (kick ? 0.5 : 0.62);
    swMe.setAttribute('d', kick ? `M${x0} ${y0}Q${W * 0.86} ${h.y + hh * 0.3} ${x1} ${y1}` : `M${x0} ${y0}L${x1} ${y1}`);
    swMe.setAttribute('stroke-width', (mw * (kick ? 0.26 : 0.3)).toFixed(1));
    grad(gradMe, x0, y0, x1, y1);
    sw.me = swMe.getTotalLength();
    swMe.style.strokeDasharray = `${sw.me * 0.45} ${sw.me * 2}`;
  }
  function foeSwoosh(a) {
    const s = a.side;
    const h = headAt();
    const x0 = h.x + s * hw * 0.7;
    const y0 = h.y + hh * 0.45;
    const x1 = W / 2 - s * W * 0.45;
    const y1 = H + 40;
    const d = `M${x0} ${y0}Q${W / 2 + s * W * 0.1} ${H * 0.95} ${x1} ${y1}`;
    swFoe.setAttribute('d', d);
    swGhost.setAttribute('d', d);
    swFoe.setAttribute('stroke-width', (hw * 0.26).toFixed(1));
    swGhost.setAttribute('stroke-width', '2.5');
    swGhost.style.strokeDasharray = '1 10';
    grad(gradFoe, x0, y0, x1, y1);
    sw.foe = swFoe.getTotalLength();
    swFoe.style.strokeDasharray = `${sw.foe * 0.5} ${sw.foe * 2}`;
  }
  function bigText(t) {
    if (t) big.textContent = t;
    big.classList.toggle('on', !!t);
  }

  // ---- Rounds -------------------------------------------------------------------
  let cardKind = '';
  let before = null;
  function showCard(kind, html) { cardKind = kind; card.innerHTML = html; card.hidden = false; }
  function hideCard() { cardKind = ''; card.hidden = true; card.innerHTML = ''; }
  function focusGo() {
    const b = card.querySelector('.mt-go');
    const a = document.activeElement;
    if (b && (!a || a === document.body || over.contains(a))) b.focus({ preventScroll: true });
  }
  // ---- In and out of the ring ----------------------------------------------------
  // Spar: the layer grows out of the start panel, the site's floating head flies
  // from its corner to where ours stands, and ours takes over from there. Done:
  // the reverse, and the floating head goes home.
  const EASE = 'cubic-bezier(.45,.05,.25,1)';
  const site = () => window.dlHead;
  let open = false;
  let lent = false;
  let inRing = false;
  let inAt = 0;
  let scrollWas = '';
  let shrink = null;
  let lastResult = '';
  const lastHead = { x: 0, y: 0 };
  function panelClip() {
    const r = root.getBoundingClientRect();
    // Started by the head with the card hidden: open out of the middle.
    if (r.height < 40) return 'inset(42% 38% 42% 38% round 16px)';
    const t = clamp(r.top, 0, innerHeight);
    const b = clamp(innerHeight - r.bottom, 0, innerHeight - t);
    return `inset(${t.toFixed(0)}px ${Math.max(0, innerWidth - r.right).toFixed(0)}px ${b.toFixed(0)}px ${Math.max(0, r.left).toFixed(0)}px round 16px)`;
  }
  async function openRing() {
    if (open || dead) return;
    open = true;
    sound.unlock();
    if (shrink) { shrink.cancel(); shrink = null; }
    document.body.appendChild(over);
    scrollWas = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    measure();
    cy = H * 0.45;
    inRing = false;
    resetFight();
    phase = 'enter';
    pad.classList.add('off');
    hideCard();
    if (!reduce) over.animate([{ clipPath: panelClip(), opacity: 0.6 }, { clipPath: 'inset(0px 0px 0px 0px round 0px)', opacity: 1 }], { duration: 460, easing: EASE });
    const s = site();
    over.classList.toggle('solo', !s);
    if (s) {
      const r = ring.getBoundingClientRect();
      lent = true;
      try { await s.flyTo(r.left + W / 2 - hw / 2, r.top + cy - hh / 2, hw, reduce ? 0 : 950); } catch (e) {}
      if (!open || dead) return;
      s.away(true);
    }
    inRing = true;
    inAt = clock;
    foe.sqAt = clock;
    sound.thud(0.35);
    startFight();
  }
  // Hand the head back: the floating one appears where ours stands and flies home.
  function giveBack(ms) {
    const s = site();
    if (lent && s) {
      if (inRing) {
        const r = ring.getBoundingClientRect();
        s.flyTo(r.left + lastHead.x, r.top + lastHead.y, hw, 0);
        s.away(false);
      }
      s.home(ms);
    }
    lent = false;
    inRing = false;
    hd.style.visibility = 'hidden';
  }
  function closeRing() {
    if (!open) return;
    open = false;
    paused = false;
    timers = [];
    phase = 'intro';
    me.blockKey = me.blockBtn = false;
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
    startNote.textContent = lastResult;
    if (back) startBtn.focus({ preventScroll: true });
  }
  function resetFight() {
    Object.assign(me, { hp: 100, st: 100, act: null, buffer: null, slip: null, counterUntil: 0, combo: 0, comboAt: -1e9, lastLand: -1e9, hist: [], hitAt: -1e9, down: false, blockKey: false, blockBtn: false });
    Object.assign(foe, { hp: 100, st: 100, atk: null, stunUntil: 0, ko: false, read: false, hurtSaid: false, tiredAt: -1e9 });
    trail.me = trail.foe = 100;
    cards = [];
    round = 1;
    roundLeft = ROUND_MS;
    setFace('neutral', 1);
  }
  function startFight() {
    resetFight();
    pad.classList.remove('off');
    startRound();
  }
  function startRound() {
    phase = 'ready';
    timers = [];
    roundLeft = ROUND_MS;
    score = { me: 0, foe: 0 };
    stats = { thrown: 0, landed: 0, kicks: 0, blocked: 0, miss: 0, checked: 0, hit: 0, slips: 0, blocks: 0, gassed: 0 };
    me.act = me.slip = me.buffer = null;
    me.counterUntil = 0;
    me.combo = 0;
    foe.atk = null;
    foe.stunUntil = 0;
    foe.read = false;
    setPose('open', 1500);
    foe.nextAtk = clock + 1100 + rand(1200, 2200);
    hideCard();
    bigText(`Round ${round}`);
    sound.bell(1);
    speak(L.round[round - 1], { prio: 3 });
    after(1100, () => { if (phase === 'ready') { phase = 'fight'; bigText(''); } });
  }
  // Ten point must: the round goes to whoever scored more, kicks counting most.
  function judge() {
    const d = score.me - score.foe;
    if (Math.abs(d) < 1) return [10, 10];
    const wide = Math.abs(d) >= 24;
    return d > 0 ? [10, wide ? 8 : 9] : [wide ? 8 : 9, 10];
  }
  function tipLine() {
    const s = stats;
    if (s.hit >= 4 && s.slips + s.blocks < s.hit) return L.tip.hit;
    if (s.checked >= 2) return L.tip.checked;
    if (s.blocked >= 4) return L.tip.blocked;
    if (s.miss >= 3) return L.tip.miss;
    if (s.gassed >= 3) return L.tip.gassed;
    if (s.kicks === 0) return L.tip.nokick;
    return L.tip.good;
  }
  function endRound() {
    const c = judge();
    cards.push(c);
    me.act = me.slip = me.buffer = null;
    foe.atk = null;
    foe.stunUntil = 0;
    sound.bell(3);
    if (round >= ROUNDS) { finish(null); return; }
    phase = 'break';
    me.hp = Math.min(100, me.hp + 8);
    foe.hp = Math.min(100, foe.hp + 10);
    breakEnd = clock + BREAK_MS;
    setPose('open', BREAK_MS);
    const who = c[0] > c[1] ? 'you' : c[0] < c[1] ? 'the head' : 'even';
    showCard('break', `<p class="h">End of round ${round}</p><p class="p">Judges: ${c[0]}-${c[1]}, ${who}</p><div class="row"><button class="mt-go" type="button" data-a="next">Round ${round + 1}</button></div><p class="s">Starts in <span class="mt-cd">${BREAK_MS / 1000}</span>s</p>`);
    speak(c[0] > c[1] ? L.roundYou : c[0] < c[1] ? L.roundHead : L.roundEven, { prio: 3 });
    after(2300, () => { if (phase === 'break') speak(tipLine(), { prio: 3, hold: Infinity }); });
    after(BREAK_MS, nextRound);
  }
  function nextRound() {
    if (phase !== 'break') return;
    round++;
    startRound();
  }
  function ko(winner) {
    if (phase !== 'fight') return;
    phase = 'ko';
    timers = [];
    me.act = me.slip = me.buffer = null;
    foe.atk = null;
    if (winner === 'me') { foe.ko = true; setFace('blink'); } else { me.down = true; me.hitAt = clock; me.hitPow = 1.4; setFace('sad'); }
    koAt = clock;
    sound.bell(3);
    bigText('KO');
    after(1700, () => { bigText(''); finish(winner); });
  }
  function finish(winner) {
    phase = 'end';
    timers = [];
    pad.classList.add('off');
    me.blockKey = me.blockBtn = false;
    me.down = false;
    const tot = cards.reduce((s, c) => [s[0] + c[0], s[1] + c[1]], [0, 0]);
    let title, sub, line, f;
    if (winner === 'me') { title = 'You win'; sub = `KO in round ${round}`; line = L.ko; f = 'blink'; }
    else if (winner === 'foe') { title = 'The head wins'; sub = `KO in round ${round}`; line = L.koYou; f = 'sad'; }
    else if (tot[0] > tot[1]) { title = 'You win'; sub = `On points, ${tot[0]}-${tot[1]}`; line = L.win; f = 'happy'; }
    else if (tot[0] < tot[1]) { title = 'The head wins'; sub = `On points, ${tot[1]}-${tot[0]}`; line = L.lose; f = 'happy'; }
    else { title = 'Draw'; sub = `${tot[0]}-${tot[1]} on the cards`; line = L.draw; f = 'neutral'; }
    lastResult = `Last spar: ${title === 'Draw' ? 'a draw' : title === 'You win' ? 'you won' : 'the head won'}, ${winner ? `KO in round ${round}` : sub.replace('On points, ', '')}.`;
    setFace(f);
    const rows = cards.map((c, i) => `<span>R${i + 1} <b>${c[0]}-${c[1]}</b></span>`).join('');
    showCard('end', `<p class="h">${title}</p><p class="p">${sub}</p>${rows ? `<div class="cards">${rows}</div>` : ''}<div class="row"><button class="mt-go" type="button" data-a="again">Again</button><button class="mt-alt" type="button" data-a="quit">Done</button></div>`);
    speak(line, { prio: 3, hold: Infinity });
    focusGo();
  }
  function pause() {
    if (paused || !(phase === 'ready' || phase === 'fight' || phase === 'break')) return;
    paused = true;
    me.blockKey = me.blockBtn = false;
    before = card.hidden ? null : { kind: cardKind, html: card.innerHTML };
    showCard('pause', `<p class="h">Paused</p><div class="row"><button class="mt-go" type="button" data-a="resume">Resume</button><button class="mt-alt" type="button" data-a="quit">Quit</button></div>`);
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

  // ---- Drawing ------------------------------------------------------------------
  // fp is the head's pose as drawn: x in head widths, y in head heights, degrees.
  // a/b are its gloves (viewer's left and right), k is the knee it lifts.
  const REST = { hx: 0, hy: 0, hr: 0, hs: 1, ax: -0.6, ay: 0.32, as: 1, ar: -10, bx: 0.6, by: 0.32, bs: 1, br: 10, kx: 0.12, ky: 0.95, ko: 0, kr: 0 };
  const fp = { ...REST };
  const cam = { x: 0, y: 0 };
  const trail = { me: 100, foe: 100 };
  const mouth = { open: 0, kick: 0 };
  const hand = { l: { x: 0, y: 0, r: 0, s: 1 }, r: { x: 0, y: 0, r: 0, s: 1 } };
  let cy = 0;
  let hudKey = '';
  let cdShown = -1;
  let sndCheck = 0;
  const pressAt = {};

  function poseTarget() {
    const P = { ...REST };
    if (foe.ko) return Object.assign(P, { hx: 0.2, hy: 0.28, hr: 82, ax: -0.75, ay: 0.62, ar: -70, bx: 0.95, by: 0.58, br: 75 });
    if (phase !== 'ready' && phase !== 'fight' && phase !== 'ko') return P;
    const a = foe.atk;
    if (a) {
      const o = a.side;
      const k = clamp((clock - a.t0) / a.wind, 0, 1);
      const own = o < 0 ? 'a' : 'b';
      const other = o < 0 ? 'b' : 'a';
      if (a.kind === 'kick') {
        if (a.phase !== 'back') Object.assign(P, { hr: o * 10 * k, hx: -o * 0.08 * k, hy: -0.08 * k, ax: -0.24, ay: 0.12, as: 1.12, ar: -6, bx: 0.24, by: 0.12, bs: 1.12, br: 6, kx: o * (0.2 + 0.42 * k), ky: 0.74 - 0.14 * k, ko: a.phase === 'wind' ? 1 : 0, kr: o * (25 + 50 * k) });
      } else if (a.phase === 'wind') {
        // The punching glove draws back and the head leans off it.
        P.hr = -o * 7 * k;
        P.hx = -o * 0.1 * k;
        P[own + 'x'] = o * (0.6 + 0.28 * k);
        P[own + 'y'] = 0.32 - 0.08 * k;
        P[own + 's'] = 1 - 0.2 * k;
        P[own + 'r'] = o * (10 + 22 * k);
        P[other + 'x'] = -o * 0.22;
        P[other + 'y'] = 0.14;
        P[other + 's'] = 1.12;
        P[other + 'r'] = -o * 4;
      } else if (a.phase === 'go') {
        P.hr = o * 8;
        P.hx = o * 0.12;
        P[other + 'x'] = -o * 0.22;
        P[other + 'y'] = 0.14;
        P[other + 's'] = 1.12;
      }
      return P;
    }
    if (clock < foe.stunUntil) return Object.assign(P, { hy: 0.06, hs: 0.96, hr: reduce ? 6 : Math.sin(clock / 70) * 7, ax: -0.72, ay: 0.58, ar: -24, bx: 0.72, by: 0.58, br: 24 });
    const s = foe.side;
    if (foe.pose === 'guard') return Object.assign(P, { hy: 0.05, hs: 0.97, ax: -0.19, ay: 0.14, as: 1.16, ar: -4, bx: 0.19, by: 0.14, bs: 1.16, br: 4 });
    if (foe.pose === 'slip') return Object.assign(P, { hx: s * 0.55, hy: 0.1, hr: s * 15, ax: -0.6 + s * 0.32, ay: 0.38, bx: 0.6 + s * 0.32, by: 0.38 });
    if (foe.pose === 'check') return Object.assign(P, { hy: -0.16, hr: -3, ax: -0.76, ay: 0.12, ar: -18, bx: 0.76, by: 0.12, br: 18, kx: 0.1, ky: 0.62, ko: 1, kr: -6 });
    return P;
  }

  const SQUISH = [[0, 1, 1], [0.3, 1.14, 0.86], [0.65, 0.93, 1.08], [1, 1, 1]];
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const T = (e, x, y, r, s) => { e.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) rotate(${r.toFixed(2)}deg) scale(${s.toFixed(3)})`; };

  function render(dt) {
    const fighting = phase === 'fight' || phase === 'ready';
    const ease = reduce ? 1 : 1 - Math.exp(-dt / (fighting ? tele() / 3.2 : 90));

    // Camera: your slips move the world, getting hit shakes it.
    let slipK = 0;
    if (me.slip) {
      const e = clock - me.slip.t0;
      slipK = (e < 110 ? easeOut(e / 110) : e < 300 ? 1 : Math.max(0, 1 - (e - 300) / 120)) * me.slip.side;
    }
    const hk = Math.exp(-(clock - me.hitAt) / 120) * me.hitPow;
    const shake = reduce || hk < 0.02 ? 0 : hk;
    const downK = me.down ? clamp((clock - koAt) / 500, 0, 1) : 0;
    cam.x = -slipK * W * 0.1 + (shake ? (Math.random() - 0.5) * 18 * shake : 0);
    cam.y = (shake ? (Math.random() - 0.5) * 12 * shake : 0) - H * 0.12 * downK;
    flash.style.opacity = Math.max(downK * 0.85, Math.min(1, Math.exp(-(clock - me.hitAt) / 160) * me.hitPow)).toFixed(3);
    ropes.style.transform = `translate(${(cam.x * 0.4).toFixed(1)}px,${(cam.y * 0.4).toFixed(1)}px)`;

    const cyT = H * (fighting || phase === 'ko' || phase === 'enter' ? 0.45 : 0.38);
    cy = cy ? lerp(cy, cyT, reduce ? 1 : 1 - Math.exp(-dt / 240)) : cyT;

    const P = poseTarget();
    for (const k in fp) fp[k] += (P[k] - fp[k]) * ease;
    // A punch in flight comes straight at the camera.
    const at = foe.atk;
    let going = '';
    if (at && at.kind !== 'kick' && at.phase === 'go') {
      const q = clamp((clock - at.t0 - at.wind) / at.go, 0, 1) ** 2;
      const o = at.side;
      going = o < 0 ? 'a' : 'b';
      fp[going + 'x'] = lerp(o * 0.88, (o * W * 0.07) / hw, q);
      fp[going + 'y'] = lerp(0.24, (H * 0.8 - cy) / hh, q);
      fp[going + 's'] = lerp(0.8, 3.2, q);
      fp[going + 'r'] = lerp(o * 30, 0, q);
    }

    const still = reduce || foe.ko;
    // Ours fades up from the floating head's handoff: gloves come up, then the bounce.
    const inK = inRing ? (reduce ? 1 : easeOut(clamp((clock - inAt) / 320, 0, 1))) : 0;
    const vis = inRing ? '' : 'hidden';
    if (hd.style.visibility !== vis) hd.style.visibility = gA.style.visibility = gB.style.visibility = shadow.style.visibility = vis;
    const bob = still ? 0 : Math.sin(clock / 200) * (fighting ? 4 : 3) * inK;
    const weave = still || !fighting || at ? 0 : Math.sin(clock / 950) * hw * 0.06;
    const kb = reduce ? 0 : Math.exp(-(clock - foe.kbAt) / 150) * foe.kbPow;
    const cx = W / 2 + cam.x + weave;
    const by = cy + cam.y;
    let sx = 1, sy = 1;
    const sqe = (clock - foe.sqAt) / 380;
    if (!reduce && sqe >= 0 && sqe < 1) {
      for (let i = 1; i < SQUISH.length; i++) {
        const [t1, x1, y1] = SQUISH[i];
        const [t0, x0, y0] = SQUISH[i - 1];
        if (sqe <= t1) { const u = (sqe - t0) / (t1 - t0); sx = lerp(x0, x1, u); sy = lerp(y0, y1, u); break; }
      }
    }
    const hx = cx + fp.hx * hw;
    const hy = by + fp.hy * hh + bob - kb * 10;
    T(hd, hx - hw / 2, hy - hh / 2, fp.hr, fp.hs * (1 - kb * 0.06));
    lastHead.x = hx - hw / 2;
    lastHead.y = hy - hh / 2;
    sq.style.transform = `scale(${sx.toFixed(3)},${sy.toFixed(3)})`;
    const gy = by + bob * 0.7 - kb * 5 - gh / 2;
    T(gA, cx + fp.ax * hw - gw / 2, gy + fp.ay * hh + (1 - inK) * hh * 0.4, fp.ar, fp.as * inK);
    T(gB, cx + fp.bx * hw - gw / 2, gy + fp.by * hh + (1 - inK) * hh * 0.4, fp.br, fp.bs * inK);
    gA.classList.toggle('go', going === 'a');
    gB.classList.toggle('go', going === 'b');
    knee.style.opacity = clamp(fp.ko, 0, 1).toFixed(2);
    T(knee, cx + fp.kx * hw - hw * 0.16, by + fp.ky * hh + bob * 0.5 - hw * 0.35, fp.kr, 1);
    T(shadow, cx + fp.hx * hw * 0.6 - hw * 0.4, Math.max(by + hh * 0.98, H * 0.72), 0, (1 - bob * 0.02) * inK);

    // Face and mouth.
    let want = clock < faceUntil ? faceWant : restFace();
    if (want === 'neutral' && !reduce) {
      if (clock > nextBlink) { blinkUntil = clock + 120; nextBlink = clock + rand(2200, 5200); }
      if (clock < blinkUntil) want = 'blink';
    }
    showFace(want);
    if (say.text) {
      const n = reduce ? say.chars.length : Math.min(say.chars.length, Math.floor((wall - say.t0) / 26));
      if (n !== say.shown) {
        sayEl.textContent = say.chars.slice(0, n).join('');
        if (n > say.shown && n < say.chars.length) { mouth.kick = 1; if (n % 3 === 0) sound.blip(); }
        say.shown = n;
      }
    }
    mouth.kick *= Math.exp(-dt / 55);
    let mo = mouth.kick * 0.8;
    if (clock - foe.oofAt < 200) mo = Math.max(mo, 0.65);
    if (foe.ko) mo = Math.max(mo, 0.35);
    else if (fighting && foe.st < 15) mo = Math.max(mo, 0.1 + Math.sin(wall / 180) * 0.05);
    mouth.open += (mo - mouth.open) * 0.5;
    skull.style.transform = `translateY(${(-mouth.open * 13).toFixed(2)}%) rotate(${(-mouth.open * 5).toFixed(2)}deg)`;
    jaw.style.transform = `translateY(${(mouth.open * 3).toFixed(2)}%)`;
    const talking = wall < say.until;
    sayEl.classList.toggle('on', talking);
    if (talking) {
      let bx = hx + hw * 0.4;
      let bt = hy - hh * 0.5 - say.h * 0.35;
      if (bx + say.w > W - 10) bx = hx - hw * 0.4 - say.w;
      if (bx < 10) { bx = clamp(hx - say.w / 2, 10, W - say.w - 10); bt = hy - hh * 0.5 - say.h - 6; }
      sayEl.style.transform = `translate(${bx.toFixed(1)}px,${clamp(bt, 10, H - say.h - 10).toFixed(1)}px)`;
    }

    // Your gloves, bottom of the view.
    const held = (me.blockKey || me.blockBtn) && fighting && !me.act;
    const leg = me.act && me.act.m.leg;
    const he = reduce ? 1 : 1 - Math.exp(-dt / 60);
    const myBob = reduce ? 0 : Math.sin(clock / 200 + 1.2) * 3;
    const drop = H * 0.35 * downK + (reduce ? 0 : Math.exp(-(clock - me.joltAt) / 90) * 12 + shake * 16);
    for (const side of ['l', 'r']) {
      const d = side === 'l' ? -1 : 1;
      const base = !fighting && phase !== 'ko' ? { x: W / 2 + d * W * 0.3, y: H + mh * 0.25, r: -d * 22, s: 1 }
        : held ? { x: W / 2 + d * mw * 0.4, y: H - mh * 0.74, r: -d * 6, s: 1.14 }
        : leg ? { x: W / 2 + d * W * 0.16, y: H - mh * 0.62, r: -d * 10, s: 1.06 }
        : { x: W / 2 + d * W * 0.25, y: H - mh * 0.42, r: -d * 16, s: 1 };
      const g = hand[side];
      if (!g.x) Object.assign(g, base);
      g.x = lerp(g.x, base.x - slipK * W * 0.04, he);
      g.y = lerp(g.y, base.y, he);
      g.r = lerp(g.r, base.r, he);
      g.s = lerp(g.s, base.s, he);
      let x = g.x, y = g.y + myBob + drop, r = g.r, s = g.s;
      const a = me.act;
      if (a && !a.m.leg && a.m.hand === side) {
        const e = clock - a.t0;
        const hook = a.m.name === 'hook';
        const tx = hook ? hx : W / 2 + cam.x;
        const ty = hook ? hy + hh * 0.05 : by + hh * 0.06;
        const reach = (k) => {
          if (!hook) return [lerp(x, tx, k), lerp(y, ty, k), lerp(r, 0, k), lerp(s, 0.42, k)];
          const c = [tx + d * W * 0.32, ty + H * 0.08];
          const u = 1 - k;
          return [u * u * x + 2 * u * k * c[0] + k * k * tx, u * u * y + 2 * u * k * c[1] + k * k * ty, lerp(r, -d * 70, k), lerp(s, 0.5, k)];
        };
        const v = e < a.hit ? reach(1 - (1 - e / a.hit) ** 2) : (() => {
          const c = reach(1);
          const k = easeOut(clamp((e - a.hit) / (a.end - a.hit), 0, 1));
          return [lerp(c[0], x, k), lerp(c[1], y, k), lerp(c[2], r, k), lerp(c[3], s, k)];
        })();
        [x, y, r, s] = v;
      }
      T(side === 'l' ? myL : myR, x - mw / 2, y - mh / 2, r, s);
    }

    // Trails for kicks and teeps.
    const ma = me.act;
    if (ma && ma.m.leg && sw.me) {
      const e = clock - ma.t0;
      swMe.style.strokeDashoffset = (sw.me * (0.45 - clamp(e / ma.hit, 0, 1) ** 1.3)).toFixed(1);
      swMe.style.opacity = (e < ma.hit ? 1 : clamp(1 - (e - ma.hit) / ((ma.end - ma.hit) * 0.7), 0, 1)).toFixed(2);
    } else swMe.style.opacity = '0';
    if (at && at.kind === 'kick' && sw.foe) {
      const e = clock - at.t0;
      if (at.phase === 'wind') {
        swGhost.style.opacity = (0.15 + 0.6 * clamp(e / at.wind, 0, 1)).toFixed(2);
        swFoe.style.opacity = '0';
      } else {
        swGhost.style.opacity = '0';
        swFoe.style.strokeDashoffset = (sw.foe * (0.5 - clamp((e - at.wind) / at.go, 0, 1))).toFixed(1);
        swFoe.style.opacity = (at.phase === 'go' ? 1 : clamp(1 - (e - at.wind - at.go) / (at.back * 0.6), 0, 1)).toFixed(2);
      }
    } else { swGhost.style.opacity = '0'; swFoe.style.opacity = '0'; }

    // Bars and clock.
    trail.me = trail.me > me.hp ? Math.max(me.hp, trail.me - dt * 0.03) : me.hp;
    trail.foe = trail.foe > foe.hp ? Math.max(foe.hp, trail.foe - dt * 0.03) : foe.hp;
    const key = [me.hp, me.st, foe.hp, foe.st, trail.me, trail.foe].map((v) => v.toFixed(1)).join();
    if (key !== hudKey) {
      hudKey = key;
      for (const [who, h, tr] of [[me, hud.me, trail.me], [foe, hud.foe, trail.foe]]) {
        h.hp.style.transform = `scaleX(${(who.hp / 100).toFixed(4)})`;
        h.trail.style.transform = `scaleX(${(tr / 100).toFixed(4)})`;
        h.st.style.transform = `scaleX(${(who.st / 100).toFixed(4)})`;
        h.stBar.classList.toggle('low', who.st < 20);
        h.tag.textContent = phase === 'fight' && who.st < 20 ? 'gassed' : '';
      }
    }
    const r = phase === 'break' ? 'Break' : phase === 'end' ? 'Final' : `Round ${round} of ${ROUNDS}`;
    const t = phase === 'break' ? fmt(breakEnd - clock) : phase === 'end' ? '0:00' : fmt(roundLeft);
    if (hud.clockR.textContent !== r) hud.clockR.textContent = r;
    if (hud.clockT.textContent !== t) hud.clockT.textContent = t;
    if (cardKind === 'break') {
      const cd = Math.max(0, Math.ceil((breakEnd - clock) / 1000));
      const el2 = card.querySelector('.mt-cd');
      if (el2 && cd !== cdShown) { cdShown = cd; el2.textContent = cd; }
    } else cdShown = -1;

    // Buttons.
    btns.block.classList.toggle('on', me.blockKey || me.blockBtn);
    btns.slip.classList.toggle('on', wall - (pressAt.slip || -1e9) < 120);
    for (const k of ORDER) {
      btns[k].classList.toggle('on', wall - (pressAt[k] || -1e9) < 120);
      btns[k].classList.toggle('low', phase === 'fight' && me.st < MOVES[k].st);
    }
    if ((sndCheck += dt) > 500) { sndCheck = 0; snd.classList.toggle('muted', sound.muted()); }
  }

  // ---- Loop ---------------------------------------------------------------------
  function runTimers() {
    if (!timers.some((t) => t.at <= clock)) return;
    const due = timers.filter((t) => t.at <= clock);
    timers = timers.filter((t) => t.at > clock);
    due.forEach((t) => t.fn());
  }
  function step(dt) {
    runTimers();
    if (phase === 'fight') {
      roundLeft -= dt;
      updateMe(dt);
      if (phase === 'fight') updateFoe(dt);
      if (phase === 'fight' && roundLeft <= 0) { roundLeft = 0; endRound(); }
    } else if (phase === 'break') {
      me.st = Math.min(100, me.st + (25 * dt) / 1000);
      foe.st = Math.min(100, foe.st + (25 * dt) / 1000);
    }
  }
  let dead = false;
  function frame(ts) {
    if (dead) return;
    raf = requestAnimationFrame(frame);
    const dt = lastTs ? Math.min(50, ts - lastTs) : 16;
    lastTs = ts;
    wall += dt;
    if (!open) return;
    if (!paused) { clock += dt; step(dt); }
    render(dt);
  }

  // ---- Input ----------------------------------------------------------------------
  const KEYS = { j: 'jab', k: 'cross', l: 'hook', u: 'teep', i: 'kick' };
  const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  const keyOf = (e) => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key || '');
  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || !open) return;
    const k = keyOf(e);
    const live = phase === 'fight' || phase === 'ready';
    if (k === 'Escape' && phase === 'end' && open) { closeRing(); return; }
    if ((k === 'Escape' || k === 'p') && (live || phase === 'break')) {
      if (paused) resume(); else pause();
      e.preventDefault();
      return;
    }
    if ((live || phase === 'break') && (KEYS[k] || k === ' ' || k === 's' || k.startsWith('Arrow'))) {
      if (!(k === ' ' && e.target && e.target.closest && e.target.closest('.mt-card'))) e.preventDefault();
    }
    if (!live || paused) return;
    if (KEYS[k]) { if (!e.repeat) { pressAt[KEYS[k]] = wall; strike(KEYS[k]); } return; }
    if (k === 's' || k === 'ArrowDown') { me.blockKey = true; return; }
    if ((k === ' ' || k === 'ArrowLeft' || k === 'ArrowRight') && !e.repeat) { pressAt.slip = wall; slip(); }
  }
  function onKeyUp(e) {
    const k = keyOf(e);
    if (k === 's' || k === 'ArrowDown') me.blockKey = false;
  }
  function onBlur() { me.blockKey = me.blockBtn = false; }
  function onVis() { if (document.hidden) { onBlur(); pause(); } }
  addEventListener('keydown', onKey);
  addEventListener('keyup', onKeyUp);
  addEventListener('blur', onBlur);
  document.addEventListener('visibilitychange', onVis);

  // Touch and mouse: strike on press, not on release. Block is held.
  pad.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.mt-btn');
    if (!b || e.button > 0) return;
    e.preventDefault();
    sound.unlock();
    const k = b.dataset.k;
    if (k === 'block') {
      me.blockBtn = true;
      try { b.setPointerCapture(e.pointerId); } catch (err) {}
      return;
    }
    pressAt[k] = wall;
    if (k === 'slip') slip(); else strike(k);
  });
  const letGo = (e) => { const b = e.target.closest && e.target.closest('.mt-btn'); if (b && b.dataset.k === 'block') me.blockBtn = false; };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => pad.addEventListener(ev, letGo));
  // Keyboard on a focused button (Enter) arrives as a click with no pointer.
  pad.addEventListener('click', (e) => {
    const b = e.target.closest('.mt-btn');
    if (!b || e.detail !== 0) return;
    const k = b.dataset.k;
    pressAt[k] = wall;
    if (k === 'slip') slip(); else if (k !== 'block') strike(k);
  });
  pad.addEventListener('contextmenu', (e) => e.preventDefault());
  ring.addEventListener('pointerdown', () => sound.unlock());
  card.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    sound.unlock();
    const a = b.dataset.a;
    if (a === 'again') startFight();
    else if (a === 'next') nextRound();
    else if (a === 'resume') resume();
    else if (a === 'quit') closeRing();
  });
  startBtn.addEventListener('click', openRing);
  // The head starts it (talk/talk.js pitch) when the card is hidden.
  el.addEventListener('dl:start', openRing);
  xBtn.addEventListener('click', closeRing);
  snd.addEventListener('click', () => {
    sound.unlock();
    const siteMute = document.querySelector('.dl-mute');
    if (siteMute) siteMute.click();
    else { try { localStorage.setItem('dl-sound', sound.muted() ? '1' : '0'); } catch (err) {} }
    snd.classList.toggle('muted', sound.muted());
  });

  const ro = new ResizeObserver(() => { measure(); hudKey = ''; });
  ro.observe(ring);

  // ---- Go -----------------------------------------------------------------------------
  setPose('open', 1e9);
  snd.classList.toggle('muted', sound.muted());
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
    timers = [];
    sound.close();
    // Mid-fight page swap: the floating head still goes home.
    giveBack(reduce ? 0 : 800);
    if (shrink) shrink.cancel();
    if (over.isConnected) {
      over.remove();
      document.documentElement.style.overflow = scrollWas;
    }
    root.remove();
    styleUsers = Math.max(0, styleUsers - 1);
    if (!styleUsers) { const s = document.getElementById('mt-style'); if (s) s.remove(); }
  };
}
