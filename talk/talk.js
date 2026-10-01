/* Talking head for davidliu.work.
   A cutout of David's head floats around the page and pesters visitors into
   talking to it. A floating hand points at things, grabs links and whole
   sections, and drags them to the cursor. Replies stream from /api/chat.
   Zero dependencies, like the rest of the site. */
(function () {
  'use strict';

  // ---- Art ------------------------------------------------------------------
  // Regenerate with `swift tools/cutout.swift head <photo> media/head.webp`
  // and paste the JSON it prints. It also writes the morphed faces.
  const HEAD = {
    src: '/media/head.webp', w: 269, h: 344, mouth: 0.795, mouthX: [0.35, 0.669], cut: [0.152, 0.829],
    faces: { blink: '/media/head-blink.webp', angry: '/media/head-angry.webp', sad: '/media/head-sad.webp', happy: '/media/head-happy.webp' }
  };
  // One photo per gesture: `swift tools/cutout.swift hand <photo> media/hands/<name>.webp <pose>`.
  // `at` is where the gesture acts (fingertip, pinch, knuckles, palm) and
  // `angle` the way it faces. Left null, an outline hand stands in.
  const HANDS = {
    point: { src: '/media/hands/point.webp', w: 209, h: 400, at: [0.27, 0.031], angle: -107 },
    pinch: { src: '/media/hands/pinch.webp', w: 246, h: 400, at: [0.104, 0.26], angle: -112 },
    fist: { src: '/media/hands/fist.webp', w: 300, h: 400, at: [0.652, 0.281], angle: -87 },
    palm: { src: '/media/hands/palm.webp', w: 298, h: 400, at: [0.456, 0.413], angle: -73 },
    back: { src: '/media/hands/back.webp', w: 289, h: 400, at: [0.616, 0.5], angle: -82 },
    peace: { src: '/media/hands/peace.webp', w: 204, h: 400, at: [0.682, 0.517], angle: -84 }
  };
  // David's voice, animalese style: one short clip per letter, played sped up.
  // Record it with tools/voice.html and paste the config it prints. Left
  // null, synthesized blips stand in.
  const VOICE = null;

  // The cat. The walk is a sprite cut from video frames
  // (`swift tools/cutout.swift frames <dir> media/cat/walk.webp`), the poses are
  // photos (`... thing <photo> media/cat/lie.webp x,y`). Left null, an outline cat stands in.
  const PET = {
    walk: { src: '/media/cat/walk.webp', frames: 12, w: 292, h: 223 },
    lie: { src: '/media/cat/lie.webp', w: 400, h: 215 },
    sleep: { src: '/media/cat/sleep.webp', w: 400, h: 395 },
    belly: { src: '/media/cat/belly.webp', w: 400, h: 326 }
  };

  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? '/api'
    : 'https://davidliu-work.vercel.app/api';
  const EMAIL = 'davidliu8473@gmail.com';
  const MAX_TURNS = 25;

  // ---- Lines ----------------------------------------------------------------
  // Everything the head says without asking the model. Lowercase, no em dashes.
  const LINES = {
    lost: "this page doesn't exist. i'm lost too. i'm a head",
    intro: "hey! i'm david. well, the floating head version of him. what's your name?",
    introBack: (name) => `oh hey ${name}. you came back 😭 what are we looking at today?`,
    introIgnored: "okay i'll let you look around. click me if you want to talk",
    again: 'back again. what else',
    choices: ["i'm a recruiter", 'just looking around', 'skip the small talk'],
    cat: ['she likes you', "that's meowmeow btw", 'she only does that for people she likes'],
    close: "okay. i'll be right here",
    shoo: "fine. i'll stay in my corner 😭",
    poke: ['ow', 'hey', "that's my face", 'okay you can stop now', 'i will remember this'],
    knock: ['hello?? you can talk to me btw', 'i can see you scrolling', "knock knock. it's the guy from the website"],
    bonk: ['oops', 'ow. that section came out of nowhere', 'my bad'],
    letgo: ['fine', "okay i'll put it back", 'no? okay'],
    landed: ['again. no wait', 'okay i live here now', 'that was actually fun'],
    dizzy: ["okay i'm gonna be sick", 'everything is spinning. is that normal'],
    // Keyed by target id (talk/targets.json). A bit only picks targets with a line.
    yank: {
      'resume-swe': "you're a recruiter right? here. resume. right there",
      rag: "this one's good. click it",
      dashboard: 'i built a 3D island for a member dashboard. go look',
      kunlun: 'clothing brand. chinese mythology. click',
      github: "go look at my commits. or don't",
      hackthenorth: 'this one won hack the north. look at it',
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
      guitar: "that's me playing. well, a recording of me. hit listen",
      hackthenorth: 'we won this one. badges that play among us',
      now: "that's what i'm doing right now. roughly",
      'resume-swe': "resume's up here btw",
      'rag-hard-part': 'the actually interesting part is right here',
      'dashboard-ghosts': 'the ghosts are my favorite detail on this page',
      'kunlun-design': 'traditional chinese, never simplified. that part matters'
    },
    roam: {
      build: 'i built all of these. ask me which one broke the most',
      lead: 'tethos is the main thing. ask me about it',
      play: 'yes i actually played carnegie hall',
      awards: "these are the ones i'm allowed to brag about",
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
    limit: `okay i've talked a lot. email me, the real me reads it: ${EMAIL}`,
    // Said once each when they open, play, hover or stop on something. Keyed by data-t.
    notice: {
      jdpower: 'sixteen months there. the jeep and ram build and price sites run on services i worked on',
      tethos: 'this is the big one. ask me how it started, it involves a factory and a lot of metal disks',
      genesis: 'genesis was our demo day. 260 people came to watch students demo software for nonprofits',
      wfn: "ontario's largest hackathon education event. i ran that",
      'tethos-platform': "you can actually walk around that island. there are 91 kinds of fish, don't ask",
      hackthenorth: 'no server, no phones. the badges talk to each other and signal strength decides if you can kill',
      biopilot: 'drone footage in, crop maps out. second place, $5,000',
      kunlun: 'my clothing brand. traditional chinese and english side by side. drop 001 is coming',
      'rag-card': 'built that because new execs asked the same questions every september',
      dejaview: 'pinterest board in, 3D objects in your room out. team of four',
      snake: 'your github graph turns into a game of snake. zero dependencies',
      clawdash: "yes i have an AI agent running on a mac mini. that's its dashboard",
      gallery: 'real photos btw. no stock. the badges are from hack the north',
      awards: 'the guitar one is the odd one out. ask me about it',
      life: "you scrolled this far. you're either a friend or a very thorough recruiter",
      meowmeow: "that's meowmeow. she's horizontal most of the day. want me to call her over?",
      guitar: "that's actually me playing. capricho árabe is the long one",
      muaythai: 'i coach the beginner class. do you train anything?',
      photography: 'fujifilm. do you shoot at all?',
      travel: "only two on there so far, i'm behind on that list. been anywhere good lately?",
      contact: "email's the best way. the real me reads it",
      'tethos-impact': 'the red cross one started with a cold call. ask me',
      'dashboard-hard-part': 'the ground used to cost 15,000 sin calls a second. now it is a lookup',
      'dashboard-ghosts': 'the ghosts are my favorite detail. nobody ever lands in an empty world',
      'dashboard-budget': 'every effect had to earn its frames. shadows cost seven',
      'rag-hard-part': "the whole trick is never re-embedding what didn't change",
      'kunlun-design': 'traditional chinese, never simplified. that part matters'
    },
    // Small talk for when it goes quiet, in order. Functions run when said.
    lull: [
      "no pressure btw. you can just scroll and i'll narrate",
      'so what brings you here? recruiter, friend, or just lost',
      () => `it's ${clock()} here in london. what time is it for you?`,
      "honestly i don't get many visitors. this is nice",
      'quick question. cats or dogs?',
      "you're a quiet one. that's okay, i talk enough for both of us"
    ]
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
  const clock = () => new Date().toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }).toLowerCase();

  const S = Object.assign(
    { msgs: [], open: false, met: false, quiet: false, antics: 0, once: [], pending: null, lastKind: '', noticed: [], lull: 0 },
    (() => { try { return JSON.parse(sessionStorage.getItem('dl-talk')) || {}; } catch (e) { return {}; } })()
  );
  function save() {
    S.msgs = S.msgs.slice(-30);
    try { sessionStorage.setItem('dl-talk', JSON.stringify(S)); } catch (e) {}
  }

  // A random id per browser, so returning visitors can be told apart in the
  // log. Chats are saved server side (the bubble says so).
  const uuid = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : null);
  const visitor = (() => {
    try {
      let v = localStorage.getItem('dl-visitor');
      if (!v && (v = uuid())) localStorage.setItem('dl-visitor', v);
      return v;
    } catch (e) { return null; }
  })();
  if (!S.convo) S.convo = uuid();
  const knownName = () => { try { return localStorage.getItem('dl-name') || ''; } catch (e) { return ''; } };
  // Stage notes are the page talking to the model, so they don't count as the visitor's turns.
  const talked = () => S.msgs.some((m) => m.role === 'user' && !m.note);

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
      <span class="dl-shout" aria-hidden="true"></span>
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
        <p class="dl-fine" hidden>chats are saved so the real me can read them</p>
      </div>
    </div>
    <div class="dl-hand" aria-hidden="true"><div class="dl-hand-in">${HANDS ? `<img src="${HANDS.point.src}" alt="" draggable="false">` : ICON.hand}</div></div>`;

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
  const fineEl = $('.dl-fine');
  const hand = $('.dl-hand');
  const handIn = $('.dl-hand-in');
  const handImg = hand.querySelector('img');
  const shoutEl = $('.dl-shout');

  const FACES = Object.assign({ neutral: HEAD.src }, HEAD.faces);
  const faceImgs = [];
  [skull, jaw].forEach((part) => {
    const first = part.querySelector('img');
    Object.keys(FACES).forEach((name, i) => {
      const img = i ? first.cloneNode() : first;
      img.src = FACES[name];
      img.dataset.f = name;
      img.hidden = i > 0;
      if (i) first.after(img);
      faceImgs.push(img);
    });
  });
  [['--m', HEAD.mouth], ['--cx0', HEAD.cut[0]], ['--cx1', HEAD.cut[1]], ['--mx0', HEAD.mouthX[0]], ['--mx1', HEAD.mouthX[1]]]
    .forEach(([k, v]) => root.style.setProperty(k, v));

  const OUTLINE = { w: 26, h: 26, at: [0.346, 0.1], angle: -90 };
  let hg = HANDS ? HANDS.point : OUTLINE;
  let HW, HH, NW, NH;
  function measure() {
    const sm = innerWidth < 640;
    HW = sm ? 80 : 112;
    HH = Math.round((HW * HEAD.h) / HEAD.w);
    root.style.setProperty('--hw', HW + 'px');
    root.style.setProperty('--hh', HH + 'px');
    sizeHand();
  }
  function sizeHand() {
    const sm = innerWidth < 640;
    if (HANDS) { NH = sm ? 76 : 104; NW = Math.round((NH * hg.w) / hg.h); }
    else { NW = sm ? 46 : 58; NH = NW; }
    hand.style.width = NW + 'px';
    hand.style.transformOrigin = `${hg.at[0] * NW}px ${hg.at[1] * NH}px`;
    if (HANDS) handIn.style.transformOrigin = '50% 100%';
  }
  // Switch gesture photo. Call before moving the hand, since the anchor moves.
  function pose(name) {
    const next = HANDS && (HANDS[name] || HANDS.point);
    if (!next || next === hg) return;
    hg = next;
    handImg.src = hg.src;
    sizeHand();
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
    meow() {
      if (!this.live()) return;
      const ac = this.ctx;
      const t = ac.currentTime;
      const o = ac.createOscillator();
      const bp = ac.createBiquadFilter();
      const g = ac.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(560, t);
      o.frequency.linearRampToValueAtTime(880, t + 0.16);
      o.frequency.linearRampToValueAtTime(500, t + 0.5);
      bp.type = 'bandpass';
      bp.frequency.value = 1300;
      bp.Q.value = 2.5;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
      g.gain.setValueAtTime(0.25, t + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.52);
      o.connect(bp).connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.55);
    },
    tick() { this.tone(1500, 1300, 0.03, 0.05); },
    thud() { this.tone(120, 55, 0.14, 0.35); }
  };

  // ---- Life: mouth, sway, looking at the cursor, twitches -------------------

  const cursor = { x: innerWidth / 2, y: innerHeight / 2, seen: false };
  const life = { open: 0, kick: 0, talkT: -1e9, surprise: 0, nextBlink: 0, lean: 0, leanNow: 0, spin: 0, flying: false, shy: false, sleep: false, listen: false };

  // Expressions swap whole morphed photos. Temporary ones fall back to rest.
  let face = 'neutral';
  let faceTimer = 0;
  const restFace = () => (life.sleep || life.shy ? 'blink' : 'neutral');
  function setFace(name, ms) {
    if (!FACES[name]) name = 'neutral';
    clearTimeout(faceTimer);
    if (ms) faceTimer = setTimeout(() => setFace(restFace()), ms);
    if (name === face) return;
    face = name;
    faceImgs.forEach((img) => { img.hidden = img.dataset.f !== name; });
  }

  function tick(t) {
    const s = t / 1000;
    const talking = t - life.talkT < 180;
    // Letters kick the mouth open, it falls shut on its own.
    life.open += ((t < life.surprise ? 1 : life.kick) - life.open) * 0.5;
    life.kick *= 0.8;
    if (life.sleep) life.open = Math.max(life.open, 0.1 + Math.sin(s * 1.4) * 0.06);

    let rot = 0, tx = 0, ty = 0, sy = 1;
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
      // Thrown heads spin; once it lands the spin unwinds to the nearest upright.
      if (!life.flying && life.spin) {
        const up = Math.round(life.spin / 360) * 360;
        life.spin += (up - life.spin) * 0.12;
        if (Math.abs(up - life.spin) < 0.5) life.spin = 0;
      }
      rot += life.spin;
      sy = 1 + Math.sin(s * 1.7) * 0.008;
    }
    // Blink every few seconds, sometimes twice.
    if (t > life.nextBlink) {
      life.nextBlink = t + (Math.random() < 0.2 ? 260 : rand(2200, 6000));
      if (face === 'neutral') setFace('blink', 120);
    }
    wob.style.transform = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${rot.toFixed(2)}deg) scaleY(${sy.toFixed(4)})`;
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
    if (S.home && !chatOn) {
      return { x: clamp(S.home.x * innerWidth, 8, innerWidth - HW - 8), y: clamp(S.home.y * innerHeight, 8, innerHeight - HH - 8) };
    }
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
    pres.said = now();
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
  async function quip(text, hold = 2000, mood) {
    if (!text) return;
    if (mood) setFace(mood, 1200 + text.length * 45);
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
    return `translate3d(${(x - hg.at[0] * NW).toFixed(1)}px,${(y - hg.at[1] * NH).toFixed(1)}px,0) rotate(${a - hg.angle}deg) scale(${s})`;
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
    for (const el of document.querySelectorAll(t.sel)) {
      if (!root.contains(el) && (el.getClientRects().length || el.closest('details'))) return el;
    }
    return null;
  }
  // Rows on the page are <details>. Open the one we're about to point at.
  function unfold(el) {
    let opened = false;
    for (let d = el.closest('details'); d; d = d.parentElement && d.parentElement.closest('details')) {
      if (!d.open) { d.open = true; opened = true; }
    }
    const own = el.querySelector && el.querySelector(':scope > details');
    if (own && !own.open) { own.open = true; opened = true; }
    return opened ? wait(280) : Promise.resolve();
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
      pose('point');
      await unfold(el);
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
      pose('pinch');
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
      pose('fist');
      await handShow(x, y, -90, HANDS ? 2.2 : 2.6);
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
      pose('palm');
      await handShow(pos.x - NW * 0.35, pos.y + HH * 0.4, -80);
      await play(handIn, [
        { transform: 'rotate(0)' }, { transform: 'rotate(-22deg)' }, { transform: 'rotate(14deg)' },
        { transform: 'rotate(-18deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }
      ], { duration: 1100, easing: 'ease-in-out' });
    });
  }

  function peace() {
    return useHand(async () => {
      pose('peace');
      await handShow(pos.x - NW * 0.3, pos.y + HH * 0.35, -75);
      await play(handIn, [{ transform: 'rotate(0)' }, { transform: 'rotate(-10deg)' }, { transform: 'rotate(6deg)' }, { transform: 'rotate(0)' }], { duration: 600, easing: 'ease-in-out' });
      await wait(900);
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
    setFace('angry', 1500);
    el.style.transformOrigin = '0 100%';
    play(el, [
      { transform: 'none' }, { transform: 'rotate(-1.4deg) translateX(-6px)' }, { transform: 'rotate(.9deg)' }, { transform: 'rotate(-.4deg)' }, { transform: 'none' }
    ], { duration: 700, easing: 'ease-out' }).then(() => { el.style.transformOrigin = ''; });
    await moveHead(Math.min(tx + 34, innerWidth - HW - 8), Math.max(8, ty - 14), 320, SPRING);
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
          const inner = buf.slice(i + 2, j).trim();
          const m = /^(point|drag|face|summon):([a-z0-9-]+)$/.exec(inner);
          const n = /^note:\s*([a-z_]+)\s*=\s*(.+)$/i.exec(inner);
          if (m) onAction({ verb: m[1], id: m[2] });
          else if (n) onAction({ verb: 'note', id: n[1].toLowerCase(), value: n[2].trim() });
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
    if (a.verb === 'face') { setFace(a.id, 3500); return; }
    if (a.verb === 'summon') { if (a.id === 'cat') summonCat(); return; }
    if (a.verb === 'note') {
      if (a.id === 'name') try { localStorage.setItem('dl-name', a.value.slice(0, 40)); } catch (e) {}
      return;
    }
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
    fineEl.hidden = false;
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
    pres.streak = 0;
    // Clicked right after he said something: pick up from there.
    const said = pres.last && now() - pres.last.at < 15000 ? pres.last.text : '';
    pres.last = null;
    if (said) { S.msgs.push({ role: 'assistant', content: said }); save(); speak(said); }
    else if (!talked()) await greet();
    else speak(LINES.again);
  }

  // The head starts the conversation: who it is, then their name.
  async function greet() {
    const name = knownName();
    const line = name ? LINES.introBack(name) : LINES.intro;
    if (!S.msgs.length) { S.msgs.push({ role: 'assistant', content: line }); save(); }
    setFace('happy', 2500);
    await speak(line);
    if (chatOn && !talked()) showChoices();
  }
  async function intro() {
    chatOn = true;
    S.open = true;
    save();
    root.classList.add('chat');
    showTalk();
    showForm();
    await greet();
  }
  function closeChat(line = LINES.close) {
    chatOn = false;
    S.open = false;
    save();
    interrupt();
    root.classList.remove('chat');
    choicesEl.hidden = true;
    form.hidden = true;
    fineEl.hidden = true;
    speak('');
    hideTalk().then(() => { quip(line, 800, 'sad'); peace(); });
    schedule(40000);
  }
  function shoo() {
    S.quiet = true;
    save();
    interrupt();
    root.classList.add('quiet');
    quip(LINES.shoo, 1200, 'sad');
  }
  let pokes = 0;
  function poke() {
    squish();
    emote(pokes % 2 ? '?' : '!');
    life.surprise = now() + 200;
    if (pokes >= 2) setFace('angry', 1800);
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
      react('mic', LINES.mic, 800, 'happy');
    };
    rec.onresult = (e) => {
      heard = [...e.results].map((r) => r[0].transcript).join('');
      input.value = heard;
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setFace('sad', 2500); speak(LINES.micBlocked); }
    };
    rec.onend = () => {
      rec = null;
      life.listen = false;
      root.classList.remove('listening');
      if (heard.trim()) ask(heard);
    };
    try { rec.start(); } catch (e) { rec = null; }
  }

  // A note is the page asking for a line on its own (the chat went quiet),
  // so nothing is echoed and it doesn't use up the visitor's turns.
  async function ask(q, { note = false } = {}) {
    q = q.trim().slice(0, 500);
    if (!q || asking) return;
    if (!note) {
      choicesEl.hidden = true;
      input.value = '';
      pres.streak = 0;
      pres.lulls = 0;
      if (S.msgs.filter((m) => m.role === 'user' && !m.note).length >= MAX_TURNS) { speak(LINES.limit, { echo: q }); return; }
    }
    asking = true;
    sendBtn.disabled = true;
    micBtn.disabled = true;
    S.msgs.push(note ? { role: 'user', content: q, note: true } : { role: 'user', content: q });
    save();
    speak('', { echo: note ? '' : q, stream: true });
    emote('...', { sticky: true });
    let raw = '';
    let failed = false;
    const parser = makeParser(feed, feedAction);
    try {
      const res = await fetch(API + '/chat', {
        method: 'POST',
        // text/plain keeps this a simple request, so no CORS preflight.
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({
          page: here,
          here: Object.keys(targets).filter((id) => find(id)),
          messages: S.msgs.slice(-16),
          visitor,
          convo: S.convo,
          name: knownName()
        })
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
      failed = true;
      if (!raw && note) { S.msgs.pop(); raw = lullLine(); parser.push(raw); parser.end(); }
      else if (!raw) { raw = LINES.offline; setFace('sad', 3000); parser.push(raw); parser.end(); }
    }
    pres.brain = !failed && !raw.includes(LINES.offline);
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
    textEl.textContent = last ? strip(last.content) : LINES.intro;
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
        await quip(pick(LINES.letgo), 600, 'sad');
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

  // ---- Presence: like he's actually sitting there ---------------------------
  // He sees what you open, play, hover on or stop to read, and says something
  // about it. When the chat goes quiet he makes small talk instead of idling.

  const pres = { ready: false, seen: '', seenAt: 0, said: now(), streak: 0, lulls: 0, out: 0, brain: false, at: '', atSince: 0, last: null };

  function look(el) {
    for (let t = el && el.closest('[data-t]'); t; t = t.parentElement && t.parentElement.closest('[data-t]')) {
      const id = t.dataset.t;
      if (root.contains(t) || !LINES.notice[id]) continue;
      if (!S.noticed.includes(id)) { pres.seen = id; pres.seenAt = now(); }
      return;
    }
  }
  // Whatever sits across the middle of the screen, innermost first.
  function reading() {
    const mid = innerHeight * 0.45;
    let at = '';
    for (const el of document.querySelectorAll('[data-t]')) {
      if (root.contains(el) || !LINES.notice[el.dataset.t]) continue;
      const r = el.getBoundingClientRect();
      if (r.top < mid && r.bottom > mid) at = el.dataset.t;
    }
    return at;
  }

  // Unprompted lines. In the chat they join the conversation, so the model
  // knows what he just said when they answer.
  function chime(text) {
    pres.streak++;
    if (!chatOn) {
      pres.out++;
      pres.last = { text, at: now() };
      schedule(rand(18000, 26000));
      return quip(text, 2600);
    }
    S.msgs.push({ role: 'assistant', content: text });
    save();
    return speak(text);
  }
  function lullLine() {
    const line = LINES.lull[S.lull++ % LINES.lull.length];
    save();
    return typeof line === 'function' ? line() : line;
  }
  function lull() {
    pres.lulls++;
    if (!pres.brain || !talked()) return chime(lullLine());
    pres.streak++;
    const on = pres.at || pres.seen;
    ask(`(stage note: it's gone quiet for a bit. fill the silence with one short line of easy small talk.${on ? ` they seem to be looking at ${on}.` : ''})`, { note: true });
  }

  function presence() {
    if (!pres.ready) return;
    const t = now();
    const at = reading();
    if (at !== pres.at) { pres.at = at; pres.atSince = t; }
    else if (at && t - pres.atSince > 9000 && t - lastScroll > 3000 && pres.seen !== at && !S.noticed.includes(at)) { pres.seen = at; pres.seenAt = t; }
    if (pres.seen && t - pres.seenAt > 15000) pres.seen = '';

    if (document.hidden || !document.hasFocus() || asking || held || dir.busy || drag.on || life.shy || rec || sp.typing || sp.more || input.value) return;
    const quiet = t - pres.said;
    // Just asked them something: give them a chance to answer first.
    const asked = chatOn && /\?\s*$/.test(strip(textEl.textContent));
    if (pres.seen && t - pres.seenAt > 1200 && quiet > (asked ? 14000 : chatOn ? 4000 : 12000) && pres.streak < 4 && (chatOn || (!S.quiet && pres.out < 4))) {
      S.noticed.push(pres.seen);
      save();
      chime(LINES.notice[pres.seen]);
      pres.seen = '';
      return;
    }
    if (!chatOn) return;
    if (quiet > 22000 && pres.lulls < 3 && pres.streak < 4) lull();
    // Nobody's answering: tuck the chat away and let them browse.
    else if (!talked() && quiet > 25000 && (pres.lulls >= 2 || pres.streak >= 4)) closeChat(LINES.introIgnored);
  }

  // ---- Fourth wall ----------------------------------------------------------

  function react(key, text, hold = 1800, mood) {
    if (S.once.includes(key)) return;
    S.once.push(key);
    save();
    if (asking || held || life.shy) return;
    wake();
    quip(text, hold, mood);
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
    setFace('blink');
    emote('!');
    life.surprise = now() + 400;
    squish();
    if (!dt.covering) {
      dt.covering = true;
      hs.users++;
      pose('back');
      handShow(pos.x + HW * 0.5, pos.y + HH * 0.62, -90, 1.1);
    }
    const seen = S.once.includes('devtools');
    if (!seen) { S.once.push('devtools'); save(); }
    quip(seen ? LINES.devtoolsAgain : LINES.devtools[0], 8000, seen ? 'angry' : null);
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
    setFace('happy', 2000);
    setTimeout(() => { if (!life.shy) root.classList.remove('shy'); }, 1600);
    if (dt.covering) {
      dt.covering = false;
      if (--hs.users === 0) hs.homeTimer = setTimeout(handHome, 350);
    }
    quip(LINES.devtoolsBye, 1400);
    peace();
  }

  function onResize() {
    const typing = document.activeElement && document.activeElement.matches('input, textarea, [contenteditable]');
    const sameWindow = fine && !typing && outerWidth === dt.ow && outerHeight === dt.oh && devicePixelRatio === dt.dpr;
    const shrank = dt.iw - innerWidth > 140 || dt.ih - innerHeight > 140;
    const grew = innerWidth - dt.iw > 140 || innerHeight - dt.ih > 140;
    if (sameWindow && shrank && !dt.open) devtoolsOpened();
    else if (sameWindow && grew && dt.open) devtoolsClosed();
    else if (!sameWindow && devicePixelRatio === dt.dpr && outerWidth < dt.ow - 80) react('squish', LINES.squish, 1800, 'angry');
    Object.assign(dt, { iw: innerWidth, ih: innerHeight, ow: outerWidth, oh: outerHeight, dpr: devicePixelRatio });
    measure();
    if (!dir.busy || chatOn) { const d = dockPos(); setHead(d.x, d.y); }
    if (dt.covering) handSet(pos.x + HW * 0.5, pos.y + HH * 0.62, -90, 1.1);
  }

  let lastInput = now();
  let lastScroll = 0;
  let lastMove = 0;
  // Resolves once the visitor has had a few seconds and stopped scrolling
  // and moving around, or after 12s regardless.
  function settled() {
    const t0 = now();
    return new Promise((done) => {
      const check = () => {
        const t = now();
        if ((t - t0 > 3500 && t - lastScroll > 1500 && t - lastMove > 900) || t - t0 > 12000) done();
        else setTimeout(check, 250);
      };
      check();
    });
  }
  function wake() {
    lastInput = now();
    if (!life.sleep) return;
    life.sleep = false;
    setFace('neutral');
    emoteOff();
    emote('!');
    react('wake', LINES.wake, 1200);
  }
  setInterval(() => {
    if (!life.sleep && !chatOn && !dir.busy && !held && !life.shy && !document.hidden && now() - lastInput > 45000) {
      life.sleep = true;
      setFace('blink');
      emote('z', { sticky: true });
    }
  }, 5000);

  // ---- The cat ----------------------------------------------------------------
  // "psst psst psst": she walks in from the edge of the screen, flops over and
  // stays. Left alone she curls up and naps; click her and she rolls over.

  const CAT = {
    walk: '<svg class="walk" viewBox="0 0 64 44" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 24c-6-2-8-10-4-16" fill="none"/><path class="leg a" d="M18 29v10"/><path class="leg b" d="M24 29v10"/><path class="leg b" d="M36 29v10"/><path class="leg a" d="M42 29v10"/><ellipse class="fill" cx="29" cy="25" rx="18" ry="9"/><path class="fill" d="M45 10l1-9 5 6M52 7l5-6 1 9"/><circle class="fill" cx="51" cy="15" r="8"/><path d="M54 14v1M58.5 17.5l-1 .8" fill="none"/></svg>',
    lie: '<svg class="lie" viewBox="0 0 64 44" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path class="fill" d="M8 40c0-10 8-17 21-17s21 7 21 17z"/><path d="M10 40c7 3 21 3 27 0" fill="none"/><path class="fill" d="M42 26l1-9 5 6M49 23l5-6 1 9"/><circle class="fill" cx="48" cy="31" r="8"/><path d="M45.5 31q1.5 1.5 3 0M50.5 31q1.5 1.5 3 0" fill="none"/></svg>'
  };
  let cat = null;
  let napTimer = 0;
  const small = () => innerWidth < 640;

  function catWidth(state) {
    if (!PET) return small() ? 66 : 96;
    if (state === 'walking') return Math.round((small() ? 62 : 88) * PET.walk.w / PET.walk.h);
    return { lying: small() ? 124 : 172, sleeping: small() ? 88 : 120, belly: small() ? 96 : 132 }[state];
  }
  function catState(state) {
    cat.className = `dl-cat${PET ? ' pet' : ''} ${state}`;
    cat.style.width = catWidth(state) + 'px';
  }
  function catAt(x) {
    cat.style.transform = `translateX(${x}px)`;
  }
  function catEl() {
    const el = document.createElement('div');
    const w = PET && PET.walk;
    el.innerHTML = `<div class="dl-cat-in">${PET
      ? `<div class="walk" style="background-image:url(${w.src});aspect-ratio:${w.w}/${w.h};background-size:${w.frames * 100}% 100%;animation-timing-function:steps(${w.frames - 1}, jump-none)"></div>` +
        ['lie', 'sleep', 'belly'].map((k) => `<img class="${k}" src="${PET[k].src}" alt="" draggable="false">`).join('')
      : CAT.walk + CAT.lie}</div><span class="dl-heart" aria-hidden="true">&hearts;</span>`;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'meowmeow the cat');
    el.addEventListener('click', petCat);
    root.appendChild(el);
    return el;
  }
  function napLater() {
    clearTimeout(napTimer);
    if (PET) napTimer = setTimeout(() => { if (cat && cat.classList.contains('lying')) catState('sleeping'); }, 25000);
  }
  async function summonCat() {
    if (cat) { petCat(); return; }
    cat = catEl();
    catState('walking');
    const w = catWidth('walking');
    const inner = cat.firstElementChild;
    sound.meow();
    const bob = reduce ? null : inner.animate([{ transform: 'rotate(-2deg) translateY(0)' }, { transform: 'rotate(2deg) translateY(-2px)' }], { duration: 400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
    let x;
    if (PET) {
      // The footage only has her from the shoulders forward, so she pokes in
      // from the edge of the screen and the cut stays off it.
      await play(cat, [{ transform: `translateX(${-w}px)` }, { transform: `translateX(${-w * 0.12}px)` }], { duration: 2400, easing: 'ease-out' });
      catAt(-w * 0.12);
      await wait(600);
      x = small() ? 6 : 14;
    } else {
      x = clamp(innerWidth * (small() ? 0.04 : 0.2), 12, innerWidth - w - 12);
      await play(cat, [{ transform: `translateX(${-w - 20}px)` }, { transform: `translateX(${x}px)` }], { duration: (x + w + 20) * 9, easing: 'linear' });
    }
    if (bob) bob.cancel();
    // Plop.
    await play(inner, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.18,.7)' }], { duration: 140, easing: 'ease-in' });
    catState('lying');
    catAt(x);
    await play(inner, [{ transform: 'scale(1.18,.7)' }, { transform: 'scale(.95,1.05)' }, { transform: 'scale(1,1)' }], { duration: 320, easing: 'ease-out' });
    heart();
    napLater();
  }
  function heart() {
    play(cat.querySelector('.dl-heart'), [
      { transform: 'translate(-50%, 0) scale(.4)', opacity: 0 },
      { transform: 'translate(-50%, -10px) scale(1.2)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%, -30px) scale(1)', opacity: 0 }
    ], { duration: 1100, easing: 'ease-out' });
  }
  let petting = false;
  function petCat() {
    if (!cat || petting || cat.classList.contains('walking')) return;
    petting = true;
    sound.meow();
    heart();
    if (PET) catState('belly');
    play(cat.firstElementChild, [{ transform: 'scale(1,1)' }, { transform: 'scale(1.06,.92)' }, { transform: 'scale(1,1)' }], { duration: 300 });
    quip(pick(LINES.cat), 1200, 'happy');
    setTimeout(() => {
      petting = false;
      if (PET) catState('lying');
      napLater();
    }, 1800);
  }
  // ---- Dragging and throwing the head ---------------------------------------

  const drag = { on: false, moved: false, x0: 0, y0: 0, ox: 0, oy: 0, vx: 0, vy: 0, t: 0, raf: 0, weeAt: 0, weed: false, bumpAt: 0 };

  function grab(e) {
    if (e.button !== 0) return;
    cancelAnimationFrame(drag.raf);
    life.flying = false;
    Object.assign(drag, { on: true, moved: false, x0: e.clientX, y0: e.clientY, vx: 0, vy: 0, t: now(), weed: false });
    headBtn.setPointerCapture(e.pointerId);
  }
  function dragMove(e) {
    if (!drag.on) return;
    if (!drag.moved) {
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
      drag.moved = true;
      interrupt();
      wake();
      // Pick the head up from wherever it visibly is, mid-glide or not.
      stopTween(actor);
      const m = new DOMMatrix(getComputedStyle(actor).transform);
      setHead(m.m41, m.m42);
      drag.ox = drag.x0 - pos.x;
      drag.oy = drag.y0 - pos.y;
      root.classList.add('dragging');
      emote('!');
      life.surprise = now() + 300;
    }
    const t = now();
    const dt = Math.max(1, t - drag.t) / 1000;
    const x = e.clientX - drag.ox;
    const y = e.clientY - drag.oy;
    drag.vx = drag.vx * 0.6 + ((x - pos.x) / dt) * 0.4;
    drag.vy = drag.vy * 0.6 + ((y - pos.y) / dt) * 0.4;
    drag.t = t;
    setHead(x, y);
    life.lean = clamp(drag.vx / 90, -30, 30);
    if (Math.hypot(drag.vx, drag.vy) > 1500) wee();
  }
  function drop() {
    if (!drag.on) return;
    drag.on = false;
    root.classList.remove('dragging');
    if (!drag.moved) return;
    // Letting go after holding still shouldn't fling it.
    if (now() - drag.t > 80) drag.vx = drag.vy = 0;
    fling(drag.vx, drag.vy);
  }

  function wee() {
    const t = now();
    if (t - drag.weeAt < 1400) return;
    drag.weeAt = t;
    drag.weed = true;
    setFace('happy', 1400);
    shout('w' + 'e'.repeat(4 + Math.floor(Math.random() * 5)));
  }
  function shout(text) {
    shoutEl.textContent = text;
    life.surprise = now() + 450;
    [...text].forEach((ch, i) => setTimeout(() => voice(ch), i * 45));
    play(shoutEl, [
      { transform: 'translate(-50%, 6px) scale(.5) rotate(-8deg)', opacity: 0 },
      { transform: 'translate(-50%, -6px) scale(1.15) rotate(4deg)', opacity: 1, offset: 0.25 },
      { transform: 'translate(-50%, -28px) scale(1) rotate(-2deg)', opacity: 0 }
    ], { duration: 1000, easing: 'ease-out' });
  }
  function bump() {
    const t = now();
    if (t - drag.bumpAt < 250) return;
    drag.bumpAt = t;
    sound.thud();
    squish();
    emote('!');
    setFace('angry', 900);
  }

  // Momentum with friction, bouncing off the edges of the window.
  function fling(vx, vy) {
    let last = now();
    let spun = 0;
    life.flying = true;
    const step = (t) => {
      const dt = Math.min(0.033, (t - last) / 1000);
      last = t;
      const f = Math.pow(0.08, dt);
      vx *= f;
      vy *= f;
      let x = pos.x + vx * dt;
      let y = pos.y + vy * dt;
      const maxX = innerWidth - HW;
      const maxY = innerHeight - HH;
      if (x < 0 || x > maxX) { x = clamp(x, 0, maxX); if (Math.abs(vx) > 300) bump(); vx *= -0.55; }
      if (y < 0 || y > maxY) { y = clamp(y, 0, maxY); if (Math.abs(vy) > 300) bump(); vy *= -0.55; }
      const turn = reduce ? 0 : vx * dt * 0.6;
      life.spin += turn;
      spun += Math.abs(turn);
      life.lean = clamp(vx / 90, -30, 30);
      setHead(x, y);
      if (Math.hypot(vx, vy) > 1100) wee();
      if (Math.hypot(vx, vy) > 30) { drag.raf = requestAnimationFrame(step); return; }
      land(spun);
    };
    drag.raf = requestAnimationFrame(step);
  }
  function land(spun) {
    life.flying = false;
    life.lean = 0;
    if (chatOn) setTimeout(() => { if (chatOn && !drag.on) goHome(600); }, 700);
    else {
      S.home = { x: pos.x / innerWidth, y: pos.y / innerHeight };
      save();
    }
    if (spun > 540) { emote('@'); quip(pick(LINES.dizzy), 1400, 'sad'); }
    else if (drag.weed) quip(pick(LINES.landed), 1200, 'happy');
  }

  // ---- Wiring ---------------------------------------------------------------

  function wire() {
    addEventListener('pointermove', (e) => { cursor.x = e.clientX; cursor.y = e.clientY; cursor.seen = true; lastMove = now(); wake(); }, { passive: true });
    addEventListener('pointerdown', (e) => { cursor.x = e.clientX; cursor.y = e.clientY; sound.unlock(); wake(); }, { passive: true });
    addEventListener('keydown', (e) => {
      sound.unlock();
      wake();
      if (e.key !== 'Escape') return;
      if (held) release();
      else if (chatOn) closeChat();
    });
    addEventListener('scroll', () => { lastInput = lastScroll = now(); }, { passive: true });
    addEventListener('resize', onResize);

    headBtn.addEventListener('click', () => {
      if (drag.moved) { drag.moved = false; return; }
      if (chatOn) poke();
      else openChat();
    });
    headBtn.addEventListener('pointerdown', grab);
    headBtn.addEventListener('pointermove', dragMove);
    headBtn.addEventListener('pointerup', drop);
    headBtn.addEventListener('pointercancel', drop);
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

    // What they open or play. Capture runs before a <details> toggles, so a
    // row that's already open is being closed.
    document.addEventListener('click', (e) => {
      if (root.contains(e.target)) return;
      const sum = e.target.closest('summary');
      if (sum && sum.parentElement.open) return;
      if (e.target.closest('summary, button')) look(e.target);
    }, true);
    if (fine) {
      let hoverT = 0;
      document.addEventListener('pointerover', (e) => {
        clearTimeout(hoverT);
        const el = e.target.closest && e.target.closest('[data-photo], .cats img, .strip figure');
        if (el && !root.contains(el)) hoverT = setTimeout(() => look(el), 1500);
      });
    }
    micBtn.addEventListener('click', listen);

    document.documentElement.addEventListener('mouseleave', (e) => {
      if (fine && e.clientY <= 0 && now() > 8000) react('exit', LINES.exit, 2600, 'sad');
    });
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hiddenAt = now();
      else if (now() - hiddenAt > 5000) react('back', LINES.back, 1800, 'happy');
    });
    new MutationObserver(() => {
      react('theme', document.documentElement.getAttribute('data-theme') === 'dark' ? LINES.dark : LINES.light, 1200);
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    addEventListener('contextmenu', () => react('rightclick', LINES.rightclick, 1800, 'angry'));
    document.addEventListener('copy', () => react('copy', LINES.copy, 1800, 'happy'));
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
    await settled();
    await moveHead(d.x, d.y, 800, SPRING);
    emote('!');
    life.surprise = now() + 350;
    wave();
    if (document.querySelector('.identity .name')?.textContent.trim() === '404') {
      await quip(LINES.lost, 3200, 'sad');
      return;
    }
    await wait(700);
    if (!chatOn) intro();
  }

  function start() {
    if (S.quiet) root.classList.add('quiet');
    if (!sound.on) root.classList.add('muted');
    if (visitor && navigator.sendBeacon) navigator.sendBeacon(API + '/visit', JSON.stringify({ visitor, path: here, referrer: document.referrer }));
    const met = S.met;
    if (S.open) { actor.classList.add('on'); restore(); }
    else if (!met) enter().finally(() => { pres.ready = true; });
    else {
      const d = dockPos();
      setHead(d.x, d.y);
      actor.classList.add('on');
      play(headBtn, [{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
    }
    schedule(met ? rand(9000, 14000) : 13000);
    if (met) pres.ready = true;
    setInterval(presence, 1000);
  }

  function boot() {
    document.body.appendChild(root);
    measure();
    wire();
    requestAnimationFrame(tick);
    if (HANDS) Object.values(HANDS).forEach((h) => { new Image().src = h.src; });
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
