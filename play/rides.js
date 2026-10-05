// Rides piece: a Strava-style log of my rides. The rides down the left, the map
// on the right with every path faint and the one you pick in orange, from its
// start (green) to its finish.
//   <div class="play" data-play="rides" data-src="/hobbies/cycling/rides.json">
//   rides.json: { "rides": [ { "id", "title", "start", "minutes", "km", "elev", "kind", "repeat", "path" } ] }
//   start is an ISO time with its offset ("2026-09-14T08:12:00-04:00"), path is [[lat, lng], ...].
//   km is worked out from the path when it's missing. kind "commute" with a repeat line ("Every school day")
//   is one entry for a ride done over and over.
// Leaflet is vendored in /play/vendor/leaflet/; the map tiles are CARTO's (OpenStreetMap data), light or dark
// with the site.

const CSS_ID = 'play-rides-css';
const LEAFLET = '/play/vendor/leaflet/';
const ORANGE = '#fc4c02';
const HOME = [43.0096, -81.2737]; // London, Ontario: Western
const TILES = {
  light: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>';

const CSS = `
.rides { display: grid; grid-template-columns: 300px minmax(0, 1fr); height: 560px; border-radius: 16px; overflow: hidden; box-shadow: 0 0 0 1px var(--rule); background: var(--bg); }
.rides-side { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--rule); }
.rides-top { padding: 14px 16px 12px; border-bottom: 1px solid var(--rule); }
.rides-tot { display: flex; gap: 16px; }
.rides-tot div { display: flex; flex-direction: column-reverse; }
.rides-tot b { color: var(--t1); font-weight: 500; }
.rides-tot span { color: var(--t3); }
.rides-all { margin-top: 10px; padding: 0; border: 0; background: none; color: var(--t2); font: inherit; cursor: pointer; }
.rides-all:hover, .rides-all[aria-pressed="true"] { color: var(--t1); }
.rides-list { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; }
.ride { display: block; width: 100%; padding: 12px 16px; border: 0; border-bottom: 1px solid var(--rule); background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; transition: background 150ms ease; }
.ride:hover { background: var(--fill); }
.ride[aria-pressed="true"] { background: var(--fill); box-shadow: inset 3px 0 0 ${ORANGE}; }
.ride-when { color: var(--t3); }
.ride-name { color: var(--t1); }
.ride-stats { display: flex; flex-wrap: wrap; gap: 0 14px; margin-top: 2px; color: var(--t2); }
.ride-tag { display: inline-block; margin-left: 6px; padding: 0 7px; border-radius: 999px; background: var(--fill); color: var(--t2); }
.rides-map { position: relative; min-width: 0; min-height: 0; }
.rides-map .leaflet-container { width: 100%; height: 100%; background: var(--fill); font: inherit; }
.rides-card { position: absolute; z-index: 500; left: 14px; top: 14px; max-width: calc(100% - 28px); padding: 10px 14px; border-radius: 12px; background: var(--panel); box-shadow: 0 0 0 1px var(--rule), 0 10px 30px -12px rgba(0, 0, 0, 0.35); -webkit-backdrop-filter: saturate(180%) blur(20px); backdrop-filter: saturate(180%) blur(20px); pointer-events: none; }
.rides-card[hidden] { display: none; }
.rides-card p { margin: 0; }
.rides-card .t { color: var(--t1); }
.rides-card .w { color: var(--t3); }
.rides-card .s { color: var(--t2); }
.rides-empty { display: grid; place-content: center; height: 100%; padding: 24px; color: var(--t3); text-align: center; }
.rides-hint { position: absolute; z-index: 500; right: 12px; bottom: 26px; padding: 4px 10px; border-radius: 999px; background: var(--panel); color: var(--t2); pointer-events: none; opacity: 0; transition: opacity 200ms ease; }
.rides-hint.on { opacity: 1; }
.rides-map .leaflet-control-attribution { background: var(--panel); color: var(--t3); font-size: 11px; }
.rides-map .leaflet-control-attribution a { color: var(--t2); }
.rides-map .leaflet-bar a { background: var(--panel); color: var(--t1); border-color: var(--rule); }
.rides-map .leaflet-bar { border: 0; box-shadow: 0 0 0 1px var(--rule); }
@media (max-width: 720px) {
  .rides { grid-template-columns: 1fr; grid-template-rows: 340px auto; height: auto; }
  .rides-side { order: 2; border-right: 0; border-top: 1px solid var(--rule); }
  .rides-list { max-height: 360px; }
  .rides-map { order: 1; }
}
`;

function useCss() {
  let s = document.getElementById(CSS_ID);
  if (!s) {
    s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  s.dataset.users = String((Number(s.dataset.users) || 0) + 1);
  return () => {
    const n = (Number(s.dataset.users) || 1) - 1;
    s.dataset.users = String(n);
    if (!n) s.remove();
  };
}

// Leaflet once per page load: its CSS and its UMD build, which sets window.L.
let leaflet = null;
function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leaflet) return leaflet;
  leaflet = new Promise((resolve, reject) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET + 'leaflet.css';
    document.head.appendChild(link);
    const s = document.createElement('script');
    s.src = LEAFLET + 'leaflet.js';
    s.onload = () => resolve(window.L);
    s.onerror = () => { leaflet = null; reject(new Error('leaflet')); };
    document.head.appendChild(s);
  });
  return leaflet;
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function km(path) {
  const R = 6371, rad = Math.PI / 180;
  let d = 0;
  for (let i = 1; i < path.length; i++) {
    const [a, b] = path[i - 1], [c, e] = path[i];
    const x = Math.sin(((c - a) * rad) / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((e - b) * rad) / 2) ** 2;
    d += 2 * R * Math.asin(Math.sqrt(x));
  }
  return d;
}
function hm(min) {
  if (!(min > 0)) return '';
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
// The date and time the ride started, in the time zone it started in.
function when(iso) {
  const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  const day = d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  if (!m[4]) return day;
  const h = +m[4];
  return `${day} · ${((h + 11) % 12) + 1}:${m[5]} ${h < 12 ? 'AM' : 'PM'}`;
}
function clean(r, i) {
  const path = Array.isArray(r.path) ? r.path.filter((p) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])) : [];
  return {
    id: r.id || 'ride-' + i,
    title: String(r.title || 'Ride'),
    start: String(r.start || ''),
    minutes: Number(r.minutes) || 0,
    km: Number(r.km) || (path.length > 1 ? km(path) : 0),
    elev: Number(r.elev) || 0,
    kind: r.kind === 'commute' ? 'commute' : 'ride',
    repeat: r.repeat ? String(r.repeat) : '',
    path
  };
}
const stats = (r) => [r.km ? r.km.toFixed(1) + ' km' : '', hm(r.minutes), r.elev ? Math.round(r.elev) + ' m up' : ''].filter(Boolean);

export function mount(el) {
  const release = useCss();
  const dark = () => document.documentElement.getAttribute('data-theme') === 'dark';
  const root = document.createElement('div');
  root.className = 'rides';
  root.innerHTML = '<div class="rides-side"><div class="rides-top"></div><div class="rides-list" role="list"></div></div>' +
    '<div class="rides-map"><div class="rides-card" hidden></div><p class="rides-hint">Click the map to zoom with scroll</p></div>';
  el.querySelector('.piece-note')?.remove();
  el.appendChild(root);
  const top = root.querySelector('.rides-top');
  const list = root.querySelector('.rides-list');
  const mapEl = root.querySelector('.rides-map');
  const card = root.querySelector('.rides-card');
  const hint = root.querySelector('.rides-hint');

  let alive = true;
  let map = null, tiles = null, lines = new Map(), ends = null, rides = [], picked = null;
  const theme = new MutationObserver(() => { if (map && tiles) tiles.setUrl(TILES[dark() ? 'dark' : 'light']); restyle(); });
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const faint = () => (dark() ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.32)');
  function restyle() {
    lines.forEach((line, id) => {
      const on = picked === id;
      line.setStyle({ color: on ? ORANGE : faint(), weight: on ? 4 : 2.5, opacity: picked && !on ? 0.5 : 0.9 });
      if (on) line.bringToFront();
    });
  }
  function bounds(rs) {
    const pts = rs.flatMap((r) => r.path);
    return pts.length ? window.L.latLngBounds(pts) : null;
  }
  function show(id, fly = true) {
    picked = id;
    list.querySelectorAll('.ride').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
    top.querySelector('.rides-all')?.setAttribute('aria-pressed', String(!id));
    if (!map) return;
    if (ends) { ends.remove(); ends = null; }
    restyle();
    const r = rides.find((x) => x.id === id);
    if (r && r.path.length) {
      ends = window.L.layerGroup([
        window.L.circleMarker(r.path[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#2ecc71', fillOpacity: 1 }),
        window.L.circleMarker(r.path[r.path.length - 1], { radius: 6, color: '#fff', weight: 2, fillColor: '#e74c3c', fillOpacity: 1 })
      ]).addTo(map);
      card.innerHTML = `<p class="t">${esc(r.title)}</p><p class="w">${esc(r.repeat || when(r.start))}</p><p class="s">${esc(stats(r).join(' · '))}</p>`;
      card.hidden = false;
    } else card.hidden = true;
    const b = bounds(r ? [r] : rides);
    if (b && fly) map.flyToBounds(b, { padding: [36, 36], duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.8, maxZoom: 15 });
  }

  function renderList() {
    const total = rides.reduce((s, r) => s + r.km, 0);
    const longest = rides.reduce((m, r) => Math.max(m, r.km), 0);
    top.innerHTML = rides.length
      ? `<div class="rides-tot"><div><b>${total.toFixed(0)} km</b><span>logged here</span></div><div><b>${rides.length}</b><span>rides</span></div><div><b>${longest.toFixed(0)} km</b><span>longest</span></div></div>` +
        '<button class="rides-all" type="button" aria-pressed="true">Show all rides</button>'
      : '<p class="ride-when">Rides going up soon.</p>';
    list.innerHTML = rides.map((r) => `<button class="ride" type="button" role="listitem" data-id="${esc(r.id)}" aria-pressed="false">` +
      `<span class="ride-when">${esc(r.repeat || when(r.start))}</span><br>` +
      `<span class="ride-name">${esc(r.title)}</span>${r.kind === 'commute' ? '<span class="ride-tag">Commute</span>' : ''}` +
      `<span class="ride-stats">${stats(r).map((s) => `<span>${esc(s)}</span>`).join('')}</span></button>`).join('');
  }
  root.addEventListener('click', (e) => {
    const b = e.target.closest('.ride');
    if (b) { show(picked === b.dataset.id ? null : b.dataset.id); return; }
    if (e.target.closest('.rides-all')) show(null);
  });
  root.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.ride');
    const line = b && lines.get(b.dataset.id);
    if (line && picked !== b.dataset.id) line.setStyle({ color: ORANGE, opacity: 0.7 });
  });
  root.addEventListener('pointerout', (e) => {
    const b = e.target.closest('.ride');
    if (b && !b.contains(e.relatedTarget)) restyle();
  });

  const src = el.dataset.src || '/hobbies/cycling/rides.json';
  Promise.all([fetch(src).then((r) => (r.ok ? r.json() : { rides: [] })).catch(() => ({ rides: [] })), loadLeaflet().catch(() => null)])
    .then(([data, L]) => {
      if (!alive) return;
      rides = (Array.isArray(data.rides) ? data.rides : []).map(clean)
        .sort((a, b) => (a.kind === 'commute') - (b.kind === 'commute') || b.start.localeCompare(a.start));
      renderList();
      if (!L) { mapEl.innerHTML = '<p class="rides-empty">The map couldn\'t load.</p>'; return; }
      map = L.map(mapEl, { zoomControl: false, scrollWheelZoom: false, attributionControl: true, zoomSnap: 0.25 }).setView(HOME, 12);
      L.control.zoom({ position: 'topright' }).addTo(map);
      map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
      tiles = L.tileLayer(TILES[dark() ? 'dark' : 'light'], { attribution: ATTR, subdomains: 'abcd', maxZoom: 19, detectRetina: true }).addTo(map);
      // The page keeps scrolling past the map until you click into it.
      map.on('click', () => map.scrollWheelZoom.enable());
      map.on('mouseout', () => map.scrollWheelZoom.disable());
      mapEl.addEventListener('wheel', () => {
        if (map.scrollWheelZoom.enabled()) return;
        hint.classList.add('on');
        clearTimeout(hint._t);
        hint._t = setTimeout(() => hint.classList.remove('on'), 1200);
      }, { passive: true });
      rides.forEach((r) => {
        if (r.path.length < 2) return;
        const line = L.polyline(r.path, { color: faint(), weight: 2.5, opacity: 0.9, lineJoin: 'round' }).addTo(map);
        line.on('click', () => show(r.id));
        lines.set(r.id, line);
      });
      const b = bounds(rides);
      if (b) map.fitBounds(b, { padding: [30, 30] });
      show(null, false);
    });

  return function stop() {
    alive = false;
    theme.disconnect();
    if (map) map.remove();
    root.remove();
    release();
  };
}
