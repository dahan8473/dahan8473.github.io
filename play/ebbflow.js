// Ebb and Flow: a task-switching game for the Lumosity page. A field of leaves
// points one way and drifts another. Green: answer where they point. Orange:
// answer where they move. 45 seconds, metered scoring: four right in a row
// raises the multiplier (max 10), a miss drops it by one.
//   <div class="play" data-play="ebbflow" data-v="N">
// David's best comes from /hobbies/lumosity/best.json (key ebbflow). The
// visitor's best lives in localStorage, and a finished run fires dl:lumo on window.

const CSS_ID = 'play-ebbflow-css';
const KEY = 'dl-lumo-ebbflow';
const TUT_KEY = 'dl-lumo-ebbflow-tut';
const SECONDS = 45;
const DIRS = ['up', 'right', 'down', 'left'];
const VEC = [[0, -1], [1, 0], [0, 1], [-1, 0]];
const ROT = [-90, 0, 90, 180];
const KEYS = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3, w: 0, d: 1, s: 2, a: 3, W: 0, D: 1, S: 2, A: 3 };

// One leaf, tip to the right; rotated per direction.
const LEAF = '<svg viewBox="0 0 32 32" aria-hidden="true"><path class="stem" d="M2 16h6"/>'
  + '<path d="M6 16C6 7.5 18 6.5 30 16C18 25.5 6 24.5 6 16Z"/><path class="rib" d="M9 16h14"/></svg>';
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M5.5 11.5L12 5l6.5 6.5"/></svg>';

const CSS = `
.peb { --peb-green: #16a34a; --peb-orange: #f97316; max-width: 640px; }
[data-theme="dark"] .peb { --peb-green: #4ade80; --peb-orange: #fb923c; }
.peb-panel { padding: 22px; border-radius: 14px; background: var(--fill); }
.peb-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.peb-name { color: var(--t1); font-weight: 500; }
.peb-what { color: var(--t2); }
.peb-art { flex: none; display: flex; gap: 2px; }
.peb-art svg { width: 30px; height: 30px; }
.peb-art .g { color: var(--peb-green); transform: rotate(-90deg); }
.peb-art .o { color: var(--peb-orange); transform: rotate(180deg); }
.peb svg path { fill: currentColor; }
.peb svg .stem { fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.peb svg .rib { fill: none; stroke: var(--bg); stroke-width: 1.3; stroke-linecap: round; opacity: 0.55; }
.peb-lines { margin: 16px 0 20px; color: var(--t2); }
.peb-lines b { font-weight: 400; color: var(--t1); }
.peb-lines .say { margin-top: 8px; color: var(--t1); }
.peb-lines .gap { margin-top: 8px; }
.peb-btns { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
.peb-go { min-height: 40px; padding: 8px 22px; border: 0; border-radius: 999px; background: var(--t1); color: var(--bg); font: inherit; cursor: pointer; transition: opacity 160ms ease; }
.peb-go:hover { opacity: 0.86; }
.peb :is(.peb-go, .peb-link, .peb-quit):focus-visible { border-radius: 999px; }
.peb-link { min-height: 40px; padding: 4px 0; border: 0; background: none; color: var(--t2); font: inherit; cursor: pointer; }
.peb-link:hover { color: var(--t1); }
.peb-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; min-height: 40px; margin-bottom: 10px; color: var(--t3); }
.peb-bar b { font-weight: 400; color: var(--t1); }
.peb-bar .end { margin-left: auto; display: flex; align-items: center; gap: 10px; }
.peb-bar .say { color: var(--t1); }
.peb-meter { display: inline-flex; gap: 4px; }
.peb-meter i { width: 8px; height: 8px; border-radius: 50%; background: var(--rule); transition: background 160ms ease; }
.peb-meter i.on { background: #88c0d0; }
.peb-x { min-width: 2.4em; text-align: right; }
.peb-quit { display: grid; place-items: center; width: 40px; height: 40px; margin-right: -8px; padding: 0; border: 0; border-radius: 50%; background: none; color: var(--t3); cursor: pointer; }
.peb-quit:hover { color: var(--t1); background: var(--fill); }
.peb-quit svg { width: 16px; height: 16px; }
.peb-quit svg path { fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
.peb-field { position: relative; height: 280px; border-radius: 14px; background: color-mix(in srgb, var(--peb-green) 9%, var(--fill)); overflow: hidden; transition: background 200ms ease; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
.peb-field.live { touch-action: none; }
.peb-field::before, .peb-field::after { content: ''; position: absolute; inset: 0; z-index: 1; border-radius: inherit; pointer-events: none; opacity: 0; transition: opacity 280ms ease; }
.peb-field::before { background: rgba(136, 192, 208, 0.14); box-shadow: inset 0 0 0 2px rgba(136, 192, 208, 0.55); }
.peb-field::after { background: rgba(191, 97, 106, 0.1); box-shadow: inset 0 0 0 2px rgba(191, 97, 106, 0.45); }
.peb-field.ok::before, .peb-field.no::after { opacity: 1; transition-duration: 40ms; }
.peb-leaves.in { animation: peb-in 150ms ease; }
@keyframes peb-in { from { opacity: 0; } }
.peb-leaf { position: absolute; left: 0; top: 0; color: var(--peb-green); will-change: transform; }
.peb-field.orange { background: color-mix(in srgb, var(--peb-orange) 11%, var(--fill)); }
.peb-field.orange .peb-leaf { color: var(--peb-orange); }
.peb-leaf svg { display: block; width: 100%; height: 100%; }
.peb-pad { display: grid; grid-template-columns: repeat(3, 56px); grid-template-rows: repeat(2, 44px); gap: 6px; justify-content: center; margin-top: 12px; }
.peb-pad button { display: grid; place-items: center; padding: 0; border: 0; border-radius: 12px; background: var(--fill); color: var(--t1); cursor: pointer; touch-action: manipulation; transition: background 120ms ease; }
.peb-pad button:active { background: var(--rule); }
.peb-pad svg { width: 18px; height: 18px; }
.peb-pad svg path { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.peb-pad .b0 { grid-area: 1 / 2; } .peb-pad .b1 { grid-area: 2 / 3; } .peb-pad .b2 { grid-area: 2 / 2; } .peb-pad .b3 { grid-area: 2 / 1; }
.peb-pad .b1 svg { transform: rotate(90deg); } .peb-pad .b2 svg { transform: rotate(180deg); } .peb-pad .b3 svg { transform: rotate(-90deg); }
.peb-hint { margin-top: 10px; text-align: center; color: var(--t3); }
.peb-hint .g { color: var(--peb-green); } .peb-hint .o { color: var(--peb-orange); }
.peb-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@media (max-width: 520px) {
  .peb-panel { padding: 18px; }
  .peb-field { height: 250px; }
  .peb-pad { grid-template-columns: repeat(3, 72px); grid-template-rows: repeat(2, 48px); }
}
`;

function useCss() {
  let s = document.getElementById(CSS_ID);
  if (!s) {
    s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  s.dataset.users = String(Number(s.dataset.users || 0) + 1);
  return function release() {
    const t = document.getElementById(CSS_ID);
    if (!t) return;
    const n = Number(t.dataset.users || 1) - 1;
    if (n <= 0) t.remove();
    else t.dataset.users = String(n);
  };
}

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function save(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
const fmt = (n) => Number(n).toLocaleString('en-US');
const rnd = (n) => Math.floor(Math.random() * n);
const mod = (a, n) => ((a % n) + n) % n;
const flip = (c) => (c === 'green' ? 'orange' : 'green');

// The next set of leaves. lvl runs 0..1: more leaves, faster drift, more colour
// switches, and more often the point and move directions disagree.
// force: { color, conflict } pins either for the tutorial.
function nextTrial(prev, lvl, force) {
  force = force || {};
  const n = 3 + Math.round(lvl * 6);
  const speed = 34 + lvl * 76;
  for (;;) {
    const color = force.color || (prev ? (Math.random() < 0.25 + 0.35 * lvl ? flip(prev.color) : prev.color) : (rnd(2) ? 'green' : 'orange'));
    const point = rnd(4);
    const conflict = force.conflict != null ? force.conflict : Math.random() < 0.3 + 0.55 * lvl;
    const move = conflict ? (point + 1 + rnd(3)) % 4 : point;
    // Something has to visibly change from the last set.
    if (!prev || color !== prev.color || point !== prev.point || move !== prev.move) return { color, point, move, n, speed };
  }
}
const want = (t) => (t.color === 'green' ? t.point : t.move);

export function mount(el) {
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const release = useCss();
  const root = h('div', 'peb');
  let david; // undefined while loading, null if he hasn't played
  let mine = Number(load(KEY)) || 0;
  let stage = null;
  let onAnswer = null;
  let tick = null;
  let raf = 0;
  let last = 0;
  let lockUntil = 0;
  let flashT = 0;
  let davidLine = null;

  const davidText = (line) => {
    line.textContent = '';
    if (david === undefined) line.textContent = "David's best: ...";
    else if (david === null) line.textContent = "David hasn't set a score yet";
    else line.append("David's best: ", h('b', '', fmt(david)));
  };

  fetch('/hobbies/lumosity/best.json', sig)
    .then((r) => r.json())
    .then((d) => { david = d && typeof d.ebbflow === 'number' ? d.ebbflow : null; })
    .catch(() => { david = null; })
    .then(() => { if (!ac.signal.aborted && davidLine) davidText(davidLine); });

  function show(node) {
    cancelAnimationFrame(raf);
    raf = 0;
    onAnswer = null;
    tick = null;
    stage = null;
    davidLine = null;
    root.textContent = '';
    root.appendChild(node);
  }

  function lines(rows) {
    const box = h('div', 'peb-lines');
    for (const r of rows) box.appendChild(r);
    return box;
  }
  function line(label, value, cls) {
    const p = h('p', cls);
    if (value == null) p.textContent = label;
    else p.append(label + ': ', h('b', '', value));
    return p;
  }
  function header(what) {
    const head = h('div', 'peb-head');
    const t = h('div');
    t.append(h('p', 'peb-name', 'Ebb and Flow'), h('p', 'peb-what', what));
    const art = h('div', 'peb-art');
    art.innerHTML = LEAF.replace('<svg', '<svg class="g"') + LEAF.replace('<svg', '<svg class="o"');
    head.append(t, art);
    return head;
  }
  function button(cls, text, fn) {
    const b = h('button', cls, text);
    b.type = 'button';
    b.addEventListener('click', fn, sig);
    return b;
  }

  // ---- Card ----
  function card() {
    const panel = h('div', 'peb-panel');
    davidLine = h('p');
    davidText(davidLine);
    const btns = h('div', 'peb-btns');
    const tutDone = load(TUT_KEY) === '1';
    btns.appendChild(button('peb-go', 'Play', () => (tutDone ? play() : tutorial())));
    if (tutDone) btns.appendChild(button('peb-link', 'How to play', tutorial));
    panel.append(
      header('Trains task switching: the colour of the leaves decides which rule you follow.'),
      lines([davidLine, line('Your best', mine ? fmt(mine) : 'not set yet')]),
      btns
    );
    const keep = davidLine;
    // The Lumosity page lays the three cards out in a row (styles.css .lumo-games).
    panel.dataset.lumoCard = '';
    show(panel);
    davidLine = keep;
  }

  // ---- The field, arrow pad and swipes, shared by the tutorial and play ----
  function buildStage(top, hint) {
    const wrap = h('div', 'peb-stage');
    const field = h('div', 'peb-field live');
    field.setAttribute('role', 'img');
    const layer = h('div', 'peb-leaves');
    const sr = h('p', 'peb-sr');
    sr.setAttribute('aria-live', 'polite');
    field.appendChild(layer);
    const pad = h('div', 'peb-pad');
    DIRS.forEach((name, i) => {
      const b = button('b' + i, null, () => answer(i));
      b.setAttribute('aria-label', name);
      b.innerHTML = ARROW;
      pad.appendChild(b);
    });
    // A swipe on the field answers too.
    let sx = 0, sy = 0, sid = null;
    field.addEventListener('pointerdown', (e) => { sid = e.pointerId; sx = e.clientX; sy = e.clientY; }, sig);
    field.addEventListener('pointerup', (e) => {
      if (e.pointerId !== sid) return;
      sid = null;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      answer(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
    }, sig);
    field.addEventListener('pointercancel', () => { sid = null; }, sig);
    wrap.append(top, field, pad, sr);
    if (hint) {
      const p = h('p', 'peb-hint');
      p.append(h('span', 'g', 'Green'), ': where they point. ', h('span', 'o', 'Orange'), ': where they go.');
      wrap.appendChild(p);
    }
    show(wrap);
    // On a phone the field can start below the fold.
    const r = wrap.getBoundingClientRect();
    if (r.bottom > innerHeight || r.top < 0) wrap.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
    stage = { field, layer, sr, leaves: [], trial: null, W: 0, H: 0, S: 32, rot: 0 };
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function measure() {
    const r = stage.field.getBoundingClientRect();
    stage.W = r.width;
    stage.H = r.height;
  }

  // Leaves sit in a jittered grid and wrap around the field's edges as one
  // group, so they never overlap. Coordinates run on a torus one leaf bigger
  // than the field; a leaf at x is drawn at x - S.
  function setTrial(t, note) {
    const st = stage;
    st.trial = t;
    measure();
    const S = st.S = st.W < 420 ? 36 : 46;
    const cell = S * 1.9;
    const cols = Math.max(1, Math.floor((st.W - S) / cell));
    const rows = Math.max(1, Math.floor((st.H - S) / cell));
    const cells = [...Array(cols * rows).keys()].sort(() => Math.random() - 0.5).slice(0, t.n);
    while (st.leaves.length < cells.length) {
      const n = h('div', 'peb-leaf');
      n.innerHTML = LEAF;
      st.layer.appendChild(n);
      st.leaves.push({ n, x: 0, y: 0 });
    }
    while (st.leaves.length > cells.length) st.leaves.pop().n.remove();
    const ox = (st.W - cols * cell) / 2, oy = (st.H - rows * cell) / 2;
    cells.forEach((c, i) => {
      const lf = st.leaves[i];
      lf.x = S + ox + (c % cols) * cell + Math.random() * (cell - S);
      lf.y = S + oy + Math.floor(c / cols) * cell + Math.random() * (cell - S);
      lf.n.style.width = lf.n.style.height = S + 'px';
    });
    st.rot = ROT[t.point];
    st.field.classList.toggle('orange', t.color === 'orange');
    const desc = `${t.color === 'green' ? 'Green' : 'Orange'} leaves pointing ${DIRS[t.point]}, moving ${DIRS[t.move]}`;
    st.field.setAttribute('aria-label', desc);
    st.sr.textContent = (note ? note + '. ' : '') + desc;
    st.layer.classList.remove('in');
    void st.layer.offsetWidth;
    st.layer.classList.add('in');
    paint();
  }

  function paint() {
    const { leaves, S, rot } = stage;
    for (const lf of leaves) lf.n.style.transform = `translate3d(${(lf.x - S).toFixed(1)}px, ${(lf.y - S).toFixed(1)}px, 0) rotate(${rot}deg)`;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    // Capped so a hidden tab (no frames) pauses the clock instead of skipping it.
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (stage && stage.trial) {
      const t = stage.trial, v = VEC[t.move];
      // Reduced motion: a slow, steady drift.
      const d = (reduce.matches ? Math.max(16, t.speed * 0.4) : t.speed) * dt;
      const TW = stage.W + stage.S, TH = stage.H + stage.S;
      for (const lf of stage.leaves) { lf.x = mod(lf.x + v[0] * d, TW); lf.y = mod(lf.y + v[1] * d, TH); }
      paint();
    }
    if (tick) tick(dt);
  }

  function answer(dir) {
    const now = performance.now();
    if (!onAnswer || !stage || now < lockUntil) return;
    lockUntil = now + 110;
    onAnswer(dir);
  }

  function flash(kind) {
    const f = stage.field;
    f.classList.remove('ok', 'no');
    void f.offsetWidth;
    f.classList.add(kind);
    clearTimeout(flashT);
    flashT = setTimeout(() => f.classList.remove(kind), 170);
  }

  // ---- Tutorial: one green trial, one orange, then three mixed ----
  const STEPS = [
    { say: 'Green leaves: answer the way they point.', color: 'green', need: 1 },
    { say: 'Orange leaves: answer the way they move.', color: 'orange', need: 1 },
    { say: 'Now mixed. Get three right.', need: 3 }
  ];
  function tutorial() {
    let i = 0, got = 0;
    const top = h('div', 'peb-bar');
    const say = h('span', 'say');
    const end = h('span', 'end');
    const step = h('span');
    end.append(step, button('peb-link', 'Skip', () => { save(TUT_KEY, '1'); play(); }));
    top.append(say, end);
    buildStage(top, false);
    const trial = (prev) => {
      const st = STEPS[i];
      return nextTrial(prev, 0.15, { color: st.color || (rnd(2) ? 'green' : 'orange'), conflict: true });
    };
    const go = () => {
      const st = STEPS[i];
      step.textContent = `${i + 1} of ${STEPS.length}`;
      say.textContent = st.need > 1 && got ? `Mixed: ${got} of ${st.need}` : st.say;
      setTrial(trial(stage.trial));
    };
    onAnswer = (dir) => {
      const t = stage.trial;
      if (dir === want(t)) {
        flash('ok');
        if (++got >= STEPS[i].need) { i++; got = 0; }
        if (i >= STEPS.length) return ready();
        go();
      } else {
        flash('no');
        say.textContent = t.color === 'green' ? 'Not quite. Green: the way they point.' : 'Not quite. Orange: the way they move.';
        setTrial(nextTrial(t, 0.15, { color: t.color, conflict: true }), 'Not quite');
      }
    };
    go();
  }

  function ready() {
    save(TUT_KEY, '1');
    const panel = h('div', 'peb-panel');
    panel.append(
      header("That's the game."),
      lines([
        h('p', '', 'You get 45 seconds. Four right in a row raises your multiplier, up to x10. A miss lowers it by one.'),
        h('p', 'gap', 'Arrow keys, WASD, swipes or the buttons all work.')
      ]),
      button('peb-go', 'Start', play)
    );
    show(panel);
    panel.querySelector('.peb-go').focus({ preventScroll: true });
  }

  // ---- Play ----
  function play() {
    const s = { score: 0, mult: 1, meter: 0, right: 0, total: 0, left: SECONDS };
    const top = h('div', 'peb-bar');
    const time = h('b', '', String(SECONDS));
    const score = h('b', '', '0');
    const meter = h('span', 'peb-meter');
    for (let k = 0; k < 4; k++) meter.appendChild(h('i'));
    const x = h('b', 'peb-x', 'x1');
    const end = h('span', 'end');
    const quit = button('peb-quit', null, card);
    quit.setAttribute('aria-label', 'Quit');
    quit.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    end.append(meter, x, quit);
    const tSpan = h('span');
    tSpan.append(time, ' s');
    const sSpan = h('span');
    sSpan.append('Score ', score);
    top.append(tSpan, sSpan, end);
    meter.setAttribute('aria-hidden', 'true');
    buildStage(top, true);
    setTrial(nextTrial(null, 0));

    const draw = () => {
      score.textContent = fmt(s.score);
      x.textContent = 'x' + s.mult;
      [...meter.children].forEach((d, k) => d.classList.toggle('on', k < s.meter));
    };
    tick = (dt) => {
      s.left -= dt;
      time.textContent = String(Math.max(0, Math.ceil(s.left)));
      if (s.left <= 0) finish(s);
    };
    onAnswer = (dir) => {
      const t = stage.trial;
      const ok = dir === want(t);
      s.total++;
      if (ok) {
        s.right++;
        s.score += 50 * s.mult;
        if (++s.meter >= 4) { s.meter = 0; s.mult = Math.min(10, s.mult + 1); }
        flash('ok');
      } else {
        s.meter = 0;
        s.mult = Math.max(1, s.mult - 1);
        flash('no');
      }
      draw();
      setTrial(nextTrial(t, Math.min(1, s.right / 28)), ok ? 'Right' : 'Wrong');
    };
  }

  function finish(s) {
    const beatMine = s.score > mine;
    if (beatMine) { mine = s.score; save(KEY, String(mine)); }
    const d = david === undefined ? null : david;
    window.dispatchEvent(new CustomEvent('dl:lumo', { detail: { game: 'ebbflow', score: s.score, best: mine, david: d } }));
    const panel = h('div', 'peb-panel');
    const dl = h('p');
    davidText(dl);
    const rows = [line('Score', fmt(s.score)), line('Correct', `${s.right} of ${s.total}`), line('Your best', fmt(mine)), dl];
    if (d != null && s.score > d) rows.push(h('p', 'say', 'You beat David.'));
    else if (beatMine && s.score > 0) rows.push(h('p', 'say', 'New personal best.'));
    panel.append(header("Time's up."), lines(rows), button('peb-go', 'Play again', play));
    show(panel);
    panel.querySelector('.peb-go').focus({ preventScroll: true });
  }

  // Arrow keys and WASD, only while leaves are on screen.
  window.addEventListener('keydown', (e) => {
    if (!onAnswer || e.metaKey || e.ctrlKey || e.altKey) return;
    const tg = e.target;
    if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
    const d = KEYS[e.key];
    if (d == null) return;
    e.preventDefault();
    if (!e.repeat) answer(d);
  }, sig);
  window.addEventListener('resize', () => { if (stage) measure(); }, sig);

  const note = el.querySelector('.piece-note');
  if (note) note.remove();
  el.appendChild(root);
  card();

  return function stop() {
    ac.abort();
    cancelAnimationFrame(raf);
    clearTimeout(flashT);
    onAnswer = null;
    tick = null;
    root.remove();
    release();
  };
}
