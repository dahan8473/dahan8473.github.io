// The admin portal's two pages: the login and the dashboard. One HTML
// response each, no outside files, so the CSP can be strict: only the inline
// script and style carrying this response's nonce run. Everything a visitor
// typed is put on the page with textContent, never as HTML.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const HEAD = (nonce, title) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="referrer" content="same-origin">
<title>${esc(title)}</title>
<link rel="icon" href="data:,">
<script nonce="${nonce}">try{var t=localStorage.getItem('admin-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<style nonce="${nonce}">${CSS}</style>
</head>`;

export function loginPage(nonce, { ready, error = '', base = '' }) {
  return `${HEAD(nonce, 'Admin')}
<body class="login">
<main class="card">
  <p class="t3">davidliu.work</p>
  <h1>Admin</h1>
  ${ready
    ? `<form method="post" action="${esc(base)}/login" autocomplete="on">
    <input type="text" name="username" value="david" autocomplete="username" hidden>
    <label class="t3" for="pw">Password</label>
    <input id="pw" class="in" type="password" name="password" autocomplete="current-password" required autofocus>
    <button class="btn primary" type="submit">Log in</button>
  </form>`
    : '<p class="t2">Login is off until <code>ADMIN_PASSWORD</code> is set on Vercel.</p>'}
  ${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
</main>
</body>
</html>`;
}

export function dashboardPage(nonce, { base = '' } = {}) {
  return `${HEAD(nonce, 'Admin · davidliu.work')}
<body>
<header class="bar">
  <a class="brand" href="#overview">davidliu.work <span class="t3">admin</span></a>
  <nav class="tabs" aria-label="Sections">
    <a href="#overview" data-v="overview">Overview</a>
    <a href="#visitors" data-v="visitors">Visitors</a>
    <a href="#chats" data-v="chats">Chats</a>
    <a href="#behavior" data-v="behavior">Behavior</a>
    <a href="#lines" data-v="lines">Lines</a>
    <a href="#learning" data-v="learning">Learning <span class="badge" id="pending" hidden></span></a>
    <a href="#inbox" data-v="inbox">Inbox</a>
  </nav>
  <div class="tools">
    <button class="btn ghost" id="theme" type="button" aria-label="Switch light or dark">◐</button>
    <form method="post" action="${esc(base)}/logout"><button class="btn ghost" type="submit">Log out</button></form>
  </div>
</header>
<div class="banner" id="banner" role="status" hidden></div>
<main id="view" class="wrap"></main>
<div class="tip" id="tip" role="tooltip" hidden></div>
<script nonce="${nonce}">(${client.toString()})(${JSON.stringify(base).replace(/</g, '\\u003c')});</script>
</body>
</html>`;
}

const CSS = `
:root{--bg:#fbfbfd;--card:#fff;--t1:rgba(0,0,0,.86);--t2:rgba(0,0,0,.54);--t3:rgba(0,0,0,.36);--rule:rgba(0,0,0,.08);--fill:rgba(0,0,0,.04);--accent:#88c0d0;--mark:#5a9cb0;--ink-on-accent:#0d0d0e;--err:#c0392b;color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]){--bg:#0d0d0e;--card:#151517;--t1:rgba(255,255,255,.9);--t2:rgba(255,255,255,.58);--t3:rgba(255,255,255,.36);--rule:rgba(255,255,255,.1);--fill:rgba(255,255,255,.06);--mark:#88c0d0;--err:#ff8a7a;color-scheme:dark}}
:root[data-theme=dark]{--bg:#0d0d0e;--card:#151517;--t1:rgba(255,255,255,.9);--t2:rgba(255,255,255,.58);--t3:rgba(255,255,255,.36);--rule:rgba(255,255,255,.1);--fill:rgba(255,255,255,.06);--mark:#88c0d0;--err:#ff8a7a;color-scheme:dark}
*,*::before,*::after{box-sizing:border-box}
[hidden]{display:none!important}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--t1);font:400 14px/1.5 -apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',system-ui,sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased;font-variant-numeric:tabular-nums;padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0)}
h1,h2,h3,p{margin:0}
h1{font-size:22px;font-weight:600;letter-spacing:-.02em}
h2{font-size:14px;font-weight:600}
a{color:inherit;text-decoration:none}
a:hover{color:var(--t1)}
code{font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--t2)}
.t2{color:var(--t2)}.t3{color:var(--t3)}
.num{text-align:right;white-space:nowrap}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}
.bar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:20px;padding:10px max(16px,env(safe-area-inset-right,0)) 10px max(16px,env(safe-area-inset-left,0));background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid var(--rule)}
.brand{font-weight:600;white-space:nowrap}
.tabs{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}
.tabs::-webkit-scrollbar{display:none}
.tabs a{padding:6px 10px;border-radius:8px;color:var(--t2);white-space:nowrap}
.tabs a:hover{background:var(--fill);color:var(--t1)}
.tabs a.on{color:var(--t1);background:var(--fill);font-weight:500}
.badge{display:inline-block;min-width:18px;padding:0 5px;margin-left:2px;border-radius:9px;background:var(--accent);color:var(--ink-on-accent);font-size:11px;font-weight:600;line-height:18px;text-align:center}
.tools{display:flex;gap:6px;align-items:center}
.tools form{margin:0}
.btn{font:inherit;color:var(--t1);background:var(--fill);border:1px solid var(--rule);border-radius:8px;padding:6px 12px;cursor:pointer;white-space:nowrap}
.btn:hover{border-color:var(--t3)}
.btn.ghost{background:none;border-color:transparent;color:var(--t2)}
.btn.ghost:hover{color:var(--t1);background:var(--fill)}
.btn.primary{background:var(--accent);border-color:var(--accent);color:var(--ink-on-accent);font-weight:500}
.btn.primary:hover{filter:brightness(1.06)}
.btn.small{padding:3px 9px;font-size:13px}
.btn:disabled{opacity:.5;cursor:default}
.in{font:inherit;color:var(--t1);background:var(--card);border:1px solid var(--rule);border-radius:8px;padding:7px 10px;width:100%}
.in:focus{outline:none;border-color:var(--accent)}
textarea.in{resize:vertical;min-height:64px;line-height:1.45}
select.in{width:auto}
.banner{margin:12px max(16px,env(safe-area-inset-left,0)) 0;padding:10px 14px;border-radius:10px;background:var(--fill);border:1px solid var(--rule);color:var(--t2)}
.banner b{color:var(--t1);font-weight:600}
.wrap{max-width:1180px;margin:0 auto;padding:24px max(16px,env(safe-area-inset-right,0)) 64px max(16px,env(safe-area-inset-left,0))}
.phead{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}
.sub{color:var(--t2);margin-top:2px}
.sec{margin-top:28px}
.sec>h2{margin-bottom:10px;display:flex;gap:8px;align-items:baseline}
.sec>h2 .t3{font-weight:400}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:0 32px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:10px}
.tile{display:block;background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:12px 14px}
a.tile:hover{border-color:var(--t3)}
.tile .k{color:var(--t3);font-size:12px}
.tile .v{font-size:26px;font-weight:600;letter-spacing:-.02em;line-height:1.25;margin-top:2px}
.tile .s{color:var(--t2);font-size:12px}
.chart{width:100%;min-height:150px}
.chart svg{display:block;overflow:visible}
.chart text{fill:var(--t3);font-size:11px}
.chart .grid{stroke:var(--rule);stroke-width:1}
.chart .col{fill:var(--mark)}
.chart .hit{fill:transparent}
.chart .hit:hover+.col,.chart g:hover .col{fill:var(--accent)}
.bars{display:grid;grid-template-columns:minmax(0,1fr) minmax(70px,1.1fr) auto;column-gap:12px}
.brow{display:grid;grid-column:1/-1;grid-template-columns:subgrid;gap:12px;align-items:center;padding:5px 0;border:0;border-bottom:1px solid var(--rule);background:none;font:inherit;color:inherit;text-align:left;width:100%}
button.brow{cursor:pointer}
button.brow:hover .blabel{color:var(--t1)}
.blabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--t2)}
.btrack{height:8px;display:block}
.bfill{display:block;height:8px;min-width:2px;border-radius:0 4px 4px 0;background:var(--mark)}
.bval{text-align:right;white-space:nowrap}
.bval .t3{margin-left:6px;font-size:12px}
.bars.funnel{grid-template-columns:minmax(110px,.6fr) minmax(70px,1.4fr) auto}
.tablewrap{overflow-x:auto;border:1px solid var(--rule);border-radius:12px;background:var(--card)}
table{border-collapse:collapse;width:100%;min-width:640px}
.grid2 table{min-width:0}
th,td{padding:8px 12px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top}
th{color:var(--t3);font-weight:500;font-size:12px;white-space:nowrap;position:sticky;top:0;background:var(--card)}
tr:last-child td{border-bottom:0}
tbody tr.click{cursor:pointer}
tbody tr.click:hover td{background:var(--fill)}
td .two{display:block;color:var(--t3);font-size:12px}
.clip{max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wrapcell{max-width:420px;white-space:normal}
.chip{display:inline-block;padding:0 7px;border-radius:6px;background:var(--fill);color:var(--t2);font-size:12px;line-height:20px;white-space:nowrap}
.chip.acc{background:color-mix(in srgb,var(--accent) 22%,transparent);color:var(--t1)}
.chip.warn{background:color-mix(in srgb,var(--err) 16%,transparent);color:var(--t1)}
.filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
.filters .in[type=search]{flex:1 1 220px;width:auto}
.filters label{display:flex;gap:6px;align-items:center;color:var(--t2)}
.seg{display:inline-flex;border:1px solid var(--rule);border-radius:8px;overflow:hidden}
.seg button{font:inherit;border:0;background:none;color:var(--t2);padding:5px 11px;cursor:pointer}
.seg button.on{background:var(--fill);color:var(--t1);font-weight:500}
.feed{display:flex;flex-direction:column}
.feed a,.feed div.item{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;padding:8px 0;border-bottom:1px solid var(--rule)}
.feed a:hover .what{color:var(--t1)}
.feed .when{color:var(--t3);font-size:12px;padding-top:1px}
.feed .what{color:var(--t2);overflow-wrap:anywhere}
.feed .what b{color:var(--t1);font-weight:500}
.spec{display:grid;grid-template-columns:120px minmax(0,1fr);gap:6px 16px;margin-top:6px}
.spec dt{color:var(--t3)}
.spec dd{margin:0;overflow-wrap:anywhere}
.day{color:var(--t3);font-size:12px;padding:14px 0 4px;border-bottom:1px solid var(--rule)}
.tl{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;padding:5px 0;border-bottom:1px solid var(--rule);color:var(--t2);overflow-wrap:anywhere}
.tl .when{color:var(--t3);font-size:12px;padding-top:1px}
.tl b{color:var(--t1);font-weight:500}
.chat{display:flex;flex-direction:column;gap:6px;padding:14px;border:1px solid var(--rule);border-radius:12px;background:var(--card);margin-bottom:12px}
.chat .meta{color:var(--t3);font-size:12px;margin-bottom:4px;display:flex;gap:10px;flex-wrap:wrap}
.msg{max-width:min(78%,560px);padding:7px 11px;border-radius:14px;line-height:1.45;overflow-wrap:anywhere;white-space:pre-wrap}
.msg.user{align-self:flex-end;background:color-mix(in srgb,var(--accent) 24%,transparent);border-bottom-right-radius:4px}
.msg.head{align-self:flex-start;background:var(--fill);border-bottom-left-radius:4px}
.msg .mk{display:inline-block;margin:0 2px;padding:0 5px;border-radius:5px;background:var(--bg);color:var(--t3);font:11px/18px ui-monospace,SFMono-Regular,Menlo,monospace;vertical-align:1px}
.stage{align-self:center;color:var(--t3);font-size:12px;font-style:italic;text-align:center;max-width:90%}
.card{background:var(--card);border:1px solid var(--rule);border-radius:12px;padding:14px 16px;margin-bottom:12px}
.card .top{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:8px}
.card .grow{flex:1}
.card label{display:block;color:var(--t3);font-size:12px;margin:10px 0 4px}
.card ul{margin:6px 0 0;padding-left:18px;color:var(--t2)}
.card li{margin:2px 0;overflow-wrap:anywhere}
.actions{display:flex;gap:8px;align-items:center;margin-top:12px;flex-wrap:wrap}
.note{color:var(--t3);font-size:12px}
.err{color:var(--err)}
.ok{color:var(--t2)}
.empty{color:var(--t3);padding:14px 0}
.row{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--rule)}
.row .grow{flex:1;min-width:0;overflow-wrap:anywhere}
.switch{appearance:none;-webkit-appearance:none;width:34px;height:20px;border-radius:10px;background:var(--rule);position:relative;cursor:pointer;flex:none;margin:2px 0 0;transition:background .15s}
.switch::after{content:'';position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--card);box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
.switch:checked{background:var(--mark)}
.switch:checked::after{transform:translateX(14px)}
.tip{position:fixed;z-index:20;pointer-events:none;background:var(--t1);color:var(--bg);padding:5px 9px;border-radius:7px;font-size:12px;max-width:280px;line-height:1.35}
.score{display:inline-block;width:46px;height:6px;border-radius:3px;background:var(--fill);vertical-align:middle;margin-left:8px;overflow:hidden}
.score i{display:block;height:6px;background:var(--mark);border-radius:0 3px 3px 0}
.whos{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}
.whos .card ol{margin:6px 0 0;padding-left:18px;color:var(--t2)}
body.login{display:grid;place-items:center;min-height:100vh;padding:16px}
body.login .card{width:min(360px,100%);padding:28px 24px}
body.login h1{margin:4px 0 18px}
body.login form{display:flex;flex-direction:column;gap:8px}
body.login .btn{margin-top:8px;padding:9px}
@media (max-width:720px){
  .bar{flex-wrap:wrap;gap:8px 12px}
  .tabs{order:3;flex-basis:100%}
  .brand{flex:1}
  .wrap{padding-top:16px}
  .bars,.bars.funnel{grid-template-columns:minmax(0,1fr) auto}
  .brow{row-gap:4px}
  .brow .blabel{grid-column:1;grid-row:1}.brow .bval{grid-column:2;grid-row:1}.brow .btrack{grid-column:1/-1;grid-row:2}
  .spec{grid-template-columns:96px minmax(0,1fr)}
  .msg{max-width:90%}
}
`;

// Runs in the browser. Serialized into the page with toString(), so it can't
// use anything from this module.
function client(base) {
  const TZ = 'America/Toronto';
  const view = document.getElementById('view');
  const banner = document.getElementById('banner');
  const tip = document.getElementById('tip');
  let seq = 0;
  let timer = 0;

  // ---- tiny DOM helper: text always goes in as text --------------------------
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style') Object.assign(el.style, v);
      else if (k === 'value') el.value = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false && kid !== '') el.append(kid instanceof Node ? kid : String(kid));
    return el;
  }
  const svg = (tag, attrs, ...kids) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
    for (const kid of kids) if (kid) el.append(kid);
    return el;
  };

  // ---- formatting -----------------------------------------------------------
  const num = (n) => (n == null || n === '' ? '–' : Number(n).toLocaleString('en-US'));
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
  const ms = (v) => { if (v == null) return '–'; const s = Math.round(v / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`; };
  const ago = (iso) => {
    if (!iso) return '';
    const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    if (m < 1440) return `${Math.round(m / 60)}h ago`;
    if (m < 43200) return `${Math.round(m / 1440)}d ago`;
    return day(iso);
  };
  const day = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: new Date(iso).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  const time = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const when = (iso) => (iso ? `${day(iso)}, ${time(iso)}` : '');
  const short = (id) => String(id || '').slice(0, 8);
  const who = (v) => v.name || h('span', { class: 't3' }, `no name · ${short(v.id || v.visitor_id)}`);
  const place = (v) => [v.city, v.region, v.country].filter(Boolean).join(', ');
  const unmark = (t) => String(t || '').replace(/\s*\[\[[^\]]*\]\]/g, '').trim();

  // ---- data -----------------------------------------------------------------
  async function api(name, params, body) {
    const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''))}` : '';
    const res = await fetch(`${base}/api/${name}${qs}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (res.status === 401) { location.reload(); throw new Error('logged out'); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok && !(data && data.error)) throw new Error(`HTTP ${res.status}`);
    return data || {};
  }

  // ---- pieces ---------------------------------------------------------------
  const sec = (title, note, ...kids) => h('section', { class: 'sec' }, h('h2', {}, title, note ? h('span', { class: 't3' }, note) : null), ...kids);
  const empty = (text) => h('p', { class: 'empty' }, text);
  const missing = () => h('p', { class: 'empty' }, 'Needs the new tables: run supabase/2026-10-07-learning-admin.sql in the Supabase SQL editor.');
  const chip = (text, cls = '') => h('span', { class: `chip ${cls}` }, text);
  const vlink = (id, label) => h('a', { href: `#visitor/${id}` }, label);

  function tiles(list) {
    return h('div', { class: 'tiles' }, list.map((t) => h(t.href ? 'a' : 'div', { class: 'tile', href: t.href },
      h('div', { class: 'k' }, t.k), h('div', { class: 'v' }, t.v), t.s ? h('div', { class: 's' }, t.s) : null)));
  }

  function bars(items, { label, value, note, tipText, onClick, max, cls = '' }) {
    if (!items || !items.length) return empty('Nothing yet.');
    const top = max || Math.max(1, ...items.map(value));
    return h('div', { class: `bars ${cls}` }, items.map((it) => {
      const fill = h('span', { class: 'bfill', style: { width: `${Math.max(0.5, (value(it) / top) * 100)}%` } });
      return h(onClick ? 'button' : 'div', { class: 'brow', type: onClick ? 'button' : null, onclick: onClick ? () => onClick(it) : null, 'data-tip': tipText ? tipText(it) : null },
        h('span', { class: 'blabel' }, label(it)),
        h('span', { class: 'btrack' }, fill),
        h('span', { class: 'bval' }, num(value(it)), note ? h('span', { class: 't3' }, note(it)) : null));
    }));
  }

  function table(cols, rows, onRow) {
    if (!rows || !rows.length) return empty('Nothing here yet.');
    return h('div', { class: 'tablewrap' }, h('table', {},
      h('thead', {}, h('tr', {}, cols.map((c) => h('th', { class: c.num ? 'num' : '' }, c.label)))),
      h('tbody', {}, rows.map((r) => h('tr', { class: onRow ? 'click' : '', onclick: onRow ? () => onRow(r) : null },
        cols.map((c) => h('td', { class: [c.num ? 'num' : '', c.cls || ''].join(' ') }, c.get(r))))))));
  }

  // Columns from a baseline, 4px rounded tops, a hover target per day. Drawn
  // at the container's width and redrawn when it changes.
  function columns(points, { value, label, tipText }) {
    const box = h('div', { class: 'chart' });
    const draw = () => {
      const W = Math.max(260, box.clientWidth || 600);
      const H = 150;
      const pad = { t: 8, r: 0, b: 22, l: 30 };
      const max = Math.max(1, ...points.map(value));
      const step = Math.pow(10, Math.floor(Math.log10(max)));
      const top = Math.ceil(max / step) * step;
      const iw = W - pad.l - pad.r;
      const ih = H - pad.t - pad.b;
      const slot = iw / points.length;
      const bw = Math.max(2, Math.min(24, slot - 2));
      const s = svg('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Visitors per day' });
      for (const g of [0, top / 2, top]) {
        const y = pad.t + ih - (g / top) * ih;
        s.append(svg('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: y, y2: y }));
        const t = svg('text', { x: pad.l - 6, y: y + 4, 'text-anchor': 'end' }); t.textContent = num(Math.round(g)); s.append(t);
      }
      points.forEach((p, i) => {
        const v = value(p);
        const x = pad.l + i * slot + (slot - bw) / 2;
        const bh = (v / top) * ih;
        const y = pad.t + ih - bh;
        const g = svg('g', { 'data-tip': tipText(p) });
        g.append(svg('rect', { class: 'hit', x: pad.l + i * slot, y: pad.t, width: slot, height: ih }));
        if (v > 0) {
          const r = Math.min(4, bw / 2, bh);
          g.append(svg('path', { class: 'col', d: `M${x},${y + bh}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + bh}Z` }));
        }
        s.append(g);
        if (i === 0 || i === points.length - 1 || i === Math.floor(points.length / 2)) {
          const t = svg('text', { x: x + bw / 2, y: H - 6, 'text-anchor': i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle' });
          t.textContent = label(p); s.append(t);
        }
      });
      box.replaceChildren(s);
    };
    new ResizeObserver(() => draw()).observe(box);
    return box;
  }

  // A transcript: the visitor on the right, the head on the left, the page's
  // stage notes in between, hand moves shown as small tags.
  function transcript(messages) {
    const out = [];
    for (const m of Array.isArray(messages) ? messages : []) {
      const text = String(m && m.content || '');
      if (!text) continue;
      if (m.role === 'user' && /^\(/.test(text)) { out.push(h('div', { class: 'stage' }, text.replace(/^\(|\)$/g, ''))); continue; }
      const parts = [];
      for (const piece of text.split(/(\[\[[^\]]*\]\])/)) {
        if (!piece) continue;
        parts.push(/^\[\[/.test(piece) ? h('span', { class: 'mk' }, piece.slice(2, -2)) : piece);
      }
      out.push(h('div', { class: `msg ${m.role === 'user' ? 'user' : 'head'}` }, parts));
    }
    return out.length ? out : [empty('Empty chat.')];
  }

  function show(token, ...nodes) {
    if (token !== seq) return false;
    view.replaceChildren(...nodes.flat(Infinity).filter((n) => n != null && n !== false));
    return true;
  }

  // ---- Overview ---------------------------------------------------------------
  async function overview(token) {
    const o = await api('overview');
    const v = o.visitors || {};
    const items = (o.recent || []).map((r) => {
      const name = r.name ? h('b', {}, r.name) : h('b', {}, `visitor ${short(r.visitor)}`);
      let what;
      if (r.kind === 'views') what = [name, r.where ? ` from ${r.where}` : '', ' viewed ', r.paths.join(' → ')];
      else if (r.kind === 'chat') what = [name, ` chatted, ${r.turns} turn${r.turns === 1 ? '' : 's'} (last on ${r.page || '?'})`];
      else if (r.kind === 'note') what = [name, ` left a ${r.wall ? 'wall' : 'private'} note${r.flagged ? ' (flagged)' : ''}: `, h('span', {}, `"${r.text}"`)];
      else what = [r.sender === 'david' ? h('b', {}, 'You') : name, r.sender === 'david' ? ' replied: ' : ' messaged you: ', `"${r.text}"`];
      return h('a', { href: r.kind === 'chat' ? `#chat/${r.convo}` : `#visitor/${r.visitor}` }, h('span', { class: 'when' }, ago(r.at)), h('span', { class: 'what' }, what));
    });
    const ok = show(token,
      h('div', { class: 'phead' }, h('div', {}, h('h1', {}, 'Overview'), h('p', { class: 'sub' }, o.approx ? 'Approximate until the new SQL is run.' : 'Today is Toronto time. Refreshes every 30 seconds.'))),
      tiles([
        { k: 'Visitors today', v: num(v.today), s: v.new_d7 != null ? `${num(v.new_d7)} new this week` : null, href: '#visitors' },
        { k: 'Last 7 days', v: num(v.d7) },
        { k: 'Last 30 days', v: num(v.d30), s: o.views_d30 != null ? `${num(o.views_d30)} page views` : null },
        { k: 'Chats, 30 days', v: num(o.chats && o.chats.d30), s: o.chats && o.chats.turns_d30 != null ? `${num(o.chats.turns_d30)} turns` : null, href: '#chats' },
        { k: 'Inbox messages', v: num(o.messages && o.messages.total), s: o.messages && o.messages.unanswered ? `${o.messages.unanswered} waiting on you` : null, href: '#inbox' },
        { k: 'Notes', v: num(o.notes && o.notes.total), s: o.notes && o.notes.d30 != null ? `${num(o.notes.d30)} this month` : null, href: '#inbox' },
        { k: 'Spend this month', v: o.spend == null ? '–' : `$${Number(o.spend).toFixed(2)}`, s: `cap $${num(o.cap)}` },
        { k: 'To review', v: num(o.pending), s: 'proposals', href: '#learning' }
      ]),
      sec('Visitors per day', 'last 30 days', columns(o.daily || [], { value: (d) => d.visitors, label: (d) => day(d.day + 'T12:00:00Z'), tipText: (d) => `${day(d.day + 'T12:00:00Z')}: ${num(d.visitors)} visitor${d.visitors === 1 ? '' : 's'}` })),
      h('div', { class: 'grid2' },
        sec('Top pages', '30 days', bars(o.pages, { label: (p) => p.path, value: (p) => p.views, note: (p) => `${num(p.visitors)} ppl`, tipText: (p) => `${p.path}: ${num(p.views)} views by ${num(p.visitors)} visitors` })),
        sec('Where they came from', 'new visitors, 30 days', bars(o.referrers, { label: (r) => r.host, value: (r) => r.visitors, tipText: (r) => `${r.host}: ${num(r.visitors)} visitors` }))),
      sec('Recent activity', null, items.length ? h('div', { class: 'feed' }, items) : empty('Nobody yet.')));
    if (ok) timer = setTimeout(() => { if (token === seq) overview(token).catch(() => {}); }, 30000);
  }

  // ---- Visitors -----------------------------------------------------------------
  const vstate = { q: '', who: '', chatted: false };
  async function visitors(token) {
    const q = h('input', { class: 'in', type: 'search', placeholder: 'Search name, company, city, IP, page…', value: vstate.q, 'aria-label': 'Search visitors' });
    const whoSel = h('select', { class: 'in', 'aria-label': 'Who' }, ['', 'recruiter', 'engineer', 'student', 'friend', 'unknown'].map((w) => h('option', { value: w }, w ? `seems: ${w}` : 'anyone')));
    whoSel.value = vstate.who;
    const chatted = h('input', { type: 'checkbox' }); chatted.checked = vstate.chatted;
    const count = h('span', { class: 't3' });
    const list = h('div', {}, h('p', { class: 'empty' }, 'Loading…'));
    let t = 0;
    const load = async () => {
      Object.assign(vstate, { q: q.value, who: whoSel.value, chatted: chatted.checked });
      const r = await api('visitors', { q: vstate.q, who: vstate.who, chatted: vstate.chatted ? '1' : '' });
      if (token !== seq) return;
      count.textContent = r.total != null ? `${num(r.total)} visitor${r.total === 1 ? '' : 's'}${r.approx ? ' (basic view until the SQL is run)' : ''}` : '';
      list.replaceChildren(table([
        { label: 'Who', get: (v) => [who(v), v.seems_to_be ? h('span', { class: 'two' }, `seems ${v.seems_to_be}`) : null] },
        { label: 'Role', get: (v) => [v.position || '', v.company ? h('span', { class: 'two' }, v.company) : null] },
        { label: 'Here for', cls: 'clip', get: (v) => v.reason || '' },
        { label: 'Where', get: (v) => [place(v), v.timezone ? h('span', { class: 'two' }, v.timezone) : null] },
        { label: 'IP', get: (v) => h('code', {}, v.ip || '') },
        { label: 'Views', num: true, get: (v) => num(v.views) },
        { label: 'Chat', num: true, get: (v) => (v.chat_turns ? num(v.chat_turns) : '') },
        { label: 'Last seen', get: (v) => [ago(v.last_seen), v.referrer ? h('span', { class: 'two clip' }, v.referrer.replace(/^https?:\/\/(www\.)?/, '')) : null] },
        { label: 'Pages', cls: 'clip', get: (v) => h('span', { class: 't2' }, v.pages || '') }
      ], r.rows, (v) => { location.hash = `visitor/${v.id}`; }));
    };
    const soon = () => { clearTimeout(t); t = setTimeout(() => load().catch(fail), 250); };
    q.addEventListener('input', soon);
    whoSel.addEventListener('change', soon);
    chatted.addEventListener('change', soon);
    show(token, h('div', { class: 'phead' }, h('h1', {}, 'Visitors'), count),
      h('div', { class: 'filters' }, q, whoSel, h('label', {}, chatted, 'chatted')), list);
    await load();
  }

  function describe(e) {
    const d = e.data || {};
    switch (e.type) {
      case 'overlay_open': return ['opened ', h('b', {}, d.id || '?'), d.kind ? ` (${d.kind})` : ''];
      case 'overlay_close': return ['closed ', d.id || '?'];
      case 'demo_open': return ['opened the demo ', h('b', {}, d.id || '?')];
      case 'game_start': return ['started ', h('b', {}, d.game || 'a game')];
      case 'game_end': return ['finished ', h('b', {}, d.game || 'a game'), d.result ? `: ${d.result}` : d.result_score != null ? `: ${d.result_score}${d.result_david != null ? ` vs david's ${d.result_david}` : ''}` : ''];
      case 'demo_close': return [h('span', { class: 't3' }, `closed the demo ${d.id || ''}`)];
      case 'line_drop': return [h('span', { class: 't3' }, `line skipped ${d.id || ''}${d.reason ? ` (${d.reason})` : ''}`)];
      case 'bring': return ['the head brought ', h('b', {}, d.id || '?')];
      case 'line': return ['head: ', h('b', {}, `"${unmark(d.text)}"`), h('span', { class: 't3' }, ` ${d.id || ''}`)];
      case 'line_cut': return [h('span', { class: 't3' }, `line cut${d.reason ? ` (${d.reason})` : ''}`)];
      case 'reply': return ['replied ', h('b', {}, `"${d.text || ''}"`), d.via ? h('span', { class: 't3' }, ` via ${d.via}`) : null];
      case 'click': return ['clicked ', h('b', {}, d.t || '?')];
      case 'hidden': return [h('span', { class: 't3' }, 'left the tab')];
      case 'visible': return [h('span', { class: 't3' }, 'came back')];
      default: return [e.type];
    }
  }

  async function visitor(token, id) {
    const r = await api('visitor', { id });
    if (r.error) return show(token, h('p', { class: 'err' }, 'No such visitor.'));
    const v = r.visitor;
    const profile = Object.entries(v.profile || {}).filter(([k]) => !['name', 'who', 'role', 'position', 'company', 'reason'].includes(k));
    // Time and scroll per page, from the furthest dwell report per page view.
    const pv = new Map();
    for (const e of r.events || []) if (e.type === 'dwell' && e.data && e.data.pv) {
      const cur = pv.get(e.data.pv) || { path: e.path, ms: 0, depth: 0 };
      cur.ms = Math.max(cur.ms, e.data.ms || 0); cur.depth = Math.max(cur.depth, e.data.depth || 0);
      pv.set(e.data.pv, cur);
    }
    const pages = new Map();
    for (const x of pv.values()) { const p = pages.get(x.path) || { path: x.path, views: 0, ms: 0, depth: 0 }; p.views++; p.ms += x.ms; p.depth = Math.max(p.depth, x.depth); pages.set(x.path, p); }
    // One timeline: page views from the visit log, everything else from events.
    const items = [
      ...r.views.map((p) => ({ at: p.at, what: ['viewed ', h('b', {}, p.path), p.referrer ? h('span', { class: 't3' }, ` from ${p.referrer}`) : null] })),
      ...(r.events || []).filter((e) => !['page', 'dwell', 'line_done'].includes(e.type)).map((e) => ({ at: e.at, what: describe(e) }))
    ].sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 500);
    const timeline = [];
    let lastDay = '';
    for (const it of items) {
      const d = day(it.at);
      if (d !== lastDay) { timeline.push(h('div', { class: 'day' }, d)); lastDay = d; }
      timeline.push(h('div', { class: 'tl' }, h('span', { class: 'when' }, time(it.at)), h('span', {}, it.what)));
    }
    const facts = [
      ['Seems to be', v.seems_to_be || (v.profile && v.profile.who)], ['Role', v.position], ['Company', v.company], ['Here for', v.reason],
      ['Where', place(v)], ['Timezone', v.timezone], ['IP', v.ip], ['First seen', when(v.first_seen)], ['Last seen', `${when(v.last_seen)} (${ago(v.last_seen)})`],
      ['Views', num(v.views)], ['Came from', v.referrer], ['Browser', v.user_agent], ...profile.map(([k, val]) => [k, String(val)])
    ].filter(([, val]) => val);
    show(token,
      h('p', {}, h('a', { class: 't3', href: '#visitors' }, '← Visitors')),
      h('div', { class: 'phead' }, h('div', {}, h('h1', {}, v.name || `Visitor ${short(v.id)}`), h('p', { class: 'sub' }, [v.position, v.company && `at ${v.company}`].filter(Boolean).join(' ') || h('code', {}, v.id)))),
      h('dl', { class: 'spec' }, facts.map(([k, val]) => [h('dt', {}, k), h('dd', {}, val)])),
      pages.size ? sec('Time on each page', null, table([
        { label: 'Page', get: (p) => p.path }, { label: 'Views', num: true, get: (p) => num(p.views) },
        { label: 'Time', num: true, get: (p) => ms(p.ms) }, { label: 'Furthest scroll', num: true, get: (p) => `${Math.round(p.depth)}%` }
      ], [...pages.values()].sort((a, b) => b.ms - a.ms))) : null,
      sec(`Chats`, `${r.chats.length}`, r.chats.length ? r.chats.map((c) => h('div', { class: 'chat' },
        h('div', { class: 'meta' }, h('span', {}, when(c.started_at)), h('span', {}, `${c.turns} turns`), h('span', {}, `last on ${c.last_page || '?'}`), h('a', { href: `#chat/${c.id}` }, 'open')),
        transcript(c.messages))) : empty('No chats.')),
      r.messages.length ? sec('Messages', `${r.messages.length}`, h('div', { class: 'chat' }, r.messages.map((m) => h('div', { class: `msg ${m.sender === 'david' ? 'head' : 'user'}`, 'data-tip': when(m.at) }, m.body)))) : null,
      r.notes.length ? sec('Notes', `${r.notes.length}`, r.notes.map((n) => h('div', { class: 'row' }, h('div', { class: 'grow' }, n.message, h('div', { class: 'note' }, [when(n.at), n.public ? 'on the wall' : 'private', n.flagged ? 'flagged' : '', n.contact ? `reply to ${n.contact}` : ''].filter(Boolean).join(' · ')))))) : null,
      sec('Timeline', r.events == null ? 'page views only until the SQL is run' : `${items.length} things`, timeline.length ? timeline : empty('Nothing yet.')));
  }

  // ---- Chats --------------------------------------------------------------------
  const cstate = { q: '' };
  async function chats(token) {
    const q = h('input', { class: 'in', type: 'search', placeholder: 'Search every chat…', value: cstate.q, 'aria-label': 'Search chats' });
    const count = h('span', { class: 't3' });
    const list = h('div', {}, h('p', { class: 'empty' }, 'Loading…'));
    let t = 0;
    const load = async () => {
      cstate.q = q.value;
      const r = await api('conversations', { q: cstate.q });
      if (token !== seq) return;
      count.textContent = r.total != null ? `${num(r.total)} chat${r.total === 1 ? '' : 's'}` : '';
      list.replaceChildren(table([
        { label: 'Who', get: (c) => [who(c), c.seems_to_be ? h('span', { class: 'two' }, `seems ${c.seems_to_be}`) : null] },
        { label: 'First thing they said', cls: 'wrapcell', get: (c) => c.preview ? `"${c.preview}"` : h('span', { class: 't3' }, 'nothing, the head talked') },
        { label: 'Turns', num: true, get: (c) => num(c.turns) },
        { label: 'Last page', get: (c) => h('span', { class: 't2' }, c.last_page || '') },
        { label: 'When', get: (c) => ago(c.updated_at) }
      ], r.rows, (c) => { location.hash = `chat/${c.id}`; }));
    };
    q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => load().catch(fail), 300); });
    show(token, h('div', { class: 'phead' }, h('h1', {}, 'Chats'), count), h('div', { class: 'filters' }, q), list);
    await load();
  }

  async function chat(token, id) {
    const c = await api('conversation', { id });
    if (c.error) return show(token, h('p', { class: 'err' }, 'No such chat.'));
    const v = c.visitors || {};
    show(token,
      h('p', {}, h('a', { class: 't3', href: '#chats' }, '← Chats')),
      h('div', { class: 'phead' }, h('div', {}, h('h1', {}, v.name || `Visitor ${short(c.visitor_id)}`),
        h('p', { class: 'sub' }, [v.profile && v.profile.who ? `seems ${v.profile.who}` : '', v.position, v.company, place(v), `${c.turns} turns`, `started ${when(c.started_at)}`].filter(Boolean).join(' · '))),
        vlink(c.visitor_id, 'Visitor →')),
      h('div', { class: 'chat' }, transcript(c.messages)));
  }

  // ---- Behavior -------------------------------------------------------------------
  let bdays = 30;
  async function behavior(token) {
    const b = await api('behavior', { days: bdays });
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': 'Range' }, [1, 7, 30, 90].map((d) => h('button', { type: 'button', class: d === bdays ? 'on' : '', onclick: () => { bdays = d; go(); } }, d === 1 ? 'Today' : `${d} days`)));
    if (b.missing) return show(token, h('div', { class: 'phead' }, h('h1', {}, 'Behavior'), seg), missing());
    const f = b.funnel || [];
    const games = b.games || [];
    const whoCards = Object.entries(b.by_who || {}).map(([w, list]) => h('div', { class: 'card' }, h('h2', {}, `${w}s`), h('ol', {}, list.map((p) => h('li', {}, `${p.path} `, h('span', { class: 't3' }, num(p.visitors)))))));
    show(token,
      h('div', { class: 'phead' }, h('div', {}, h('h1', {}, 'Behavior'), h('p', { class: 'sub' }, 'From the tracker and the head. Visitors with Do Not Track on are not counted.')), seg),
      sec('Funnel', 'home → projects → a project → its demo', bars(f, { cls: 'funnel', max: Math.max(1, f[0] ? f[0].visitors : 1), label: (s) => s.step, value: (s) => s.visitors, note: (s) => { const i = f.indexOf(s); return i ? pct(s.visitors, f[i - 1].visitors) : ''; }, tipText: (s) => { const i = f.indexOf(s); return i ? `${num(s.visitors)} of ${num(f[i - 1].visitors)} went on to this step` : `${num(s.visitors)} visitors saw the home page`; } })),
      sec('Time and scroll by page', 'per page view', table([
        { label: 'Page', get: (d) => d.path }, { label: 'Views', num: true, get: (d) => num(d.views) },
        { label: 'Median time', num: true, get: (d) => ms(d.median_ms) }, { label: 'Avg scroll', num: true, get: (d) => `${num(d.avg_depth)}%` },
        { label: 'Read 75%+', num: true, get: (d) => `${num(d.pct_75)}%` }
      ], b.dwell)),
      h('div', { class: 'grid2' },
        sec('Projects opened', null, bars(b.overlays, { label: (o) => o.id, value: (o) => o.opens, note: (o) => `${num(o.visitors)} ppl`, tipText: (o) => `${o.id}${o.kind ? ` (${o.kind})` : ''}: opened ${num(o.opens)} times by ${num(o.visitors)} visitors` })),
        sec('Demos opened', null, bars(b.demos, { label: (o) => o.id, value: (o) => o.opens, note: (o) => `${num(o.visitors)} ppl` }))),
      sec('Hobby games', null, table([
        { label: 'Game', get: (g) => g.game }, { label: 'Plays', num: true, get: (g) => num(g.plays) },
        { label: 'Finished', num: true, get: (g) => `${num(g.finished)} (${pct(g.finished, g.plays)})` },
        { label: 'Players', num: true, get: (g) => num(g.visitors) },
        { label: 'Results', get: (g) => Object.entries(g.results || {}).sort((a, c) => c[1] - a[1]).map(([k, n]) => chip(`${k} ${n}`)).reduce((a, x) => a.concat(x, ' '), []) }
      ], games)),
      h('div', { class: 'grid2' },
        sec('Last page before leaving', 'per visitor per day', bars(b.exits, { label: (e) => e.path, value: (e) => e.n })),
        sec('Clicked', 'things the head knows', bars(b.clicks, { label: (c) => c.target, value: (c) => c.clicks, note: (c) => `${num(c.visitors)} ppl` }))),
      sec('What each kind of visitor looks at', 'by who the head thinks they are', whoCards.length ? h('div', { class: 'whos' }, whoCards) : empty('Nobody identified yet.')),
      h('div', { class: 'grid2' },
        sec('The head brought', null, bars(b.brings, { label: (x) => x.id, value: (x) => x.n })),
        sec('All events', null, bars(Object.entries(b.events || {}).map(([type, n]) => ({ type, n })).sort((a, c) => c.n - a.n), { label: (x) => x.type, value: (x) => x.n }))));
  }

  // ---- Lines ------------------------------------------------------------------------
  const learnedId = (v) => `${String(v.of_line || v.kind).split('#')[0]}#learned-${v.id}`;
  async function lines(token) {
    const r = await api('lines', { days: 90 });
    if (r.missing) return show(token, h('div', { class: 'phead' }, h('h1', {}, 'Lines')), missing());
    const stats = r.stats || [];
    const byId = Object.fromEntries(stats.map((s) => [s.line_id, s]));
    const scored = stats.filter((s) => s.shown >= 10);
    const best = [...scored].sort((a, b) => b.score - a.score).slice(0, 5);
    const worst = [...scored].sort((a, b) => a.score - b.score).filter((s) => !best.includes(s)).slice(0, 5);
    const scoreCell = (s) => { const i = h('i', { style: { width: `${Math.min(100, s.score * 100)}%` } }); return [Number(s.score).toFixed(3), h('span', { class: 'score' }, i)]; };
    const lineCols = [
      { label: 'Line', cls: 'wrapcell', get: (s) => [`"${unmark(s.text)}"`, h('span', { class: 'two' }, `${s.line_id}${s.kind ? ` · ${s.kind}` : ''}`)] },
      { label: 'Shown', num: true, get: (s) => num(s.shown) },
      { label: 'Finished', num: true, get: (s) => num(s.done) },
      { label: 'Cut', num: true, get: (s) => num(s.cut) },
      { label: 'Replies', num: true, get: (s) => `${num(s.replies)} (${pct(s.replies, s.shown)})` },
      { label: 'Left', num: true, get: (s) => `${num(s.leaves)} (${pct(s.leaves, s.shown)})` },
      { label: 'Score', num: true, get: scoreCell }
    ];
    show(token,
      h('div', { class: 'phead' }, h('div', {}, h('h1', {}, 'Lines'), h('p', { class: 'sub' }, 'The head\'s own lines over 90 days. Score: reply rate within 20s, smoothed toward the average, minus half a point per visitor who left within 3s.'))),
      h('div', { class: 'grid2' },
        sec('Landing best', 'shown 10+ times', best.length ? table(lineCols.filter((c) => ['Line', 'Shown', 'Score'].includes(c.label)), best) : empty('Not enough data yet.')),
        sec('Landing worst', 'shown 10+ times', worst.length ? table(lineCols.filter((c) => ['Line', 'Shown', 'Score'].includes(c.label)), worst) : empty('Not enough data yet.'))),
      sec('Every line', `${stats.length}`, table(lineCols, stats)),
      sec('Approved new lines', `${(r.variants || []).length}`, table([
        { label: 'Line', cls: 'wrapcell', get: (v) => [`"${v.text}"`, h('span', { class: 'two' }, `${learnedId(v)}${v.of_line ? ` · instead of ${v.of_line}` : ''}`)] },
        { label: 'On', get: (v) => (v.active ? chip('live', 'acc') : chip('off')) },
        { label: 'Shown', num: true, get: (v) => num((byId[learnedId(v)] || {}).shown || 0) },
        { label: 'Score', num: true, get: (v) => (byId[learnedId(v)] ? scoreCell(byId[learnedId(v)]) : '–') }
      ], r.variants)));
  }

  // ---- Learning --------------------------------------------------------------------
  const KIND = { fact: 'fact', faq: 'question', line: 'new line', insight: 'insight' };
  function proposalCard(p, current, done) {
    const title = h('input', { class: 'in', value: p.title, 'aria-label': 'Title' });
    const text = h('textarea', { class: 'in', rows: p.kind === 'line' ? 2 : 3, 'aria-label': 'Text', placeholder: p.kind === 'faq' ? 'Your answer. Only you know it.' : p.kind === 'fact' ? 'The fact, in your words.' : '' });
    text.value = p.text || '';
    const msg = h('span', { class: 'note' });
    const approve = h('button', { class: 'btn primary small', type: 'button' }, 'Approve');
    const reject = h('button', { class: 'btn small', type: 'button' }, 'Reject');
    const edited = () => { approve.textContent = title.value !== p.title || text.value !== (p.text || '') ? 'Save and approve' : 'Approve'; };
    title.addEventListener('input', edited); text.addEventListener('input', edited);
    const act = async (action) => {
      if (action === 'approve' && /_{3,}/.test(text.value)) { msg.className = 'note err'; msg.textContent = 'Fill in the ___ first.'; text.focus(); return; }
      approve.disabled = reject.disabled = true;
      const r = await api('proposal', null, { id: p.id, action, title: title.value, text: text.value }).catch((e) => ({ error: e.message }));
      if (r.error) { msg.className = 'note err'; msg.textContent = r.error; approve.disabled = reject.disabled = false; return; }
      done(action);
    };
    approve.addEventListener('click', () => act('approve'));
    reject.addEventListener('click', () => act('reject'));
    const was = p.kind === 'line' && p.meta && current[p.meta.line_id];
    const what = { fact: 'Approving adds this to what the head knows.', faq: 'Approving teaches the head this answer.', line: 'Approving adds this line to the head\'s options. It gets scored like the rest.', insight: 'Just for you. Approving files it away.' }[p.kind];
    return h('div', { class: 'card' },
      h('div', { class: 'top' }, chip(KIND[p.kind] || p.kind, 'acc'), h('span', { class: 'note grow' }, `${Math.round((p.confidence || 0) * 100)}% sure · ${ago(p.created_at)}`)),
      h('label', {}, p.kind === 'faq' ? 'Question' : 'Title'), title,
      was ? h('p', { class: 'note' }, `Instead of: "${unmark(was.text)}" (${p.meta.line_id}, score ${Number(was.score).toFixed(3)}, shown ${was.shown})`) : null,
      h('label', {}, p.kind === 'faq' ? 'Answer' : p.kind === 'line' ? 'New line' : 'Text'), text,
      p.evidence && p.evidence.length ? [h('label', {}, 'Why'), h('ul', {}, p.evidence.map((e) => h('li', {}, String(e))))] : null,
      h('div', { class: 'actions' }, approve, reject, h('span', { class: 'note' }, what), msg));
  }

  function editableRow(item, kind, refresh) {
    const on = h('input', { type: 'checkbox', class: 'switch', 'aria-label': 'Active' }); on.checked = item.active;
    const body = h('div', { class: 'grow' });
    const draw = () => body.replaceChildren(
      kind === 'knowledge' ? h('div', {}, chip(item.kind === 'faq' ? 'question' : 'fact'), ' ', h('b', {}, item.title)) : h('div', { class: 'note' }, `${learnedId(item)}${item.of_line ? ` · instead of ${item.of_line}` : ''}`),
      h('div', { class: 't2' }, item.text));
    draw();
    const edit = h('button', { class: 'btn ghost small', type: 'button' }, 'Edit');
    const del = h('button', { class: 'btn ghost small', type: 'button' }, 'Delete');
    const path = kind === 'knowledge' ? 'knowledge' : 'variant';
    on.addEventListener('change', async () => {
      const r = await api(path, null, { id: item.id, active: on.checked }).catch((e) => ({ error: e.message }));
      if (r.error) { on.checked = !on.checked; alert(r.error); } else item.active = on.checked;
    });
    edit.addEventListener('click', () => {
      const ta = h('textarea', { class: 'in', rows: 3 }); ta.value = item.text;
      const save = h('button', { class: 'btn primary small', type: 'button' }, 'Save');
      const cancel = h('button', { class: 'btn small', type: 'button', onclick: draw }, 'Cancel');
      save.addEventListener('click', async () => {
        const r = await api(path, null, { id: item.id, text: ta.value }).catch((e) => ({ error: e.message }));
        if (r.error) return alert(r.error);
        item.text = r.row.text; draw();
      });
      body.replaceChildren(ta, h('div', { class: 'actions' }, save, cancel));
      ta.focus();
    });
    del.addEventListener('click', async () => {
      if (!confirm('Delete this for good?')) return;
      const r = await api(path, null, { id: item.id, remove: true }).catch((e) => ({ error: e.message }));
      if (r.error) return alert(r.error);
      refresh();
    });
    return h('div', { class: 'row' }, on, body, edit, del);
  }

  async function learning(token) {
    const r = await api('learning');
    const run = h('button', { class: 'btn', type: 'button' }, 'Run now');
    const ran = h('span', { class: 'note' });
    run.addEventListener('click', async () => {
      run.disabled = true; ran.className = 'note'; ran.textContent = 'Reading the last day… (up to a minute)';
      const x = await api('learn', null, {}).catch((e) => ({ error: e.message }));
      run.disabled = false;
      if (x.error || x.ok === false) { ran.className = 'note err'; ran.textContent = x.error || x.reason || 'Failed.'; return; }
      ran.textContent = x.quiet ? 'Quiet day: nothing to read.' : `Read ${num(x.chats)} chats and ${num(x.events)} events: ${x.proposals} new.`;
      if (x.proposals) setTimeout(go, 1200);
    });
    const head = h('div', { class: 'phead' }, h('div', {}, h('h1', {}, 'Learning'), h('p', { class: 'sub' }, 'Every night the learn job reads the day\'s chats and behavior and suggests things. Nothing reaches the head until you approve it.')), h('div', { class: 'actions' }, ran, run));
    if (r.missing) return show(token, head, missing());
    setPending(r.pending.length);
    const pendingBox = h('div', {});
    const drawPending = () => pendingBox.replaceChildren(...(r.pending.length ? r.pending.map((p) => proposalCard(p, r.lines || {}, (action) => {
      r.pending = r.pending.filter((x) => x !== p);
      setPending(r.pending.length);
      if (action === 'approve') go(); else drawPending();
    })) : [empty('All caught up.')]));
    drawPending();
    show(token, head,
      sec('To review', `${r.pending.length}`, pendingBox),
      sec('What the head learned', `${r.knowledge.length} · switched-on ones go into every chat`, r.knowledge.length ? r.knowledge.map((k) => editableRow(k, 'knowledge', go)) : empty('Nothing approved yet.')),
      sec('New lines', `${r.variants.length}`, r.variants.length ? r.variants.map((v) => editableRow(v, 'variant', go)) : empty('Nothing approved yet.')),
      sec('Decided', 'latest 40', table([
        { label: 'What', cls: 'wrapcell', get: (p) => [h('b', {}, p.title), p.text ? h('span', { class: 'two' }, p.text) : null] },
        { label: 'Kind', get: (p) => KIND[p.kind] || p.kind },
        { label: 'Decision', get: (p) => chip(p.status, p.status === 'approved' ? 'acc' : '') },
        { label: 'When', get: (p) => ago(p.decided_at) }
      ], r.decided)));
  }

  // ---- Inbox ------------------------------------------------------------------------
  async function inbox(token) {
    const r = await api('inbox');
    const threads = new Map();
    for (const m of r.messages || []) {
      const t = threads.get(m.visitor_id) || { id: m.visitor_id, name: (m.visitors && m.visitors.name) || m.name || '', list: [] };
      t.list.push(m); threads.set(m.visitor_id, t);
    }
    const cards = [...threads.values()].map((t) => {
      const last = t.list[0];
      return h('div', { class: 'card' },
        h('div', { class: 'top' }, h('b', {}, t.name || `visitor ${short(t.id)}`), last.sender === 'visitor' ? chip('waiting on you', 'warn') : chip('you replied'), h('span', { class: 'note grow' }, ago(last.at)), vlink(t.id, 'Visitor →')),
        h('div', { class: 'chat' }, t.list.slice().reverse().map((m) => h('div', { class: `msg ${m.sender === 'david' ? 'head' : 'user'}`, 'data-tip': when(m.at) }, m.body))));
    });
    show(token,
      h('div', { class: 'phead' }, h('div', {}, h('h1', {}, 'Inbox'), h('p', { class: 'sub' }, 'Messages from /messages/ and private notes. Answer in Telegram: reply to the bot\'s message and it lands in their thread on the site.'))),
      sec('Messages', `${threads.size} thread${threads.size === 1 ? '' : 's'}`, cards.length ? cards : empty('No messages yet.')),
      sec('Notes', `${(r.notes || []).length}`, (r.notes || []).length ? r.notes.map((n) => h('div', { class: 'row' },
        h('div', { class: 'grow' }, h('div', {}, n.message), h('div', { class: 'note' }, [n.name || 'no name', n.contact ? `reply to ${n.contact}` : '', n.page || '', when(n.at)].filter(Boolean).join(' · '))),
        n.flagged ? chip('flagged', 'warn') : n.public ? chip('on the wall', 'acc') : chip('private'),
        n.visitor_id ? vlink(n.visitor_id, '→') : null)) : empty('No notes yet.')));
  }

  // ---- shell --------------------------------------------------------------------------
  const VIEWS = { overview, visitors, visitor, chats, chat, behavior, lines, learning, inbox };
  const TAB = { visitor: 'visitors', chat: 'chats' };
  function setPending(n) { const b = document.getElementById('pending'); b.textContent = n; b.hidden = !n; }
  function fail(err) { view.append(h('p', { class: 'err' }, `Something broke: ${err && err.message || err}`)); }
  function go() {
    const [name, arg] = (location.hash.slice(1) || 'overview').split('/');
    const v = VIEWS[name] ? name : 'overview';
    for (const a of document.querySelectorAll('.tabs a')) a.classList.toggle('on', a.dataset.v === (TAB[v] || v));
    clearTimeout(timer);
    const token = ++seq;
    view.replaceChildren(h('p', { class: 'empty' }, 'Loading…'));
    VIEWS[v](token, arg ? decodeURIComponent(arg) : '').catch((err) => { if (token === seq) fail(err); });
  }
  addEventListener('hashchange', go);

  document.getElementById('theme').addEventListener('click', () => {
    const dark = getComputedStyle(document.documentElement).colorScheme === 'dark';
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('admin-theme', next); } catch (e) { /* private mode */ }
  });

  // One tooltip for everything with data-tip.
  document.addEventListener('pointermove', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!el) { tip.hidden = true; return; }
    tip.textContent = el.getAttribute('data-tip');
    tip.hidden = false;
    const x = Math.min(e.clientX + 12, innerWidth - tip.offsetWidth - 8);
    const y = e.clientY + 16 + tip.offsetHeight > innerHeight ? e.clientY - tip.offsetHeight - 10 : e.clientY + 16;
    tip.style.left = `${Math.max(8, x)}px`;
    tip.style.top = `${y}px`;
  });

  api('health').then((s) => {
    setPending(s.pending || 0);
    if (!s.store) { banner.textContent = 'SUPABASE_URL and SUPABASE_SECRET_KEY aren\'t set, so there\'s nothing to show.'; banner.hidden = false; }
    else if (s.migration) { banner.replaceChildren(h('b', {}, 'One step left: '), 'run ', h('code', {}, s.migration), ' in the Supabase SQL editor. Until then behavior, lines and learning are empty and the rest is approximate.'); banner.hidden = false; }
  }).catch(() => {});
  go();
}
