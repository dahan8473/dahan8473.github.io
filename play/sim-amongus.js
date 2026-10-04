/* Among Us, IRL. Loaded by the projects overlay.
   mount(el) builds the room inside el and returns a cleanup function.

   Six conference badges in a room, no server. Every game event (a kill, a
   report, a vote) floods badge to badge: each badge relays a message once,
   after a little jitter, until its TTL runs out. Every badge also pings its
   ID every 200 ms, and the signal strength of those pings (dBm, log-distance
   path loss plus noise, smoothed 75/25) is the only sense of distance it has.
   Kill and report range is an RSSI threshold. Constants follow the firmware:
   github.com/dahan8473/htn-amongus (game.cpp, broadcast.cpp, espnow_prox.cpp). */

const KILL_RSSI = -66; // KILL_RSSI and REPORT_RSSI
const LINK_RSSI = -77; // drawn radio range; real ESP-NOW reaches much further
const RSSI_1M = -55, PL_N = 2.5; // espnow_prox.cpp calibration guess
const TTL = 6; // MESH_INITIAL_TTL
const KILL_CD = 10; // 20 s on the badges, halved for a toy
const ROOM_M = 8; // room height in metres
const TASKS = 12, TAPS = 8;
const RED = '#bf616a', ACC = '#88c0d0';
const PEOPLE = [['You', ACC], ['Green', '#a3be8c'], ['Yellow', '#ebcb8b'], ['Purple', '#b48ead'], ['Orange', '#d08770'], ['Blue', '#5e81ac']];

const CSS = `
.sau { display: grid; gap: 10px; user-select: none; -webkit-user-select: none; }
.sau-room { position: relative; height: 300px; border-radius: 12px; background: var(--fill); box-shadow: inset 0 0 0 1px var(--rule); overflow: hidden; }
.sau-room canvas { display: block; width: 100%; height: 100%; }
.sau-ban { position: absolute; left: 50%; top: 10px; transform: translateX(-50%); max-width: calc(100% - 24px); padding: 4px 10px; border-radius: 12px; background: var(--bg); color: var(--t1); font-size: 12px; line-height: 1.4; text-align: center; box-shadow: 0 0 0 1px var(--rule); pointer-events: none; }
.sau-hud { display: flex; flex-wrap: wrap; gap: 8px; }
.sau-scr { flex: 1 1 230px; min-width: 0; padding: 8px 10px; border-radius: 12px; background: var(--fill); color: var(--t2); font-size: 12px; line-height: 1.55; font-variant-numeric: tabular-nums; }
.sau-scr b { color: var(--t1); font-weight: 500; }
.sau-scr .r { color: ${RED}; }
.sau-bar { height: 4px; margin-top: 5px; border-radius: 2px; background: var(--rule); overflow: hidden; }
.sau-bar i { display: block; height: 100%; background: ${ACC}; transition: width 300ms ease; }
.sau-btns, .sau-votes { display: flex; flex-wrap: wrap; gap: 6px; align-content: flex-start; }
.sau button { font: inherit; font-size: 13px; padding: 6px 12px; border: 0; border-radius: 12px; background: var(--fill); color: var(--t1); box-shadow: inset 0 0 0 1px var(--rule); cursor: pointer; touch-action: manipulation; }
.sau button:disabled { color: var(--t3); cursor: default; }
.sau button.kill:not(:disabled) { background: ${RED}; color: #fff; box-shadow: none; }
.sau button.go:not(:disabled) { background: ${ACC}; color: #0d0d0e; box-shadow: none; }
.sau-votes button i { display: inline-block; width: 8px; height: 8px; margin-right: 6px; border-radius: 50%; }
.sau-cap { margin: 0; color: var(--t3); font-size: 13px; line-height: 1.45; }
@media (max-width: 420px) { .sau-room { height: 270px; } }
`;

export function mount(el) {
  if (!document.getElementById('sim-amongus-css')) {
    const s = document.createElement('style');
    s.id = 'sim-amongus-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.createElement('div');
  root.className = 'sau';
  root.innerHTML = `<div class="sau-room"><canvas></canvas><div class="sau-ban" hidden></div></div>
<div class="sau-hud"><div class="sau-scr"></div><div class="sau-btns">
<button class="kill" data-a="kill" disabled>Kill</button><button class="go" data-a="report" disabled>Report</button>
<button class="go" data-a="task" disabled>Task</button><button data-a="role" aria-pressed="false">Play as impostor</button></div></div>
<div class="sau-votes" hidden></div>
<p class="sau-cap">Drag your badge. Lines are radio links: kills, reports and votes hop badge to badge with no server, and signal strength (dBm) is the only way a badge knows who is close.</p>`;
  el.appendChild(root);
  const $ = q => root.querySelector(q);
  const room = $('.sau-room'), cv = $('canvas'), ctx = cv.getContext('2d'), ban = $('.sau-ban'), scr = $('.sau-scr'), votes = $('.sau-votes');
  const btn = { kill: $('[data-a=kill]'), report: $('[data-a=report]'), task: $('[data-a=task]'), role: $('[data-a=role]') };

  const B = PEOPLE.map(([name, col], i) => ({ i, name, col, x: 0, y: 0, tx: 0, ty: 0, alive: true, imp: false, ema: {} }));
  const you = B[0];
  const spots = [[0.13, 0.26], [0.87, 0.3], [0.62, 0.84]].map(([fx, fy]) => ({ fx, fy, x: 0, y: 0, done: false }));
  let W = 0, H = 0, ppm = 1, dpr = 1, t = 0, started = false;
  let phase = 'play', phaseT = 0, youImp = false, imp = null, cd = 0, tasks = 0, packets = [];
  let body = null, killT = 0, finder = null, mini = null, flash = '', flashT = 0, banner = '', rx = '', lastVote = 0, pingT = 0;
  let drag = false, dragged = false, scrHtml = '';

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.random() * a.length | 0];
  const rssiAt = d => RSSI_1M - 10 * PL_N * Math.log10(Math.max(d / ppm, 0.1));
  const sample = (a, b) => Math.round(Math.min(-30, rssiAt(dist(a, b)) + rand(-2.5, 2.5)));
  const rangePx = r => ppm * Math.pow(10, (RSSI_1M - r) / (10 * PL_N));
  const metres = r => Math.pow(10, (RSSI_1M - r) / (10 * PL_N));
  const near = (a, b) => rssiAt(dist(a, b)) >= KILL_RSSI;
  const label = b => b === you ? 'You' : b.name;
  const clampB = b => { b.x = Math.max(16, Math.min(W - 16, b.x)); b.y = Math.max(22, Math.min(H - 30, b.y)); };

  function newRound() {
    const id = () => Math.random().toString(16).slice(2, 6).toUpperCase().padEnd(4, '0');
    B.forEach((b, k) => {
      Object.assign(b, { id: id(), alive: true, imp: false, vote: null, ema: {}, busy: 0, tcd: rand(2, 6), seeT: 0 });
      for (let n = 0; n < 30; n++) {
        b.x = k ? rand(0.1, 0.9) * W : W * 0.32; b.y = k ? rand(0.18, 0.82) * H : H * 0.55;
        if (B.slice(0, k).every(o => dist(o, b) > 56)) break;
      }
      b.tx = b.x; b.ty = b.y;
    });
    imp = youImp ? you : pick(B.slice(1)); imp.imp = true;
    cd = youImp ? 2 : 7; tasks = 0; packets = []; body = finder = mini = null;
    spots.forEach(s => s.done = false);
    phase = 'play'; phaseT = 0; banner = youImp ? 'You are the impostor. Get within kill range.' : 'You are crew. Do tasks, report bodies.';
    rx = ''; showVotes(false);
  }

  // Mesh: relay once per badge (dedup set), with jitter, until TTL runs out.
  function relay(b, ttl, hops, got, msg) {
    for (const n of B) if (!got.has(n) && sample(b, n) > LINK_RSSI) {
      got.add(n);
      packets.push({ a: b, b: n, t0: t + rand(0.05, 0.15), dur: 0.4, ttl, hops, got, msg, done: false });
    }
  }
  function flood(src, msg) { relay(src, TTL, 1, new Set([src]), msg); if (src === you) rx = 'tx ' + msg; }

  function setPhase(p, text) { phase = p; phaseT = 0; banner = text; }
  function end(text, side) { setPhase('over', text); flood(imp, 'WIN:' + side); showVotes(false); }
  function winCheck() {
    const imps = B.filter(b => b.alive && b.imp).length, crew = B.filter(b => b.alive && !b.imp).length;
    if (!imps) return end(`Crew wins. ${imp === you ? 'You were' : imp.name + ' was'} the impostor.`, 'C'), true;
    if (imps >= crew) return end(`Impostor wins. It was ${label(imp)}.`, 'I'), true;
    return false;
  }

  function kill(k, v) {
    v.alive = false; body = v; killT = t; finder = null; cd = KILL_CD;
    B.forEach(b => b.seeT = 0);
    flood(k, 'DEAD:' + v.id);
    if (!winCheck() && k === you) banner = `${v.name} is down. Someone will find the body.`;
  }
  function report(r) {
    flood(r, 'RPT:' + r.id);
    const who = body.name; body = finder = null;
    B.forEach(b => { b.vote = null; b.vt = rand(1.2, 4.5); });
    setPhase('meet', `${label(r)} found ${who}. Vote on your badge.`);
    showVotes(you.alive);
  }
  function castVote(b, v) {
    if (phase !== 'meet' || b.vote) return;
    b.vote = v; lastVote = t;
    flood(b, 'V:' + b.id + ':' + (v === 'skip' ? 'SKIP' : v.id));
    if (b === you) votes.querySelectorAll('button').forEach(x => x.disabled = true);
  }
  function botVote(b) {
    const others = B.filter(o => o.alive && o !== b), r = Math.random();
    const n = new Map(); B.forEach(o => o.vote && o.vote !== 'skip' && o.vote !== b && n.set(o.vote, (n.get(o.vote) || 0) + 1));
    const lead = [...n].sort((x, y) => y[1] - x[1])[0]?.[0]; // later voters tend to pile on
    if (b.imp) return r < 0.15 ? 'skip' : lead && !lead.imp && r < 0.6 ? lead : pick(others.filter(o => !o.imp));
    if (r < 0.35 && imp.alive && imp !== b) return imp;
    if (r < 0.65 && lead) return lead;
    return r < 0.8 ? 'skip' : pick(others);
  }
  // Host tally: an ejection needs more than half of the votes cast (skips count).
  function tally() {
    const cast = B.filter(b => b.alive && b.vote), n = new Map();
    for (const b of cast) if (b.vote !== 'skip') n.set(b.vote, (n.get(b.vote) || 0) + 1);
    let top = null, best = 0;
    for (const [k, c] of n) if (c > best) { best = c; top = k; }
    const out = top && best * 2 > cast.length ? top : null;
    if (out) out.alive = false;
    flood(imp, 'EJ:' + (out ? out.id + ':' + (out.imp ? 'I' : 'C') : 'NONE'));
    const msg = out ? `${out === you ? 'You were' : out.name + ' was'} ejected (${best}/${cast.length}). ${out.imp ? 'Impostor.' : 'Not the impostor.'}` : `No majority (${best}/${cast.length}). No one ejected.`;
    setPhase('result', msg); showVotes(false);
  }

  function showVotes(on) {
    votes.hidden = !on;
    if (!on) return void (votes.innerHTML = '');
    votes.innerHTML = B.filter(b => b.alive && b !== you).map(b => `<button data-v="${b.i}"><i style="background:${b.col}"></i>${b.name}</button>`).join('') + '<button data-v="skip">Skip</button>';
  }

  const prey = k => B.filter(b => b.alive && !b.imp && b !== you).sort((a, b) => dist(a, k) - dist(b, k))[0];
  function retarget(b) {
    const s = !b.imp || Math.random() < 0.5 ? (Math.random() < 0.35 ? pick(spots) : null) : null;
    b.tx = s ? s.x : rand(0.08, 0.92) * W; b.ty = s ? s.y : rand(0.15, 0.85) * H;
  }
  function bot(b, dt) {
    if (!b.alive) return;
    if (b.busy > 0) {
      if ((b.busy -= dt) <= 0 && !b.imp) { tasks++; flood(b, 'TDONE:' + b.id); if (tasks >= TASKS) end('Crew wins on tasks.', 'C'); }
      return;
    }
    b.tcd -= dt;
    let tx = b.tx, ty = b.ty, sp = 18;
    const v = b.imp && cd < 3 ? prey(b) : null;
    if (b === finder && body) { tx = body.x + 14; ty = body.y; sp = 34; }
    else if (v) { tx = v.x; ty = v.y; sp = 26; }
    const dx = tx - b.x, dy = ty - b.y, d = Math.hypot(dx, dy);
    if (reduce && (b === finder || (v && cd <= 0))) { b.x = tx - 20; b.y = ty; clampB(b); } // jump, no glide
    else if (d < 4 && b !== finder && !v) {
      if (b.tcd <= 0 && spots.some(s => dist(s, b) < 6)) { b.busy = 2; b.tcd = rand(7, 12); }
      retarget(b);
    } else if (!reduce && d > 4) { const s = Math.min(sp * dt, d); b.x += dx / d * s; b.y += dy / d * s; }
    if (b.imp && cd <= 0) { const p = prey(b); if (p && near(b, p)) kill(b, p); }
  }

  function update(dt) {
    t += dt; phaseT += dt;
    if (flashT > 0 && (flashT -= dt) <= 0) flash = '';
    // pings: your badge smooths RSSI 75/25 like the firmware
    if ((pingT -= dt) <= 0) {
      pingT = 0.2;
      for (const b of B) if (b !== you) { const s = sample(you, b), e = you.ema[b.i]; you.ema[b.i] = e == null ? s : Math.round((e * 3 + s) / 4); }
    }
    for (const p of packets) if (!p.done && t >= p.t0 + p.dur) {
      p.done = true;
      if (p.b === you) rx = `rx ${p.msg} (${p.hops} hop${p.hops > 1 ? 's' : ''})`;
      if (p.ttl > 1) relay(p.b, p.ttl - 1, p.hops + 1, p.got, p.msg);
    }
    packets = packets.filter(p => t < p.t0 + p.dur + 0.2);
    if (mini && (mini.t -= dt) <= 0) { mini = null; flash = 'Too slow'; flashT = 1.2; }
    if (phase === 'play') {
      if (phaseT > 4 && banner && !body) banner = '';
      cd = Math.max(0, cd - dt);
      for (const b of B) if (b !== you) bot(b, dt);
      for (const a of B) for (const b of B) { // living bots keep a little personal space
        const d = dist(a, b);
        if (a === b || !b.alive || b === you || d > 40) continue;
        const k = (40 - d) / (d || 1) * 0.5; b.x += (b.x - a.x) * k; b.y += (b.y - a.y) * k + (d ? 0 : 1); clampB(b);
      }
      if (phase === 'play' && body) {
        if (!finder && t - killT > 3) finder = pick(B.filter(b => b.alive && b !== you && !b.imp)) || null;
        for (const b of B) if (b !== you && b.alive && !b.imp && near(b, body)) {
          if (!b.seeT) b.seeT = t; else if (t - b.seeT > 0.8) { report(b); break; }
        }
      }
    } else if (phase === 'meet') {
      for (const b of B) if (b !== you && b.alive && !b.vote && phaseT > b.vt) castVote(b, botVote(b));
      if (phaseT > 10) castVote(you, 'skip');
      if (B.every(b => !b.alive || b.vote) && t - lastVote > 0.9) tally();
    } else if (phase === 'result' && phaseT > 3.5) {
      if (!winCheck()) { setPhase('play', ''); cd = KILL_CD; }
    } else if (phase === 'over' && phaseT > 4) newRound();
  }

  const youTarget = () => B.filter(b => b !== you && b.alive && !b.imp && you.ema[b.i] >= KILL_RSSI).sort((a, b) => you.ema[b.i] - you.ema[a.i])[0];
  const youSpot = () => spots.find(s => !s.done && dist(s, you) < 34);
  const bodyNear = () => body && you.ema[body.i] >= KILL_RSSI;

  function hud() {
    const play = phase === 'play';
    btn.kill.disabled = !(play && youImp && cd <= 0 && youTarget());
    btn.kill.textContent = youImp && cd > 0 ? `Kill ${Math.ceil(cd)}s` : 'Kill';
    btn.report.disabled = !(play && you.alive && bodyNear());
    btn.task.disabled = !(play && !youImp && (mini || youSpot()));
    btn.task.textContent = mini ? `Tap fast ${mini.taps}/${TAPS}` : flash || 'Task';
    btn.task.style.background = mini ? `linear-gradient(90deg, ${ACC} ${mini.taps / TAPS * 100}%, var(--fill) 0)` : '';
    let nb = null;
    for (const b of B) if (b !== you && you.ema[b.i] != null && (!nb || you.ema[b.i] > you.ema[nb.i])) nb = b;
    const r = nb ? you.ema[nb.i] : -127, inR = r >= KILL_RSSI;
    const html = `<b>You ${you.id || ''}</b> · ${youImp ? '<span class="r">impostor</span>' : 'crewmate'}${you.alive ? '' : ' · ghost'}<br>`
      + (nb ? `nearest <b>${nb.name}</b>${nb.alive ? '' : ' (dead)'} ${r} dBm, about ${metres(r).toFixed(1)} m${inR ? (youImp ? ' · <span class="r">in kill range</span>' : ' · in range') : ''}<br>` : 'listening...<br>')
      + `${youImp ? 'kill' : 'report'} range ${KILL_RSSI} dBm or stronger${youImp ? (cd > 0 ? ` · cooldown ${Math.ceil(cd)}s` : ' · ready') : ''}<br>`
      + `${rx || 'mesh idle'}<div class="sau-bar" title="tasks"><i style="width:${tasks / TASKS * 100}%"></i></div>`;
    if (html !== scrHtml) scr.innerHTML = scrHtml = html;
    if (ban.textContent !== banner) ban.textContent = banner;
    ban.hidden = !banner;
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function draw() {
    const c = ctx, cs = getComputedStyle(root), v = k => cs.getPropertyValue(k).trim();
    const t1 = v('--t1'), t2 = v('--t2'), t3 = v('--t3'), bg = v('--bg') || '#fff', font = cs.fontFamily;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const s of spots) {
      c.setLineDash([3, 3]); c.lineWidth = 1; c.strokeStyle = s.done ? ACC : t3;
      rr(s.x - 12, s.y - 12, 24, 24, 5); c.stroke(); c.setLineDash([]);
      c.fillStyle = s.done ? ACC : t3; c.font = `600 7px ${font}`; c.fillText(s.done ? 'DONE' : 'NFC', s.x, s.y);
    }
    // your kill / report range: the RSSI threshold drawn as a distance
    c.beginPath(); c.arc(you.x, you.y, rangePx(KILL_RSSI), 0, 7);
    c.fillStyle = youImp ? 'rgba(191,97,106,0.07)' : 'rgba(136,192,208,0.08)'; c.fill();
    c.setLineDash([4, 4]); c.strokeStyle = youImp ? 'rgba(191,97,106,0.45)' : 'rgba(136,192,208,0.55)'; c.stroke(); c.setLineDash([]);
    c.strokeStyle = t3; c.globalAlpha = 0.3;
    for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) if (rssiAt(dist(B[i], B[j])) > LINK_RSSI) {
      c.beginPath(); c.moveTo(B[i].x, B[i].y); c.lineTo(B[j].x, B[j].y); c.stroke();
    }
    c.globalAlpha = 1;
    for (const p of packets) {
      const k = (t - p.t0) / p.dur;
      if (k < 0 || k > 1) continue;
      const pc = /^(DEAD|WIN:I)/.test(p.msg) ? RED : ACC;
      if (reduce) { c.strokeStyle = pc; c.lineWidth = 2; c.beginPath(); c.moveTo(p.a.x, p.a.y); c.lineTo(p.b.x, p.b.y); c.stroke(); c.lineWidth = 1; continue; }
      c.fillStyle = pc; c.beginPath(); c.arc(p.a.x + (p.b.x - p.a.x) * k, p.a.y + (p.b.y - p.a.y) * k, 3, 0, 7); c.fill();
    }
    for (const b of [...B.slice(1), you]) {
      const shake = b === you && mini && !reduce ? Math.sin(t * 70) * 1.6 : 0;
      const x = b.x - 13 + shake, y = b.y - 17, showImp = b.imp && (youImp || phase === 'over' || (!b.alive && phase !== 'play'));
      c.globalAlpha = b.alive ? 1 : 0.38;
      rr(x, y, 26, 34, 5); c.fillStyle = bg; c.fill();
      c.lineWidth = b === you ? 2 : showImp ? 1.5 : 1; c.strokeStyle = showImp ? RED : b === you ? ACC : t3; c.stroke();
      c.fillStyle = b.alive ? b.col : t3; rr(x + 3, y + 3, 20, 4, 2); c.fill();
      rr(x + 3, y + 10, 20, 13, 2); c.fillStyle = '#1d2127'; c.fill();
      let txt = '';
      if (!b.alive) txt = 'x';
      else if (phase === 'meet') txt = b.vote ? 'OK' : 'VOTE';
      else if (phase === 'result') txt = 'EJ';
      else if (phase === 'over') txt = 'GG';
      else if (b === you) txt = mini ? 'TAP' : (() => { const r = Math.max(...Object.values(you.ema), -127); return r > -127 ? String(r) : '...'; })();
      else if (b.busy > 0) txt = 'TASK';
      c.fillStyle = b === you && youImp && phase === 'play' && youTarget() && cd <= 0 ? '#ff8f99' : '#e5e9f0';
      c.font = `600 7px ${font}`; c.fillText(txt, x + 13, y + 16.5);
      c.fillStyle = b === you ? t1 : t2; c.font = `${b === you ? 600 : 400} 10px ${font}`;
      c.fillText(b === you ? (dragged ? 'you' : 'drag me') : b.name, b.x, b.y + 27);
      c.globalAlpha = 1;
    }
  }

  // input: drag your own badge; touch on it never scrolls the page
  const pt = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onYou = p => dist(p, you) < 30;
  const down = e => { if (!onYou(pt(e))) return; drag = dragged = true; try { cv.setPointerCapture(e.pointerId); } catch {} e.preventDefault(); };
  const move = e => {
    const p = pt(e);
    if (drag) { you.x = p.x; you.y = p.y; clampB(you); } else cv.style.cursor = onYou(p) ? 'grab' : '';
  };
  const up = () => { drag = false; };
  const tstart = e => { const r = cv.getBoundingClientRect(), tc = e.touches[0]; if (onYou({ x: tc.clientX - r.left, y: tc.clientY - r.top })) e.preventDefault(); };
  const tmove = e => { if (drag) e.preventDefault(); };
  cv.addEventListener('pointerdown', down);
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', up);
  cv.addEventListener('touchstart', tstart, { passive: false });
  cv.addEventListener('touchmove', tmove, { passive: false });

  root.addEventListener('click', e => {
    const a = e.target.closest('[data-a]')?.dataset.a, vb = e.target.closest('[data-v]');
    if (vb) return castVote(you, vb.dataset.v === 'skip' ? 'skip' : B[+vb.dataset.v]);
    if (a === 'kill') { const v = youTarget(); if (v && cd <= 0) kill(you, v); }
    else if (a === 'report' && bodyNear()) report(you);
    else if (a === 'task') {
      if (!mini) { const s = youSpot(); if (s) mini = { t: 2, taps: 0, s }; return; }
      if (++mini.taps >= TAPS) {
        mini.s.done = true; mini = null; tasks++; flash = 'Done'; flashT = 1;
        flood(you, 'TDONE:' + you.id);
        if (tasks >= TASKS) end('Crew wins on tasks.', 'C');
      }
    } else if (a === 'role') {
      youImp = !youImp;
      btn.role.setAttribute('aria-pressed', youImp);
      btn.role.textContent = youImp ? 'Play as crewmate' : 'Play as impostor';
      newRound();
    }
  });

  function size() {
    const r = room.getBoundingClientRect();
    if (!r.width) return;
    const sx = W ? r.width / W : 1, sy = H ? r.height / H : 1;
    W = r.width; H = r.height; dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ppm = H / ROOM_M;
    spots.forEach(s => { s.x = s.fx * W; s.y = s.fy * H; });
    if (!started) { started = true; newRound(); }
    else B.forEach(b => { b.x *= sx; b.y *= sy; b.tx *= sx; b.ty *= sy; clampB(b); });
    draw();
  }

  let raf = 0, last = 0;
  const frame = now => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
    last = now;
    if (!started) return;
    update(dt); draw(); hud();
  };
  const ro = new ResizeObserver(size);
  ro.observe(room);
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    else if (!e.isIntersecting && raf) { cancelAnimationFrame(raf); raf = 0; }
  });
  io.observe(room);
  size();

  return () => {
    cancelAnimationFrame(raf); raf = 0;
    ro.disconnect(); io.disconnect();
    root.remove();
    document.getElementById('sim-amongus-css')?.remove();
  };
}
