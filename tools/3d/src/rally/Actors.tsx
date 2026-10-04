// Everything that moves: the head (the site's own head as a billboard, with a
// fist and a racket), the shuttle (cork leads, a shadow and a short trail),
// the aim ring on the far court, and your racket in your hand.
import { useGLTF, useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  type Material,
  type Object3D,
  type Texture
} from 'three';
import { FOE_H, FOE_HAND, FOE_W, REACH_F, REACH_R, type Rally, type SwingKind } from './engine';
import type { Palette } from './Court';

const deg = Math.PI / 180;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
const easeIn = (t: number) => t * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t));

export const FACES = ['neutral', 'blink', 'happy', 'sad', 'angry'] as const;
export const FACE_SRC: Record<string, string> = {
  neutral: '/media/head.webp',
  blink: '/media/head-blink.webp',
  happy: '/media/head-happy.webp',
  sad: '/media/head-sad.webp',
  angry: '/media/head-angry.webp'
};
const FIST = '/media/hands/fist.webp';

/** A soft round blob, for shadows. */
function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d')!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new CanvasTexture(c);
}

/** Clones a racket model with its own materials, string beds blended like the viewer's. */
export function useRacketModel(url: string) {
  const gltf = useGLTF(url, false, true);
  const r = useMemo(() => {
    const object = gltf.scene.clone(true);
    const mats: Material[] = [];
    object.traverse((o: Object3D) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      m.raycast = () => {};
      m.frustumCulled = false;
      const mat = (m.material as MeshStandardMaterial).clone();
      if (mat.alphaTest > 0) {
        mat.alphaTest = 0;
        mat.transparent = true;
        mat.depthWrite = false;
        mat.color.setScalar(0.85);
      }
      m.material = mat;
      mats.push(mat);
    });
    return { object, mats };
  }, [gltf]);
  useEffect(() => () => r.mats.forEach((m) => m.dispose()), [r]);
  return r.object;
}

// ---- The head ----------------------------------------------------------------------
// Racket angles for a player facing right, mirrored for the head: wind-up,
// contact, follow-through around c, the angle to where it meets the shuttle.
const ARC: Record<SwingKind, [number, number]> = { over: [90, -110], side: [170, -70], under: [-90, 100] };
const C0: Record<SwingKind, number> = { over: 80, side: 0, under: -40 };
const SW_T = 0.3;
function racketAngle(g: Rally, ready: number) {
  const sw = g.foe.swing;
  if (!sw) return ready;
  const t = (g.gt - sw.t0) / SW_T;
  if (t < 0 || t >= 1.3) return ready;
  const b = sw.c == null ? C0[sw.kind] : sw.c;
  const a = b + ARC[sw.kind][0], c = b + ARC[sw.kind][1];
  if (t < 0.25) return lerp(ready, a, easeOut(t / 0.25));
  if (t < 0.5) return lerp(a, b, easeInOut((t - 0.25) / 0.25));
  if (t < 0.8) return lerp(b, c, easeOut((t - 0.5) / 0.3));
  const r2 = ready + 360 * Math.round((c - ready) / 360);
  return lerp(c, r2, easeInOut((t - 0.8) / 0.5));
}
const SQUISH = [[0, 1, 1], [0.3, 1.1, 0.9], [0.65, 0.95, 1.06], [1, 1, 1]];

export function Head({ g, model, p }: { g: Rally; model: string; p: Palette }) {
  const faces = useTexture(FACES.map((f) => FACE_SRC[f]));
  const fist = useTexture(FIST);
  const racket = useRacketModel(model);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const face = useRef<Mesh>(null);
  const hand = useRef<Group>(null);
  const shadow = useRef<Mesh>(null);
  const { camera } = useThree();
  const r = useMemo(() => {
    [...faces, fist].forEach((t: Texture) => {
      t.colorSpace = SRGBColorSpace;
      t.anisotropy = 4;
    });
    const faceMat = new MeshBasicMaterial({ map: faces[0], transparent: true, alphaTest: 0.04, toneMapped: false, side: DoubleSide });
    const fistMat = new MeshBasicMaterial({ map: fist, transparent: true, alphaTest: 0.04, toneMapped: false, side: DoubleSide });
    const blob = blobTexture();
    const shadowMat = new MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, color: '#000', opacity: p.shadow });
    return { faceMat, fistMat, blob, shadowMat, faceGeo: new PlaneGeometry(FOE_W, FOE_H), fistGeo: new PlaneGeometry(0.3, 0.4), shadowGeo: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2) };
  }, [faces, fist, p.shadow]);
  useEffect(
    () => () => {
      r.faceMat.dispose();
      r.fistMat.dispose();
      r.blob.dispose();
      r.shadowMat.dispose();
      r.faceGeo.dispose();
      r.fistGeo.dispose();
      r.shadowGeo.dispose();
    },
    [r]
  );
  useFrame(() => {
    const grp = root.current, b = body.current, h = hand.current;
    if (!grp || !b || !h) return;
    const f = g.foe;
    grp.visible = f.shown;
    const y = g.foeY();
    grp.position.set(f.x, 0, f.z);
    // Turn to face you (around the vertical only).
    grp.rotation.y = Math.atan2(camera.position.x - f.x, camera.position.z - f.z);
    b.position.y = y;
    let sx = 1, sy = 1;
    const q = (g.gt - f.sqAt) / 0.36;
    if (!g.o.reduce && q >= 0 && q < 1) {
      for (let i = 1; i < SQUISH.length; i++) {
        const [t1, x1, y1] = SQUISH[i];
        const [t0, x0, y0] = SQUISH[i - 1];
        if (q <= t1) {
          const u = (q - t0) / (t1 - t0);
          sx = lerp(x0, x1, u);
          sy = lerp(y0, y1, u);
          break;
        }
      }
    }
    face.current!.scale.set(sx, sy, 1);
    face.current!.position.y = -FOE_H / 2 + (FOE_H / 2) * sy;
    b.rotation.z = g.o.reduce ? 0 : clamp(f.vx * 0.035, -0.16, 0.16);
    const name = g.curFace();
    const i = Math.max(0, FACES.indexOf(name as (typeof FACES)[number]));
    if (r.faceMat.map !== faces[i]) r.faceMat.map = faces[i];
    // The racket, in the head's picture plane: mirrored angles from the hand.
    const ready = g.phase === 'serve' && g.sh.held === 'foe' ? 250 : 58;
    const fs = f.swing;
    if (fs && fs.pt) {
      // Point the swing at where it'll meet the shuttle, as the swing comes round.
      const hx = f.x + FOE_HAND.x, hy = y + FOE_HAND.y;
      const c = Math.atan2(fs.pt.y - hy, hx - fs.pt.x) / deg;
      fs.c = fitHead(fs.kind, c);
    }
    const th = (180 - racketAngle(g, ready)) * deg;
    h.rotation.z = th - Math.PI / 2;
    const s = shadow.current!;
    const k = 1 - clamp((y - 1.2) / 3, 0, 0.5);
    s.scale.setScalar(FOE_W * 0.75 * k);
    r.shadowMat.opacity = p.shadow * 0.7 * k;
  });
  return (
    <group ref={root} visible={false}>
      <mesh ref={shadow} geometry={r.shadowGeo} material={r.shadowMat} position-y={0.004} renderOrder={1} />
      <group ref={body}>
        <mesh ref={face} geometry={r.faceGeo} material={r.faceMat} renderOrder={4} />
        <group ref={hand} position={[FOE_HAND.x, FOE_HAND.y, FOE_HAND.z]}>
          <group scale={1.8} position-y={-0.1}>
            <primitive object={racket} />
          </group>
          <mesh geometry={r.fistGeo} material={r.fistMat} position={[0, 0.02, 0.03]} renderOrder={5} />
        </group>
      </group>
    </group>
  );
}

function fitHead(kind: SwingKind, c: number) {
  c = ((c + 540) % 360) - 180;
  if (kind === 'over') return clamp(c, 20, 165);
  if (kind === 'under') return c > 90 ? -170 : clamp(c, -170, -10);
  return clamp(c, -60, 60);
}

// ---- The shuttle ----------------------------------------------------------------------
function featherTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 32;
  const x = c.getContext('2d')!;
  x.fillStyle = '#ffffff';
  x.fillRect(0, 0, 128, 32);
  x.strokeStyle = 'rgba(120,120,120,0.55)';
  x.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    const px = (i + 0.5) * 8;
    x.beginPath();
    x.moveTo(px, 0);
    x.lineTo(px, 32);
    x.stroke();
  }
  // The thread band.
  x.fillStyle = 'rgba(80,80,80,0.5)';
  x.fillRect(0, 10, 128, 2);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

const TRAIL = 26;
const _v = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _q = new Quaternion();
const UP = new Vector3(0, 1, 0);

export function Shuttle({ g, p, dark }: { g: Rally; p: Palette; dark: boolean }) {
  const grp = useRef<Group>(null);
  const shadow = useRef<Mesh>(null);
  const trail = useRef<Mesh>(null);
  const { camera } = useThree();
  const pts = useRef<number[]>([]);
  const r = useMemo(() => {
    const feather = featherTexture();
    // A touch of glow on a dark page so it never reads as a grey speck.
    const glow = dark ? 0.45 : 0.08;
    const cork = new MeshStandardMaterial({ color: '#f1ede4', roughness: 0.7, emissive: '#f1ede4', emissiveIntensity: glow });
    const skirt = new MeshStandardMaterial({ map: feather, color: '#ffffff', roughness: 0.6, side: DoubleSide, transparent: true, opacity: 0.95, emissive: '#ffffff', emissiveMap: feather, emissiveIntensity: glow });
    const corkGeo = new SphereGeometry(0.0128, 16, 10);
    const capGeo = new CylinderGeometry(0.0128, 0.0128, 0.012, 16, 1, true).translate(0, 0.006, 0);
    const skirtGeo = new CylinderGeometry(0.033, 0.0128, 0.062, 20, 1, true).translate(0, 0.012 + 0.031, 0);
    const blob = blobTexture();
    const shadowMat = new MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, color: '#000', opacity: p.shadow });
    const shadowGeo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const trailGeo = new BufferGeometry();
    trailGeo.setAttribute('position', new BufferAttribute(new Float32Array(TRAIL * 2 * 3), 3));
    trailGeo.setAttribute('color', new BufferAttribute(new Float32Array(TRAIL * 2 * 4), 4));
    const idx: number[] = [];
    for (let i = 0; i < TRAIL - 1; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    trailGeo.setIndex(idx);
    const trailMat = new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: DoubleSide, toneMapped: false });
    return { feather, cork, skirt, corkGeo, capGeo, skirtGeo, blob, shadowMat, shadowGeo, trailGeo, trailMat };
  }, [p.shadow, dark]);
  useEffect(
    () => () => {
      Object.values(r).forEach((x) => (x as { dispose?: () => void }).dispose?.());
    },
    [r]
  );
  const col = useMemo(() => new Color(p.trail), [p.trail]);

  useFrame((_, rawDt) => {
    const s = grp.current;
    if (!s) return;
    const dt = Math.min(rawDt, 1 / 20);
    const sh = g.sh;
    const live = g.phase !== 'intro' && (sh.held !== 'foe' || g.foe.shown);
    s.visible = live;
    shadow.current!.visible = live;
    s.position.set(sh.x, sh.y, sh.z);
    // Cork leads: a stiff spring turning the skirt to trail the flight.
    const d = sh.dir;
    if (sh.held) {
      d.x = 0; d.y = -1; d.z = 0;
    } else if (!sh.down) {
      const sp = Math.hypot(sh.vx, sh.vy, sh.vz);
      if (sp > 0.3) {
        const tx = sh.vx / sp, ty = sh.vy / sp, tz = sh.vz / sp;
        const w = sh.spin;
        if (g.o.reduce || g.paused) {
          if (!g.paused) { d.x = tx; d.y = ty; d.z = tz; }
        } else {
          for (let t = dt; t > 0; t -= 0.004) {
            const h = Math.min(0.004, t);
            w.x += ((tx - d.x) * 900 - w.x * 40) * h;
            w.y += ((ty - d.y) * 900 - w.y * 40) * h;
            w.z += ((tz - d.z) * 900 - w.z * 40) * h;
            d.x += w.x * h;
            d.y += w.y * h;
            d.z += w.z * h;
            const n = Math.hypot(d.x, d.y, d.z) || 1;
            d.x /= n; d.y /= n; d.z /= n;
          }
        }
      }
    }
    // Skirt along -dir.
    _v.set(-d.x, -d.y, -d.z);
    if (sh.down) _v.set(sh.landX > 0 ? 0.6 : -0.6, 0.35, 0).normalize();
    s.quaternion.copy(_q.setFromUnitVectors(UP, _v));
    // Never smaller than a readable size on screen.
    const dist = camera.position.distanceTo(s.position);
    s.scale.setScalar(clamp(dist / 2.3, 1, 4.4));
    if (sh.down) s.position.y = 0.012 * s.scale.x;

    const sd = shadow.current!;
    sd.position.set(sh.x, 0.005, sh.z);
    const k = clamp(sh.y / 8, 0, 1);
    sd.scale.setScalar((0.16 + 0.22 * k) * clamp(dist / 4, 1, 2.4));
    r.shadowMat.opacity = p.shadow * (1 - 0.8 * k) * (sh.held ? 0.6 : 1);

    // Trail: a ribbon through the last few positions, fading out.
    const tr = pts.current;
    const flying = live && !sh.held && !sh.down && g.phase === 'rally';
    if (flying && !g.paused) {
      tr.push(sh.x, sh.y, sh.z);
      if (tr.length > TRAIL * 3) tr.splice(0, 3);
    } else if (tr.length) tr.splice(0, flying ? 0 : 6);
    const n = tr.length / 3;
    const m = trail.current!;
    m.visible = n > 2;
    if (!m.visible) return;
    const pos = r.trailGeo.getAttribute('position') as BufferAttribute;
    const colr = r.trailGeo.getAttribute('color') as BufferAttribute;
    const hard = sh.kind === 'smash' ? 1 : 0.55;
    for (let i = 0; i < TRAIL; i++) {
      const j = Math.min(i, n - 1);
      _a.set(tr[j * 3], tr[j * 3 + 1], tr[j * 3 + 2]);
      const k2 = Math.min(j + 1, n - 1), k0 = Math.max(j - 1, 0);
      _b.set(tr[k2 * 3] - tr[k0 * 3], tr[k2 * 3 + 1] - tr[k0 * 3 + 1], tr[k2 * 3 + 2] - tr[k0 * 3 + 2]);
      _v.copy(camera.position).sub(_a);
      _b.cross(_v).normalize();
      const f = n > 1 ? j / (n - 1) : 0;
      const sc = clamp(camera.position.distanceTo(_a) / 2.3, 0.5, 4.4);
      const w = 0.0075 * sc * f * (sh.kind === 'smash' ? 1.5 : 1);
      pos.setXYZ(i * 2, _a.x + _b.x * w, _a.y + _b.y * w, _a.z + _b.z * w);
      pos.setXYZ(i * 2 + 1, _a.x - _b.x * w, _a.y - _b.y * w, _a.z - _b.z * w);
      const al = i < n ? f * f * 0.42 * hard : 0;
      colr.setXYZW(i * 2, col.r, col.g, col.b, al);
      colr.setXYZW(i * 2 + 1, col.r, col.g, col.b, al);
    }
    pos.needsUpdate = true;
    colr.needsUpdate = true;
    r.trailGeo.computeBoundingSphere();
  });
  return (
    <>
      <group ref={grp}>
        <mesh geometry={r.corkGeo} material={r.cork} />
        <mesh geometry={r.capGeo} material={r.cork} />
        <mesh geometry={r.skirtGeo} material={r.skirt} />
      </group>
      <mesh ref={shadow} geometry={r.shadowGeo} material={r.shadowMat} renderOrder={1} />
      <mesh ref={trail} geometry={r.trailGeo} material={r.trailMat} frustumCulled={false} renderOrder={2} />
    </>
  );
}

// ---- Aim ring and landing marks ---------------------------------------------------------
export function Reticle({ g, accent }: { g: Rally; accent: string }) {
  const ring = useRef<Mesh>(null);
  const marks = useRef<Group>(null);
  const r = useMemo(() => {
    const ringGeo = new RingGeometry(0.27, 0.36, 48).rotateX(-Math.PI / 2);
    const dotGeo = new RingGeometry(0, 0.07, 24).rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ color: accent, transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
    const markGeo = new RingGeometry(0.16, 0.2, 40).rotateX(-Math.PI / 2);
    return { ringGeo, dotGeo, mat, markGeo };
  }, [accent]);
  useEffect(() => () => Object.values(r).forEach((x) => x.dispose()), [r]);
  const pos = useRef({ x: 0, z: -4, a: 0 });
  const live = useRef<{ mesh: Mesh; t0: number; out: boolean }[]>([]);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const m = ring.current;
    if (!m) return;
    const rt = g.reticle;
    const ps = pos.current;
    const k = g.o.reduce ? 1 : 1 - Math.exp(-18 * dt);
    if (rt.on) {
      if (ps.a < 0.02) { ps.x = rt.x; ps.z = rt.z; }
      ps.x += (rt.x - ps.x) * k;
      ps.z += (rt.z - ps.z) * k;
    }
    ps.a += ((rt.on ? 1 : 0) - ps.a) * (g.o.reduce ? 1 : 1 - Math.exp(-10 * dt));
    m.position.set(ps.x, 0.006, ps.z);
    const pulse = g.o.reduce ? 1 : 1 + 0.06 * Math.sin(state.clock.elapsedTime * 6);
    m.scale.setScalar(pulse * (rt.kind === 'smash' ? 1.15 : 1));
    r.mat.opacity = 0.95 * ps.a;
    m.visible = ps.a > 0.01;
    // Landing marks: a ring that opens and fades where it came down.
    const grp = marks.current!;
    while (g.fx.some((f) => f.kind === 'ring')) {
      const i = g.fx.findIndex((f) => f.kind === 'ring');
      const f = g.fx.splice(i, 1)[0] as { x: number; z: number; out: boolean };
      const mat = new MeshBasicMaterial({ color: f.out ? '#bf616a' : accent, transparent: true, depthWrite: false, toneMapped: false });
      const mesh = new Mesh(r.markGeo, mat);
      mesh.position.set(f.x, 0.007, f.z);
      grp.add(mesh);
      live.current.push({ mesh, t0: state.clock.elapsedTime, out: f.out });
    }
    live.current = live.current.filter((l) => {
      const t = (state.clock.elapsedTime - l.t0) / 1.4;
      if (t >= 1) {
        grp.remove(l.mesh);
        (l.mesh.material as Material).dispose();
        return false;
      }
      l.mesh.scale.setScalar(g.o.reduce ? 1.4 : 1 + 1.4 * easeOut(t));
      (l.mesh.material as MeshBasicMaterial).opacity = 0.9 * (1 - t);
      return true;
    });
  });
  useEffect(
    () => () => {
      live.current.forEach((l) => (l.mesh.material as Material).dispose());
      live.current = [];
    },
    []
  );
  return (
    <>
      <mesh ref={ring} geometry={r.ringGeo} material={r.mat} renderOrder={2}>
        <mesh geometry={r.dotGeo} material={r.mat} />
      </mesh>
      <group ref={marks} />
    </>
  );
}

// ---- Where you'll meet it ------------------------------------------------------------------
// A thin ring at the contact point that closes as the shuttle gets there, so
// timing reads even when it drops from straight above.
export function ContactRing({ g }: { g: Rally }) {
  const ring = useRef<Mesh>(null);
  const { camera } = useThree();
  const r = useMemo(() => {
    const geo = new RingGeometry(0.94, 1, 48);
    const mat = new MeshBasicMaterial({ color: '#88c0d0', transparent: true, depthWrite: false, depthTest: false, toneMapped: false, opacity: 0 });
    return { geo, mat };
  }, []);
  useEffect(() => () => { r.geo.dispose(); r.mat.dispose(); }, [r]);
  useFrame(() => {
    const m = ring.current;
    if (!m) return;
    const u = g.untilContact();
    const p = g.me.plan;
    const on = u < 0.75 && u > -0.12 && !!p;
    m.visible = on;
    if (!on || !p) return;
    const k = Math.max(0, u) / 0.75;
    m.position.set(p.p.x, p.p.y, p.p.z);
    m.quaternion.copy(camera.quaternion);
    m.scale.setScalar(0.085 * (1 + 2.2 * k));
    r.mat.opacity = u < 0 ? 0.5 * (1 + u / 0.12) : 0.25 + 0.6 * (1 - k);
  });
  return <mesh ref={ring} geometry={r.geo} material={r.mat} renderOrder={6} visible={false} />;
}

// ---- Your racket ---------------------------------------------------------------------------
// Poses in camera space (x right, y up, z back toward you): where the hand is,
// which way the racket points, and which way its strings face.
interface Pose {
  h: Vector3;
  u: Vector3;
  f: Vector3;
}
const P = (h: number[], u: number[], f: number[]): Pose => ({ h: new Vector3(...h), u: new Vector3(...u).normalize(), f: new Vector3(...f).normalize() });
const REST = P([0.3, -0.4, -0.5], [0.22, 0.6, -0.78], [-0.2, 0.25, 1]);
const SERVE = P([0.32, -0.36, -0.6], [0.35, -0.1, -0.93], [0, 0.5, -1]);
// A tall phone sees less across: hold it nearer the middle.
const REST_TALL = P([0.15, -0.46, -0.5], [0.08, 0.62, -0.78], [-0.2, 0.25, 1]);
const SERVE_TALL = P([0.16, -0.4, -0.6], [0.22, -0.1, -0.97], [0, 0.5, -1]);
const COCK: Record<SwingKind, Pose> = {
  over: P([0.36, -0.06, -0.14], [0.35, 0.4, 0.85], [1, 0, 0]),
  side: P([0.5, -0.3, -0.26], [0.9, 0.22, 0.35], [-0.3, 0, -1]),
  under: P([0.38, -0.56, -0.3], [0.4, -0.76, 0.5], [0, 0.3, -1])
};
const FOLLOW: Record<SwingKind, Pose> = {
  over: P([-0.08, -0.5, -0.45], [-0.55, -0.55, -0.6], [0, -0.3, -1]),
  side: P([-0.24, -0.32, -0.45], [-0.9, 0.15, -0.4], [0.3, 0, -1]),
  under: P([-0.04, -0.12, -0.5], [-0.3, 0.85, -0.45], [0, 0.5, -1])
};
const SHOULDER = new Vector3(0.18, -0.26, 0);
const _m = new Matrix4();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();
function orient(q: Quaternion, u: Vector3, f: Vector3) {
  _y.copy(u).normalize();
  _z.copy(f).addScaledVector(_y, -f.dot(_y));
  if (_z.lengthSq() < 1e-6) _z.set(0, 0, 1).addScaledVector(_y, -_y.z);
  _z.normalize();
  _x.crossVectors(_y, _z);
  return q.setFromRotationMatrix(_m.makeBasis(_x, _y, _z));
}

export function HandRacket({ g, model }: { g: Rally; model: string }) {
  const racket = useRacketModel(model);
  const grp = useRef<Group>(null);
  const { camera, size } = useThree();
  const st = useMemo(
    () => ({
      h: REST.h.clone(),
      q: orient(new Quaternion(), REST.u, REST.f),
      qa: new Quaternion(),
      qb: new Quaternion(),
      ha: new Vector3(),
      hb: new Vector3(),
      contact: { h: new Vector3(), u: new Vector3(), f: new Vector3(0, 0.1, -1) },
      sway: new Vector3()
    }),
    []
  );
  const cam = useMemo(() => new Vector3(), []);
  const inv = useMemo(() => new Matrix4(), []);
  useFrame((_, rawDt) => {
    const o = grp.current;
    if (!o) return;
    const dt = Math.min(rawDt, 1 / 20);
    o.visible = g.phase !== 'intro';
    const sw = g.me.swing;
    const serving = g.phase === 'serve' && g.sh.held === 'me';
    const tall = size.width < size.height;
    const rest = serving ? (tall ? SERVE_TALL : SERVE) : tall ? REST_TALL : REST;
    // Follows the pointer a little.
    st.sway.set(g.aim.x * 0.05, g.aim.y * 0.035, 0);
    let from = rest, to = rest, t = 0;
    const tt = sw ? g.gt - sw.t0 : 9;
    if (sw && tt < 2) {
      const lead = Math.max(0.06, sw.tc - sw.t0);
      // Where the racket meets it, in camera space.
      camera.updateMatrixWorld();
      inv.copy(camera.matrixWorld).invert();
      if (sw.at) cam.set(sw.at.x, sw.at.y, sw.at.z).applyMatrix4(inv);
      else {
        const y = sw.kind === 'over' ? 2.35 : sw.kind === 'side' ? 1.35 : 0.55;
        cam.set(g.me.x + REACH_R, y, g.me.z - REACH_F).applyMatrix4(inv);
      }
      const c = st.contact;
      c.u.copy(cam).sub(SHOULDER).normalize();
      c.h.copy(SHOULDER).addScaledVector(c.u, Math.max(0.2, cam.distanceTo(SHOULDER) - 0.55));
      c.u.copy(cam).sub(c.h).normalize();
      c.f.set(0, sw.kind === 'over' ? -0.2 : 0.1, -1);
      const cock = COCK[sw.kind], follow = FOLLOW[sw.kind];
      const s1 = lead * 0.55;
      if (tt < s1) { from = rest; to = cock; t = easeOut(tt / s1); }
      else if (tt < lead) { from = cock; to = c as Pose; t = easeIn((tt - s1) / (lead - s1)); }
      else if (tt < lead + 0.14) { from = c as Pose; to = follow; t = easeOut((tt - lead) / 0.14); }
      else if (tt < lead + 0.42) { from = follow; to = rest; t = easeInOut((tt - lead - 0.14) / 0.28); }
    }
    st.ha.copy(from.h).lerp(to.h, t);
    orient(st.qa, from.u, from.f);
    orient(st.qb, to.u, to.f);
    st.qa.slerp(st.qb, t);
    // Ease toward the pose so the rest pose glides; the swing itself is direct.
    const k = sw && tt < 0.9 ? 1 : 1 - Math.exp(-14 * dt);
    st.h.lerp(st.ha.add(st.sway), k);
    st.q.slerp(st.qa, k);
    o.position.copy(st.h).applyMatrix4(camera.matrixWorld);
    o.quaternion.copy(camera.quaternion).multiply(st.q);
  });
  return (
    <group ref={grp} visible={false}>
      <primitive object={racket} />
    </group>
  );
}
