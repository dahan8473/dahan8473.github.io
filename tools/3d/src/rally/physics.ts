// Shuttle physics for the first person rally. Metres and game seconds.
// x across the court (right is +x from your end), y up, z toward you: the net
// is z = 0, your half is z > 0, the head's is z < 0.
//
// A shuttle is gravity plus drag that grows with the square of its speed, with
// a low terminal speed (about 6.8 m/s), so it leaves the racket fast, dies,
// and falls steeply. Drag is always along the velocity, so a shot never curves
// sideways: every flight stays in one vertical plane, which is why aiming only
// needs a 2D solve along the line from the hitter to the target.

export const G = 9.8;
export const VT = 6.8;
export const KD = G / (VT * VT);
export const STEP = 1 / 240;
export const NET_H = 1.524; // tape height at the centre
export const NET_LOW = 0.79; // bottom of the mesh
export const POST_X = 3.05; // posts stand on the doubles sidelines
export const HALF = 6.7; // back boundary, metres from the net
export const SHORT = 1.98; // short service line
export const SIDE = 2.59; // singles sideline
export const DSIDE = 3.05; // doubles sideline
export const LONG_D = 5.94; // doubles long service line (drawn, not used in singles)

const deg = Math.PI / 180;

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
}

/** One fixed step of flight. */
export function step(s: Body) {
  const k = KD * Math.hypot(s.vx, s.vy, s.vz) * STEP;
  s.vx -= k * s.vx;
  s.vy -= G * STEP + k * s.vy;
  s.vz -= k * s.vz;
  s.x += s.vx * STEP;
  s.y += s.vy * STEP;
  s.z += s.vz * STEP;
}

export interface Flight {
  end: 'floor' | 'net';
  /** Where it lands (or meets the net). */
  x: number;
  z: number;
  /** Steps until then. */
  steps: number;
  /** Height where it crosses the net plane, if it does. */
  netY: number | null;
  /** The path, 3 floats per step (after step 1, 2...), when asked for. */
  pts: Float32Array | null;
}

const MAX = 2400;

/** Flies a copy of s until it lands or meets the net. */
export function fly(s0: Body, keep = false): Flight {
  const s = { ...s0 };
  const pts = keep ? new Float32Array(MAX * 3) : null;
  let netY: number | null = null;
  for (let i = 1; i <= MAX; i++) {
    const px = s.x, py = s.y, pz = s.z;
    step(s);
    if (pz !== 0 && pz < 0 !== s.z < 0) {
      const f = pz / (pz - s.z);
      const ny = py + (s.y - py) * f;
      const nx = px + (s.x - px) * f;
      if (netY === null) netY = ny;
      if (ny < NET_H && Math.abs(nx) < POST_X + 0.1) return { end: 'net', x: nx, z: 0, steps: i, netY: ny, pts };
    }
    if (pts) {
      pts[(i - 1) * 3] = s.x;
      pts[(i - 1) * 3 + 1] = s.y;
      pts[(i - 1) * 3 + 2] = s.z;
    }
    if (s.y <= 0) {
      const f = py / (py - s.y);
      return { end: 'floor', x: px + (s.x - px) * f, z: pz + (s.z - pz) * f, steps: i, netY, pts };
    }
  }
  return { end: 'floor', x: s.x, z: s.z, steps: MAX, netY, pts };
}

// The same flight in the vertical plane of the shot: r along the ground from
// the hitter, y up. Returns where it lands and its height at r = rn (the net).
function fly2(y0: number, vr: number, vy: number, rn: number) {
  let r = 0, y = y0, netY: number | null = null;
  for (let i = 0; i < MAX; i++) {
    const k = KD * Math.hypot(vr, vy) * STEP;
    vr -= k * vr;
    vy -= G * STEP + k * vy;
    const pr = r, py = y;
    r += vr * STEP;
    y += vy * STEP;
    if (netY === null && rn > 0 && pr < rn && r >= rn) netY = py + (y - py) * ((rn - pr) / (r - pr));
    if (y <= 0) return { r: pr + (r - pr) * (py / (py - y)), netY };
  }
  return { r, netY };
}

export interface V3 {
  x: number;
  y: number;
  z: number;
}

function plane(from: V3, tx: number, tz: number) {
  const dx = tx - from.x, dz = tz - from.z;
  const d = Math.max(0.05, Math.hypot(dx, dz));
  // Ground distance to the net along this line, if it crosses.
  const rn = from.z !== 0 && from.z > 0 !== tz > 0 ? d * (from.z / (from.z - tz)) : -1;
  return { hx: dx / d, hz: dz / d, d, rn };
}

/**
 * Velocity for a shot launched `ang` degrees above flat that lands at (tx, tz).
 * If the net is in the way, the angle goes up until it clears by `clear`.
 */
export function aimAt(from: V3, tx: number, tz: number, ang: number, clear = 0.12): V3 {
  const { hx, hz, d, rn } = plane(from, tx, tz);
  let best = { x: 0, y: 0, z: 0 };
  for (let a = ang; a <= 84; a += 4) {
    const c = Math.cos(a * deg), s = Math.sin(a * deg);
    let lo = 0.5, hi = 95;
    for (let i = 0; i < 22; i++) {
      const v = (lo + hi) / 2;
      const f = fly2(from.y, c * v, s * v, rn);
      const r = f.netY !== null && f.netY < NET_H ? -1 : f.r;
      if (r < d) lo = v;
      else hi = v;
    }
    const v = (lo + hi) / 2;
    best = { x: hx * c * v, y: s * v, z: hz * c * v };
    const f = fly2(from.y, c * v, s * v, rn);
    if (rn < 0 || (f.netY !== null && f.netY >= NET_H + clear)) return best;
  }
  return best;
}

/** A smash at speed v: the angle down that lands it at (tx, tz), flattening if the net is in the way. */
export function aimSmash(from: V3, tx: number, tz: number, v: number): V3 {
  const { hx, hz, d, rn } = plane(from, tx, tz);
  let lo = -75, hi = 15;
  for (let i = 0; i < 22; i++) {
    const a = (lo + hi) / 2;
    const f = fly2(from.y, Math.cos(a * deg) * v, Math.sin(a * deg) * v, rn);
    const r = f.netY !== null && f.netY < NET_H ? -1 : f.r;
    if (r < d) lo = a;
    else hi = a;
  }
  let a = (lo + hi) / 2;
  for (let k = 0; k < 16; k++) {
    const f = fly2(from.y, Math.cos(a * deg) * v, Math.sin(a * deg) * v, rn);
    if (rn < 0 || (f.netY !== null && f.netY >= NET_H + 0.08)) break;
    a += 2;
  }
  return { x: hx * Math.cos(a * deg) * v, y: Math.sin(a * deg) * v, z: hz * Math.cos(a * deg) * v };
}

/** Turns a velocity by up to `yaw` / `pitch` radians and scales its speed. */
export function wobble(v: V3, yaw: number, pitch: number, speed: number): V3 {
  const h = Math.hypot(v.x, v.z);
  const sp = Math.hypot(h, v.y) * speed;
  const a = Math.atan2(v.y, h) + pitch;
  const b = Math.atan2(v.x, v.z) + yaw;
  return { x: Math.sin(b) * Math.cos(a) * sp, y: Math.sin(a) * sp, z: Math.cos(b) * Math.cos(a) * sp };
}
