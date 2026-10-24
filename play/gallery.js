// Photo gallery piece: justified rows, every photo at its own shape and filling
// its card; the title, camera and month come up over it on hover. Lightbox on click.
//   <div class="play" data-play="gallery" data-src="/hobbies/photography/photos.json">
//   photos.json: { "photos": [ { "src", "w", "h", "title", "caption", "camera", "lens", "date", "alt" } ] }
// w and h give the shape before the photo loads (otherwise it's read on load).
// camera is "xt200" or "a7r2". When photos have cameras, a pill bar on top
// filters by camera; it and the 3D kit stay in step through a dl:camera event
// on document ({ detail: { id } }, id null for all).
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
.pgal-bar { display: flex; justify-content: center; margin-bottom: 18px; }
.pgal-bar:empty { display: none; }
.pgal-tabs { display: inline-flex; flex-wrap: wrap; gap: 2px; padding: 5px; border-radius: 999px; background: var(--fill); }
.pgal-tab { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 16px; border: 0; border-radius: 999px; background: none; color: var(--t3); font: inherit; cursor: pointer; transition: color 140ms ease, background 140ms ease; }
.pgal-tab:hover { color: var(--t1); }
.pgal-tab.on { color: var(--accent); background: var(--fill); }
.pgal-tab svg { display: none; width: 12px; height: 12px; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; }
.pgal-tab.on svg { display: block; }
.pgal-tab:focus-visible { border-radius: 999px; }
.pgal-grid { display: flex; flex-wrap: wrap; gap: 10px; }
/* Takes up the slack in the last row, so it isn't stretched. */
.pgal-grid::after { content: ''; flex-grow: 1000000; }
.pgal-item { flex-grow: var(--ar, 1.33); flex-basis: calc(var(--ar, 1.33) * 180px); min-width: 0; margin: 0; }
.pgal-open {
  position: relative; display: block; width: 100%; aspect-ratio: var(--ar, 1.33); padding: 0; container-type: inline-size;
  border: 0; border-radius: 14px; overflow: hidden; background: var(--fill); color: #fff; font: inherit; text-align: left; cursor: zoom-in;
}
.pgal-open:focus-visible { border-radius: 14px; outline-offset: 3px; }
.pgal-open img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 320ms ease, transform 500ms cubic-bezier(.2, .7, .2, 1); }
.pgal-open img.in { opacity: 1; }
.pgal-go {
  position: absolute; top: 10px; right: 10px; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.35); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); opacity: 0; transition: opacity 180ms ease, transform 180ms ease;
}
.pgal-go svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pgal-badge { position: absolute; top: 10px; left: 10px; display: inline-flex; align-items: center; gap: 5px; padding: 3px 9px 3px 7px; border-radius: 7px; background: rgba(0, 0, 0, 0.4); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); color: #fff; font-size: 13px; }
.pgal-badge svg { width: 10px; height: 10px; fill: currentColor; }
/* The overlays let the pointer through, so the photo itself can be dragged (onto the head). */
.pgal-go, .pgal-badge, .pgal-info { pointer-events: none; }
.pgal-info {
  position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: flex-end; justify-content: space-between; gap: 12px;
  padding: 48px 14px 12px; background: linear-gradient(to top, rgba(0, 0, 0, 0.66), rgba(0, 0, 0, 0.28) 55%, rgba(0, 0, 0, 0));
  opacity: 0; transform: translateY(6px); transition: opacity 200ms ease, transform 200ms ease;
}
.pgal-text { min-width: 0; }
.pgal-title { display: block; overflow: hidden; color: #fff; white-space: nowrap; text-overflow: ellipsis; }
.pgal-meta { display: block; overflow: hidden; color: rgba(255, 255, 255, 0.72); font-size: 13px; white-space: nowrap; text-overflow: ellipsis; }
.pgal-meta i { margin: 0 6px; font-style: normal; opacity: 0.6; }
.pgal-pill { flex: none; padding: 3px 9px; border-radius: 8px; background: rgba(255, 255, 255, 0.18); color: #fff; font-size: 13px; white-space: nowrap; }
/* A narrow tile: the month goes under the title instead of squeezing it. */
@container (max-width: 230px) {
  .pgal-info { flex-direction: column; align-items: flex-start; gap: 6px; padding: 40px 10px 10px; }
  .pgal-text { width: 100%; }
}
.pgal-open:focus-visible :is(.pgal-info, .pgal-go) { opacity: 1; transform: none; }
@media (hover: hover) {
  .pgal-open:hover :is(.pgal-info, .pgal-go) { opacity: 1; transform: none; }
  .pgal-open:hover img.in { transform: scale(1.03); }
}
.pgal-open.broken { display: grid; place-items: center; cursor: default; }
.pgal-open.broken img { display: none; }
.pgal-open.broken > svg { width: 22px; height: 22px; fill: none; stroke: var(--t3); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.pgal-empty { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 14px; background: var(--fill); color: var(--t2); }
.pgal-empty svg { flex: none; width: 22px; height: 22px; fill: none; stroke: var(--t3); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.pgal-loading { height: 160px; border-radius: 14px; background: var(--fill); }
@media (prefers-reduced-motion: reduce) { .pgal-open img, .pgal-go, .pgal-info { transition: none; } .pgal-open:hover img.in { transform: none; } }
@media (max-width: 720px) { .pgal-grid { gap: 6px; } .pgal-item { flex-basis: calc(var(--ar, 1.33) * 150px); } .pgal-open { border-radius: 10px; } }
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
  arrow: 'M7 17L17 7M8 7h9v9',
  star: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9',
  play: 'M7 4.5v15l13-7.5z',
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
// "Jun 2024" for the card's tag.
function monthOf(s) {
  const m = /^(\d{4})-(\d{2})/.exec(String(s || ''));
  const mon = m && MONTHS[Number(m[2]) - 1];
  return mon ? mon + ' ' + m[1] : '';
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

// Clips that loop muted inline (videos.js, hikes.js). Nothing loads until a
// clip is near the screen, only the most visible one plays (once the page has
// settled on it for a moment, so scrolling past doesn't start downloads), it
// pauses when it leaves, and one that scrolls far away drops its download. On phones, with
// Save-Data on, or with reduced motion nothing autoplays (tapOnly): the poster
// shows and the caller plays a clip on tap with play(v).
export function clipWatch() {
  const conn = navigator.connection;
  const tapOnly = window.matchMedia('(hover: none), (max-width: 720px), (prefers-reduced-motion: reduce)').matches || !!(conn && conn.saveData);
  const clips = new Map();
  let settle = 0;
  function pick() {
    if (tapOnly) return;
    let best = null;
    for (const [v, c] of clips) if (c.ratio >= 0.5 && (!best || c.ratio > clips.get(best).ratio)) best = v;
    for (const v of clips.keys()) if (v !== best && !v.paused) v.pause();
    clearTimeout(settle);
    if (best && best.paused) settle = setTimeout(() => {
      const c = clips.get(best);
      if (!c || c.ratio < 0.5) return;
      if (!best.getAttribute('src')) best.src = c.src;
      best.play().catch(() => {});
    }, 400);
  }
  const near = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target, c = clips.get(v);
      if (!c) continue;
      if (e.isIntersecting) {
        if (c.poster && !v.poster) {
          v.poster = c.poster;
          const img = new Image();
          img.onload = () => v.classList.add('in');
          img.src = c.poster;
        }
      } else if (v.getAttribute('src')) { v.pause(); v.removeAttribute('src'); v.load(); }
    }
  }, { rootMargin: '300px 0px' });
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) { const c = clips.get(e.target); if (c) c.ratio = e.isIntersecting ? e.intersectionRatio : 0; }
    pick();
  }, { threshold: [0, 0.25, 0.5, 0.75, 1] });
  return {
    tapOnly,
    add(v, src, poster) {
      v.muted = true;
      v.loop = true;
      v.playsInline = true;
      v.preload = 'none';
      clips.set(v, { src, poster, ratio: 0 });
      near.observe(v);
      seen.observe(v);
    },
    // One at a time: playing one pauses the rest.
    play(v) {
      const c = clips.get(v);
      if (!c) return;
      for (const o of clips.keys()) if (o !== v && !o.paused) o.pause();
      if (!v.getAttribute('src')) v.src = c.src;
      v.play().catch(() => {});
    },
    stop() {
      clearTimeout(settle);
      near.disconnect();
      seen.disconnect();
      for (const v of clips.keys()) { v.pause(); v.removeAttribute('src'); v.load(); }
      clips.clear();
    }
  };
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
  const body = h('div');
  body.appendChild(h('div', 'pgal-loading'));
  root.append(bar, body);
  el.appendChild(root);

  let alive = true;
  let photos = [];
  let loaded = false;
  let camera = null;
  let shown = [];
  let closeLb = null;
  const figs = new Map();
  const ctrl = new AbortController();

  function figure(p, i) {
    if (figs.has(i)) return figs.get(i);
    const fig = h('figure', 'pgal-item');
    const btn = h('button', 'pgal-open');
    btn.type = 'button';
    const name = p.title || p.caption || '';
    btn.setAttribute('aria-label', (p.video ? 'Play ' : 'Open ') + (name || p.alt || (p.video ? 'clip ' : 'photo ') + (i + 1)));
    if (p.video) {
      const badge = h('span', 'pgal-badge');
      badge.append(icon(ICON.play), 'Clip');
      btn.appendChild(badge);
    }
    const go = h('span', 'pgal-go');
    go.appendChild(icon(ICON.arrow));
    if (p.w > 0 && p.h > 0) fig.style.setProperty('--ar', (p.w / p.h).toFixed(4));
    const img = h('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = p.alt || name;
    img.addEventListener('load', () => {
      if (!(p.w > 0 && p.h > 0) && img.naturalWidth && img.naturalHeight) fig.style.setProperty('--ar', (img.naturalWidth / img.naturalHeight).toFixed(4));
      img.classList.add('in');
    });
    img.addEventListener('error', () => {
      if (btn.classList.contains('broken')) return;
      btn.classList.add('broken');
      btn.appendChild(icon(ICON.photo));
    });
    img.src = p.src || p.poster;
    btn.prepend(img);
    btn.appendChild(go);
    // On hover: title and camera on the left, the month in a tag on the right.
    const meta = [p.camera && camName(p.camera), p.lens].filter(Boolean);
    const month = monthOf(p.date);
    if (name || meta.length || month) {
      const info = h('span', 'pgal-info');
      const text = h('span', 'pgal-text');
      if (name) text.appendChild(h('span', 'pgal-title', name));
      if (meta.length) {
        const m = h('span', 'pgal-meta');
        meta.forEach((x, k) => { if (k) m.appendChild(h('i', null, '·')); m.append(x); });
        text.appendChild(m);
      }
      info.appendChild(text);
      if (month) info.appendChild(h('span', 'pgal-pill', month));
      btn.appendChild(info);
    }
    btn.addEventListener('click', () => {
      const at = shown.indexOf(p);
      if (at < 0) return;
      if (closeLb) closeLb(false);
      closeLb = lightbox(shown.map((q) => ({
        src: q.src || q.poster,
        video: q.video,
        poster: q.poster,
        alt: q.alt || q.title || q.caption || '',
        caption: q.title || q.caption || '',
        meta: [q.camera && camName(q.camera, true), q.lens, fmtDate(q.date)].filter(Boolean).join(' · ')
      })), at, btn);
    });
    fig.appendChild(btn);
    figs.set(i, fig);
    return fig;
  }

  // All, then each camera that has photos: shown when the photos say which camera took them.
  function renderBar() {
    bar.textContent = '';
    if (!photos.some((p) => p.camera)) return;
    const tabs = h('div', 'pgal-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', 'Filter by camera');
    for (const id of [null, ...Object.keys(CAMERAS).filter((c) => photos.some((p) => p.camera === c))]) {
      const t = h('button', 'pgal-tab' + (id === camera ? ' on' : ''));
      t.type = 'button';
      t.setAttribute('aria-pressed', String(id === camera));
      t.append(icon(ICON.star), id ? camName(id) : 'All');
      t.addEventListener('click', () => {
        setCamera(id, true);
        // The 3D kit highlights the same camera.
        document.dispatchEvent(new CustomEvent('dl:camera', { detail: { id } }));
      });
      tabs.appendChild(t);
    }
    bar.appendChild(tabs);
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
    if (!photos.length) { body.appendChild(emptyState(emptyNote)); return; }
    if (!shown.length) { body.appendChild(emptyState('No ' + camName(camera) + ' photos up yet.')); return; }
    const grid = h('div', 'pgal-grid');
    indexed.forEach(([p, i]) => grid.appendChild(figure(p, i)));
    body.appendChild(grid);
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

  const src = el.dataset.src;
  (src ? fetch(src, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : {})) : Promise.resolve({}))
    .catch(() => ({}))
    .then((data) => {
      if (!alive) return;
      const list = data && Array.isArray(data.photos) ? data.photos : [];
      photos = list.filter((p) => p && ((typeof p.src === 'string' && p.src) || (typeof p.video === 'string' && p.video)));
      loaded = true;
      render();
    });

  return function stop() {
    alive = false;
    ctrl.abort();
    if (closeLb) closeLb(false);
    closeLb = null;
    document.removeEventListener('dl:camera', onCamera);
    root.remove();
    release();
  };
}
