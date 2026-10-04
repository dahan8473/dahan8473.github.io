// Four rackets fanned like a hand of cards: each one's own traced model when
// rackets.json names one, else the generic racket in its own frame color. Hover
// slides one out with an accent rim and a card; they sway a little at rest.
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box3, Group, Vector3, type Mesh, type MeshStandardMaterial, type PerspectiveCamera } from 'three';
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
    </>
  );
}

function Fan() {
  const store = useRacketStore();
  const rackets = useRacket((s) => s.rackets);
  const files = useMemo(() => Array.from({ length: COUNT }, (_, i) => modelOf(rackets, i, RACKET_FILE)), [rackets]);
  const gltfs = useGLTF(files, false, true);
  const { reducedMotion } = usePiece();
  const { camera, size } = useThree();
  const fan = useRef<Group>(null);
  const arms = useRef<(Group | null)[]>([]);
  const slides = useRef<(Group | null)[]>([]);
  const [home, setHome] = useState<Home | null>(null);

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
        return { object, rim, mats, frame, full, head, handle };
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
    built.forEach((b) => {
      for (const c of corners(b.full.min, b.full.max)) pts.push(c.applyMatrix4(b.object.matrixWorld));
    });
    const center = new Vector3();
    pts.forEach((p) => center.add(p));
    center.multiplyScalar(1 / pts.length);
    const dir = new Vector3().setFromSphericalCoords(1, POLAR, 0);
    const fit = fitCentered((camera as PerspectiveCamera).fov, size.width / size.height, center, dir, pts, 0.9, 0.9);
    setHome({ target: fit.target, dist: fit.dist, polar: POLAR, azimuth: 0 });
  }, [built, camera, size.width, size.height]);

  const lift = useRef<number[]>(Array(COUNT).fill(0));
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = store.get();
    const active = s.pinned ?? s.hovered;
    const t = state.clock.elapsedTime;
    built.forEach((b, i) => {
      const arm = arms.current[i];
      const slide = slides.current[i];
      if (!arm || !slide) return;
      const sway = reducedMotion ? 0 : 0.011 * Math.sin(t * 0.55 + i * 1.3);
      arm.rotation.z = (1.5 - i) * STEP + sway;
      const want = active === i ? SLIDE : 0;
      lift.current[i] = reducedMotion ? want : damp(lift.current[i], want, 12, dt);
      slide.position.y = DROP + lift.current[i];
      b.rim.uRim.value = reducedMotion ? (active === i ? 1 : 0) : damp(b.rim.uRim.value, active === i ? 1 : 0, 12, dt);
    });
    // The card sits beside the active racket.
    const card = store.refs.card;
    if (!card) return;
    if (active == null) {
      card.classList.remove('on');
      return;
    }
    // In the empty lower corner on the racket's side of the fan.
    const b = built[active];
    const r = projectBox(b.head.min, b.head.max, b.object.matrixWorld, camera as PerspectiveCamera, size.width, size.height);
    const right = (r.left + r.right) / 2 > size.width / 2;
    const narrow = size.width < 480;
    const left = narrow ? (right ? size.width : 0) : right ? size.width * 0.67 : size.width * 0.33 - card.offsetWidth;
    const x = Math.min(Math.max(left, 10), size.width - card.offsetWidth - 10);
    const y = narrow ? size.height - card.offsetHeight - 10 : Math.max(12, size.height * 0.62 - card.offsetHeight / 2);
    card.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    card.classList.add('on');
  });

  const handlers = (i: number) => ({
    onPointerDown: (e: ThreeEvent<PointerEvent>) => {
      store.refs.pointer = e.pointerType;
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      if (e.pointerType === 'touch') return;
      e.stopPropagation();
      store.set({ hovered: i });
    },
    onPointerOut: (e: ThreeEvent<PointerEvent>) => {
      if (e.pointerType === 'touch') return;
      if (store.get().hovered === i) store.set({ hovered: null });
    },
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return;
      e.stopPropagation();
      // Touch: a tap holds the card open; tapping it again lets go.
      if (store.refs.pointer === 'touch') store.set({ pinned: store.get().pinned === i ? null : i, hovered: null });
    }
  });

  return (
    <>
      <group ref={fan} rotation-x={LEAN}>
        {built.map((b, i) => (
          <group key={i} ref={(el) => void (arms.current[i] = el)} rotation-z={(1.5 - i) * STEP}>
            <group ref={(el) => void (slides.current[i] = el)} position={[0, DROP, (i - 1.5) * 0.014]}>
              <primitive object={b.object} />
              {[b.head, b.handle].map((box, k) => {
                const c = box.getCenter(new Vector3());
                const sz = box.getSize(new Vector3());
                return (
                  <mesh key={k} position={c} visible={false} {...handlers(i)}>
                    <boxGeometry args={[sz.x, sz.y, Math.max(sz.z, 0.03)]} />
                  </mesh>
                );
              })}
            </group>
          </group>
        ))}
      </group>
      <OrbitRig home={home} polarRange={[1.05, 1.75]} azimuthRange={0.6} zoom={[0.75, 1.3]} />
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
