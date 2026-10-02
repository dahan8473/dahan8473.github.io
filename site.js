(function () {
  // Pages swap in place instead of reloading (see the router at the bottom),
  // so everything here is either set up once and survives page changes (the
  // music, hover photos) or runs again for each page through setup().

  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? '/api' : 'https://davidliu-work.vercel.app/api';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Local time, London ON
  var fmt = new Intl.DateTimeFormat('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto' });
  function tick() {
    var clock = document.getElementById('clock');
    if (clock) clock.textContent = fmt.format(new Date());
  }
  setInterval(tick, 30000);

  // Theme toggle, delegated so it survives the header being swapped.
  function syncTheme() {
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    document.querySelectorAll('.theme-toggle').forEach(function (t) {
      t.setAttribute('aria-pressed', String(dark));
      t.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.theme-toggle')) return;
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (err) {}
    syncTheme();
  });

  // ---- Guitar recordings ------------------------------------------------------
  // One audio element per track for the whole visit, so a track keeps playing
  // while you browse. The rows on the guitar page and the "now playing" button
  // in the header are just views of it.
  var TRACKS = [
    { src: '/media/guitar/capricho-arabe.mp3', title: 'Capricho Árabe · Tárrega', short: 'Capricho Árabe', dur: '5:28' },
    { src: '/media/guitar/tango-en-skai.mp3', title: 'Tango en Skaï · Dyens', short: 'Tango en Skaï', dur: '2:22' },
    { src: '/media/guitar/marieta.mp3', title: 'Marieta · Tárrega', short: 'Marieta', dur: '2:06' },
    { src: '/media/guitar/frog-galliard.mp3', title: 'The Frog Galliard · Dowland', short: 'The Frog Galliard', dur: '1:59' }
  ];
  var audio = new Audio();
  audio.preload = 'none';
  var current = -1;
  var EQ = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>';
  var PLAY = '<svg class="pl" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>';
  var PAUSE = '<svg class="pa" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M0 0h3.2v12H0zM6.8 0H10v12H6.8z"/></svg>';

  function playing() { return current >= 0 && !audio.paused; }
  function toggle(i) {
    if (i === current && !audio.paused) { audio.pause(); return; }
    if (i !== current) { current = i; audio.src = TRACKS[i].src; }
    audio.play().catch(function () {});
  }
  function render() {
    document.querySelectorAll('#guitar-tracks .track').forEach(function (row, i) {
      var on = i === current && !audio.paused;
      row.classList.toggle('playing', on);
      var btn = row.querySelector('button');
      btn.setAttribute('aria-pressed', String(on));
      btn.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + TRACKS[i].title);
      if (i !== current) row.querySelector('.t-fill').style.width = '0%';
    });
    var now = document.querySelector('.playing-now');
    if (now) {
      now.classList.toggle('on', playing());
      if (playing()) {
        now.querySelector('.np-title').textContent = TRACKS[current].short;
        now.setAttribute('aria-label', 'Pause ' + TRACKS[current].title);
      }
    }
  }
  ['play', 'pause', 'ended'].forEach(function (ev) { audio.addEventListener(ev, render); });
  audio.addEventListener('ended', function () { current = -1; render(); });
  audio.addEventListener('timeupdate', function () {
    var row = document.querySelectorAll('#guitar-tracks .track')[current];
    if (row && audio.duration) row.querySelector('.t-fill').style.width = (audio.currentTime / audio.duration) * 100 + '%';
  });

  function mountTracks() {
    var mount = document.getElementById('guitar-tracks');
    if (mount && !mount.childElementCount) {
      TRACKS.forEach(function (t, i) {
        var row = document.createElement('div');
        row.className = 'track';
        row.innerHTML = '<button type="button">' + PLAY + PAUSE + '</button><span class="t-title"></span>' + EQ +
          '<span class="t-dur"></span><span class="t-bar"><span class="t-fill"></span></span>';
        row.querySelector('.t-title').textContent = t.title;
        row.querySelector('.t-dur').textContent = t.dur;
        row.querySelector('button').addEventListener('click', function () { toggle(i); });
        mount.appendChild(row);
      });
    }
    // The header's "now playing" control, on every page.
    var end = document.querySelector('.top .end');
    if (end && !end.querySelector('.playing-now')) {
      var now = document.createElement('button');
      now.type = 'button';
      now.className = 'playing-now';
      now.innerHTML = EQ + '<span class="np-title"></span>';
      now.addEventListener('click', function () { if (current >= 0) toggle(current); });
      end.insertBefore(now, end.firstChild);
    }
    render();
  }

  // ---- Hover photos -------------------------------------------------------------
  // Add data-photo="/media/..." to any element. Delegated, so new pages just work.
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var img = document.createElement('img');
    img.className = 'hover-photo';
    img.alt = '';
    document.body.appendChild(img);
    var x = 0, y = 0, tx = 0, ty = 0, raf = null, shown = null;
    var frame = function () {
      var k = reduce ? 1 : 0.18;
      x += (tx - x) * k;
      y += (ty - y) * k;
      img.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (shown) raf = requestAnimationFrame(frame);
    };
    document.addEventListener('mousemove', function (e) {
      tx = Math.min(e.clientX + 28, window.innerWidth - 268);
      ty = Math.max(12, e.clientY - 180);
    });
    document.addEventListener('mouseover', function (e) {
      var el = e.target.closest && e.target.closest('[data-photo]');
      if (el === shown) return;
      shown = el;
      cancelAnimationFrame(raf);
      if (!el) { img.classList.remove('on'); return; }
      img.src = el.getAttribute('data-photo');
      x = tx; y = ty;
      img.classList.add('on');
      raf = requestAnimationFrame(frame);
    });
  }

  // ---- Resume notes -------------------------------------------------------------
  // Hover an entry and its note shows up in the margin; click to keep it there.
  // Narrow screens and touch open it inline on tap instead.
  var margin = window.matchMedia('(min-width: 1180px) and (hover: hover)');
  var hovered = null;
  var pinned = null;
  function showNote() {
    var on = (margin.matches && hovered) || pinned;
    document.querySelectorAll('.r-item:not(.plain)').forEach(function (el) {
      el.classList.toggle('on', el === on);
      el.classList.toggle('pinned', el === pinned);
    });
  }
  function pin(el) { pinned = pinned === el ? null : el; showNote(); }
  window.dlPin = function (el) { if (pinned !== el) pin(el); };
  document.addEventListener('mouseover', function (e) {
    var el = e.target.closest && e.target.closest('.r-item:not(.plain)');
    if (el === hovered) return;
    hovered = el;
    showNote();
  });
  document.addEventListener('click', function (e) {
    var el = e.target.closest('.r-item:not(.plain)');
    if (el && !e.target.closest('a')) pin(el);
  });
  document.addEventListener('keydown', function (e) {
    var el = e.target.closest && e.target.closest('.r-item:not(.plain)');
    if (el && e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pin(el); }
    if (e.key === 'Escape' && pinned) pin(pinned);
  });

  // ---- Note wall ------------------------------------------------------------------
  var when = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });
  function noteRow(n, fresh) {
    var li = document.createElement('li');
    if (fresh) li.className = 'fresh';
    var msg = document.createElement('p');
    msg.className = 'msg';
    msg.textContent = n.message;
    var by = document.createElement('p');
    by.className = 'by';
    by.textContent = (n.name || 'Anonymous') + ' · ' + when.format(new Date(n.at || Date.now()));
    li.append(msg, by);
    return li;
  }
  function setupWall() {
    var form = document.querySelector('.wall-form');
    var list = document.querySelector('.wall');
    if (!form || !list) return;
    fetch(API + '/wall').then(function (r) { return r.ok ? r.json() : []; }).then(function (notes) {
      if (!notes.length) return;
      list.replaceChildren.apply(list, notes.map(function (n) { return noteRow(n); }));
    }).catch(function () {});
    var status = form.querySelector('.wall-status');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var message = form.message.value.trim();
      if (!message) { form.message.focus(); return; }
      var visitor = null;
      try { visitor = localStorage.getItem('dl-visitor'); } catch (err) {}
      var button = form.querySelector('button');
      button.disabled = true;
      status.textContent = 'Posting...';
      fetch(API + '/note', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ public: true, visitor: visitor, name: form.name.value.trim(), message: message, page: '/notes/' })
      }).then(function (r) { return r.ok ? r.json() : { saved: false }; }).then(function (res) {
        if (res.posted) {
          var empty = list.querySelector('.wall-empty');
          if (empty) empty.remove();
          list.prepend(noteRow({ name: form.name.value.trim(), message: message }, true));
          status.textContent = 'Posted. Thank you!';
          form.reset();
        } else if (res.saved) {
          status.textContent = "Sent to David privately. It didn't pass the check for the public wall.";
          form.reset();
        } else {
          status.textContent = "That didn't go through. Email me instead: davidliu8473@gmail.com";
        }
      }).catch(function () {
        status.textContent = "That didn't go through. Email me instead: davidliu8473@gmail.com";
      }).then(function () { button.disabled = false; });
    });
  }

  // ---- Second brain -------------------------------------------------------------
  // The public map of the head's notes (brain/graph.json): a small force layout
  // on a canvas, Obsidian style. Hover a note to read its line, click to ask the
  // head about it. Notes the head is recalling light up.
  var brainStop = null;
  var CLUSTERS = { stories: 'Stories', work: 'Work', places: 'Places' };
  function setupBrain() {
    if (brainStop) { brainStop(); brainStop = null; }
    var wrap = document.querySelector('.brain');
    var canvas = wrap && wrap.querySelector('canvas');
    if (!canvas) return;
    var card = wrap.querySelector('.brain-card');
    var list = document.querySelector('.brain-list');
    var meta = document.querySelector('.brain-meta');
    var alive = true;
    var ask = function (n) { if (window.dlAsk) window.dlAsk('tell me about "' + n.title + '"'); };
    fetch('/brain/graph.json').then(function (r) { return r.json(); }).then(function (g) {
      if (!alive) return;
      meta.textContent = g.nodes.length + ' notes · synced ' + new Date(g.updated + 'T12:00:00').toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
      g.nodes.forEach(function (n) {
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'row';
        b.dataset.id = n.id;
        b.innerHTML = '<span class="p"></span><span class="s"></span><span class="m"></span>';
        b.querySelector('.p').textContent = n.title;
        b.querySelector('.s').textContent = n.blurb;
        b.querySelector('.m').textContent = CLUSTERS[n.cluster] || '';
        b.addEventListener('click', function () { ask(n); });
        li.appendChild(b);
        list.appendChild(li);
      });

      // Nodes: me in the middle, a hub per cluster, then the notes.
      var nodes = [{ id: 'me', title: 'David', kind: 'me' }];
      Object.keys(CLUSTERS).forEach(function (c) { nodes.push({ id: 'hub-' + c, title: CLUSTERS[c], kind: 'hub' }); });
      g.nodes.forEach(function (n) { nodes.push({ id: n.id, title: n.title, blurb: n.blurb, cluster: n.cluster, kind: 'note' }); });
      var byId = {};
      nodes.forEach(function (n, i) {
        var a = (i / nodes.length) * Math.PI * 2;
        n.x = Math.cos(a) * 160; n.y = Math.sin(a) * 120; n.vx = 0; n.vy = 0;
        byId[n.id] = n;
      });
      byId.me.x = byId.me.y = 0;
      var links = [];
      Object.keys(CLUSTERS).forEach(function (c) { links.push(['me', 'hub-' + c, 130]); });
      g.nodes.forEach(function (n) { links.push(['hub-' + n.cluster, n.id, 75]); });
      g.links.forEach(function (l) { if (byId[l[0]] && byId[l[1]]) links.push([l[0], l[1], 110]); });
      var near = {};
      links.forEach(function (l) { (near[l[0]] = near[l[0]] || {})[l[1]] = 1; (near[l[1]] = near[l[1]] || {})[l[0]] = 1; });

      function step() {
        for (var i = 0; i < nodes.length; i++) {
          for (var j = i + 1; j < nodes.length; j++) {
            var a = nodes[i], b = nodes[j];
            var dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy + 0.01, d = Math.sqrt(d2);
            var f = 2600 / d2;
            a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; b.vx += (dx / d) * f; b.vy += (dy / d) * f;
          }
        }
        links.forEach(function (l) {
          var a = byId[l[0]], b = byId[l[1]];
          var dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          var f = (d - l[2]) * 0.03;
          a.vx += (dx / d) * f; a.vy += (dy / d) * f; b.vx -= (dx / d) * f; b.vy -= (dy / d) * f;
        });
        nodes.forEach(function (n) {
          n.vx -= n.x * 0.004; n.vy -= n.y * 0.006;
          n.vx *= 0.82; n.vy *= 0.82;
          if (n.kind !== 'me') { n.x += n.vx; n.y += n.vy; }
        });
      }

      var ctx = canvas.getContext('2d');
      var W = 0, H = 0, dpr = 1, hover = null, lit = {}, litUntil = 0, ticks = 0;
      // Fit the layout to the canvas; eased so it doesn't jump while settling.
      var view = { s: 1, cx: 0, cy: 0 };
      function fit() {
        var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        nodes.forEach(function (n) { x0 = Math.min(x0, n.x); x1 = Math.max(x1, n.x); y0 = Math.min(y0, n.y); y1 = Math.max(y1, n.y); });
        var target = Math.min((W - 220) / Math.max(1, x1 - x0), (H - 90) / Math.max(1, y1 - y0), 2.2);
        view.s += (target - view.s) * 0.15;
        view.cx += ((x0 + x1) / 2 - view.cx) * 0.15;
        view.cy += ((y0 + y1) / 2 - view.cy) * 0.15;
      }
      var X = function (n) { return (n.x - view.cx) * view.s; };
      var Y = function (n) { return (n.y - view.cy) * view.s; };
      function size() {
        dpr = window.devicePixelRatio || 1;
        W = wrap.clientWidth; H = Math.round(Math.min(560, Math.max(380, W * 0.55)));
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      }
      function color(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
      function draw(t) {
        var t1 = color('--t1'), t2 = color('--t2'), t3 = color('--t3'), rule = color('--rule');
        var accent = '#88c0d0';
        var glow = t < litUntil;
        ctx.setTransform(dpr, 0, 0, dpr, W / 2 * dpr, H / 2 * dpr);
        ctx.clearRect(-W / 2, -H / 2, W, H);
        var focus = hover ? hover.id : null;
        var on = function (id) { return !focus || id === focus || (near[focus] && near[focus][id]); };
        links.forEach(function (l) {
          var a = byId[l[0]], b = byId[l[1]];
          var hot = glow && (lit[a.id] || lit[b.id]);
          ctx.strokeStyle = hot ? accent : rule;
          ctx.globalAlpha = on(a.id) && on(b.id) ? 1 : 0.25;
          ctx.lineWidth = hot ? 1.5 : 1;
          ctx.beginPath(); ctx.moveTo(X(a), Y(a)); ctx.lineTo(X(b), Y(b)); ctx.stroke();
        });
        nodes.forEach(function (n) {
          var hot = glow && lit[n.id];
          var r = n.kind === 'me' ? 7 : n.kind === 'hub' ? 5 : 4;
          if (hot) r += 1.5 + Math.sin(t / 180) * 1.2;
          ctx.globalAlpha = on(n.id) ? 1 : 0.2;
          ctx.fillStyle = hot ? accent : n.kind === 'note' ? t2 : t1;
          ctx.beginPath(); ctx.arc(X(n), Y(n), r, 0, Math.PI * 2); ctx.fill();
          ctx.font = (n.kind === 'note' ? '400 12px ' : '500 13px ') + '-apple-system, BlinkMacSystemFont, "Geist", sans-serif';
          ctx.fillStyle = hot || n === hover ? t1 : n.kind === 'note' ? t3 : t2;
          ctx.textAlign = 'center';
          ctx.fillText(n.title, X(n), Y(n) + r + 14);
        });
        ctx.globalAlpha = 1;
      }
      var raf = 0;
      function frame(t) {
        if (!alive) return;
        if (ticks < 400) { step(); step(); ticks += 2; }
        fit();
        draw(t);
        raf = requestAnimationFrame(frame);
      }
      size();
      if (reduce) for (var k = 0; k < 400; k++) step();
      if (reduce) ticks = 400;
      if (reduce) for (var q = 0; q < 60; q++) fit();
      raf = requestAnimationFrame(frame);
      var ro = new ResizeObserver(size);
      ro.observe(wrap);

      function pickAt(e) {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left - W / 2, y = e.clientY - rect.top - H / 2;
        var best = null, bd = 18 * 18;
        nodes.forEach(function (n) { var d = (X(n) - x) * (X(n) - x) + (Y(n) - y) * (Y(n) - y); if (d < bd) { bd = d; best = n; } });
        return best;
      }
      canvas.addEventListener('pointermove', function (e) {
        hover = pickAt(e);
        canvas.style.cursor = hover && hover.kind === 'note' ? 'pointer' : 'default';
        if (hover && hover.kind === 'note') {
          card.hidden = false;
          card.querySelector('.bc-title').textContent = hover.title;
          card.querySelector('.bc-blurb').textContent = hover.blurb;
          card.style.left = Math.min(W - 260, Math.max(0, X(hover) + W / 2 + 14)) + 'px';
          card.style.top = Math.min(H - 120, Math.max(0, Y(hover) + H / 2 - 20)) + 'px';
        } else card.hidden = true;
      });
      canvas.addEventListener('pointerleave', function () { hover = null; card.hidden = true; });
      canvas.addEventListener('click', function (e) { var n = pickAt(e); if (n && n.kind === 'note') ask(n); });
      var onRecall = function (e) {
        lit = {};
        e.detail.ids.forEach(function (id) { lit[id] = 1; });
        litUntil = performance.now() + 8000;
        document.querySelectorAll('.brain-list button').forEach(function (b) { b.classList.toggle('lit', !!lit[b.dataset.id]); });
        setTimeout(function () { document.querySelectorAll('.brain-list button.lit').forEach(function (b) { b.classList.remove('lit'); }); }, 8000);
      };
      document.addEventListener('dl:recall', onRecall);
      brainStop = function () { alive = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('dl:recall', onRecall); };
    }).catch(function () {});
    var stopFetch = function () { alive = false; };
    brainStop = function () { stopFetch(); };
  }

  // ---- Per page --------------------------------------------------------------------
  function setup() {
    tick();
    syncTheme();
    mountTracks();
    hovered = pinned = null;
    setupWall();
    setupBrain();
  }

  // ---- Router: swap pages in place ----------------------------------------------
  // Same-site page links load in the background and replace .page, so the music
  // and the floating head carry on. Anything odd falls back to a normal load.
  var cache = new Map();
  function internal(a) {
    if (!a || a.target || a.hasAttribute('download')) return null;
    var url = new URL(a.href, location.href);
    if (url.origin !== location.origin || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return null;
    if (url.pathname === location.pathname && url.hash) return null;
    return url;
  }
  function grab(path) {
    if (!cache.has(path)) {
      cache.set(path, fetch(path).then(function (r) {
        if (!r.ok && r.status !== 404) throw new Error('page ' + r.status);
        return r.text();
      }).catch(function (err) { cache.delete(path); throw err; }));
    }
    return cache.get(path);
  }
  var navSeq = 0;
  function go(href, push) {
    var url = new URL(href, location.href);
    var seq = ++navSeq;
    return grab(url.pathname).then(function (html) {
      if (seq !== navSeq) return;
      var doc = new DOMParser().parseFromString(html, 'text/html');
      var page = doc.querySelector('.page');
      var mine = document.querySelector('.page');
      if (!page || !mine) throw new Error('no page');
      if (push !== false) history.pushState(null, '', url.pathname + url.hash);
      document.title = doc.title;
      document.body.className = doc.body.className;
      ['meta[name="description"]', 'link[rel="canonical"]'].forEach(function (sel) {
        var a = document.querySelector(sel), b = doc.querySelector(sel);
        if (a && b) a.replaceWith(b.cloneNode(true));
      });
      var rail = document.querySelector('.rail'), newRail = doc.querySelector('.rail');
      if (rail && newRail) rail.innerHTML = newRail.innerHTML;
      mine.replaceWith(document.adoptNode(page));
      var target = url.hash && document.getElementById(url.hash.slice(1));
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
      var main = document.getElementById('main');
      if (main) { main.setAttribute('tabindex', '-1'); main.focus({ preventScroll: true }); }
      setup();
      document.dispatchEvent(new CustomEvent('dl:page', { detail: { path: location.pathname } }));
    }).catch(function () { location.href = url.href; });
  }
  window.dlGo = function (href) { return go(href); };

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var url = internal(e.target.closest && e.target.closest('a[href]'));
    if (!url) return;
    e.preventDefault();
    go(url.href);
  });
  // Warm the cache when the pointer heads for a link.
  document.addEventListener('pointerover', function (e) {
    var url = internal(e.target.closest && e.target.closest('a[href]'));
    if (url && url.pathname !== location.pathname) grab(url.pathname).catch(function () {});
  });
  // Back and forward. Hash-only changes on the same page are the browser's.
  var shownPath = location.pathname;
  document.addEventListener('dl:page', function () { shownPath = location.pathname; });
  window.addEventListener('popstate', function () { if (location.pathname !== shownPath) go(location.href, false); });

  setup();
})();
