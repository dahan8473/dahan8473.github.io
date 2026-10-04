/* Talking head for davidliu.work.
   A cutout of David's head floats around the page and pesters visitors into
   talking to it. A floating hand points at things, grabs links and whole
   sections, and drags them to the cursor. Replies stream from /api/chat. */
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

  // The cat. The walk is one loop of her stride, facing right, paws on the
  // bottom edge: `stride` is how far she moves per loop (sprite px) and `ms` how
  // long a loop takes, so her paws don't skate. The footage we have only shows
  // her front half, so it's her head from a video frame on a body drawn to her
  // photos. A side-on walking clip works too: `swift tools/cutout.swift frames
  // <dir> media/cat/walk.webp` prints all of it. The poses are photos
  // (`... thing <photo> media/cat/lie.webp x,y`). Left null, an outline cat stands in.
  const PET = {
    walk: { src: '/media/cat/walk.webp', frames: 16, w: 440, h: 294, stride: 120, ms: 500 },
    lie: { src: '/media/cat/lie.webp', w: 400, h: 225 },
    sleep: { src: '/media/cat/sleep.webp', w: 400, h: 395 },
    belly: { src: '/media/cat/belly.webp', w: 400, h: 331 }
  };

  const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
    ? '/api'
    : 'https://davidliu-work.vercel.app/api';
  const EMAIL = 'davidliu8473@gmail.com';
  const MAX_TURNS = 25;

  // ---- Lines ----------------------------------------------------------------
  // Everything the head says without asking the model. Lowercase, no em dashes.
  const LINES = {
    intro: [
      "belloo! i'm david. well, the floating head version of him. what's your name?",
      "oh hey. i'm david, or what's left of him. what's your name?",
      "heyyy. i'm david's head. he left me in charge. what's your name?",
      "oh! a visitor. hi, i'm david. mostly. what's your name?"
    ],
    introBack: (name) => `${name.toUpperCase()} YOU CAME BACK! it's been so boring. david didn't code anything for me to do while you were gone`,
    introIgnored: "okay, i'll let you look around. just lmk if you have any questions!",
    again: 'welcome back!',
    // Quick replies under the intro: [label, what it does]
    choices: [['wanna know more about you', 'ask'], ['just lookin around', 'tour'], ["i'm hiring", 'ask']],
    tourStart: 'okay! follow me',
    lost: "you're lost huh. me too. where were you trying to go?",
    found: "it's right over here!",
    cat: ['she likes you', "that's meowmeow btw. she's not allowed on the keyboard", "she doesn't do that for everyone"],
    close: "okay. i'll be right here",
    shoo: "fine. i'll be quiet. i'll just be here 😭",
    poke: ['ow', 'hey', "that's my face", 'okay you can stop now', "i'm telling david"],
    knock: ['hellloooo?', 'am i muted 😭', 'i can see u scrolling..', 'yea ok just ignore me'],
    bonk: ['oops', 'ow. who put that there', 'my bad'],
    letgo: ['fine', "okay i'll put it back", 'no? cool. cool cool'],
    landed: ['again! no wait'],
    dizzy: ["ok i'm gonna be sick", 'hold on i might throw up'],
    fed: ['nom nom. okay so about this one...'],
    carry: ['look what i found'],
    putBack: 'okay okay, putting it back',
    mischief: { take: 'you can have this back when you talk to me', give: 'fine. i was bored' },
    // Keyed by target id (talk/targets.json). Fetching something to the cursor
    // only happens when they asked, or when it clearly fits who they are.
    yank: {
      'resume-swe': "psst. recruiter? resume's right here",
      'resume-door': "psst. recruiter? resume's right here",
      rag: "ooo this one's good, give it a click",
      dashboard: 'i built a whole 3D game for this, you should take a look',
      kunlun: 'i made a clothing brand. based on chinese mythology. click',
      github: 'take a look at my commits here!',
      hackthenorth: 'this one won hack the north. just saying...',
      email: "here's my email. talk to me here!"
    },
    shove: {
      build: "here, i'll bring the good stuff to you",
      lead: "oo i'm really proud of this one. this is a nonprofit i'm running, take a look!",
      play: 'the fun section. i play classical guitar',
      'tethos-impact': 'this part. read this part'
    },
    point: {
      nav: 'everything about me is in this bar!',
      guitar: 'these are real recordings of me playing! you can listen while you browse the site',
      now: "here's a summary of what i'm doing rn",
      'resume-swe': "resume's up here if you wanna keep it :)"
    },
    roam: {
      build: 'i built all of these projects. ask me which one made me cry',
      awards: 'heh.. 🙂‍↕️'
    },
    // Fourth wall
    devtools: ['woah woah woah. what are you doing', "close that. i'm shy", 'we literally just met'],
    devtoolsAgain: 'inspect element again? we talked about this',
    devtoolsBye: 'thank you. that was a lot 😮‍💨',
    exit: 'wait wait where are you going, i got more to show u!!!',
    back: "oh you're back! i didn't move. i can't, i'm a head",
    dark: 'ooh dark mode. good choice',
    light: 'flashbang 😭 my eyes',
    rightclick: 'right click? what are you gonna do, save my face? 😳',
    copy: 'copying my stuff? go ahead honestly',
    print: "no way you're printing my website ON PAPER. you can just download my resume you know",
    squish: "i'm claustrophobic you know",
    wake: "huh? oh. i wasn't sleeping",
    mic: "oh you're actually talking to me 😳 hi",
    micBlocked: "i can't hear you, you're muted. make sure to unblock your mic",
    offline: `my brain's not connected rn 😭 email me instead: ${EMAIL}`,
    limit: `okay we've talked a lot 😭 the real me would love to keep going over email: ${EMAIL}`,
    // Said once each, when they open, click, or stop to read something. Keyed by data-t.
    notice: {
      western: 'fourth year! graduating 2028 if all goes well 🤞',
      jdpower: 'ooo sixteen months here. ask me anything about it',
      modern: 'i programmed a robot arm to move and polish parts. i felt like tony stark in this internship',
      tsinghua: 'ahhh take me back 🥹',
      genesis: 'genesis was our demo day. 260 people came to watch students demo software for nonprofits',
      wfn: "this was the first student club i was in! while i was VP i hosted ontario's largest hackathon education event!",
      'tethos-platform': 'you can actually walk around that island. i made models for 91 kinds of fish, i just really like fish',
      hackthenorth: 'ooo this was my first hardware project! it was really fun running around the hackathon at night testing it with my teammates',
      biopilot: 'this was the first hackathon i won!',
      kunlun: "my clothing brand. i'm still working on the pieces for the first drop rn",
      'rag-card': 'added a rag service cuz i wanna keep a centralized knowledge base for future years!',
      dejaview: 'this was my proudest hackathon project! it scrapes the media you watch, finds furniture you like and places it in a virtual 3D scan of your room! pretty dystopian i know, but so am i haha',
      snake: 'i made this cuz i thought it would look cool on my github. turns out a lot of ppl like this kinda stuff too haha',
      awards: 'heh.. 🙂‍↕️',
      skills: 'ask me about any of these!',
      brain: "this is my second brain! double click anything and i'll tell you about it",
      contact: "email's the best way to reach me!",
      meowmeow: "that's meowmeow! she's really fat and sleeps all day. want me to call her over?",
      guitar: 'these are real recordings of me playing! you can listen while you browse the site',
      muaythai: 'i coach the beginner class! do you train anything?',
      climbing: 'man i can only do a v2 :( do you climb?',
      badminton: 'badminton was my main sport all through high school! i played doubles. do you play?',
      hiking: 'panorama ridge was the big one, 30k round trip. do you hike?',
      photography: 'i shoot on my fujifilm x-t200 and sony a7r ii, do you shoot at all?',
      fashion: "kunlun! i'm still working on the pieces for the first drop rn"
    },
    // Where the 404 offers to take them.
    ways: [['home', '/'], ['resume', '/resume/'], ['projects', '/projects/'], ['hobbies', '/hobbies/'], ['brain', '/brain/'], ['notes', '/notes/'], ['messages', '/messages/']],
    // Small talk through the visit, all about them. Each topic leads to
    // something of mine the brain can connect (see Small talk in api/chat.js).
    // The page's own topic goes first, then this order. `only` waits for its
    // page; `notice` skips it if that notice line already asked the same thing.
    small: [
      { id: 'pets', line: (name) => `${name || 'hey'}, random question. do you have any pets?`, page: '/hobbies/meowmeow/' },
      { id: 'work', line: 'what are you working on these days?', page: '/projects/' },
      { id: 'fun', line: "what do you do when you're not working?", page: '/hobbies/' },
      { id: 'sports', line: 'do you play any sports or train anything?', page: '/hobbies/muay-thai/', notice: 'muaythai' },
      { id: 'music', line: 'do you play any music?', page: '/hobbies/guitar/' },
      { id: 'climb', line: 'do you climb at all?', page: '/hobbies/climbing/', only: true, notice: 'climbing' },
      { id: 'badminton', line: 'do you play badminton?', page: '/hobbies/badminton/', only: true, notice: 'badminton' },
      { id: 'travel', line: 'been anywhere good lately?', page: '/hobbies/travel/' },
      { id: 'make', line: 'do you make anything for fun? art, code, clothes, videos, anything', page: '/hobbies/fashion/' },
      { id: 'photos', line: 'do you take photos at all?', notice: 'photography' },
      { id: 'games', line: 'chess or video games?' },
      { id: 'found', line: "how'd you end up on my site btw?" },
      { id: 'map', line: 'if you had a map like this, what would be the biggest node?', page: '/brain/', only: true },
      { id: 'wall', line: 'what would you write on the wall? :)', page: '/notes/', only: true }
    ],
    // One deep question a visit, once they've answered some small talk, never
    // for recruiters. David's takes live in api/chat.js under Deep questions.
    deep: [
      { id: 'freewill', line: (name) => `${name ? name + ', ' : ''}do you think we have free will?` },
      { id: 'ai', line: 'kinda ironic asking this as an ai clone of myself, but where do you think all this ai stuff is going?' },
      { id: 'clone', line: 'if you could make an ai version of yourself like me, would you?' },
      { id: 'still', line: 'if an ai was trained perfectly on you, would it still be you?' },
      { id: 'scale', line: (name) => `${name ? name + ', ' : ''}rate yourself. when it comes to tech, 1 is all profit and 10 is all ethics. where are you?`, scale: ['all profit', 'all ethics'] }
    ],
    // The guitar page: asks if they play, and brings the guitar out if they want it.
    guitar: {
      ask: 'do you play guitar yourself?',
      yes: 'ooo nice!! here, play something',
      try: 'ever wanted to try?',
      sure: 'ok here, play something',
      nah: 'fair haha. the recordings are right there if you wanna listen'
    },
    // The mini tour: [page, target to point at, line]
    tour: [
      ['/', 'now', "okay! quick tour. this is home, it's just me saying hi"],
      ['/resume/', 'jdpower', 'this is my resume. hover anything and more pops up on the side'],
      ['/projects/', 'hackthenorth', "stuff i've built. this one was my first hardware project"],
      ['/hobbies/', 'life', 'and the stuff i do for fun'],
      ['/brain/', 'brain', "this is my second brain. everything i know about me, as a map you can drag around"],
      ['/notes/', 'wall', 'you can leave a note on the wall before you go :)']
    ],
    tourEnd: "that's it! i'm way more fun when you talk to me, so ask me anything :)",
    wall: "if you want a private note sent to him, just text me and let me know. i won't tell anyone else, trust 🤐",
    noteContact: "got it 🤐 if he replies it'll show up in messages. want an email too? drop it, or say skip",
    // The real David answered something they sent him (messages or a private note).
    replied: (text, more) => `the real me just replied!! 👀 he said: "${text}"${more ? " there's more in messages" : ''}`,
    noteSent: 'sent. my lips are sealed 🤐',
    noteFailed: `hm that didn't go through 😭 email him directly: ${EMAIL}`
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
  let here = norm(location.pathname);
  const clock = () => new Date().toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }).toLowerCase();

  const S = Object.assign(
    { msgs: [], open: false, met: false, quiet: false, antics: 0, once: [], pending: null, lastKind: '', noticed: [], small: [] },
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
        <p class="dl-recall" hidden></p>
        <p class="dl-text" aria-live="polite"></p>
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
  const recallEl = $('.dl-recall');
  const textEl = $('.dl-text');
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
  const sp = { q: [], page: '', typing: false, ended: true, fast: false, timer: 0, resolve: null, done: Promise.resolve() };

  function speak(text, { echo = '', stream = false } = {}) {
    clearTimeout(sp.timer);
    if (sp.resolve) sp.resolve();
    Object.assign(sp, { q: [], page: '', typing: false, ended: !stream, fast: false, resolve: null });
    sp.done = new Promise((r) => { sp.resolve = r; });
    textEl.textContent = '';
    textEl.classList.remove('clip');
    recallEl.hidden = true;
    echoEl.textContent = echo;
    echoEl.hidden = !echo;
    if (text) feed(text);
    else pump();
    return sp.done;
  }
  function feed(s) { for (const ch of s) sp.q.push(ch); pump(); }
  function feedAction(a) { sp.q.push(a); pump(); }
  function endSpeech() { sp.ended = true; pump(); }
  function pump() { if (!sp.typing) step(); }

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
      sp.q.shift();
      if (/\s/.test(item) && (!n || /\s$/.test(sp.page))) continue;
      sp.page += item;
      // Long replies scroll inside the bubble. Follow the typing unless they scrolled up to reread.
      const follow = textEl.scrollHeight - textEl.scrollTop - textEl.clientHeight < 24;
      textEl.textContent = sp.page;
      if (follow) textEl.scrollTop = textEl.scrollHeight;
      textEl.classList.toggle('clip', textEl.scrollTop > 0);
      voice(item);
      sp.typing = true;
      sp.timer = setTimeout(step, reduce ? 0 : sp.fast ? 6 : /[.!?]/.test(item) ? 300 : /[,;:]/.test(item) ? 140 : 28);
      return;
    }
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
      if (!asking && !sp.typing) await speak(text);
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

  // Pick something up and float around holding it. A copy rides along under
  // the head while the real one fades out of the page, then it goes back.
  let carried = null;
  const carryable = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 40 && r.width < innerWidth * 0.7 && r.height < innerHeight * 0.7;
  };
  function carry(el, { hold = 6500 } = {}) {
    if (reduce || carried || held || !carryable(el)) return point(el);
    return useHand(async () => {
      const ep = epoch;
      pose('pinch');
      await unfold(el);
      await ensureVisible(el);
      if (ep !== epoch) return;
      const r = el.getBoundingClientRect();
      await handNearHead();
      await handTo(r.right - 16, r.top + 12, 45, { duration: 560 });
      if (ep !== epoch) return;
      sound.tick();
      const k = Math.min(1, 170 / r.width, 150 / r.height);
      const ghost = el.cloneNode(true);
      ghost.removeAttribute('id');
      ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
      ghost.classList.remove('on', 'pinned');
      ghost.classList.add('dl-carried');
      Object.assign(ghost.style, { width: r.width + 'px', height: r.height + 'px', transform: `translate(${r.left}px,${r.top}px)` });
      root.insertBefore(ghost, hand);
      el.classList.add('dl-gone');
      const c = { el, ghost, k, w: r.width, h: r.height, x: r.left, y: r.top, s: 1, raf: 0 };
      carried = c;
      const loop = () => {
        if (carried !== c) return;
        const tx = pos.x + HW * 0.5 - c.w * c.k * 0.5;
        const ty = pos.y + HH * 0.78;
        c.x += (tx - c.x) * 0.16;
        c.y += (ty - c.y) * 0.16;
        c.s += (c.k - c.s) * 0.16;
        const tilt = Math.sin(now() / 260) * 3;
        ghost.style.transform = `translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) scale(${c.s.toFixed(3)}) rotate(${tilt.toFixed(2)}deg)`;
        handSet(c.x + c.w * c.s - 10, c.y + 8, 45, 1);
        c.raf = requestAnimationFrame(loop);
      };
      c.raf = requestAnimationFrame(loop);
      quip(pick(LINES.carry), 1400, 'happy');
      for (let i = 0; i < 2 && ep === epoch; i++) {
        await moveHead(rand(innerWidth * 0.15, innerWidth * 0.75), rand(innerHeight * 0.2, innerHeight * 0.55), 1300);
        await wait(rand(700, 1200));
      }
      await wait(Math.max(0, hold - 5000));
      await putBack();
    });
  }
  async function putBack() {
    const c = carried;
    if (!c) return;
    cancelAnimationFrame(c.raf);
    quip(LINES.putBack, 900);
    const r = c.el.getBoundingClientRect();
    handTo(r.right - 16, r.top + 12, 45, { duration: 620, easing: SPRING });
    await play(c.ghost, [{ transform: c.ghost.style.transform }, { transform: `translate(${r.left}px,${r.top}px) scale(1)` }], { duration: 620, easing: SPRING });
    c.el.classList.remove('dl-gone');
    c.ghost.remove();
    carried = null;
  }

  // Ignored for a long time: the hand walks off with the page bar, and gives
  // it back when they talk to the head, change pages, or after a while.
  let giveBack = null;
  async function mischief() {
    const bar = document.querySelector('.rail');
    if (!bar || S.once.includes('mischief')) return;
    S.once.push('mischief');
    save();
    await useHand(async () => {
      const r = bar.getBoundingClientRect();
      pose('pinch');
      await handNearHead();
      await handTo(r.left + r.width / 2, r.top + 14, 90, { duration: 620 });
      sound.tick();
      const narrow = innerWidth < 721;
      bar.style.translate = narrow ? '0 -130%' : '-150% 0';
      await handTo(narrow ? r.left + r.width / 2 : -60, narrow ? -60 : r.top + 14, 90, { duration: 600 });
    });
    quip(LINES.mischief.take, 2600, 'happy');
    let back = false;
    giveBack = () => {
      if (back) return;
      back = true;
      giveBack = null;
      bar.style.translate = '';
      quip(LINES.mischief.give, 1400);
    };
    setTimeout(() => giveBack && giveBack(), 25000);
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
          const m = /^(point|drag|face|summon|carry|mode|recall|show|bring):([a-z0-9,-]+)$/.exec(inner);
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
  let mode = '';
  function act(a) {
    if (a.verb === 'face') { setFace(a.id, 3500); return; }
    if (a.verb === 'summon') { if (a.id === 'cat') summonCat(); return; }
    if (a.verb === 'mode') { mode = a.id; return; }
    if (a.verb === 'recall') { recall(a.id.split(',')); return; }
    if (a.verb === 'show') { show(a.id); return; }
    if (a.verb === 'bring') { bring(a.id); return; }
    if (a.verb === 'note') {
      if (a.id === 'name') try { localStorage.setItem('dl-name', a.value.slice(0, 40)); } catch (e) {}
      if (a.id === 'who') { S.who = a.value.slice(0, 20); save(); }
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
      return a.verb === 'drag' ? yank(el, { hold: 7000 }) : a.verb === 'carry' ? carry(el) : point(el);
    }).catch(() => {});
  }
  // [[show:id]]: the head holds up a picture next to the bubble for a bit.
  const SHOW = {
    bus: { src: '/media/life/nothing-matters.webp', alt: 'Two guys on the same bus, both thinking "nothing matters". One looks at a rock wall and is sad, the other looks at a sunset and is happy.' }
  };
  let showing = null;
  function show(id) {
    const s = SHOW[id];
    if (!s) return;
    unshow();
    const fig = document.createElement('figure');
    fig.className = 'dl-show';
    fig.appendChild(Object.assign(new Image(), { src: s.src, alt: s.alt }));
    fig.addEventListener('click', unshow);
    const b = talk.getBoundingClientRect();
    const w = Math.min(300, innerWidth - 24);
    let x = b.left - w - 18, y = b.top;
    if (x < 12) { x = clamp(b.right - w, 12, innerWidth - w - 12); y = b.top - w * 0.9 - 14; }
    Object.assign(fig.style, { left: x + 'px', top: Math.max(12, y) + 'px', width: w + 'px' });
    root.appendChild(fig);
    showing = fig;
    setTimeout(() => { if (showing === fig) unshow(); }, 16000);
  }
  function unshow() {
    const f = showing;
    if (!f) return;
    showing = null;
    f.classList.add('out');
    setTimeout(() => f.remove(), 300);
  }
  // The second brain: which notes the head is pulling from, shown in the
  // bubble and lit up on /brain/. Titles come from the public map.
  let brainMap = null;
  const brainTitles = () => (brainMap ??= fetch('/brain/graph.json').then((r) => r.json()).then((g) => Object.fromEntries(g.nodes.map((n) => [n.id, n.title]))).catch(() => ({})));
  async function recall(ids) {
    const titles = await brainTitles();
    const names = ids.map((id) => titles[id]).filter(Boolean);
    document.dispatchEvent(new CustomEvent('dl:recall', { detail: { ids } }));
    if (!names.length) return;
    recallEl.textContent = 'recalling ' + names.join(' · ');
    recallEl.hidden = false;
  }

  // Pages swap in place (site.js), so the head and the music stay. Without
  // that, it's a normal load and S.pending finishes the gesture on arrival.
  async function navigate(page) {
    if (norm(page) === here) return;
    if (window.dlGo) { await window.dlGo(page); await wait(350); return; }
    location.href = page;
    await new Promise(() => {});
  }
  // The thing they asked about lives on another page: point at the link
  // that goes there, go, and finish the gesture there.
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
    await navigate(page);
    S.pending = null;
    save();
    act(a);
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
    choicesEl.classList.remove('scale');
    choicesEl.replaceChildren(...LINES.choices.map(([c, does]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c;
      b.addEventListener('click', () => (does === 'tour' ? startTour(c) : ask(c)));
      return b;
    }));
    choicesEl.hidden = false;
  }

  async function openChat() {
    interrupt();
    if (giveBack) giveBack();
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
    const said = pres.last && now() - pres.last.at < (pres.last.keep || 15000) ? pres.last.text : '';
    pres.last = null;
    if (said) { S.msgs.push({ role: 'assistant', content: said }); save(); speak(said); }
    else if (!talked()) await greet();
    else speak(LINES.again);
  }

  // The head starts the conversation: who it is, then their name.
  async function greet() {
    const name = knownName();
    const line = name ? LINES.introBack(name) : pick(LINES.intro);
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
    touring = false;
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
    touring = false;
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
    if (!asking && !sp.typing) speak(LINES.poke[pokes++ % LINES.poke.length]);
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
  async function ask(q, { note = false, fallback = '' } = {}) {
    q = q.trim().slice(0, 500);
    if (!q || asking) return;
    if (!note && S.noting) return takeNote(q);
    if (!note) {
      touring = false;
      if (giveBack) giveBack();
      choicesEl.hidden = true;
      input.value = '';
      pres.streak = 0;
      unshow();
      if (pres.waiting) { S.smallAnswered = true; save(); }
      pres.waiting = false;
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
      if (!raw && note) { S.msgs.pop(); raw = fallback || smallLine()?.text || LINES.offline; parser.push(raw); parser.end(); }
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
    if (mode === 'note') { S.noting = 'message'; save(); }
    else if (mode === 'tour') tour();
    mode = '';
    if (navTo) { const a = navTo; navTo = null; await queue; goTo(a); }
  }

  // Private notes for the real David, taken in the chat. They skip the brain
  // and the chat log and go straight to him.
  async function takeNote(q) {
    choicesEl.hidden = true;
    input.value = '';
    if (S.noting === 'message') {
      S.noteMsg = q;
      S.noting = 'contact';
      save();
      return speak(LINES.noteContact, { echo: q });
    }
    const contact = /^(skip|no|nah|nope|no thanks)\b/i.test(q) ? '' : q;
    const message = S.noteMsg;
    S.noting = null;
    S.noteMsg = '';
    save();
    asking = true;
    emote('...', { sticky: true });
    let ok = false;
    try {
      const res = await fetch(API + '/note', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ visitor, name: knownName(), contact, message, page: here })
      });
      const r = res.ok ? await res.json() : {};
      ok = Boolean(r.saved || r.mailed);
      if (ok) try { localStorage.setItem('dl-inbox', '1'); } catch (e) {}
    } catch (e) {}
    emoteOff();
    setFace(ok ? 'happy' : 'sad', 2000);
    await speak(ok ? LINES.noteSent : LINES.noteFailed, { echo: q });
    asking = false;
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
    textEl.textContent = last ? strip(last.content) : LINES.intro[0];
    linkify();
    if (S.pending) {
      const a = S.pending;
      S.pending = null;
      save();
      setTimeout(() => act(a), 700);
    }
  }

  // ---- Director: the bits it does on its own --------------------------------

  const dir = { timer: 0, busy: false, count: 0, moves: [] };
  function schedule(ms) {
    clearTimeout(dir.timer);
    if (!reduce && !S.quiet) dir.timer = setTimeout(nextBit, ms);
  }
  function interrupt() {
    epoch++;
    clearTimeout(dir.timer);
    release();
    putBack();
  }

  // What's on screen and what they're doing, for Jev to decide on.
  let pageAt = now();
  function activity() {
    const t = now();
    if (input.value) return 'typing';
    if (t - lastScroll < 2000) return 'scrolling';
    if (t - lastMove < 2000) return 'hovering';
    return t - lastInput > 30000 ? 'idle' : 'reading';
  }
  async function decideMove() {
    try {
      const res = await fetch(API + '/decide', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({
          page: here,
          chat_open: chatOn,
          talked: talked(),
          visitor_type: S.who || '',
          activity: activity(),
          looking_at: pres.at,
          seconds_on_page: (now() - pageAt) / 1000,
          seconds_idle: (now() - lastInput) / 1000,
          seconds_quiet: (now() - pres.said) / 1000,
          pages_seen: S.pages || 1,
          recent_moves: dir.moves.slice(-6),
          on_screen: Object.keys(targets).filter((id) => { const el = find(id); return el && inView(el); })
        })
      });
      return res.ok ? await res.json() : null;
    } catch (e) { return null; }
  }

  const roamBit = (el, line) => ({ kind: 'roam', run: async () => { const ep = epoch; await roam(el); if (ep === epoch) await quip(line, 2200); } });
  const pointBit = (el, line) => ({ kind: 'point', run: () => Promise.all([quip(line, 1800), point(el, { hold: 1600 })]) });
  // Jev's move, turned into something the head does. Fetching to the cursor
  // only happens for a visitor who reads as a recruiter.
  function bitFor(move, id) {
    const el = id && find(id);
    if (move === 'comment' && el && LINES.notice[id] && !S.noticed.includes(id)) return { kind: 'comment', run: () => { S.noticed.push(id); save(); return chime(LINES.notice[id]); } };
    if (move === 'comment' && el && LINES.roam[id] && inView(el)) return roamBit(el, LINES.roam[id]);
    if (move === 'point' && el && LINES.point[id]) return pointBit(el, LINES.point[id]);
    if (move === 'fetch' && el && S.who === 'recruiter' && fine && cursor.seen && LINES.yank[id]) {
      return { kind: 'fetch', run: async () => { await Promise.all([quip(LINES.yank[id], 1500), yank(el, { hold: 5200 })]); await quip(pick(LINES.letgo), 600, 'sad'); } };
    }
    if (move === 'carry' && el && carryable(el)) return { kind: 'carry', run: () => carry(el) };
    if (move === 'mess' && !talked() && !S.once.includes('mischief')) return { kind: 'mess', run: mischief };
    if (move === 'nap' && now() - lastInput > 30000) return { kind: 'nap', run: async () => { life.sleep = true; setFace('blink'); emote('z', { sticky: true }); } };
    return null;
  }
  // Without Jev: a few gentle bits. Nothing that makes them click.
  function localBits() {
    const out = [];
    const each = (map, fn) => Object.keys(map).forEach((id) => { const el = find(id); if (el && inView(el)) fn(el, map[id]); });
    each(LINES.roam, (el, line) => out.push(roamBit(el, line)));
    each(LINES.point, (el, line) => out.push(pointBit(el, line)));
    const pic = [...document.querySelectorAll('main .shot img, main .cats img')].find(inView);
    if (pic && !S.once.includes('carried')) out.push({ kind: 'carry', run: () => { S.once.push('carried'); save(); return carry(pic.closest('.proj') || pic); } });
    const bonkable = ['build', 'lead', 'play'].map(find).find((el) => el && inView(el));
    if (bonkable) out.push({ kind: 'bonk', run: async () => { const ep = epoch; await bonk(bonkable); if (ep === epoch) await quip(pick(LINES.bonk), 1200); } });
    if (!talked() && dir.count > 0 && !S.once.includes('knock')) {
      out.push({ kind: 'knock', run: () => { S.once.push('knock'); save(); return Promise.all([knock(), wait(400).then(() => quip(pick(LINES.knock), 1800))]); } });
    }
    return out;
  }
  const idleNow = () => chatOn || held || carried || touring || dir.busy || document.hidden || life.sleep || life.shy;
  async function nextBit() {
    if (S.quiet || reduce) return;
    if (idleNow()) return schedule(9000);
    if (dir.count >= 4 || S.antics >= 12) return;
    dir.busy = true;
    const d = await decideMove();
    dir.busy = false;
    if (idleNow()) return schedule(9000);
    let bit = d && d.move ? bitFor(d.move, d.item) : null;
    if (!d || !d.move) {
      const all = localBits().filter((b) => b.kind !== S.lastKind);
      bit = all.length ? pick(all) : null;
    }
    if (!bit) return schedule(rand(15000, 25000));
    dir.busy = true;
    dir.count++;
    dir.moves.push(bit.kind);
    S.antics++;
    S.lastKind = bit.kind;
    save();
    const ep = epoch;
    try { await bit.run(); } catch (e) {}
    dir.busy = false;
    if (ep === epoch && !chatOn && !life.sleep) await goHome(900);
    schedule(rand(20000, 32000));
  }

  // ---- Tour -------------------------------------------------------------------

  let touring = false;
  function say(text) {
    if (!chatOn) return quip(text, 1800);
    S.msgs.push({ role: 'assistant', content: text });
    save();
    return speak(text);
  }
  async function tour() {
    if (touring) return;
    touring = true;
    interrupt();
    try {
      for (const [page, id, line] of LINES.tour) {
        if (!touring) return;
        await navigate(page);
        if (!touring) return;
        const el = find(id);
        await Promise.all([say(line), el ? point(el, { hold: 1200 }) : null]);
        if (el && el.matches('.r-item') && window.dlPin) window.dlPin(el);
        await wait(1500);
      }
      if (touring) await say(LINES.tourEnd);
    } finally {
      touring = false;
    }
  }
  // The page can hand the head a question (clicking a note on /brain/).
  window.dlAsk = async (q) => {
    if (asking) return;
    if (!chatOn) {
      interrupt();
      chatOn = true;
      S.open = true;
      save();
      root.classList.add('chat');
      await goHome(420);
      showTalk();
      showForm();
    }
    ask(q);
  };

  async function startTour(label) {
    choicesEl.hidden = true;
    S.msgs.push({ role: 'user', content: label });
    save();
    await speak(LINES.tourStart, { echo: label });
    tour();
  }

  // ---- 404: offer directions ------------------------------------------------------

  const is404 = () => document.querySelector('.identity .name')?.textContent.trim() === '404';
  async function lost() {
    chatOn = true;
    S.open = true;
    save();
    root.classList.add('chat');
    await goHome(420);
    showTalk();
    showForm();
    setFace('sad', 2000);
    await speak(LINES.lost);
    choicesEl.replaceChildren(...LINES.ways.map(([label, page]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', async () => {
        choicesEl.hidden = true;
        await navigate(page);
        const el = document.querySelector('main h1, main .hello, main .header');
        speak(LINES.found);
        if (el) point(el, { hold: 1600 });
      });
      return b;
    }));
    choicesEl.hidden = false;
  }

  // ---- Presence: like he's actually sitting there ---------------------------
  // He sees what you open, play, hover on or stop to read, and says something
  // about it. When the chat goes quiet he makes small talk instead of idling.

  const pres = { ready: false, seen: '', seenAt: 0, said: now(), streak: 0, out: 0, brain: false, at: '', atSince: 0, last: null, smallAt: now(), waiting: false };

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
  // Small talk through the visit, like a friend sitting next to you: a light
  // question now and then, never a second one before they've answered the
  // last. Mid-conversation the brain asks it in its own words, so it doesn't
  // ask about pets after they've told it about their dog.
  const SMALL_MAX = 6;
  function smallLine() {
    const asked = S.small || [];
    const open = LINES.small.filter((s) => !asked.includes(s.id) && !(s.notice && S.noticed.includes(s.notice)));
    const hit = open.find((s) => s.page === here) || open.find((s) => !s.only);
    if (!hit) return null;
    S.small = [...asked, hit.id];
    save();
    return { id: hit.id, text: typeof hit.line === 'function' ? hit.line(knownName()) : hit.line };
  }
  function smallDue(t, quiet) {
    if (S.quiet || (S.small || []).length >= SMALL_MAX) return false;
    if (chatOn) return !pres.waiting && quiet > 40000 && t - pres.smallAt > 60000 && pres.streak < 3;
    // Browsing with the chat tucked away: only while they're actually around,
    // and once at most for someone who never answered the hello.
    return quiet > 60000 && t - pres.smallAt > 100000 && t - lastInput < 20000 && pres.out < 6 && (talked() || !(S.small || []).length);
  }
  // The deep one: asked word for word, since David wrote them. The scale one
  // gets 1 to 10 buttons under the bubble.
  const deepDue = () => chatOn && !S.deep && S.smallAnswered && S.who !== 'recruiter';
  async function deepTalk() {
    const d = pick(LINES.deep);
    S.deep = d.id;
    save();
    pres.smallAt = now();
    pres.waiting = true;
    await chime(typeof d.line === 'function' ? d.line(knownName()) : d.line);
    if (d.scale && chatOn && !asking && !input.value) showScale(d.scale);
  }
  function showScale([lo, hi]) {
    const row = document.createElement('div');
    row.className = 'dl-scale';
    for (let i = 1; i <= 10; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i;
      b.setAttribute('aria-label', `${i} out of 10`);
      b.addEventListener('click', () => ask(`${i}/10`));
      row.appendChild(b);
    }
    const ends = document.createElement('p');
    ends.className = 'dl-scale-ends';
    ends.append(Object.assign(document.createElement('span'), { textContent: lo }), Object.assign(document.createElement('span'), { textContent: hi }));
    choicesEl.replaceChildren(row, ends);
    choicesEl.classList.add('scale');
    choicesEl.hidden = false;
  }
  function smallTalk() {
    if (deepDue()) return deepTalk();
    const q = smallLine();
    if (!q) return;
    pres.smallAt = now();
    if (!chatOn) { chime(q.text); if (pres.last) pres.last.keep = 30000; return; }
    pres.waiting = true;
    if (!pres.brain || !talked()) return chime(q.text);
    pres.streak++;
    const on = pres.at || pres.seen;
    ask(`(stage note: it's gone quiet for a bit. small talk, topic ${q.id}: ask about them in your own words, like "${q.text}". just the question, your side comes later. if they already told you about that, pick another topic you haven't asked about.${on ? ` they seem to be looking at ${on}.` : ''})`, { note: true, fallback: q.text });
  }

  function presence() {
    if (!pres.ready) return;
    const t = now();
    const at = reading();
    if (at !== pres.at) { pres.at = at; pres.atSince = t; }
    else if (at && t - pres.atSince > 12000 && t - lastScroll > 3000 && pres.seen !== at && !S.noticed.includes(at)) { pres.seen = at; pres.seenAt = t; }
    if (pres.seen && t - pres.seenAt > 15000) pres.seen = '';

    if (document.hidden || !document.hasFocus() || asking || held || carried || touring || dir.busy || drag.on || life.shy || rec || sp.typing || input.value || S.noting) return;
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
    if (smallDue(t, quiet)) return smallTalk();
    // Nobody's answering: tuck the chat away and let them browse.
    if (chatOn && !talked() && quiet > 30000 && (pres.waiting || pres.streak >= 3)) closeChat(LINES.introIgnored);
  }

  // ---- Bringing things out ----------------------------------------------------
  // The hand grabs something and plops it onto the page (site.js mounts it).
  async function bring(id) {
    const slot = document.querySelector(`main [data-later="${id}"]`);
    if (!slot || slot.hasAttribute('data-3d') || !window.dlBring) return;
    if (reduce) { window.dlBring(id); return; }
    // Make the room first so the hand knows where to put it.
    slot.style.visibility = 'hidden';
    slot.hidden = false;
    await useHand(async () => {
      pose('pinch');
      await handNearHead();
      await ensureVisible(slot);
      const r = slot.getBoundingClientRect();
      await handTo(r.left + r.width * 0.55, r.top - 30, 15, { duration: 560 });
      window.dlBring(id, { plop: true });
      await handTo(r.left + r.width * 0.55, r.top + r.height * 0.2, 25, { duration: 260 });
      sound.tick();
      setFace('happy', 1600);
      await wait(450);
    });
  }

  // Quick replies under the bubble, for questions the head asks on its own.
  function options(list) {
    choicesEl.classList.remove('scale');
    choicesEl.replaceChildren(...list.map(([label, fn]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => { choicesEl.hidden = true; fn(label); });
      return b;
    }));
    choicesEl.hidden = false;
  }
  async function reply(label, text) {
    S.msgs.push({ role: 'user', content: label }, { role: 'assistant', content: text });
    save();
    pres.streak = 0;
    pres.waiting = false;
    await speak(text, { echo: label });
  }
  // On the guitar page the head asks if they play. Yes: it brings the guitar
  // out. No: would they want to try? Typed answers go to the brain, which
  // knows to bring it with [[bring:guitar]].
  async function askGuitar(tries = 0) {
    if (here !== '/hobbies/guitar/' || S.quiet) return;
    if (S.once.includes('guitar-ask') || !document.querySelector('main [data-later="guitar"]:not([data-3d])')) return;
    const mid = chatOn && S.msgs.length && S.msgs[S.msgs.length - 1].role === 'assistant' && /\?\s*$/.test(strip(S.msgs[S.msgs.length - 1].content)) && now() - pres.said < 20000;
    if (!pres.ready || asking || touring || held || carried || dir.busy || sp.typing || mid || document.hidden) {
      if (tries < 12) setTimeout(() => askGuitar(tries + 1), 3000);
      return;
    }
    S.once.push('guitar-ask');
    if (!S.noticed.includes('guitar')) S.noticed.push('guitar');
    S.small = [...new Set([...(S.small || []), 'music'])];
    save();
    wake();
    if (!chatOn) {
      chatOn = true;
      S.open = true;
      save();
      root.classList.add('chat');
      await goHome(420);
      showTalk();
      showForm();
    }
    await say(LINES.guitar.ask);
    pres.waiting = true;
    const out = async (label) => { await reply(label, LINES.guitar.yes); bring('guitar'); };
    options([
      ['yeah i do', out],
      ['nah', async (label) => {
        await reply(label, LINES.guitar.try);
        options([
          ['sure', async (l) => { await reply(l, LINES.guitar.sure); bring('guitar'); }],
          ["nah i'm good", (l) => reply(l, LINES.guitar.nah)]
        ]);
      }]
    ]);
  }

  // ---- Replies from the real David --------------------------------------------
  // Anyone who messaged him (on /messages/ or with a private note) hears from
  // the head when he answers, on whatever page they're on.
  async function checkReplies() {
    let asked = false, seen = '';
    try { asked = localStorage.getItem('dl-inbox') === '1'; seen = localStorage.getItem('dl-inbox-seen') || ''; } catch (e) {}
    if (!asked || document.hidden || here === '/messages/' || asking || touring || held || carried) return;
    let d;
    try { d = await (await fetch(`${API}/inbox?visitor=${visitor}`)).json(); } catch (e) { return; }
    const fresh = (d.messages || []).filter((m) => m.sender === 'david' && m.at > seen);
    if (!fresh.length || asking || here === '/messages/') return;
    try { localStorage.setItem('dl-inbox-seen', fresh[fresh.length - 1].at); } catch (e) {}
    interrupt();
    wake();
    if (!chatOn) {
      chatOn = true;
      S.open = true;
      save();
      root.classList.add('chat');
      await goHome(420);
      showTalk();
      showForm();
    }
    setFace('happy', 2500);
    await say(LINES.replied(fresh[fresh.length - 1].body, fresh.length > 1));
  }

  // ---- Feeding ----------------------------------------------------------------
  // "nom nom", then it talks about whatever it was fed: the brain when it's
  // up, the canned line otherwise.
  async function eat(id) {
    interrupt();
    wake();
    for (let i = 0; i < 3; i++) { voice('o'); squish(); await wait(170); }
    setFace('happy', 1800);
    if (!chatOn) {
      chatOn = true;
      S.open = true;
      save();
      root.classList.add('chat');
      await goHome(420);
      showTalk();
      showForm();
    }
    if (asking) return;
    const t = targets[id];
    await say(LINES.fed[0]);
    if (t && pres.brain) ask(`(stage note: the visitor dragged ${id} (${t.about}) onto your face and fed it to you)`, { note: true });
    else if (LINES.notice[id]) { await wait(500); say(LINES.notice[id]); }
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
  let catX = 0;
  let napTimer = 0;
  const small = () => innerWidth < 640;

  // Sized so her head is the same size walking, lying, curled up and rolled over.
  function catWidth(state) {
    if (!PET) return small() ? 66 : 96;
    if (state === 'walking') return Math.round((small() ? 74 : 102) * PET.walk.w / PET.walk.h);
    return { lying: small() ? 134 : 186, sleeping: small() ? 96 : 130, belly: small() ? 104 : 143 }[state];
  }
  function catAt(x) {
    catX = x;
    cat.style.transform = `translateX(${x}px)`;
  }
  // Switching pose keeps her centred where she was.
  function catState(state) {
    const was = parseFloat(cat.style.width) || 0;
    const w = catWidth(state);
    cat.className = `dl-cat${PET ? ' pet' : ''} ${state}`;
    cat.style.width = w + 'px';
    if (was) catAt(catX + (was - w) / 2);
  }
  // Load every pose before she shows up, so she never walks in blank.
  let catLoad = null;
  function catReady() {
    if (!catLoad) {
      catLoad = Promise.all(['walk', 'lie', 'sleep', 'belly'].map((k) => {
        const img = new Image();
        img.src = PET[k].src;
        return img.decode().catch(() => {});
      }));
    }
    return Promise.race([catLoad, wait(2500)]);
  }
  function catEl() {
    const el = document.createElement('div');
    const w = PET && PET.walk;
    el.innerHTML = `<div class="dl-cat-in">${PET
      ? `<div class="walk" style="background-image:url(${w.src});aspect-ratio:${w.w}/${w.h};background-size:${w.frames * 100}% 100%;animation-duration:${w.ms}ms;animation-timing-function:steps(${w.frames}, jump-none)"></div>` +
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
  let catComing = false;
  async function summonCat() {
    if (cat) { petCat(); return; }
    if (catComing) return;
    catComing = true;
    if (PET) await catReady();
    catComing = false;
    if (cat) return;
    cat = catEl();
    catState('walking');
    const w = catWidth('walking');
    const inner = cat.firstElementChild;
    // She walks in from the left and flops a little way in, clear of the head's corner.
    const lieW = catWidth('lying');
    const spot = clamp(innerWidth * (small() ? 0.1 : 0.18), small() ? 10 : 24, Math.max(10, innerWidth - lieW - 140));
    const from = -w - 8;
    const to = spot + lieW / 2 - w / 2;
    sound.meow();
    if (reduce) {
      catAt(to);
      catState('lying');
    } else {
      catAt(from);
      // Speed comes from the sprite's stride so her paws stay planted.
      const speed = PET ? PET.walk.stride * (w / PET.walk.w) / PET.walk.ms : 0.11;
      const bob = PET ? null : inner.animate([{ transform: 'rotate(-2deg) translateY(0)' }, { transform: 'rotate(2deg) translateY(-2px)' }], { duration: 400, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
      await play(cat, [{ transform: `translateX(${from}px)` }, { transform: `translateX(${to}px)` }], { duration: (to - from) / speed, easing: 'linear' });
      if (bob) bob.cancel();
      catAt(to);
      // Stop mid-step, then plop: sink, flop onto her side where she stood, settle.
      const sprite = cat.querySelector('.walk');
      if (sprite) sprite.style.animationPlayState = 'paused';
      await wait(160);
      await play(inner, [{ transform: 'none' }, { transform: 'scale(1.05,.86)' }], { duration: 150, easing: 'ease-in' });
      catState('lying');
      await play(inner, [{ transform: 'scale(1.1,.72)' }, { transform: 'scale(.97,1.05)', offset: 0.55 }, { transform: 'none' }], { duration: 380, easing: 'ease-out' });
    }
    heart();
    napLater();
  }
  // Meowmeow's hobby page: "Call her" brings her in, or gets a reaction if she's already here.
  window.dlCat = summonCat;
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
    textEl.addEventListener('scroll', () => textEl.classList.toggle('clip', textEl.scrollTop > 0), { passive: true });
    bubble.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      if (sp.typing) sp.fast = true;
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); ask(input.value); });

    // What they open or play. Capture runs before a <details> toggles, so a
    // row that's already open is being closed.
    document.addEventListener('click', (e) => {
      if (root.contains(e.target)) return;
      const sum = e.target.closest('summary');
      if (sum && sum.parentElement.open) return;
      if (e.target.closest('summary, button, .r-item')) look(e.target);
    }, true);
    micBtn.addEventListener('click', listen);

    // Feeding: drag anything from the page onto the head's face.
    let fed = '';
    document.addEventListener('dragstart', (e) => {
      const t = e.target.closest ? e.target.closest('[data-t]') : e.target.parentElement?.closest('[data-t]');
      fed = t && !root.contains(t) ? t.dataset.t : '';
      root.classList.add('hungry');
    });
    document.addEventListener('dragend', () => root.classList.remove('hungry', 'chomping'));
    headBtn.addEventListener('dragenter', (e) => { e.preventDefault(); root.classList.add('chomping'); life.surprise = now() + 300; });
    headBtn.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; life.kick = 1; });
    headBtn.addEventListener('dragleave', () => root.classList.remove('chomping'));
    headBtn.addEventListener('drop', (e) => {
      e.preventDefault();
      root.classList.remove('hungry', 'chomping');
      eat(fed);
      fed = '';
    });

    // Page swaps (site.js): the head stays, the page under it changes.
    document.addEventListener('dl:page', () => {
      if (norm(location.pathname) === '/hobbies/guitar/') setTimeout(askGuitar, 3500);
      here = norm(location.pathname);
      pageAt = now();
      S.pages = (S.pages || 1) + 1;
      save();
      pres.at = '';
      pres.seen = '';
      if (giveBack) giveBack();
      if (visitor && navigator.sendBeacon) navigator.sendBeacon(API + '/visit', JSON.stringify({ visitor, path: here, referrer: '' }));
      if (here === '/notes/') setTimeout(() => react('wall', LINES.wall, 3000), 2500);
    });

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
    addEventListener('beforeprint', () => {
      react('print', LINES.print);
      const pdf = find('resume-swe');
      if (pdf && !S.once.includes('print-fetch')) { S.once.push('print-fetch'); setTimeout(() => yank(pdf, { hold: 7000 }), 600); }
    });
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
    if (is404()) return lost();
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
      if (is404()) setTimeout(lost, 900);
    }
    if (here === '/notes/') setTimeout(() => react('wall', LINES.wall, 3000), 3000);
    schedule(met ? rand(9000, 14000) : 13000);
    if (met) pres.ready = true;
    if (here === '/hobbies/guitar/') setTimeout(askGuitar, 4000);
    setInterval(presence, 1000);
    // Replies from the real David: once a few seconds in, then every minute.
    setTimeout(checkReplies, 4000);
    setInterval(checkReplies, 60000);
  }

  // ---- Lending the head to a page (play/muaythai.js) ---------------------------
  // flyTo() flies the head to a box on screen, away() hides it while the page
  // draws its own copy there, home() flies it back to its corner. While it's
  // lent, dir.busy reads true, so bits, small talk, naps and resize docking
  // all leave it alone.
  let lent = false;
  let lentK = 1;
  let flight = null;
  let busyNow = dir.busy;
  Object.defineProperty(dir, 'busy', { get: () => busyNow || lent, set: (v) => { busyNow = v; } });
  function lend(on) {
    lent = on;
    headBtn.style.pointerEvents = on ? 'none' : '';
    talk.style.visibility = hand.style.visibility = on ? 'hidden' : '';
  }
  function fly(x, y, k, ms) {
    const x0 = pos.x, y0 = pos.y, k0 = lentK;
    if (flight) { try { flight.commitStyles(); } catch (e) {} flight.cancel(); flight = null; }
    stopTween(actor);
    actor.style.transformOrigin = '0 0';
    pos.x = x; pos.y = y; lentK = k;
    const at = (t) => {
      const u = 1 - t;
      const lift = Math.min(160, Math.hypot(x - x0, y - y0) * 0.35);
      const bx = u * u * x0 + 2 * u * t * ((x0 + x) / 2) + t * t * x;
      const by = u * u * y0 + 2 * u * t * (Math.min(y0, y) - lift) + t * t * y;
      return `translate3d(${bx.toFixed(1)}px,${by.toFixed(1)}px,0) scale(${(k0 + (k - k0) * t).toFixed(4)})`;
    };
    actor.style.transform = at(1);
    if (reduce || !ms) return Promise.resolve();
    life.lean = clamp((x - x0) / 40, -10, 10);
    const a = actor.animate(Array.from({ length: 9 }, (_, i) => ({ transform: at(i / 8) })), { duration: ms, easing: 'cubic-bezier(.45,.05,.3,1)' });
    flight = a;
    return a.finished.then(() => { if (flight === a) flight = null; life.lean = 0; }, () => {});
  }
  window.dlHead = {
    rect: () => headBtn.getBoundingClientRect(),
    // Put the visible head's top-left at (x, y), w wide.
    flyTo(x, y, w, ms = 750) {
      if (!lent) {
        lend(true);
        interrupt();
        if (chatOn) closeChat(null);
        hideTalk();
        life.sleep = false;
        emoteOff();
      }
      const r = headBtn.getBoundingClientRect();
      const bx = (r.left - pos.x) / lentK, by = (r.top - pos.y) / lentK, bw = r.width / lentK;
      const k = w / bw;
      return fly(x - k * bx, y - k * by, k, ms);
    },
    away(on) { actor.style.visibility = on ? 'hidden' : ''; },
    async home(ms = 750) {
      if (!lent) return;
      actor.style.visibility = '';
      const d = dockPos();
      await fly(d.x, d.y, 1, ms);
      if (lentK !== 1 || pos.x !== d.x || pos.y !== d.y) return;
      actor.style.transformOrigin = '';
      setHead(d.x, d.y);
      lend(false);
      schedule(rand(15000, 25000));
    }
  };

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
