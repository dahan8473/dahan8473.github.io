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
  // A big wall where each note stays wherever its writer stuck it, tilted a few
  // degrees, newer ones on top. Click a note to bring it into focus. The pad in
  // the corner: write a note, then click the spot on the wall to stick it.
  var when = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric' });
  // The wall in its own units; it scales to fit, and scrolls sideways on phones.
  var VW = 1200, VH = 780, NS = 184;
  var WELCOME = { id: 'welcome', message: 'hi! leave me a note. say hi, or tell me something cool :)', name: 'david', pinned: true, x: 0.03, y: 0.05 };
  function seed(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  function sticky(n) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'sticky' + (n.pinned ? ' pinned' : '');
    var rnd = seed((n.message || '') + (n.at || '') + (n.id || ''));
    n.tilt = n.pinned ? -1.5 : n.tilt != null ? n.tilt : (rnd() * 2 - 1) * 4;
    // Old notes without a spot get a steady one from their text.
    if (n.x == null || n.y == null) { n.x = 0.05 + rnd() * 0.8; n.y = 0.08 + rnd() * 0.84; }
    b._note = n;
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
    var wrap = document.querySelector('.board-wrap');
    var board = wrap && wrap.querySelector('.board');
    if (!board) return;
    var list = board.querySelector('.board-notes');
    var pad = board.querySelector('.pad');
    var status = document.querySelector('.board-status');
    var notes = [WELCOME];
    var scale = 1;

    function spot(el) {
      var n = el._note;
      el.style.setProperty('--x', (n.x * (VW - NS) * scale).toFixed(1) + 'px');
      el.style.setProperty('--y', (n.y * (VH - NS) * scale).toFixed(1) + 'px');
      el.style.setProperty('--r', n.tilt.toFixed(2) + 'deg');
    }
    function measure() {
      scale = Math.max(wrap.clientWidth / VW, 0.62);
      board.style.width = (VW * scale).toFixed(0) + 'px';
      board.style.height = (VH * scale).toFixed(0) + 'px';
      board.style.setProperty('--note', (NS * scale).toFixed(1) + 'px');
      board.style.setProperty('--s', scale.toFixed(3));
      board.style.fontSize = scale < 0.8 ? '14px' : '';
      [].forEach.call(board.querySelectorAll('.sticky'), spot);
    }
    function render() {
      list.replaceChildren.apply(list, notes.map(function (n) { var li = document.createElement('li'); li.appendChild(sticky(n)); return li; }));
      measure();
    }
    render();
    fetch(API + '/wall').then(function (r) { return r.ok ? r.json() : []; }).then(function (got) {
      if (!got.length) return;
      notes = [WELCOME].concat(got);
      render();
    }).catch(function () {});
    var ro = new ResizeObserver(measure);
    ro.observe(wrap);

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
        { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(' + k + ') rotate(' + (opts.r0 || 0) + 'deg)' },
        { transform: 'none' }
      ], { duration: reduce ? 0 : 420, easing: 'cubic-bezier(.2,.8,.2,1)', direction: opts.reverse ? 'reverse' : 'normal', fill: 'both' }).finished;
    }
    function center(w) { return { left: (window.innerWidth - w) / 2, top: Math.max(24, (window.innerHeight - w) / 2), width: w }; }
    var lifted = null;
    function lift(src) {
      if (lifted || placing) return;
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
      fly(copy, r, c, { r0: src._note.tilt });
      copy.focus();
      copy.addEventListener('click', drop);
    }
    function drop() {
      if (!lifted) return;
      var l = lifted; lifted = null;
      closeDim();
      fly(l.copy, l.src.getBoundingClientRect(), l.copy.getBoundingClientRect(), { reverse: true, r0: l.src._note.tilt }).then(function () {
        l.copy.remove();
        l.src.style.visibility = '';
        l.src.focus({ preventScroll: true });
      });
    }
    list.addEventListener('click', function (e) { var b = e.target.closest('.sticky'); if (b) lift(b); });

    // Writing: a sheet comes off the pad to the middle of the screen.
    var writing = null;
    var draft = { message: '', name: '' };
    function openWriter() {
      if (writing || lifted || placing) return;
      var form = document.getElementById('write-note').content.firstElementChild.cloneNode(true);
      form.classList.add('lifted');
      form.message.value = draft.message;
      form.name.value = draft.name;
      document.body.appendChild(form);
      var w = form.offsetWidth, c = center(w);
      form.style.left = c.left + 'px';
      form.style.top = c.top + 'px';
      writing = form;
      openDim(cancel);
      fly(form, pad.querySelector('.pad-sheet.top').getBoundingClientRect(), c, {}).then(function () { form.message.focus(); });
      form.querySelector('.cancel').addEventListener('click', cancel);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        var message = form.message.value.trim();
        if (!message) { form.message.focus(); return; }
        draft = { message: message, name: form.name.value.trim() };
        writing = null;
        closeDim();
        form.remove();
        startPlacing();
      });
      status.textContent = '';
    }
    function cancel() {
      if (!writing) return;
      var f = writing; writing = null;
      draft = { message: f.message.value, name: f.name.value };
      closeDim();
      fly(f, pad.querySelector('.pad-sheet.top').getBoundingClientRect(), f.getBoundingClientRect(), { reverse: true }).then(function () { f.remove(); pad.focus({ preventScroll: true }); });
    }
    pad.addEventListener('click', openWriter);
    var writeBtn = document.querySelector('.write-btn');
    if (writeBtn) writeBtn.addEventListener('click', openWriter);

    // Placing: the note follows the pointer over the wall; click to stick it.
    var placing = null;
    function startPlacing() {
      var n = { message: draft.message, name: draft.name, x: 0.45, y: 0.4, at: new Date().toISOString() };
      var ghost = sticky(n);
      ghost.classList.add('ghost');
      ghost.tabIndex = -1;
      list.appendChild(ghost);
      spot(ghost);
      placing = { ghost: ghost, n: n };
      board.classList.add('placing');
      status.textContent = 'Now click anywhere on the wall to stick it. Arrow keys and Enter work too. Esc to go back.';
      board.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
    function moveTo(clientX, clientY) {
      if (!placing) return;
      var r = board.getBoundingClientRect();
      var w = NS * scale;
      placing.n.x = Math.min(1, Math.max(0, (clientX - r.left - w / 2) / ((VW - NS) * scale)));
      placing.n.y = Math.min(1, Math.max(0, (clientY - r.top - w / 2) / ((VH - NS) * scale)));
      spot(placing.ghost);
    }
    board.addEventListener('pointermove', function (e) { if (placing) moveTo(e.clientX, e.clientY); });
    board.addEventListener('click', function (e) {
      if (!placing || e.target.closest('.pad')) return;
      e.stopPropagation();
      moveTo(e.clientX, e.clientY);
      stick();
    }, true);
    function stopPlacing() {
      board.classList.remove('placing');
      var p = placing; placing = null;
      return p;
    }
    function stick() {
      var p = stopPlacing();
      if (!p) return;
      var g = p.ghost;
      g.classList.remove('ghost');
      g.classList.add('pending');
      status.textContent = 'Sticking it...';
      var visitor = null;
      try { visitor = localStorage.getItem('dl-visitor'); } catch (err) {}
      fetch(API + '/note', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: JSON.stringify({ public: true, visitor: visitor, name: p.n.name, message: p.n.message, page: '/notes/', x: p.n.x, y: p.n.y })
      }).then(function (r) { return r.ok ? r.json() : { saved: false }; }).catch(function () { return { saved: false }; }).then(function (res) {
        g.classList.remove('pending');
        if (res.posted) {
          notes.push(p.n);
          draft = { message: '', name: '' };
          status.textContent = 'Stuck. Thank you!';
        } else if (res.saved || res.mailed) {
          // Didn't pass the check: it shrinks away to the head, privately.
          draft = { message: '', name: '' };
          var from = g.getBoundingClientRect();
          var head = document.querySelector('.dl-head');
          var to = head ? head.getBoundingClientRect() : { left: window.innerWidth - 80, top: window.innerHeight - 80, width: 40 };
          g.animate([{ transform: getComputedStyle(g).transform, opacity: 1 }, { transform: 'translate(' + (to.left + to.width / 2 - from.left) + 'px,' + (to.top + 40 - from.top) + 'px) scale(.08)', opacity: 0 }], { duration: reduce ? 0 : 700, easing: 'cubic-bezier(.5,0,.2,1)', fill: 'forwards' }).finished.then(function () { g.parentNode && g.remove(); });
          status.textContent = "Sent to David privately. It didn't pass the check for the wall.";
        } else {
          g.remove();
          status.textContent = "That didn't go through. Your note is still in the pad; try again, or email me: davidliu8473@gmail.com";
        }
      });
    }
    var onKey = function (e) {
      if (placing) {
        var step = 0.025, n = placing.n;
        if (e.key === 'Escape') { e.preventDefault(); stopPlacing().ghost.remove(); status.textContent = ''; openWriter(); return; }
        if (e.key === 'Enter') { e.preventDefault(); stick(); return; }
        var k = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
        if (k) { e.preventDefault(); n.x = Math.min(1, Math.max(0, n.x + k[0])); n.y = Math.min(1, Math.max(0, n.y + k[1])); spot(placing.ghost); }
        return;
      }
      if (e.key === 'Escape') { if (lifted) drop(); else if (writing) cancel(); }
    };
    document.addEventListener('keydown', onKey);
    wallStop = function () { ro.disconnect(); document.removeEventListener('keydown', onKey); closeDim(); if (writing) writing.remove(); if (lifted) lifted.copy.remove(); writing = lifted = placing = null; };
  }
  var wallStop = null;

  // ---- Second brain -------------------------------------------------------------
  // Everything the head knows about me as one graph, Obsidian style: the tree in
  // brain/map.json plus the links between notes in brain/graph.json. Drag nodes
  // or the canvas, scroll or pinch to zoom, click a node to see what it touches,
  // double click to ask the head about it. Notes it's recalling light up.
  var brainStop = null;
  var R = { root: 11, topic: 7.5, branch: 4.2, leaf: 2.6 };
  var Q = { root: 1400, topic: 800, branch: 220, leaf: 50 };
  var FONT = { root: '600 15px ', topic: '500 13.5px ', branch: '400 12px ', leaf: '400 11px ' };
  function setupBrain() {
    if (brainStop) { brainStop(); brainStop = null; }
    var wrap = document.querySelector('.brain');
    var canvas = wrap && wrap.querySelector('canvas');
    if (!canvas) return;
    var meta = document.querySelector('.brain-meta');
    var alive = true;
    brainStop = function () { alive = false; };
    var json = function (u) { return fetch(u).then(function (r) { return r.json(); }); };
    Promise.all([json('/brain/map.json'), json('/brain/graph.json').catch(function () { return { nodes: [], links: [] }; })]).then(function (res) {
      if (!alive) return;
      var nodes = [], byId = {}, links = [], seen = {};
      function link(a, b, cross) {
        var k = a < b ? a + '|' + b : b + '|' + a;
        if (a === b || seen[k] || !byId[a] || !byId[b]) return;
        seen[k] = 1;
        links.push({ a: byId[a], b: byId[b], cross: cross });
        if (!cross) { byId[a].deg++; byId[b].deg++; }
      }
      function add(t, parent, i) {
        var n = { id: t.id || parent.id + '/' + i, title: t.t, parent: parent, kids: [], deg: 0, depth: parent ? parent.depth + 1 : 0, x: 0, y: 0, vx: 0, vy: 0 };
        nodes.push(n);
        byId[n.id] = n;
        if (parent) { parent.kids.push(n); link(parent.id, n.id); }
        (t.c || []).forEach(function (c, j) { add(c, n, j); });
        return n;
      }
      var root = add(res[0], null, 0);
      // Notes synced after the map was last edited still show up, under Stories.
      res[1].nodes.forEach(function (n, i) { if (!byId[n.id]) add({ t: n.title, id: n.id }, byId.stories || root, 'n' + i); });
      res[0].links.concat(res[1].links).forEach(function (l) { link(l[0], l[1], true); });
      nodes.forEach(function (n) { n.kind = !n.parent ? 'root' : n.depth === 1 ? 'topic' : n.kids.length ? 'branch' : 'leaf'; n.r = R[n.kind]; n.q = Q[n.kind]; });
      links.forEach(function (l) {
        var ca = l.a.deg, cb = l.b.deg;
        l.bias = ca / (ca + cb);
        // Tree links hold the clusters together; cross links only lean on them.
        l.k = l.cross ? 0.015 : Math.max(0.3, 1 / Math.min(ca, cb));
        var kind = l.b.kind;
        l.len = l.cross ? 260 : kind === 'topic' ? 330 : kind === 'branch' ? 100 + l.b.kids.length * 7 : l.a.kind === 'topic' ? 50 + l.a.kids.length * 4 : 30 + l.a.kids.length * 2;
      });
      var RANK = { root: 0, topic: 1, branch: 2, leaf: 3 };
      var order = nodes.slice().sort(function (a, b) { return RANK[a.kind] - RANK[b.kind] || b.kids.length - a.kids.length || a.depth - b.depth; });
      var near = {};
      links.forEach(function (l) { (near[l.a.id] = near[l.a.id] || {})[l.b.id] = 1; (near[l.b.id] = near[l.b.id] || {})[l.a.id] = 1; });
      meta.textContent = nodes.length + ' nodes · ' + links.length + ' links';

      // Start from a radial tree so the forces only have to relax it, stretched
      // to the canvas: wide on a desktop, tall on a phone.
      var wide = wrap.clientWidth > wrap.clientHeight * 1.1;
      var GX = wide ? 0.005 : 0.012, GY = wide ? 0.016 : 0.007;
      var leaves = function (n) { return n.kids.length ? n.kids.reduce(function (s, k) { return s + leaves(k); }, 0) : 1; };
      (function place(n, a0, a1) {
        var a = (a0 + a1) / 2, d = [0, 300, 430, 520, 590][n.depth] || 650;
        n.x = Math.cos(a) * d * (wide ? 1.5 : 1); n.y = Math.sin(a) * d * (wide ? 1 : 1.4);
        var total = leaves(n), at = a0;
        n.kids.forEach(function (k) { var span = (a1 - a0) * leaves(k) / total; place(k, at, at + span); at += span; });
      })(root, 0, Math.PI * 2);

      // A small d3-style force simulation: springs, many-body repulsion, gravity.
      var alpha = 1, alphaTarget = 0, ALPHA_MIN = 0.002, DECAY = 1 - Math.pow(ALPHA_MIN, 1 / 300);
      function tick() {
        alpha += (alphaTarget - alpha) * DECAY;
        links.forEach(function (l) {
          var a = l.a, b = l.b;
          var dx = b.x + b.vx - a.x - a.vx, dy = b.y + b.vy - a.y - a.vy;
          var d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
          var f = (d - l.len) / d * alpha * l.k;
          dx *= f; dy *= f;
          b.vx -= dx * l.bias; b.vy -= dy * l.bias;
          a.vx += dx * (1 - l.bias); a.vy += dy * (1 - l.bias);
        });
        for (var i = 0; i < nodes.length; i++) {
          var a = nodes[i];
          for (var j = i + 1; j < nodes.length; j++) {
            var b = nodes[j];
            var dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
            if (l2 > 250000) continue;
            if (l2 < 25) l2 = 25;
            var fa = b.q * alpha / l2, fb = a.q * alpha / l2;
            a.vx -= dx * fa; a.vy -= dy * fa;
            b.vx += dx * fb; b.vy += dy * fb;
          }
        }
        nodes.forEach(function (n) {
          if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = n.vy = 0; return; }
          n.vx -= n.x * GX * alpha; n.vy -= n.y * GY * alpha;
          n.vx *= 0.6; n.vy *= 0.6;
          n.x += n.vx; n.y += n.vy;
        });
        root.x = root.y = 0;
      }
      var hot = function () { return alpha > ALPHA_MIN || alphaTarget > 0; };

      var ctx = canvas.getContext('2d');
      var W = 0, H = 0, dpr = 1;
      var view = { k: 1, cx: 0, cy: 0 }, steered = false;
      var hover = null, picked = null, lit = {}, litUntil = 0, dirty = true;
      var sx = function (n) { return (n.x - view.cx) * view.k + W / 2; };
      var sy = function (n) { return (n.y - view.cy) * view.k + H / 2; };
      function bounds() {
        var b = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
        nodes.forEach(function (n) { b.x0 = Math.min(b.x0, n.x); b.x1 = Math.max(b.x1, n.x); b.y0 = Math.min(b.y0, n.y); b.y1 = Math.max(b.y1, n.y); });
        return b;
      }
      // Until someone touches the view, keep the whole map in frame.
      function fit(ease) {
        var b = bounds(), pad = W < 560 ? 30 : 70;
        var k = Math.max(0.2, Math.min(1.6, (W - pad * 2) / Math.max(1, b.x1 - b.x0), (H - pad * 2) / Math.max(1, b.y1 - b.y0)));
        view.k += (k - view.k) * ease;
        view.cx += ((b.x0 + b.x1) / 2 - view.cx) * ease;
        view.cy += ((b.y0 + b.y1) / 2 - view.cy) * ease;
      }
      function size() {
        dpr = window.devicePixelRatio || 1;
        W = wrap.clientWidth; H = wrap.clientHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
        if (!steered) fit(1);
        dirty = true;
      }
      function color(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
      var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
      function labelAlpha(n, focusOn) {
        if (focusOn) return 1;
        if (n.kind === 'root' || n.kind === 'topic') return 1;
        if (n.kind === 'branch') return clamp((view.k - 0.3) / 0.15);
        return clamp((view.k - 0.95) / 0.35);
      }
      function draw(t) {
        var t1 = color('--t1'), t2 = color('--t2'), t3 = color('--t3'), rule = color('--rule'), bg = color('--bg');
        var accent = '#88c0d0';
        var glow = t < litUntil;
        var focus = picked || hover;
        var on = function (n) { return !focus || n === focus || (near[focus.id] && near[focus.id][n.id]); };
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.lineWidth = 1;
        links.forEach(function (l) {
          var touch = focus && (l.a === focus || l.b === focus);
          var shine = glow && (lit[l.a.id] || lit[l.b.id]);
          ctx.strokeStyle = touch || shine ? accent : rule;
          ctx.globalAlpha = focus ? (touch ? 0.9 : 0.35) : l.cross ? 0.7 : 1;
          ctx.beginPath(); ctx.moveTo(sx(l.a), sy(l.a)); ctx.lineTo(sx(l.b), sy(l.b)); ctx.stroke();
        });
        var scale = Math.min(1.25, Math.max(0.7, Math.sqrt(view.k)));
        nodes.forEach(function (n) {
          var shine = glow && lit[n.id];
          var r = n.r * scale + (shine ? 1.5 + Math.sin(t / 180) * 1.2 : 0);
          ctx.globalAlpha = on(n) ? 1 : 0.15;
          ctx.fillStyle = n === focus || shine ? accent : n.kind === 'leaf' ? t3 : n.kind === 'branch' ? t2 : t1;
          ctx.beginPath(); ctx.arc(sx(n), sy(n), r, 0, Math.PI * 2); ctx.fill();
        });
        // Labels: the ones in focus first, then by size. Below the topics, one
        // that would land on a label already drawn is skipped.
        ctx.textAlign = 'center';
        ctx.lineJoin = 'round';
        var boxes = [];
        var forced = function (n) { return n === hover || (focus && on(n)) || (glow && lit[n.id]); };
        order.filter(forced).concat(order.filter(function (n) { return !forced(n); })).forEach(function (n) {
          var must = forced(n), shine = glow && lit[n.id];
          var a = labelAlpha(n, must);
          if (focus && !must) a *= 0.15;
          if (a < 0.02) return;
          // Leaves put their label on the side facing away from their parent,
          // so a fan of them reads like a radial tree. Everything else sits below.
          var rr = n.r * scale, x = sx(n), y = sy(n) + rr + 14, align = 'center';
          if (n.kind === 'leaf') {
            var dx = n.x - n.parent.x, dy = n.y - n.parent.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
            if (Math.abs(dx / d) > 0.45) { align = dx > 0 ? 'left' : 'right'; x += dx > 0 ? rr + 5 : -rr - 5; y = sy(n) + 4; }
            else y = dy > 0 ? sy(n) + rr + 11 : sy(n) - rr - 5;
          }
          if (x < -200 || x > W + 200 || y < -20 || y > H + 20) return;
          ctx.font = FONT[n.kind] + '-apple-system, BlinkMacSystemFont, "Geist", sans-serif';
          var w = (n.w = n.w || {})[ctx.font] || (n.w[ctx.font] = ctx.measureText(n.title).width);
          var left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
          var box = { x0: left - 3, x1: left + w + 3, y0: y - 11, y1: y + 3 };
          if (RANK[n.kind] > 1 && boxes.some(function (b) { return b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1; })) return;
          boxes.push(box);
          ctx.globalAlpha = a;
          ctx.textAlign = align;
          ctx.lineWidth = 3;
          ctx.strokeStyle = bg;
          ctx.strokeText(n.title, x, y);
          ctx.fillStyle = n === focus || shine ? t1 : n.kind === 'leaf' ? t3 : n.kind === 'branch' ? t2 : t1;
          ctx.fillText(n.title, x, y);
        });
        ctx.globalAlpha = 1;
      }
      var raf = 0, lastLit = false;
      function frame(t) {
        if (!alive) return;
        if (hot()) { tick(); dirty = true; }
        if (!steered && hot()) fit(0.08);
        var glowing = t < litUntil;
        if (dirty || glowing || lastLit) { draw(t); dirty = false; }
        lastLit = glowing;
        raf = requestAnimationFrame(frame);
      }
      for (var k = 0; k < (reduce ? 400 : 80); k++) tick();
      size();
      raf = requestAnimationFrame(frame);
      var ro = new ResizeObserver(size);
      ro.observe(wrap);

      // ---- Input: drag a node, pan the canvas, wheel or pinch to zoom.
      function world(e) {
        var rect = canvas.getBoundingClientRect();
        return { x: (e.clientX - rect.left - W / 2) / view.k + view.cx, y: (e.clientY - rect.top - H / 2) / view.k + view.cy, sx: e.clientX - rect.left, sy: e.clientY - rect.top };
      }
      function pickAt(e) {
        var p = world(e), best = null, bd = Infinity;
        nodes.forEach(function (n) {
          var dx = sx(n) - p.sx, dy = sy(n) - p.sy, d = dx * dx + dy * dy, reach = Math.max(12, n.r * view.k + 6);
          if (d < reach * reach && d < bd) { bd = d; best = n; }
        });
        return best;
      }
      function zoomAt(px, py, k) {
        k = Math.max(0.15, Math.min(4, k));
        var wx = (px - W / 2) / view.k + view.cx, wy = (py - H / 2) / view.k + view.cy;
        view.k = k;
        view.cx = wx - (px - W / 2) / k; view.cy = wy - (py - H / 2) / k;
        steered = dirty = true;
      }
      var ptrs = new Map(), drag = null, pinch = null, lastTap = null;
      function ask(n) {
        if (!window.dlAsk || n.kind === 'root') return;
        var up = n.parent && n.parent.kind !== 'root' && n.parent.kind !== 'topic' ? ' (' + n.parent.title + ')' : '';
        window.dlAsk('tell me about "' + n.title + '"' + up);
      }
      function tap(n) {
        var t = performance.now();
        if (n && lastTap && lastTap.n === n && t - lastTap.t < 380) { lastTap = null; ask(n); return; }
        lastTap = { n: n, t: t };
        picked = n;
        dirty = true;
      }
      canvas.addEventListener('pointerdown', function (e) {
        canvas.setPointerCapture(e.pointerId);
        ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 2) {
          var p = Array.from(ptrs.values());
          if (drag && drag.node) { drag.node.fx = drag.node.fy = null; alphaTarget = 0; }
          drag = null;
          pinch = { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), k: view.k };
          return;
        }
        var n = pickAt(e), p0 = world(e);
        drag = { node: n, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, dx: n ? n.x - p0.x : 0, dy: n ? n.y - p0.y : 0 };
        canvas.classList.add('grabbing');
      });
      canvas.addEventListener('pointermove', function (e) {
        if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pinch && ptrs.size === 2) {
          var p = Array.from(ptrs.values()), rect = canvas.getBoundingClientRect();
          zoomAt((p[0].x + p[1].x) / 2 - rect.left, (p[0].y + p[1].y) / 2 - rect.top, pinch.k * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y) / pinch.d);
          return;
        }
        if (!drag) {
          var h = pickAt(e);
          if (h !== hover) { hover = h; dirty = true; canvas.style.cursor = h ? 'pointer' : ''; }
          return;
        }
        if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
        drag.moved = true;
        if (drag.node && drag.node !== root) {
          var w = world(e);
          drag.node.fx = w.x + drag.dx; drag.node.fy = w.y + drag.dy;
          alphaTarget = 0.3; if (alpha < 0.3) alpha = 0.3;
          steered = true;
        } else {
          view.cx -= (e.clientX - drag.lx) / view.k;
          view.cy -= (e.clientY - drag.ly) / view.k;
          steered = dirty = true;
        }
        drag.lx = e.clientX; drag.ly = e.clientY;
      });
      function release(e) {
        ptrs.delete(e.pointerId);
        canvas.classList.remove('grabbing');
        if (pinch) { if (!ptrs.size) pinch = null; return; }
        if (!drag) return;
        if (drag.node) { drag.node.fx = drag.node.fy = null; alphaTarget = 0; }
        if (!drag.moved && e.type === 'pointerup') tap(drag.node);
        drag = null;
      }
      canvas.addEventListener('pointerup', release);
      canvas.addEventListener('pointercancel', release);
      canvas.addEventListener('pointerleave', function () { if (!drag && hover) { hover = null; dirty = true; } });
      canvas.addEventListener('wheel', function (e) {
        e.preventDefault();
        var rect = canvas.getBoundingClientRect();
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, view.k * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
      }, { passive: false });
      var onKey = function (e) { if (e.key === 'Escape' && picked) { picked = null; dirty = true; } };
      document.addEventListener('keydown', onKey);
      var onRecall = function (e) {
        lit = {};
        e.detail.ids.forEach(function (id) { lit[id] = 1; });
        litUntil = performance.now() + 8000;
      };
      document.addEventListener('dl:recall', onRecall);
      brainStop = function () { alive = false; cancelAnimationFrame(raf); ro.disconnect(); document.removeEventListener('dl:recall', onRecall); document.removeEventListener('keydown', onKey); };
    }).catch(function () {});
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
