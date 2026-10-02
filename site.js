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
  // A board of notes in a grid, each tilted a hair (seeded by its text so it
  // stays put between visits). Click one to bring it into focus; click the
  // pad in the corner to write one.
  var when = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });
  var WELCOME = { message: 'hi! leave me a note. say hi, or tell me something cool :)', name: 'david', pinned: true };
  function seed(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  function sticky(n) {
    var b = document.createElement('button');
    b.type = 'button';
    var rnd = seed((n.message || '') + (n.at || ''));
    b.className = 'sticky' + (n.pinned ? ' pinned' : '');
    b._tilt = rnd() * 2 - 1;
    var msg = document.createElement('span');
    msg.className = 'msg';
    msg.textContent = n.message;
    var by = document.createElement('span');
    by.className = 'by';
    by.textContent = (n.name || 'Anonymous') + (n.at ? ' · ' + when.format(new Date(n.at)) : '');
    b.append(msg, by);
    b.setAttribute('aria-label', 'Note from ' + (n.name || 'Anonymous') + ': ' + n.message);
    return b;
  }
  function setupWall() {
    var board = document.querySelector('.board');
    if (!board) return;
    var list = board.querySelector('.board-notes');
    var pad = board.querySelector('.pad');
    var status = document.querySelector('.board-status');
    var notes = [WELCOME];
    var size = function () { return window.innerWidth < 721 ? 140 : 176; };

    // Grid cells, skipping the corner the pad sits in; tilt and jitter per note.
    function layout() {
      var S = size(), gap = window.innerWidth < 721 ? 14 : 26, inset = window.innerWidth < 721 ? 14 : 26;
      var W = board.clientWidth - inset * 2;
      var cols = Math.max(2, Math.floor((W + gap) / (S + gap)));
      var padCols = Math.ceil((pad.offsetWidth + 20) / (S + gap));
      var cell = 0, maxY = 0;
      [].forEach.call(list.querySelectorAll('.sticky'), function (el) {
        var col, row;
        for (;;) { col = cell % cols; row = Math.floor(cell / cols); cell++; if (!(row === 0 && col >= cols - padCols)) break; }
        var spare = (W - cols * S - (cols - 1) * gap) / Math.max(1, cols - 1);
        var x = inset + col * (S + gap + spare);
        var y = inset + row * (S + gap);
        el.style.setProperty('--note', S + 'px');
        el.style.setProperty('--x', x.toFixed(1) + 'px');
        el.style.setProperty('--y', y.toFixed(1) + 'px');
        el.style.setProperty('--r', (el._tilt * 1.2).toFixed(2) + 'deg');
        maxY = Math.max(maxY, y + S);
      });
      board.style.minHeight = Math.max(maxY + inset + 10, pad.offsetHeight + 80) + 'px';
    }
    function render() {
      list.replaceChildren.apply(list, notes.map(function (n) { var li = document.createElement('li'); var b = sticky(n); b._note = n; li.appendChild(b); return li; }));
      layout();
    }
    render();
    fetch(API + '/wall').then(function (r) { return r.ok ? r.json() : []; }).then(function (got) {
      if (!got.length) return;
      notes = got.concat([WELCOME]);
      render();
    }).catch(function () {});
    var ro = new ResizeObserver(layout);
    ro.observe(board);

    // Lifting: animate a fixed copy from where it sits to the middle.
    var dim = null;
    function openDim(onClose) {
      dim = document.createElement('div');
      dim.className = 'lift-dim';
      document.body.appendChild(dim);
      requestAnimationFrame(function () { dim.classList.add('on'); });
      dim.addEventListener('click', onClose);
    }
    function closeDim() {
      if (!dim) return;
      var d = dim; dim = null;
      d.classList.remove('on');
      setTimeout(function () { d.remove(); }, 260);
    }
    function fly(el, from, to, opts) {
      var dx = from.left - to.left, dy = from.top - to.top, k = from.width / to.width;
      return el.animate([
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ') rotate(' + (opts.r0 || 0) + 'deg)', opacity: opts.o0 == null ? 1 : opts.o0 },
        { transform: 'none', opacity: 1 }
      ], { duration: reduce ? 0 : 420, easing: 'cubic-bezier(.2,.8,.2,1)', direction: opts.reverse ? 'reverse' : 'normal', fill: 'both' }).finished;
    }
    function center(w) { return { left: (window.innerWidth - w) / 2, top: Math.max(24, (window.innerHeight - w) / 2), width: w }; }
    var lifted = null;
    function lift(src) {
      if (lifted) return;
      var r = src.getBoundingClientRect();
      var copy = sticky(src._note);
      copy.classList.add('lifted');
      copy.setAttribute('role', 'dialog');
      copy.setAttribute('aria-modal', 'true');
      document.body.appendChild(copy);
      var w = copy.offsetWidth, c = center(w);
      copy.style.left = c.left + 'px';
      copy.style.top = c.top + 'px';
      src.style.visibility = 'hidden';
      lifted = { copy: copy, src: src };
      openDim(drop);
      fly(copy, r, c, { r0: parseFloat(src.style.getPropertyValue('--r')) || 0 });
      copy.focus();
      copy.addEventListener('click', drop);
    }
    function drop() {
      if (!lifted) return;
      var l = lifted; lifted = null;
      closeDim();
      var r = l.src.getBoundingClientRect();
      fly(l.copy, r, l.copy.getBoundingClientRect(), { reverse: true, r0: parseFloat(l.src.style.getPropertyValue('--r')) || 0 }).then(function () {
        l.copy.remove();
        l.src.style.visibility = '';
        l.src.focus({ preventScroll: true });
      });
    }
    list.addEventListener('click', function (e) { var b = e.target.closest('.sticky'); if (b) lift(b); });

    // Writing: a sheet peels off the pad and comes to the middle.
    var writing = null;
    pad.addEventListener('click', function () {
      if (writing || lifted) return;
      var tpl = document.getElementById('write-note');
      var form = tpl.content.firstElementChild.cloneNode(true);
      form.classList.add('lifted');
      document.body.appendChild(form);
      var w = form.offsetWidth, c = center(w);
      form.style.left = c.left + 'px';
      form.style.top = c.top + 'px';
      var from = pad.querySelector('.pad-sheet.top').getBoundingClientRect();
      writing = form;
      openDim(cancel);
      fly(form, from, c, { r0: 0 }).then(function () { form.message.focus(); });
      form.querySelector('.cancel').addEventListener('click', cancel);
      form.addEventListener('submit', post);
      status.textContent = '';
    });
    function cancel() {
      if (!writing) return;
      var f = writing; writing = null;
      closeDim();
      fly(f, pad.querySelector('.pad-sheet.top').getBoundingClientRect(), f.getBoundingClientRect(), { reverse: true, r0: 0 }).then(function () { f.remove(); pad.focus({ preventScroll: true }); });
    }
    function post(e) {
      e.preventDefault();
      var f = writing;
      var message = f.message.value.trim();
      if (!message) { f.message.focus(); return; }
      var name = f.name.value.trim();
      var visitor = null;
      try { visitor = localStorage.getItem('dl-visitor'); } catch (err) {}
      f.querySelector('.stick').disabled = true;
      f.querySelector('.stick').textContent = 'Posting...';
      fetch(API + '/note', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ public: true, visitor: visitor, name: name, message: message, page: '/notes/' })
      }).then(function (r) { return r.ok ? r.json() : { saved: false }; }).catch(function () { return { saved: false }; }).then(function (res) {
        if (!res.saved && !res.mailed && !res.posted) {
          f.querySelector('.stick').disabled = false;
          f.querySelector('.stick').textContent = 'Post';
          status.textContent = "That didn't go through. Email me instead: davidliu8473@gmail.com";
          return;
        }
        writing = null;
        closeDim();
        var from = f.getBoundingClientRect();
        if (res.posted) {
          // Onto the board, newest first.
          var n = { message: message, name: name, at: new Date().toISOString() };
          notes = [n].concat(notes);
          render();
          var el = list.querySelector('.sticky');
          el.style.visibility = 'hidden';
          el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
          setTimeout(function () {
            var to = el.getBoundingClientRect();
            f.animate([{ transform: 'none' }, { transform: 'translate(' + (to.left - from.left) + 'px,' + (to.top - from.top) + 'px) scale(' + (to.width / from.width) + ') rotate(' + (parseFloat(el.style.getPropertyValue('--r')) || 0) + 'deg)' }], { duration: reduce ? 0 : 520, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' }).finished.then(function () {
              f.remove();
              el.style.visibility = '';
            });
          }, 250);
          status.textContent = 'Posted. Thank you!';
        } else {
          // Didn't pass the check: it shrinks away to the head, privately.
          var head = document.querySelector('.dl-head');
          var to = head ? head.getBoundingClientRect() : { left: window.innerWidth - 80, top: window.innerHeight - 80, width: 40 };
          f.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + (to.left + to.width / 2 - from.left - from.width / 2) + 'px,' + (to.top + 40 - from.top - from.height / 2) + 'px) scale(.08)', opacity: 0 }], { duration: reduce ? 0 : 700, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' }).finished.then(function () { f.remove(); });
          status.textContent = "Sent to David privately. It didn't pass the check for the wall.";
        }
      });
    }
    var onKey = function (e) { if (e.key === 'Escape') { if (lifted) drop(); else if (writing) cancel(); } };
    document.addEventListener('keydown', onKey);
    wallStop = function () { ro.disconnect(); document.removeEventListener('keydown', onKey); closeDim(); if (writing) writing.remove(); if (lifted) lifted.copy.remove(); writing = lifted = null; };
  }
  var wallStop = null;

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
    if (wallStop) { wallStop(); wallStop = null; }
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
