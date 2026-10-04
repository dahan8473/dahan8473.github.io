// Four rackets fanned like a hand of cards: each one's own traced model when
// rackets.json names one, else the generic racket in its own frame color. Hover
// slides one out with an accent rim and a card; they sway a little at rest.
//
// Click (tap, or Enter on the keyboard list) zooms in: the camera flies in to
// that racket, which comes up out of the fan, stands upright and slowly turns
// (drag to turn it yourself), while the others sink back and fade. The specs
// card sits beside it (Overlay). Zooming out flies back to the fan.
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Euler, Group, Mesh, Quaternion, Vector3, type MeshStandardMaterial, type PerspectiveCamera } from 'three';
import { usePiece } from '../lib/mountCanvas';
import { OrbitRig, type Home } from '../lib/rig';
import { applyRim, damp, Glow, makeRim, Studio } from '../lib/studio';
import { corners, fitCentered, MODELS, projectBox, useNear } from '../lib/view';
import { colorOf, COUNT, modelOf, useRacket, useRacketStore } from './store';

export const RACKET_FILE = MODELS + 'racket.glb';

const STEP = 0.36; // radians between rackets
const DROP = 0.07; // the fan's pivot sits this far below the butts
const SLIDE = 0.04; // how far a hovered racket slides out
const LEAN = -0.1; // the fan leans back a touch
const POLAR = 1.42;
const LEN = 0.675; // a racket, butt to tip
const FLY = 0.8; // seconds to fly in or out
const Y_AXIS = new Vector3(0, 1, 0);

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function RacketScene() {
  const { dark, el } = usePiece();
  const near = useNear(el);
  const listed = useRacket((s) => s.listed);
  return (
    <>
      <Studio dark={dark} />
      {/* A soft light on the backdrop so dark frames still read on a dark page. */}
      {dark && <Glow position={[0, 0.46, -0.3]} radius={0.58} color="#9aa4b0" opacity={0.1} />}
      {near && listed && <Fan />}
      <Asleep />
    </>
  );
}

/** While the rally is up over the page, draw nothing here. */
function Asleep() {
  const store = useRacketStore();
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    scene.visible = !store.get().playing;
  }, -10);
  return null;
}

function Fan() {
  const store = useRacketStore();
  const rackets = useRacket((s) => s.rackets);
  const focus = useRacket((s) => s.focus);
  const files = useMemo(() => Array.from({ length: COUNT }, (_, i) => modelOf(rackets, i, RACKET_FILE)), [rackets]);
  const gltfs = useGLTF(files, false, true);
  const { reducedMotion, root } = usePiece();
  const { camera, size, gl } = useThree();
  const fan = useRef<Group>(null);
  const anchors = useRef<(Group | null)[]>([]);
  const arms = useRef<(Group | null)[]>([]);
  const holders = useRef<(Group | null)[]>([]);
  const hits = useRef<Mesh[][]>(Array.from({ length: COUNT }, () => []));
  const [home, setHome] = useState<Home | null>(null);
  const [orbit, setOrbit] = useState(true);

  const built = useMemo(
    () =>
      gltfs.map((gltf) => {
        const object = gltf.scene.clone(true);
        const rim = makeRim();
        const mats = applyRim(object, rim);
        const frame = mats.find((m) => m.name === 'racket_frame') as MeshStandardMaterial | undefined;
        object.traverse((o) => {
          if (!(o as Mesh).isMesh) return;
          o.raycast = () => {};
          // Traced string beds: blend instead of cutting out, so the strings
          // fade into a fine mesh at a distance instead of sparkling or vanishing,
          // and a touch of grey so white strings still read on a light page.
          const m = (o as Mesh).material as MeshStandardMaterial;
          if (m.alphaTest > 0) {
            m.alphaTest = 0;
            m.transparent = true;
            m.depthWrite = false;
            m.color.setScalar(0.82);
          }
        });
        object.updateMatrixWorld(true);
        const full = new Box3().setFromObject(object);
        const headNode = object.getObjectByName('racket_head');
        const head = headNode ? new Box3().setFromObject(headNode) : full.clone();
        const handle = new Box3(new Vector3(-0.018, full.min.y, -0.018), new Vector3(0.018, head.min.y, 0.018));
        const orig = mats.map((m) => ({ transparent: m.transparent, opacity: m.opacity }));
        return { object, rim, mats, orig, frame, full, head, handle };
      }),
    [gltfs]
  );
  useEffect(() => () => built.forEach((b) => b.mats.forEach((m) => m.dispose())), [built]);
  useEffect(() => {
    built.forEach((b, i) => b.frame?.color.set(colorOf(rackets, i)));
  }, [built, rackets]);

  // Fit the fan to the stage.
  useLayoutEffect(() => {
    const g = fan.current;
    if (!g) return;
    g.updateMatrixWorld(true);
    const pts: Vector3[] = [];
    built.forEach((b, i) => {
      const a = anchors.current[i];
      if (!a) return;
      for (const c of corners(b.full.min, b.full.max)) pts.push(c.applyMatrix4(a.matrixWorld));
    });
    const center = new Vector3();
    pts.forEach((p) => center.add(p));
    center.multiplyScalar(1 / pts.length);
    const dir = new Vector3().setFromSphericalCoords(1, POLAR, 0);
    const fit = fitCentered((camera as PerspectiveCamera).fov, size.width / size.height, center, dir, pts, 0.9, 0.9);
    setHome({ target: fit.target, dist: fit.dist, polar: POLAR, azimuth: 0 });
  }, [built, camera, size.width, size.height]);

  // ---- Zooming in and out ------------------------------------------------------
  // Where the zoomed racket's middle goes: the fan's centre, a touch forward.
  const display = useMemo(() => (home ? home.target.clone().add(new Vector3(0, 0, 0.08)) : new Vector3()), [home]);
  const v = useMemo(() => ({ dir: new Vector3(), right: new Vector3(), fwd: new Vector3() }), []);
  /** Phones: the card sits under the racket, which lies across the stage. */
  const across = () => root.classList.contains('narrow');
  /** Camera framing the zoomed racket in the room left of (or above) the specs card. */
  const focusPose = () => {
    const cam = camera as PerspectiveCamera;
    const tv = Math.tan((cam.fov * Math.PI) / 360);
    const aspect = size.width / size.height;
    const center = display.clone();
    const card = store.refs.stats;
    v.dir.setFromSphericalCoords(1, POLAR, 0);
    v.right.set(1, 0, 0);
    if (across()) {
      // Lying across: fit its length to the width, centred in the room above the card.
      const d = (LEN / 2 + 0.03) / (tv * aspect * 0.86);
      const top = card && card.offsetHeight ? card.offsetTop : size.height * 0.4;
      const ny = clamp(1 - top / size.height, 0, 0.8);
      v.fwd.crossVectors(v.right, v.dir).negate();
      const t = center.addScaledVector(v.fwd, -ny * d * tv);
      return { p: t.clone().addScaledVector(v.dir, d), t };
    }
    const d = (LEN / 2 + 0.03) / (tv * 0.84);
    // The middle of the room the card leaves, as a fraction of the stage.
    let nx = -0.36;
    if (card && card.offsetWidth) nx = clamp(card.offsetLeft / size.width - 1, -0.72, 0);
    const t = center.addScaledVector(v.right, -nx * d * tv * aspect);
    return { p: t.clone().addScaledVector(v.dir, d), t };
  };
  const homePose = () => {
    const h = home!;
    v.dir.setFromSphericalCoords(1, h.polar, h.azimuth);
    return { p: h.target.clone().addScaledVector(v.dir, h.dist), t: h.target.clone() };
  };
  const look = useRef(new Vector3());
  const tween = useRef<{ from: { p: Vector3; t: Vector3 }; to: () => { p: Vector3; t: Vector3 }; t0: number; after?: () => void } | null>(null);
  const was = useRef<number | null>(null);
  useEffect(() => {
    const prev = was.current;
    was.current = focus;
    if (!home || (prev == null) === (focus == null)) return;
    // Where the camera is looking now: along its view, as far as the fan.
    camera.getWorldDirection(v.fwd);
    const from = { p: camera.position.clone(), t: camera.position.clone().addScaledVector(v.fwd, Math.max(0.3, home.target.clone().sub(camera.position).dot(v.fwd))) };
    if (focus != null) {
      setOrbit(false);
      tween.current = { from, to: focusPose, t0: performance.now() };
    } else {
      tween.current = { from: { p: from.p, t: look.current.clone() }, to: homePose, t0: performance.now(), after: () => setOrbit(true) };
    }
    gl.domElement.style.cursor = '';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, home]);

  // Drag to turn the zoomed racket.
  const spin = useRef({ a: 0, v: 0, drag: null as null | { x: number; t: number } });
  useEffect(() => {
    const c = gl.domElement;
    const down = (e: PointerEvent) => {
      if (store.get().focus == null) return;
      spin.current.drag = { x: e.clientX, t: performance.now() };
    };
    const move = (e: PointerEvent) => {
      const s = spin.current;
      if (!s.drag) return;
      const dx = e.clientX - s.drag.x;
      const now = performance.now();
      s.a += dx * 0.012;
      s.v = (dx * 0.012) / Math.max(0.008, (now - s.drag.t) / 1000);
      s.drag = { x: e.clientX, t: now };
    };
    const up = () => {
      spin.current.drag = null;
    };
    c.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      c.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [gl, store]);

  const lift = useRef<number[]>(Array(COUNT).fill(0));
  const up = useRef<number[]>(Array(COUNT).fill(0)); // 0 in the fan, 1 zoomed
  const away = useRef<number[]>(Array(COUNT).fill(0)); // 0 in the fan, 1 sunk back and gone
  const tmp = useMemo(() => ({ p0: new Vector3(), q0: new Quaternion(), s0: new Vector3(), p1: new Vector3(), q1: new Quaternion(), e: new Euler(), qs: new Quaternion(), noop: () => {} }), []);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = store.get();
    const zoom = s.focus;
    const active = zoom == null ? (s.pinned ?? s.hovered) : null;
    const t = state.clock.elapsedTime;
    const sp = spin.current;
    if (zoom != null) {
      if (!sp.drag) {
        sp.v *= Math.exp(-3 * dt);
        sp.a += (reducedMotion ? 0 : 0.42) * dt + sp.v * dt;
      }
    } else {
      sp.a = 0;
      sp.v = 0;
    }
    built.forEach((b, i) => {
      const arm = arms.current[i];
      const anchor = anchors.current[i];
      const holder = holders.current[i];
      if (!arm || !anchor || !holder) return;
      const sway = reducedMotion ? 0 : 0.011 * Math.sin(t * 0.55 + i * 1.3);
      arm.rotation.z = (1.5 - i) * STEP + sway;
      const want = active === i ? SLIDE : 0;
      lift.current[i] = reducedMotion ? want : damp(lift.current[i], want, 12, dt);
      anchor.position.y = DROP + lift.current[i];
      b.rim.uRim.value = reducedMotion ? (active === i ? 1 : 0) : damp(b.rim.uRim.value, active === i ? 1 : 0, 12, dt);
      // Zoom blends: linear in time, eased when applied.
      const step = reducedMotion ? 1 : dt / FLY;
      const u = (up.current[i] = clamp(up.current[i] + (zoom === i ? step : -step), 0, 1));
      const w = (away.current[i] = clamp(away.current[i] + (zoom != null && zoom !== i ? step : -step), 0, 1));
      anchor.updateWorldMatrix(true, false);
      anchor.matrixWorld.decompose(tmp.p0, tmp.q0, tmp.s0);
      const ew = easeInOut(w);
      tmp.p0.add(tmp.s0.set(0, -0.06 * ew, -0.3 * ew));
      const eu = easeInOut(u);
      if (eu > 0) {
        // Upright (or lying across on a phone), turning about its own length.
        tmp.e.set(0, 0, across() ? -Math.PI / 2 + 0.06 : -0.08);
        tmp.q1.setFromEuler(tmp.e).multiply(tmp.qs.setFromAxisAngle(Y_AXIS, sp.a));
        tmp.p1.set(0, -LEN / 2, 0).applyQuaternion(tmp.q1).add(display);
        holder.position.lerpVectors(tmp.p0, tmp.p1, eu);
        holder.quaternion.slerpQuaternions(tmp.q0, tmp.q1, eu);
      } else {
        holder.position.copy(tmp.p0);
        holder.quaternion.copy(tmp.q0);
      }
      holder.updateMatrixWorld(true);
      // The others fade as they sink back.
      const a = 1 - ew;
      b.object.visible = a > 0.01;
      b.mats.forEach((m, k) => {
        const o = b.orig[k];
        if (a < 0.999) {
          m.transparent = true;
          m.opacity = o.opacity * a;
        } else {
          m.transparent = o.transparent;
          m.opacity = o.opacity;
        }
      });
      const dead = w > 0.5;
      for (const h of hits.current[i]) h.raycast = dead ? tmp.noop : Mesh.prototype.raycast;
    });

    // The camera: a flight in or out, or holding the zoomed view.
    const tw = tween.current;
    if (tw) {
      const k = reducedMotion ? 1 : clamp((performance.now() - tw.t0) / (FLY * 1000), 0, 1);
      const e = easeInOut(k);
      const to = tw.to();
      camera.position.lerpVectors(tw.from.p, to.p, e);
      look.current.lerpVectors(tw.from.t, to.t, e);
      camera.lookAt(look.current);
      if (k >= 1) {
        tween.current = null;
        tw.after?.();
      }
    } else if (zoom != null && home) {
      const to = focusPose();
      const k = 1 - Math.exp(-8 * dt);
      camera.position.lerp(to.p, k);
      look.current.lerp(to.t, k);
      camera.lookAt(look.current);
    }

    // The hover card sits beside the active racket.
    const card = store.refs.card;
    if (!card) return;
    if (active == null) {
      card.classList.remove('on');
      return;
    }
    // In the empty lower corner on the racket's side of the fan.
    const r = projectBox(b0(active).head.min, b0(active).head.max, b0(active).object.matrixWorld, camera as PerspectiveCamera, size.width, size.height);
    const right = (r.left + r.right) / 2 > size.width / 2;
    const narrow = size.width < 480;
    const left = narrow ? (right ? size.width : 0) : right ? size.width * 0.67 : size.width * 0.33 - card.offsetWidth;
    const x = Math.min(Math.max(left, 10), size.width - card.offsetWidth - 10);
    const y = narrow ? size.height - card.offsetHeight - 10 : Math.max(12, size.height * 0.62 - card.offsetHeight / 2);
    card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    card.classList.add('on');
  });
  const b0 = (i: number) => built[i];

  const handlers = (i: number) => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      store.refs.pointer = e.pointerType;
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (e.pointerType === 'touch' || store.get().focus != null) return;
      e.stopPropagation();
      gl.domElement.style.cursor = 'pointer';
      store.set({ hovered: i });
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      if (e.pointerType === 'touch') return;
      gl.domElement.style.cursor = '';
      if (store.get().hovered === i) store.set({ hovered: null });
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      if (store.get().focus == null) store.set({ focus: i, hovered: null, pinned: null });
    }
  });

  return (
    <>
      <group ref={fan} rotation-x={LEAN}>
        {built.map((_, i) => (
          <group key={i} ref={(el) => void (arms.current[i] = el)} rotation-z={(1.5 - i) * STEP}>
            <group ref={(el) => void (anchors.current[i] = el)} position={[0, DROP, (i - 1.5) * 0.014]} />
          </group>
        ))}
      </group>
      {built.map((b, i) => (
        <group key={i} ref={(el) => void (holders.current[i] = el)}>
          <primitive object={b.object} />
          {[b.head, b.handle].map((box, k) => {
            const c = box.getCenter(new Vector3());
            const sz = box.getSize(new Vector3());
            return (
              <mesh
                key={k}
                ref={(m) => void (m && (hits.current[i][k] = m))}
                position={c}
                visible={false}
                {...handlers(i)}
              >
                <boxGeometry args={[sz.x, sz.y, Math.max(sz.z, 0.03)]} />
              </mesh>
            );
          })}
        </group>
      ))}
      {orbit && <OrbitRig home={home} polarRange={[1.05, 1.75]} azimuthRange={0.6} zoom={[0.75, 1.3]} />}
      <Ready />
    </>
  );
}

function Ready() {
  const store = useRacketStore();
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current++ === 2) store.set({ ready: true });
  });
  return null;
}

