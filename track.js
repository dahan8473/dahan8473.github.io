// What visitors do on davidliu.work, so David can see what works: pages,
// clicks on things the head knows (data-t), how far they scroll, how long they
// stay, and everything the head reports on window.dlBus (its lines, replies,
// overlays, demos, games). Batched to api/events.js every 10 seconds and when
// the tab is hidden or closed.
//
// Nothing is sent, or even collected, when the browser asks not to be
// tracked: Do Not Track or Global Privacy Control.

const API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '/api' : 'https://davidliu-work.vercel.app/api';
const OFF = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
const BUS = ['page', 'overlay_open', 'overlay_close', 'demo_open', 'demo_close', 'game_start', 'game_end', 'bring', 'line', 'line_done', 'line_cut', 'line_drop', 'reply'];
const BATCH_BYTES = 48000; // under sendBeacon's 64KB

if (!OFF && !window.dlTrack) {
  window.dlTrack = true;
  const queue = [];
  const now = () => Date.now();
  const norm = (p) => p.replace(/index\.html$/, '').replace(/([^/])$/, '$1/');
  const store = (s, k) => { try { return s.getItem(k); } catch (e) { return null; } };

  // Flat copies only: short strings, numbers, booleans. One level of nesting
  // is flattened ({ result: { score } } becomes result_score).
  const clean = (d) => {
    const out = {};
    if (!d || typeof d !== 'object') return out;
    const put = (k, v) => {
      if (typeof v === 'string') out[k] = v.slice(0, 300);
      else if ((typeof v === 'number' && isFinite(v)) || typeof v === 'boolean') out[k] = v;
    };
    for (const k of Object.keys(d).slice(0, 12)) {
      const v = d[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) for (const k2 of Object.keys(v).slice(0, 6)) put(k + '_' + k2, v[k2]);
      else put(k, v);
    }
    return out;
  };

  let path = norm(location.pathname);
  const push = (type, data) => {
    if (queue.length >= 500) queue.shift();
    queue.push({ type, at: now(), path, data: clean(data) });
  };

  // One page view: an id, visible time, and the furthest they scrolled.
  let pv, visibleMs, visibleSince, depth, pageAt;
  const measure = () => {
    const h = document.documentElement.scrollHeight;
    if (h) depth = Math.max(depth, Math.min(100, Math.round(((scrollY + innerHeight) / h) * 100)));
  };
  const begin = () => {
    pv = Math.random().toString(36).slice(2, 10);
    visibleMs = 0;
    visibleSince = document.hidden ? 0 : now();
    depth = 0;
    pageAt = now();
    setTimeout(measure, 600);
  };
  // Sent when they leave a page and whenever the tab hides; the server keeps
  // the furthest one per page view.
  const dwell = () => {
    const ms = visibleMs + (visibleSince ? now() - visibleSince : 0);
    push('dwell', { pv, ms: Math.round(ms), depth });
  };

  const visitor = () => {
    let v = store(localStorage, 'dl-visitor');
    if (!v && window.crypto && crypto.randomUUID) {
      v = crypto.randomUUID();
      try { localStorage.setItem('dl-visitor', v); } catch (e) { v = null; }
    }
    return v;
  };
  const convo = () => { try { return JSON.parse(store(sessionStorage, 'dl-talk') || '{}').convo || null; } catch (e) { return null; } };

  function flush(leaving) {
    const who = queue.length && visitor();
    if (!who) return;
    while (queue.length) {
      const events = [];
      let bytes = 200;
      while (queue.length && events.length < 200) {
        const size = JSON.stringify(queue[0]).length;
        if (events.length && bytes + size > BATCH_BYTES) break;
        events.push(queue.shift());
        bytes += size;
      }
      const body = JSON.stringify({ visitor: who, convo: convo(), sent: now(), events });
      // A string beacon goes as text/plain, so no CORS preflight.
      if (leaving && navigator.sendBeacon && navigator.sendBeacon(API + '/events', body)) continue;
      fetch(API + '/events', { method: 'POST', body, keepalive: body.length < 60000, headers: { 'content-type': 'text/plain' } }).catch(() => {});
    }
  }

  // Page swaps come from site.js (dl:page) and maybe the head's bus too; the
  // second one for the same swap is dropped.
  function onPage(p) {
    const next = norm(p || location.pathname);
    if (next === path && now() - pageAt < 2000) return;
    dwell();
    const from = path;
    path = next;
    begin();
    push('page', { from });
  }

  begin();
  let ref = '';
  try { ref = document.referrer && new URL(document.referrer).host !== location.host ? new URL(document.referrer).host : ''; } catch (e) {}
  push('page', ref ? { ref } : {});

  document.addEventListener('dl:page', (e) => onPage(e.detail && e.detail.path));
  addEventListener('scroll', measure, { passive: true });
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('[data-t]') : null;
    if (el) push('click', { t: el.getAttribute('data-t').slice(0, 60) });
  }, true);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (visibleSince) visibleMs += now() - visibleSince;
      visibleSince = 0;
      push('hidden');
      dwell();
      flush(true);
    } else {
      visibleSince = now();
      push('visible');
    }
  });
  addEventListener('pagehide', () => { dwell(); flush(true); });
  setInterval(() => flush(false), 10000);

  // The head's bus (talk/talk.js): dlBus.on(name, fn) calls fn(payload).
  // It may load after this, so look for it for a few seconds.
  let tries = 0;
  (function hook() {
    const bus = window.dlBus;
    if (bus && typeof bus.on === 'function') {
      for (const name of BUS) bus.on(name, (d) => (name === 'page' ? onPage(d && d.path) : push(name, d)));
    } else if (++tries < 40) setTimeout(hook, 250);
  })();
}
