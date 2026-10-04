// Trophy case piece: trophy photos standing on glass shelves.
//   <div class="play" data-play="trophycase" data-src="/hobbies/speed-skating/trophies.json">
//   trophies.json: { "trophies": [ { "src", "title", "for", "date" } ] }
// Hover (or focus, or a first tap on touch) shows what it was for and when.
// Click opens the gallery's lightbox.

const CSS_ID = 'play-trophycase-css';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CSS = `
.ptro { --sheen: rgba(255, 255, 255, 0.75); --glass: rgba(136, 192, 208, 0.6); }
[data-theme="dark"] .ptro { --sheen: rgba(255, 255, 255, 0.05); --glass: rgba(136, 192, 208, 0.45); }
.ptro-case {
  position: relative;
  padding: 30px clamp(16px, 4%, 40px) 12px;
  border-radius: 16px;
  background: linear-gradient(180deg, var(--fill), transparent 80%);
  box-shadow: inset 0 0 0 1px var(--rule);
  overflow: hidden;
}
.ptro-case::before {
  content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(115deg, transparent 30%, var(--sheen) 37%, transparent 44%, transparent 58%, var(--sheen) 61%, transparent 64%);
  opacity: 0.6;
}
.ptro-case > * { position: relative; }
.ptro-shelf { display: grid; grid-template-columns: repeat(var(--cols), minmax(0, 1fr)); column-gap: 14px; }
.ptro-shelf + .ptro-shelf { margin-top: 26px; }
.ptro-board { grid-row: 2; grid-column: 1 / -1; height: 9px; margin: 0 -10px; border-radius: 2px; background: linear-gradient(180deg, var(--glass) 0 1px, var(--fill) 1px, transparent); box-shadow: inset 0 0 0 1px var(--rule); }
.ptro-item { position: relative; grid-row: 1; align-self: end; display: block; width: 100%; padding: 0; border: 0; border-radius: 10px; background: none; color: #fff; font: inherit; letter-spacing: inherit; text-align: left; cursor: zoom-in; -webkit-tap-highlight-color: transparent; }
.ptro-item:focus-visible { border-radius: 10px; outline-offset: 3px; }
.ptro-item::after { content: ''; position: absolute; left: 12%; right: 12%; bottom: -4px; height: 8px; border-radius: 50%; background: radial-gradient(closest-side, rgba(0, 0, 0, 0.16), transparent); pointer-events: none; }
.ptro-ph { display: block; aspect-ratio: 3 / 4; border-radius: 10px; overflow: hidden; background: var(--fill); }
.ptro-ph img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 320ms ease; }
.ptro-ph img.in { opacity: 1; }
.ptro-info {
  position: absolute; left: 0; right: 0; bottom: 0; z-index: 1;
  display: block; padding: 36px 12px 10px;
  border-radius: 0 0 10px 10px;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.68));
  opacity: 0; transform: translateY(4px);
  transition: opacity 180ms ease, transform 180ms ease;
  pointer-events: none;
}
.ptro-info span { display: block; }
.ptro-info .f { color: rgba(255, 255, 255, 0.94); }
.ptro-info .d { color: rgba(255, 255, 255, 0.66); }
@media (hover: hover) { .ptro-item:hover .ptro-info { opacity: 1; transform: none; } }
.ptro-item:focus-visible .ptro-info, .ptro-item.on .ptro-info { opacity: 1; transform: none; }
.ptro-plaque { grid-row: 3; padding: 9px 2px 0; text-align: center; color: var(--t2); overflow-wrap: anywhere; }
.ptro-none { text-align: center; }
.ptro-none-note { display: inline-flex; align-items: center; gap: 10px; padding: 30px 0 18px; color: var(--t2); }
.ptro-none-note svg { flex: none; width: 22px; height: 22px; fill: none; stroke: var(--t3); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.ptro-none .ptro-board { margin: 0 -10px; }
.ptro-loading { height: 200px; border-radius: 16px; background: var(--fill); }
@media (max-width: 720px) {
  .ptro-case { padding-top: 22px; }
  .ptro-shelf { column-gap: 10px; }
  .ptro-shelf + .ptro-shelf { margin-top: 20px; }
  .ptro-info { padding: 28px 10px 8px; }
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
const TROPHY = 'M8 4.5h8v5a4 4 0 0 1-8 0zM8 6.5H5.5a2.5 2.5 0 0 0 2.6 3.4M16 6.5h2.5a2.5 2.5 0 0 1-2.6 3.4M12 13.5v3.5M8.5 20h7M9.5 17h5v3h-5z';

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
  const emptyNote = noteText(el, 'Digging out photos rn.');
  const root = h('div', 'ptro');
  root.appendChild(h('div', 'ptro-loading'));
  el.appendChild(root);

  let alive = true;
  let trophies = [];
  let cols = 0;
  let closeLb = null;
  let lbMod = null;
  let pointer = 'mouse';
  const items = new Map();
  const ctrl = new AbortController();

  function columnsFor(width) { return width < 420 ? 2 : width < 720 ? 3 : 4; }

  function lightboxItems() {
    return trophies.map((t) => ({
      src: t.src,
      alt: t.title || 'Trophy',
      caption: t.title,
      meta: [t.for, fmtDate(t.date)].filter(Boolean).join(' · ')
    }));
  }
  function openAt(i, btn) {
    if (!lbMod) return;
    lbMod.then((m) => {
      if (!alive || !m) return;
      if (closeLb) closeLb(false);
      closeLb = m.lightbox(lightboxItems(), i, btn);
    });
  }
  function clearOn(except) {
    root.querySelectorAll('.ptro-item.on').forEach((b) => { if (b !== except) b.classList.remove('on'); });
  }

  function item(t, i) {
    if (items.has(i)) return items.get(i);
    const btn = h('button', 'ptro-item');
    btn.type = 'button';
    const date = fmtDate(t.date);
    btn.setAttribute('aria-label', [t.title || 'Trophy', t.for, date].filter(Boolean).join(', ') + '. Open photo');
    const ph = h('span', 'ptro-ph');
    const img = h('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.addEventListener('load', () => img.classList.add('in'));
    img.src = t.src;
    ph.appendChild(img);
    btn.appendChild(ph);
    const hasInfo = !!(t.for || date);
    if (hasInfo) {
      const info = h('span', 'ptro-info');
      info.setAttribute('aria-hidden', 'true');
      if (t.for) info.appendChild(h('span', 'f', t.for));
      if (date) info.appendChild(h('span', 'd', date));
      btn.appendChild(info);
    }
    btn.addEventListener('pointerdown', (e) => { pointer = e.pointerType; });
    btn.addEventListener('click', () => {
      // On touch the first tap reads the card, the second opens the photo.
      if (pointer === 'touch' && hasInfo && !btn.classList.contains('on')) {
        clearOn(btn);
        btn.classList.add('on');
        return;
      }
      clearOn(null);
      openAt(i, btn);
    });
    const plaque = h('p', 'ptro-plaque', t.title || '');
    const pair = { btn, plaque };
    items.set(i, pair);
    return pair;
  }

  function render() {
    if (!alive) return;
    root.textContent = '';
    if (!trophies.length) {
      const box = h('div', 'ptro-case ptro-none');
      const note = h('p', 'ptro-none-note');
      note.append(icon(TROPHY), h('span', null, emptyNote));
      box.append(note, h('div', 'ptro-board'));
      root.appendChild(box);
      cols = 0;
      return;
    }
    const box = h('div', 'ptro-case');
    root.appendChild(box);
    const inner = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) * 2;
    cols = columnsFor(inner || root.clientWidth || 1024);
    for (let s = 0; s < trophies.length; s += cols) {
      const shelf = h('div', 'ptro-shelf');
      shelf.style.setProperty('--cols', String(cols * 2));
      const row = trophies.slice(s, s + cols);
      // Half-width tracks so a short last shelf can sit centred.
      const offset = cols - row.length;
      row.forEach((t, k) => {
        const { btn, plaque } = item(t, s + k);
        const at = offset + k * 2 + 1;
        btn.style.gridColumn = at + ' / span 2';
        plaque.style.gridColumn = at + ' / span 2';
        shelf.append(btn, plaque);
      });
      shelf.appendChild(h('div', 'ptro-board'));
      box.appendChild(shelf);
    }
  }

  function onDocDown(e) { if (!e.target.closest || !e.target.closest('.ptro-item')) clearOn(null); }
  document.addEventListener('pointerdown', onDocDown);

  const ro = new ResizeObserver(() => {
    if (!trophies.length || !cols) return;
    const box = root.querySelector('.ptro-case');
    if (!box) return;
    const inner = box.clientWidth - parseFloat(getComputedStyle(box).paddingLeft) * 2;
    if (columnsFor(inner) !== cols) render();
  });
  ro.observe(root);

  const src = el.dataset.src;
  (src ? fetch(src, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : {})) : Promise.resolve({}))
    .catch(() => ({}))
    .then((data) => {
      if (!alive) return;
      const raw = data && Array.isArray(data.trophies) ? data.trophies : [];
      trophies = raw.filter((t) => t && typeof t.src === 'string' && t.src).map((t) => ({
        src: t.src,
        title: t.title ? String(t.title) : '',
        for: t.for ? String(t.for) : '',
        date: t.date
      }));
      // The lightbox lives in gallery.js; load it with the same ?v= as this file.
      if (trophies.length) lbMod = import('./gallery.js' + new URL(import.meta.url).search).catch(() => null);
      render();
    });

  return function stop() {
    alive = false;
    ctrl.abort();
    if (closeLb) closeLb(false);
    closeLb = null;
    ro.disconnect();
    document.removeEventListener('pointerdown', onDocDown);
    root.remove();
    release();
  };
}
