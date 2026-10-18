// A small pin per place, in the DOM over the canvas so it stays crisp and
// outside the bloom: an accent dot with a ring in the page colour, a thin
// outer ring when its card is up. <Pins> is the DOM; <PinTracker> lives in
// the canvas and moves them each frame, fading them out on the far side.
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { usePiece } from '../lib/mountCanvas';
import type { Place } from './data';
import { worldDir } from './Rig';
import { useGlobe, useGlobeStore } from './store';

const RADIUS = 1.012;

export function Pins() {
  const places = useGlobe((s) => s.places);
  return (
    <div className="g-pins" aria-hidden="true">
      {places.map((p) => (
        <Pin key={p.id} place={p} />
      ))}
    </div>
  );
}

function Pin({ place }: { place: Place }) {
  const store = useGlobeStore();
  const { root } = usePiece();
  const on = useGlobe((s) => (s.pinned ?? s.hovered ?? s.selected) === place.id);
  return (
    <button
      type="button"
      tabIndex={-1}
      className={'g-pin' + (on ? ' on' : '')}
      ref={(el) => {
        if (el) store.refs.pins.set(place.id, el);
        else store.refs.pins.delete(place.id);
      }}
      onPointerDown={(e) => {
        store.refs.pointer = e.pointerType;
      }}
      onPointerEnter={(e) => {
        if (e.pointerType !== 'touch') store.set({ hovered: place.id });
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== 'touch' && store.get().hovered === place.id) store.set({ hovered: null });
      }}
      // Mouse: click opens. Touch: first tap shows the card, second tap opens.
      onClick={() => {
        if (store.refs.pointer === 'touch' && store.get().pinned !== place.id) {
          store.set({ pinned: place.id, hovered: null });
          return;
        }
        store.open(place.id);
        root.style.cursor = '';
      }}
    />
  );
}

export function PinTracker() {
  const store = useGlobeStore();
  const { camera, size } = useThree();
  const p = useMemo(() => new Vector3(), []);
  const c = useMemo(() => new Vector3(), []);
  const last = useMemo(() => new Map<string, string>(), []);
  useFrame(() => {
    c.copy(camera.position).normalize();
    for (const place of store.get().places) {
      const el = store.refs.pins.get(place.id);
      if (!el) continue;
      p.copy(worldDir(place.lat, place.lng, RADIUS));
      const facing = c.dot(p) / RADIUS;
      const fade = Math.min(1, Math.max(0, (facing - 0.02) / 0.22));
      let key = 'off';
      if (fade > 0.001) {
        p.project(camera);
        const x = ((p.x + 1) / 2) * size.width;
        const y = ((1 - p.y) / 2) * size.height;
        key = `${x.toFixed(1)} ${y.toFixed(1)} ${fade.toFixed(2)}`;
      }
      if (last.get(place.id) === key) continue;
      last.set(place.id, key);
      if (key === 'off') {
        el.style.visibility = 'hidden';
        continue;
      }
      const [x, y, f] = key.split(' ');
      el.style.visibility = 'visible';
      el.style.opacity = f;
      el.style.pointerEvents = facing > 0.12 ? '' : 'none';
      el.style.transform = `translate(${x}px, ${y}px)`;
    }
  });
  return null;
}
