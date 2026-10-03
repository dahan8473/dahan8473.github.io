// Everything inside the canvas.
import { useFrame, useThree } from '@react-three/fiber';
import { use, useRef } from 'react';
import { Vector3, type BufferGeometry, type PerspectiveCamera } from 'three';
import { usePiece } from '../lib/mountCanvas';
import { CardTracker } from './Card';
import { Earth } from './Earth';
import { Markers } from './Markers';
import { DARK, LIGHT } from './palette';
import { PostFX } from './PostFX';
import { Rig } from './Rig';
import { GLOBE_SPIN, useGlobeStore } from './store';

export function GlobeScene({ points }: { points: Promise<BufferGeometry> }) {
  const geometry = use(points);
  const { dark } = usePiece();
  const palette = dark ? DARK : LIGHT;
  return (
    <PostFX palette={palette}>
      <group rotation={[0, GLOBE_SPIN, 0]}>
        <Earth geometry={geometry} palette={palette} />
        <Markers palette={palette} />
      </group>
      <Rig />
      <CardTracker />
      <GlowTracker />
      <Ready />
    </PostFX>
  );
}

// Tells the overlay the first frames are on screen.
function Ready() {
  const store = useGlobeStore();
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current++ === 2) store.set({ ready: true });
  });
  return null;
}

// The warm glow behind the globe is CSS on the stage (outside the bloom pass,
// so it can't smear into the ocean). This keeps it on the globe: its screen
// center and radius go into --gx, --gy and --gr on the stage element.
function GlowTracker() {
  const { el } = usePiece();
  const { size } = useThree();
  const v = useRef(new Vector3());
  const last = useRef('');
  useFrame(({ camera }) => {
    const cam = camera as PerspectiveCamera;
    v.current.set(0, 0, 0).project(cam);
    const x = ((v.current.x + 1) / 2) * size.width;
    const y = ((1 - v.current.y) / 2) * size.height;
    const d = cam.position.length();
    const t = Math.tan(((cam.fov / 2) * Math.PI) / 180);
    const r = d > 1 ? size.height / (2 * t * Math.sqrt(d * d - 1)) : size.height;
    const key = `${x.toFixed(1)} ${y.toFixed(1)} ${r.toFixed(1)}`;
    if (key === last.current) return;
    last.current = key;
    el.style.setProperty('--gx', `${x.toFixed(1)}px`);
    el.style.setProperty('--gy', `${y.toFixed(1)}px`);
    el.style.setProperty('--gr', `${r.toFixed(1)}px`);
  });
  return null;
}
