// Camera: fits the globe to the stage, drag to rotate, wheel or pinch to zoom
// (within limits), slow spin when idle, and a smooth turn to face a place.
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { usePageFriendlyGestures } from '../lib/gestures';
import { usePiece } from '../lib/mountCanvas';
import { direction } from './data';
import { GLOBE_SPIN, useGlobe, useGlobeStore } from './store';

export const START = { lat: 28, lng: -40 };
const FILL_WIDE = 0.74; // share of the smaller side the globe spans, landscape
const FILL_TALL = 0.8; // and portrait
const PAD = 14; // px kept clear around the title
const IDLE_MS = 3500;

/** World position of a lat/lng on the globe at radius r. */
export function worldDir(lat: number, lng: number, r = 1): Vector3 {
  return new Vector3(...direction(lat, lng)).applyAxisAngle(new Vector3(0, 1, 0), GLOBE_SPIN).multiplyScalar(r);
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Globe radius and center height (px) for a w x h stage: about three quarters
 * of the smaller side, a little below the middle, pushed down (and if needed
 * shrunk) so it clears the boxes to avoid, like the page title.
 */
export function fitGlobe(w: number, h: number, avoid: Box[]) {
  const r0 = ((w >= h ? FILL_WIDE : FILL_TALL) * Math.min(w, h)) / 2;
  const cx = w / 2;
  const floor = h / 2 + h * 0.025;
  let r = r0;
  let cy = floor;
  for (let i = 0; i < 12; i++) {
    cy = floor;
    for (const b of avoid) {
      if (b.bottom <= 0 || b.top >= h) continue;
      const dx = Math.max(b.left - PAD - cx, 0, cx - (b.right + PAD));
      if (dx >= r) continue;
      cy = Math.max(cy, b.bottom + PAD + Math.sqrt(r * r - dx * dx));
      // A title right across the top (phones): center in the space below it.
      if (dx === 0) cy = Math.max(cy, (b.bottom + h) / 2);
    }
    if (cy + r <= h - 12 || r < r0 * 0.6) break;
    r *= 0.95;
  }
  cy = Math.min(cy, Math.max(h / 2, h - r - 12));
  return { r, cy };
}

/** Camera distance that shows a unit globe at radius rPx on a stage hPx tall. */
function distanceFor(rPx: number, hPx: number, fovDeg: number) {
  const t = Math.tan(((fovDeg / 2) * Math.PI) / 180);
  const k = hPx / 2 / (rPx * t);
  return Math.sqrt(1 + k * k);
}

/** Boxes (relative to el) the globe should stay clear of: el.dataset.avoid, default the page title. */
function avoidBoxes(el: HTMLElement): Box[] {
  const base = el.getBoundingClientRect();
  const sel = el.dataset.avoid || 'main > .header';
  return [...document.querySelectorAll<HTMLElement>(sel)]
    .filter((n) => !el.contains(n))
    .map((n) => n.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ left: r.left - base.left, top: r.top - base.top, right: r.right - base.left, bottom: r.bottom - base.top }));
}

export function Rig() {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const { reducedMotion, el } = usePiece();
  const store = useGlobeStore();
  const busy = useGlobe((s) => !!(s.selected || s.hovered || s.pinned));
  const faceTick = useGlobe((s) => s.faceTick);
  const idleAt = useRef(0);
  const dragging = useRef(false);
  const fit = useRef({ base: 5.2, cy: 0, prevBase: 0 });
  const anim = useRef<{ from: Vector3; to: Vector3; d0: number; d1: number; t: number } | null>(null);
  const v = useMemo(() => new Vector3(), []);

  // Fit to the stage now, on resize, and when the title reflows.
  useEffect(() => {
    const cam = camera as PerspectiveCamera;
    const run = () => {
      const { r, cy } = fitGlobe(size.width, size.height, avoidBoxes(el));
      fit.current.base = distanceFor(r, size.height, cam.fov);
      fit.current.cy = cy;
    };
    run();
    const ro = new ResizeObserver(run);
    document.querySelectorAll(el.dataset.avoid || 'main > .header').forEach((n) => ro.observe(n));
    document.fonts?.ready.then(run).catch(() => {});
    return () => ro.disconnect();
  }, [camera, size.width, size.height, el]);

  // Start facing the Atlantic, northern hemisphere up.
  useEffect(() => {
    camera.position.copy(worldDir(START.lat, START.lng, fit.current.base));
    fit.current.prevBase = fit.current.base;
    camera.lookAt(0, 0, 0);
    controls.current?.update();
  }, [camera]);

  // Turn to a place: keyboard focus turns, opening also zooms in a little.
  useEffect(() => {
    const { face, places, selected: open } = store.get();
    const p = face ? places.find((x) => x.id === face) : null;
    if (!p) return;
    const from = camera.position.clone();
    const d0 = from.length();
    const d1 = open ? Math.min(d0, fit.current.base * 0.92) : d0;
    anim.current = { from: from.normalize(), to: worldDir(p.lat, p.lng).normalize(), d0, d1, t: reducedMotion ? 1 : 0 };
  }, [faceTick, camera, store, reducedMotion]);

  usePageFriendlyGestures();

  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    const f = fit.current;
    // Keep the visitor's zoom when the fit changes.
    if (f.prevBase && Math.abs(f.base - f.prevBase) > 1e-3) {
      camera.position.multiplyScalar(f.base / f.prevBase);
      if (anim.current) {
        anim.current.d0 *= f.base / f.prevBase;
        anim.current.d1 *= f.base / f.prevBase;
      }
    }
    f.prevBase = f.base;
    c.minDistance = f.base * 0.55;
    c.maxDistance = f.base * 1.4;

    const a = anim.current;
    if (a) {
      a.t = Math.min(1, a.t + dt / 1.2);
      const k = ease(a.t);
      const angle = a.from.angleTo(a.to);
      if (angle < 1e-4) v.copy(a.to);
      else {
        const s = Math.sin(angle);
        v.copy(a.from)
          .multiplyScalar(Math.sin((1 - k) * angle) / s)
          .addScaledVector(a.to, Math.sin(k * angle) / s);
      }
      camera.position.copy(v.normalize().multiplyScalar(a.d0 + (a.d1 - a.d0) * k));
      c.update();
      if (a.t >= 1) anim.current = null;
    }
    const idle = !dragging.current && performance.now() - idleAt.current > IDLE_MS;
    c.autoRotate = !reducedMotion && !busy && !a && idle;

    // Center the globe at the fitted height.
    const cam = camera as PerspectiveCamera;
    const dy = f.cy - size.height / 2;
    if (Math.abs(dy) > 0.5) cam.setViewOffset(size.width, size.height, 0, -dy, size.width, size.height);
    else if (cam.view?.enabled) cam.clearViewOffset();
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.06}
      rotateSpeed={0.55}
      zoomSpeed={0.5}
      autoRotateSpeed={0.35}
      onStart={() => {
        dragging.current = true;
        anim.current = null;
      }}
      onEnd={() => {
        dragging.current = false;
        idleAt.current = performance.now();
      }}
    />
  );
}
