// Framing, DOM card placement and lazy loading helpers shared by the pieces.
import { useEffect, useState } from 'react';
import { Vector3, type PerspectiveCamera } from 'three';

export const MODELS = import.meta.env.BASE_URL + 'models/';

const _r = new Vector3();
const _u = new Vector3();
const _f = new Vector3();
const _p = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * Distance along dir (unit, from target toward the camera) at which every
 * point fits inside `fill` of the view, for a camera with this fov and aspect.
 */
export function fitDistance(
  fovDeg: number,
  aspect: number,
  target: Vector3,
  dir: Vector3,
  points: Vector3[],
  fill = 0.86,
  fillY = fill
) {
  const tv = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const th = tv * aspect;
  _f.copy(dir).negate().normalize();
  _r.crossVectors(_f, UP);
  if (_r.lengthSq() < 1e-8) _r.set(1, 0, 0);
  _r.normalize();
  _u.crossVectors(_r, _f);
  let d = 0;
  for (const p of points) {
    _p.copy(p).sub(target);
    const x = Math.abs(_p.dot(_r));
    const y = Math.abs(_p.dot(_u));
    const z = _p.dot(_f);
    d = Math.max(d, x / (th * fill) - z, y / (tv * fillY) - z);
  }
  return d;
}

/**
 * Like fitDistance, but also slides the target (across the view) so the points
 * sit centered in the frame. Returns the distance and the new target.
 */
export function fitCentered(
  fovDeg: number,
  aspect: number,
  target: Vector3,
  dir: Vector3,
  points: Vector3[],
  fill = 0.86,
  fillY = fill
) {
  const t = target.clone();
  const tv = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const th = tv * aspect;
  let d = fitDistance(fovDeg, aspect, t, dir, points, fill, fillY);
  for (let i = 0; i < 4; i++) {
    // Basis of a camera at t + dir * d looking at t.
    _f.copy(dir).negate().normalize();
    _r.crossVectors(_f, UP).normalize();
    _u.crossVectors(_r, _f);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of points) {
      _p.copy(p).sub(t);
      const depth = _p.dot(_f) + d;
      const nx = _p.dot(_r) / (depth * th);
      const ny = _p.dot(_u) / (depth * tv);
      x0 = Math.min(x0, nx); x1 = Math.max(x1, nx);
      y0 = Math.min(y0, ny); y1 = Math.max(y1, ny);
    }
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    if (Math.abs(cx) < 0.002 && Math.abs(cy) < 0.002) break;
    t.addScaledVector(_r, cx * d * th).addScaledVector(_u, cy * d * tv);
    d = fitDistance(fovDeg, aspect, t, dir, points, fill, fillY);
  }
  return { dist: d, target: t };
}

/** The 8 corners of a box. */
export function corners(min: Vector3, max: Vector3): Vector3[] {
  const out: Vector3[] = [];
  for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) out.push(new Vector3(x, y, z));
  return out;
}

const _s = new Vector3();
/** Screen px of a world point for this camera and canvas size. */
export function toScreen(p: Vector3, camera: PerspectiveCamera, w: number, h: number) {
  _s.copy(p).project(camera);
  return { x: ((_s.x + 1) / 2) * w, y: ((1 - _s.y) / 2) * h, behind: _s.z > 1 };
}

/**
 * Puts a card next to an anchor (px inside a w x h stage): to the right, else
 * left, else above or below, always inside the stage. Returns the transform.
 */
export function placeCard(card: HTMLElement, x: number, y: number, w: number, h: number, gap = 18, edge = 10) {
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  let left = x + gap;
  let top = y - ch / 2;
  if (left + cw > w - edge) left = x - gap - cw;
  if (left < edge) {
    left = Math.min(Math.max(x - cw / 2, edge), w - cw - edge);
    top = y - gap - ch;
    if (top < edge) top = y + gap;
  }
  top = Math.min(Math.max(top, edge), h - ch - edge);
  left = Math.min(Math.max(left, edge), Math.max(edge, w - cw - edge));
  card.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Screen rect (px) of a local box seen through obj.matrixWorld. */
export function projectBox(min: Vector3, max: Vector3, matrixWorld: import('three').Matrix4, camera: PerspectiveCamera, w: number, h: number): Rect {
  const r = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
  for (const x of [min.x, max.x])
    for (const y of [min.y, max.y])
      for (const z of [min.z, max.z]) {
        _s.set(x, y, z).applyMatrix4(matrixWorld).project(camera);
        const px = ((_s.x + 1) / 2) * w;
        const py = ((1 - _s.y) / 2) * h;
        r.left = Math.min(r.left, px);
        r.right = Math.max(r.right, px);
        r.top = Math.min(r.top, py);
        r.bottom = Math.max(r.bottom, py);
      }
  return r;
}

/**
 * Puts a card beside a thing's screen rect without covering it: to the right,
 * else the left, else above, else below; kept inside the stage. Falls back to
 * the side with the most room.
 */
export function placeBeside(card: HTMLElement, r: Rect, w: number, h: number, gap = 14, edge = 10) {
  const cw = card.offsetWidth;
  const ch = card.offsetHeight;
  const cy = Math.min(Math.max((r.top + r.bottom) / 2 - ch / 2, edge), h - ch - edge);
  const cx = Math.min(Math.max((r.left + r.right) / 2 - cw / 2, edge), w - cw - edge);
  const options = [
    { ok: r.right + gap + cw <= w - edge, left: r.right + gap, top: cy, room: w - r.right },
    { ok: r.left - gap - cw >= edge, left: r.left - gap - cw, top: cy, room: r.left },
    { ok: r.top - gap - ch >= edge, left: cx, top: r.top - gap - ch, room: r.top },
    { ok: r.bottom + gap + ch <= h - edge, left: cx, top: r.bottom + gap, room: h - r.bottom }
  ];
  const pick = options.find((o) => o.ok) ?? options.slice().sort((a, b) => b.room - a.room)[0];
  const left = Math.min(Math.max(pick.left, edge), Math.max(edge, w - cw - edge));
  const top = Math.min(Math.max(pick.top, edge), Math.max(edge, h - ch - edge));
  card.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
}

/** True once el comes within `margin` of the viewport; stays true. */
export function useNear(el: HTMLElement, margin = '400px') {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (near) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: margin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el, margin, near]);
  return near;
}

/** Toggles .narrow on el while it is narrower than px (cards get compact). */
export function useNarrow(el: HTMLElement, px = 480) {
  useEffect(() => {
    const run = () => el.classList.toggle('narrow', el.clientWidth < px);
    run();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    return () => {
      ro.disconnect();
      el.classList.remove('narrow');
    };
  }, [el, px]);
}

/** fetch JSON, null on any failure or abort. */
export async function loadJson<T>(url: string, signal?: AbortSignal): Promise<T | null> {
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Scrolls an element into view, smooth unless the visitor prefers less motion. */
export function scrollToEl(el: Element | null, block: ScrollLogicalPosition = 'start') {
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block, behavior: reduce ? 'auto' : 'smooth' });
}
