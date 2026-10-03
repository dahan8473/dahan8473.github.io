// A nylon-string classical guitar, synthesized. One ES module, no libraries.
//
//   import { createGuitar } from '/play/guitar-audio.js';
//   const g = createGuitar();
//   button.onclick = () => { g.ready(); g.strum('Am'); };
//
// Each string is an extended Karplus-Strong waveguide with two polarizations:
// an integer delay line, a Thiran allpass tuned so the loop's total phase delay
// at the fundamental is exact, a one-pole loss filter designed from two decay
// times (fundamental and ~2.5 kHz), and two dispersion allpasses for a little
// stiffness. The pluck is the bridge force of a string released at a point
// (a zero-mean pulse whose width is the pluck position), softened by the
// fingertip. Strings feed each other through the bridge (sympathetic ringing),
// then a synthesized body impulse response and a small room.
// Runs in an AudioWorklet built from a Blob; falls back to pre-rendered
// buffers when worklets are unavailable. Respects the site's mute (the head's
// speaker toggle writes dl-sound), like play/chess.js: muted plucks are dropped.

const TUNING = [40, 45, 50, 55, 59, 64]; // E2 A2 D3 G3 B3 E4 as MIDI notes
const T60_OPEN = [6.5, 5.6, 4.8, 4.0, 3.6, 3.2]; // fundamental decay of each open string, seconds
const HI_KEEP = [1.3, 1.2, 1.1, 0.75, 0.85, 0.95]; // wound basses keep their highs, plain nylon G the least
const LEVEL = [1, 1, 1, 1, 1.3, 1.35]; // trebles lifted to sit with the basses
const SYMPATHY = 0.015; // bridge coupling into the other strings
const TRIM = 0.13; // output level before the master volume: single notes sit near -23 dBFS RMS, strums peak under the limiter

// Fret numbers from the low E (index 0) to the high E. null = not played (muted).
const CHORDS = {
  C: [null, 3, 2, 0, 1, 0],
  G: [3, 2, 0, 0, 0, 3],
  D: [null, null, 0, 2, 3, 2],
  A: [null, 0, 2, 2, 2, 0],
  E: [0, 2, 2, 1, 0, 0],
  F: [1, 3, 3, 2, 1, 1],
  Am: [null, 0, 2, 2, 1, 0],
  Em: [0, 2, 2, 0, 0, 0],
  Dm: [null, null, 0, 2, 3, 1],
  Bm: [null, 2, 4, 4, 3, 2],
  E7: [0, 2, 0, 1, 0, 0],
  A7: [null, 0, 2, 0, 2, 0],
  D7: [null, null, 0, 2, 1, 2],
  G7: [3, 2, 0, 0, 0, 1],
  C7: [null, 3, 2, 3, 1, 0],
  B7: [null, 2, 1, 2, 0, 2],
  Am7: [null, 0, 2, 0, 1, 0],
  Em7: [0, 2, 0, 0, 0, 0],
  Dm7: [null, null, 0, 2, 1, 1],
  Cmaj7: [null, 3, 2, 0, 0, 0],
  Fmaj7: [null, null, 3, 2, 1, 0],
  Gmaj7: [3, 2, 0, 0, 0, 2],
  Dmaj7: [null, null, 0, 2, 2, 2],
  Asus2: [null, 0, 2, 2, 0, 0],
  Asus4: [null, 0, 2, 2, 3, 0],
  Dsus2: [null, null, 0, 2, 3, 0],
  Dsus4: [null, null, 0, 2, 3, 3],
  Esus4: [0, 2, 2, 2, 0, 0]
};

// ---- DSP core. These two classes are also serialized into the worklet, so they
// must stay self-contained (no references to anything else in this module).

// One polarization of one string: delay line -> Thiran fractional delay ->
// one-pole loss filter -> two dispersion allpasses -> back into the delay line.
class NylonLoop {
  constructor(size) {
    this.buf = new Float32Array(size);
    this.n = 2;
    this.i = 0;
    this.eta = 0; this.fx = 0; this.fy = 0; // Thiran allpass
    this.ap = 0; this.d1x = 0; this.d1y = 0; this.d2x = 0; this.d2y = 0; // dispersion
    this.g = 0; this.p = 0; this.gT = 0; this.pT = 0; this.lp = 0; // loss filter, smoothed toward targets
    this.k = 0.002;
  }

  // Phase delay in samples of the allpass (a + z^-1) / (1 + a z^-1) at w radians/sample.
  static apDelay(a, w) {
    return (Math.atan2(Math.sin(w), a + Math.cos(w)) - Math.atan2(a * Math.sin(w), 1 + a * Math.cos(w))) / w;
  }

  // Gain g and pole p of g(1-p)/(1-p z^-1) so that, once per trip around the loop,
  // the fundamental loses 60 dB in `lo` seconds and partials near fh lose it in `hi`.
  static loss(fs, f0, lo, hi, fh) {
    const w0 = 2 * Math.PI * f0 / fs;
    const wh = 2 * Math.PI * Math.min(Math.max(fh, 2 * f0), 0.45 * fs) / fs;
    const g0 = Math.pow(10, -3 / (lo * f0));
    const gh = Math.pow(10, -3 / (Math.min(hi, lo) * f0));
    const mag = (p, w) => (1 - p) / Math.sqrt(1 - 2 * p * Math.cos(w) + p * p);
    const want = gh / g0;
    let a = 0, b = 0.995;
    if (want < 1) {
      for (let k = 0; k < 40; k++) {
        const m = (a + b) / 2;
        if (mag(m, wh) / mag(m, w0) > want) a = m; else b = m;
      }
    } else b = 0;
    const p = (a + b) / 2;
    return [g0 / mag(p, w0), p];
  }

  // Tune to f0 and clear. disp is the dispersion allpass coefficient (<= 0).
  tune(fs, f0, lo, hi, fh, disp) {
    const [g, p] = NylonLoop.loss(fs, f0, lo, hi, fh);
    const w0 = 2 * Math.PI * f0 / fs;
    const rest = fs / f0 - Math.atan2(p * Math.sin(w0), 1 - p * Math.cos(w0)) / w0 - 2 * NylonLoop.apDelay(disp, w0);
    const n = Math.max(2, Math.min(this.buf.length, Math.floor(rest - 0.5)));
    const d = rest - n;
    let a = -0.999, b = 0.999; // Thiran coefficient with phase delay exactly d at w0
    for (let k = 0; k < 48; k++) {
      const m = (a + b) / 2;
      if (NylonLoop.apDelay(m, w0) > d) a = m; else b = m;
    }
    this.eta = (a + b) / 2;
    this.ap = disp;
    this.n = n;
    this.g = this.gT = g;
    this.p = this.pT = p;
    this.k = 1 - Math.exp(-1 / (0.015 * fs));
    this.clear();
  }

  // Change the decay without retuning (damping); approached smoothly.
  retarget(fs, f0, lo, hi, fh) {
    const [g, p] = NylonLoop.loss(fs, f0, lo, hi, fh);
    this.gT = g;
    this.pT = p;
  }

  clear() {
    this.buf.fill(0);
    this.i = 0;
    this.fx = this.fy = this.lp = this.d1x = this.d1y = this.d2x = this.d2y = 0;
  }

  tick(x) {
    const buf = this.buf;
    let i = this.i;
    const y = buf[i];
    const v = this.eta * (y - this.fy) + this.fx;
    this.fx = y; this.fy = v;
    this.g += (this.gT - this.g) * this.k;
    this.p += (this.pT - this.p) * this.k;
    const lp = this.g * (1 - this.p) * v + this.p * this.lp;
    this.lp = lp;
    const a = this.ap;
    const u1 = a * (lp - this.d1y) + this.d1x;
    this.d1x = lp; this.d1y = u1;
    const u2 = a * (u1 - this.d2y) + this.d2x;
    this.d2x = u1; this.d2y = u2;
    const out = u2 + x;
    buf[i] = out;
    this.i = ++i >= this.n ? 0 : i;
    return out;
  }
}

// One note on one string: two polarizations (0.7 cents apart around the pitch;
// the sharper one slower to decay and quieter, which gives the two-stage decay and a slow shimmer) plus
// the pluck excitation that is fed in over the first period.
class NylonVoice {
  constructor(fs) {
    this.fs = fs;
    const size = Math.ceil(fs / 30) + 8;
    this.a = new NylonLoop(size);
    this.b = new NylonLoop(size);
    this.exc = new Float32Array(size + Math.ceil(fs * 0.01));
    this.len = 0;
    this.pos = 0;
    this.mixB = 0.32;
    this.fade = 1;
    this.fadeK = 1;
    this.lastA = 0;
    this.note = null;
  }

  // Tune without plucking (an idle string that can still ring sympathetically).
  idle(nt) {
    const fs = this.fs;
    this.note = nt;
    this.a.tune(fs, nt.f0 * Math.pow(2, -nt.detune / 2400), nt.lo, nt.hi, nt.fh, nt.disp);
    this.b.tune(fs, nt.f0 * Math.pow(2, nt.detune / 2400), nt.lo * 1.5, nt.hi, nt.fh, nt.disp);
    this.len = this.pos = 0;
    this.fade = 1;
    this.fadeK = 1;
    this.lastA = 0;
  }

  // nt: { f0, lo, hi, fh, disp, detune, beta, cut, amp, noise, seed }
  start(nt) {
    this.idle(nt);
    const fs = this.fs, P = fs / nt.f0, e = this.exc;
    const L = Math.min(Math.round(P), e.length);
    const total = Math.min(e.length, L + Math.ceil(fs * 0.006));
    e.fill(0);
    // Bridge force of a string released at beta: a pulse beta*P wide, zero mean.
    const W = Math.min(L - 1, Math.max(1, nt.beta * P));
    const Wi = Math.floor(W);
    let mean = 0;
    for (let i = 0; i < L; i++) {
      const v = i < Wi ? 1 : i === Wi ? W - Wi : 0;
      e[i] = v;
      mean += v;
    }
    mean /= L;
    for (let i = 0; i < L; i++) e[i] -= mean;
    // Fingertip: two one-pole lowpasses; harder plucks are brighter.
    const c = Math.exp(-2 * Math.PI * nt.cut / fs);
    const scale = nt.amp * Math.pow(nt.beta * (1 - nt.beta), -0.25);
    let s1 = 0, s2 = 0;
    for (let i = 0; i < total; i++) {
      s1 = (1 - c) * e[i] + c * s1;
      s2 = (1 - c) * s1 + c * s2;
      e[i] = s2 * scale;
    }
    // A little flesh-and-nail noise right at the release.
    let seed = nt.seed >>> 0 || 1, prev = 0;
    const nk = Math.exp(-1 / (0.0015 * fs));
    let env = nt.noise * nt.amp;
    for (let i = 0; i < total; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const r = seed / 4294967296 * 2 - 1;
      e[i] += (r - prev) * 0.5 * env;
      prev = r;
      env *= nk;
    }
    this.len = total;
    this.pos = 0;
  }

  // Lower the loop gain (a finger resting on the string), or restore it.
  damp(on) {
    const nt = this.note;
    if (!nt) return;
    const fs = this.fs;
    const lo = on ? 0.09 : nt.lo, hi = on ? 0.03 : nt.hi;
    this.a.retarget(fs, nt.f0 * Math.pow(2, -nt.detune / 2400), lo, hi, nt.fh);
    this.b.retarget(fs, nt.f0 * Math.pow(2, nt.detune / 2400), on ? lo : lo * 1.5, hi, nt.fh);
    if (on) this.pos = this.len;
  }

  // sym: what the bridge feeds this string from the others.
  tick(sym) {
    const x = this.pos < this.len ? this.exc[this.pos++] : 0;
    const ya = this.a.tick(x);
    const yb = this.b.tick(x + sym);
    this.lastA = ya;
    const out = (ya + this.mixB * yb) * this.fade;
    this.fade *= this.fadeK;
    return out;
  }
}

// ---- The worklet. This function is serialized and runs in the AudioWorkletGlobalScope,
// where NylonVoice, sampleRate, currentTime and currentFrame are globals.
function nylonProcessor() {
  class NylonGuitarProcessor extends AudioWorkletProcessor {
    constructor(options) {
      super();
      const o = options.processorOptions;
      this.open = o.open;
      this.sym = o.sym;
      this.strings = o.open.map((nt) => {
        const cur = new NylonVoice(sampleRate);
        cur.idle(nt);
        return { cur, old: new NylonVoice(sampleRate), oldLive: false, dampEnd: 0 };
      });
      this.events = [];
      this.awake = false;
      this.quiet = 0;
      this.peak = 0;
      this.symPrev = 0;
      this.stopped = false;
      this.fadeK = Math.exp(-1 / (0.008 * sampleRate));
      // Each API call arrives as one message: a list of timed events.
      this.port.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'stop') { this.stopped = true; return; }
        for (const ev of m) this.events.push(ev);
        this.events.sort((a, b) => a.t - b.t);
      };
    }

    apply(m) {
      if (m.type === 'pluck') {
        const st = this.strings[m.s];
        if (!st) return;
        // One voice per string: the ringing note fades in ~8 ms under the new one.
        const prev = st.cur;
        st.cur = st.old;
        st.old = prev;
        prev.fadeK = this.fadeK;
        st.oldLive = this.awake;
        st.cur.start(m.nt);
        st.dampEnd = 0;
        this.awake = true;
        this.quiet = 0;
      } else if (m.type === 'damp') {
        this.strings.forEach((st, s) => {
          if (m.s >= 0 && s !== m.s) return;
          st.cur.damp(true);
          st.dampEnd = currentFrame + Math.round(0.35 * sampleRate);
          if (st.oldLive) st.old.fadeK = this.fadeK;
        });
      }
    }

    render(out, from, to) {
      if (!this.awake) return;
      const st = this.strings, c = this.sym, ns = st.length;
      let symPrev = this.symPrev, peak = this.peak;
      for (let k = from; k < to; k++) {
        let sum = 0, symNow = 0;
        for (let s = 0; s < ns; s++) {
          const S = st[s], v = S.cur;
          sum += v.tick(c * (symPrev - v.lastA));
          symNow += v.lastA;
          if (S.oldLive) sum += S.old.tick(0);
        }
        symPrev = symNow;
        out[k] = sum;
        const m = sum < 0 ? -sum : sum;
        if (m > peak) peak = m;
      }
      this.symPrev = symPrev;
      this.peak = peak;
    }

    housekeep() {
      let busy = false;
      for (const S of this.strings) {
        if (S.oldLive && S.old.fade < 1e-4) S.oldLive = false;
        if (S.dampEnd && currentFrame >= S.dampEnd) { S.dampEnd = 0; S.cur.damp(false); }
        if (S.cur.pos < S.cur.len) busy = true;
      }
      if (this.peak < 2e-6 && !busy) {
        if (++this.quiet > 60) {
          // Silent for a while: reset every string to open and stop computing.
          this.awake = false;
          this.symPrev = 0;
          this.strings.forEach((S, s) => { S.oldLive = false; S.dampEnd = 0; S.cur.idle(this.open[s]); });
        }
      } else this.quiet = 0;
    }

    process(inputs, outputs) {
      if (this.stopped) return false;
      const out = outputs[0][0];
      const n = out.length;
      const t0 = currentTime, end = t0 + n / sampleRate;
      let i = 0;
      this.peak = 0;
      while (this.events.length && this.events[0].t < end) {
        const m = this.events.shift();
        const at = Math.min(n, Math.max(i, Math.round((m.t - t0) * sampleRate)));
        if (at > i) { this.render(out, i, at); i = at; }
        this.apply(m);
      }
      this.render(out, i, n);
      for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(out);
      if (this.awake) this.housekeep();
      return true;
    }
  }
  registerProcessor('nylon-guitar', NylonGuitarProcessor);
}

const workletLoads = new WeakMap();
function loadWorklet(ctx) {
  if (!workletLoads.has(ctx)) {
    const src = `${NylonLoop}\n${NylonVoice}\n(${nylonProcessor})();\n`;
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const p = ctx.audioWorklet.addModule(url);
    p.then(() => URL.revokeObjectURL(url), () => URL.revokeObjectURL(url));
    workletLoads.set(ctx, p);
  }
  return workletLoads.get(ctx);
}

// ---- Body and room, synthesized once per context.

function noise(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

// Bridge force to sound: the direct path plus the body's low modes (air ~100 Hz,
// top plate ~208 Hz, then 240, 388, 525 Hz and up) and a short burst of dense
// high modes. Mode gains are peak response relative to the direct path. The air
// mode is in antiphase with the top, so 100-210 Hz is lifted ~5 dB, the low E
// fundamental below it is not, and no dip anywhere is deeper than ~5 dB.
function bodyIR(ctx) {
  const fs = ctx.sampleRate, len = Math.round(fs * 0.4);
  const buf = ctx.createBuffer(1, len, fs);
  const h = buf.getChannelData(0);
  h[0] = 1;
  const modes = [ // Hz, gain, Q, sign
    [100, 3, 16, -1], [208, 3.2, 22, 1], [240, 1.6, 26, 1], [388, 2.2, 28, 1],
    [525, 1.4, 30, 1], [655, 1, 32, 1], [828, 0.9, 34, 1], [1040, 0.7, 36, 1],
    [1290, 0.6, 38, 1], [1650, 0.45, 40, 1], [2100, 0.35, 40, 1]
  ];
  for (const [f, gain, q, sign] of modes) {
    const tau = q / (Math.PI * f);
    const w = 2 * Math.PI * f / fs, d = Math.exp(-1 / (tau * fs));
    let env = sign * 2 * gain / (tau * fs);
    for (let i = 1; i < len && Math.abs(env) > 1e-9; i++) {
      env *= d;
      h[i] += env * Math.sin(w * i);
    }
  }
  const r = noise(7), tn = 0.007, kn = Math.exp(-1 / (tn * fs));
  const ch = Math.exp(-2 * Math.PI * 700 / fs), cl = Math.exp(-2 * Math.PI * 5000 / fs);
  let env = 0.9 * Math.sqrt(2 / (tn * fs)), hp = 0, x1 = 0, lp = 0;
  for (let i = 1; i < len && env > 1e-7; i++) {
    const x = r();
    hp = ch * (hp + x - x1);
    x1 = x;
    lp = (1 - cl) * hp + cl * lp;
    h[i] += lp * env;
    env *= kn;
  }
  return buf;
}

// A small wooden room: a few early reflections and a 1.2 s tail that darkens as it decays.
function roomIR(ctx) {
  const fs = ctx.sampleRate, len = Math.round(fs * 1.6);
  const buf = ctx.createBuffer(2, len, fs);
  const taps = [[0.011, 0.5], [0.0157, -0.4], [0.0213, 0.32], [0.0291, -0.26], [0.0367, 0.2], [0.0452, -0.16]];
  for (let c = 0; c < 2; c++) {
    const h = buf.getChannelData(c), r = noise(101 + 31 * c);
    taps.forEach(([t, g], k) => { h[Math.round(t * (1 + 0.09 * c) * fs)] += (k % 2 === c ? g : -g) * 0.6; });
    const start = Math.round(0.018 * fs), tau = 1.2 / 6.91;
    let lp = 0;
    for (let i = start; i < len; i++) {
      const t = i / fs;
      const a = Math.exp(-2 * Math.PI * (1400 + 6000 * Math.exp(-t / 0.3)) / fs);
      lp = (1 - a) * r() + a * lp;
      h[i] += lp * Math.exp(-t / tau) * Math.min(1, (i - start) / (0.03 * fs));
    }
    let e = 0;
    for (let i = 0; i < len; i++) e += h[i] * h[i];
    const s = 1 / Math.sqrt(e);
    for (let i = 0; i < len; i++) h[i] *= s;
  }
  return buf;
}

function graph(ctx, dest, volume, reverb) {
  const input = ctx.createGain();
  input.gain.value = TRIM;
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 45; hp.Q.value = 0.6;
  const body = ctx.createConvolver();
  body.normalize = false;
  body.buffer = bodyIR(ctx);
  // The top radiates highs more efficiently than lows: a gentle lift, then a soft top end.
  const lift = ctx.createBiquadFilter();
  lift.type = 'highshelf'; lift.frequency.value = 1200; lift.gain.value = 4;
  const air = ctx.createBiquadFilter();
  air.type = 'lowpass'; air.frequency.value = 7000; air.Q.value = 0.4;
  const send = ctx.createGain();
  send.gain.value = reverb;
  const room = ctx.createConvolver();
  room.normalize = false;
  room.buffer = roomIR(ctx);
  const master = ctx.createGain();
  master.gain.value = volume;
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -6; limit.knee.value = 5; limit.ratio.value = 12;
  limit.attack.value = 0.0005; limit.release.value = 0.2;
  // Last resort against overs: linear to 0.85, then a tanh shoulder up to 1.
  const clip = ctx.createWaveShaper();
  const curve = new Float32Array(2049);
  for (let i = 0; i < curve.length; i++) {
    const x = i / 1024 - 1, a = Math.abs(x);
    curve[i] = a < 0.85 ? x : Math.sign(x) * (0.85 + 0.15 * Math.tanh((a - 0.85) / 0.15));
  }
  clip.curve = curve;
  input.connect(hp).connect(body).connect(lift).connect(air);
  air.connect(master);
  air.connect(send).connect(room).connect(master);
  master.connect(limit).connect(clip).connect(dest);
  return { input, master, all: [input, hp, body, lift, air, send, room, master, limit, clip] };
}

// ---- Notes and engines

const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const num = (x, d) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

// Everything a voice needs for one pluck. where: 0 bridge .. 1 neck.
function noteFor(s, fret, velocity, where) {
  const f0 = 440 * Math.pow(2, (TUNING[s] + fret - 69) / 12);
  const fOpen = 440 * Math.pow(2, (TUNING[s] - 69) / 12);
  const vel = clamp(velocity, 0, 1), pos = clamp(where, 0, 1);
  const bright = (0.75 + 0.5 * vel) * (1.25 - 0.5 * pos);
  const lo = T60_OPEN[s] * Math.sqrt(fOpen / f0) * (fret > 0 ? 0.85 : 1);
  const hi = Math.min(lo * 0.5, 0.75 * HI_KEEP[s] * bright * (fret > 0 ? 0.9 : 1));
  // Pluck point as a fraction of the vibrating length: ~1/20 at the bridge,
  // ~1/5 over the soundhole, ~1/3 at the end of the fingerboard; frets shorten the string.
  const beta = Math.min(0.5, (0.035 + 0.3 * pos) * (1 + 0.08 * (Math.random() - 0.5)) * Math.pow(2, fret / 12));
  const cut = (900 + 4500 * Math.pow(vel, 1.4)) * (1.25 - 0.5 * pos) * (1 + 0.12 * (Math.random() - 0.5));
  return {
    f0, lo, hi, fh: 2500,
    disp: -0.55 * clamp(Math.pow(150 / f0, 0.8), 0.15, 1),
    detune: 0.7,
    beta, cut,
    amp: LEVEL[s] * (0.04 + 0.96 * Math.pow(vel, 1.6)),
    noise: 0.05,
    seed: Math.floor(Math.random() * 4294967296)
  };
}

// Engines take a list of { type: 'pluck' | 'damp', s, nt, t } per API call.
function workletEngine(node) {
  return {
    send: (events) => node.port.postMessage(events),
    dispose() {
      node.port.postMessage({ type: 'stop' });
      node.disconnect();
    }
  };
}

// Fallback: render each pluck to a buffer on the main thread (no sympathetic ringing).
function renderNote(fs, nt) {
  const v = new NylonVoice(fs);
  v.start(nt);
  const max = Math.ceil(fs * Math.min(10, nt.lo * 1.6));
  const out = new Float32Array(max);
  let peak = 0, end = max;
  for (let i = 0; i < max; i += 1024) {
    const stop = Math.min(max, i + 1024);
    let bp = 0;
    for (let k = i; k < stop; k++) {
      const y = v.tick(0);
      out[k] = y;
      const m = y < 0 ? -y : y;
      if (m > bp) bp = m;
    }
    if (bp > peak) peak = bp;
    if (i > fs * 0.2 && bp < peak * 3e-4) { end = stop; break; }
  }
  const fade = Math.min(end, Math.round(fs * 0.05));
  for (let k = 0; k < fade; k++) out[end - 1 - k] *= k / fade;
  return out.subarray(0, end);
}

function bufferEngine(ctx, input) {
  const live = [null, null, null, null, null, null];
  const stop = (v, t, tc) => {
    if (!v) return;
    const at = Math.max(t, ctx.currentTime);
    v.gain.gain.setTargetAtTime(0, at, tc);
    try { v.src.stop(at + tc * 10); } catch (e) {}
  };
  function pluck(s, nt, t) {
    stop(live[s], t, 0.008);
    const data = renderNote(ctx.sampleRate, nt);
    const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
    buf.getChannelData(0).set(data);
    const src = ctx.createBufferSource(), gain = ctx.createGain();
    src.buffer = buf;
    src.connect(gain).connect(input);
    src.start(Math.max(t, ctx.currentTime));
    const v = { src, gain };
    live[s] = v;
    src.onended = () => {
      gain.disconnect();
      if (live[s] === v) live[s] = null;
    };
  }
  function damp(s, t) {
    for (let i = 0; i < 6; i++) {
      if (s >= 0 && s !== i) continue;
      stop(live[i], t, 0.03);
      live[i] = null;
    }
  }
  return {
    send(events) {
      for (const ev of events) if (ev.type === 'pluck') pluck(ev.s, ev.nt, ev.t); else damp(ev.s, ev.t);
    },
    dispose() {
      for (let i = 0; i < 6; i++) stop(live[i], ctx.currentTime, 0.005);
    }
  };
}

// ---- Public API

// options: { context, destination, volume = 0.8, reverb = 0.2, worklet (default: true unless offline) }
// context: an existing (Offline)AudioContext to use instead of creating one.
export function createGuitar(options = {}) {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  let ctx = options.context || null;
  const owned = !ctx;
  let volume = Math.max(0, num(options.volume, 0.8));
  const reverb = Math.max(0, num(options.reverb, 0.2));
  const chords = {};
  for (const k of Object.keys(CHORDS)) chords[k] = CHORDS[k].slice();
  let nodes = null, engine = null, loading = null, disposed = false;
  const queue = [];

  const offline = () => typeof OfflineAudioContext !== 'undefined' && ctx instanceof OfflineAudioContext;
  const muted = () => {
    if (offline() || typeof document === 'undefined') return false;
    try { if (localStorage.getItem('dl-sound') === '0') return true; } catch (e) {}
    const dl = document.querySelector('.dl');
    return !!(dl && dl.classList.contains('muted'));
  };

  async function init() {
    nodes = graph(ctx, options.destination || ctx.destination, volume, reverb);
    // Offline contexts render without delivering worklet messages, so they default to buffers.
    const useWorklet = typeof options.worklet === 'boolean' ? options.worklet : !offline();
    if (useWorklet && ctx.audioWorklet && typeof AudioWorkletNode !== 'undefined') {
      try {
        await loadWorklet(ctx);
        if (disposed) return;
        const node = new AudioWorkletNode(ctx, 'nylon-guitar', {
          numberOfInputs: 0,
          numberOfOutputs: 1,
          outputChannelCount: [1],
          processorOptions: { open: TUNING.map((_, s) => noteFor(s, 0, 0.5, 0.5)), sym: SYMPATHY }
        });
        node.connect(nodes.input);
        engine = workletEngine(node);
        return;
      } catch (e) { /* no worklet here: use buffers */ }
    }
    engine = bufferEngine(ctx, nodes.input);
  }

  function flush() {
    const now = performance.now();
    for (const [fn, args, born] of queue.splice(0)) if (offline() || now - born < 400) fn(...args);
  }

  // Creates/resumes the AudioContext. Call it from a user gesture. Resolves true once playable.
  function ready() {
    if (disposed) return Promise.resolve(false);
    if (!ctx) {
      if (!AC) return Promise.resolve(false);
      try { ctx = new AC(); } catch (e) { return Promise.resolve(false); }
    }
    if (!loading) loading = init().then(() => !disposed && !!engine, () => false);
    let waits = loading;
    if (!offline() && ctx.state !== 'running') {
      const resumed = ctx.resume().catch(() => {});
      waits = Promise.all([loading, resumed]).then(([ok]) => ok);
    }
    return waits.then((ok) => {
      if (ok) flush();
      return ok && !disposed;
    });
  }

  // Runs fn now if the engine can play, otherwise queues it for a moment while it starts up.
  function run(fn, args) {
    if (disposed || muted()) return;
    if (engine && (offline() || ctx.state === 'running')) { fn(...args); return; }
    queue.push([fn, args, performance.now()]);
    ready();
  }

  const fretOf = (f) => clamp(Math.round(num(f, 0)), 0, 24);

  function playPluck(s, fret, velocity, where) {
    engine.send([{ type: 'pluck', s, nt: noteFor(s, fret, velocity, where), t: ctx.currentTime }]);
  }

  function playStrum(shape, down, spread, velocity) {
    const t0 = ctx.currentTime, events = [];
    let t = 0, k = 0;
    for (let i = 0; i < 6; i++) {
      const s = down ? i : 5 - i;
      const f = shape[s];
      // A muted string in the shape is stopped by the fretting hand, not struck.
      if (typeof f !== 'number' || !(f >= 0)) { events.push({ type: 'damp', s, t: t0 }); continue; }
      const v = velocity * (1 - (down ? 0.035 : 0.07) * k) * (0.92 + 0.16 * Math.random());
      events.push({ type: 'pluck', s, nt: noteFor(s, fretOf(f), v, 0.5 + 0.12 * (Math.random() - 0.5)), t: t0 + t });
      t += spread / 1000 * (0.8 + 0.4 * Math.random());
      k++;
    }
    engine.send(events);
  }

  // string 0..5 (0 = low E), fret 0..24, velocity 0..1, where 0 (bridge) .. 1 (neck)
  function pluck(string, fret = 0, velocity = 0.8, where = 0.5) {
    const s = Math.round(num(string, -1));
    if (s < 0 || s > 5) return;
    run(playPluck, [s, fretOf(fret), clamp(num(velocity, 0.8), 0, 1), clamp(num(where, 0.5), 0, 1)]);
  }

  // frets: six frets low E to high E (null = muted) or a chord name from `chords`.
  function strum(frets, { down = true, spread = 14, velocity = 0.8 } = {}) {
    const shape = typeof frets === 'string' ? chords[frets] : frets;
    if (!Array.isArray(shape)) {
      console.warn(`guitar: unknown chord ${frets}`);
      return;
    }
    run(playStrum, [shape.slice(0, 6), !!down, Math.max(0, num(spread, 14)), clamp(num(velocity, 0.8), 0, 1)]);
  }

  // Mute one string (0..5) or, with no argument, all of them.
  function damp(string) {
    if (!engine || disposed) return;
    const s = string == null ? -1 : Math.round(num(string, -1));
    if (string != null && (s < 0 || s > 5)) return;
    engine.send([{ type: 'damp', s, t: ctx.currentTime }]);
  }

  function setVolume(v) {
    volume = Math.max(0, num(v, volume));
    if (nodes) nodes.master.gain.setTargetAtTime(volume, ctx.currentTime, 0.03);
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    queue.length = 0;
    if (engine) engine.dispose();
    if (nodes) for (const n of nodes.all) n.disconnect();
    if (owned && ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
  }

  return { pluck, strum, chords, damp, ready, setVolume, dispose };
}
