// Flip card piece: a watercolor on the front, its poem on the back.
//   <div class="play" data-play="flipcard" data-src="/hobbies/watercolor/pieces.json">
//   pieces.json: { "pieces": [ { "image", "alt", "title", "poem", "date" } ] }
// Click, tap, Enter or Space flips the card. With more than one piece there's
// prev / next (and the arrow keys). Reduced motion crossfades instead of turning.

const CSS_ID = 'play-flipcard-css';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CSS = `
.pflip { --ar: 0.8; }
.pflip-wrap { width: min(100%, 760px, calc(66vh * var(--ar))); width: min(100%, 760px, calc(66svh * var(--ar))); min-width: min(100%, 300px); margin: 0 auto; }
.pflip-card { position: relative; perspective: 1800px; }
.pflip-inner { display: grid; transform-style: preserve-3d; transition: transform 760ms cubic-bezier(.3, .7, .2, 1); }
.pflip-card.flipped .pflip-inner { transform: rotateY(180deg); }
.pflip-face {
  grid-area: 1 / 1;
  display: flex; align-items: center; justify-content: center;
  border-radius: 16px;
  overflow: hidden;
  -webkit-backface-visibility: hidden;
  backface-visibility: hidden;
  box-shadow: inset 0 0 0 1px var(--rule);
}
.pflip-front { background: var(--fill); }
.pflip-front img { width: 100%; height: auto; aspect-ratio: var(--ar); object-fit: contain; opacity: 0; transition: opacity 320ms ease; }
.pflip-front img.in { opacity: 1; }
.pflip-front .pflip-alt { padding: 24px; color: var(--t3); text-align: center; }
.pflip-back {
  transform: rotateY(180deg);
  padding: clamp(28px, 7%, 56px) clamp(24px, 8%, 64px);
  background: linear-gradient(var(--fill), var(--fill)), var(--bg);
}
.pflip-poem { max-width: 30em; }
.pflip-ptitle { margin-bottom: 1.1em; color: var(--t1); font-weight: 500; }
.pflip-lines { color: var(--t1); line-height: 1.9; text-wrap: pretty; hanging-punctuation: first; }
.pflip-line { display: block; padding-left: 1.4em; text-indent: -1.4em; white-space: pre-wrap; overflow-wrap: break-word; }
.pflip-gap { display: block; height: 0.95em; }
.pflip-sign { margin-top: 1.4em; color: var(--t3); }
.pflip-hit { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; padding: 0; border: 0; border-radius: 16px; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; }
.pflip-hit:focus-visible { border-radius: 16px; outline: 2px solid #88c0d0; outline-offset: 4px; }

.pflip.rm .pflip-inner, .pflip.rm .pflip-card.flipped .pflip-inner { transform: none; transition: none; }
.pflip.rm .pflip-back { transform: none; opacity: 0; }
.pflip.rm .pflip-card.flipped .pflip-back { opacity: 1; }
.pflip.rm .pflip-card.flipped .pflip-front { opacity: 0; }

.pflip-foot { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px 16px; padding: 14px 2px 0; }
.pflip-info { min-width: 0; }
.pflip-title { color: var(--t1); }
.pflip-sub { color: var(--t3); }
.pflip-hint .touch { display: none; }
@media (hover: none) { .pflip-hint .mouse { display: none; } .pflip-hint .touch { display: inline; } }
.pflip-nav { flex: none; display: flex; align-items: center; gap: 6px; color: var(--t3); }
.pflip-count { min-width: 3.6em; text-align: center; }
.pflip-btn { display: grid; place-items: center; width: 36px; height: 36px; padding: 0; border: 0; border-radius: 50%; background: var(--fill); color: var(--t1); cursor: pointer; }
.pflip-btn:hover { background: var(--rule); }
.pflip-btn:focus-visible { border-radius: 50%; }
.pflip-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }

.pflip-empty { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 14px; background: var(--fill); color: var(--t2); }
.pflip-empty svg { flex: none; width: 22px; height: 22px; fill: none; stroke: var(--t3); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.pflip-loading { width: min(100%, 420px); aspect-ratio: 4 / 5; margin: 0 auto; border-radius: 16px; background: var(--fill); }
@media (max-width: 720px) {
  .pflip-face, .pflip-hit, .pflip-hit:focus-visible { border-radius: 14px; }
}
`;

function useCss(id, css) {
  let s = document.getElementById(id);
  if (!s) {
    s = document.createElement('style');
    s.id = id;
    s.textContent = css;
    document.head.appendChild(s);
  }
  s.dataset.users = String(Number(s.dataset.users || 0) + 1);
  let done = false;
  return function release() {
    if (done) return;
    done = true;
    const t = document.getElementById(id);
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
function icon(d) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', d);
  svg.appendChild(p);
  return svg;
}
const ICON = {
  card: 'M6.5 3.5h11A1.5 1.5 0 0 1 19 5v14a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V5a1.5 1.5 0 0 1 1.5-1.5zM8.5 15.5c1.5-2.2 2.8-3.3 4-3.3s2 .8 3 2.3M9 8h.01',
  prev: 'M14.5 6l-6 6 6 6',
  next: 'M9.5 6l6 6-6 6'
};

function fmtDate(s) {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(s).trim());
  const mon = m && MONTHS[Number(m[2]) - 1];
  if (!mon) return String(s);
  return m[3] ? mon + ' ' + Number(m[3]) + ', ' + m[1] : mon + ' ' + m[1];
}
function noteText(el, fallback) {
  const n = el.querySelector('.piece-note');
  const t = n ? n.textContent.trim() : '';
  return t && !/^loading/i.test(t) ? t : fallback;
}

export function mount(el) {
  const release = useCss(CSS_ID, CSS);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const emptyNote = noteText(el, 'Paintings and poems coming soon.');
  const root = h('div', 'pflip');
  root.appendChild(h('div', 'pflip-loading'));
  el.appendChild(root);

  let alive = true;
  let pieces = [];
  let at = 0;
  let flipped = false;
  let ui = null;
  const ctrl = new AbortController();
  const anims = new Set();

  function fade(node, from, to, ms) {
    if (!node.animate) return;
    const a = node.animate([{ opacity: from }, { opacity: to }], { duration: ms, easing: 'ease' });
    anims.add(a);
    a.onfinish = a.oncancel = () => anims.delete(a);
  }

  function syncMotion() { root.classList.toggle('rm', reduce.matches); }
  syncMotion();
  reduce.addEventListener('change', syncMotion);

  function build() {
    root.textContent = '';
    const wrap = h('div', 'pflip-wrap');
    const card = h('div', 'pflip-card');
    const inner = h('div', 'pflip-inner');
    const front = h('div', 'pflip-face pflip-front');
    const back = h('div', 'pflip-face pflip-back');
    inner.append(front, back);
    const hit = h('button', 'pflip-hit');
    hit.type = 'button';
    card.append(inner, hit);

    const foot = h('div', 'pflip-foot');
    const info = h('div', 'pflip-info');
    const title = h('p', 'pflip-title');
    const sub = h('p', 'pflip-sub');
    info.append(title, sub);
    foot.appendChild(info);
    let count = null;
    if (pieces.length > 1) {
      const nav = h('div', 'pflip-nav');
      const prev = h('button', 'pflip-btn');
      prev.type = 'button';
      prev.setAttribute('aria-label', 'Previous piece');
      prev.appendChild(icon(ICON.prev));
      const next = h('button', 'pflip-btn');
      next.type = 'button';
      next.setAttribute('aria-label', 'Next piece');
      next.appendChild(icon(ICON.next));
      count = h('span', 'pflip-count');
      count.setAttribute('aria-live', 'polite');
      nav.append(prev, count, next);
      foot.appendChild(nav);
      prev.addEventListener('click', () => go(-1));
      next.addEventListener('click', () => go(1));
    }
    wrap.append(card, foot);
    root.appendChild(wrap);

    hit.addEventListener('click', flip);
    root.addEventListener('keydown', onKey);
    ui = { wrap, card, inner, front, back, hit, title, sub, count };
  }

  function hintFor(isFlipped) {
    const s = h('span', 'pflip-hint');
    const mouse = h('span', 'mouse', isFlipped ? 'click for the painting again' : 'click to flip it over');
    const touch = h('span', 'touch', isFlipped ? 'tap for the painting again' : 'tap to flip it over');
    s.append(mouse, touch);
    return s;
  }

  function fill() {
    const p = pieces[at];
    const { wrap, front, back, title, sub, count } = ui;
    root.style.setProperty('--ar', '0.8');

    front.textContent = '';
    const img = h('img');
    img.decoding = 'async';
    img.alt = p.alt || p.title || 'Watercolor painting';
    img.addEventListener('load', () => {
      if (img.naturalWidth && img.naturalHeight) {
        const r = Math.min(2, Math.max(0.5, img.naturalWidth / img.naturalHeight));
        root.style.setProperty('--ar', String(r));
      }
      img.classList.add('in');
    });
    img.addEventListener('error', () => {
      front.textContent = '';
      front.appendChild(h('p', 'pflip-alt', img.alt));
    });
    img.src = p.image;
    front.appendChild(img);

    back.textContent = '';
    const poem = h('div', 'pflip-poem');
    if (p.title) poem.appendChild(h('p', 'pflip-ptitle', p.title));
    const lines = h('p', 'pflip-lines');
    String(p.poem).replace(/\r\n?/g, '\n').replace(/^\s*\n|\n\s*$/g, '').split('\n').forEach((line) => {
      if (line.trim()) lines.appendChild(h('span', 'pflip-line', line.replace(/\s+$/, '')));
      else if (lines.lastChild && !lines.lastChild.classList.contains('pflip-gap')) lines.appendChild(h('span', 'pflip-gap'));
    });
    poem.appendChild(lines);
    const date = fmtDate(p.date);
    if (date) poem.appendChild(h('p', 'pflip-sign', date));
    back.appendChild(poem);

    title.textContent = p.title || '';
    title.hidden = !p.title;
    if (count) count.textContent = (at + 1) + ' / ' + pieces.length;
    wrap.dataset.date = date;
    setFlipped(false, true);

    // Warm the neighbours.
    if (pieces.length > 1) [1, -1].forEach((d) => { new Image().src = pieces[(at + d + pieces.length) % pieces.length].image; });
  }

  function setFlipped(on, instant) {
    const { card, inner, front, back, hit, sub, wrap } = ui;
    if (instant) {
      inner.style.transition = 'none';
      card.classList.toggle('flipped', on);
      void inner.offsetWidth;
      inner.style.transition = '';
    } else {
      card.classList.toggle('flipped', on);
    }
    flipped = on;
    front.setAttribute('aria-hidden', on ? 'true' : 'false');
    back.setAttribute('aria-hidden', on ? 'false' : 'true');
    hit.setAttribute('aria-label', on ? 'Flip back to the painting' : 'Flip it over to read the poem');
    sub.textContent = '';
    const date = wrap.dataset.date;
    if (date) sub.append(date, ' · ');
    sub.appendChild(hintFor(on));
  }

  function flip() {
    if (!ui) return;
    const on = !flipped;
    setFlipped(on, false);
    if (reduce.matches) {
      fade(ui.back, on ? 0 : 1, on ? 1 : 0, 280);
      fade(ui.front, on ? 1 : 0, on ? 0 : 1, 280);
    }
  }

  function go(d) {
    if (!ui || pieces.length < 2) return;
    at = (at + d + pieces.length) % pieces.length;
    fill();
    fade(ui.card, 0, 1, reduce.matches ? 200 : 320);
  }

  function onKey(e) {
    if (pieces.length < 2 || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  }

  function empty() {
    root.textContent = '';
    const box = h('div', 'pflip-empty');
    box.append(icon(ICON.card), h('span', null, emptyNote));
    root.appendChild(box);
  }

  const src = el.dataset.src;
  (src ? fetch(src, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : {})) : Promise.resolve({}))
    .catch(() => ({}))
    .then((data) => {
      if (!alive) return;
      const raw = data && Array.isArray(data.pieces) ? data.pieces : [];
      pieces = raw.filter((p) => p && typeof p.image === 'string' && p.image && p.poem);
      if (!pieces.length) return empty();
      build();
      fill();
    });

  return function stop() {
    alive = false;
    ctrl.abort();
    anims.forEach((a) => a.cancel());
    anims.clear();
    reduce.removeEventListener('change', syncMotion);
    root.removeEventListener('keydown', onKey);
    root.remove();
    ui = null;
    release();
  };
}
