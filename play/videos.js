// Video list piece: lite embeds for YouTube and Instagram. A poster until you
// press play, then the real player, so nothing third party loads up front.
//   <div class="play" data-play="videos" data-src="/hobbies/video/videos.json">
//   videos.json: { "videos": [
//     { "youtube": "<id>", "title", "date", "note" },
//     { "instagram": "<shortcode>", "title", "date", "note" } ] }
// youtube takes an id or a pasted link. instagram takes the shortcode from
// instagram.com/reel/<shortcode>/ (a reel) or a pasted /reel/ or /p/ link.
// YouTube runs sit in a 16:9 grid, Instagram runs in a 9:16 grid; order is kept.
// A dl:footage event on document scrolls the list into view.

const CSS_ID = 'play-videos-css';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const CSS = `
.pvid { scroll-margin-top: 28px; }
.pvid-group + .pvid-group { margin-top: 40px; }
.pvid-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 16px; }
.pvid-grid.one { grid-template-columns: minmax(0, 1fr); }
.pvid-reels { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-flow: row dense; gap: 28px 14px; }
.pvid-frame { position: relative; aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; background: var(--fill); }
.pvid-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.pvid-play { position: absolute; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: none; color: #fff; font: inherit; letter-spacing: inherit; cursor: pointer; }
.pvid-play:focus-visible { border-radius: 14px; outline-offset: -3px; }
.pvid-play img { width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 320ms ease; }
.pvid-play img.in { opacity: 1; }
.pvid-btn {
  position: absolute; left: 50%; top: 50%;
  display: grid; place-items: center;
  width: 60px; height: 60px; margin: -30px 0 0 -30px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.48);
  -webkit-backdrop-filter: blur(10px);
  backdrop-filter: blur(10px);
  transition: background 180ms ease, color 180ms ease, transform 180ms ease;
}
.pvid-btn svg { width: 22px; height: 22px; margin-left: 3px; fill: currentColor; }
@media (hover: hover) { .pvid-play:hover .pvid-btn { background: #88c0d0; color: #0d0d0e; transform: scale(1.04); } }
.pvid-play:focus-visible .pvid-btn { background: #88c0d0; color: #0d0d0e; }
.pvid-text { padding: 10px 2px 0; }
.pvid-row { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0 16px; }
.pvid-title { min-width: 0; color: var(--t1); }
.pvid-date { flex: none; margin-left: auto; color: var(--t3); white-space: nowrap; }
.pvid-note { margin-top: 2px; color: var(--t2); }

/* Instagram: a vertical card. There's no thumbnail without their API, so it's a
   quiet card unless the entry has a "poster" image. */
.pvid-reel .pvid-frame { aspect-ratio: 9 / 16; box-shadow: inset 0 0 0 1px var(--rule); background: linear-gradient(165deg, var(--fill), transparent 75%), var(--fill); }
.pvid-reel .pvid-btn { width: 52px; height: 52px; margin: -26px 0 0 -26px; }
.pvid-reel .pvid-btn svg { width: 19px; height: 19px; }
.pvid-tag { position: absolute; left: 14px; top: 12px; display: inline-flex; align-items: center; gap: 6px; color: var(--t3); }
.pvid-tag svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.pvid-reel .pvid-play.has-poster .pvid-tag { color: rgba(255, 255, 255, 0.86); }
.pvid-reel .pvid-play.has-poster::after { content: ''; position: absolute; inset: 0 0 auto; height: 64px; background: linear-gradient(rgba(0, 0, 0, 0.32), transparent); pointer-events: none; }
.pvid-reel .pvid-play.has-poster .pvid-tag { z-index: 1; }
.pvid-cover { position: absolute; left: 0; right: 0; bottom: 0; z-index: 1; padding: 48px 14px 13px; text-align: left; }
.pvid-cover span { display: block; }
.pvid-cover .t { color: var(--t1); }
.pvid-cover .d { color: var(--t3); }
.pvid-play.has-poster .pvid-cover { background: linear-gradient(transparent, rgba(0, 0, 0, 0.6)); }
.pvid-play.has-poster .pvid-cover .t { color: #fff; }
.pvid-play.has-poster .pvid-cover .d { color: rgba(255, 255, 255, 0.7); }
.pvid-reel:not(.live) .pvid-row { display: none; }
.pvid-reel.live { grid-column: 1 / -1; display: flex; align-items: flex-start; gap: 24px; }
.pvid-reel.live .pvid-frame { flex: none; width: min(100%, 400px); aspect-ratio: auto; height: min(84vh, 760px); height: min(84svh, 760px); background: #fff; }
.pvid-reel.live .pvid-text { padding-top: 4px; }

.pvid-empty { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 14px; background: var(--fill); color: var(--t2); }
.pvid-empty svg { flex: none; width: 22px; height: 22px; fill: none; stroke: var(--t3); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.pvid-loading { aspect-ratio: 32 / 9; border-radius: 14px; background: var(--fill); }
@media (max-width: 900px) {
  .pvid-reels { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (max-width: 720px) {
  .pvid { scroll-margin-top: 74px; }
  .pvid-grid { grid-template-columns: minmax(0, 1fr); gap: 28px; }
  .pvid-reels { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 10px; }
  .pvid-frame, .pvid-play:focus-visible { border-radius: 12px; }
  .pvid-btn { width: 52px; height: 52px; margin: -26px 0 0 -26px; }
  .pvid-reel .pvid-btn { width: 44px; height: 44px; margin: -22px 0 0 -22px; }
  .pvid-tag { left: 10px; top: 9px; }
  .pvid-cover { padding: 40px 10px 10px; }
  .pvid-reel.live { display: block; }
  .pvid-reel.live .pvid-frame { width: 100%; height: min(80svh, 680px); }
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
const PLAY = 'M7 4.8v14.4a1 1 0 0 0 1.5.86l12-7.2a1 1 0 0 0 0-1.72l-12-7.2A1 1 0 0 0 7 4.8z';
const FILM = 'M5 5.5h14A1.5 1.5 0 0 1 20.5 7v10a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 17V7A1.5 1.5 0 0 1 5 5.5zM10.25 9.5v5l4.25-2.5z';
const INSTA = 'M8 3.5h8A4.5 4.5 0 0 1 20.5 8v8a4.5 4.5 0 0 1-4.5 4.5H8A4.5 4.5 0 0 1 3.5 16V8A4.5 4.5 0 0 1 8 3.5zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM16.9 7.1h.01';

function fmtDate(s) {
  if (!s) return '';
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(String(s).trim());
  const mon = m && MONTHS[Number(m[2]) - 1];
  if (!mon) return String(s);
  return m[3] ? mon + ' ' + Number(m[3]) + ', ' + m[1] : mon + ' ' + m[1];
}
// A bare id, or a pasted youtube.com / youtu.be link.
function youtubeId(v) {
  const s = String(v || '').trim();
  const m = /(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{6,20})/.exec(s);
  const id = m ? m[1] : s;
  return /^[\w-]{6,20}$/.test(id) ? id : '';
}
// A bare shortcode (a reel), or a pasted /reel/, /reels/, /tv/ or /p/ link.
function instagramRef(v) {
  const s = String(v || '').trim();
  const m = /instagram\.com\/(?:[\w.]+\/)?(reels?|tv|p)\/([\w-]{5,40})/.exec(s);
  if (m) return { kind: m[1] === 'p' ? 'p' : 'reel', code: m[2] };
  return /^[\w-]{5,40}$/.test(s) ? { kind: 'reel', code: s } : null;
}
function noteText(el, fallback) {
  const n = el.querySelector('.piece-note');
  const t = n ? n.textContent.trim() : '';
  return t && !/^loading/i.test(t) ? t : fallback;
}

export function mount(el) {
  const release = useCss(CSS_ID, CSS);
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const emptyNote = noteText(el, 'Videos coming soon.');
  const root = h('div', 'pvid');
  root.appendChild(h('div', 'pvid-loading'));
  el.appendChild(root);

  let alive = true;
  let liveReel = null;
  const ctrl = new AbortController();

  function textBlock(v) {
    const date = fmtDate(v.date);
    if (!v.title && !date && !v.note) return null;
    const text = h('div', 'pvid-text');
    if (v.title || date) {
      const row = h('p', 'pvid-row');
      if (v.title) row.appendChild(h('span', 'pvid-title', v.title));
      if (date) row.appendChild(h('span', 'pvid-date', date));
      text.appendChild(row);
    }
    if (v.note) text.appendChild(h('p', 'pvid-note', v.note));
    return text;
  }

  function playButton(v, label) {
    const btn = h('button', 'pvid-play');
    btn.type = 'button';
    btn.setAttribute('aria-label', v.title ? 'Play ' + v.title : label);
    return btn;
  }
  function ring() {
    const r = h('span', 'pvid-btn');
    r.appendChild(icon(PLAY));
    return r;
  }

  function youtubeItem(v) {
    const li = h('li', 'pvid-item');
    const frame = h('div', 'pvid-frame');
    const btn = playButton(v, 'Play video');
    const img = h('img');
    img.loading = 'lazy';
    img.decoding = 'async';
    img.alt = '';
    img.addEventListener('load', () => img.classList.add('in'));
    img.src = 'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg';
    btn.append(img, ring());
    btn.addEventListener('click', () => {
      const f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + v.id + '?autoplay=1';
      f.title = v.title || 'YouTube video';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      f.allowFullscreen = true;
      btn.replaceWith(f);
      f.focus({ preventScroll: true });
    });
    frame.appendChild(btn);
    li.appendChild(frame);
    const text = textBlock(v);
    if (text) li.appendChild(text);
    return li;
  }

  function reelPoster(v, li, frame) {
    const btn = playButton(v, v.kind === 'p' ? 'Play Instagram post' : 'Play Instagram reel');
    if (v.poster) {
      btn.classList.add('has-poster');
      const img = h('img');
      img.loading = 'lazy';
      img.decoding = 'async';
      img.alt = '';
      img.addEventListener('load', () => img.classList.add('in'));
      img.src = v.poster;
      btn.appendChild(img);
    }
    const tag = h('span', 'pvid-tag');
    tag.append(icon(INSTA), h('span', null, v.kind === 'p' ? 'post' : 'reel'));
    btn.append(tag, ring());
    const date = fmtDate(v.date);
    if (v.title || date) {
      const cover = h('span', 'pvid-cover');
      cover.setAttribute('aria-hidden', 'true');
      if (v.title) cover.appendChild(h('span', 't', v.title));
      if (date) cover.appendChild(h('span', 'd', date));
      btn.appendChild(cover);
    }
    btn.addEventListener('click', () => playReel(v, li, frame));
    return btn;
  }

  // Instagram's player wants about 330px of width, so a playing reel takes its
  // own row. One at a time: starting another puts the last one back.
  function playReel(v, li, frame) {
    if (liveReel && liveReel.li !== li) liveReel.stop();
    const f = document.createElement('iframe');
    f.src = 'https://www.instagram.com/' + v.kind + '/' + v.code + '/embed';
    f.title = v.title || (v.kind === 'p' ? 'Instagram post' : 'Instagram reel');
    f.allow = 'autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share';
    f.allowFullscreen = true;
    frame.textContent = '';
    frame.appendChild(f);
    li.classList.add('live');
    liveReel = {
      li,
      frame: f,
      stop() {
        li.classList.remove('live');
        frame.style.height = '';
        frame.textContent = '';
        frame.appendChild(reelPoster(v, li, frame));
        if (liveReel && liveReel.li === li) liveReel = null;
      }
    };
    f.focus({ preventScroll: true });
    li.scrollIntoView({ block: 'nearest', behavior: reduce.matches ? 'auto' : 'smooth' });
  }
  // Instagram's embed reports its height; fit the frame to it when it does.
  function onMessage(e) {
    if (!liveReel || e.origin !== 'https://www.instagram.com' || e.source !== liveReel.frame.contentWindow) return;
    let d = e.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (err) { return; } }
    const hgt = d && d.type === 'MEASURE' && d.details && Number(d.details.height);
    if (hgt > 200) liveReel.li.querySelector('.pvid-frame').style.height = Math.min(hgt, window.innerHeight * 0.86) + 'px';
  }
  window.addEventListener('message', onMessage);

  function reelItem(v) {
    const li = h('li', 'pvid-item pvid-reel');
    const frame = h('div', 'pvid-frame');
    frame.appendChild(reelPoster(v, li, frame));
    li.appendChild(frame);
    const text = textBlock(v);
    if (text) li.appendChild(text);
    return li;
  }

  function render(list) {
    root.textContent = '';
    if (!list.length) {
      const box = h('div', 'pvid-empty');
      box.append(icon(FILM), h('span', null, emptyNote));
      root.appendChild(box);
      return;
    }
    // Consecutive runs of the same kind share a grid, so 16:9 and 9:16 never mix in a row.
    const runs = [];
    list.forEach((v) => {
      const last = runs[runs.length - 1];
      if (last && last.type === v.type) last.items.push(v);
      else runs.push({ type: v.type, items: [v] });
    });
    runs.forEach((run) => {
      const ul = h('ul', 'pvid-group ' + (run.type === 'ig' ? 'pvid-reels' : 'pvid-grid' + (list.length === 1 ? ' one' : '')));
      run.items.forEach((v) => ul.appendChild(run.type === 'ig' ? reelItem(v) : youtubeItem(v)));
      root.appendChild(ul);
    });
  }

  function onFootage() {
    root.scrollIntoView({ block: 'start', behavior: reduce.matches ? 'auto' : 'smooth' });
  }
  document.addEventListener('dl:footage', onFootage);

  const src = el.dataset.src;
  (src ? fetch(src, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : {})) : Promise.resolve({}))
    .catch(() => ({}))
    .then((data) => {
      if (!alive) return;
      const raw = data && Array.isArray(data.videos) ? data.videos : [];
      const list = [];
      raw.forEach((v) => {
        if (!v) return;
        const base = { title: v.title ? String(v.title) : '', date: v.date, note: v.note ? String(v.note) : '' };
        const yt = v.youtube && youtubeId(v.youtube);
        const ig = !yt && v.instagram && instagramRef(v.instagram);
        if (yt) list.push({ ...base, type: 'yt', id: yt });
        else if (ig) list.push({ ...base, type: 'ig', kind: ig.kind, code: ig.code, poster: typeof v.poster === 'string' ? v.poster : '' });
      });
      render(list);
    });

  return function stop() {
    alive = false;
    ctrl.abort();
    liveReel = null;
    document.removeEventListener('dl:footage', onFootage);
    window.removeEventListener('message', onMessage);
    root.remove();
    release();
  };
}
