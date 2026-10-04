// Hikes piece: one row per hike, newest first, a strip of photos and clips
// under each, with a note under the photos that have one. Hover a hike for the
// trail's numbers and my day (total time where I know it, first and last photo,
// highest altitude). Phones get the numbers inline under the name.
//   <div class="play" data-play="hikes" data-src="/hobbies/hiking/hikes.json">
//   hikes.json: { "hikes": [ { id, name, where, date, trail: { distance, gain,
//     top, time, note }, me: { first, last, high }, media: [ { src, small, w, h }
//     | { video, poster, w, h } ], each with an optional note shown under it } ] }
// Photos open in the gallery's lightbox; clips loop muted while on screen.

import { useCss, fmtDate, lightbox } from './gallery.js';

const CSS_ID = 'play-hikes-css';
const CSS = `
.phk { display: flex; flex-direction: column; gap: 56px; }
.phk-hike { position: relative; }
.phk-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 14px; margin-bottom: 14px; cursor: default; }
.phk-name { margin: 0; font: inherit; color: var(--t1); }
.phk-where { color: var(--t2); }
.phk-date { margin-left: auto; color: var(--t3); white-space: nowrap; }
.phk-strip { display: flex; gap: 10px; overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x proximity; scrollbar-width: none; margin: 0 -2px; padding: 0 2px 2px; }
.phk-strip::-webkit-scrollbar { display: none; }
.phk-item { flex: none; height: 220px; padding: 0; border: 0; border-radius: 12px; background: var(--fill); overflow: hidden; scroll-snap-align: start; cursor: zoom-in; }
.phk-fig { flex: none; display: flex; flex-direction: column; margin: 0; scroll-snap-align: start; }
.phk-fig figcaption { width: 0; min-width: 100%; padding: 8px 2px 0; color: var(--t2); }
.phk-item:focus-visible { border-radius: 12px; outline-offset: 3px; }
.phk-item img, .phk-item video { display: block; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 320ms ease; }
.phk-item .in { opacity: 1; }
.phk-item.clip { cursor: pointer; }
@media (hover: hover) { .phk-item:hover img.in { opacity: 0.9; } }
.phk-card { color: var(--t2); }
.phk-card dl { display: grid; grid-template-columns: 92px 1fr; gap: 3px 12px; margin: 0; }
.phk-card dt { color: var(--t3); }
.phk-card dd { margin: 0; color: var(--t1); }
.phk-card .k { margin: 0 0 6px; color: var(--t3); }
.phk-card .n { margin: 8px 0 0; }
.phk-card section + section { margin-top: 14px; }
@media (hover: hover) and (pointer: fine) {
  .phk-card {
    position: fixed; left: 0; top: 0; z-index: 30; width: 280px; padding: 16px 18px;
    border-radius: 14px; background: var(--bg); box-shadow: 0 0 0 1px var(--rule), 0 16px 40px -12px rgba(0, 0, 0, 0.28);
    opacity: 0; pointer-events: none; transition: opacity 160ms ease;
  }
  .phk-card.on { opacity: 1; }
}
@media not ((hover: hover) and (pointer: fine)) {
  .phk-card { margin-bottom: 14px; }
  .phk-card .k { display: none; }
  .phk-card section + section { margin-top: 10px; }
  .phk-item { height: 170px; }
}
`;

function h(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

function stats(label, rows, note) {
  const sec = h('section');
  const kept = rows.filter(([, v]) => v);
  if (!kept.length && !note) return null;
  sec.appendChild(h('p', 'k', label));
  if (kept.length) {
    const dl = h('dl');
    for (const [k, v] of kept) dl.append(h('dt', '', k), h('dd', '', v));
    sec.appendChild(dl);
  }
  if (note) sec.appendChild(h('p', 'n', note));
  return sec;
}

function card(hike) {
  const t = hike.trail || {};
  const me = hike.me || {};
  const c = h('div', 'phk-card');
  const trail = stats('The trail', [['Distance', t.distance], ['Gain', t.gain], ['Top', t.top], ['Usually', t.time]], t.note);
  const day = stats('My day', [
    ['Total', me.total],
    [me.first === me.last ? 'Photo' : 'First photo', me.first],
    [me.first === me.last ? '' : 'Last photo', me.first === me.last ? '' : me.last],
    ['Highest', me.high]
  ]);
  if (trail) c.appendChild(trail);
  if (day) c.appendChild(day);
  return c;
}

export function mount(el) {
  const release = useCss(CSS_ID, CSS);
  const ac = new AbortController();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let closeLb = null;
  let io = null;

  const list = h('div', 'phk');
  const note = el.querySelector('.piece-note');

  fetch(el.dataset.src || '/hobbies/hiking/hikes.json', { signal: ac.signal })
    .then((r) => r.json())
    .then((data) => {
      const hikes = Array.isArray(data && data.hikes) ? data.hikes : [];
      io = new IntersectionObserver((entries) => {
        for (const e of entries) {
          const v = e.target;
          if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; v.play().catch(() => {}); }
          else v.pause();
        }
      }, { rootMargin: '120px' });

      for (const hike of hikes) {
        const art = h('article', 'phk-hike');
        art.dataset.t = 'hike-' + hike.id;
        const head = h('div', 'phk-head');
        head.append(h('h3', 'phk-name', hike.name), h('span', 'phk-where', hike.where), h('span', 'phk-date', fmtDate(hike.date)));
        const c = card(hike);
        const strip = h('div', 'phk-strip');
        const photos = (hike.media || []).filter((m) => m.src);
        const items = photos.map((m) => ({ src: m.src, alt: m.note || hike.name, caption: m.note || hike.name, meta: [hike.where, fmtDate(hike.date)].join(' · ') }));

        for (const m of hike.media || []) {
          const b = h('button', 'phk-item' + (m.video ? ' clip' : ''));
          b.type = 'button';
          b.style.aspectRatio = m.w + ' / ' + m.h;
          if (m.video) {
            const v = h('video');
            v.muted = true;
            v.loop = true;
            v.playsInline = true;
            v.preload = 'none';
            v.poster = m.poster;
            v.src = m.video;
            v.setAttribute('aria-label', 'Clip from ' + hike.name);
            v.addEventListener('loadeddata', () => v.classList.add('in'), { once: true });
            // The poster shows before the clip loads.
            const p = new Image();
            p.onload = () => v.classList.add('in');
            p.src = m.poster;
            b.appendChild(v);
            b.addEventListener('click', () => { if (v.paused) v.play().catch(() => {}); else v.pause(); });
            io.observe(v);
          } else {
            const img = h('img');
            img.loading = 'lazy';
            img.decoding = 'async';
            img.alt = m.note || hike.name;
            img.width = m.w;
            img.height = m.h;
            img.onload = () => img.classList.add('in');
            img.src = m.small || m.src;
            if (img.complete && img.naturalWidth) img.classList.add('in');
            b.appendChild(img);
            b.setAttribute('aria-label', 'Open photo from ' + hike.name);
            const i = photos.indexOf(m);
            b.addEventListener('click', () => { if (closeLb) closeLb(false); closeLb = lightbox(items, i, b); });
          }
          if (m.note) {
            const fig = h('figure', 'phk-fig');
            fig.append(b, h('figcaption', '', m.note));
            strip.appendChild(fig);
          } else strip.appendChild(b);
        }

        art.append(head, c, strip);
        list.appendChild(art);

        // The card follows the pointer while it's over the hike.
        const place = (e) => {
          if (!fine.matches) return;
          const w = c.offsetWidth, ht = c.offsetHeight;
          let x = e.clientX + 18, y = e.clientY + 18;
          if (x + w > innerWidth - 12) x = e.clientX - w - 18;
          if (y + ht > innerHeight - 12) y = Math.max(12, e.clientY - ht - 18);
          c.style.transform = `translate(${x}px, ${y}px)`;
        };
        art.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') { place(e); c.classList.add('on'); } }, { signal: ac.signal });
        art.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { place(e); c.classList.add('on'); } }, { signal: ac.signal });
        art.addEventListener('pointerleave', () => c.classList.remove('on'), { signal: ac.signal });
      }

      // Scrolling moves the hike out from under a still pointer without a leave event.
      addEventListener('scroll', () => list.querySelectorAll('.phk-card.on').forEach((c) => c.classList.remove('on')), { passive: true, signal: ac.signal });
      if (note) note.remove();
      el.appendChild(list);
    })
    .catch((err) => {
      if (ac.signal.aborted) return;
      if (note) note.textContent = 'The hikes did not load.';
      if (window.console) console.warn('hikes', err);
    });

  return function stop() {
    ac.abort();
    if (io) io.disconnect();
    if (closeLb) closeLb(false);
    list.querySelectorAll('video').forEach((v) => { v.pause(); v.removeAttribute('src'); v.load(); });
    list.remove();
    release();
  };
}
