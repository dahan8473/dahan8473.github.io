// David's red Fairtex gloves hanging off the top edge of the Muay Thai card by
// their lace. They sway a little on their own (pendulum with damping, a slow
// breeze and the odd nudge), swing more while the pointer is on them, and get
// pushed by a pointer moving past. A click or tap on them throws a punch and
// starts the spar on /hobbies/muay-thai/. The canvas never takes pointer events
// itself (so the card and the page above stay clickable); hits are tested
// against an ellipsoid around each glove.
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  Box3,
  Matrix4,
  Raycaster,
  Vector2,
  Vector3,
  type DirectionalLight,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Ray
} from 'three';
import { usePiece } from '../lib/mountCanvas';
import { createStore, type Store } from '../lib/store';
import { Studio } from '../lib/studio';
import { MODELS } from '../lib/view';
import { BOX, BOX_H, CARD_LEFT, CARD_RIGHT, EDGE_DROP, HANG, VIEW_H } from './layout';

export const GLOVES_FILE = MODELS + 'gloves.glb';
export const SPAR_PAGE = '/hobbies/muay-thai/';
export const SPAR_FLAG = 'dl-spar-now';

export type Rect = { l: number; t: number; w: number; h: number };

/** Shared by the scene and the keyboard button. */
export interface Ctl {
  spar: (() => void) | null;
  /** Keyboard focus on the button swings the gloves like a hover. */
  focus: (on: boolean) => void;
  /** Where the button goes, in fractions of the canvas (null: hidden, nothing loaded yet). */
  ui: Store<{ rect: Rect | null }>;
}

export function createCtl(): Ctl {
  return { spar: null, focus: () => {}, ui: createStore<{ rect: Rect | null }>({ rect: null }) };
}

// Pendulums (rad, s). The pair swings about the hang point, each glove about its
// knot, and each glove twists a little on the lace.
const W0 = 5.4; // pair, about the hang point
const Z0 = 0.07;
const W1 = 6.8; // a glove about its knot
const Z1 = 0.09;
const W2 = 2.6; // twist on the lace
const Z2 = 0.12;
const LAG = 0.55; // how much a glove lags the pair's swing
const IDLE = 0.02; // idle swing, rad
const HOVER = 0.085; // swing while hovered
const PUNCH_MS = 300;

interface Swing {
  a: number;
  v: number;
}
interface Glove {
  node: Object3D;
  phi: Swing; // in the card's plane
  psi: Swing; // twist
  hull: { c: Vector3; r: Vector3 };
  side: number;
}

export function GlovesScene({ ctl }: { ctl: Ctl }) {
  const { dark } = usePiece();
  return (
    <>
      <Studio dark={dark} />
      <Key dark={dark} />
      <Card dark={dark} />
      <Gloves ctl={ctl} />
    </>
  );
}

/** Soft key from the upper left, in front: the drop shadow falls down and right onto the card. */
function Key({ dark }: { dark: boolean }) {
  const ref = useRef<DirectionalLight>(null);
  useEffect(() => {
    const l = ref.current;
    if (!l) return;
    const c = l.shadow.camera;
    c.left = -0.42;
    c.right = 0.42;
    c.top = 0.42;
    c.bottom = -0.42;
    c.near = 0.2;
    c.far = 3;
    c.updateProjectionMatrix();
  }, []);
  return (
    <directionalLight
      ref={ref}
      position={[-0.45, 0.7, 1.0]}
      intensity={dark ? 1.5 : 1.6}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.002}
      shadow-radius={9}
      shadow-blurSamples={16}
    />
  );
}

/**
 * The card plane (z = 0, its top edge at y = 0): a shadow catcher over the
 * photo, and a depth-only patch that hides the lace's tail going down the back.
 */
function Card({ dark }: { dark: boolean }) {
  const { size } = useThree();
  const aspect = size.width / Math.max(1, size.height) || BOX.width / BOX_H;
  const viewW = VIEW_H * aspect;
  const x0 = (CARD_LEFT - HANG.x) * viewW;
  const x1 = (CARD_RIGHT - HANG.x) * viewW;
  const y1 = -VIEW_H * (1 - HANG.y);
  return (
    <>
      <mesh position={[(x0 + x1) / 2, y1 / 2, -0.001]} receiveShadow renderOrder={1}>
        <planeGeometry args={[x1 - x0, -y1]} />
        <shadowMaterial transparent opacity={dark ? 0.6 : 0.42} depthWrite={false} />
      </mesh>
      <mesh position={[0, -0.024, 0]} renderOrder={-1}>
        <planeGeometry args={[0.05, 0.048]} />
        <meshBasicMaterial colorWrite={false} />
      </mesh>
    </>
  );
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

function Gloves({ ctl }: { ctl: Ctl }) {
  const gltf = useGLTF(GLOVES_FILE, false, true);
  const { reducedMotion, root } = usePiece();
  const { camera, gl, size } = useThree();

  const built = useMemo(() => {
    const object = gltf.scene.clone(true);
    object.position.y = EDGE_DROP;
    const made: Material[] = [];
    object.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.castShadow = true;
      m.receiveShadow = true;
      m.raycast = () => {};
      const fix = (mat: Material) => {
        const c = mat.clone() as MeshStandardMaterial;
        made.push(c);
        if (c.name === 'gloves_decal') {
          c.polygonOffset = true;
          c.polygonOffsetFactor = -2;
          c.polygonOffsetUnits = -2;
          m.castShadow = false;
        }
        if (c.name === 'gloves_leather') c.envMapIntensity = 0.62;
        return c;
      };
      m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
    });
    const pair = object.getObjectByName('gloves') ?? object;
    object.updateMatrixWorld(true);
    const gloves: Glove[] = [];
    for (const [name, side] of [
      ['glove_l', -1],
      ['glove_r', 1]
    ] as const) {
      const node = object.getObjectByName(name);
      if (!node) continue;
      // hull: the glove's box in the knot's frame, as an ellipsoid
      const box = new Box3();
      const inv = new Matrix4().copy(node.matrixWorld).invert();
      node.traverse((o) => {
        const m = o as Mesh;
        if (!m.isMesh) return;
        m.geometry.computeBoundingBox();
        const b = m.geometry.boundingBox!.clone().applyMatrix4(new Matrix4().multiplyMatrices(inv, m.matrixWorld));
        box.union(b);
      });
      const c = box.getCenter(new Vector3());
      const r = box.getSize(new Vector3()).multiplyScalar(0.5 * 1.04);
      gloves.push({ node, phi: { a: 0, v: 0 }, psi: { a: 0, v: 0 }, hull: { c, r }, side });
    }
    return { object, pair, gloves, made };
  }, [gltf]);

  useEffect(() => () => built.made.forEach((m) => m.dispose()), [built]);

  // ---- motion state
  const st = useRef({
    th: { a: 0, v: 0 } as Swing,
    t: Math.random() * 10,
    kick: 1.2,
    hover: false,
    focus: false,
    punchAt: -1,
    busy: false,
    lastX: NaN,
    lastY: NaN,
    lastT: 0,
    mouse: false,
    touch: false,
    recheck: null as null | (() => void),
    since: 0
  });

  // ---- hit testing (window listeners; the canvas itself stays pointer-events: none)
  const tools = useMemo(() => ({ ray: new Raycaster(), ndc: new Vector2(), o: new Vector3(), d: new Vector3(), r: new Vector3(), inv: new Matrix4() }), []);
  // grow: fingers get a bigger target than the mouse (on a phone each glove is ~25px wide)
  const hitAt = (cx: number, cy: number, grow = 1) => {
    const r = gl.domElement.getBoundingClientRect();
    if (!r.width || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false;
    tools.ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    tools.ray.setFromCamera(tools.ndc, camera);
    return built.gloves.some((g) => hullHit(g, tools.ray.ray, grow));
  };
  const hullHit = (g: Glove, ray: Ray, grow = 1) => {
    const { o, d, r, inv } = tools;
    inv.copy(g.node.matrixWorld).invert();
    r.copy(g.hull.r).multiplyScalar(grow);
    o.copy(ray.origin).applyMatrix4(inv).sub(g.hull.c).divide(r);
    d.copy(ray.direction).transformDirection(inv).divide(r);
    const a = d.dot(d);
    const b = 2 * o.dot(d);
    const c = o.dot(o) - 1;
    const disc = b * b - 4 * a * c;
    return disc >= 0 && (-b + Math.sqrt(disc)) / (2 * a) >= 0;
  };

  // ---- the spar: punch, then over to the ring
  useEffect(() => {
    let timer = 0;
    const go = () => {
      timer = 0;
      const w = window as unknown as { dlGo?: (href: string) => unknown };
      if (typeof w.dlGo === 'function') w.dlGo(SPAR_PAGE);
      else location.href = SPAR_PAGE;
    };
    ctl.spar = () => {
      const s = st.current;
      if (s.busy) return;
      s.busy = true;
      try {
        sessionStorage.setItem(SPAR_FLAG, '1');
      } catch {}
      if (reducedMotion) return go();
      s.punchAt = performance.now();
      s.th.v += 0.5;
      built.gloves.forEach((g) => (g.psi.v += 0.8 * g.side));
      timer = window.setTimeout(go, PUNCH_MS);
    };
    ctl.focus = (on) => {
      st.current.focus = on;
      if (on) st.current.th.v += 0.12;
    };
    return () => {
      ctl.spar = null;
      ctl.focus = () => {};
      if (timer) {
        // torn down mid-punch (another page swap won): no fight waiting on the next visit
        clearTimeout(timer);
        try {
          sessionStorage.removeItem(SPAR_FLAG);
        } catch {}
      }
    };
  }, [ctl, built, reducedMotion]);

  useEffect(() => {
    const s = st.current;
    const setHover = (on: boolean, push: number) => {
      if (s.hover === on) return;
      s.hover = on;
      root.classList.toggle('hot', on);
      if (on && !reducedMotion) s.th.v += 0.16 * (push || 1);
    };
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      const dx = Number.isNaN(s.lastX) ? 0 : e.clientX - s.lastX;
      s.lastX = e.clientX;
      s.lastY = e.clientY;
      s.lastT = now;
      s.mouse = e.pointerType !== 'touch';
      const hit = hitAt(e.clientX, e.clientY);
      setHover(hit && s.mouse, Math.sign(dx));
      if (reducedMotion || !dx) return;
      // a pointer brushing past pushes them along
      const r = gl.domElement.getBoundingClientRect();
      const near = pushNear(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      if (near > 0) {
        const k = Math.max(-0.07, Math.min(0.07, dx * 0.0035)) * near;
        s.th.v += k;
        built.gloves.forEach((g) => {
          g.psi.v += k * 1.2 * g.side;
          g.phi.v += k * 0.8;
        });
      }
    };
    // How close a point (canvas px) is to the gloves: 1 on them, fading to 0 a little way off.
    const c = new Vector3();
    const pushNear = (x: number, y: number, w: number, h: number) => {
      let best = 0;
      for (const g of built.gloves) {
        c.copy(g.hull.c).applyMatrix4(g.node.matrixWorld).project(camera);
        const gx = (c.x * 0.5 + 0.5) * w;
        const gy = (-c.y * 0.5 + 0.5) * h;
        const rad = (g.hull.r.x + g.hull.r.y) * 0.5 * (h / VIEW_H);
        const d = Math.hypot(x - gx, y - gy);
        best = Math.max(best, 1 - Math.max(0, d - rad) / (rad * 0.8));
      }
      return Math.max(0, best);
    };
    const onLeave = () => {
      s.mouse = false;
      setHover(false, 0);
    };
    // the gloves swing (and the page scrolls) under a still pointer: keep the hover honest
    s.recheck = () => setHover(s.mouse && hitAt(s.lastX, s.lastY), 0);
    // a tap's click isn't a PointerEvent everywhere (Safari): remember what pressed
    const onDown = (e: PointerEvent) => {
      s.touch = e.pointerType !== 'mouse';
    };
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const type = (e as PointerEvent).pointerType;
      const touch = type ? type !== 'mouse' : s.touch;
      if (!hitAt(e.clientX, e.clientY, touch ? 1.35 : 1)) return;
      e.preventDefault();
      e.stopPropagation();
      ctl.spar?.();
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('blur', onLeave);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown, { capture: true });
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('blur', onLeave);
      window.removeEventListener('click', onClick, true);
      root.classList.remove('hot');
      s.recheck = null;
    };
  }, [built, camera, gl, root, ctl, reducedMotion]);

  // ---- keyboard button over the gloves, placed from their hulls at rest
  useEffect(() => {
    const place = (rect: Rect | null) => ctl.ui.set({ rect });
    built.object.updateMatrixWorld(true);
    let x0 = 1,
      y0 = 1,
      x1 = 0,
      y1 = 0;
    const p = new Vector3();
    for (const g of built.gloves) {
      for (let i = 0; i < 8; i++) {
        p.set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1)
          .multiply(g.hull.r)
          .multiplyScalar(0.85)
          .add(g.hull.c)
          .applyMatrix4(g.node.matrixWorld)
          .project(camera);
        const sx = p.x * 0.5 + 0.5;
        const sy = -p.y * 0.5 + 0.5;
        x0 = Math.min(x0, sx);
        x1 = Math.max(x1, sx);
        y0 = Math.min(y0, sy);
        y1 = Math.max(y1, sy);
      }
    }
    place({ l: x0, t: y0, w: x1 - x0, h: y1 - y0 });
    return () => place(null);
  }, [built, camera, size.width, size.height, ctl]);

  // ---- the swing
  useFrame((_, dtRaw) => {
    const s = st.current;
    const { pair, gloves } = built;
    s.since += dtRaw;
    if (s.mouse && s.since > 0.12) {
      s.since = 0;
      s.recheck?.();
    }
    if (reducedMotion) {
      pair.rotation.set(0, 0, 0);
      gloves.forEach((g) => g.node.rotation.set(0, 0, 0));
      return;
    }
    const dt = Math.min(dtRaw, 1 / 30);
    const n = Math.max(1, Math.ceil(dt / (1 / 240)));
    const h = dt / n;
    const target = s.hover || s.focus ? HOVER : IDLE;
    for (let i = 0; i < n; i++) {
      const th = s.th;
      // breeze: slow and uneven
      const breeze = 0.16 * Math.sin(s.t * 0.61) + 0.09 * Math.sin(s.t * 1.73 + 1.3) + 0.05 * Math.sin(s.t * 3.1 + 0.4);
      // keep the swing near its target size: pump in phase with the motion, or bleed it off
      const amp = Math.hypot(th.a, th.v / W0);
      const pump = amp < target ? 1.4 * W0 * (target - amp) * Math.sign(th.v || 1) : -0.6 * (amp - target) * th.v * (s.hover ? 1 : 0.3);
      const acc = -W0 * W0 * Math.sin(th.a) - 2 * Z0 * W0 * th.v + breeze * (s.hover ? 0.4 : 1) + pump;
      th.v += acc * h;
      th.a += th.v * h;
      for (const g of gloves) {
        const pa = -W1 * W1 * g.phi.a - 2 * Z1 * W1 * g.phi.v - LAG * acc;
        g.phi.v += pa * h;
        g.phi.a += g.phi.v * h;
        const ta = -W2 * W2 * g.psi.a - 2 * Z2 * W2 * g.psi.v + 0.12 * Math.sin(s.t * 0.9 + g.side * 2.1);
        g.psi.v += ta * h;
        g.psi.a += g.psi.v * h;
        g.psi.a = Math.max(-0.26, Math.min(0.26, g.psi.a));
      }
      s.t += h;
    }
    // the odd nudge so the idle sway never looks like a loop
    if (s.t > s.kick) {
      s.kick = s.t + 2.2 + Math.random() * 3.5;
      s.th.v += (Math.random() - 0.5) * 0.1;
      gloves.forEach((g) => (g.psi.v += (Math.random() - 0.5) * 0.25));
    }
    pair.rotation.z = Math.max(-0.5, Math.min(0.5, s.th.a));
    for (const g of gloves) g.node.rotation.set(0, g.psi.a, g.phi.a);
    // the punch: the front glove swings up at you
    if (s.punchAt >= 0) {
      const p = (performance.now() - s.punchAt) / PUNCH_MS;
      const front = gloves.find((g) => g.side > 0);
      const back = gloves.find((g) => g.side < 0);
      if (front) {
        front.node.rotation.x = -1.15 * easeOut(p * 1.25);
      }
      if (back) back.node.rotation.x = -0.25 * easeOut(p);
    }
  });

  return <primitive object={built.object} />;
}
