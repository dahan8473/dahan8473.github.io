// Project overlays: click a project on /projects/ and it opens over the page
// with what I built, how it went, the stack, the links (GitHub, Devpost, the
// live site, a case study) and, for some, a small demo to play with.
//   <script type="application/json" id="proj-data">{ "<id>": { name, meta,
//     line, desc, stack: [], links: [{ href, text }], shot, award, points: [],
//     story, shots: [[src, alt, w, h]], sim, sim_note, compare, demo,
//     demo_note } }</script>
//   <div data-play="projects" hidden></div>
// sim 'compare' is a before and after slider built here; any other sim loads
// /play/sim-<sim>.js and mounts it. A project with a sim and shots opens on
// its photos (a shot can also be { src, thumb, caption, w, h } or a clip,
// { video, poster, caption }) with a button (demo) that swaps them for the
// sim. #<id> in the URL opens that project. The floating head hears about it
// on window.dlBus: overlay_open, overlay_close, demo_open, demo_close.

const CSS_ID = 'play-projects-css';
const CSS = `
.projs .proj { cursor: pointer; }
.projs .proj .shot { transition: transform 260ms cubic-bezier(.2, .8, .2, 1), box-shadow 260ms ease; }
@media (hover: hover) { .projs .proj:hover .shot { transform: translateY(-3px); } }
.projs .proj:focus-visible { outline: 2px solid #88c0d0; outline-offset: 8px; border-radius: 14px; }
.proj-more { margin-left: 12px; color: var(--t3); }
@media (hover: hover) { .projs .proj:hover .proj-more { color: var(--t1); } }

.pov [hidden] { display: none !important; }
.pov { position: fixed; inset: 0; z-index: 100; display: grid; place-items: center; padding: 24px; background: rgba(0, 0, 0, 0.42); opacity: 0; transition: opacity 200ms ease; }
.pov.on { opacity: 1; }
.pov-box { position: relative; width: min(880px, 100%); max-height: calc(100vh - 48px); overflow-y: auto; overscroll-behavior: contain; border-radius: 18px; background: var(--bg); box-shadow: 0 0 0 1px var(--rule), 0 30px 80px -20px rgba(0, 0, 0, 0.5); transform: translateY(12px) scale(0.985); transition: transform 260ms cubic-bezier(.2, .8, .2, 1); }
.pov.on .pov-box { transform: none; }
.pov-x { position: sticky; top: 12px; float: right; z-index: 2; display: grid; place-items: center; width: 40px; height: 40px; margin: 12px 12px -52px 0; padding: 0; border: 0; border-radius: 50%; background: var(--fill); color: var(--t1); cursor: pointer; -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); }
.pov-x:hover { background: var(--rule); }
.pov-x svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.pov-media { border-radius: 18px 18px 0 0; overflow: hidden; background: var(--fill); }
.pov-media img { display: block; width: 100%; height: auto; }
.pov-media.ink { background: #0d0d0e; }
.pov-shots { display: flex; gap: 10px; padding: 10px 28px 0; overflow-x: auto; scrollbar-width: none; }
.pov-shots::-webkit-scrollbar { display: none; }
.pov-shots button { position: relative; flex: none; width: 76px; height: 44px; padding: 0; border: 0; border-radius: 8px; overflow: hidden; background: var(--fill); cursor: pointer; opacity: 0.55; }
.pov-shots button.on, .pov-shots button:hover { opacity: 1; }
.pov-shots img { width: 100%; height: 100%; object-fit: cover; }
.pov-shots .pv { position: absolute; inset: 0; display: grid; place-items: center; color: #fff; }
.pov-shots .pv svg { width: 16px; height: 16px; filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6)); }
.pov-stage { position: relative; aspect-ratio: 16 / 10; overflow: hidden; border-radius: 18px 18px 0 0; background: #0d0d0e; cursor: zoom-in; }
.pov-stage:focus-visible { outline: 2px solid #88c0d0; outline-offset: -4px; }
/* Blurred small and scaled up: the same look as a big blur for a fraction of the work. */
.pov-stage .bg { position: absolute; left: 50%; top: 50%; width: 30%; height: 30%; object-fit: cover; transform: translate(-50%, -50%) scale(4); filter: blur(7px) saturate(1.15); opacity: 0.55; pointer-events: none; }
.pov-stage .fg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
.pov-nav { position: absolute; top: 50%; z-index: 1; display: grid; place-items: center; width: 40px; height: 40px; margin-top: -20px; padding: 0; border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.45); color: #fff; cursor: pointer; opacity: 0; transition: opacity 160ms ease; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.pov-nav svg { width: 18px; height: 18px; }
.pov-nav.prev { left: 12px; }
.pov-nav.next { right: 12px; }
.pov-stage:hover .pov-nav, .pov-nav:focus-visible { opacity: 1; }
@media (hover: none) { .pov-nav { opacity: 0.85; } }
.pov-cap { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin: 10px 28px 0; color: var(--t2); }
.pov-cap .n { flex: none; color: var(--t3); font-variant-numeric: tabular-nums; }
.pov-demo { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 18px 28px 0; }
.pov-demo-go { display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px 10px 14px; border: 0; border-radius: 999px; background: var(--t1); color: var(--bg); font: inherit; cursor: pointer; }
.pov-demo-go:hover { opacity: 0.86; }
.pov-demo-go:focus-visible { outline: 2px solid #88c0d0; outline-offset: 3px; }
.pov-demo-go svg { width: 16px; height: 16px; }
.pov-demo-go.pulse { animation: pov-pulse 1100ms ease-out 2; }
@keyframes pov-pulse { from { box-shadow: 0 0 0 0 rgba(136, 192, 208, 0.7); } to { box-shadow: 0 0 0 14px rgba(136, 192, 208, 0); } }
.pov-demo-note { color: var(--t3); }
.pov-back { display: inline-flex; align-items: center; gap: 4px; margin: 0 0 12px; padding: 7px 14px 7px 8px; border: 0; border-radius: 999px; background: var(--fill); color: var(--t1); font: inherit; cursor: pointer; }
.pov-back:hover { background: var(--rule); }
.pov-back svg { width: 18px; height: 18px; }
.pov-sim { padding: 20px 20px 0; }
.pov-sim .stage { border-radius: 14px; overflow: hidden; background: var(--fill); }
.pov-note { margin: 8px 4px 0; color: var(--t3); }
.pov-body { padding: 24px 28px 28px; }
.pov-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 16px; }
.pov-head h2 { margin: 0; font: inherit; font-weight: 500; color: var(--t1); }
.pov-meta { color: var(--t3); }
.pov-line { margin: 6px 0 0; color: var(--t1); }
.pov-award { display: inline-flex; align-items: center; gap: 8px; margin-top: 12px; padding: 4px 12px 4px 10px; border-radius: 999px; background: var(--fill); color: var(--t1); }
.pov-award::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: #ebcb8b; }
.pov-sec { margin-top: 22px; }
.pov-k { margin: 0 0 8px; color: var(--t3); }
.pov-points { margin: 0; padding: 0; list-style: none; }
.pov-points li { position: relative; padding-left: 18px; color: var(--t2); }
.pov-points li + li { margin-top: 6px; }
.pov-points li::before { content: ''; position: absolute; left: 2px; top: 0.7em; width: 6px; height: 1px; background: var(--t3); }
.pov-story { margin: 0; color: var(--t2); }
.pov-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pov-chips span { padding: 3px 10px; border-radius: 999px; box-shadow: inset 0 0 0 1px var(--rule); color: var(--t2); }
.pov-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 24px; }
.pov-links a { display: inline-flex; align-items: center; gap: 8px; padding: 9px 16px 9px 13px; border-radius: 999px; background: var(--fill); color: var(--t1); text-decoration: none; }
.pov-links a:hover { background: var(--rule); }
.pov-links a.main { background: var(--t1); color: var(--bg); }
.pov-links a.main:hover { opacity: 0.86; }
.pov-links svg { width: 16px; height: 16px; flex: none; }
.pov-links .out { opacity: 0.5; margin-left: -2px; }
.pcmp { position: relative; aspect-ratio: var(--ar); user-select: none; -webkit-user-select: none; touch-action: pan-y; cursor: ew-resize; }
.pcmp img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
.pcmp .after { clip-path: inset(0 0 0 var(--x)); }
.pcmp .bar { position: absolute; top: 0; bottom: 0; left: var(--x); width: 2px; margin-left: -1px; background: #fff; box-shadow: 0 0 12px rgba(0, 0, 0, 0.35); }
.pcmp .knob { position: absolute; top: 50%; left: 50%; display: grid; place-items: center; width: 34px; height: 34px; margin: -17px 0 0 -17px; border-radius: 50%; background: #fff; color: #0d0d0e; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3); }
.pcmp .tag { position: absolute; bottom: 10px; padding: 3px 10px; border-radius: 999px; background: rgba(0, 0, 0, 0.5); color: #fff; }
.pcmp .tag.l { left: 10px; }
.pcmp .tag.r { right: 10px; }
@media (max-width: 720px) {
  .pov { padding: 0; align-items: end; }
  .pov-box { max-height: 92vh; border-radius: 18px 18px 0 0; }
  .pov-body { padding: 20px 20px 28px; }
  .pov-shots { padding: 10px 20px 0; }
  .pov-sim { padding: 16px 16px 0; }
  .pov-stage { aspect-ratio: 4 / 3; }
  .pov-cap { margin: 10px 20px 0; }
  .pov-demo { padding: 16px 20px 0; }
}
@media (prefers-reduced-motion: reduce) { .pov, .pov-box, .projs .proj .shot { transition: none; } .pov-demo-go.pulse { animation: none; } }
`;

const NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  github: 'M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.08 2.91.83.09-.65.35-1.08.63-1.33-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02a9.5 9.5 0 0 1 5 0c1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.74c0 .27.18.58.69.48A10 10 0 0 0 12 2Z',
  devpost: 'M6.5 3 1 12l5.5 9h11L23 12l-5.5-9h-11Zm2.2 4.2h3.1c2.9 0 4.6 1.9 4.6 4.8s-1.7 4.8-4.6 4.8H8.7V7.2Zm2.1 1.9v5.8h1c1.6 0 2.5-1.1 2.5-2.9s-.9-2.9-2.5-2.9h-1Z',
  live: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm6.9 6h-3a15.7 15.7 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8ZM12 4c.8 1.1 1.5 2.5 1.9 4h-3.8c.4-1.5 1.1-2.9 1.9-4ZM4.3 14a8.2 8.2 0 0 1 0-4h3.4a16.5 16.5 0 0 0 0 4H4.3Zm.8 2h3a15.7 15.7 0 0 0 1.4 3.6A8 8 0 0 1 5.1 16Zm3-8h-3a8 8 0 0 1 4.4-3.6C8.9 5.5 8.4 6.7 8.1 8ZM12 20c-.8-1.1-1.5-2.5-1.9-4h3.8c-.4 1.5-1.1 2.9-1.9 4Zm2.3-6H9.7a14.7 14.7 0 0 1 0-4h4.6a14.7 14.7 0 0 1 0 4Zm.3 5.6c.6-1.1 1.1-2.3 1.4-3.6h3a8 8 0 0 1-4.4 3.6Zm1.7-5.6a16.5 16.5 0 0 0 0-4h3.4a8.2 8.2 0 0 1 0 4h-3.4Z',
  doc: 'M6 2h8l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V8h4.5L13 3.5ZM8 12v1.6h8V12H8Zm0 4v1.6h8V16H8Z',
  out: 'M14 4h6v6h-2V7.4l-7.3 7.3-1.4-1.4L16.6 6H14V4ZM5 6h6v2H6v10h10v-5h2v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z',
  play: 'M8 5.2v13.6a.8.8 0 0 0 1.2.7l10.6-6.8a.8.8 0 0 0 0-1.4L9.2 4.5A.8.8 0 0 0 8 5.2Z',
  prev: 'M15.4 6.6 14 5.2 7.2 12l6.8 6.8 1.4-1.4L10 12Z',
  next: 'M8.6 17.4 10 18.8l6.8-6.8L10 5.2 8.6 6.6 14 12Z'
};
// The floating head's event bus (talk/talk.js), when it's there.
const emit = (type, data) => { try { if (window.dlBus) window.dlBus.emit(type, data); } catch (e) {} };

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function icon(name, cls) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name]);
  p.setAttribute('fill', 'currentColor');
  s.appendChild(p);
  return s;
}
function kindOf(href) {
  if (/github\.com/.test(href)) return 'github';
  if (/devpost\.com/.test(href)) return 'devpost';
  if (/^https?:/.test(href)) return 'live';
  return 'doc';
}
function labelOf(l) {
  const k = kindOf(l.href);
  if (k === 'github') return 'Code on GitHub';
  if (k === 'devpost') return 'Devpost';
  if (k === 'live') return l.text;
  return l.text;
}

// Before and after: drag (or arrow keys) to move the line.
function compare([before, after, w, h_], ac) {
  const box = h('div', 'pcmp');
  box.style.setProperty('--ar', w + ' / ' + h_);
  box.style.setProperty('--x', '50%');
  box.tabIndex = 0;
  box.setAttribute('role', 'slider');
  box.setAttribute('aria-label', 'Compare before and after');
  box.setAttribute('aria-valuemin', '0');
  box.setAttribute('aria-valuemax', '100');
  const a = h('img');
  a.src = before;
  a.alt = 'Drone footage';
  const b = h('img', 'after');
  b.src = after;
  b.alt = 'Crop-health map';
  const bar = h('div', 'bar');
  const knob = h('span', 'knob', '↔');
  bar.appendChild(knob);
  box.append(a, b, bar, h('span', 'tag l', 'drone'), h('span', 'tag r', 'health map'));
  let x = 50;
  const set = (v) => {
    x = Math.max(0, Math.min(100, v));
    box.style.setProperty('--x', x + '%');
    box.setAttribute('aria-valuenow', String(Math.round(x)));
  };
  set(50);
  let down = false;
  const at = (e) => { const r = box.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
  box.addEventListener('pointerdown', (e) => { down = true; box.setPointerCapture(e.pointerId); at(e); }, { signal: ac.signal });
  box.addEventListener('pointermove', (e) => { if (down || e.pointerType === 'mouse') at(e); }, { signal: ac.signal });
  box.addEventListener('pointerup', () => { down = false; }, { signal: ac.signal });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); set(x - 5); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); set(x + 5); }
  }, { signal: ac.signal });
  return box;
}

// Photos first: a big stage (click it for full screen, play/gallery.js),
// arrows and thumbnails under it. Clips play muted on the stage.
function shotOf(s, name) {
  if (Array.isArray(s)) return { src: s[0], alt: s[1] || name, w: s[2], h: s[3] };
  return Object.assign({ alt: s.caption || name }, s);
}
function gallery(p, oac, v) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const shots = p.shots.map((s) => shotOf(s, p.name));
  const wrap = h('div', 'pov-gal');
  const stage = h('div', 'pov-stage');
  stage.tabIndex = 0;
  stage.setAttribute('role', 'button');
  stage.setAttribute('aria-label', 'Open full screen');
  const bg = h('img', 'bg');
  bg.alt = '';
  bg.setAttribute('aria-hidden', 'true');
  const img = h('img', 'fg');
  const vid = h('video', 'fg');
  Object.assign(vid, { muted: true, loop: true, playsInline: true, preload: 'none', hidden: true, controls: reduce });
  const nav = (dir) => {
    const b = h('button', 'pov-nav ' + dir);
    b.type = 'button';
    b.setAttribute('aria-label', dir === 'prev' ? 'Previous photo' : 'Next photo');
    b.appendChild(icon(dir));
    b.addEventListener('click', (e) => { e.stopPropagation(); show(at + (dir === 'prev' ? -1 : 1)); }, { signal: oac.signal });
    return b;
  };
  stage.append(bg, img, vid);
  if (shots.length > 1) stage.append(nav('prev'), nav('next'));
  const cap = h('p', 'pov-cap');
  const capText = h('span');
  const count = h('span', 'n');
  cap.append(capText, count);
  wrap.append(stage, cap);
  const row = h('div', 'pov-shots');
  const thumbs = shots.map((s, i) => {
    const b = h('button');
    b.type = 'button';
    b.setAttribute('aria-label', (s.video ? 'Play: ' : '') + s.alt);
    const t = h('img');
    t.src = s.thumb || s.poster || s.src;
    t.alt = '';
    b.appendChild(t);
    if (s.video) {
      const pv = h('span', 'pv');
      pv.appendChild(icon('play'));
      b.appendChild(pv);
    }
    b.addEventListener('click', () => show(i), { signal: oac.signal });
    row.appendChild(b);
    return b;
  });
  if (shots.length > 1) wrap.appendChild(row);

  let at = 0;
  let closeLb = null;
  function show(i) {
    at = (i + shots.length) % shots.length;
    const s = shots[at];
    if (s.video) {
      img.hidden = true;
      vid.hidden = false;
      vid.poster = s.poster || '';
      vid.setAttribute('aria-label', s.alt);
      if (vid.getAttribute('src') !== s.video) vid.src = s.video;
      if (!reduce) vid.play().catch(() => {});
      bg.src = s.poster || '';
      bg.hidden = false;
    } else {
      vid.pause();
      vid.hidden = true;
      img.hidden = false;
      img.alt = s.alt;
      img.src = s.src;
      bg.src = s.thumb || s.src;
      // Close to the stage's shape: fill it, rather than leave thin bars.
      const sr = stage.clientHeight ? stage.clientWidth / stage.clientHeight : matchMedia('(max-width: 720px)').matches ? 4 / 3 : 16 / 10;
      const fill = Boolean(s.w && s.h && Math.abs(s.w / s.h - sr) / sr < 0.2);
      img.style.objectFit = fill ? 'cover' : '';
      bg.hidden = fill;
    }
    capText.textContent = s.caption || '';
    count.textContent = shots.length > 1 ? at + 1 + ' / ' + shots.length : '';
    thumbs.forEach((b, k) => { b.classList.toggle('on', k === at); b.setAttribute('aria-current', k === at ? 'true' : 'false'); });
    const b = thumbs[at];
    if (row.scrollWidth > row.clientWidth) row.scrollTo({ left: b.offsetLeft - (row.clientWidth - b.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }
  async function full() {
    let m;
    try { m = await import('/play/gallery.js' + v); } catch (e) { return; }
    if (oac.signal.aborted) return;
    vid.pause();
    if (closeLb) closeLb(false);
    closeLb = m.lightbox(shots.map((s) => ({ src: s.video ? s.poster : s.src, video: s.video, poster: s.poster, alt: s.alt, caption: s.caption || '' })), at, stage);
  }
  stage.addEventListener('click', full, { signal: oac.signal });
  // Back from full screen (focus returns here): the clip picks up again.
  stage.addEventListener('focus', () => setTimeout(() => {
    if (!oac.signal.aborted && !wrap.hidden && !document.querySelector('.plb') && shots[at].video && !reduce) vid.play().catch(() => {});
  }, 300), { signal: oac.signal });
  stage.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === stage) { e.preventDefault(); full(); }
  }, { signal: oac.signal });
  show(0);
  return {
    el: wrap,
    step: (d) => show(at + d),
    pause() { vid.pause(); },
    resume() { if (shots[at].video && !reduce) vid.play().catch(() => {}); },
    stop() {
      vid.pause();
      vid.removeAttribute('src');
      if (closeLb) closeLb(false);
      closeLb = null;
    }
  };
}

export function mount(el) {
  const dataEl = document.getElementById('proj-data');
  if (!dataEl) return () => {};
  let data = {};
  try { data = JSON.parse(dataEl.textContent); } catch (e) { return () => {}; }
  const style = h('style');
  style.id = CSS_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
  const ac = new AbortController();
  const v = new URL(import.meta.url).search;
  let open = null;

  // Cards: keyboard reachable, and a quiet "Details" next to the links.
  const cards = [...document.querySelectorAll('.projs .proj')].filter((c) => data[c.id]);
  for (const c of cards) {
    c.tabIndex = 0;
    c.setAttribute('role', 'button');
    c.setAttribute('aria-label', data[c.id].name + ': details');
    const go = c.querySelector('.go');
    if (go && !go.querySelector('.proj-more')) go.appendChild(h('span', 'proj-more', 'Details →'));
    c.addEventListener('click', (e) => {
      if (e.target.closest('a, button')) return;
      show(c.id, c);
    }, { signal: ac.signal });
    c.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === c) { e.preventDefault(); show(c.id, c); }
    }, { signal: ac.signal });
  }

  function show(id, opener) {
    if (open) open.close(false);
    const p = data[id];
    const oac = new AbortController();
    let stopSim = null;
    let gal = null;
    let demoBtn = null;
    const ov = h('div', 'pov');
    const box = h('div', 'pov-box');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', p.name);
    const x = h('button', 'pov-x');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    const xs = document.createElementNS(NS, 'svg');
    xs.setAttribute('viewBox', '0 0 24 24');
    xs.innerHTML = '<path d="M6 6l12 12M18 6L6 18"/>';
    x.appendChild(xs);
    box.appendChild(x);

    // Media: photos with the demo a button away, the demo alone, or just the shots.
    if (p.sim && p.sim !== 'compare' && p.shots && p.shots.length) {
      gal = gallery(p, oac, v);
      box.appendChild(gal.el);
      const cta = h('div', 'pov-demo');
      demoBtn = h('button', 'pov-demo-go');
      demoBtn.type = 'button';
      demoBtn.append(icon('play'), h('span', '', p.demo || 'See it work'));
      cta.appendChild(demoBtn);
      if (p.demo_note) cta.appendChild(h('span', 'pov-demo-note', p.demo_note));
      box.appendChild(cta);
      const sim = h('div', 'pov-sim');
      sim.hidden = true;
      const back = h('button', 'pov-back');
      back.type = 'button';
      back.append(icon('prev'), h('span', '', 'Photos'));
      const stage = h('div', 'stage');
      sim.append(back, stage);
      if (p.sim_note) sim.appendChild(h('p', 'pov-note', p.sim_note));
      box.appendChild(sim);
      let loaded = false;
      demoBtn.addEventListener('click', () => {
        gal.pause();
        gal.el.hidden = true;
        cta.hidden = true;
        sim.hidden = false;
        box.scrollTop = 0;
        back.focus({ preventScroll: true });
        if (!loaded) {
          loaded = true;
          import('/play/sim-' + p.sim + '.js' + v).then((m) => {
            if (oac.signal.aborted) return;
            stopSim = m.mount(stage);
          }).catch(() => { stage.appendChild(h('p', 'pov-note', "The demo didn't load. Try again in a bit.")); });
        }
        emit('demo_open', { id });
      }, { signal: oac.signal });
      back.addEventListener('click', () => {
        sim.hidden = true;
        gal.el.hidden = false;
        cta.hidden = false;
        gal.resume();
        demoBtn.focus({ preventScroll: true });
        emit('demo_close', { id });
      }, { signal: oac.signal });
    } else if (p.sim === 'compare' && p.compare) {
      const sim = h('div', 'pov-sim');
      const stage = h('div', 'stage');
      stage.appendChild(compare(p.compare, oac));
      sim.append(stage, h('p', 'pov-note', p.sim_note || ''));
      box.appendChild(sim);
    } else if (p.sim) {
      const sim = h('div', 'pov-sim');
      const stage = h('div', 'stage');
      sim.append(stage, h('p', 'pov-note', p.sim_note || ''));
      box.appendChild(sim);
      import('/play/sim-' + p.sim + '.js' + v).then((m) => {
        if (oac.signal.aborted) return;
        stopSim = m.mount(stage);
      }).catch(() => {
        // No demo: fall back to the project's photo.
        if (!p.shot) { sim.remove(); return; }
        const img = h('img');
        img.src = p.shot;
        img.alt = p.name;
        img.style.cssText = 'display:block;width:100%;height:auto';
        stage.appendChild(img);
        sim.querySelector('.pov-note').remove();
      });
    } else {
      const shots = p.shots && p.shots.length ? p.shots : p.shot ? [[p.shot, p.name, 0, 0]] : [];
      if (shots.length) {
        const media = h('div', 'pov-media' + (p.ink ? ' ink' : ''));
        const big = h('img');
        big.alt = shots[0][1];
        big.src = shots[0][0];
        if (shots[0][2]) { big.width = shots[0][2]; big.height = shots[0][3]; }
        media.appendChild(big);
        box.appendChild(media);
        if (shots.length > 1) {
          const row = h('div', 'pov-shots');
          shots.forEach(([src, alt], i) => {
            const b = h('button', i ? '' : 'on');
            b.type = 'button';
            b.setAttribute('aria-label', alt);
            const t = h('img');
            t.src = src;
            t.alt = '';
            b.appendChild(t);
            b.addEventListener('click', () => {
              big.src = src;
              big.alt = alt;
              row.querySelectorAll('button').forEach((o) => o.classList.toggle('on', o === b));
            }, { signal: oac.signal });
            row.appendChild(b);
          });
          box.appendChild(row);
        }
      }
    }

    const body = h('div', 'pov-body');
    const head = h('div', 'pov-head');
    head.append(h('h2', '', p.name), h('span', 'pov-meta', p.meta));
    body.append(head, h('p', 'pov-line', p.line));
    if (p.award) body.appendChild(h('span', 'pov-award', p.award));
    const sec = (k, node) => { const s = h('div', 'pov-sec'); s.append(h('p', 'pov-k', k), node); body.appendChild(s); };
    if (p.points && p.points.length) {
      const ul = h('ul', 'pov-points');
      p.points.forEach((t) => ul.appendChild(h('li', '', t)));
      sec('What I built', ul);
    } else if (p.desc) sec('What it is', h('p', 'pov-story', p.desc));
    if (p.story) sec('How it went', h('p', 'pov-story', p.story));
    if (p.stack && p.stack.length) {
      const chips = h('div', 'pov-chips');
      p.stack.forEach((t) => chips.appendChild(h('span', '', t)));
      sec('Stack', chips);
    }
    if (p.links && p.links.length) {
      const row = h('div', 'pov-links');
      p.links.forEach((l, i) => {
        const a = h('a', i === 0 ? 'main' : '');
        a.href = l.href;
        const k = kindOf(l.href);
        const ext = k !== 'doc';
        if (ext) { a.target = '_blank'; a.rel = 'noopener'; }
        a.append(icon(k), h('span', '', labelOf(l)));
        if (ext) a.appendChild(icon('out', 'out'));
        if (!ext) a.addEventListener('click', () => close(false), { signal: oac.signal });
        row.appendChild(a);
      });
      body.appendChild(row);
    }
    box.appendChild(body);
    ov.appendChild(box);

    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.appendChild(ov);
    void ov.offsetWidth;
    ov.classList.add('on');
    x.focus({ preventScroll: true });
    try { history.replaceState(history.state, '', '#' + id); } catch (e) {}

    function close(restore) {
      if (!open || open.id !== id) return;
      open = null;
      oac.abort();
      if (gal) gal.stop();
      if (stopSim) try { stopSim(); } catch (e) {}
      document.documentElement.style.overflow = prevOverflow;
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch (e) {}
      const done = () => ov.remove();
      if (restore === false || matchMedia('(prefers-reduced-motion: reduce)').matches) done();
      else { ov.classList.remove('on'); setTimeout(done, 200); }
      if (restore !== false && opener && document.contains(opener)) opener.focus({ preventScroll: true });
      emit('overlay_close', { kind: 'project', id });
    }
    x.addEventListener('click', () => close(true), { signal: oac.signal });
    ov.addEventListener('click', (e) => { if (e.target === ov) close(true); }, { signal: oac.signal });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(true); }
      else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && gal && !gal.el.hidden && !(e.target.closest && e.target.closest('input, textarea, [role="slider"]'))) {
        e.preventDefault();
        gal.step(e.key === 'ArrowRight' ? 1 : -1);
      } else if (e.key === 'Tab') {
        const f = [...box.querySelectorAll('button, a, [tabindex="0"]')].filter((n) => n.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    }, { signal: oac.signal });
    // The head says something about this one: light up the demo button with it.
    const pulse = () => {
      if (!demoBtn || demoBtn.offsetParent === null) return;
      demoBtn.classList.remove('pulse');
      void demoBtn.offsetWidth;
      demoBtn.classList.add('pulse');
    };
    open = { id, close, pulse };
    emit('overlay_open', { kind: 'project', id });
  }
  const onLine = (l) => { if (open && (l.id === 'project:' + open.id || l.id === 'nudge:' + open.id)) open.pulse(); };
  if (window.dlBus) window.dlBus.on('line', onLine);

  const fromHash = decodeURIComponent(location.hash.slice(1));
  if (fromHash && data[fromHash]) show(fromHash, document.getElementById(fromHash));

  return function stop() {
    if (open) open.close(false);
    if (window.dlBus) window.dlBus.off('line', onLine);
    ac.abort();
    document.querySelectorAll('.proj-more').forEach((n) => n.remove());
    cards.forEach((c) => { c.removeAttribute('tabindex'); c.removeAttribute('role'); c.removeAttribute('aria-label'); });
    style.remove();
  };
}
