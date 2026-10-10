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
    // The pitch: up close, for starting a game (see pitch()).
    pitch: {
      spar: { line: "spar me? three rounds, light contact. i'll go easy 🥊", yes: "let's go", no: 'not today', ok: 'bet. gloves on' },
      climb: { line: "climb the page with me? it's a v2, straight up", yes: "let's climb", no: 'maybe later', ok: 'ok chalk up' },
      chess: { line: 'play me? you get white. i talk a lot while i play', yes: "you're on", no: 'maybe later', ok: 'your move ♟️' },
      rally: { line: "rally me? first person, my racket's in your hand 🏸", named: (n) => `rally me with the ${n}? first person, it's in your hand 🏸`, yes: 'rally', no: 'just looking', ok: 'ok serve it up' },
      later: "ok ok. tap me when you're ready",
      again: 'changed your mind? 👀'
    },
    // Asked to play something ("can i rally you again"): this, then it starts.
    play: { rally: 'ok serve it up 🏸', spar: 'bet. gloves on 🥊', climb: 'ok chalk up', chess: 'ok your move ♟️', cat: 'psst psst', guitar: 'ok here, play something', go: 'ok come with me' },
    // Meowmeow's page, the first time they land on it.
    catPage: {
      hi: 'aww u wanna see meowmeow? let me call her over',
      psst: 'psst psst',
      here: "she's right there 🥹",
      ask: 'do you have any pets?',
      yes: 'ooo what kind?? tell me about them', no: 'meowmeow can be your pet for today then'
    },
    // Leaving, with something they haven't done yet (site.js, window.dlFinds).
    exitTo: {
      spar: "wait!! you never sparred me. muay thai, i'll go easy",
      rally: "wait, you haven't rallied me yet. you can even use my racket",
      climb: "leaving already? you didn't even climb the page with me",
      chess: 'wait, one game of chess before you go?',
      guitar: "wait, you haven't played my guitar. i might cry",
      globe: "before you go, spin my globe. show me where you're from",
      cat: "wait, you didn't meet meowmeow!!",
      feed: "wait, i'm hungry. drag something onto my face before you go",
      talk: 'wait wait, you never even said hi 🥺',
      brain: 'before you go, wanna see my brain? like literally',
      note: 'leave me a note on the wall before you go?',
      message: "before you go, text me! it goes straight to my phone"
    },
    back: "oh you're back! i didn't move. i can't, i'm a head",
    dark: 'ooh dark mode. good choice',
    light: 'flashbang 😭 my eyes',
    rightclick: 'right click? what are you gonna do, save my face? 😳',
    copy: 'copying my stuff? go for it',
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
      climbing: "i'm not very good, i can only do a v2 :( what grade do you climb?",
      badminton: 'badminton was my main sport all through high school! i played doubles. do you play?',
      hiking: "i'm really proud of panorama ridge. 30km round trip with my friends, i couldn't feel my legs for 2 days after",
      photography: 'i shoot on my fujifilm x-t200 and sony a7r ii, do you shoot at all?',
      fashion: "kunlun! i'm still working on the pieces for the first drop rn"
    },
    // The Among Us overlay: on open, one nudge if they don't try the demo, and what to try first in it.
    amongus: {
      open: "ahh this was my first hardware project! we were running around hack the north at 3am testing range lol. the demo's right under the photos if you wanna try it",
      nudge: "psst, you can actually play it. hit see it work 👀",
      demo: "drag your badge around! the lines are radio links, no server. then hit play as impostor and get someone inside your dotted circle 😈"
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
    // The hobbies page: it won't let them just sit there. Up to three nudges,
    // each pointing at a hobby they haven't opened yet, with what's in it.
    pick: {
      open: ['ok pick one', 'go on, click one', "fine, i'll pick for you"],
      teaser: {
        hiking: '12 hikes in there with photos. hover one for the stats',
        badminton: 'my 4 rackets are in 3d in there, and you can rally me',
        muaythai: 'you can spar me in there',
        travel: "there's a globe in there. spin it",
        fashion: 'kunlun! the clothing brand i\'m building',
        lumosity: 'my lumosity games. try to beat my score',
        meowmeow: 'you can call my cat in there',
        guitar: 'real recordings of me playing. they keep going while you browse',
        photography: 'my camera kit, in 3d'
      }
    },
    // Hobby pages: what the head says on arrival, the one question it asks,
    // and its answers to the buttons (see askPage). Typed answers go to the brain.
    ask: {
      hiking: {
        say: "i'm really proud of panorama ridge. 30km round trip with my friends, i couldn't feel my legs for 2 days after",
        ask: "do you hike? what's your favourite?",
        yes: 'ooo where? tell me', no: 'fair. the photos are the next best thing'
      },
      climbing: {
        say: "i'm not very good, i can only do a v2 :(",
        ask: 'what grade do you climb?',
        low: "ok we're basically the same", same: 'twins 🤝',
        high: 'show off 😭', none: "that's ok, the mat's soft"
      },
      badminton: {
        say: 'badminton was my main sport all through high school',
        ask: 'singles or doubles?',
        singles: 'respect 🏸', doubles: 'doubles gang 🤝', none: "that's ok, it's easier than it looks"
      },
      muaythai: {
        say: 'i coach the beginner class at my local gym',
        ask: 'do you train anything?',
        yes: 'ooo ok, then you know the drill', no: "that's ok, everyone starts somewhere"
      },
      travel: {
        say: "i've been to 8 countries so far! fun fact, i've been homeless in all 8 of them 😭",
        ask: 'where are you from? tap it on the globe',
        type: 'or just type it, either works',
        been: (p) => `no way, i've been to ${p.name}!` + (p.id === 'vancouver' ? " that's home!" : ''),
        near: (p) => `oh nice, that's not far from ${p.name}. i've been there!`,
        never: 'never been there. adding it to the list 📝'
      },
      lumosity: {
        say: 'i religiously do lumosity every morning. these are my favs',
        ask: 'think you can beat me?',
        yes: 'we will see 😈', no: 'smart. try anyway',
        lose: 'if you wish to defeat me, you must train for another 100 years!! 😈',
        win: 'IMPOSSIBLE. YOU BEAT ME',
        tie: 'a tie?? ok rematch. right now',
        unset: "nice. i haven't set my score yet, so enjoy it while it lasts 😈"
      },
      chess: {
        say: 'i played all through elementary. got to 1425 before guitar took over',
        ask: "what's your rating?",
        none: "that's ok, i play like my 1425 self. it's beatable"
      },
      photography: {
        say: 'i shoot on an x-t200 and an a7r ii',
        ask: 'do you shoot?',
        yes: 'ooo what on? spin my kit around and compare', phone: 'phone counts!', no: "the kit's still fun to spin around"
      }
    },
    // The guitar page: asks if they play, and brings the guitar out if they want it.
    guitar: {
      ask: 'do you play guitar yourself?',
      yes: 'ooo nice!! here, play something',
      try: 'ever wanted to try?',
      sure: 'ok here, play something',
      nah: 'fair haha. the recordings are right there if you wanna listen',
      // They recorded something on it and stopped.
      moved: 'that.. that was beautiful 😭',
      short: "wait that's it? play more 😭"
    },
    // The mini tour: [page, target to point at, line]
    tour: [
      ['/', 'now', "okay! quick tour. this is home, it's just me saying hi"],
      ['/resume/', 'jdpower', 'this is my resume. hover over a line and the story behind it shows up on the side'],
      ['/projects/', 'hackthenorth', "stuff i've built. this one was my first hardware project"],
      ['/hobbies/', 'life', 'and the stuff i do for fun'],
      ['/brain/', 'brain', "this is my second brain. everything i know about me, as a map you can drag around"],
      ['/notes/', 'wall', 'you can leave a note on the wall before you go :)']
    ],
    tourEnd: "that's it! i'm way more fun when you talk to me, so ask me anything :)",
    wall: "this wall's public. for something just for him, dm him in messages, or tell me and i'll pass it on. either way it goes straight to his phone 🤐",
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
  // Checks one of the things to do off the list (site.js).
  const found = (id) => { if (window.dlFound) window.dlFound(id); };
  const strip = (s) => s.replace(/\s*\[\[[^\]]*\]\]/g, '').trim();
  const norm = (p) => p.replace(/index\.html$/, '').replace(/([^/])$/, '$1/');
  let here = norm(location.pathname);
  const TZ = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; } })();
  const clock = () => new Date().toLocaleTimeString('en-US', { timeZone: 'America/Toronto', hour: 'numeric', minute: '2-digit' }).toLowerCase();

  // ---- Event bus ----------------------------------------------------------------
  // Everything that should reach the head goes through window.dlBus: the page
  // (site.js: page, bring), the project overlay (play/projects.js: overlay_open,
  // overlay_close, demo_open, demo_close), games (game_start, game_end). The
  // head reports what it says on it too (line, line_done, line_cut, line_drop,
  // reply), for the logger. on('*', fn) hears everything as fn(data, type).
  const bus = (() => {
    if (window.dlBus && typeof window.dlBus.on === 'function' && typeof window.dlBus.emit === 'function') return window.dlBus;
    const subs = new Map();
    const b = {
      on(type, fn) { if (!subs.has(type)) subs.set(type, new Set()); subs.get(type).add(fn); return b; },
      off(type, fn) { if (subs.has(type)) subs.get(type).delete(fn); return b; },
      emit(type, data = {}) {
        for (const k of [type, '*']) {
          for (const fn of [...(subs.get(k) || [])]) {
            try { fn(data, type); } catch (e) { if (window.console) console.warn('dlBus', type, e); }
          }
        }
      }
    };
    window.dlBus = b;
    return b;
  })();

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
    // gap: the shortest time between two blips, so quick lines still sound like talking.
    blip(ch, gap = 0.05) {
      if (!this.live()) return;
      const ac = this.ctx;
      const t = ac.currentTime;
      if (t - this.last < gap) return;
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
    thud() { this.tone(120, 55, 0.14, 0.35); },
    // A soft clap: a short burst of filtered noise, a little different each time.
    clap() {
      if (!this.live()) return;
      const ac = this.ctx;
      const t = ac.currentTime;
      if (!this.noise) {
        this.noise = ac.createBuffer(1, Math.round(ac.sampleRate * 0.3), ac.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ac.createBufferSource();
      const bp = ac.createBiquadFilter();
      const hp = ac.createBiquadFilter();
      const g = ac.createGain();
      src.buffer = this.noise;
      src.playbackRate.value = rand(0.9, 1.1);
      bp.type = 'bandpass';
      bp.frequency.value = rand(1000, 1500);
      bp.Q.value = 0.9;
      hp.type = 'highpass';
      hp.frequency.value = 450;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.2, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.06, t + 0.018);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      src.connect(bp).connect(hp).connect(g).connect(ac.destination);
      src.start(t, rand(0, 0.15), 0.13);
    }
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
  let lastAsk = -1e9; // when they last sent something in the chat
  let talkSeq = 0;

  function placeTalk() {
    const r = actor.getBoundingClientRect();
    const w = talk.offsetWidth;
    const cx = r.left + r.width / 2;
    let left, bottom;
    if (pitching) {
      left = cx - w / 2;
      bottom = innerHeight - r.top + 6;
    } else if (chatOn) {
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

  // Gone at once, no animation: the line was about something they moved on from.
  function hideNow() {
    talkSeq++;
    talk.getAnimations().forEach((a) => a.cancel());
    talk.hidden = true;
  }

  // ---- Speech: one voice, by priority ---------------------------------------
  // Every line is an utterance { id, pri, ctx, text, ttl }. The visitor comes
  // first: replies to what they typed or clicked in the chat (REPLY) beat
  // reactions to what they just opened or clicked (REACT), which beat page
  // lines (exchanges, pitches, notices: PAGE), which beat small talk and idle
  // bits (AMBIENT). A higher line cuts in, even through the pause after the
  // last one; a lower one waits its turn and drops out once it's stale (ttl).
  // ctx is the page plus whatever is open over it (a project, its demo, a
  // game). Changing it stops the current line mid-word, drops anything
  // waiting about the old one, takes its buttons down and bumps hear.tok, so
  // an exchange halfway through an await stops before it speaks again. A line
  // with ctx null (a reply) isn't about anything on screen and carries on.
  // Unprompted lines (budget) also wait for a gap: one per BUDGET at most,
  // never while they type or a reply streams in.
  const PRI = { ambient: 1, page: 2, react: 3, reply: 4 };
  const PRI_NAME = ['', 'ambient', 'page', 'react', 'reply'];
  const TTL = [0, 3000, 10000, 6000, 60000];
  const BUDGET = 8000;
  const hear = { cur: null, shown: null, last: null, q: [], tok: 0, lastFree: -1e9, leaving: 0, introAt: 0, holdT: 0, hideT: 0, qT: 0 };
  let over = ''; // over the page: 'project:<id>', 'demo:<id>', 'game:<id>', 'bring:<id>', 'leaving'
  const ctxNow = () => here + (over ? '#' + over : '');
  const speaking = () => Boolean(hear.cur || hear.q.length);
  function budgetOk() {
    const t = now();
    return !S.quiet && !lent && !asking && !rec && !input.value && !document.hidden && t - hear.lastFree >= BUDGET && t - hear.leaving > 1500;
  }

  // Typewriter. The queue holds characters and, inline, the stage directions
  // the model wrote, so the hand moves right when the words reach it. Lines
  // the head comes up with itself type about 2.5x faster than the brain's.
  const sp = { q: [], page: '', typing: false, ended: true, fast: false, timer: 0, due: 0, u: null };

  // utter(text, opts) queues a line and returns it; speak() is the promise,
  // true once it's all out, false if it never started or got cut. Options: id,
  // pri, ctx (null: about nothing on screen), ttl, echo, stream, hold (how
  // long a bubble outside the chat stays), stay (it doesn't go away on its
  // own), mood, log (joins the chat log), budget (unprompted), keep (they can
  // pick it up by clicking the head), onStart (marks it said), onCut.
  function utter(text, o = {}) {
    const pri = o.pri || PRI.page;
    const u = {
      id: o.id || 'line', pri, text: text || '', ctx: o.ctx === undefined ? ctxNow() : o.ctx, ttl: o.ttl || TTL[pri], at: now(),
      echo: o.echo || '', stream: Boolean(o.stream), hold: o.hold, stay: Boolean(o.stay), mood: o.mood, log: Boolean(o.log),
      budget: Boolean(o.budget), keep: o.keep || 0, onStart: o.onStart, onCut: o.onCut, phase: 'wait', buf: [], ended: false
    };
    u.done = new Promise((r) => { u.resolve = r; });
    u.feed = (s) => { if (sp.u === u) feed(s); else if (u.phase === 'wait') for (const ch of s) u.buf.push(ch); };
    u.act = (a) => { if (sp.u === u) feedAction(a); else if (u.phase === 'wait') u.buf.push(a); };
    u.end = () => { u.ended = true; if (sp.u === u) endSpeech(); };
    admit(u);
    return u;
  }
  const speak = (text, o) => utter(text, o).done;

  function admit(u) {
    if (u.ctx && u.ctx !== ctxNow()) return discard(u, 'context');
    if (u.budget && S.quiet) return discard(u, 'quiet');
    if (!u.stream && (hear.q.some((x) => x.id === u.id) || (hear.cur && hear.cur.id === u.id && hear.cur.phase === 'type'))) return discard(u, 'repeat');
    const c = hear.cur;
    if (c && (u.pri > c.pri || (u.pri === c.pri && u.pri >= PRI.react))) { cut(c, 'preempt'); begin(u); return; }
    hear.q.push(u);
    if (c) pumpLater();
    else pumpQ();
  }
  function discard(u, reason) {
    u.phase = 'dropped';
    bus.emit('line_drop', { id: u.id, reason });
    u.resolve(false);
  }
  function pumpLater(ms = 250) {
    clearTimeout(hear.qT);
    if (hear.q.length) hear.qT = setTimeout(pumpQ, ms);
  }
  function pumpQ() {
    clearTimeout(hear.qT);
    if (hear.cur) return;
    const t = now();
    const c = ctxNow();
    hear.q = hear.q.filter((u) => {
      if (u.ctx && u.ctx !== c) { discard(u, 'context'); return false; }
      if (t - u.at > u.ttl) { discard(u, 'expired'); return false; }
      return true;
    });
    hear.q.sort((a, b) => b.pri - a.pri || a.at - b.at);
    const free = budgetOk();
    const u = hear.q.find((x) => !x.budget || free);
    if (u) { hear.q.splice(hear.q.indexOf(u), 1); begin(u); }
    else pumpLater();
  }

  function begin(u) {
    clearTimeout(hear.hideT);
    clearTimeout(hear.holdT);
    hear.cur = hear.shown = hear.last = u;
    u.phase = 'type';
    u.chat = chatOn;
    if (u.budget) hear.lastFree = now();
    if (u.mood) setFace(u.mood, 1200 + u.text.length * 45);
    if (u.onStart) { try { u.onStart(u); } catch (e) {} }
    if (chatOn && u.log && u.text) { S.msgs.push({ role: 'assistant', content: u.text }); save(); }
    if (!chatOn) {
      showTalk();
      if (u.keep) pres.last = { text: u.text, at: now(), keep: u.keep };
    }
    bus.emit('line', { id: u.id, kind: u.id.split(':')[0], priority: PRI_NAME[u.pri], context: u.ctx, text: u.text });
    clearTimeout(sp.timer);
    Object.assign(sp, { q: [], page: '', typing: false, ended: !u.stream || u.ended, fast: false, u });
    textEl.textContent = '';
    textEl.classList.remove('clip');
    recallEl.hidden = true;
    echoEl.textContent = u.echo;
    echoEl.hidden = !u.echo;
    for (const ch of u.text) sp.q.push(ch);
    sp.q.push(...u.buf);
    u.buf = [];
    pump();
  }
  // Stops a line where it is. One that already finished is just let go.
  function cut(u, reason) {
    if (!u || hear.cur !== u) return;
    clearTimeout(hear.holdT);
    hear.cur = null;
    if (sp.u === u) {
      clearTimeout(sp.timer);
      Object.assign(sp, { q: [], typing: false, ended: true, u: null });
    }
    if (u.phase === 'type') {
      bus.emit('line_cut', { id: u.id, reason });
      u.resolve(false);
    }
    u.phase = 'cut';
    if (u.onCut) { try { u.onCut(reason); } catch (e) {} }
    pumpLater();
  }
  // The bubble shows something about what they just left: take it down now.
  function clearStale() {
    const s = hear.shown;
    if (!s || !s.ctx || s.ctx === ctxNow()) return;
    hear.shown = null;
    clearTimeout(hear.hideT);
    if (!chatOn) hideNow();
    else if (S.auto) tuck();
    else { textEl.textContent = ''; echoEl.hidden = true; recallEl.hidden = true; }
  }
  // A chat the head opened on its own, that they never answered: put it away quietly.
  function tuck() {
    chatOn = false;
    S.open = false;
    S.auto = false;
    save();
    root.classList.remove('chat');
    choicesEl.hidden = true;
    form.hidden = true;
    fineEl.hidden = true;
    pres.waiting = false;
    hideNow();
  }
  // Stop talking and empty the bubble.
  function hush(reason = 'hush') {
    if (hear.cur) cut(hear.cur, reason);
    hear.shown = null;
    clearTimeout(hear.hideT);
    textEl.textContent = '';
    echoEl.hidden = true;
    recallEl.hidden = true;
  }
  // They moved on: a page, a project, its demo, a game.
  function setContext(next, reason) {
    over = next;
    hear.tok++;
    root.classList.toggle('over', /^(project|demo):/.test(over));
    const c = ctxNow();
    if (hear.cur && hear.cur.ctx && hear.cur.ctx !== c) cut(hear.cur, reason);
    hear.q = hear.q.filter((u) => { if (!u.ctx || u.ctx === c) return true; discard(u, 'context'); return false; });
    if (choicesEl.dataset.ctx && choicesEl.dataset.ctx !== c) {
      choicesEl.hidden = true;
      choicesEl.replaceChildren();
      delete choicesEl.dataset.ctx;
      travelPick = false;
      pres.waiting = false;
    }
    clearStale();
    if (!touring && !pitching) {
      interrupt(true);
      if (!chatOn) schedule(rand(15000, 25000));
    }
    pumpQ();
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
      const quick = !sp.u || !sp.u.stream;
      voice(item, quick);
      const d = reduce ? 0 : sp.fast ? 6 : /[.!?]/.test(item) ? (quick ? 120 : 300) : /[,;:]/.test(item) ? (quick ? 56 : 140) : quick ? 11 : 28;
      // Keep to the pace when timers fire late: the next letter is due d
      // after the last one was, and anything overdue goes out now.
      const t = now();
      sp.due = sp.typing ? Math.max(sp.due + d, t - 150) : t + d;
      sp.typing = true;
      if (sp.due <= t) continue;
      sp.timer = setTimeout(step, sp.due - t);
      return;
    }
  }
  function finishSpeech() {
    const u = sp.u;
    pres.said = now();
    linkify();
    if (chatOn) showForm();
    if (!u || hear.cur !== u || u.phase !== 'type') return;
    u.phase = 'hold';
    bus.emit('line_done', u.stream ? { id: u.id, text: sp.page } : { id: u.id });
    u.resolve(true);
    // Time to read it before the next line of the same rank or lower. A higher one doesn't wait.
    const len = sp.page.length;
    const read = u.stream ? Math.min(6000, 1000 + len * 35) : Math.min(3500, 700 + len * 22);
    hear.holdT = setTimeout(() => {
      if (hear.cur !== u) return;
      hear.cur = null;
      u.phase = 'done';
      pumpQ();
    }, read);
    if (!u.chat && !u.stay) {
      const linger = Math.max(read, Math.min(7000, (u.hold == null ? 1500 : u.hold) + len * 25));
      hear.hideT = setTimeout(() => {
        if (hear.shown !== u || chatOn) return;
        hear.shown = null;
        hideTalk();
      }, linger);
    }
  }
  function voice(ch, quick) {
    if (!/[\p{L}\p{N}]/u.test(ch)) return;
    life.kick = Math.max(life.kick, /[aeiouy]/i.test(ch) ? rand(0.75, 1) : rand(0.3, 0.6));
    life.talkT = now();
    sound.blip(ch, quick ? 0.024 : 0.05);
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

  // A line outside the chat pops a bubble over the head that goes away after
  // hold (plus reading time). In the chat it's just the next line.
  function quip(text, hold = 2000, mood, o = {}) {
    if (!text) return Promise.resolve(false);
    return speak(text, Object.assign({ pri: PRI.ambient, hold, mood }, o));
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
      quip(pick(LINES.carry), 1400, 'happy', { id: 'bit:carry' });
      for (let i = 0; i < 2 && ep === epoch; i++) {
        await moveHead(rand(innerWidth * 0.15, innerWidth * 0.75), rand(innerHeight * 0.2, innerHeight * 0.55), 1300);
        await wait(rand(700, 1200));
      }
      await wait(Math.max(0, hold - 5000));
      await putBack();
    });
  }
  async function putBack(silent) {
    const c = carried;
    if (!c) return;
    cancelAnimationFrame(c.raf);
    if (!silent) quip(LINES.putBack, 900, null, { id: 'bit:putback' });
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
    quip(LINES.mischief.take, 2600, 'happy', { id: 'bit:mess' });
    let back = false;
    giveBack = () => {
      if (back) return;
      back = true;
      giveBack = null;
      bar.style.translate = '';
      quip(LINES.mischief.give, 1400, null, { id: 'bit:mess-give', ctx: null });
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
          const m = /^(point|drag|face|summon|carry|mode|recall|show|bring|ask|play):([a-z0-9,-]+)$/.exec(inner);
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
  // One hand move per thing per reply: the server's drag and the brain's point at the same thing don't both run.
  const handled = new Set();
  function act(a) {
    if (a.verb === 'face') { setFace(a.id, 3500); return; }
    if (a.verb === 'summon') { if (a.id === 'cat') summonCat(); return; }
    if (a.verb === 'mode') { mode = a.id; return; }
    if (a.verb === 'recall') { recall(a.id.split(',')); return; }
    if (a.verb === 'show') { show(a.id); return; }
    if (a.verb === 'bring') { bring(a.id); return; }
    if (a.verb === 'ask' && a.id === 'camera') { askCamera(); return; }
    if (a.verb === 'play') { playNow(a.id); return; }
    if (a.verb === 'note') {
      if (a.id === 'name') try { localStorage.setItem('dl-name', a.value.slice(0, 40)); } catch (e) {}
      if (a.id === 'who') { S.who = a.value.slice(0, 20); save(); }
      return;
    }
    const t = targets[a.id];
    if (!t || handled.has(a.id)) return;
    handled.add(a.id);
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
  // Buttons under the bubble belong to where they came up: going somewhere
  // else takes them down (setContext).
  function setChoices(kind, nodes) {
    choicesEl.classList.toggle('scale', kind === 'scale');
    choicesEl.dataset.kind = kind;
    choicesEl.dataset.ctx = ctxNow();
    choicesEl.replaceChildren(...nodes);
    choicesEl.hidden = false;
  }
  function showChoices() {
    setChoices('intro', LINES.choices.map(([c, does]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c;
      b.addEventListener('click', () => (does === 'tour' ? startTour(c) : ask(c, { via: 'button' })));
      return b;
    }));
  }
  // The hello is still being said, or its question is up with its buttons
  // and it's recent: page lines wait for it.
  const introPending = () => Boolean(hear.cur && hear.cur.id.startsWith('intro')) ||
    (chatOn && !talked() && !choicesEl.hidden && choicesEl.dataset.kind === 'intro' && now() - hear.introAt < 10000);

  async function openChat() {
    interrupt();
    if (giveBack) giveBack();
    wake();
    emote('!');
    life.surprise = now() + 450;
    squish();
    chatOn = true;
    S.open = true;
    S.auto = false;
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
    if (said) { S.msgs.push({ role: 'assistant', content: said }); save(); speak(said, { id: 'pickup', pri: PRI.reply, ctx: null }); }
    else if (!talked()) await greet(true);
    else speak(LINES.again, { id: 'again', pri: PRI.reply, ctx: null });
  }

  // The head starts the conversation: who it is, then their name. urgent:
  // they clicked the head for it; otherwise it's the hello on a first visit.
  async function greet(urgent = false) {
    const tok = hear.tok;
    const name = knownName();
    const text = name ? LINES.introBack(name) : pick(LINES.intro);
    setFace('happy', 2500);
    const ok = await speak(text, {
      id: name ? 'intro:back' : 'intro', pri: urgent ? PRI.reply : PRI.page, ctx: urgent ? null : undefined,
      onStart: () => { if (!S.msgs.length) { S.msgs.push({ role: 'assistant', content: text }); save(); } }
    });
    if (!ok || (!urgent && tok !== hear.tok)) return;
    hear.introAt = now();
    if (chatOn && !talked()) showChoices();
  }
  // Chat the head opens itself (the hello, a hobby page's question). It
  // stays its own until they answer, so leaving tucks it away (tuck()).
  function openFor() {
    if (chatOn) return;
    chatOn = true;
    S.open = true;
    S.auto = true;
    save();
    root.classList.add('chat');
    goHome(420);
    showTalk();
    showForm();
  }
  async function intro() {
    openFor();
    await greet();
  }
  function closeChat(text = LINES.close, id = 'close') {
    touring = false;
    chatOn = false;
    S.open = false;
    S.auto = false;
    save();
    interrupt();
    root.classList.remove('chat');
    choicesEl.hidden = true;
    form.hidden = true;
    fineEl.hidden = true;
    hush('close');
    hideTalk().then(() => { if (text) { quip(text, 800, 'sad', { id, pri: PRI.reply, ctx: null }); peace(); } });
    schedule(40000);
  }
  function shoo() {
    touring = false;
    S.quiet = true;
    save();
    interrupt();
    root.classList.add('quiet');
    document.documentElement.classList.remove('dl-pitch');
    quip(LINES.shoo, 1200, 'sad', { id: 'shoo', pri: PRI.reply, ctx: null });
  }
  let pokes = 0;
  function poke() {
    squish();
    emote(pokes % 2 ? '?' : '!');
    life.surprise = now() + 200;
    if (pokes >= 2) setFace('angry', 1800);
    if (!asking && !sp.typing) speak(LINES.poke[pokes++ % LINES.poke.length], { id: 'poke', pri: PRI.react, ctx: null });
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
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { setFace('sad', 2500); speak(LINES.micBlocked, { id: 'mic:blocked', pri: PRI.react, ctx: null }); }
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
  // so nothing is echoed and it doesn't use up the visitor's turns. Notes
  // speak at pri (small talk is ambient) and stop, fetch and all, if they
  // move on before it's said.
  async function ask(q, { note = false, fallback = '', via = 'typed', pri = 0, id = '' } = {}) {
    q = q.trim().slice(0, 500);
    if (!q || asking) return;
    if (!note && S.noting) return takeNote(q, via);
    if (!note) {
      touring = false;
      if (giveBack) giveBack();
      choicesEl.hidden = true;
      input.value = '';
      pres.streak = 0;
      unshow();
      if (pres.waiting) { S.smallAnswered = true; if (hear.last && hear.last.id === 'ask:pets') S.pets = true; save(); }
      pres.waiting = false;
      S.auto = false;
      found('talk');
      lastAsk = now();
      bus.emit('reply', { via, text: q, after: hear.last ? hear.last.id : '' });
      if (S.msgs.filter((m) => m.role === 'user' && !m.note).length >= MAX_TURNS) { speak(LINES.limit, { id: 'limit', pri: PRI.reply, ctx: null, echo: q }); return; }
      const want = wants(q);
      if (want) return playAsked(q, want);
    }
    asking = true;
    sendBtn.disabled = true;
    micBtn.disabled = true;
    const mine = note ? { role: 'user', content: q, note: true } : { role: 'user', content: q };
    S.msgs.push(mine);
    save();
    const ctrl = new AbortController();
    let dead = false;
    const u = utter('', {
      id: id || (note ? 'server:note' : 'server'), pri: pri || (note ? PRI.ambient : PRI.reply), ctx: note ? undefined : null,
      stream: true, echo: note ? '' : q, onCut: () => { dead = true; ctrl.abort(); }
    });
    emote('...', { sticky: true });
    let raw = '';
    let failed = false;
    handled.clear();
    const parser = makeParser(u.feed, u.act);
    try {
      const res = await fetch(API + '/chat', {
        method: 'POST',
        // text/plain keeps this a simple request, so no CORS preflight.
        headers: { 'content-type': 'text/plain' },
        signal: ctrl.signal,
        body: JSON.stringify({
          page: here,
          here: Object.keys(targets).filter((id) => find(id)),
          messages: S.msgs.slice(-16),
          visitor,
          convo: S.convo,
          tz: TZ,
          local: new Date().toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
          name: knownName(),
          who: S.who || ''
        })
      });
      if (!res.ok || !res.body) throw new Error('chat ' + res.status);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const s = dec.decode(value, { stream: true });
        if (strip(raw).replace(/\[\[[^\]]*$/, '') === '' && strip(raw + s).replace(/\[\[[^\]]*$/, '')) emoteOff();
        raw += s;
        parser.push(s);
      }
      parser.end();
    } catch (e) {
      if (!dead) {
        failed = true;
        if (!raw && note) { S.msgs = S.msgs.filter((m) => m !== mine); raw = fallback || smallLine()?.text || LINES.offline; parser.push(raw); parser.end(); }
        else if (!raw) { raw = LINES.offline; setFace('sad', 3000); parser.push(raw); parser.end(); }
      }
    }
    emoteOff();
    if (dead || u.phase === 'dropped') {
      // Cut off because they moved on: a stage note leaves no trace, a reply keeps what came in.
      if (note) S.msgs = S.msgs.filter((m) => m !== mine);
      else S.msgs.push({ role: 'assistant', content: raw.trim() || '..' });
      save();
      asking = false;
      if (chatOn) showForm();
      mode = '';
      navTo = null;
      return;
    }
    pres.brain = !failed && !raw.includes(LINES.offline);
    S.msgs.push({ role: 'assistant', content: raw.trim() || '..' });
    save();
    u.end();
    await u.done;
    asking = false;
    if (chatOn) showForm();
    if (mode === 'note') { S.noting = 'message'; save(); }
    else if (mode === 'tour') tour();
    mode = '';
    if (navTo) { const a = navTo; navTo = null; await queue; goTo(a); }
  }

  // Private notes for the real David, taken in the chat. They skip the brain
  // and the chat log and go straight to him.
  async function takeNote(q, via = 'typed') {
    choicesEl.hidden = true;
    input.value = '';
    S.auto = false;
    bus.emit('reply', { via, text: q, after: hear.last ? hear.last.id : '' });
    if (S.noting === 'message') {
      S.noteMsg = q;
      S.noting = 'contact';
      save();
      return speak(LINES.noteContact, { id: 'note:contact', pri: PRI.reply, ctx: null, echo: q });
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
      if (ok) found('message');
    } catch (e) {}
    emoteOff();
    setFace(ok ? 'happy' : 'sad', 2000);
    asking = false;
    await speak(ok ? LINES.noteSent : LINES.noteFailed, { id: ok ? 'note:sent' : 'note:failed', pri: PRI.reply, ctx: null, echo: q });
  }

  function restore() {
    chatOn = true;
    root.classList.add('chat');
    const d = dockPos();
    setHead(d.x, d.y);
    showTalk();
    showForm();
    const last = [...S.msgs].reverse().find((m) => m.role === 'assistant');
    hush('restore');
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
  function interrupt(silent) {
    epoch++;
    clearTimeout(dir.timer);
    release();
    putBack(silent);
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

  const roamBit = (el, line) => ({ kind: 'roam', run: async () => { const ep = epoch; await roam(el); if (ep === epoch) await quip(line, 2200, null, { id: 'bit:roam' }); } });
  const pointBit = (el, line) => ({ kind: 'point', run: () => Promise.all([quip(line, 1800, null, { id: 'bit:point' }), point(el, { hold: 1600 })]) });
  // Jev's move, turned into something the head does. Fetching to the cursor
  // only happens for a visitor who reads as a recruiter.
  function bitFor(move, id) {
    const el = id && find(id);
    if (move === 'comment' && el && LINES.notice[id] && !S.noticed.includes(id) && here !== '/hobbies/') return { kind: 'comment', run: () => chime(LINES.notice[id], { id: 'notice:' + id, pri: PRI.page, budget: false, onStart: () => noticed(id) }) };
    if (move === 'comment' && el && LINES.roam[id] && inView(el)) return roamBit(el, LINES.roam[id]);
    if (move === 'point' && el && LINES.point[id]) return pointBit(el, LINES.point[id]);
    if (move === 'fetch' && el && S.who === 'recruiter' && fine && cursor.seen && LINES.yank[id]) {
      return { kind: 'fetch', run: async () => { await Promise.all([quip(LINES.yank[id], 1500, null, { id: 'bit:fetch' }), yank(el, { hold: 5200 })]); await quip(pick(LINES.letgo), 600, 'sad', { id: 'bit:letgo' }); } };
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
    if (bonkable) out.push({ kind: 'bonk', run: async () => { const ep = epoch; await bonk(bonkable); if (ep === epoch) await quip(pick(LINES.bonk), 1200, null, { id: 'bit:bonk' }); } });
    if (!talked() && dir.count > 0 && !S.once.includes('knock')) {
      out.push({ kind: 'knock', run: () => { S.once.push('knock'); save(); return Promise.all([knock(), wait(400).then(() => quip(pick(LINES.knock), 1800, null, { id: 'bit:knock' }))]); } });
    }
    return out;
  }
  // Bits are unprompted too: they wait for the same gap lines do, and nothing goes on over an overlay or a game.
  const idleNow = () => chatOn || held || carried || touring || dir.busy || document.hidden || life.sleep || life.shy || over || speaking() || !budgetOk();
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
    hear.lastFree = now();
    const ep = epoch;
    try { await bit.run(); } catch (e) {}
    dir.busy = false;
    if (ep === epoch && !chatOn && !life.sleep) await goHome(900);
    schedule(rand(20000, 32000));
  }

  // ---- Tour -------------------------------------------------------------------

  let touring = false;
  // A line that joins the chat log when the chat is open.
  function say(text, o = {}) {
    return speak(text, Object.assign({ hold: 1800, log: true }, o));
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
        await Promise.all([say(line, { id: 'tour:' + page, pri: PRI.reply, ctx: null }), el ? point(el, { hold: 1200 }) : null]);
        if (el && el.matches('.r-item') && window.dlPin) window.dlPin(el);
        await wait(1500);
      }
      if (touring) await say(LINES.tourEnd, { id: 'tour:end', pri: PRI.reply, ctx: null });
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
    ask(q, { via: 'button' });
  };

  async function startTour(label) {
    choicesEl.hidden = true;
    S.auto = false;
    S.msgs.push({ role: 'user', content: label });
    save();
    bus.emit('reply', { via: 'button', text: label, after: hear.last ? hear.last.id : '' });
    await speak(LINES.tourStart, { id: 'tour:start', pri: PRI.reply, ctx: null, echo: label });
    tour();
  }

  // ---- 404: offer directions ------------------------------------------------------

  const is404 = () => document.querySelector('.identity .name')?.textContent.trim() === '404';
  async function lost() {
    const tok = hear.tok;
    chatOn = true;
    S.open = true;
    save();
    root.classList.add('chat');
    await goHome(420);
    showTalk();
    showForm();
    setFace('sad', 2000);
    if (!(await speak(LINES.lost, { id: 'lost', pri: PRI.page })) || tok !== hear.tok) return;
    setChoices('ways', LINES.ways.map(([label, page]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', async () => {
        choicesEl.hidden = true;
        bus.emit('reply', { via: 'button', text: label, after: 'lost' });
        await navigate(page);
        const el = document.querySelector('main h1, main .hello, main .header');
        speak(LINES.found, { id: 'found', pri: PRI.reply, ctx: null });
        if (el) point(el, { hold: 1600 });
      });
      return b;
    }));
  }

  // ---- Presence: like he's actually sitting there ---------------------------
  // He sees what you open, play, hover on or stop to read, and says something
  // about it. When the chat goes quiet he makes small talk instead of idling.

  const pres = { ready: false, said: now(), streak: 0, brain: false, at: '', atSince: 0, last: null, smallAt: now(), waiting: false };
  // Marked when the line about it actually starts, not when it's queued.
  const noticed = (id) => { if (!S.noticed.includes(id)) { S.noticed.push(id); save(); } };
  const once = (key) => { if (!S.once.includes(key)) { S.once.push(key); save(); } };

  // They opened or clicked something it has a line about: say it now. On
  // /hobbies/ the cards are doors, not things to comment on: the pick nudge
  // (nudgeHobbies) has that page.
  function look(el) {
    if (here === '/hobbies/' || over || (S.quiet && !chatOn)) return;
    for (let t = el && el.closest('[data-t]'); t; t = t.parentElement && t.parentElement.closest('[data-t]')) {
      const id = t.dataset.t;
      if (root.contains(t) || !LINES.notice[id]) continue;
      if (S.noticed.includes(id)) return;
      wake();
      speak(LINES.notice[id], { id: 'notice:' + id, pri: PRI.react, log: true, hold: 2600, keep: 15000, onStart: () => noticed(id) });
      return;
    }
  }
  // A project opened over /projects/ (play/projects.js): a line about that
  // one, right away. Among Us also points them at its demo, nudges once if
  // they stay in the photos, and says what to try first when they open it.
  function projectOpened(id) {
    if (S.quiet) return;
    if (id === 'hackthenorth') return amongus();
    if (S.noticed.includes(id) || !LINES.notice[id]) return;
    wake();
    speak(LINES.notice[id], { id: 'project:' + id, pri: PRI.react, log: true, hold: 2600, keep: 15000, onStart: () => noticed(id) });
  }
  function amongus() {
    const A = LINES.amongus;
    const tok = hear.tok;
    wake();
    if (!S.once.includes('au-open')) speak(A.open, { id: 'project:hackthenorth', pri: PRI.react, log: true, hold: 3000, keep: 15000, onStart: () => { once('au-open'); noticed('hackthenorth'); } });
    if (S.once.includes('au-nudge') || S.once.includes('au-demo')) return;
    setTimeout(() => {
      if (tok !== hear.tok || S.once.includes('au-demo')) return;
      chime(A.nudge, { id: 'nudge:hackthenorth', pri: PRI.page, ttl: 6000, onStart: () => once('au-nudge') });
    }, 8000);
  }
  function demoOpened(id) {
    if (id !== 'hackthenorth' || S.quiet || S.once.includes('au-demo')) return;
    wake();
    speak(LINES.amongus.demo, { id: 'demo:hackthenorth', pri: PRI.react, log: true, hold: 4000, onStart: () => once('au-demo') });
  }
  // Whatever sits across the middle of the screen, innermost first.
  function reading() {
    if (here === '/hobbies/') return '';
    const mid = innerHeight * 0.45;
    let at = '';
    for (const el of document.querySelectorAll('[data-t]')) {
      if (root.contains(el) || !LINES.notice[el.dataset.t]) continue;
      const r = el.getBoundingClientRect();
      if (r.top < mid && r.bottom > mid) at = el.dataset.t;
    }
    return at;
  }

  // Unprompted lines: they wait for a gap (budget), and in the chat they
  // join the conversation, so the model knows what he just said when they answer.
  function chime(text, o = {}) {
    return speak(text, Object.assign({ pri: PRI.ambient, budget: true, log: true, hold: 2600, keep: 15000 }, o, {
      onStart: (u) => { pres.streak++; if (o.onStart) o.onStart(u); }
    }));
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
    return { id: hit.id, text: typeof hit.line === 'function' ? hit.line(knownName()) : hit.line };
  }
  function smallDue(t, quiet) {
    if (S.quiet || (S.small || []).length >= SMALL_MAX || speaking() || !budgetOk()) return false;
    if (chatOn) return !pres.waiting && quiet > 40000 && t - pres.smallAt > 60000;
    // Browsing with the chat tucked away: only while they're actually around,
    // and once at most for someone who never answered the hello.
    return quiet > 60000 && t - pres.smallAt > 100000 && t - lastInput < 20000 && (talked() || !(S.small || []).length);
  }
  // The deep one: asked word for word, since David wrote them. The scale one
  // gets 1 to 10 buttons under the bubble.
  const deepDue = () => chatOn && !S.deep && S.smallAnswered && S.who !== 'recruiter';
  async function deepTalk() {
    const tok = hear.tok;
    const d = pick(LINES.deep);
    pres.smallAt = now();
    const ok = await chime(typeof d.line === 'function' ? d.line(knownName()) : d.line, { id: 'deep:' + d.id, onStart: () => { S.deep = d.id; save(); pres.waiting = true; } });
    if (ok && tok === hear.tok && d.scale && chatOn && !asking && !input.value) showScale(d.scale);
  }
  function showScale([lo, hi]) {
    const row = document.createElement('div');
    row.className = 'dl-scale';
    for (let i = 1; i <= 10; i++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = i;
      b.setAttribute('aria-label', `${i} out of 10`);
      b.addEventListener('click', () => ask(`${i}/10`, { via: 'button' }));
      row.appendChild(b);
    }
    const ends = document.createElement('p');
    ends.className = 'dl-scale-ends';
    ends.append(Object.assign(document.createElement('span'), { textContent: lo }), Object.assign(document.createElement('span'), { textContent: hi }));
    setChoices('scale', [row, ends]);
  }
  function smallTalk() {
    if (deepDue()) return deepTalk();
    const q = smallLine();
    if (!q) return;
    pres.smallAt = now();
    const mark = () => { S.small = [...new Set([...(S.small || []), q.id])]; save(); };
    if (!chatOn) return chime(q.text, { id: 'small:' + q.id, keep: 30000, onStart: mark });
    if (!pres.brain || !talked()) return chime(q.text, { id: 'small:' + q.id, onStart: () => { mark(); pres.waiting = true; } });
    mark();
    pres.waiting = true;
    pres.streak++;
    hear.lastFree = now();
    ask(`(stage note: it's gone quiet for a bit. small talk, topic ${q.id}: ask about them in your own words, like "${q.text}". just the question, your side comes later. if they already told you about that, pick another topic you haven't asked about.${pres.at ? ` they seem to be looking at ${pres.at}.` : ''})`, { note: true, fallback: q.text, id: 'small:' + q.id });
  }

  function presence() {
    if (!pres.ready) return;
    const t = now();
    const at = over ? '' : reading();
    if (at !== pres.at) { pres.at = at; pres.atSince = t; }
    if (document.hidden || !document.hasFocus() || asking || held || carried || touring || dir.busy || drag.on || life.shy || rec || input.value || S.noting || speaking()) return;
    const quiet = t - pres.said;
    // Stopped to read something it hasn't said anything about: a few seconds
    // on it, then one line. Not on top of a question it's waiting on.
    if (at && t - pres.atSince > 5000 && t - lastScroll > 1200 && !S.noticed.includes(at) && !(pres.waiting && quiet < 14000) && budgetOk()) {
      chime(LINES.notice[at], { id: 'notice:' + at, pri: PRI.page, ttl: 2000, onStart: () => noticed(at) });
      return;
    }
    if (smallDue(t, quiet)) return smallTalk();
    // Nobody's answering: tuck the chat away and let them browse.
    if (chatOn && !talked() && quiet > 30000 && (pres.waiting || pres.streak >= 3)) closeChat(LINES.introIgnored, 'close:ignored');
  }

  // ---- "rate me": the head asks for the camera ------------------------------------
  // A joke: the browser asks for the camera. If they say yes, their face sits in a
  // little bubble by the head for a few seconds, then the camera is turned off.
  // Nothing is recorded or sent anywhere. The brain hears how it went.
  let camBusy = false;
  async function askCamera() {
    if (camBusy || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    camBusy = true;
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 320, height: 320 }, audio: false });
    } catch (e) {
      camBusy = false;
      if (pres.brain) ask("(stage note: you asked for their camera so you could rate them and they said no)", { note: true });
      return;
    }
    const v = document.createElement('video');
    v.className = 'dl-cam';
    v.muted = true;
    v.playsInline = true;
    v.srcObject = stream;
    const r = actor.getBoundingClientRect();
    Object.assign(v.style, { left: Math.max(8, r.left - 150) + 'px', top: Math.max(8, r.top - 40) + 'px' });
    document.body.appendChild(v);
    v.play().catch(() => {});
    setFace('happy', 3000);
    const stop = () => { stream.getTracks().forEach((tr) => tr.stop()); v.remove(); camBusy = false; };
    setTimeout(() => {
      stop();
      if (pres.brain) ask("(stage note: they turned their camera on for a few seconds so you could rate them. you saw them. react in one short line, playful, never rude about looks)", { note: true });
    }, 4000);
    addEventListener('pagehide', stop, { once: true });
  }

  // ---- Bringing things out ----------------------------------------------------
  // The hand grabs something and drops it into the middle of the screen, over
  // the page (site.js opens it there and says when it's drawn with dl:ready).
  async function bring(id) {
    const slot = document.querySelector(`main [data-later="${id}"]`);
    if (!slot || slot.hasAttribute('data-out') || !window.dlBring) return;
    if (reduce) { window.dlBring(id); return; }
    // The hand grabs it, but it comes out even if the hand gets stuck on the way.
    const late = setTimeout(() => { if (!slot.hasAttribute('data-out')) window.dlBring(id); }, 2500);
    await useHand(async () => {
      pose('pinch');
      await handNearHead();
      const x = innerWidth / 2;
      const y = innerHeight * 0.3;
      await handTo(x, y, 15, { duration: 560 });
      clearTimeout(late);
      if (slot.hasAttribute('data-out')) return;
      const el = window.dlBring(id, { plop: true });
      if (el) await Promise.race([new Promise((r) => el.addEventListener('dl:ready', r, { once: true })), wait(3000)]);
      await handTo(x, innerHeight * 0.44, 25, { duration: 380, easing: SPRING });
      sound.tick();
      setFace('happy', 1600);
      await wait(450);
    });
  }

  // Quick replies under the bubble, for questions the head asks on its own.
  function options(list) {
    setChoices('ask', list.map(([label, fn]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.addEventListener('click', () => { choicesEl.hidden = true; fn(label); });
      return b;
    }));
  }
  async function reply(label, text, id = 'answer') {
    S.msgs.push({ role: 'user', content: label });
    S.auto = false;
    save();
    pres.streak = 0;
    pres.waiting = false;
    bus.emit('reply', { via: 'button', text: label, after: hear.last ? hear.last.id : '' });
    return speak(text, { id, pri: PRI.reply, ctx: null, echo: label, onStart: () => { S.msgs.push({ role: 'assistant', content: text }); save(); } });
  }
  // Page lines (a hobby's exchange, the nudges, a pitch) wait while the
  // visitor is busy with the head, or the hello is still waiting on them.
  function busyForPage() {
    return !pres.ready || asking || touring || pitching || lent || document.hidden || Boolean(input.value) || Boolean(rec) || Boolean(S.noting) ||
      Boolean(over) || Boolean(document.querySelector('.rl, .mt-over, .climb-wall, .bring')) ||
      Boolean(hear.cur && hear.cur.pri >= PRI.react) || introPending();
  }
  // Page events fire on every landing and wait out whatever the visitor is
  // busy with for as long as they stay on the page. pageTok changes only when
  // the page does; pageDone says which ones already went this landing.
  let pageTok = 0;
  const pageDone = {};
  // The full exchange on a page happens once a visit. After that the page's
  // own buttons (the gloves, Rally me, Play) start things.
  const seenPage = (id) => Boolean(S.seen && S.seen[id]);
  const markSeen = (id) => { S.seen = Object.assign({}, S.seen, { [id]: true }); save(); };
  // On the guitar page the head asks if they play. Yes: it brings the guitar
  // out. No: would they want to try? Typed answers go to the brain, which
  // knows to bring it with [[bring:guitar]].
  async function askGuitar(tok = pageTok, tries = 0) {
    if (here !== '/hobbies/guitar/' || S.quiet || tok !== pageTok || pageDone.guitar === tok || seenPage('guitar')) return;
    if (!document.querySelector('main [data-later="guitar"]:not([data-out])')) return;
    if (busyForPage()) { setTimeout(() => askGuitar(tok, tries), 250); return; }
    interrupt(true);
    wake();
    openFor();
    const ok = await say(LINES.guitar.ask, {
      id: 'ask:guitar',
      onStart: () => { noticed('guitar'); markSeen('guitar'); S.small = [...new Set([...(S.small || []), 'music'])]; save(); }
    });
    if (tok !== pageTok) return;
    // Cut off before it was out: ask again once they're free.
    if (!ok) { if (tries < 5) setTimeout(() => askGuitar(tok, tries + 1), 600); return; }
    pageDone.guitar = tok;
    pres.waiting = true;
    const out = async (label) => { await reply(label, LINES.guitar.yes, 'answer:guitar'); if (tok === pageTok) bring('guitar'); };
    options([
      ['yeah i do', out],
      ['nah', async (label) => {
        if (!(await reply(label, LINES.guitar.try, 'answer:guitar')) || tok !== pageTok) return;
        options([
          ['sure', async (l) => { await reply(l, LINES.guitar.sure, 'answer:guitar'); if (tok === pageTok) bring('guitar'); }],
          ["nah i'm good", (l) => reply(l, LINES.guitar.nah, 'answer:guitar')]
        ]);
      }]
    ]);
  }

  // Every hobby page gets one exchange: a real line about it, one question,
  // buttons that do something on the page. Once per visit per page, about a
  // second and a half after they land. Typed answers go to the brain as usual.
  const ASK_PAGES = {
    '/hobbies/hiking/': 'hiking', '/hobbies/climbing/': 'climbing', '/hobbies/badminton/': 'badminton',
    '/hobbies/muay-thai/': 'muaythai', '/hobbies/travel/': 'travel', '/hobbies/lumosity/': 'lumosity',
    '/hobbies/chess/': 'chess', '/hobbies/photography/': 'photography'
  };
  const pageEl = (sel) => document.querySelector('main ' + sel);
  // Point at the thing, after the words.
  const showOn = (sel) => { const el = pageEl(sel); if (el) setTimeout(() => point(el, { hold: 2600 }), 400); };
  let travelPick = false;
  let places = null;
  async function askPage(tok = pageTok, tries = 0) {
    const id = ASK_PAGES[here];
    if (!id || S.quiet || tok !== pageTok || pageDone[id] === tok || seenPage(id)) return;
    if (busyForPage()) { setTimeout(() => askPage(tok, tries), 250); return; }
    const L = LINES.ask[id];
    const mark = () => { noticed(id); markSeen(id); };
    // Cut off before the question was out: go again once they're free.
    const again = () => { if (tok === pageTok && tries < 5) setTimeout(() => askPage(tok, tries + 1), 600); };
    interrupt(true);
    wake();
    openFor();
    if (L.say && !(await say(L.say, { id: 'say:' + id, onStart: mark }))) return again();
    if (tok !== pageTok) return;
    if (id === 'hiking') showOn('[data-t="hike-panorama-ridge"] .phk-strip');
    if (!(await say(L.ask, { id: 'ask:' + id, onStart: mark }))) return again();
    if (tok !== pageTok) return;
    pageDone[id] = tok;
    pres.waiting = true;
    // On the game pages the answer is a reaction, then the head pitches the game.
    const game = PITCH_OF[id];
    const go = (text, sel, mood) => async (label) => {
      await reply(label, text, 'answer:' + id);
      if (mood) setFace(mood, 2400);
      if (tok !== pageTok) return;
      if (game) { await wait(1300); if (tok === pageTok) pitch(game); } else if (sel) showOn(sel);
    };
    if (game) setTimeout(() => { if (tok === pageTok) pitch(game); }, 6000);
    if (id === 'hiking') options([['yeah!', go(L.yes)], ['not really', go(L.no)]]);
    else if (id === 'climbing') options([
      ['v0 to v1', go(L.low, '.play[data-play="climbing"]')], ['v2', go(L.same, '.play[data-play="climbing"]', 'happy')],
      ['v3+', go(L.high, null, 'sad')], ["i don't climb", go(L.none, '.play[data-play="climbing"]')]
    ]);
    else if (id === 'badminton') options([
      ['singles', go(L.singles, '[data-3d="racket"]')], ['doubles', go(L.doubles, '[data-3d="racket"]', 'happy')],
      ["i don't play", go(L.none, '[data-3d="racket"]')]
    ]);
    else if (id === 'muaythai') options([['yeah', go(L.yes, '.play[data-play="muaythai"]')], ['not really', go(L.no, '.play[data-play="muaythai"]')]]);
    else if (id === 'lumosity') options([['bet', go(L.yes, '.play[data-play="pinball"]', 'angry')], ['probably not', go(L.no, '.play[data-play="pinball"]')]]);
    else if (id === 'chess') options([["i don't play", go(L.none, '.play[data-play="chess"]')]]);
    else if (id === 'photography') options([
      ['yeah', go(L.yes, '[data-3d="cameras"]')], ['just my phone', go(L.phone)], ['not really', go(L.no, '[data-3d="cameras"]')]
    ]);
    else if (id === 'travel') {
      travelPick = true;
      showOn('[data-3d="globe"]');
      options([["i'll type it", async (label) => {
        travelPick = false;
        pres.waiting = true;
        S.auto = false;
        bus.emit('reply', { via: 'button', text: label, after: hear.last ? hear.last.id : '' });
        await speak(L.type, { id: 'answer:travel', pri: PRI.reply, ctx: null, echo: label });
      }]]);
    }
  }
  // Where they're from, tapped on the globe: the closest place he's been.
  async function globePicked({ lat, lng }) {
    if (!travelPick || here !== '/hobbies/travel/') return;
    travelPick = false;
    choicesEl.hidden = true;
    if (!places) {
      try { places = (await (await fetch('/hobbies/travel/places.json')).json()).places || []; } catch (e) { places = []; }
    }
    const R = Math.PI / 180;
    const km = (p) => 6371 * Math.acos(Math.min(1, Math.sin(lat * R) * Math.sin(p.lat * R) + Math.cos(lat * R) * Math.cos(p.lat * R) * Math.cos((lng - p.lng) * R)));
    const best = places.map((p) => [km(p), p]).sort((a, b) => a[0] - b[0])[0];
    const L = LINES.ask.travel;
    const text = best && best[0] < 150 ? L.been(best[1]) : best && best[0] < 600 ? L.near(best[1]) : L.never;
    setFace(best && best[0] < 600 ? 'happy' : 'sad', 2200);
    await reply(`(tapped ${lat.toFixed(1)}, ${lng.toFixed(1)} on the globe)`, text, 'answer:travel');
  }
  // A Lumosity game ended (play/pinball.js, ebbflow.js, penguin.js send dl:lumo).
  function lumoDone({ game, score, david }) {
    if (here !== '/hobbies/lumosity/') return;
    const L = LINES.ask.lumosity;
    const o = { pri: PRI.react, ctx: null };
    if (david == null) quip(L.unset, 2600, 'happy', Object.assign({ id: 'lumo:unset' }, o));
    else if (score > david) quip(L.win, 3000, 'angry', Object.assign({ id: 'lumo:win' }, o));
    else if (score === david) quip(L.tie, 2600, 'happy', Object.assign({ id: 'lumo:tie' }, o));
    else quip(L.lose, 3000, 'happy', Object.assign({ id: 'lumo:lose' }, o));
  }

  // On /hobbies/ the head won't let them just browse the list: a nudge at a
  // hobby they haven't opened, then two more, a few seconds apart, then it
  // lets it go. Stops as soon as they open one or start talking.
  let pickTimer = 0;
  async function nudgeHobbies(step = 0, tok = pageTok) {
    clearTimeout(pickTimer);
    if (here !== '/hobbies/' || S.quiet || step >= LINES.pick.open.length || tok !== pageTok || (step === 0 && seenPage('hobbies'))) return;
    // Not over the top of a question it just asked.
    if (busyForPage() || speaking() || (chatOn && pres.waiting && now() - pres.said < 8000)) {
      pickTimer = setTimeout(() => nudgeHobbies(step, tok), 500);
      return;
    }
    const seen = S.hobbies || [];
    const rows = [...document.querySelectorAll('main .hobs [data-t]')].filter((el) => LINES.pick.teaser[el.dataset.t]);
    const fresh = rows.filter((el) => !seen.includes(el.dataset.t));
    const pool = fresh.length ? fresh : rows;
    if (!pool.length) return;
    const el = pool[Math.floor(Math.random() * pool.length)];
    const t = el.dataset.t;
    wake();
    const ok = await speak(LINES.pick.open[step] + '. ' + LINES.pick.teaser[t], {
      id: 'nudge:hobbies', pri: PRI.page, hold: 2600, keep: 0,
      onStart: () => { if (step === 0) markSeen('hobbies'); S.hobbies = [...new Set([...(S.hobbies || []), t])]; save(); point(el, { hold: 2400 }); }
    });
    if (tok !== pageTok) return;
    pickTimer = setTimeout(() => nudgeHobbies(ok ? step + 1 : step, tok), ok ? 8000 : 600);
  }

  // ---- The pitch ----------------------------------------------------------------
  // Starting a game goes through the head, never a button on the page. The page
  // dims, the head comes right up to the screen, big, and asks, with two
  // answers under it. Yes starts it (the head flies straight into the ring or
  // onto the wall from there), later sends it back to its corner, and clicking
  // the head on that page asks again. Quiet heads leave the page's own buttons.
  const PITCHES = {
    spar: { page: '/hobbies/muay-thai/', el: '.play[data-play="muaythai"]', fly: true },
    climb: { page: '/hobbies/climbing/', el: '.play[data-play="climbing"]', fly: true },
    chess: { page: '/hobbies/chess/', el: '.play[data-play="chess"]' },
    rally: { page: '/hobbies/badminton/', el: '[data-3d="racket"]' }
  };
  const PITCH_OF = { muaythai: 'spar', climbing: 'climb', chess: 'chess', badminton: 'rally' };
  // Which game was pitched (or played) on which landing.
  const pitched = {};
  let pitching = null;
  let pitchEnd = null;
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  async function pitch(id, { force = false, again = false, line = '', tries = 0 } = {}) {
    const P = PITCHES[id];
    if (!P || here !== P.page || pitching || lent || S.quiet) return;
    if (!force && (pitched[id] === pageTok || seenPage('pitch:' + id))) return;
    const piece = document.querySelector('main ' + P.el);
    if (!piece) return;
    if (!force && (busyForPage() || (chatOn && (now() - lastAsk < 15000 || (pres.waiting && now() - pres.said < 6000))))) {
      const tok = pageTok;
      setTimeout(() => { if (tok === pageTok) pitch(id, { line, tries: tries + 1 }); }, 1000);
      return;
    }
    pitched[id] = pageTok;
    S.pitchLater = '';
    markSeen('pitch:' + id);
    pitching = id;
    const L = LINES.pitch[id];
    let dim = null;
    let ask = null;
    let asked = false;
    const onKey = (e) => { if (e.key === 'Escape') endPitch(false); };
    // yes null: called off (they left the page) at any point, even mid-line.
    pitchEnd = async (yes) => {
      if (yes != null && !asked) return;
      document.removeEventListener('keydown', onKey);
      pitchEnd = null;
      if (ask) ask.remove();
      if (yes == null) {
        if (dim) dim.remove();
        root.classList.remove('pitching');
        pitching = null;
        if (hear.cur && hear.cur.id === 'pitch:' + id) cut(hear.cur, 'pitch');
        hideNow();
        if (lent) window.dlHead.home(0);
        return;
      }
      bus.emit('reply', { via: 'button', text: yes ? L.yes : L.no, after: 'pitch:' + id });
      speak(yes ? L.ok : LINES.pitch.later, { id: 'pitch:' + id + (yes ? ':yes' : ':no'), pri: PRI.reply, ctx: null, stay: true });
      setFace(yes ? 'happy' : 'sad', 1600);
      await wait(reduce ? 300 : yes ? 900 : 1500);
      dim.classList.remove('on');
      setTimeout(() => dim.remove(), 300);
      root.classList.remove('pitching');
      pitching = null;
      await hideTalk();
      if (!yes) {
        S.pitchLater = id;
        save();
        await window.dlHead.home(reduce ? 0 : 650);
        return;
      }
      // The ring and the wall fly the head in from where it is; the rest send it home first.
      if (!P.fly) await window.dlHead.home(reduce ? 0 : 600);
      startGame(id, piece);
      // Chess counts on the first move, the rally on its own button (site.js).
      if (P.fly) found(id);
    };
    interrupt();
    wake();
    emoteOff();
    if (chatOn) { closeChat(null); clearTimeout(dir.timer); }
    choicesEl.hidden = true;
    await hideTalk();
    if (pitching !== id) return;

    dim = document.createElement('div');
    dim.className = 'dl-pitch-dim';
    root.prepend(dim);
    root.classList.add('pitching');
    requestAnimationFrame(() => dim.classList.add('on'));
    lend(true, true);
    const sm = innerWidth < 640;
    const k = sm ? 1.7 : 2.3;
    const x = innerWidth / 2 - (HW * k) / 2;
    const y = clamp(innerHeight * 0.58 - (HH * k) / 2, 150, innerHeight - HH * k - 120);
    dim.style.setProperty('--px', innerWidth / 2 + 'px');
    dim.style.setProperty('--py', y + (HH * k) / 2 + 'px');
    await fly(x, y, k, reduce ? 0 : 750);
    if (pitching !== id) return;
    life.surprise = now() + 400;
    squish();
    setFace('happy', 2600);

    ask = document.createElement('div');
    ask.className = 'dl-pitch-ask';
    ask.hidden = true;
    ask.innerHTML = `<button type="button" class="yes">${esc(L.yes)}</button><button type="button" class="no">${esc(L.no)}</button>`;
    root.appendChild(ask);
    const r = headBtn.getBoundingClientRect();
    ask.style.left = r.left + r.width / 2 + 'px';
    ask.style.top = r.bottom + 22 + 'px';
    const ok = await speak(again ? LINES.pitch.again + ' ' + (line || L.line) : line || L.line, {
      id: 'pitch:' + id, pri: force ? PRI.reply : PRI.page, ctx: force ? null : undefined, stay: true,
      onStart: () => { if (!force) hear.lastFree = now(); }
    });
    if (pitching !== id) return;
    if (!ok) { endPitch(null); return; }
    asked = true;
    ask.hidden = false;
    play(ask, [{ transform: 'translate(-50%, 8px)', opacity: 0 }, { transform: 'translate(-50%, 0)', opacity: 1 }], { duration: 220, easing: 'ease-out' });
    ask.querySelector('.yes').focus({ preventScroll: true });
    document.addEventListener('keydown', onKey);
    ask.querySelector('.yes').addEventListener('click', () => endPitch(true));
    ask.querySelector('.no').addEventListener('click', () => endPitch(false));
    dim.addEventListener('click', () => endPitch(false));
  }
  function endPitch(yes) { if (pitchEnd) pitchEnd(yes); }
  function startGame(id, piece) {
    if (!document.contains(piece)) return;
    // The ring and the wall borrow the head (dlHead.flyTo), which says game_start for them.
    if (id === 'spar' || id === 'climb') { piece.dispatchEvent(new CustomEvent('dl:start')); return; }
    if (id === 'chess') {
      piece.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(() => { point(piece, { hold: 1800 }); quip(LINES.pitch.chess.ok, 1600, 'happy', { id: 'pitch:chess:go', pri: PRI.react }); }, reduce ? 0 : 600);
      return;
    }
    if (id === 'rally') {
      const go = () => { const b = piece.querySelector('.rk-rally'); if (b) b.click(); };
      if (piece.querySelector('.rk-stats.on')) go();
      else {
        const pickBtn = piece.querySelectorAll('.dl-sr button')[1];
        if (pickBtn) pickBtn.click();
        setTimeout(go, reduce ? 50 : 900);
      }
    }
  }
  // Badminton: opening a racket up close is the moment to ask, by its name.
  let racketWatch = null;
  function watchRackets() {
    if (racketWatch) { racketWatch.disconnect(); racketWatch = null; }
    const piece = here === PITCHES.rally.page && document.querySelector('main [data-3d="racket"]');
    if (!piece) return;
    racketWatch = new MutationObserver(() => {
      const stats = piece.querySelector('.rk-stats.on');
      if (!stats || pitching || pitched.rally === pageTok) return;
      const name = (stats.querySelector('.rk-name') || {}).textContent || '';
      setTimeout(() => {
        if (piece.querySelector('.rk-stats.on')) pitch('rally', { line: name ? LINES.pitch.rally.named(name) : '' });
      }, 1600);
    });
    racketWatch.observe(piece, { subtree: true, attributes: true, attributeFilter: ['class'] });
  }
  // ---- Asked to play ------------------------------------------------------------
  // "can i rally you again", "wanna spar", "call meowmeow": the head does it
  // instead of talking about it. Typed asks it's sure about are caught here
  // (wants), the rest come back from the server as [[play:id]].
  const PLAY_AT = { rally: '/hobbies/badminton/', spar: '/hobbies/muay-thai/', climb: '/hobbies/climbing/', chess: '/hobbies/chess/', guitar: '/hobbies/guitar/' };
  const GAME_ON = Object.fromEntries(Object.entries(PLAY_AT).map(([k, v]) => [v, k]));
  const WANTS = [
    ['rally', /\b(rally|play badminton|badminton (game|match))\b/],
    ['spar', /\b(spar|fight|box|kick you|punch you)\b/],
    ['climb', /\b(climb|race you up)\b/],
    ['chess', /\b(play chess|chess (game|match))\b/],
    ['cat', /\b(cat|meow ?meow|kitty)\b/]
  ];
  const ASKS_TO = /\b(let'?s|lets|can (i|we|u|you)|could (i|we|u|you)|may i|wanna|want to|i want|gimme|give me|start|again|another|one more|rematch|bring it|call|see|show me|summon|try|ready)\b|^(rally|spar|fight|climb|call)\b/;
  const AGAIN = /\b(again|rematch|one more|another (one|round|game|rally|match))\b/;
  const NOT_NOW = /\b(don'?t|dont|not|never|no more|nah|later|stop|how|why|when|what|who|where|which|ever|often|usually|about|tell|explain|story)\b/;
  // "one more thing", "say that again": not a game.
  const NOT_AGAIN = /\b(say|said|repeat|explain|tell|thing|things|question|ask|read|show|resume|link|email|that)\b/;
  function wants(q) {
    const t = q.toLowerCase();
    if (NOT_NOW.test(t)) return '';
    if (/\b(can i|could i|may i|let me|lemme|i wanna|i want to)\b.*\b(play|try|strum)\b.*\bguitar\b/.test(t)) return 'guitar';
    if (!ASKS_TO.test(t)) return '';
    const hit = WANTS.filter(([, re]) => re.test(t));
    if (hit.length === 1) return hit[0][0];
    if (!hit.length && AGAIN.test(t) && t.split(/\s+/).length <= 6 && !NOT_AGAIN.test(t)) return GAME_ON[here] && GAME_ON[here] !== 'guitar' ? GAME_ON[here] : (S.lastGame || '');
    return '';
  }
  async function playAsked(q, id) {
    S.msgs.push({ role: 'user', content: q });
    save();
    const text = PLAY_AT[id] && PLAY_AT[id] !== here ? LINES.play.go : LINES.play[id];
    await speak(text, { id: 'play:' + id, pri: PRI.reply, ctx: null, echo: q, onStart: () => { S.msgs.push({ role: 'assistant', content: text }); save(); } });
    await wait(reduce ? 0 : 600);
    playNow(id);
  }
  // Somewhere else: go there first, and pageLines starts it on arrival.
  async function playNow(id) {
    if (id === 'cat') { window.dlCat(); return; }
    const page = PLAY_AT[id];
    if (!page) return;
    if (page !== here) { S.playNext = id; save(); await navigate(page); return; }
    startWhenReady(id, pageTok);
  }
  function startWhenReady(id, tok, tries = 0) {
    if (tok !== pageTok) return;
    if (id === 'guitar') { bring('guitar'); return; }
    const P = PITCHES[id];
    const piece = P && document.querySelector('main ' + P.el);
    const ready = piece && (id === 'spar' ? window.dlSparReady : id === 'rally' ? piece.querySelector('.dl-sr button, .rk-rally') : id === 'climb' ? piece.classList.contains('piece-on') : true);
    if (!ready || document.querySelector('.rl, .mt-over, .climb-wall')) {
      if (tries < 80) setTimeout(() => startWhenReady(id, tok, tries + 1), 250);
      return;
    }
    pitched[id] = tok;
    if (pitching) endPitch(null);
    const go = () => { if (tok === pageTok) { startGame(id, piece); if (id === 'spar') found(id); } };
    if (id === 'chess') return go();
    if (chatOn) closeChat(null);
    hideTalk().then(go);
  }

  window.dlPlayNow = (id) => {
    if (id === 'guitar' && here === PLAY_AT.guitar) { if (pitching) endPitch(null); window.dlBring('guitar'); return true; }
    playNow(id);
    return true;
  };

  // Meowmeow's page, every time they land on it: the head calls her over (or
  // says she's already here), then asks if they have pets until they answer.
  async function catPage(tok) {
    if (here !== '/hobbies/meowmeow/' || S.quiet || tok !== pageTok || pageDone.cat === tok || seenPage('cat')) return;
    if (busyForPage()) { setTimeout(() => catPage(tok), 250); return; }
    pageDone.cat = tok;
    markSeen('cat');
    const C = LINES.catPage;
    interrupt(true);
    wake();
    noticed('meowmeow');
    if (cat) {
      petCat();
      await say(C.here, { id: 'cat:here', mood: 'happy' });
    } else {
      await say(C.hi, { id: 'cat:hi', hold: 900 });
      if (tok !== pageTok) return;
      say(C.psst, { id: 'cat:psst', hold: 1400 });
      await summonCat();
    }
    if (tok === pageTok && !S.pets) setTimeout(() => petsAsk(tok), 700);
  }
  async function petsAsk(tok, tries = 0) {
    if (tok !== pageTok || S.quiet || S.pets) return;
    if (busyForPage()) { setTimeout(() => petsAsk(tok, tries), 250); return; }
    openFor();
    const ok = await say(LINES.catPage.ask, { id: 'ask:pets', onStart: () => { S.small = [...new Set([...(S.small || []), 'pets'])]; save(); } });
    if (tok !== pageTok) return;
    if (!ok) { if (tries < 5) setTimeout(() => petsAsk(tok, tries + 1), 600); return; }
    pres.waiting = true;
    const answer = (text) => (label) => { S.pets = true; save(); reply(label, text, 'answer:pets'); };
    options([['yeah!', answer(LINES.catPage.yes)], ['nope', answer(LINES.catPage.no)]]);
  }

  // The things-to-do list can ask for it again on the page it's on.
  window.dlPitch = (id) => { if (PITCHES[id] && PITCHES[id].page === here) pitch(id, { force: true }); };
  window.dlPitchable = (id) => Boolean(PITCHES[id] && PITCHES[id].page === here && !S.quiet);

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
    openFor();
    setFace('happy', 2500);
    await say(LINES.replied(fresh[fresh.length - 1].body, fresh.length > 1), { id: 'replied', pri: PRI.react, ctx: null, ttl: 30000 });
  }

  // ---- Feeding ----------------------------------------------------------------
  // "nom nom", then it talks about whatever it was fed: the brain when it's
  // up, the canned line otherwise.
  async function eat(id) {
    found('feed');
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
    S.auto = false;
    if (asking) return;
    const t = targets[id];
    if (!(await say(LINES.fed[0], { id: 'fed', pri: PRI.react, ctx: null }))) return;
    if (t && pres.brain) ask(`(stage note: the visitor dragged ${id} (${t.about}) onto your face and fed it to you)`, { note: true, pri: PRI.react, id: 'server:fed' });
    else if (LINES.notice[id]) { await wait(500); say(LINES.notice[id], { id: 'notice:' + id, pri: PRI.react, ctx: null, onStart: () => noticed(id) }); }
  }

  // ---- Fourth wall ----------------------------------------------------------

  // Once a visit each, marked when it's actually said. Behind a reply that's
  // streaming in it waits its turn instead of getting lost. ctx null: it's
  // about them, not the page.
  function react(key, text, hold = 1800, mood, ctx = null) {
    if (S.once.includes(key) || held || life.shy) return;
    wake();
    quip(text, hold, mood, { id: 'react:' + key, pri: PRI.react, ctx, onStart: () => once(key) });
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
    quip(seen ? LINES.devtoolsAgain : LINES.devtools[0], 8000, seen ? 'angry' : null, { id: 'devtools', pri: PRI.react, ctx: null });
    if (seen) return;
    const later = (ms, line) => dt.timers.push(setTimeout(() => dt.open && quip(line, 8000, null, { id: 'devtools:' + ms, pri: PRI.react, ctx: null }), ms));
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
    quip(LINES.devtoolsBye, 1400, null, { id: 'devtools:bye', pri: PRI.react, ctx: null });
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
  // Resolves about 2s in, once they're not mid-scroll, or at 4s regardless.
  function settled() {
    const t0 = now();
    return new Promise((done) => {
      const check = () => {
        const t = now();
        if ((t - t0 > 2000 && t - lastScroll > 600) || t - t0 > 4000) done();
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
    found('cat');
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
  window.dlCat = () => {
    if (!cat && !S.quiet) { wake(); quip(LINES.catPage.psst, 1400, 'happy', { id: 'cat:psst', pri: PRI.react, ctx: null }); }
    summonCat();
  };
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
    quip(pick(LINES.cat), 1200, 'happy', { id: 'cat', pri: PRI.react, ctx: null });
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
    if (spun > 540) { emote('@'); quip(pick(LINES.dizzy), 1400, 'sad', { id: 'dizzy', pri: PRI.react, ctx: null }); }
    else if (drag.weed) quip(pick(LINES.landed), 1200, 'happy', { id: 'landed', pri: PRI.react, ctx: null });
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
      const later = S.pitchLater && PITCHES[S.pitchLater] && PITCHES[S.pitchLater].page === here;
      if (!chatOn && later && !pitching) { pitch(S.pitchLater, { force: true, again: true }); return; }
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
      // Off to another page: whatever it was saying about this one stops now, not when the next one lands.
      const a = e.target.closest('a[href]');
      if (a && e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && !a.target && !a.hasAttribute('download')) {
        const u = new URL(a.href, location.href);
        if (u.origin === location.origin && norm(u.pathname) !== here && !/\.[a-z0-9]{2,5}$/i.test(u.pathname)) {
          hear.leaving = now();
          setContext('leaving', 'leave');
          return;
        }
      }
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

    // Page swaps (site.js): the head stays, the page under it changes. site.js
    // says so on the bus and with dl:page (older copies only do dl:page).
    let busPage = -1e9;
    bus.on('page', () => { busPage = now(); onPage(); });
    document.addEventListener('dl:page', () => { if (now() - busPage > 100) onPage(); });
    // What's open over the page (play/projects.js, site.js, games).
    bus.on('overlay_open', (d) => {
      if (d.kind !== 'project' || !d.id) return;
      setContext('project:' + d.id, 'overlay_open');
      projectOpened(d.id);
    });
    bus.on('overlay_close', (d) => {
      if (over === d.kind + ':' + d.id || (d.kind === 'project' && over === 'demo:' + d.id)) setContext('', 'overlay_close');
    });
    bus.on('demo_open', (d) => {
      setContext('demo:' + d.id, 'demo_open');
      demoOpened(d.id);
    });
    bus.on('demo_close', (d) => { if (over === 'demo:' + d.id) setContext('project:' + d.id, 'demo_close'); });
    bus.on('bring', (d) => setContext('bring:' + d.id, 'bring'));
    bus.on('game_start', (d) => {
      if (over === 'game:' + (d.game || 'game')) return;
      // A game needs the screen: the chat steps aside (chess talks through it).
      if (chatOn && !asking && d.game !== 'chess') closeChat(null);
      for (const k in PITCHES) if (PITCHES[k].page === here) pitched[k] = pageTok;
      if (GAME_ON[here]) { S.lastGame = GAME_ON[here]; save(); }
      setContext('game:' + (d.game || 'game'), 'game_start');
    });
    bus.on('game_end', (d) => { if (over === 'game:' + d.game) setContext('', 'game_end'); });

    document.documentElement.addEventListener('mouseleave', (e) => {
      if (!fine || e.clientY > 0 || now() <= 8000 || S.once.includes('exit')) return;
      // Name something they haven't done yet, and leave a link to it.
      const next = window.dlFinds && window.dlFinds.next();
      react('exit', (next && LINES.exitTo[next.id]) || LINES.exit, 2600, 'sad');
      if (next) window.dlFinds.nudge('<b>Before you go</b>');
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

  function onPage() {
    pageTok++;
    endPitch(null);
    travelPick = false;
    clearTimeout(pickTimer);
    here = norm(location.pathname);
    const hob = /^\/hobbies\/([^/]+)\/$/.exec(here);
    if (hob) S.hobbies = [...new Set([...(S.hobbies || []), hob[1] === 'muay-thai' ? 'muaythai' : hob[1]])];
    pageAt = now();
    S.pages = (S.pages || 1) + 1;
    save();
    pres.at = '';
    pres.waiting = false;
    hear.leaving = 0;
    setContext('', 'page');
    if (giveBack) giveBack();
    if (visitor && navigator.sendBeacon) navigator.sendBeacon(API + '/visit', JSON.stringify({ visitor, path: here, referrer: '', tz: TZ }));
    setTimeout(watchRackets);
    pageLines(here === '/hobbies/' ? 1200 : /^\/hobbies\/./.test(here) ? 500 : 1500);
  }
  // What a page says on its own once they land: a hobby's exchange, the
  // nudges on /hobbies/, the wall. Anything that changes the context first
  // (another page, an overlay) calls it off.
  function pageLines(after) {
    const tok = hear.tok;
    const pt = pageTok;
    // They asked to play this from another page: straight into it.
    const next = S.playNext;
    if (next) { S.playNext = ''; save(); }
    if (next && PLAY_AT[next] === here) { setTimeout(() => startWhenReady(next, pt), 300); return; }
    if (here === '/hobbies/meowmeow/') setTimeout(() => catPage(pt), Math.min(after, 400));
    if (here === '/hobbies/guitar/') setTimeout(() => askGuitar(pt), after);
    if (ASK_PAGES[here]) setTimeout(() => askPage(pt), after);
    if (here === '/hobbies/') pickTimer = setTimeout(() => nudgeHobbies(0, pt), after);
    if (here === '/notes/') setTimeout(() => { if (tok === hear.tok) react('wall', LINES.wall, 3000, null, ctxNow()); }, after + 1000);
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
    await wait(350);
    if (!chatOn) intro();
  }

  function start() {
    if (S.quiet) root.classList.add('quiet');
    if (!sound.on) root.classList.add('muted');
    if (visitor && navigator.sendBeacon) navigator.sendBeacon(API + '/visit', JSON.stringify({ visitor, path: here, referrer: document.referrer, tz: TZ }));
    const met = S.met;
    // A chat the head opened that they never answered doesn't follow them to a new page.
    if (S.open && S.auto) { S.open = false; S.auto = false; save(); }
    if (S.open) { actor.classList.add('on'); restore(); }
    else if (!met) enter().finally(() => { pres.ready = true; });
    else {
      const d = dockPos();
      setHead(d.x, d.y);
      actor.classList.add('on');
      play(headBtn, [{ transform: 'scale(0)' }, { transform: 'scale(1.1)', offset: 0.7 }, { transform: 'scale(1)' }], { duration: 320, easing: 'ease-out' });
      if (is404()) setTimeout(lost, 900);
    }
    schedule(met ? rand(9000, 14000) : 13000);
    if (met) pres.ready = true;
    pageLines(here === '/hobbies/' ? 1200 : /^\/hobbies\/./.test(here) ? 500 : 1500);
    document.documentElement.classList.toggle('dl-pitch', !S.quiet);
    watchRackets();
    addEventListener('dl:globe-pick', (e) => globePicked(e.detail || {}));
    addEventListener('dl:lumo', (e) => lumoDone(e.detail || {}));
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
  function lend(on, keep) {
    lent = on;
    headBtn.style.pointerEvents = on ? 'none' : '';
    talk.style.visibility = hand.style.visibility = on && !keep ? 'hidden' : '';
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
  // ---- Moved to tears (the guitar over the page, site.js) ----------------------
  // cry() puts on the sad face with tears running down, clap() brings two
  // hands up under the chin clapping (a soft clap each time they meet),
  // moved() is the whole reaction when someone stops recording a song for it.
  // calm() dries it all up at once.
  const moods = { cryTimer: 0, clapTimer: 0, clapEnd: 0, tears: null, hands: null };
  function cry(ms = 6500) {
    if (!moods.tears) {
      moods.tears = document.createElement('div');
      moods.tears.className = 'dl-tears';
      moods.tears.innerHTML = '<span class="l"><i></i><i></i></span><span class="r"><i></i><i></i></span>';
      skull.appendChild(moods.tears);
    }
    clearTimeout(moods.cryTimer);
    root.classList.add('crying');
    setFace('sad', ms);
    moods.cryTimer = setTimeout(() => root.classList.remove('crying'), ms);
  }
  // Turned palm to palm (narrowed), the left one mirrored; they swing in from the wrist and meet in the middle.
  const CLAP_L = [{ transform: 'translateX(-34%) rotate(-16deg) scale(-0.6, 1)' }, { transform: 'translateX(24%) rotate(3deg) scale(-0.6, 1)', offset: 0.45 }, { transform: 'translateX(-34%) rotate(-16deg) scale(-0.6, 1)' }];
  const CLAP_R = [{ transform: 'translateX(34%) rotate(16deg) scale(0.6, 1)' }, { transform: 'translateX(-24%) rotate(-3deg) scale(0.6, 1)', offset: 0.45 }, { transform: 'translateX(34%) rotate(16deg) scale(0.6, 1)' }];
  function clap(ms = 3000) {
    if (!moods.hands) {
      moods.hands = document.createElement('div');
      moods.hands.className = 'dl-clap';
      if (HANDS) moods.hands.innerHTML = `<img class="l" src="${HANDS.palm.src}" alt="" draggable="false"><img class="r" src="${HANDS.palm.src}" alt="" draggable="false">`;
      actor.appendChild(moods.hands);
    }
    const [l, r] = moods.hands.querySelectorAll('img');
    clearTimeout(moods.clapTimer);
    moods.clapEnd = now() + ms;
    root.classList.add('clapping');
    const beat = () => {
      if (now() >= moods.clapEnd) { clapStop(); return; }
      const dur = rand(300, 350);
      if (!reduce && l && r) {
        l.animate(CLAP_L, { duration: dur, easing: 'ease-in-out' });
        r.animate(CLAP_R, { duration: dur, easing: 'ease-in-out' });
      }
      moods.clapTimer = setTimeout(() => {
        sound.clap();
        moods.clapTimer = setTimeout(beat, dur * 0.55);
      }, dur * 0.45);
    };
    beat();
  }
  function clapStop() {
    clearTimeout(moods.clapTimer);
    root.classList.remove('clapping');
  }
  function calm() {
    clearTimeout(moods.cryTimer);
    clapStop();
    if (root.classList.contains('crying')) { root.classList.remove('crying'); setFace(restFace()); }
  }

  window.dlHead = {
    rect: () => headBtn.getBoundingClientRect(),
    // Put the visible head's top-left at (x, y), w wide. keep: it stays itself
    // there (bubble and hand still show) instead of standing in for a copy.
    flyTo(x, y, w, ms = 750, { keep = false } = {}) {
      // Borrowed for a game (the ring, the wall), not to listen to the guitar.
      // The pitch may have it already, so this goes by what's open, not by lent.
      if (!keep && !over.startsWith('game:')) bus.emit('game_start', { game: Object.keys(PITCHES).find((k) => PITCHES[k].page === here) || 'game' });
      if (!lent) {
        lend(true, keep);
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
    cry,
    clap,
    calm,
    // take: { ms, notes } from the guitar's recorder.
    moved(take = {}) {
      calm();
      wake();
      if (!(take.ms >= 3000) || !(take.notes >= 4)) {
        emote('?');
        quip(LINES.guitar.short, 1600, 'sad', { id: 'guitar:short', pri: PRI.react });
        return;
      }
      cry(7000);
      clearTimeout(moods.clapTimer);
      moods.clapTimer = setTimeout(() => clap(3400), reduce ? 0 : 500);
      quip(LINES.guitar.moved, 2600, null, { id: 'guitar:moved', pri: PRI.react });
    },
    async home(ms = 750) {
      if (!lent) return;
      if (over.startsWith('game:')) bus.emit('game_end', { game: over.slice(5) });
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
