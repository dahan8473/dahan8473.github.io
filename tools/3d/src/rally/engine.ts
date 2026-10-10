// The rally itself: you, the head, the shuttle, rally scoring to 7. No
// React and no three.js here; the scene reads this every frame and draws it.
//
// Time: `gt` is game time in seconds. It runs a little under real time (TS)
// so a first person rally is playable, and only while not paused. Physics
// runs in fixed STEPs of it.
//
// You: your body (where the camera stands) walks to the shuttle by itself.
// When the head hits, you plan like a player would: run the same physics
// forward, take the highest point on its path you can get to in time, and go.
// Your job is timing and placement. A swing meets the shuttle LEAD seconds
// after you press; inside the window either side of the ideal moment it's a
// hit (cleaner the closer), outside it's early or late. The pointer aims:
// across the court is left and right, up the screen is deeper. What you get
// also depends on where you meet it: high and not too deep smashes (unless you
// aim right up for a clear or right down for a drop), chest height drives,
// low lifts or plays a net shot.
//
// The head: plans its intercept from the same physics, picks a shot from
// where it meets it and where you are (away from you), and makes mistakes:
// nets, long, wide, a weak lift, more off your smashes and on a stretch,
// fewer as the rally and the game go on. Its reactions, speed and smashes
// pick up with them too.
import type { Store } from '../lib/store';
import { L, pick } from './lines';
import { aimAt, aimSmash, fly, HALF, NET_H, SHORT, SIDE, step, STEP, wobble, type Body, type V3 } from './physics';
import type { Sound } from './sound';

export const TS = 0.85;
export const WIN = 7;
export const BEST_KEY = 'dl-badminton-best';
/** Your wins and losses against the head on this device, { w, l }. */
export const REC_KEY = 'dl-badminton-rec';
/** Eye height. */
export const EYE = 1.7;
/** Where you meet it, from your body: a bit right, about an arm and a racket in front. */
export const REACH_R = 0.36;
export const REACH_F = 1.0;
/** The head floats with its centre this high; its racket hand is on its right (your left). */
export const FOE_Y = 2.25;
export const FOE_W = 1.08;
export const FOE_H = FOE_W * (344 / 269);
export const FOE_HAND = { x: -0.6, y: -0.34, z: 0.26 };
export const FOE_R = 1.04; // its racket (drawn 1.8x), from the hand to the sweet spot
const LEAD = 0.1; // press to contact
const COOL = 0.26;
const VME = 5.4;
const SW_T = 0.3; // the head's swing: wind up, contact at half, follow through

export type Who = 'me' | 'foe';
export interface Rec {
  w: number;
  l: number;
}
export type Phase = 'intro' | 'serve' | 'rally' | 'point' | 'end';
export type Shot = 'clear' | 'lift' | 'drop' | 'net' | 'drive' | 'smash' | 'serveHigh' | 'serveShort';
export type SwingKind = 'over' | 'side' | 'under';

export interface HudState {
  me: number;
  foe: number;
  rally: number;
  best: number;
  server: Who;
  phase: Phase;
  card: '' | 'end' | 'pause' | 'how';
  won: boolean;
  longest: number;
  rec: Rec;
  big: string;
  bigSub: string;
  help: boolean;
}

export type Fx =
  | { kind: 'pop'; text: string; x: number; y: number; z: number; good?: boolean; at?: 'racket' }
  | { kind: 'ring'; x: number; z: number; out: boolean };

interface Plan {
  ok: boolean;
  /** Game time it gets to the contact point. */
  t: number;
  /** Steps after the hit. */
  step: number;
  p: V3;
  /** Where to stand (body for you, head centre for the head). */
  tx: number;
  tz: number;
  wait: number;
  vmax: number;
  leave?: boolean;
  bad?: boolean;
  miss?: boolean;
  save?: boolean;
  kind?: SwingKind;
  swingAt?: number;
  jumpAt?: number;
  jh?: number;
  dip?: number;
}

export interface MySwing {
  t0: number;
  /** When the racket meets it (or would). */
  tc: number;
  kind: SwingKind;
  q: number;
  label: '' | 'early' | 'late' | 'clean';
  resolved: boolean;
  hit: boolean;
  /** Where it met the shuttle, for the drawn swing. */
  at: V3 | null;
}

export interface FoeSwing {
  t0: number;
  kind: SwingKind;
  /** Racket angle at contact, degrees in the head's picture plane. */
  c: number | null;
  pt: V3 | null;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function pickW(w: Record<string, number>) {
  let total = 0;
  for (const k in w) total += Math.max(0, w[k]);
  let r = Math.random() * total;
  for (const k in w) {
    r -= Math.max(0, w[k]);
    if (r <= 0) return k;
  }
  return Object.keys(w)[0];
}

export interface RallyOptions {
  sound: Sound;
  reduce: boolean;
  hud: Store<HudState>;
  touch: boolean;
  racket: string;
}

export class Rally {
  gt = 0;
  wall = 0;
  acc = 0;
  phase: Phase = 'intro';
  paused = false;
  timers: { at: number; fn: () => void }[] = [];
  score = { me: 0, foe: 0 };
  server: Who = 'me';
  lastServer: Who = 'me';
  firstServe = true;
  rally = 0;
  gameBest = 0;
  best = 0;
  bestShown = false;
  hits = 0;
  waitAt = 0;
  waitSaid = false;
  /** Shakes the camera (seconds left); the scene reads and decays it. */
  shake = 0;
  fx: Fx[] = [];
  /** -1..1 each: across, and up the screen (deeper). */
  aim = { x: 0, y: 0.25 };
  /** Where your shot would land right now, if you met it as planned. */
  reticle = { on: false, x: 0, z: -4, kind: '' as Shot | '' };

  sh = {
    x: 0, y: 1, z: 2.6, vx: 0, vy: 0, vz: 0,
    held: 'me' as Who | null,
    last: null as Who | null,
    kind: '' as Shot | '',
    serve: false,
    netted: false,
    down: false,
    n: 0,
    /** Game time of the last hit. */
    at: 0,
    /** Cork direction and how fast it's turning, so it flips to lead after a hit. */
    dir: { x: 0, y: -1, z: 0 },
    spin: { x: 0, y: 0, z: 0 },
    landX: 0,
    landZ: 0
  };
  me = { x: 0.55, z: 3.6, vx: 0, vz: 0, plan: null as Plan | null, swing: null as MySwing | null, cool: 0, swung: false, stepT: 0 };
  foe = {
    x: -0.6, z: -3.4, vx: 0, vz: 0, dip: 0,
    base: { x: 0, z: -3.6 },
    plan: null as Plan | null,
    swing: null as FoeSwing | null,
    jump: null as { t0: number; h: number } | null,
    sqAt: -1e9,
    shown: false,
    face: 'neutral',
    faceUntil: 0,
    blinkUntil: 0,
    nextBlink: 0
  };
  say = { text: '', t0: 0, until: 0, prio: 0 };

  constructor(public o: RallyOptions) {
    this.best = readBest();
  }

  // ---- Small helpers ----------------------------------------------------------
  after(s: number, fn: () => void) {
    this.timers.push({ at: this.gt + s, fn });
  }
  level() {
    return clamp(this.rally / 18, 0, 1) * 0.75 + clamp((this.score.me + this.score.foe) / 12, 0, 1) * 0.25;
  }
  window() {
    return 0.17 - 0.04 * this.level();
  }
  speak(lines: readonly string[] | string, { prio = 1, chance = 1, hold = 0 } = {}) {
    if (Math.random() > chance) return;
    const busy = this.wall < this.say.until;
    if (busy && prio < this.say.prio && this.wall - this.say.t0 < 1.4) return;
    if (busy && prio <= 1 && this.wall - this.say.t0 < 1.6) return;
    const text = typeof lines === 'string' ? lines : pick(lines);
    this.say = { text, t0: this.wall, prio, until: hold === Infinity ? Infinity : this.wall + 1.2 + text.length * 0.045 + hold };
  }
  hush() {
    this.say.until = 0;
  }
  setFace(name: string, s = Infinity) {
    this.foe.face = name;
    this.foe.faceUntil = this.gt + s;
  }
  curFace() {
    const f = this.foe;
    let face = this.gt < f.faceUntil ? f.face : 'neutral';
    if (face === 'neutral' && !this.o.reduce) {
      if (this.gt > f.nextBlink) {
        f.blinkUntil = this.gt + 0.12;
        f.nextBlink = this.gt + rand(2.2, 5.2);
      }
      if (this.gt < f.blinkUntil) face = 'blink';
    }
    return face;
  }
  pop(text: string, p: V3, good = false, at?: 'racket') {
    this.fx.push({ kind: 'pop', text, x: p.x, y: p.y, z: p.z, good, at });
  }
  hud(patch: Partial<HudState>) {
    this.o.hud.set(patch);
  }
  syncHud() {
    this.hud({ me: this.score.me, foe: this.score.foe, rally: this.rally, best: this.best, server: this.server, phase: this.phase });
  }
  jumpY(j: { t0: number; h: number } | null) {
    if (!j) return 0;
    const t = (this.gt - j.t0) / 0.42;
    return t < 0 || t > 1 ? 0 : Math.sin(t * Math.PI) * j.h;
  }
  /** The head's centre height right now. */
  foeY() {
    const dip = this.foe.dip;
    return FOE_Y - dip + this.jumpY(this.foe.jump) + (this.o.reduce ? 0 : Math.sin(this.gt * 3.1) * 0.035);
  }
  foeHand(): V3 {
    return { x: this.foe.x + FOE_HAND.x, y: this.foeY() + FOE_HAND.y, z: this.foe.z + FOE_HAND.z };
  }
  /** Where the shuttle sits before a serve. */
  heldAt(): V3 {
    if (this.sh.held === 'me') return { x: this.me.x + REACH_R + 0.08, y: 1.28, z: this.me.z - REACH_F - 0.1 };
    const h = this.foeHand();
    return { x: h.x - 0.22, y: Math.max(0.95, h.y - 0.4), z: h.z + 0.05 };
  }

  // ---- Games and serves -------------------------------------------------------
  /** Everyone in place for your first serve, before the head arrives. */
  stage() {
    this.score = { me: 0, foe: 0 };
    this.server = 'me';
    this.setupServe();
    this.phase = 'intro';
    this.timers = [];
    this.firstServe = true;
    const m = this.me, f = this.foe;
    m.x = m.plan!.tx;
    m.z = m.plan!.tz;
    f.x = f.base.x;
    f.z = f.base.z;
    m.vx = m.vz = f.vx = f.vz = 0;
    Object.assign(this.sh, this.heldAt());
    this.hud({ phase: 'intro', big: '', help: true, card: '' });
  }
  /** The head has landed on its side: ours draws in its place. */
  arrive() {
    if (this.foe.shown) return;
    this.foe.shown = true;
    this.foe.sqAt = this.gt;
    this.o.sound.floor(0.6);
  }
  /** First serve. */
  begin() {
    this.arrive();
    this.startGame();
  }
  startGame() {
    this.score = { me: 0, foe: 0 };
    this.gameBest = 0;
    this.server = this.lastServer = 'me';
    this.firstServe = true;
    this.timers = [];
    this.hud({ card: '' });
    this.hush();
    this.setupServe();
    this.speak(Math.random() < 0.5 ? L.picked(this.o.racket) : L.hello, { prio: 3 });
  }
  /** Even score serves from the right court, odd from the left. */
  serveSide(who: Who) {
    const right = this.score[who] % 2 === 0;
    // Your right is +x; the head faces you, so its right is -x.
    return who === 'me' ? (right ? 1 : -1) : right ? -1 : 1;
  }
  setupServe() {
    this.phase = 'serve';
    this.rally = 0;
    this.bestShown = false;
    const sh = this.sh;
    Object.assign(sh, { held: this.server, last: null, serve: false, netted: false, down: false, kind: '', vx: 0, vy: 0, vz: 0, n: 0 });
    sh.dir = { x: 0, y: -1, z: 0 };
    sh.spin = { x: 0, y: 0, z: 0 };
    this.me.swing = null;
    this.foe.swing = this.foe.jump = null;
    this.foe.dip = 0;
    const side = this.serveSide(this.server);
    // Both stand in the diagonal courts: the server's side and the receiver's.
    if (this.server === 'me') {
      this.me.plan = { ok: true, t: 0, step: -1, p: { x: 0, y: 0, z: 0 }, tx: side * 0.62 - REACH_R * 0.5, tz: SHORT + 0.9 + REACH_F, wait: 0, vmax: 3 };
      this.foe.base = { x: -side * 1.2 + 0.7, z: -3.7 };
    } else {
      this.foe.base = { x: side * 0.75 + 0.55, z: -3.1 };
      this.me.plan = { ok: true, t: 0, step: -1, p: { x: 0, y: 0, z: 0 }, tx: -side * 1.05 - REACH_R, tz: 4.5, wait: 0, vmax: 3 };
    }
    this.foe.plan = { ok: true, t: 0, step: -1, p: { x: 0, y: 0, z: 0 }, tx: this.foe.base.x, tz: this.foe.base.z, wait: 0, vmax: 3.6 };
    const h = this.heldAt();
    Object.assign(sh, h);
    this.waitAt = this.gt;
    this.waitSaid = false;
    if (!this.firstServe && this.server !== this.lastServer) this.speak(this.server === 'me' ? L.yourServe : L.myServe, { chance: 0.35 });
    this.lastServer = this.server;
    this.syncHud();
    if (this.server === 'foe') this.after(rand(1.3, 1.9), () => this.foeServe());
    else if (this.firstServe) {
      this.firstServe = false;
      this.hud({ big: 'Your serve', bigSub: this.o.touch ? 'Drag up for a high serve, down for a short one, then tap.' : 'Aim high for a deep serve, low for a short one, then click.' });
      this.after(3.2, () => {
        if (this.o.hud.get().big === 'Your serve') this.hud({ big: '' });
      });
    }
  }
  serveMe() {
    const sh = this.sh;
    const short = this.aim.y < 0;
    this.me.swing = { t0: this.gt - 0.04, tc: this.gt + 0.05, kind: 'under', q: 1, label: '', resolved: true, hit: true, at: { x: sh.x, y: sh.y, z: sh.z } };
    this.hud({ big: '' });
    sh.held = null;
    sh.serve = true;
    this.phase = 'rally';
    this.syncHud();
    const side = this.serveSide('me');
    const tx = -side * (1.3 - 0.85 * this.aim.x * side);
    const depth = short ? rand(2.2, 2.55) : rand(5.85, 6.45);
    let v = aimAt(sh, clamp(tx, -2.3, 2.3), -depth, short ? 18 : 52, short ? 0.06 : 0.3);
    v = wobble(v, rand(-1, 1) * 0.01, rand(-1, 1) * 0.008, 1);
    this.launch('me', short ? 'serveShort' : 'serveHigh', v);
  }
  foeServe() {
    if (this.phase !== 'serve' || this.server !== 'foe') return;
    const f = this.foe;
    if (Math.hypot(f.x - f.base.x, f.z - f.base.z) > 0.25) {
      this.after(0.2, () => this.foeServe());
      return;
    }
    const lv = this.level();
    f.swing = { t0: this.gt - SW_T * 0.5, kind: 'under', c: -40, pt: null };
    const sh = this.sh;
    sh.held = null;
    sh.serve = true;
    this.phase = 'rally';
    this.syncHud();
    const short = Math.random() < 0.6;
    const side = this.serveSide('foe');
    const tx = -side * rand(0.7, 1.9);
    let depth = short ? rand(2.15, 2.6 - 0.2 * lv) : rand(5.8, 6.5);
    if (Math.random() < 0.04) depth = short ? 1.5 : 7.1;
    const v = aimAt(sh, tx, depth, short ? 18 : 52, short ? 0.06 : 0.3);
    this.launch('foe', short ? 'serveShort' : 'serveHigh', wobble(v, rand(-1, 1) * 0.01, rand(-1, 1) * 0.01, 1));
    f.sqAt = this.gt;
  }
  finish() {
    this.phase = 'end';
    this.timers = [];
    const won = this.score.me > this.score.foe;
    const rec = readRec();
    rec[won ? 'w' : 'l']++;
    try {
      localStorage.setItem(REC_KEY, JSON.stringify(rec));
    } catch {}
    this.setFace(won ? 'sad' : 'happy');
    this.hud({ card: 'end', won, longest: this.gameBest, best: this.best, phase: 'end', rec });
    this.speak(won ? L.matchWin : L.matchLose, { prio: 3, hold: Infinity });
  }
  /** Paused under the pause card, or the how to play card. */
  pause(card: 'pause' | 'how' = 'pause') {
    if (this.paused || this.phase === 'end' || this.phase === 'intro') return;
    this.paused = true;
    this.hud({ card });
    if (card === 'pause') this.speak(L.paused, { prio: 3, hold: Infinity });
  }
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.hud({ card: '' });
    this.hush();
  }

  // ---- Swinging ----------------------------------------------------------------
  /** What the shuttle is doing for you: on its way and yours to hit. */
  incoming() {
    const sh = this.sh;
    return this.phase === 'rally' && sh.last === 'foe' && !sh.down && !sh.netted;
  }
  /** Seconds (game) until the planned contact, or Infinity. */
  untilContact() {
    const p = this.me.plan;
    return this.incoming() && p && p.ok && !p.leave ? p.t - this.gt : Infinity;
  }
  swing() {
    if (this.paused) return;
    if (this.phase === 'serve') {
      if (this.server === 'me' && this.sh.held === 'me' && this.gt - this.waitAt > 0.35) this.serveMe();
      return;
    }
    if (this.phase !== 'rally' || this.gt < this.me.cool) return;
    this.me.cool = this.gt + COOL;
    this.o.sound.whoosh(0.45);
    const p = this.me.plan;
    const tc = this.gt + LEAD;
    const y = p ? p.p.y : 1.3;
    const kind: SwingKind = y >= 1.95 ? 'over' : y >= 0.85 ? 'side' : 'under';
    const sw: MySwing = { t0: this.gt, tc, kind, q: 0, label: '', resolved: false, hit: false, at: null };
    this.me.swung = true;
    const W = this.window();
    if (this.incoming() && p && !p.leave) {
      const off = tc - p.t;
      if (off < -W) sw.label = 'early';
      else if (off > W) sw.label = 'late';
      else {
        if (off <= 0) sw.tc = p.t;
        sw.q = 1 - 0.72 * Math.pow(Math.abs(off) / W, 1.25);
        sw.label = Math.abs(off) > 0.065 ? (off < 0 ? 'early' : 'late') : Math.abs(off) < 0.025 ? 'clean' : '';
      }
    }
    this.me.swing = sw;
  }
  /** At the moment of contact: hit it if it's there, else a whiff. */
  resolveSwing() {
    const sw = this.me.swing;
    if (!sw || sw.resolved || this.gt < sw.tc) return;
    sw.resolved = true;
    const sh = this.sh;
    const cx = this.me.x + REACH_R, cz = this.me.z - REACH_F;
    const reach = Math.abs(sh.x - cx) < 0.8 && Math.abs(sh.z - cz) < 0.62 && sh.y > 0.1 && sh.y < 3.05;
    if (sw.q > 0 && this.incoming() && reach) {
      sw.hit = true;
      sw.at = { x: sh.x, y: sh.y, z: sh.z };
      this.myHit(sw);
      return;
    }
    if (sw.label === 'early' || sw.label === 'late') this.pop(sw.label, { x: 0, y: 0, z: 0 }, false, 'racket');
  }
  myHit(sw: MySwing) {
    const sh = this.sh;
    const lv = this.level();
    const y = sh.y, dn = sh.z;
    const ay = this.aim.y;
    let kind: Shot;
    let depth: number;
    const u = (a: number, b: number) => clamp((ay - a) / (b - a), 0, 1);
    if (y >= 1.95) {
      if (ay < -0.5) { kind = 'drop'; depth = lerp(0.75, 2.1, u(-1, -0.5)); }
      else if (ay > 0.5 && dn > 2.8) { kind = 'clear'; depth = lerp(5.4, 6.45, u(0.5, 1)); }
      else { kind = 'smash'; depth = lerp(2.7, 5.9, u(-0.5, 0.5)); }
    } else if (y >= 0.85) {
      if (ay > 0.35) { kind = 'lift'; depth = lerp(5.1, 6.45, u(0.35, 1)); }
      else if (ay < -0.35) { kind = dn < 2.4 ? 'net' : 'drop'; depth = lerp(0.55, 2.0, u(-1, -0.35)); }
      else { kind = 'drive'; depth = lerp(3.6, 6.2, u(-0.35, 0.35)); }
    } else if (ay > -0.1) { kind = 'lift'; depth = lerp(4.6, 6.45, u(-0.1, 1)); }
    else { kind = 'net'; depth = lerp(0.45, 1.7, u(-1, -0.1)); }
    const tx = clamp(this.aim.x * 2.3, -2.42, 2.42);
    const q = sw.q;
    const ANG: Record<string, number> = { clear: 38, lift: 48, drop: 3, net: 30, drive: 2 };
    let v = kind === 'smash' ? aimSmash(sh, tx, -depth, (26 + 9 * q) * (1 + 0.08 * lv)) : aimAt(sh, tx, -depth, ANG[kind]);
    const err = 1 - q;
    if (err > 0.02) {
      // A mistimed smash mostly finds the tape, not the back wall.
      v = wobble(v, rand(-1, 1) * err * 0.1, (kind === 'smash' ? rand(-1, 0.35) : rand(-1, 1)) * err * 0.13, 1 + rand(-0.18, 0.12) * err);
    }
    this.launch('me', kind, v);
    this.hits++;
    if (this.hits === 3) this.hud({ help: false });
    if (kind === 'smash') {
      this.pop('smash', { x: 0, y: 0, z: 0 }, true, 'racket');
      if (!this.o.reduce) this.shake = 0.18;
    } else if (sw.label === 'clean') this.pop('clean', { x: 0, y: 0, z: 0 }, true, 'racket');
    else if (sw.label) this.pop(sw.label, { x: 0, y: 0, z: 0 }, false, 'racket');
  }
  /** Where a shot would go from the planned contact, for the reticle. */
  updateReticle() {
    const r = this.reticle;
    const p = this.me.plan;
    if (this.phase === 'serve' && this.server === 'me' && this.sh.held === 'me') {
      const side = this.serveSide('me');
      const short = this.aim.y < 0;
      r.on = true;
      r.kind = short ? 'serveShort' : 'serveHigh';
      r.x = clamp(-side * (1.3 - 0.85 * this.aim.x * side), -2.3, 2.3);
      r.z = short ? -2.35 : -6.1;
      return;
    }
    if (!this.incoming() || !p || !p.ok || p.leave) {
      r.on = false;
      return;
    }
    const ay = this.aim.y, y = p.p.y, dn = p.p.z;
    const u = (a: number, b: number) => clamp((ay - a) / (b - a), 0, 1);
    let depth: number;
    if (y >= 1.95) depth = ay < -0.5 ? lerp(0.75, 2.1, u(-1, -0.5)) : ay > 0.5 && dn > 2.8 ? lerp(5.4, 6.45, u(0.5, 1)) : lerp(2.7, 5.9, u(-0.5, 0.5));
    else if (y >= 0.85) depth = ay > 0.35 ? lerp(5.1, 6.45, u(0.35, 1)) : ay < -0.35 ? lerp(0.55, 2.0, u(-1, -0.35)) : lerp(3.6, 6.2, u(-0.35, 0.35));
    else depth = ay > -0.1 ? lerp(4.6, 6.45, u(-0.1, 1)) : lerp(0.45, 1.7, u(-1, -0.1));
    r.on = true;
    r.kind = y >= 1.95 ? (ay < -0.5 ? 'drop' : ay > 0.5 && dn > 2.8 ? 'clear' : 'smash') : '';
    r.x = clamp(this.aim.x * 2.3, -2.42, 2.42);
    r.z = -depth;
  }

  // ---- Shots -----------------------------------------------------------------------
  launch(who: Who, kind: Shot, v: V3) {
    const sh = this.sh;
    // The cork turns round to lead: a kick sideways so it flips, not freezes.
    const d = sh.dir;
    const sp = Math.hypot(v.x, v.y, v.z) || 1;
    const along = (d.x * v.x + d.y * v.y + d.z * v.z) / sp;
    if (along < 0.2) sh.spin = { x: rand(-1, 1) * 8, y: 0, z: (who === 'me' ? 1 : -1) * 14 };
    sh.vx = v.x;
    sh.vy = v.y;
    sh.vz = v.z;
    sh.n = 0;
    sh.at = this.gt;
    sh.last = who;
    sh.kind = kind;
    sh.netted = false;
    if (!kind.startsWith('serve')) sh.serve = false;
    this.rally++;
    const s = this.o.sound;
    if (kind === 'smash') s.crack();
    else s.pock(kind === 'drop' || kind === 'net' || kind === 'serveShort' ? 0.5 : kind === 'drive' ? 1 : 0.8);
    if (this.rally > this.best && this.best > 0 && !this.bestShown) {
      this.bestShown = true;
      this.pop('new best rally', { x: 0, y: 3.2, z: -1 }, true);
      this.speak(L.newBest, { prio: 2, chance: 0.7 });
    } else if ([10, 16, 24, 34].includes(this.rally)) this.speak(L.long, { prio: 2 });
    this.syncHud();
    if (who === 'me') {
      this.planFoe();
      // Back towards the middle, a step behind it.
      const m = this.me;
      m.plan = { ok: true, t: 0, step: -1, p: { x: 0, y: 0, z: 0 }, tx: clamp(m.x * 0.35, -0.8, 0.8) - REACH_R * 0.4, tz: 3.9 + 0.4 * (kind === 'clear' || kind === 'lift' ? 1 : 0), wait: Math.round(0.08 / STEP), vmax: 3.2 };
    } else this.planMe();
  }

  /** The head's plan for your shot: the best point on its path it can reach in time. */
  planFoe() {
    const lv = this.level();
    const sh = this.sh;
    const f = fly(sh, true);
    const foe = this.foe;
    const react = 0.22 - 0.1 * lv;
    const vmax = 4.4 + 1.6 * lv;
    const p: Plan = { ok: false, t: 0, step: -1, p: { x: 0, y: 0, z: 0 }, tx: foe.x, tz: foe.z, wait: Math.round(react / STEP), vmax };
    foe.plan = p;
    if (f.end === 'net' || f.z >= 0) {
      p.tx = clamp(foe.x, -1.5, 2.2);
      p.tz = -2.4;
      return;
    }
    const outBy = Math.max(Math.abs(f.x) - SIDE, -f.z - HALF);
    const shortServe = sh.serve && -f.z < SHORT;
    if ((outBy > 0 || shortServe) && Math.random() < (outBy > 0.3 || shortServe ? 0.93 : 0.72)) {
      p.leave = true;
      p.tx = clamp(f.x * 0.6 + 0.6, -1.8, 2.6);
      p.tz = clamp(f.z * 0.75, -6, -1.5);
      return;
    }
    if (outBy < 0 && outBy > -0.3 && Math.random() < 0.1 * (1 - lv)) {
      p.leave = p.bad = true;
      p.tx = clamp(f.x * 0.6 + 0.6, -1.8, 2.6);
      p.tz = clamp(f.z * 0.75, -6, -1.5);
      return;
    }
    const pts = f.pts!;
    const n = f.steps;
    const Sy0 = FOE_Y + FOE_HAND.y;
    const R = FOE_R;
    let best = -1, bestSc = -Infinity, bestTx = 0, bestTz = 0, bestJ = 0, bestDip = 0;
    let late = -1, lateBy = Infinity, lateTx = 0, lateTz = 0;
    for (let i = 4; i < n; i += 2) {
      const x = pts[(i - 1) * 3], y = pts[(i - 1) * 3 + 1], z = pts[(i - 1) * 3 + 2];
      if (z > -0.4 || y < 0.16) continue;
      let dy = y - Sy0, j = 0, dip = 0;
      if (dy > 0.72 * R) {
        j = dy - 0.72 * R;
        if (j > 0.55) continue;
        dy -= j;
      }
      if (dy < -0.6 * R) {
        dip = Math.min(0.75, -0.6 * R - dy);
        dy += dip;
        if (dy < -0.95 * R) continue;
      }
      const reachX = Math.sqrt(Math.max(0, (0.86 * R) ** 2 - dy * dy));
      const tx = clamp(x + reachX * 0.92 - FOE_HAND.x, -2.3, 3.5);
      const tz = clamp(z - FOE_HAND.z, -7.6, -0.75);
      if (Math.abs(x - (tx + FOE_HAND.x - reachX * 0.92)) > 0.3 || Math.abs(z - (tz + FOE_HAND.z)) > 0.35) continue;
      const t = i * STEP;
      const need = react + Math.hypot(tx - foe.x, tz - foe.z) / vmax + 0.09;
      if (need <= t) {
        const sc = y - 0.6 * t - 1.2 * j - 0.6 * dip + (dy > 0.3 * R ? 0.5 : 0);
        if (sc > bestSc) { bestSc = sc; best = i; bestTx = tx; bestTz = tz; bestJ = j; bestDip = dip; }
      } else if (need - t < lateBy) { lateBy = need - t; late = i; lateTx = tx; lateTz = tz; }
    }
    if (best < 0) {
      if (late < 0) {
        p.miss = true;
        p.tx = clamp(f.x + 0.8, -2.3, 3.5);
        p.tz = clamp(f.z + 0.6, -7, -1);
        return;
      }
      p.tx = lateTx;
      p.tz = lateTz;
      if (lateBy < 0.13) { p.save = true; best = late; }
      else { p.miss = true; return; }
    } else {
      p.tx = bestTx;
      p.tz = bestTz;
      p.jh = bestJ;
      p.dip = bestDip;
    }
    p.ok = true;
    p.step = best;
    p.t = this.gt + best * STEP;
    const y = pts[(best - 1) * 3 + 1];
    p.p = { x: pts[(best - 1) * 3], y, z: pts[(best - 1) * 3 + 2] };
    const dy = y + (p.dip || 0) - Sy0 - (p.jh || 0);
    p.kind = dy > 0.3 * R ? 'over' : dy < -0.45 * R ? 'under' : 'side';
    p.swingAt = Math.max(1, best - Math.round((SW_T * 0.5) / STEP));
    p.jumpAt = Math.max(1, best - Math.round(0.22 / STEP));
  }

  /** Your plan for its shot: where your body goes and when you'll meet it. */
  planMe() {
    const sh = this.sh;
    const me = this.me;
    const f = fly(sh, true);
    const react = 0.1;
    const p: Plan = { ok: false, t: 0, step: -1, p: { x: 0, y: 0, z: 0 }, tx: me.x, tz: me.z, wait: Math.round(react / STEP), vmax: VME };
    me.plan = p;
    me.swung = false;
    if (f.end === 'net' || f.z <= 0) {
      p.leave = true;
      p.tx = clamp(me.x, -1.5, 1.5);
      p.tz = 3.0;
      return;
    }
    // Clearly out: you watch it go. Close calls are yours to judge.
    const outBy = Math.max(Math.abs(f.x) - SIDE, f.z - HALF);
    if (outBy > 0.22 || (sh.serve && f.z < SHORT - 0.22)) {
      p.leave = true;
      p.tx = clamp(f.x * 0.5 - REACH_R, -2.2, 2.2);
      p.tz = clamp(f.z * 0.6 + 1, 2.5, 6);
      return;
    }
    const pts = f.pts!;
    const n = f.steps;
    let best = -1, bestSc = -Infinity, bestTx = 0, bestTz = 0;
    let late = -1, lateBy = Infinity, lateTx = 0, lateTz = 0;
    for (let i = 6; i < n; i += 2) {
      const x = pts[(i - 1) * 3], y = pts[(i - 1) * 3 + 1], z = pts[(i - 1) * 3 + 2];
      if (z < 0.3 || y < 0.22 || y > 2.85) continue;
      const bx = x - REACH_R, bz = z + REACH_F;
      const tx = clamp(bx, -3.3, 3.3), tz = clamp(bz, 1.05, 8.1);
      if (Math.abs(tx - bx) > 0.45 || Math.abs(tz - bz) > 0.4) continue;
      const t = i * STEP;
      const need = react + Math.hypot(tx - me.x, tz - me.z) / VME + 0.06;
      if (need <= t) {
        const sc = Math.min(y, 2.55) - 0.3 * t + (y > 1.95 ? 0.35 : 0);
        if (sc > bestSc) { bestSc = sc; best = i; bestTx = tx; bestTz = tz; }
      } else if (need - t < lateBy) { lateBy = need - t; late = i; lateTx = tx; lateTz = tz; }
    }
    if (best < 0) {
      if (late < 0) {
        p.tx = clamp(f.x - REACH_R, -3, 3);
        p.tz = clamp(f.z + REACH_F, 1.1, 7.8);
        return;
      }
      best = late;
      bestTx = lateTx;
      bestTz = lateTz;
    } else p.ok = true;
    p.tx = bestTx;
    p.tz = bestTz;
    p.step = best;
    p.t = this.gt + best * STEP;
    p.p = { x: pts[(best - 1) * 3], y: pts[(best - 1) * 3 + 1], z: pts[(best - 1) * 3 + 2] };
  }

  // ---- The head hits -----------------------------------------------------------
  tryFoeHit() {
    const sh = this.sh;
    const p = this.foe.plan;
    if (!p || p.step < 0 || sh.last !== 'me' || sh.netted || sh.n !== p.step) return;
    p.step = -1;
    const h = this.foeHand();
    if (!p.save && Math.hypot(sh.x - h.x, sh.y - h.y) > FOE_R * 1.12) {
      p.miss = true;
      return;
    }
    const lv = this.level();
    const dy = sh.y - h.y;
    const fs = this.foe.swing;
    if (fs && fs.pt) {
      fs.t0 = this.gt - SW_T * 0.5;
      fs.c = fitC(fs.kind, Math.atan2(dy, h.x - sh.x) / (Math.PI / 180));
      fs.pt = null;
    }
    const hi = dy > 0.3 * FOE_R, lo = dy < -0.45 * FOE_R;
    const dn = -sh.z;
    const me = this.me;
    const meDn = me.z - REACH_F;
    const youBack = meDn > 4.4, youFront = meDn < 2.7;
    let kind: Shot;
    if (p.save) kind = lo ? 'lift' : 'clear';
    else if (hi) kind = pickW({ smash: dn < 4.8 ? 0.8 + 2 * lv + (youBack ? 0.4 : 0) : 0.15 + 0.4 * lv, clear: youFront ? 2.2 : 1, drop: youBack ? 2.4 : 0.9 + lv }) as Shot;
    else if (lo) kind = (dn < 2.6 ? pickW({ net: 1.8, lift: 1.2 }) : pickW({ lift: 2.4, net: youBack ? 1.4 : 0.5 })) as Shot;
    else kind = pickW({ drive: 2, drop: youBack ? 1.5 : 0.6, lift: 0.7 }) as Shot;
    // Mistakes: a steady trickle, more off your smashes and on a stretch.
    const pm = 0.09 - 0.035 * lv + (sh.kind === 'smash' ? 0.12 : 0) + (p.save ? 0.35 : 0);
    let mess = '';
    if (Math.random() < pm) mess = pickW({ net: 1, long: 0.8, wide: 0.4, weak: lo ? 0.3 : 0.9 });
    // Away from you, across: the far side from where you'd meet it.
    const myX = me.x + REACH_R;
    const away = Math.abs(myX) < 0.35 ? (Math.random() < 0.5 ? -1 : 1) : -Math.sign(myX);
    let tx = away * rand(0.9, 1.9 + 0.45 * lv);
    if (Math.random() < 0.25) tx = myX + rand(-0.6, 0.6); // straight at you now and then
    let depth: number;
    if (mess === 'long') depth = rand(6.9, 7.5);
    else if (mess === 'weak') {
      kind = 'lift';
      depth = rand(2.8, 3.8);
    } else if (kind === 'smash') {
      // Away from you: deep if you're up, short if you're back.
      const spots = [2.6, 4.1, 5.6].sort((a, b) => Math.abs(b - meDn) - Math.abs(a - meDn));
      depth = spots[Math.random() < 0.7 ? 0 : 1] + rand(-0.3, 0.3);
    } else if (kind === 'clear' || kind === 'lift') depth = rand(5.3 + 0.5 * lv, 6.45);
    else if (kind === 'drop') depth = rand(0.8, 2 - 0.5 * lv);
    else if (kind === 'net') depth = rand(0.45, 1.2);
    else depth = rand(4.2, 6.1);
    if (mess === 'wide') tx = away * rand(2.75, 3.1);
    tx = mess === 'wide' ? tx : clamp(tx, -2.45, 2.45);
    const ANG: Record<string, number> = { clear: 42 - 8 * lv, lift: 50, drop: 2, net: 34, drive: 3 };
    let v = kind === 'smash' ? aimSmash(sh, tx, depth, 25 + 11 * lv) : aimAt(sh, tx, depth, ANG[kind]);
    v = wobble(v, rand(-1, 1) * (1.2 - lv) * 0.012, rand(-1, 1) * (1.2 - lv) * 0.016 + (mess === 'net' ? 0.12 : 0), mess === 'net' ? 0.62 : 1 + rand(-0.03, 0.03));
    this.launch('foe', kind, v);
    const f = this.foe;
    f.sqAt = this.gt;
    f.base = { x: 0.5, z: kind === 'clear' || kind === 'lift' ? -4.1 : kind === 'net' || kind === 'drop' ? -2.9 : -3.6 };
    f.plan = { ok: true, t: 0, step: -1, p: { x: 0, y: 0, z: 0 }, tx: f.base.x, tz: f.base.z, wait: Math.round(0.12 / STEP), vmax: 3.4 + lv };
    if (kind === 'smash') this.setFace('angry', 0.5);
  }

  // ---- Moving ------------------------------------------------------------------------
  moveMe() {
    const m = this.me;
    const p = m.plan;
    let tx = p ? p.tx : m.x, tz = p ? p.tz : m.z;
    if (p && p.wait > 0) {
      p.wait--;
      tx = m.x;
      tz = m.z;
    }
    const vmax = p ? p.vmax : 3;
    this.steer(m, tx, tz, vmax, 34);
    m.x = clamp(m.x, -3.4, 3.4);
    m.z = clamp(m.z, 1.0, 8.2);
  }
  moveFoe() {
    const f = this.foe;
    const p = f.plan;
    let tx = p ? p.tx : f.base.x, tz = p ? p.tz : f.base.z;
    if (p && p.wait > 0) {
      p.wait--;
      tx = f.x;
      tz = f.z;
    }
    this.steer(f, tx, tz, p ? p.vmax : 4, 40);
    f.x = clamp(f.x, -2.4, 3.6);
    f.z = clamp(f.z, -7.7, -0.7);
    const wantDip = p && p.ok && p.step > 0 ? p.dip || 0 : 0;
    f.dip += clamp(wantDip - f.dip, -2.4 * STEP, 2.4 * STEP);
    if (p && p.step > 0 && this.phase === 'rally' && this.sh.last === 'me') {
      if (this.sh.n === p.swingAt) f.swing = { t0: this.gt, kind: p.kind || 'side', c: null, pt: p.p };
      if ((p.jh || 0) > 0 && this.sh.n === p.jumpAt) f.jump = { t0: this.gt, h: p.jh! };
    }
  }
  /** Eases a body toward (tx, tz): capped speed, capped acceleration. */
  steer(b: { x: number; z: number; vx: number; vz: number }, tx: number, tz: number, vmax: number, acc: number) {
    let wx = (tx - b.x) * 9, wz = (tz - b.z) * 9;
    const w = Math.hypot(wx, wz);
    if (w > vmax) {
      wx *= vmax / w;
      wz *= vmax / w;
    }
    let ax = wx - b.vx, az = wz - b.vz;
    const a = Math.hypot(ax, az), amax = acc * STEP;
    if (a > amax) {
      ax *= amax / a;
      az *= amax / a;
    }
    b.vx += ax;
    b.vz += az;
    b.x += b.vx * STEP;
    b.z += b.vz * STEP;
  }

  // ---- Flight, landing and points -------------------------------------------------
  flyStep() {
    const sh = this.sh;
    const px = sh.x, py = sh.y, pz = sh.z;
    step(sh as Body);
    sh.n++;
    if (!sh.netted && pz !== 0 && pz < 0 !== sh.z < 0) {
      const t = pz / (pz - sh.z);
      const ny = py + (sh.y - py) * t;
      const nx = px + (sh.x - px) * t;
      if (ny < NET_H && Math.abs(nx) < 3.15) {
        // Into the net: it drops back on the hitter's side.
        sh.netted = true;
        sh.z = pz < 0 ? -0.06 : 0.06;
        sh.x = nx;
        sh.y = ny;
        sh.vx *= 0.15;
        sh.vz = -sh.vz * 0.08;
        sh.vy = Math.min(sh.vy, 0) * 0.3;
        this.o.sound.net();
        if (this.foe.plan) this.foe.plan.step = -1;
      }
    }
    if (this.phase === 'rally') {
      this.resolveSwing();
      this.tryFoeHit();
    }
    if (sh.y <= 0) {
      const t = py / Math.max(1e-6, py - sh.y);
      sh.x = px + (sh.x - px) * t;
      sh.z = pz + (sh.z - pz) * t;
      sh.y = 0;
      this.landed();
    }
  }
  landed() {
    const sh = this.sh;
    sh.down = true;
    sh.vx = sh.vy = sh.vz = 0;
    sh.landX = sh.x;
    sh.landZ = sh.z;
    this.o.sound.floor(0.9);
    const hitter = sh.last || 'me';
    const other: Who = hitter === 'me' ? 'foe' : 'me';
    let winner: Who, why: string;
    const side: Who = sh.z > 0 ? 'me' : 'foe';
    if (sh.netted || side === hitter) { winner = other; why = 'net'; }
    else if (Math.abs(sh.x) > SIDE) { winner = side; why = 'wide'; }
    else if (Math.abs(sh.z) > HALF) { winner = side; why = 'out'; }
    else if (sh.serve && Math.abs(sh.z) < SHORT) { winner = side; why = 'short'; }
    else { winner = hitter; why = 'in'; }
    const out = why === 'wide' || why === 'out' || why === 'short';
    if (!sh.netted && side !== hitter) this.fx.push({ kind: 'ring', x: sh.x, z: sh.z, out });
    this.point(winner, why);
  }
  point(winner: Who, why: string) {
    this.phase = 'point';
    this.score[winner]++;
    const sh = this.sh;
    const at = { x: sh.x, y: 0.35, z: sh.z };
    if (why === 'out' || why === 'wide' || why === 'short') this.pop(why === 'wide' ? 'wide' : why, at);
    else if (why === 'net') this.pop('net', { x: sh.x, y: NET_H + 0.35, z: 0 });
    else if (Math.abs(sh.z) > HALF - 0.45 || Math.abs(sh.x) > SIDE - 0.35) this.pop('in', at, true);
    this.o.sound.point(winner === 'me');
    const p = this.foe.plan || ({} as Plan);
    if (winner === 'me') {
      this.setFace(why === 'in' ? 'sad' : 'angry', 1.5);
      if (why === 'out') this.speak(L.headOut, { prio: 2 });
      else if (why === 'wide') this.speak(L.headWide, { prio: 2 });
      else if (why === 'net') this.speak(L.headNet, { prio: 2 });
      else if (p.bad) this.speak(L.badLeave, { prio: 2 });
      else {
        const byKind: Record<string, string[]> = { smash: L.smashYou, drop: L.dropYou, net: L.netYou, clear: L.clearYou, lift: L.clearYou, drive: L.driveYou };
        const k = sh.kind as string;
        this.speak(byKind[k] && Math.random() < 0.75 ? byKind[k] : L.tooGood, { prio: 2 });
      }
    } else {
      this.setFace(why === 'in' ? 'happy' : 'blink', 1.5);
      const sw = this.me.swing;
      if (why === 'out') this.speak(this.me.plan?.leave ? L.goodLeave : L.youOut, { prio: 2 });
      else if (why === 'wide') this.speak(L.youWide, { prio: 2 });
      else if (why === 'net') this.speak(L.youNet, { prio: 2, chance: 0.8 });
      else if (why === 'short') this.speak(L.youShort, { prio: 2 });
      else if (!this.me.swung && this.me.plan?.ok) this.speak(L.youLeft, { prio: 2, chance: 0.8 });
      else if (sw && !sw.hit && sw.label === 'early' && this.gt - sw.t0 < 1.2) this.speak(L.youEarly, { prio: 2, chance: 0.8 });
      else if (sw && !sw.hit && this.gt - sw.t0 < 1.2) this.speak(L.youLate, { prio: 2, chance: 0.8 });
      else if (sh.kind === 'smash') this.speak(L.headSmash, { prio: 2 });
      else if ((sh.kind === 'drop' || sh.kind === 'net') && Math.random() < 0.7) this.speak(L.headDrop, { prio: 2 });
      else this.speak(L.headWin, { prio: 2, chance: 0.7 });
    }
    this.gameBest = Math.max(this.gameBest, this.rally);
    if (this.rally > this.best) {
      this.best = this.rally;
      try {
        localStorage.setItem(BEST_KEY, String(this.best));
      } catch {}
    }
    this.server = winner;
    this.syncHud();
    if (this.score[winner] >= WIN) this.after(1.5, () => this.finish());
    else this.after(1.6, () => this.setupServe());
  }

  // ---- Loop ----------------------------------------------------------------------------
  tick() {
    if (this.timers.length && this.timers.some((t) => t.at <= this.gt)) {
      const due = this.timers.filter((t) => t.at <= this.gt);
      this.timers = this.timers.filter((t) => t.at > this.gt);
      due.forEach((t) => t.fn());
    }
    if (this.phase !== 'intro') {
      this.moveMe();
      this.moveFoe();
    }
    const sh = this.sh;
    if (sh.held) Object.assign(sh, this.heldAt());
    else if (this.phase === 'rally' && !sh.down) this.flyStep();
    this.gt += STEP;
  }
  /** Advance by dt seconds of real time. */
  update(dt: number) {
    this.wall += dt;
    if (this.paused) return;
    this.acc += dt * TS;
    let n = 0;
    while (this.acc >= STEP && n < 80) {
      this.acc -= STEP;
      n++;
      this.tick();
    }
    if (this.acc >= STEP) this.acc = 0;
    this.updateReticle();
    if (this.phase === 'serve' && this.server === 'me' && !this.waitSaid && this.gt - this.waitAt > 7) {
      this.waitSaid = true;
      this.speak(L.wait, { prio: 2 });
    }
  }
}

// Keep a contact angle on the side of the body its swing belongs to.
export function fitC(kind: SwingKind, c: number) {
  c = ((c + 540) % 360) - 180;
  if (kind === 'over') return clamp(c, 20, 165);
  if (kind === 'under') return c > 90 ? -170 : clamp(c, -170, -10);
  return clamp(c, -60, 60);
}

export function readRec(): Rec {
  try {
    const r = JSON.parse(localStorage.getItem(REC_KEY) || '{}') || {};
    return { w: Number(r.w) | 0, l: Number(r.l) | 0 };
  } catch {
    return { w: 0, l: 0 };
  }
}

export function readBest() {
  try {
    return parseInt(localStorage.getItem(BEST_KEY) || '', 10) || 0;
  } catch {
    return 0;
  }
}
