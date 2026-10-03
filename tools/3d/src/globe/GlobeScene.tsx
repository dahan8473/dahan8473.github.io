// Everything inside the canvas.
import { useFrame } from '@react-three/fiber';
import { use, useRef } from 'react';
import type { BufferGeometry } from 'three';
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
