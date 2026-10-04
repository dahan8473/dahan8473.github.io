// Photo gallery piece: a masonry-ish grid with captions and a lightbox.
//   <div class="play" data-play="gallery" data-src="/hobbies/photography/photos.json">
//   photos.json: { "photos": [ { "src", "caption", "camera", "lens", "date", "alt" } ] }
// camera is "xt200" or "a7r2". A dl:camera event on document ({ detail: { id } },
// id null to clear) filters the grid to one camera.
// Also exports lightbox(), which the trophy case reuses.

const CSS_ID = 'play-gallery-css';
const LB_CSS_ID = 'play-lightbox-css';
const CAMERAS = {
  xt200: { short: 'X-T200', full: 'Fujifilm X-T200' },
  a7r2: { short: 'A7R II', full: 'Sony A7R II' }
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CSS = `
.pgal { scroll-margin-top: 24px; }
.pgal-bar { margin-bottom: 14px; }
.pgal-bar:empty { display: none; }
.pgal-chip { display: inline-flex; align-items: center; gap: 8px; max-width: 100%; padding: 4px 4px 4px 12px; border-radius: 999px; background: var(--fill); color: var(--t2); }
.pgal-chip::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: #88c0d0; }
.pgal-chip b { font-weight: 400; color: var(--t1); }
.pgal-chip .pgal-dot { color: var(--t3); }
.pgal-all { padding: 2px 10px; border: 0; border-radius: 999px; background: none; color: var(--t1); font: inherit; cursor: pointer; }
.pgal-all:hover { background: var(--fill); }
.pgal-all:focus-visible { border-radius: 999px; }
.pgal-cols { display: flex; align-items: flex-start; gap: 12px; }
.pgal-cols.one { max-width: 680px; }
.pgal-col { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 22px; }
.pgal-item { margin: 0; }
.pgal-open { display: block; width: 100%; padding: 0; border: 0; border-radius: 14px; background: var(--fill); overflow: hidden; cursor: zoom-in; }
.pgal-open:focus-visible { border-radius: 14px; outline-offset: 3px; }
.pgal-open img { width: 100%; height: auto; aspect-ratio: var(--ar, 4 / 3); object-fit: cover; opacity: 0; transition: opacity 320ms ease; }
.pgal-open img.in { opacity: 1; }
.pgal-open.broken { display: grid; place-items: center; aspect-ratio: 4 / 3; color: var(--t3); cursor: default; }
.pgal-open.broken img { display: none; }
.pgal-open.broken svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
@media (hover: hover) { .pgal-open:hover img.in { opacity: 0.9; } }
.pgal-item figcaption { padding: 8px 2px 0; }
.pgal-cap { display: block; color: var(--t2); }
.pgal-meta { display: block; color: var(--t3); }
.pgal-empty { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 14px; background: var(--fill); color: var(--t2); }
.pgal-empty svg { flex: none; width: 22px; height: 22px; fill: none; stroke: var(--t3); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.pgal-loading { height: 160px; border-radius: 14px; background: var(--fill); }
@media (max-width: 720px) {
  .pgal-cols { gap: 8px; }
  .pgal-col { gap: 16px; }
  .pgal-open, .pgal-open:focus-visible { border-radius: 12px; }
}
`;

const LB_CSS = `
.plb {
  position: fixed; inset: 0; z-index: 100;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr) 76px;
  grid-template-rows: auto minmax(0, 1fr) auto;
  grid-template-areas: "top top top" "prev stage next" "cap cap cap";
  background: rgba(251, 251, 253, 0.95);
  -webkit-backdrop-filter: blur(16px);
  backdrop-filter: blur(16px);
  color: var(--t1);
  overscroll-behavior: contain;
  opacity: 0;
  transition: opacity 200ms ease;
}
[data-theme="dark"] .plb { background: rgba(13, 13, 14, 0.95); }
.plb.on { opacity: 1; }
.plb [hidden] { display: none !important; }
.plb-top { grid-area: top; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: max(14px, env(safe-area-inset-top)) 16px 10px 24px; color: var(--t3); }
.plb-stage { grid-area: stage; position: relative; min-width: 0; min-height: 0; touch-action: pan-y pinch-zoom; }
.plb-stage img, .plb-stage video {
  position: absolute; inset: 0; margin: auto;
  max-width: 100%; max-height: 100%; width: auto; height: auto;
  border-radius: 12px;
  user-select: none; -webkit-user-select: none; -webkit-user-drag: none;
  transition: opacity 220ms ease, transform 260ms cubic-bezier(.2, .8, .2, 1);
}
.plb-btn { display: grid; place-items: center; width: 44px; height: 44px; padding: 0; border: 0; border-radius: 50%; background: var(--fill); color: var(--t1); cursor: pointer; }
.plb-btn:hover { background: var(--rule); }
.plb-btn:focus-visible { border-radius: 50%; }
.plb-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.plb-prev { grid-area: prev; place-self: center; }
.plb-next { grid-area: next; place-self: center; }
.plb-cap { grid-area: cap; min-height: 76px; padding: 14px 24px max(22px, env(safe-area-inset-bottom)); text-align: center; }
.plb-cap .c { color: var(--t1); }
.plb-cap .m { color: var(--t3); }
@media (max-width: 720px) {
  .plb { grid-template-columns: 60px minmax(0, 1fr) 60px; grid-template-areas: "top top top" "stage stage stage" "prev cap next"; }
  .plb-top { padding-left: 20px; padding-right: 12px; }
  .plb-stage { margin: 0 10px; }
  .plb-stage img, .plb-stage video { border-radius: 10px; }
  .plb-prev, .plb-next { align-self: start; margin-top: 14px; }
  .plb-cap { padding-left: 4px; padding-right: 4px; }
}
`;

// Style tags are shared by every instance (and every copy of this module), so
// the count lives on the tag itself. release() drops the tag with the last user.
export function useCss(id, css) {
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
  photo: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5zM3.5 16l5-5 4 4 2.5-2.5 5.5 5.5M15.5 9.5h.01',
  prev: 'M14.5 6l-6 6 6 6',
  next: 'M9.5 6l6 6-6 6',
  close: 'M6.5 6.5l11 11M17.5 6.5l-11 11'
};

export function fmtDate(s) {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(s).trim());
  const mon = m && MONTHS[Number(m[2]) - 1];
  if (!mon) return String(s);
  return m[3] ? mon + ' ' + Number(m[3]) + ', ' + m[1] : mon + ' ' + m[1];
}
function camName(id, full) {
  const c = CAMERAS[id];
  return c ? (full ? c.full : c.short) : String(id || '');
}
function noteText(el, fallback) {
  const n = el.querySelector('.piece-note');
  const t = n ? n.textContent.trim() : '';
  return t && !/^loading/i.test(t) ? t : fallback;
}

// ---- Lightbox ---------------------------------------------------------------
// lightbox(items, start, opener) opens a full-screen viewer appended to body.
// items: [{ src, alt, caption, meta }], or { video, poster, ... } for a clip. Arrows, Escape, swipe, focus trapped,
// focus goes back to opener. Returns close(restore): pass false from cleanup
// to tear it down at once without moving focus.
export function lightbox(items, start, opener) {
  const release = useCss(LB_CSS_ID, LB_CSS);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let at = Math.max(0, Math.min(items.length - 1, start | 0));
  let token = 0;
  let open = true;
  let fadeTimer = 0;

  const lb = h('div', 'plb');
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Photos');
  const top = h('div', 'plb-top');
  const count = h('span', 'plb-count');
  count.setAttribute('aria-live', 'polite');
  const x = h('button', 'plb-btn plb-x');
  x.type = 'button';
  x.setAttribute('aria-label', 'Close');
  x.appendChild(icon(ICON.close));
  top.append(count, x);
  const prev = h('button', 'plb-btn plb-prev');
  prev.type = 'button';
  prev.setAttribute('aria-label', 'Previous photo');
  prev.appendChild(icon(ICON.prev));
  const next = h('button', 'plb-btn plb-next');
  next.type = 'button';
  next.setAttribute('aria-label', 'Next photo');
  next.appendChild(icon(ICON.next));
  const stage = h('div', 'plb-stage');
  const img = h('img');
  img.decoding = 'async';
  img.draggable = false;
  const vid = h('video');
  vid.playsInline = true;
  vid.loop = true;
  vid.muted = true;
  vid.controls = true;
  vid.hidden = true;
  stage.append(img, vid);
  let cur = img;
  const cap = h('div', 'plb-cap');
  const c = h('p', 'c');
  const m = h('p', 'm');
  cap.append(c, m);
  lb.append(top, prev, stage, next, cap);

  function show(dir) {
    const p = items[at];
    const many = items.length > 1;
    prev.hidden = next.hidden = count.hidden = !many;
    count.textContent = (at + 1) + ' / ' + items.length;
    c.textContent = p.caption || '';
    c.hidden = !p.caption;
    m.textContent = p.meta || '';
    m.hidden = !p.meta;
    const t = ++token;
    cur = p.video ? vid : img;
    img.hidden = !!p.video;
    vid.hidden = !p.video;
    if (!p.video) { vid.pause(); vid.removeAttribute('src'); }
    cur.style.transition = 'none';
    cur.style.opacity = '0';
    cur.style.transform = reduce.matches ? '' : dir ? 'translateX(' + dir * 28 + 'px)' : 'scale(0.985)';
    const reveal = () => {
      if (t !== token || !open) return;
      void cur.offsetWidth;
      cur.style.transition = '';
      cur.style.opacity = '1';
      cur.style.transform = '';
    };
    if (p.video) {
      vid.setAttribute('aria-label', p.alt || p.caption || 'Clip');
      vid.poster = p.poster || '';
      vid.onloadeddata = reveal;
      vid.onerror = reveal;
      vid.src = p.video;
      vid.play().catch(() => {});
      if (p.poster) { const pi = new Image(); pi.onload = reveal; pi.src = p.poster; }
    } else {
      img.alt = p.alt || p.caption || '';
      img.onload = reveal;
      img.onerror = reveal;
      img.src = p.src;
      if (img.complete && img.naturalWidth) reveal();
    }
    // Warm the neighbours so arrowing feels instant.
    if (many) [1, -1].forEach((d) => { const n = items[(at + d + items.length) % items.length]; new Image().src = n.src || n.poster; });
  }
  function step(d) {
    if (!open || items.length < 2) return;
    at = (at + d + items.length) % items.length;
    show(d);
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    else if (e.key === 'Tab') {
      const f = [x, prev, next].filter((b) => !b.hidden);
      const first = f[0], last = f[f.length - 1];
      const inside = lb.contains(document.activeElement);
      if (e.shiftKey && (!inside || document.activeElement === first)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (!inside || document.activeElement === last)) { e.preventDefault(); first.focus(); }
    }
  }
  function onFocusIn(e) { if (!lb.contains(e.target)) x.focus({ preventScroll: true }); }

  // Swipe: follow the finger, change photo past a threshold.
  let pid = null, sx = 0, sy = 0, dx = 0;
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || !e.isPrimary || items.length < 2) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; dx = 0;
    cur.style.transition = 'none';
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pid) return;
    dx = e.clientX - sx;
    if (Math.abs(dx) > Math.abs(e.clientY - sy)) cur.style.transform = 'translateX(' + dx + 'px)';
  });
  const end = (e) => {
    if (e.pointerId !== pid) return;
    pid = null;
    cur.style.transition = '';
    if (e.type === 'pointerup' && Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(e.clientY - sy)) step(dx < 0 ? 1 : -1);
    else cur.style.transform = '';
  };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);

  x.addEventListener('click', () => close(true));
  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  lb.addEventListener('click', (e) => { if (!e.target.closest('button') && e.target !== img && e.target !== vid) close(true); });

  const prevOverflow = document.documentElement.style.overflow;
  document.documentElement.style.overflow = 'hidden';
  document.body.appendChild(lb);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('focusin', onFocusIn);
  show(0);
  void lb.offsetWidth;
  lb.classList.add('on');
  x.focus({ preventScroll: true });

  function finish() {
    vid.pause();
    vid.removeAttribute('src');
    clearTimeout(fadeTimer);
    fadeTimer = 0;
    lb.remove();
    release();
  }
  function close(restore) {
    if (!open) { if (fadeTimer && restore === false) finish(); return; }
    open = false;
    token++;
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onFocusIn);
    document.documentElement.style.overflow = prevOverflow;
    if (restore && !reduce.matches) {
      lb.classList.remove('on');
      fadeTimer = setTimeout(finish, 220);
    } else {
      finish();
    }
    if (restore && opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }
  return close;
}

// ---- Gallery ----------------------------------------------------------------
export function mount(el) {
  const release = useCss(CSS_ID, CSS);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const emptyNote = noteText(el, 'Digging out photos rn.');
  const root = h('div', 'pgal');
  const bar = h('div', 'pgal-bar');
  bar.setAttribute('role', 'status');
  const body = h('div');
  body.appendChild(h('div', 'pgal-loading'));
  root.append(bar, body);
  el.appendChild(root);

  let alive = true;
  let photos = [];
  let loaded = false;
  let camera = null;
  let shown = [];
  let cols = 0;
  let closeLb = null;
  const figs = new Map();
  const ctrl = new AbortController();

  function columnsFor(width, n) {
    const c = width < 340 ? 1 : width < 640 ? 2 : 3;
    return Math.max(1, Math.min(c, n));
  }

  function figure(p, i) {
    if (figs.has(i)) return figs.get(i);
    const fig = h('figure', 'pgal-item');
    const btn = h('button', 'pgal-open');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Open ' + (p.alt || p.caption || 'photo ' + (i + 1)));
    const img = h('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = p.alt || p.caption || '';
    img.addEventListener('load', () => {
      if (img.naturalWidth && img.naturalHeight) img.style.setProperty('--ar', img.naturalWidth + ' / ' + img.naturalHeight);
      img.classList.add('in');
    });
    img.addEventListener('error', () => {
      if (btn.classList.contains('broken')) return;
      btn.classList.add('broken');
      btn.appendChild(icon(ICON.photo));
    });
    img.src = p.src;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      const at = shown.indexOf(p);
      if (at < 0) return;
      if (closeLb) closeLb(false);
      closeLb = lightbox(shown.map((q) => ({
        src: q.src,
        alt: q.alt || q.caption || '',
        caption: q.caption || '',
        meta: [q.camera && camName(q.camera, true), q.lens, fmtDate(q.date)].filter(Boolean).join(' · ')
      })), at, btn);
    });
    fig.appendChild(btn);
    const meta = [p.camera && camName(p.camera), fmtDate(p.date)].filter(Boolean).join(' · ');
    if (p.caption || meta) {
      const cap = h('figcaption');
      if (p.caption) cap.appendChild(h('span', 'pgal-cap', p.caption));
      if (meta) cap.appendChild(h('span', 'pgal-meta', meta));
      fig.appendChild(cap);
    }
    figs.set(i, fig);
    return fig;
  }

  function renderBar() {
    bar.textContent = '';
    if (!camera) return;
    const chip = h('span', 'pgal-chip');
    const label = h('span');
    label.append('showing ', h('b', null, camName(camera)), ' photos');
    const all = h('button', 'pgal-all', 'show all');
    all.type = 'button';
    all.addEventListener('click', () => {
      setCamera(null, true);
      // Let the 3D kit drop its highlight too.
      document.dispatchEvent(new CustomEvent('dl:camera', { detail: { id: null } }));
    });
    chip.append(label, h('span', 'pgal-dot', '·'), all);
    bar.appendChild(chip);
  }

  function emptyState(text) {
    const box = h('div', 'pgal-empty');
    box.append(icon(ICON.photo), h('span', null, text));
    return box;
  }

  function render() {
    if (!alive || !loaded) return;
    renderBar();
    const indexed = photos.map((p, i) => [p, i]).filter(([p]) => !camera || p.camera === camera);
    shown = indexed.map(([p]) => p);
    body.textContent = '';
    if (!photos.length) { body.appendChild(emptyState(emptyNote)); cols = 0; return; }
    if (!shown.length) { body.appendChild(emptyState('No ' + camName(camera) + ' photos up yet.')); cols = 0; return; }
    cols = columnsFor(root.clientWidth || el.clientWidth || 1024, shown.length);
    const wrap = h('div', 'pgal-cols' + (cols === 1 && shown.length === 1 ? ' one' : ''));
    const colEls = [];
    for (let c = 0; c < cols; c++) colEls.push(wrap.appendChild(h('div', 'pgal-col')));
    // Round robin keeps the reading order left to right, row by row.
    indexed.forEach(([p, i], k) => colEls[k % cols].appendChild(figure(p, i)));
    body.appendChild(wrap);
  }

  function setCamera(id, fromChip) {
    const next = id && typeof id === 'string' ? id : null;
    if (next === camera) return;
    camera = next;
    if (closeLb) { closeLb(false); closeLb = null; }
    render();
    if (!fromChip && camera && loaded) {
      const r = bar.getBoundingClientRect();
      if (r.top > window.innerHeight || r.bottom < 0) bar.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
    }
  }
  function onCamera(e) { setCamera(e.detail && e.detail.id, false); }
  document.addEventListener('dl:camera', onCamera);

  const ro = new ResizeObserver(() => {
    if (!loaded || !shown.length) return;
    if (columnsFor(root.clientWidth, shown.length) !== cols) render();
  });
  ro.observe(root);

  const src = el.dataset.src;
  (src ? fetch(src, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : {})) : Promise.resolve({}))
    .catch(() => ({}))
    .then((data) => {
      if (!alive) return;
      const list = data && Array.isArray(data.photos) ? data.photos : [];
      photos = list.filter((p) => p && typeof p.src === 'string' && p.src);
      loaded = true;
      render();
    });

  return function stop() {
    alive = false;
    ctrl.abort();
    if (closeLb) closeLb(false);
    closeLb = null;
    ro.disconnect();
    document.removeEventListener('dl:camera', onCamera);
    root.remove();
    release();
  };
}
