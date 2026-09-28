/* Talking head for davidliu.work.
   A cutout of David's head floats around the page and pesters visitors into
   talking to it. A floating hand points at things, grabs links and whole
   sections, and drags them to the cursor. Replies stream from /api/chat.
   Zero dependencies, like the rest of the site. */
(function () {
  'use strict';

  // ---- Art ------------------------------------------------------------------
  // Regenerate with `swift tools/cutout.swift head <photo> media/head.png`
  // and paste the JSON it prints.
  const HEAD = { src: '/media/head.png', w: 269, h: 344, mouth: 0.795, mouthX: [0.35, 0.669], cut: [0.152, 0.829] };
  // A photo hand works the same way (`... hand <photo> media/hand.png`).
  // Left null, an outline hand in the site's icon style stands in.
  const HAND = null;
  // David's voice, animalese style: one short clip per letter, played sped up.
  // Record it with tools/voice.html and paste the config it prints. Left
  // null, synthesized blips stand in.
  const VOICE = null;

  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? '/api/chat'
    : 'https://davidliu-work.vercel.app/api/chat';
  const EMAIL = 'davidliu8473@gmail.com';
  const MAX_TURNS = 25;

  // ---- Lines ----------------------------------------------------------------
  // Everything the head says without asking the model. Lowercase, no em dashes.
  const LINES = {
    hello: "oh. hi. i'm david, the floating head version. click me if you want to talk",
    lost: "this page doesn't exist. i'm lost too. i'm a head",
    greet: 'hey. ask me anything. what i built, tethos, why i do it for free, whatever',
    again: 'back again. what else',
    choices: ['who are you?', "best thing you've built?", 'why build for free?', 'resume pls'],
    close: "okay. i'll be right here",
    shoo: "fine. i'll stay in my corner 😭",
    poke: ['ow', 'hey', "that's my face", 'okay you can stop now', 'i will remember this'],
    knock: ['hello?? you can talk to me btw', 'i can see you scrolling', "knock knock. it's the guy from the website"],
    bonk: ['oops', 'ow. that section came out of nowhere', 'my bad'],
    letgo: ['fine', "okay i'll put it back", 'no? okay'],
    // Keyed by target id (talk/targets.json). A bit only picks targets with a line.
    yank: {
      'resume-swe': "you're a recruiter right? here. resume. right there",
      rag: "this one's good. click it",
      dashboard: 'i built a 3D island for a member dashboard. go look',
      kunlun: 'clothing brand. chinese mythology. click',
      github: "go look at my commits. or don't",
      email: 'my email. just in case'
    },
    shove: {
      build: "here, i'll bring the good part to you",
      lead: 'the part where i run a nonprofit',
      play: 'the fun section. i play classical guitar',
      'tethos-impact': 'this part. read this part',
      'dashboard-hard-part': 'my favorite optimization. right here'
    },
    point: {
      guitar: "that's me playing. well, a recording of me. open it",
      now: "that's what i'm doing right now. roughly",
      'resume-swe': "resume's up here btw",
      'rag-hard-part': 'the actually interesting part is right here',
      'dashboard-ghosts': 'the ghosts are my favorite detail on this page',
      'kunlun-design': 'traditional chinese, never simplified. that part matters'
    },
    roam: {
      build: 'i built all of these. ask me which one broke the most',
      lead: 'tethos is the main thing. ask me about it',
      play: 'also badminton, chess, speed skating, watercolor, poetry.. this section ran out of room',
      'tethos-impact': 'real numbers. real nonprofits',
      'dashboard-hard-part': 'the ground used to cost 15,000 sin calls a second'
    },
    // Fourth wall
    devtools: ['woah woah woah. what are you doing', "close that. i'm shy", 'we literally just met today', "okay fine. it's hand-written html. nothing to see 😭"],
    devtoolsAgain: 'inspect element again? we talked about this',
    devtoolsBye: 'thank you. that was a lot',
    exit: "wait where are you going. i didn't even show you the 3D island",
    back: "oh you're back. i didn't move. i can't, i'm a head",
    dark: 'ooh. dark mode',
    light: 'flashbang 😭',
    rightclick: 'right click? what are you gonna do, save my face?',
    copy: 'copying my stuff? go ahead honestly',
    print: "you're printing my website? on paper?",
    squish: 'stop squishing me',
    wake: "huh? oh. i wasn't sleeping",
    footer: 'you made it to the footer. nobody makes it to the footer',
    mic: "oh you're actually talking to me. hi",
    micBlocked: "i can't hear you. the mic's blocked, just type it",
    offline: `my brain's not connected right now 😭 email me instead: ${EMAIL}`,
    limit: `okay i've talked a lot. email me, the real me reads it: ${EMAIL}`
  };

  const ICON = {
    on: '<svg class="on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    off: '<svg class="off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M19 10v1a7 7 0 0 1-14 0v-1M12 18v4"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    hand: '<svg viewBox="-1 -1 26 26" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 14V4a2 2 0 0 1 4 0v5a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v1a2 2 0 0 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L6 14z"/><path d="M10 9v3M14 10v2.5M18 11v2"/></svg>'
  };

  // ---- Helpers --------------------------------------------------------------

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const EASE = 'cubic-bezier(.45,.05,.25,1)';
  const SPRING = 'cubic-bezier(.34,1.56,.64,1)';

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const frame = () => new Promise((r) => requestAnimationFrame(r));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const now = () => performance.now();
  const strip = (s) => s.replace(/\s*\[\[[^\]]*\]\]/g, '').trim();
  const norm = (p) => p.replace(/index\.html$/, '').replace(/([^/])$/, '$1/');
  const here = norm(location.pathname);

  const S = Object.assign(
    { msgs: [], open: false, met: false, quiet: false, antics: 0, once: [], pending: null, lastKind: '' },
    (() => { try { return JSON.parse(sessionStorage.getItem('dl-talk')) || {}; } catch (e) { return {}; } })()
  );
  function save() {
    S.msgs = S.msgs.slice(-30);
    try { sessionStorage.setItem('dl-talk', JSON.stringify(S)); } catch (e) {}
  }

  let targets = {};
  let epoch = 0; // bumps on interrupt so half-finished bits stop touching things

  // ---- DOM ------------------------------------------------------------------

  const root = document.createElement('div');
  root.className = 'dl';
  root.innerHTML = `
    <div class="dl-actor">
      <div class="dl-shadow"></div>
      <button class="dl-head" type="button" aria-label="Talk to David (an AI version of him)">
        <div class="dl-bob"><div class="dl-wob">
          <div class="dl-cavity"></div>
          <div class="dl-skull"><div class="dl-teeth"></div><img alt="" draggable="false"><i class="dl-blush l"></i><i class="dl-blush r"></i></div>
          <div class="dl-jaw"><img alt="" draggable="false"></div>
        </div></div>
      </button>
      <span class="dl-emote" aria-hidden="true"></span>
    </div>
    <div class="dl-talk" role="dialog" aria-label="Chat with David" hidden>
      <div class="dl-bubble">
        <span class="dl-tag">David</span>
        <div class="dl-tools">
          <button class="dl-mute" type="button" aria-label="Toggle sound">${ICON.on}${ICON.off}</button>
          <button class="dl-x" type="button" aria-label="Close">${ICON.x}</button>
        </div>
        <p class="dl-echo" hidden></p>
        <p class="dl-text" aria-live="polite"></p>
        <button class="dl-more" type="button" aria-label="Continue" hidden>&#9660;</button>
      </div>
      <div class="dl-row">
        <div class="dl-choices" hidden></div>
        <form class="dl-form" hidden>
          <input type="text" maxlength="500" autocomplete="off" placeholder="say something" aria-label="Message David">
          <button class="dl-mic" type="button" aria-label="Talk with your mic" hidden>${ICON.mic}</button>
          <button class="dl-send" type="submit" aria-label="Send">${ICON.send}</button>
        </form>
      </div>
    </div>
    <div class="dl-hand" aria-hidden="true"><div class="dl-hand-in">${HAND ? `<img src="${HAND.src}" alt="">` : ICON.hand}</div></div>`;

  const $ = (s) => root.querySelector(s);
  const actor = $('.dl-actor');
  const headBtn = $('.dl-head');
  const wob = $('.dl-wob');
  const skull = $('.dl-skull');
  const jaw = $('.dl-jaw');
  const emoteEl = $('.dl-emote');
  const talk = $('.dl-talk');
  const bubble = $('.dl-bubble');
  const echoEl = $('.dl-echo');
  const textEl = $('.dl-text');
  const moreBtn = $('.dl-more');
  const choicesEl = $('.dl-choices');
  const form = $('.dl-form');
  const input = form.querySelector('input');
  const sendBtn = form.querySelector('.dl-send');
  const micBtn = form.querySelector('.dl-mic');
  const hand = $('.dl-hand');
  const handIn = $('.dl-hand-in');

  root.querySelectorAll('.dl-skull img, .dl-jaw img').forEach((img) => { img.src = HEAD.src; });
  [['--m', HEAD.mouth], ['--cx0', HEAD.cut[0]], ['--cx1', HEAD.cut[1]], ['--mx0', HEAD.mouthX[0]], ['--mx1', HEAD.mouthX[1]]]
    .forEach(([k, v]) => root.style.setProperty(k, v));

  const hg = HAND || { w: 26, h: 26, tip: [0.346, 0.1], angle: -90 };
  let HW, HH, NW, NH;
  function measure() {
    const sm = innerWidth < 640;
    HW = sm ? 70 : 96;
    HH = Math.round((HW * HEAD.h) / HEAD.w);
    NW = sm ? 46 : 58;
    NH = Math.round((NW * hg.h) / hg.w);
    root.style.setProperty('--hw', HW + 'px');
    root.style.setProperty('--hh', HH + 'px');
    hand.style.width = NW + 'px';
    hand.style.transformOrigin = `${hg.tip[0] * NW}px ${hg.tip[1] * NH}px`;
  }

  // Web Animations helper: animate transform from wherever it is now.
  const running = new WeakMap();
  function stopTween(el) {
    const a = running.get(el);
    if (!a) return;
    try { a.commitStyles(); } catch (e) {}
    a.cancel();
    running.delete(el);
  }
  function tween(el, to, { duration = 600, easing = EASE } = {}) {
    stopTween(el);
    if (reduce || !duration) { el.style.transform = to; return Promise.resolve(); }
    const a = el.animate([{ transform: el.style.transform || 'none' }, { transform: to }], { duration, easing, fill: 'forwards' });
    running.set(el, a);
    return a.finished.then(() => {
      if (running.get(el) === a) running.delete(el);
      el.style.transform = to;
      a.cancel();
    }, () => {});
  }
  const play = (el, keyframes, opts) =>
    reduce ? Promise.resolve() : el.animate(keyframes, opts).finished.catch(() => {});

  // ---- Sound: animalese-ish blips, synthesized, no files ---------------------

  const VOWEL = { a: [800, 1200], e: [450, 1900], i: [320, 2300], o: [480, 850], u: [340, 750], y: [320, 2100] };
  const sound = {
    ctx: null,
    last: 0,
    on: (() => { try { return localStorage.getItem('dl-sound') !== '0'; } catch (e) { return true; } })(),
    unlock() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this.loadVoice();
    },
    live() { return this.on && this.ctx && this.ctx.state === 'running'; },
    voice: null,
    loadVoice() {
      if (!VOICE || this.voice || !this.ctx) return;
      this.voice = 'loading';
      fetch(VOICE.src)
        .then((r) => r.arrayBuffer())
        .then((b) => this.ctx.decodeAudioData(b))
        .then((buf) => { this.voice = buf; }, () => { this.voice = null; });
    },
    blip(ch) {
      if (!this.live()) return;
      const ac = this.ctx;
      const t = ac.currentTime;
      if (t - this.last < 0.05) return;
      this.last = t;
      const c = ch.toLowerCase().normalize('NFD')[0];
      const code = c.charCodeAt(0);
      // Animal Crossing does exactly this: the letter's own sound, cut short
      // and played fast, so it comes out as a chirp in your voice.
      const clip = this.voice instanceof AudioBuffer && (VOICE.letters[c] || VOICE.letters['abcdefghijklmnopqrstuvwxyz'[code % 26]]);
      if (clip) {
        const src = ac.createBufferSource();
        const g = ac.createGain();
        const rate = VOICE.rate * rand(0.93, 1.08);
        const len = Math.min(clip[1], VOICE.clip || 0.16);
        src.buffer = this.voice;
        src.playbackRate.value = rate;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.006);
        g.gain.setValueAtTime(0.9, t + len / rate - 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + len / rate);
        src.connect(g).connect(ac.destination);
        src.start(t, clip[0], len);
        return;
      }
      const f = 230 * Math.pow(2, (((code * 7) % 11) - 5 + rand(-0.6, 0.6)) / 12);
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(f * 1.12, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.22, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
      const [f1, f2] = VOWEL[c] || [500 + (code % 5) * 140, 1400 + (code % 7) * 180];
      [[f1, 1.8], [f2, 1]].forEach(([freq, amt]) => {
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = freq;
        bp.Q.value = 4;
        const k = ac.createGain();
        k.gain.value = amt;
        o.connect(bp).connect(k).connect(g);
      });
      g.connect(ac.destination);
      o.start(t);
      o.stop(t + 0.09);
    },
    tone(f0, f1, dur, vol, type = 'sine') {
      if (!this.live()) return;
      const ac = this.ctx;
      const t = ac.currentTime;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + dur + 0.02);
    },
    pop() { this.tone(520, 900, 0.07, 0.08); },
    tick() { this.tone(1500, 1300, 0.03, 0.05); },
    thud() { this.tone(120, 55, 0.14, 0.35); }
  };

  // ---- Life: mouth, sway, looking at the cursor, twitches -------------------

  const cursor = { x: innerWidth / 2, y: innerHeight / 2, seen: false };
  const life = { open: 0, kick: 0, talkT: -1e9, surprise: 0, twitch: 0, nextTwitch: 0, lean: 0, leanNow: 0, shy: false, sleep: false, listen: false };

  function tick(t) {
    const s = t / 1000;
    const talking = t - life.talkT < 180;
    // Letters kick the mouth open, it falls shut on its own.
    life.open += ((t < life.surprise ? 1 : life.kick) - life.open) * 0.5;
    life.kick *= 0.8;
    if (life.sleep) life.open = Math.max(life.open, 0.1 + Math.sin(s * 1.4) * 0.06);

    let rot = 0, tx = 0, ty = 0, sx = 1, sy = 1;
    if (!reduce) {
      const r = actor.getBoundingClientRect();
      const dx = cursor.x - (r.left + r.width / 2);
      const dy = cursor.y - (r.top + r.height / 2);
      life.leanNow += (life.lean - life.leanNow) * 0.12;
      rot = (talking ? Math.sin(s * 8.5) * 4.5 : Math.sin(s * 1.1) * 1.2) + clamp(dx / 400, -1, 1) * 5 + life.leanNow;
      tx = clamp(dx / 300, -1, 1) * 2;
      ty = (talking ? -Math.abs(Math.sin(s * 8.5)) * 2.5 : 0) + clamp(dy / 300, -1, 1) * 1.5;
      if (life.shy) { rot = 13 + Math.sin(s * 40) * 0.8; tx = 5; }
      if (life.sleep) { rot = 15 + Math.sin(s * 1.4) * 2; ty = 3; }
      if (life.listen) { rot = -9 + Math.sin(s * 2.2) * 1.5; ty = -2; }
      if (t > life.nextTwitch && !talking) { life.twitch = t + 110; life.nextTwitch = t + rand(2500, 6500); }
      if (t < life.twitch) { sx = 1.035; sy = 0.955; }
      sy *= 1 + Math.sin(s * 1.7) * 0.008;
    }
    wob.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scale(${sx},${sy.toFixed(4)})`;
    skull.style.transform = `translateY(${(-life.open * 13).toFixed(2)}%) rotate(${(-life.open * 5).toFixed(2)}deg)`;
    jaw.style.transform = `translateY(${(life.open * 3).toFixed(2)}%)`;
    if (!talk.hidden) placeTalk();
    requestAnimationFrame(tick);
  }

  function squish() {
    play(headBtn, [
      { transform: 'scale(1)' }, { transform: 'scale(1.14,.86)' }, { transform: 'scale(.93,1.08)' }, { transform: 'scale(1)' }
    ], { duration: 380, easing: 'ease-out' });
  }

  let emoteTimer = 0;
  function emote(kind, { hold = 1400, sticky = false } = {}) {
    clearTimeout(emoteTimer);
    emoteEl.className = 'dl-emote on';
    if (kind === '...') { emoteEl.classList.add('dots'); emoteEl.innerHTML = '<i></i><i></i><i></i>'; }
    else if (kind === 'z') { emoteEl.classList.add('zz'); emoteEl.innerHTML = '<i>z</i><i>z</i><i>z</i>'; }
    else { emoteEl.textContent = kind; if (kind === '!') emoteEl.classList.add('bang'); }
    play(emoteEl, [
      { transform: 'scale(0) rotate(-25deg)', opacity: 0 },
      { transform: 'scale(1.3) rotate(8deg)', opacity: 1, offset: 0.45 },
      { transform: 'scale(1) rotate(0)', opacity: 1 }
    ], { duration: 360, easing: 'ease-out' });
    if (!sticky) emoteTimer = setTimeout(emoteOff, hold);
  }
  function emoteOff() { clearTimeout(emoteTimer); emoteEl.className = 'dl-emote'; }

  // ---- Head position --------------------------------------------------------

  const pos = { x: 0, y: 0 };
  function setHead(x, y) {
    pos.x = x;
    pos.y = y;
    stopTween(actor);
    actor.style.transform = `translate3d(${x}px,${y}px,0)`;
  }
  async function moveHead(x, y, duration = 700, easing = EASE) {
    life.lean = clamp((x - pos.x) / 40, -10, 10);
    pos.x = x;
    pos.y = y;
    await tween(actor, `translate3d(${x}px,${y}px,0)`, { duration, easing });
    life.lean = 0;
  }
  function dockPos() {
    const m = innerWidth < 640 ? 14 : 28;
    return { x: innerWidth - HW - m, y: innerHeight - HH - m + 4 };
  }
  const goHome = (duration = 700) => { const d = dockPos(); return moveHead(d.x, d.y, duration); };

  // ---- Speech bubble --------------------------------------------------------

  let chatOn = false;
  let asking = false;
  let talkSeq = 0;

  function placeTalk() {
    const r = actor.getBoundingClientRect();
    const w = talk.offsetWidth;
    const cx = r.left + r.width / 2;
    let left, bottom;
    if (chatOn) {
      left = r.right - w;
      bottom = innerHeight - r.bottom;
    } else {
      left = cx - w * 0.72;
      bottom = Math.min(innerHeight - r.top + 14, innerHeight - talk.offsetHeight - 12);
    }
    left = clamp(left, 12, Math.max(12, innerWidth - w - 12));
    talk.style.left = left + 'px';
    talk.style.bottom = bottom + 'px';
    talk.style.setProperty('--tail', clamp(cx - left, 34, w - 34) + 'px');
  }
  function showTalk() {
    talkSeq++;
    if (!talk.hidden) return;
    talk.hidden = false;
    placeTalk();
    sound.pop();
    play(talk, [
      { transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1.04)', opacity: 1, offset: 0.6 }, { transform: 'scale(1)', opacity: 1 }
    ], { duration: 260, easing: 'ease-out' });
  }
  async function hideTalk() {
    if (talk.hidden) return;
    const seq = ++talkSeq;
    await play(talk, [{ transform: 'scale(1)', opacity: 1 }, { transform: 'scale(.85)', opacity: 0 }], { duration: 160, easing: 'ease-in' });
    if (seq === talkSeq) talk.hidden = true;
  }

  // Typewriter. The queue holds characters and, inline, the stage directions
  // the model wrote, so the hand moves right when the words reach it.
  const sp = { q: [], page: '', typing: false, more: false, ended: true, fast: false, timer: 0, resolve: null, done: Promise.resolve() };

  function speak(text, { echo = '', stream = false } = {}) {
    clearTimeout(sp.timer);
    if (sp.resolve) sp.resolve();
    Object.assign(sp, { q: [], page: '', typing: false, more: false, ended: !stream, fast: false, resolve: null });
    sp.done = new Promise((r) => { sp.resolve = r; });
    textEl.textContent = '';
    moreBtn.hidden = true;
    echoEl.textContent = echo;
    echoEl.hidden = !echo;
    if (text) feed(text);
    else pump();
    return sp.done;
  }
  function feed(s) { for (const ch of s) sp.q.push(ch); pump(); }
  function feedAction(a) { sp.q.push(a); pump(); }
  function endSpeech() { sp.ended = true; pump(); }
  function pump() { if (!sp.typing && !sp.more) step(); }

  function step() {
    for (;;) {
      if (!sp.q.length) {
        sp.typing = false;
        if (sp.ended) finishSpeech();
        return;
      }
      const item = sp.q[0];
      if (typeof item !== 'string') { sp.q.shift(); act(item); continue; }
      const n = sp.page.length;
      // Long replies page like a game: finish the sentence, show the arrow.
      if ((item !== ' ' && n >= 150 && /[.!?]\s$/.test(sp.page)) || (item === ' ' && n >= 230)) {
        sp.typing = false;
        sp.more = true;
        moreBtn.hidden = false;
        linkify();
        return;
      }
      sp.q.shift();
      if (/\s/.test(item) && (!n || /\s$/.test(sp.page))) continue;
      sp.page += item;
      textEl.textContent = sp.page;
      voice(item);
      sp.typing = true;
      sp.timer = setTimeout(step, reduce ? 0 : sp.fast ? 6 : /[.!?]/.test(item) ? 300 : /[,;:]/.test(item) ? 140 : 28);
      return;
    }
  }
  function nextPage() {
    if (!sp.more) return;
    sp.more = false;
    sp.fast = false;
    sp.page = '';
    textEl.textContent = '';
    moreBtn.hidden = true;
    pump();
  }
  function finishSpeech() {
    linkify();
    const r = sp.resolve;
    sp.resolve = null;
    if (r) r();
    if (chatOn) showForm();
  }
  function voice(ch) {
    if (!/[\p{L}\p{N}]/u.test(ch)) return;
    life.kick = Math.max(life.kick, /[aeiouy]/i.test(ch) ? rand(0.75, 1) : rand(0.3, 0.6));
    life.talkT = now();
    sound.blip(ch);
  }
  function linkify() {
    const t = textEl.textContent;
    const re = /https?:\/\/[^\s]+[^\s.,!?)]|[\w.+-]+@[\w-]+\.[a-z]{2,}/gi;
    if (!re.test(t)) return;
    re.lastIndex = 0;
    const out = document.createDocumentFragment();
    let i = 0;
    let m;
    while ((m = re.exec(t))) {
      out.append(t.slice(i, m.index));
      const a = document.createElement('a');
      a.textContent = m[0];
      if (m[0].startsWith('http')) { a.href = m[0]; a.target = '_blank'; a.rel = 'noopener'; }
      else a.href = 'mailto:' + m[0];
      out.append(a);
      i = m.index + m[0].length;
    }
    out.append(t.slice(i));
    textEl.replaceChildren(out);
  }

  // Lines outside the chat: bubble pops over the head, then goes away.
  let quipSeq = 0;
  async function quip(text, hold = 2000) {
    if (!text) return;
    if (chatOn) {
      if (!asking && !sp.typing && !sp.more) await speak(text);
      return;
    }
    const id = ++quipSeq;
    showTalk();
    await speak(text);
    await wait(hold + text.length * 25);
    if (id === quipSeq && !chatOn) hideTalk();
  }

  // ---- Hand -----------------------------------------------------------------

  const hs = { on: false, users: 0, homeTimer: 0 };
  function handTf(x, y, a, s = 1) {
    return `translate3d(${(x - hg.tip[0] * NW).toFixed(1)}px,${(y - hg.tip[1] * NH).toFixed(1)}px,0) rotate(${a - hg.angle}deg) scale(${s})`;
  }
  function handSet(x, y, a, s) { stopTween(hand); hand.style.transform = handTf(x, y, a, s); }
  const handTo = (x, y, a, { duration = 520, easing = EASE, s = 1 } = {}) => tween(hand, handTf(x, y, a, s), { duration, easing });
  async function handShow(x, y, a, s = 1) {
    if (hs.on) return handTo(x, y, a, { s });
    hs.on = true;
    handSet(x, y, a, s);
    hand.classList.add('on');
    await play(handIn, [{ transform: 'scale(0) rotate(-40deg)' }, { transform: 'scale(1.15)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 240, easing: 'ease-out' });
  }
  const handNearHead = () => (hs.on ? null : handShow(pos.x - 6, pos.y + HH * 0.35, -60));
  async function handHome() {
    if (!hs.on || hs.users) return;
    await handTo(pos.x - 6, pos.y + HH * 0.4, -60, { duration: 420 });
    if (hs.users) return;
    await play(handIn, [{ transform: 'scale(1)' }, { transform: 'scale(0) rotate(30deg)' }], { duration: 180, easing: 'ease-in' });
    if (hs.users) return;
    hs.on = false;
    hand.classList.remove('on');
  }
  // Anything that moves the hand runs inside this so it only goes home once
  // nobody needs it.
  async function useHand(fn) {
    hs.users++;
    clearTimeout(hs.homeTimer);
    try { return await fn(); }
    finally { if (--hs.users === 0) hs.homeTimer = setTimeout(handHome, 350); }
  }
  function tap(n = 2) {
    const r = (hg.angle * Math.PI) / 180;
    const d = `translate(${(Math.cos(r) * 7).toFixed(1)}px,${(Math.sin(r) * 7).toFixed(1)}px)`;
    const kf = [];
    for (let i = 0; i < n; i++) kf.push({ transform: 'none' }, { transform: d });
    kf.push({ transform: 'none' });
    return play(handIn, kf, { duration: 170 * n, easing: 'ease-in-out' });
  }

  function find(id) {
    const t = targets[id];
    if (!t) return null;
    for (const el of document.querySelectorAll(t.sel)) if (!root.contains(el) && el.getClientRects().length) return el;
    return null;
  }
  const isInline = (el) => /^inline/.test(getComputedStyle(el).display);
  function contentRect(el) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    return r.width ? r : el.getBoundingClientRect();
  }
  function inView(el) {
    const r = el.getBoundingClientRect();
    return r.bottom > 60 && r.top < innerHeight - 60;
  }
  async function ensureVisible(el) {
    const r = el.getBoundingClientRect();
    const tall = r.height > innerHeight * 0.5;
    if (r.top >= 70 && (r.bottom <= innerHeight - 110 || (tall && r.top < innerHeight * 0.4))) return;
    scrollTo({ top: scrollY + r.top - (tall ? 110 : (innerHeight - r.height) / 2 - 40), behavior: reduce ? 'auto' : 'smooth' });
    let last = NaN;
    for (let i = 0, still = 0; i < 90 && still < 4; i++) {
      await frame();
      still = scrollY === last ? still + 1 : 0;
      last = scrollY;
    }
  }
  function light(el) {
    const cls = isInline(el) ? 'dl-lit' : 'dl-lit-box';
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 2700);
  }

  function point(el, { hold = 2200 } = {}) {
    return useHand(async () => {
      const ep = epoch;
      await ensureVisible(el);
      if (ep !== epoch) return;
      const r = el.getBoundingClientRect();
      const c = contentRect(el);
      let x, y, a;
      if (isInline(el)) { x = r.left + Math.min(r.width / 2, 40); y = r.bottom + 3; a = -112; }
      else if (c.left > 90) { x = c.left - 10; y = c.top + 11; a = 0; }
      else { x = c.left + 30; y = c.top - 8; a = 90; }
      await handNearHead();
      await handTo(x, y, a, { duration: 560 });
      if (ep !== epoch) return;
      light(el);
      sound.tick();
      await tap(2);
      await wait(hold);
    });
  }

  // Grab the real element and move it with a transform, so it keeps its
  // styles and stays clickable wherever it ends up.
  let held = null;
  function yank(el, { hold = 6000 } = {}) {
    if (reduce) return point(el);
    return useHand(async () => {
      const ep = epoch;
      if (held) await release();
      const inline = isInline(el);
      const r0 = el.getBoundingClientRect();
      const gx = inline ? -3 : 14;
      const gy = inline ? r0.height / 2 : 12;
      const ang = inline ? 0 : 45;
      await handNearHead();
      await handTo(clamp(r0.left + gx, 16, innerWidth - 16), clamp(r0.top + gy, 16, innerHeight - 16), ang, { duration: 620 });
      if (ep !== epoch) return;
      handIn.animate([{ transform: 'none' }, { transform: 'scale(.86) rotate(-10deg)' }], { duration: 140, fill: 'forwards' });
      sound.tick();
      el.classList.add('dl-held');
      const h = { el, inline, gx, gy, ang, hold, r: el.getBoundingClientRect(), sx: scrollX, sy: scrollY, ox: 0, oy: 0, t0: now(), raf: 0 };
      held = h;
      const done = new Promise((res) => { h.stop = res; });
      const loop = () => {
        if (held !== h) return;
        const t = now() - h.t0;
        const lx = h.r.left - (scrollX - h.sx);
        const ly = h.r.top - (scrollY - h.sy);
        const cx = cursor.seen ? cursor.x : innerWidth / 2;
        const cy = cursor.seen ? cursor.y : innerHeight / 2;
        let dx, dy;
        if (h.inline) { dx = cx + 18; dy = cy + 14; }
        else {
          dx = clamp(cx - Math.min(h.r.width * 0.3, 160), 12, Math.max(12, innerWidth - h.r.width - 12));
          dy = clamp(cy - 24, 12, Math.max(12, innerHeight - h.r.height - 12));
        }
        const k = t < 900 ? 0.07 : 0.16;
        h.ox += (dx - lx - h.ox) * k;
        h.oy += (dy - ly - h.oy) * k;
        const rot = Math.sin(t / 110) * (h.inline ? 2.5 : 0.8);
        el.style.transform = `translate(${h.ox.toFixed(1)}px,${h.oy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
        handSet(lx + h.ox + h.gx, ly + h.oy + h.gy, h.ang, 1);
        if (t > h.hold) { release(); return; }
        h.raf = requestAnimationFrame(loop);
      };
      h.raf = requestAnimationFrame(loop);
      await done;
    });
  }
  async function release() {
    const h = held;
    if (!h) return;
    held = null;
    cancelAnimationFrame(h.raf);
    const lx = h.r.left - (scrollX - h.sx);
    const ly = h.r.top - (scrollY - h.sy);
    handTo(lx + h.gx, ly + h.gy, h.ang, { duration: 600, easing: SPRING });
    await play(h.el, [{ transform: h.el.style.transform || 'none' }, { transform: 'translate(0,0)' }], { duration: 600, easing: SPRING });
    h.el.style.transform = '';
    h.el.classList.remove('dl-held');
    handIn.getAnimations().forEach((a) => a.cancel());
    h.stop();
  }

  function knock() {
    return useHand(async () => {
      const x = innerWidth * rand(0.4, 0.6);
      const y = innerHeight * rand(0.38, 0.5);
      await handShow(x, y, -70, 2.6);
      for (let i = 0; i < 3; i++) {
        await play(handIn, [{ transform: 'none' }, { transform: 'scale(.9) translateY(3px)' }], { duration: 110, easing: 'ease-in' });
        sound.thud();
        shake();
        ripple(x, y);
        await play(handIn, [{ transform: 'scale(.9) translateY(3px)' }, { transform: 'none' }], { duration: 140, easing: 'ease-out' });
        await wait(90);
      }
      await wait(900);
    });
  }
  function shake() {
    const m = document.querySelector('main');
    if (m) play(m, [{ transform: 'none' }, { transform: 'translate(3px,1px)' }, { transform: 'translate(-3px,-1px)' }, { transform: 'translate(2px,0)' }, { transform: 'none' }], { duration: 180 });
  }
  function ripple(x, y) {
    const d = document.createElement('div');
    d.className = 'dl-ripple';
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    root.appendChild(d);
    play(d, [{ transform: 'scale(.3)', opacity: 0.8 }, { transform: 'scale(1.7)', opacity: 0 }], { duration: 520, easing: 'ease-out' }).then(() => d.remove());
  }
  function wave() {
    return useHand(async () => {
      await handShow(pos.x - 6, pos.y + HH * 0.3, -75);
      await play(handIn, [
        { transform: 'rotate(0)' }, { transform: 'rotate(-22deg)' }, { transform: 'rotate(14deg)' },
        { transform: 'rotate(-18deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }
      ], { duration: 1100, easing: 'ease-in-out' });
    });
  }

  async function bonk(el) {
    const ep = epoch;
    const c = contentRect(el);
    const tx = clamp(c.right + 6, 12, innerWidth - HW - 12);
    const ty = clamp(c.top + Math.min(c.height, 160) / 2 - HH / 2, 12, innerHeight - HH - 12);
    await moveHead(tx + 70, ty - 30, 800);
    if (ep !== epoch) return;
    await moveHead(tx, ty, 240, 'cubic-bezier(.6,0,1,1)');
    if (ep !== epoch) return;
    sound.thud();
    emote('!');
    squish();
    el.style.transformOrigin = '0 100%';
    play(el, [
      { transform: 'none' }, { transform: 'rotate(-1.4deg) translateX(-6px)' }, { transform: 'rotate(.9deg)' }, { transform: 'rotate(-.4deg)' }, { transform: 'none' }
    ], { duration: 700, easing: 'ease-out' }).then(() => { el.style.transformOrigin = ''; });
    await moveHead(tx + 34, ty - 14, 320, SPRING);
  }
  async function roam(el) {
    const c = contentRect(el);
    const right = c.right + 40;
    const x = right < innerWidth - HW - 16 ? right : clamp(c.left + c.width / 2, 16, innerWidth - HW - 16);
    const y = clamp(c.top + Math.min(c.height, 200) / 2 - HH / 2, 70, innerHeight - HH - 90);
    await moveHead(x, y, 1100);
  }

  // ---- Stage directions from the model --------------------------------------

  function makeParser(onText, onAction) {
    let buf = '';
    return {
      push(chunk) {
        buf += chunk;
        for (;;) {
          const i = buf.indexOf('[[');
          if (i < 0) {
            const keep = buf.endsWith('[') ? 1 : 0;
            if (buf.length > keep) onText(buf.slice(0, buf.length - keep));
            buf = buf.slice(buf.length - keep);
            return;
          }
          if (i > 0) onText(buf.slice(0, i));
          const j = buf.indexOf(']]', i + 2);
          if (j < 0) {
            buf = buf.slice(i);
            if (buf.length > 60) { onText(buf); buf = ''; }
            return;
          }
          const m = /^(point|drag):([a-z0-9-]+)$/.exec(buf.slice(i + 2, j).trim());
          if (m) onAction({ verb: m[1], id: m[2] });
          buf = buf.slice(j + 2);
        }
      },
      end() {
        if (buf) onText(buf.replace(/\[\[[^\]]*$/, ''));
        buf = '';
      }
    };
  }

  let queue = Promise.resolve();
  let navTo = null;
  function act(a) {
    const t = targets[a.id];
    if (!t) return;
    const el = find(a.id);
    if (!el) {
      if (t.page !== here) navTo = a;
      return;
    }
    const ep = epoch;
    queue = queue.then(() => {
      if (ep !== epoch) return;
      return a.verb === 'drag' ? yank(el, { hold: 7000 }) : point(el);
    }).catch(() => {});
  }
  // The thing they asked about lives on another page: point at the link
  // that goes there, then go, and finish the gesture on arrival.
  async function goTo(a) {
    const page = targets[a.id].page;
    S.pending = a;
    save();
    const via = [...document.querySelectorAll('a[href]')].find((l) => {
      if (root.contains(l) || !l.getClientRects().length) return false;
      const u = new URL(l.href, location.href);
      return u.origin === location.origin && norm(u.pathname) === page;
    });
    if (via) await point(via, { hold: 500 });
    else await wait(700);
    location.href = page;
  }

  // ---- Chat -----------------------------------------------------------------

  function showForm() {
    form.hidden = false;
    sendBtn.disabled = asking;
    micBtn.hidden = !Recognition;
    micBtn.disabled = asking;
  }
  function showChoices() {
    choicesEl.replaceChildren(...LINES.choices.map((c) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c;
      b.addEventListener('click', () => ask(c));
      return b;
    }));
    choicesEl.hidden = false;
  }

  async function openChat() {
    interrupt();
    wake();
    emote('!');
    life.surprise = now() + 450;
    squish();
    chatOn = true;
    S.open = true;
    save();
    root.classList.add('chat');
    await goHome(420);
    showTalk();
    showForm();
    if (fine) input.focus({ preventScroll: true });
    if (!S.msgs.length) {
      await speak(LINES.greet);
      if (chatOn && !S.msgs.length) showChoices();
    } else speak(LINES.again);
  }
  function closeChat() {
    chatOn = false;
    S.open = false;
    save();
    interrupt();
    root.classList.remove('chat');
    choicesEl.hidden = true;
    form.hidden = true;
    speak('');
    hideTalk().then(() => quip(LINES.close, 800));
    schedule(40000);
  }
  function shoo() {
    S.quiet = true;
    save();
    interrupt();
    root.classList.add('quiet');
    quip(LINES.shoo, 1200);
  }
  let pokes = 0;
  function poke() {
    squish();
    emote(pokes % 2 ? '?' : '!');
    life.surprise = now() + 200;
    if (!asking && !sp.typing && !sp.more) speak(LINES.poke[pokes++ % LINES.poke.length]);
  }

  // Talking back: the browser's speech recognition fills the box as you
  // speak and sends when you stop.
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  function listen() {
    if (rec) { rec.stop(); return; }
    if (asking) return;
    let heard = '';
    rec = new Recognition();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.onstart = () => {
      root.classList.add('listening');
      life.listen = true;
      react('mic', LINES.mic, 800);
    };
    rec.onresult = (e) => {
      heard = [...e.results].map((r) => r[0].transcript).join('');
      input.value = heard;
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') speak(LINES.micBlocked);
    };
    rec.onend = () => {
      rec = null;
      life.listen = false;
      root.classList.remove('listening');
      if (heard.trim()) ask(heard);
    };
    try { rec.start(); } catch (e) { rec = null; }
  }

  async function ask(q) {
    q = q.trim().slice(0, 500);
    if (!q || asking) return;
    choicesEl.hidden = true;
    input.value = '';
    if (S.msgs.filter((m) => m.role === 'user').length >= MAX_TURNS) { speak(LINES.limit, { echo: q }); return; }
    asking = true;
    sendBtn.disabled = true;
    micBtn.disabled = true;
    S.msgs.push({ role: 'user', content: q });
    save();
    speak('', { echo: q, stream: true });
    emote('...', { sticky: true });
    let raw = '';
    const parser = makeParser(feed, feedAction);
    try {
      const res = await fetch(API, {
        method: 'POST',
        // text/plain keeps this a simple request, so no CORS preflight.
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ page: here, here: Object.keys(targets).filter((id) => find(id)), messages: S.msgs.slice(-16) })
      });
      if (!res.ok || !res.body) throw new Error('chat ' + res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const s = dec.decode(value, { stream: true });
        if (!raw) emoteOff();
        raw += s;
        parser.push(s);
      }
      parser.end();
    } catch (e) {
      if (!raw) { raw = LINES.offline; parser.push(raw); parser.end(); }
    }
    emoteOff();
    S.msgs.push({ role: 'assistant', content: raw.trim() || '..' });
    save();
    endSpeech();
    await sp.done;
    asking = false;
    if (chatOn) showForm();
    if (navTo) { const a = navTo; navTo = null; await queue; goTo(a); }
  }

  function restore() {
    chatOn = true;
    root.classList.add('chat');
    const d = dockPos();
    setHead(d.x, d.y);
    showTalk();
    showForm();
    const last = [...S.msgs].reverse().find((m) => m.role === 'assistant');
    speak('');
    textEl.textContent = last ? strip(last.content) : LINES.greet;
    linkify();
    if (S.pending) {
      const a = S.pending;
      S.pending = null;
      save();
      setTimeout(() => act(a), 700);
    }
  }

  // ---- Director: the bits it does on its own --------------------------------

  const dir = { timer: 0, busy: false, count: 0 };
  function schedule(ms) {
    clearTimeout(dir.timer);
    if (!reduce && !S.quiet) dir.timer = setTimeout(nextBit, ms);
  }
  function interrupt() {
    epoch++;
    clearTimeout(dir.timer);
    release();
  }

  function bits() {
    const out = [];
    const each = (map, fn) => Object.keys(map).forEach((id) => { const el = find(id); if (el) fn(el, map[id]); });
    if (fine && cursor.seen) {
      each(LINES.yank, (el, line) => out.push({ kind: 'yank', run: async () => {
        await Promise.all([quip(line, 1500), yank(el, { hold: 5200 })]);
        await quip(pick(LINES.letgo), 600);
      } }));
    }
    each(LINES.shove, (el, line) => { if (!inView(el)) out.push({ kind: 'shove', run: () => Promise.all([quip(line, 1800), yank(el, { hold: 4200 })]) }); });
    each(LINES.roam, (el, line) => { if (inView(el)) out.push({ kind: 'roam', run: async () => { const ep = epoch; await roam(el); if (ep === epoch) await quip(line, 2200); } }); });
    each(LINES.point, (el, line) => { if (inView(el)) out.push({ kind: 'point', run: () => Promise.all([quip(line, 1800), point(el, { hold: 1600 })]) }); });
    const bonkable = ['build', 'lead', 'play', 'tethos-impact', 'rag-hard-part', 'dashboard-hard-part', 'kunlun-design'].map(find).find((el) => el && inView(el));
    if (bonkable) out.push({ kind: 'bonk', run: async () => { const ep = epoch; await bonk(bonkable); if (ep === epoch) await quip(pick(LINES.bonk), 1200); } });
    if (!S.msgs.length && dir.count > 0) out.push({ kind: 'knock', run: () => Promise.all([knock(), wait(400).then(() => quip(pick(LINES.knock), 1800))]) });
    return out;
  }
  async function nextBit() {
    if (S.quiet || reduce) return;
    if (chatOn || held || dir.busy || document.hidden || life.sleep || life.shy) return schedule(9000);
    if (dir.count >= 4 || S.antics >= 12) return;
    const all = bits();
    const fresh = all.filter((b) => b.kind !== S.lastKind);
    const pool = fresh.length ? fresh : all;
    if (!pool.length) return schedule(15000);
    const kind = pick([...new Set(pool.map((b) => b.kind))]);
    const bit = pick(pool.filter((b) => b.kind === kind));
    dir.busy = true;
    dir.count++;
    S.antics++;
    S.lastKind = kind;
    save();
    const ep = epoch;
    try { await bit.run(); } catch (e) {}
    dir.busy = false;
    if (ep === epoch && !chatOn) await goHome(900);
    schedule(rand(20000, 32000));
  }

  // ---- Fourth wall ----------------------------------------------------------

  function react(key, text, hold = 1800) {
    if (S.once.includes(key)) return;
    S.once.push(key);
    save();
    if (asking || held || life.shy) return;
    wake();
    quip(text, hold);
  }

  // Devtools docked to the window shrink the viewport while the window and
  // the zoom level stay the same. So does a browser sidebar (close enough, the
  // joke still lands) and a phone keyboard (not close enough), so desktop only
  // and never while typing.
  const dt = { open: false, iw: innerWidth, ih: innerHeight, ow: outerWidth, oh: outerHeight, dpr: devicePixelRatio, timers: [], covering: false };

  async function devtoolsOpened() {
    dt.open = true;
    interrupt();
    wake();
    life.shy = true;
    root.classList.add('shy');
    emote('!');
    life.surprise = now() + 400;
    squish();
    if (!dt.covering) {
      dt.covering = true;
      hs.users++;
      handShow(pos.x + HW * 0.1, pos.y + HH * 0.42, 180, 1.2);
    }
    const seen = S.once.includes('devtools');
    if (!seen) { S.once.push('devtools'); save(); }
    quip(seen ? LINES.devtoolsAgain : LINES.devtools[0], 8000);
    if (seen) return;
    const later = (ms, line) => dt.timers.push(setTimeout(() => dt.open && quip(line, 8000), ms));
    later(2800, LINES.devtools[1]);
    later(8000, LINES.devtools[2]);
    later(17000, LINES.devtools[3]);
  }
  function devtoolsClosed() {
    dt.open = false;
    dt.timers.forEach(clearTimeout);
    dt.timers = [];
    life.shy = false;
    setTimeout(() => { if (!life.shy) root.classList.remove('shy'); }, 1600);
    if (dt.covering) {
      dt.covering = false;
      if (--hs.users === 0) hs.homeTimer = setTimeout(handHome, 350);
    }
    quip(LINES.devtoolsBye, 1400);
  }

  function onResize() {
    const typing = document.activeElement && document.activeElement.matches('input, textarea, [contenteditable]');
    const sameWindow = fine && !typing && outerWidth === dt.ow && outerHeight === dt.oh && devicePixelRatio === dt.dpr;
    const shrank = dt.iw - innerWidth > 140 || dt.ih - innerHeight > 140;
    const grew = innerWidth - dt.iw > 140 || innerHeight - dt.ih > 140;
    if (sameWindow && shrank && !dt.open) devtoolsOpened();
    else if (sameWindow && grew && dt.open) devtoolsClosed();
    else if (!sameWindow && devicePixelRatio === dt.dpr && outerWidth < dt.ow - 80) react('squish', LINES.squish);
    Object.assign(dt, { iw: innerWidth, ih: innerHeight, ow: outerWidth, oh: outerHeight, dpr: devicePixelRatio });
    measure();
    if (!dir.busy || chatOn) { const d = dockPos(); setHead(d.x, d.y); }
    if (dt.covering) handSet(pos.x + HW * 0.1, pos.y + HH * 0.42, 180, 1.2);
  }

  let lastInput = now();
  function wake() {
    lastInput = now();
    if (!life.sleep) return;
    life.sleep = false;
    emoteOff();
    emote('!');
    react('wake', LINES.wake, 1200);
  }
  setInterval(() => {
    if (!life.sleep && !chatOn && !dir.busy && !held && !life.shy && !document.hidden && now() - lastInput > 45000) {
      life.sleep = true;
      emote('z', { sticky: true });
    }
  }, 5000);

  // ---- Wiring ---------------------------------------------------------------

  function wire() {
    addEventListener('pointermove', (e) => { cursor.x = e.clientX; cursor.y = e.clientY; cursor.seen = true; wake(); }, { passive: true });
    addEventListener('pointerdown', (e) => { cursor.x = e.clientX; cursor.y = e.clientY; sound.unlock(); wake(); }, { passive: true });
    addEventListener('keydown', (e) => {
      sound.unlock();
      wake();
      if (e.key !== 'Escape') return;
      if (held) release();
      else if (chatOn) closeChat();
    });
    addEventListener('scroll', () => { lastInput = now(); }, { passive: true });
    addEventListener('resize', onResize);

    headBtn.addEventListener('click', () => (chatOn ? poke() : openChat()));
    headBtn.addEventListener('pointerenter', () => { if (!chatOn) squish(); });
    $('.dl-x').addEventListener('click', () => (chatOn ? closeChat() : shoo()));
    $('.dl-mute').addEventListener('click', () => {
      sound.on = !sound.on;
      root.classList.toggle('muted', !sound.on);
      try { localStorage.setItem('dl-sound', sound.on ? '1' : '0'); } catch (e) {}
    });
    moreBtn.addEventListener('click', nextPage);
    bubble.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      if (sp.more) nextPage();
      else if (sp.typing) sp.fast = true;
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });
    micBtn.addEventListener('click', listen);

    document.documentElement.addEventListener('mouseleave', (e) => {
      if (fine && e.clientY <= 0 && now() > 8000) react('exit', LINES.exit, 2600);
    });
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hiddenAt = now();
      else if (now() - hiddenAt > 5000) react('back', LINES.back);
    });
    new MutationObserver(() => {
      react('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? LINES.dark : LINES.light, 1200);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    addEventListener('contextmenu', () => react('rightclick', LINES.rightclick));
    document.addEventListener('copy', () => react('copy', LINES.copy));
    addEventListener('beforeprint', () => react('print', LINES.print));
    const footer = document.querySelector('.footer');
    if (footer && document.documentElement.scrollHeight > innerHeight * 1.4) {
      new IntersectionObserver((entries, io) => {
        if (entries[0].isIntersecting && scrollY > 200) { io.disconnect(); react('footer', LINES.footer); }
      }).observe(footer);
    }
  }

  async function enter() {
    S.met = true;
    save();
    const d = dockPos();
    setHead(d.x, innerHeight + 20);
    actor.classList.add('on');
    await wait(1600);
    await moveHead(d.x, d.y, 800, SPRING);
    emote('!');
    life.surprise = now() + 350;
    wave();
    const lost = document.querySelector('.identity .name')?.textContent.trim() === '404';
    await quip(lost ? LINES.lost : LINES.hello, 3200);
  }

  function start() {
    if (S.quiet) root.classList.add('quiet');
    if (!sound.on) root.classList.add('muted');
    if (S.open) { actor.classList.add('on'); restore(); }
    else if (!S.met) enter();
    else {
      const d = dockPos();
      setHead(d.x, d.y);
      actor.classList.add('on');
      play(headBtn, [{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
    }
    schedule(S.met ? rand(9000, 14000) : 13000);
  }

  function boot() {
    document.body.appendChild(root);
    measure();
    wire();
    requestAnimationFrame(tick);
    fetch('/talk/targets.json')
      .then((r) => r.json())
      .then((t) => { targets = t; })
      .catch(() => {})
      .finally(start);
    console.log('%chi. you opened the console.', 'font: 600 14px -apple-system, sans-serif; color: #88c0d0');
    console.log(`i'm not mad. just shy. the floating head is an AI version of me.\nif you're poking around because you're hiring, the real me reads ${EMAIL}`);
  }

  boot();
})();
