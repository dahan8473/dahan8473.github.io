(function () {
  // Local time, London ON
  var clock = document.getElementById('clock');
  if (clock) {
    var fmt = new Intl.DateTimeFormat('en-CA', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Toronto'
    });
    var tick = function () { clock.textContent = fmt.format(new Date()); };
    tick();
    setInterval(tick, 30000);
  }

  // Guitar recordings. Drop files in /media/guitar/ and list them here.
  var TRACKS = [
    { src: '/media/guitar/capricho-arabe.mp3', title: 'Capricho Árabe · Tárrega', dur: '5:28' },
    { src: '/media/guitar/tango-en-skai.mp3', title: 'Tango en Skaï · Dyens', dur: '2:22' },
    { src: '/media/guitar/marieta.mp3', title: 'Marieta · Tárrega', dur: '2:06' },
    { src: '/media/guitar/frog-galliard.mp3', title: 'The Frog Galliard · Dowland', dur: '1:59' }
  ];

  var players = [];

  var mount = document.getElementById('guitar-tracks');
  if (mount && TRACKS.length) {
    TRACKS.forEach(function (t) {
      var row = document.createElement('div');
      row.className = 'track';

      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Play ' + t.title);
      btn.setAttribute('aria-pressed', 'false');
      btn.innerHTML =
        '<svg class="pl" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M0 0l10 6-10 6z"/></svg>' +
        '<svg class="pa" viewBox="0 0 10 12" fill="currentColor" aria-hidden="true"><path d="M0 0h3.2v12H0zM6.8 0H10v12H6.8z"/></svg>';

      var title = document.createElement('span');
      title.className = 't-title';
      title.textContent = t.title;

      var eq = document.createElement('span');
      eq.className = 'eq';
      eq.setAttribute('aria-hidden', 'true');
      eq.innerHTML = '<i></i><i></i><i></i>';

      var dur = document.createElement('span');
      dur.className = 't-dur';
      dur.textContent = t.dur;

      var bar = document.createElement('span');
      bar.className = 't-bar';
      bar.innerHTML = '<span class="t-fill"></span>';

      row.append(btn, title, eq, dur, bar);
      mount.appendChild(row);

      var audio = new Audio();
      audio.preload = 'none';
      audio.src = t.src;
      var fill = bar.firstChild;

      function stop() {
        audio.pause();
        row.classList.remove('playing');
        btn.setAttribute('aria-pressed', 'false');
        btn.setAttribute('aria-label', 'Play ' + t.title);
      }

      btn.addEventListener('click', function () {
        if (row.classList.contains('playing')) { stop(); return; }
        players.forEach(function (p) { p.stop(); });
        audio.play();
        row.classList.add('playing');
        btn.setAttribute('aria-pressed', 'true');
        btn.setAttribute('aria-label', 'Pause ' + t.title);
      });

      audio.addEventListener('timeupdate', function () {
        if (audio.duration) fill.style.width = (audio.currentTime / audio.duration) * 100 + '%';
      });
      audio.addEventListener('ended', function () {
        stop();
        fill.style.width = '0%';
      });

      players.push({ stop: stop });
    });
  }

  // Hover photo reveals. Add data-photo="/media/hover/name.jpg" to any element.
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var targets = document.querySelectorAll('[data-photo]');
  if (canHover && targets.length) {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var img = document.createElement('img');
    img.className = 'hover-photo';
    img.alt = '';
    document.body.appendChild(img);

    var x = 0, y = 0, tx = 0, ty = 0, raf = null, visible = false;
    function frame() {
      var k = reduce ? 1 : 0.18;
      x += (tx - x) * k;
      y += (ty - y) * k;
      img.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      if (visible) raf = requestAnimationFrame(frame);
    }
    document.addEventListener('mousemove', function (e) {
      tx = Math.min(e.clientX + 28, window.innerWidth - 268);
      ty = Math.max(12, e.clientY - 180);
    });
    targets.forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        img.src = el.getAttribute('data-photo');
        x = tx; y = ty;
        visible = true;
        img.classList.add('on');
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(frame);
      });
      el.addEventListener('mouseleave', function () {
        visible = false;
        img.classList.remove('on');
        cancelAnimationFrame(raf);
      });
    });
  }

  // Resume: hover an entry and its note shows up in the margin; click to
  // keep it there. Narrow screens and touch open it inline on tap instead.
  var items = [].slice.call(document.querySelectorAll('.r-item:not(.plain)'));
  if (items.length) {
    var margin = window.matchMedia('(min-width: 1180px) and (hover: hover)');
    var hovered = null;
    var pinned = null;
    var show = function () {
      var on = (margin.matches && hovered) || pinned;
      items.forEach(function (el) {
        el.classList.toggle('on', el === on);
        el.classList.toggle('pinned', el === pinned);
      });
    };
    var pin = function (el) { pinned = pinned === el ? null : el; show(); };
    items.forEach(function (el) {
      el.addEventListener('mouseenter', function () { hovered = el; show(); });
      el.addEventListener('mouseleave', function () { if (hovered === el) hovered = null; show(); });
      el.addEventListener('click', function (e) { if (!e.target.closest('a')) pin(el); });
      el.addEventListener('keydown', function (e) {
        if (e.target === el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); pin(el); }
      });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pinned) pin(pinned); });
  }
})();
