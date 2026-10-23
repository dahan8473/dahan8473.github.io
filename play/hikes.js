// Hikes piece: one row per hike, newest first, a strip of photos and clips
// under each, with a note under the photos that have one. Hover a hike for the
// trail's numbers and my day (total time where I know it, first and last photo,
// highest altitude). Phones get the numbers inline under the name.
//   <div class="play" data-play="hikes" data-src="/hobbies/hiking/hikes.json">
//   hikes.json: { "hikes": [ { id, name, where, date, trail: { distance, gain,
//     top, time, note }, me: { first, last, high }, media: [ { src, small, w, h }
//     | { video, poster, w, h } ], each with an optional note shown under it } ] }
// Photos and clips open in the gallery's lightbox. Clips loop muted while they're
// the one on screen (gallery.js clipWatch); phones get the poster and a play mark.

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
.phk-item.clip { position: relative; }
.phk-mark { position: absolute; left: 50%; top: 50%; display: grid; place-items: center; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: rgba(0, 0, 0, 0.48); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); color: #fff; pointer-events: none; }
.phk-mark svg { width: 17px; height: 17px; margin-left: 3px; fill: currentColor; }
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
  let release = () => {};
  const ac = new AbortController();
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  let closeLb = null;
  let watch = null;

  const list = h('div', 'phk');
  const note = el.querySelector('.piece-note');

  // gallery.js has the lightbox; load it with the same ?v= as this file.
  const gal = import('./gallery.js' + new URL(import.meta.url).search);
  Promise.all([gal, fetch(el.dataset.src || '/hobbies/hiking/hikes.json', { signal: ac.signal }).then((r) => r.json())])
    .then(([{ useCss, fmtDate, lightbox, clipWatch }, data]) => {
      if (ac.signal.aborted) return;
      release = useCss(CSS_ID, CSS);
      const hikes = Array.isArray(data && data.hikes) ? data.hikes : [];
      watch = clipWatch();

      for (const hike of hikes) {
        const art = h('article', 'phk-hike');
        art.dataset.t = 'hike-' + hike.id;
        const head = h('div', 'phk-head');
        head.append(h('h3', 'phk-name', hike.name), h('span', 'phk-where', hike.where), h('span', 'phk-date', fmtDate(hike.date)));
        const c = card(hike);
        const strip = h('div', 'phk-strip');
        const all = hike.media || [];
        const meta = [hike.where, fmtDate(hike.date)].join(' · ');
        const items = all.map((m) => (m.video
          ? { video: m.video, poster: m.poster, alt: m.note || 'Clip from ' + hike.name, caption: m.note || hike.name, meta }
          : { src: m.src, alt: m.note || hike.name, caption: m.note || hike.name, meta }));
        const open = (i, b) => { if (closeLb) closeLb(false); closeLb = lightbox(items, i, b); };

        for (const m of hike.media || []) {
          const b = h('button', 'phk-item' + (m.video ? ' clip' : ''));
          b.type = 'button';
          b.style.aspectRatio = m.w + ' / ' + m.h;
          if (m.video) {
            const v = h('video');
            v.setAttribute('aria-label', 'Clip from ' + hike.name);
            v.addEventListener('loadeddata', () => v.classList.add('in'), { once: true });
            watch.add(v, m.video, m.poster);
            b.appendChild(v);
            // Phones: a still poster, so mark it as a clip. A tap opens it in the lightbox.
            if (watch.tapOnly) {
              const mark = h('span', 'phk-mark');
              mark.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z"/></svg>';
              b.appendChild(mark);
            }
            b.setAttribute('aria-label', 'Open clip from ' + hike.name);
            b.addEventListener('click', () => open(all.indexOf(m), b));
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
            b.addEventListener('click', () => open(all.indexOf(m), b));
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
    if (watch) watch.stop();
    if (closeLb) closeLb(false);
    list.remove();
    release();
  };
}
