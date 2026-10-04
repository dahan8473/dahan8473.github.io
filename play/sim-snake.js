// Snake and commits, live. A mini version of the GitHub Action: a random
// contribution graph, and a snake that eats every commit cell.
//   import('/play/sim-snake.js').then(m => stop = m.mount(el))
// Same rules as generate.py: BFS from the head to the nearest commit, and a
// step is only taken if the tail is still reachable after it, so it never
// traps itself. Boxed in, it chases its tail.

const CSS_ID = 'sim-snake-css';
const ROWS = 7;
const BASE = 3; // starting length
const CAP = 18; // max length, so it grows a little
const PER = 3; // grows one segment every PER cells eaten
const ACC = '#88c0d0';
const PAL = {
  dark: { lv: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'], head: '#b7ffd0', body: [[183, 255, 208], [0, 109, 50]] },
  light: { lv: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'], head: '#1f2328', body: [[52, 58, 64], [168, 176, 172]] }
};

const CSS = `
.psnk { padding: 12px; border-radius: 12px; background: var(--fill); box-shadow: inset 0 0 0 1px var(--rule); }
.psnk canvas { display: block; width: 100%; cursor: crosshair; touch-action: manipulation; }
.psnk-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; margin-top: 10px; }
.psnk-bar button { padding: 6px 11px; border: 0; border-radius: 8px; background: var(--fill); box-shadow: inset 0 0 0 1px var(--rule); color: var(--t1); font: inherit; font-size: 13px; line-height: 1; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.psnk-bar button:hover { background: var(--rule); }
.psnk-bar button[aria-pressed="true"] { box-shadow: inset 0 0 0 1px ${ACC}; color: var(--t1); }
.psnk-n { margin-left: auto; color: var(--t3); font-size: 13px; font-variant-numeric: tabular-nums; white-space: nowrap; }
`;

// The game, no DOM. Cells are indexes c * ROWS + r.
export class Game {
  constructor(cols, rand = Math.random) {
    this.cols = cols;
    this.n = cols * ROWS;
    this.lv = new Uint8Array(this.n);
    for (let i = 0; i < this.n; i++) {
      if (rand() < 0.36) { const x = rand(); this.lv[i] = x < 0.45 ? 1 : x < 0.75 ? 2 : x < 0.9 ? 3 : 4; }
    }
    const start = 3; // column 0, middle row
    this.body = [start];
    this.occ = new Uint8Array(this.n);
    this.occ[start] = 1;
    this.grow = BASE - 1;
    this.eaten = 0;
    this.total = this.lv.reduce((a, v) => a + (v > 0), 0);
    this.steps = 0;
    this.plan = [];
    this.seen = []; // last BFS visit order, for drawing
    this.stuck = 0;
    this.dead = false;
    if (this.lv[start]) this.eat(start);
  }
  get head() { return this.body[this.body.length - 1]; }
  get left() { return this.total - this.eaten; }
  nb(i) {
    const c = (i / ROWS) | 0, r = i % ROWS, out = [];
    if (c + 1 < this.cols) out.push(i + ROWS);
    if (c > 0) out.push(i - ROWS);
    if (r + 1 < ROWS) out.push(i + 1);
    if (r > 0) out.push(i - 1);
    return out;
  }
  // BFS from s until goal(i) is true, never through blocked cells. Returns the path or null.
  bfs(s, goal, blocked, log) {
    const prev = new Int32Array(this.n).fill(-1);
    prev[s] = s;
    const q = [s];
    for (let k = 0; k < q.length; k++) {
      const cur = q[k];
      if (log) log.push(cur);
      for (const x of this.nb(cur)) {
        if (prev[x] !== -1) continue;
        const g = goal(x);
        if (!g && blocked[x]) continue;
        prev[x] = cur;
        if (g) {
          const p = [x];
          for (let y = cur; y !== s; y = prev[y]) p.push(y);
          p.push(s);
          return p.reverse();
        }
        q.push(x);
      }
    }
    return null;
  }
  eat(i) {
    this.lv[i] = 0;
    this.eaten++;
    this.stuck = 0;
    if (this.eaten % PER === 0 && this.body.length + this.grow < CAP) this.grow++;
  }
  willGrow(i) {
    return this.grow > 0 || (this.lv[i] > 0 && (this.eaten + 1) % PER === 0 && this.body.length + this.grow < CAP);
  }
  // Can the head enter i this step? The tail cell frees up unless growing.
  free(i) { return !this.occ[i] || (i === this.body[0] && !this.willGrow(i) && this.body.length > 1); }
  // generate.py's safety rule: after moving to i, the new tail must still be reachable from i.
  safe(i) {
    if (this.body.length < 3) return true;
    const b = this.body.slice();
    const occ = this.occ.slice();
    if (!this.willGrow(i)) occ[b.shift()] = 0;
    b.push(i);
    occ[i] = 1;
    const t = b[0];
    occ[t] = 0;
    return !!this.bfs(i, (x) => x === t, occ);
  }
  move(i) {
    if (this.lv[i]) this.eat(i);
    if (this.grow > 0) this.grow--;
    else this.occ[this.body.shift()] = 0;
    this.body.push(i);
    this.occ[i] = 1;
    this.steps++;
    this.stuck++;
  }
  // One tick: follow the plan if it's still safe, else replan, else chase the tail.
  step() {
    if (this.dead || !this.left) return false;
    if (!this.plan.length) {
      this.seen = [];
      const p = this.bfs(this.head, (x) => this.lv[x] > 0 && !this.occ[x], this.occ, this.seen);
      this.plan = p ? p.slice(1) : [];
    }
    let nx = this.plan[0];
    if (nx !== undefined && this.free(nx) && this.safe(nx)) {
      this.plan.shift();
      this.move(nx);
      return true;
    }
    this.plan = [];
    const h = this.head, t = this.body[0];
    const occ = this.occ.slice();
    occ[t] = 0;
    const tp = this.bfs(h, (x) => x === t, occ);
    nx = tp && tp.length > 1 && tp[1] !== t && this.free(tp[1]) && this.safe(tp[1]) ? tp[1] : -1;
    if (nx < 0) {
      const opts = this.nb(h).filter((x) => this.free(x));
      const pool = opts.filter((x) => this.safe(x));
      const roomy = (x) => this.nb(x).filter((y) => !this.occ[y]).length;
      nx = (pool.length ? pool : opts).sort((a, b) => roomy(b) - roomy(a))[0] ?? -1;
    }
    if (nx < 0 || this.stuck > this.n * 4) { this.dead = true; return false; }
    this.move(nx);
    return true;
  }
  add(i) {
    if (this.lv[i] || this.occ[i]) return;
    this.lv[i] = 1 + ((Math.random() * 4) | 0);
    this.total++;
    this.plan = [];
  }
}

export function mount(el) {
  if (!document.getElementById(CSS_ID)) {
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.createElement('div');
  root.className = 'psnk';
  root.innerHTML =
    '<canvas aria-label="A snake eating a contribution graph. Click a cell to add a commit."></canvas>' +
    '<div class="psnk-bar"><button type="button" data-k="play">Play</button><button type="button" data-k="new">Restart</button>' +
    '<button type="button" data-k="speed" aria-pressed="false">1x</button><button type="button" data-k="bfs" aria-pressed="false">Show BFS</button>' +
    '<span class="psnk-n" aria-live="off"></span></div>';
  el.appendChild(root);
  const cv = root.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const btn = (k) => root.querySelector(`[data-k="${k}"]`);
  const count = root.querySelector('.psnk-n');

  let g = null, pitch = 14, cols = 0, ox = 0, w = 0;
  let playing = false, touched = false, visible = false, fast = false, showBfs = false;
  let raf = 0, last = 0, acc = 0, seenAt = 0, doneAt = 0, dirty = true;
  const interval = () => (reduce ? 240 : 110) / (fast ? 3 : 1);

  function layout() {
    w = root.clientWidth - 24;
    if (w <= 0) return;
    pitch = Math.max(15, Math.min(20, w / 52));
    const nc = Math.min(52, Math.floor(w / pitch));
    ox = (w - nc * pitch) / 2;
    const dpr = window.devicePixelRatio || 1;
    cv.style.height = ROWS * pitch + 'px';
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(ROWS * pitch * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (nc !== cols) { cols = nc; reset(); }
    dirty = true;
  }
  function reset() {
    g = new Game(cols);
    acc = 0; doneAt = 0; seenAt = 0;
    dirty = true;
    label();
  }
  function label() {
    btn('play').textContent = playing ? 'Pause' : 'Play';
    count.textContent = g ? `${g.eaten}/${g.total} eaten · ${g.steps} steps${!g.left ? ' · cleared' : ''}` : '';
  }
  const xy = (i) => [ox + ((i / ROWS) | 0) * pitch, (i % ROWS) * pitch];
  const mix = (a, b, t) => `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * t)).join(',')})`;

  function draw(now) {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    const P = dark ? PAL.dark : PAL.light;
    const cs = pitch * 0.78, gap = pitch - cs, rr = Math.min(3, cs * 0.22);
    ctx.clearRect(0, 0, w, ROWS * pitch);
    const sq = (i, col, inset = 0) => {
      const [x, y] = xy(i);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.roundRect(x + gap / 2 + inset, y + gap / 2 + inset, cs - inset * 2, cs - inset * 2, rr);
      ctx.fill();
    };
    for (let i = 0; i < g.n; i++) sq(i, P.lv[g.lv[i]]);
    if (showBfs) {
      // Explored frontier fades out; the planned path stays until walked.
      const f = Math.max(0, 1 - (now - seenAt) / 900);
      if (f > 0) {
        ctx.globalAlpha = 0.45 * f;
        for (const i of g.seen) sq(i, ACC);
      }
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = ACC;
      ctx.lineWidth = Math.max(1.5, pitch * 0.12);
      ctx.lineCap = ctx.lineJoin = 'round';
      ctx.beginPath();
      [g.head, ...g.plan].forEach((i, k) => { const [x, y] = xy(i); ctx[k ? 'lineTo' : 'moveTo'](x + pitch / 2, y + pitch / 2); });
      ctx.stroke();
      const end = g.plan[g.plan.length - 1];
      if (end !== undefined) { const [x, y] = xy(end); ctx.strokeRect(x + gap / 2 - 1, y + gap / 2 - 1, cs + 2, cs + 2); }
      ctx.globalAlpha = 1;
    }
    // Snake: joined segments, bright head fading to a dim tail.
    const b = g.body, L = b.length;
    for (let k = 0; k < L; k++) {
      const col = k === L - 1 ? P.head : mix(P.body[0], P.body[1], 1 - k / Math.max(1, L - 1));
      sq(b[k], col, -0.5);
      if (k > 0) {
        const [x0, y0] = xy(b[k - 1]), [x1, y1] = xy(b[k]);
        ctx.fillStyle = col;
        ctx.fillRect(Math.min(x0, x1) + gap / 2 + cs * 0.2, Math.min(y0, y1) + gap / 2 + cs * 0.2, Math.abs(x1 - x0) + cs * 0.6, Math.abs(y1 - y0) + cs * 0.6);
      }
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(250, now - (last || now));
    last = now;
    if (!visible) return;
    if (playing && g) {
      if (!g.left || g.dead) {
        doneAt = doneAt || now;
        if (now - doneAt > 2200) reset();
      } else {
        acc += dt;
        const iv = interval();
        let moved = false;
        while (acc >= iv) {
          acc -= iv;
          const fresh = !g.plan.length;
          if (!g.step()) break;
          if (fresh && g.seen.length) seenAt = now;
          moved = true;
        }
        if (moved) { dirty = true; label(); }
      }
    }
    if (g && (dirty || (showBfs && now - seenAt < 1000))) { draw(now); dirty = false; }
  }

  function setPlay(on) { playing = on; acc = 0; label(); }
  const onClick = (e) => {
    const k = e.target.closest('button')?.dataset.k;
    if (!k) return;
    touched = true;
    if (k === 'play') setPlay(!playing);
    else if (k === 'new') reset();
    else if (k === 'speed') { fast = !fast; e.target.textContent = fast ? '3x' : '1x'; e.target.setAttribute('aria-pressed', fast); }
    else if (k === 'bfs') { showBfs = !showBfs; e.target.setAttribute('aria-pressed', showBfs); seenAt = performance.now(); dirty = true; }
  };
  const onCanvas = (e) => {
    const r = cv.getBoundingClientRect();
    const c = Math.floor((e.clientX - r.left - ox) / pitch), row = Math.floor((e.clientY - r.top) / pitch);
    if (c < 0 || c >= cols || row < 0 || row >= ROWS) return;
    g.add(c * ROWS + row);
    doneAt = 0;
    dirty = true;
    label();
  };
  root.addEventListener('click', onClick);
  cv.addEventListener('click', onCanvas);

  const ro = new ResizeObserver(layout);
  ro.observe(root);
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) { dirty = true; if (!touched && !reduce && !playing) setPlay(true); }
  });
  io.observe(root);
  const mo = new MutationObserver(() => { dirty = true; });
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  layout();
  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    mo.disconnect();
    root.removeEventListener('click', onClick);
    cv.removeEventListener('click', onCanvas);
    root.remove();
    if (!document.querySelector('.psnk')) document.getElementById(CSS_ID)?.remove();
  };
}
