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

  // ---- Per page --------------------------------------------------------------------
  function setup() {
    tick();
    syncTheme();
    mountTracks();
    hovered = pinned = null;
    setupWall();
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
