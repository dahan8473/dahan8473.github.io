// The bike on a slow turntable over an invisible floor. Hover (or tap) and the
// wheels and crank turn as if riding, pedals level; a card shows bike.json's
// name and specs. If the model can't load, the overlay shows a quiet "coming
// soon" instead.
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box3, Group, Vector3, type Mesh, type MeshStandardMaterial, type Object3D, type PerspectiveCamera } from 'three';
import { usePiece } from '../lib/mountCanvas';
import { OrbitRig, type Home } from '../lib/rig';
import { applyRim, ContactShadow, damp, Glow, makeRim, Studio } from '../lib/studio';
import { corners, fitCentered, MODELS, useNear } from '../lib/view';
import { useBike, useBikeStore } from './store';

export const BIKE_FILE = MODELS + 'bike.glb';

const TURN = 0.16; // turntable, rad/s
const WHEEL = 7.5; // wheel spin when riding, rad/s
const GEAR = 2.6; // wheel turns per crank turn
const POLAR = 1.3;
const START_YAW = -0.55; // drive side three-quarter view

class Catch extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function BikeScene() {
  const { dark, el } = usePiece();
  const near = useNear(el);
  const store = useBikeStore();
  const failed = useBike((s) => s.failed);
  if (failed) return null;
  return (
    <>
      <Studio dark={dark} />
      {near && (
        <Catch onError={() => store.set({ failed: true })}>
          <Bike />
        </Catch>
      )}
    </>
  );
}

function Bike() {
  const gltf = useGLTF(BIKE_FILE, false, true);
  const store = useBikeStore();
  const color = useBike((s) => s.color);
  const { reducedMotion, dark, root } = usePiece();
  const { camera, size } = useThree();
  const table = useRef<Group>(null);
  const dirty = useRef(4);
  const [home, setHome] = useState<Home | null>(null);

  const built = useMemo(() => {
    const object = gltf.scene.clone(true);
    const rim = makeRim();
    const mats = applyRim(object, rim);
    const frame = mats.find((m) => m.name === 'bike_frame') as MeshStandardMaterial | undefined;
    object.traverse((o) => {
      if ((o as Mesh).isMesh) o.raycast = () => {};
    });
    object.updateMatrixWorld(true);
    const box = new Box3().setFromObject(object);
    const get = (n: string) => object.getObjectByName(n) as Object3D | undefined;
    const sign = (n: Object3D | undefined) => Number(n?.userData?.forward_sign) || -1;
    const parts = {
      front: get('wheel_front'),
      rear: get('wheel_rear'),
      crank: get('crank'),
      pedals: [get('pedal_left'), get('pedal_right')].filter(Boolean) as Object3D[]
    };
    return { object, rim, mats, frame, box, parts, wheelSign: sign(parts.rear), crankSign: sign(parts.crank) };
  }, [gltf]);
  useEffect(() => () => built.mats.forEach((m) => m.dispose()), [built]);
  useEffect(() => {
    if (color && built.frame) built.frame.color.set(color);
  }, [color, built]);

  // Fit any yaw of the turntable: use the box swept around the vertical axis.
  useLayoutEffect(() => {
    const b = built.box;
    const r = Math.max(Math.abs(b.min.x), Math.abs(b.max.x), Math.abs(b.min.z), Math.abs(b.max.z));
    const pts = corners(new Vector3(-r * 0.92, b.min.y, -r * 0.5), new Vector3(r * 0.92, b.max.y, r * 0.5));
    const dir = new Vector3().setFromSphericalCoords(1, POLAR, 0);
    const center = new Vector3(0, (b.min.y + b.max.y) / 2, 0);
    const fit = fitCentered((camera as PerspectiveCamera).fov, size.width / size.height, center, dir, pts, 0.92, 0.86);
    setHome({ target: fit.target, dist: fit.dist, polar: POLAR, azimuth: 0 });
  }, [built, camera, size.width, size.height]);

  const st = useRef({ yaw: START_YAW, turn: 1, ride: 0, wheel: 0, crank: 0 });
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = store.get();
    const t = table.current;
    if (!t) return;
    const k = st.current;
    const hover = s.hovered || s.pinned;
    const riding = s.riding || (hover && !reducedMotion);
    k.turn = damp(k.turn, hover || reducedMotion ? 0 : 1, 3, dt);
    k.yaw += TURN * k.turn * dt;
    t.rotation.y = k.yaw;
    k.ride = reducedMotion ? (riding ? 1 : 0) : damp(k.ride, riding ? 1 : 0, 2.2, dt);
    if (k.ride > 0.001) {
      k.wheel += WHEEL * k.ride * dt;
      k.crank = k.wheel / GEAR;
      const { front, rear, crank, pedals } = built.parts;
      if (front) front.rotation.z = built.wheelSign * k.wheel;
      if (rear) rear.rotation.z = built.wheelSign * k.wheel;
      if (crank) crank.rotation.z = built.crankSign * k.crank;
      for (const p of pedals) p.rotation.z = -built.crankSign * k.crank;
    }
    built.rim.uRim.value = damp(built.rim.uRim.value, hover ? 0.55 : 0, 10, dt);
    if (k.turn > 0.001 || k.ride > 0.001) dirty.current = Math.max(dirty.current, 1);
    const card = store.refs.card;
    if (card) card.classList.toggle('on', !!hover);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch') return;
    e.stopPropagation();
    store.set({ hovered: true });
    root.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch') return;
    store.set({ hovered: false });
    root.style.cursor = '';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    const touch = (e.nativeEvent as PointerEvent).pointerType === 'touch';
    if (touch) store.set({ pinned: !store.get().pinned, riding: !store.get().pinned });
    else store.set({ riding: !store.get().riding });
  };

  const c = built.box.getCenter(new Vector3());
  const sz = built.box.getSize(new Vector3());
  return (
    <>
      <group ref={table}>
        <primitive object={built.object} />
        <mesh position={c} visible={false} onPointerOver={over} onPointerOut={out} onClick={click}>
          <boxGeometry args={[sz.x * 0.96, sz.y, sz.z * 0.7]} />
        </mesh>
      </group>
      <ContactShadow
        width={2.6}
        height={2.6}
        resolution={1024}
        blur={dark ? 2.4 : 2.8}
        far={0.6}
        opacity={dark ? 0.8 : 0.5}
        color={dark ? '#000000' : '#1b2026'}
        dirty={dirty}
        pool={dark ? { radius: 1.25, color: '#b4bcc6', opacity: 0.09 } : { radius: 1.25, color: '#5a6470', opacity: 0.03 }}
      />
      {/* Dark page: a soft light on the backdrop so the black bike reads in silhouette. */}
      {dark && home && <Glow behind={1.2} around={home.target} radius={1.15} color="#a4adb8" opacity={0.085} />}
      <OrbitRig home={home} polarRange={[0.75, 1.5]} azimuthRange={1.2} zoom={[0.7, 1.3]} />
      <Ready />
    </>
  );
}

function Ready() {
  const store = useBikeStore();
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current++ === 2) store.set({ ready: true });
  });
  return null;
}
