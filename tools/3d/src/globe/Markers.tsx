// A glowing accent dot per place. Constant size on screen, gentle pulse,
// fades out as it turns to the far side of the globe.
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { Color, Euler, Group, Mesh, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { float, mix, smoothstep, uniform, uv } from 'three/tsl';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { usePiece } from '../lib/mountCanvas';
import { direction, type Place } from './data';
import type { Palette } from './palette';
import { GLOBE_SPIN, useGlobe, useGlobeStore } from './store';

/* eslint-disable @typescript-eslint/no-explicit-any */
const DOT_PX = 30; // quad size for the dot and its glow
const RING_PX = 60; // quad size for the pulse ring
const HIT_PX = 40; // tap target
const RADIUS = 1.012;
// Markers sit in the spun globe group; this turns camera-facing back into its frame.
const UNSPIN = new Quaternion().setFromEuler(new Euler(0, GLOBE_SPIN, 0)).invert();

function makeMaterials() {
  const core = uniform(new Color());
  const glow = uniform(new Color());
  const fade = uniform(1.0);
  const pulse = uniform(0.0);
  const ringAlpha = uniform(0.8);
  const selected = uniform(0.0);
  const haloAlpha = uniform(0.55);
  const r = uv().sub(0.5).mul(2).length(); // 0 at center, 1 at quad edge

  // Dot: a solid core with a soft halo.
  const coreEdge = float(0.27).add(selected.mul(0.06));
  const coreMask = float(1).sub(smoothstep(coreEdge.sub(0.06), coreEdge, r));
  const halo = float(1).sub(smoothstep(0.0, 1.0, r)).pow(2.2).mul(haloAlpha);
  const dot = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
  dot.colorNode = mix(glow, core, coreMask) as any;
  dot.opacityNode = coreMask.max(halo).mul(fade) as any;

  // Ring: expands and fades.
  const rr = pulse.mul(0.8).add(0.18);
  const band = float(1).sub(smoothstep(0.0, 0.07, r.sub(rr).abs()));
  const ring = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false });
  ring.colorNode = glow as any;
  ring.opacityNode = band.mul(float(1).sub(pulse)).mul(ringAlpha).mul(fade) as any;

  return {
    dot,
    ring,
    u: { core, glow, fade, pulse, ringAlpha, selected, haloAlpha } as unknown as Record<
      'core' | 'glow',
      { value: Color }
    > &
      Record<'fade' | 'pulse' | 'ringAlpha' | 'selected' | 'haloAlpha', { value: number }>
  };
}

function Marker({ place, index, palette }: { place: Place; index: number; palette: Palette }) {
  const store = useGlobeStore();
  const selected = useGlobe((s) => (s.pinned ?? s.hovered ?? s.selected) === place.id);
  const { reducedMotion, root } = usePiece();
  const { camera, size } = useThree();
  const group = useRef<Group>(null);
  const dotRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);
  const hitRef = useRef<Mesh>(null);
  const facing = useRef(1);
  const m = useMemo(makeMaterials, []);
  const local = useMemo(() => new Vector3(...direction(place.lat, place.lng)).multiplyScalar(RADIUS), [place.lat, place.lng]);
  const world = useMemo(() => new Vector3(), []);
  const tmp = useMemo(() => new Vector3(), []);
  const quad = useMemo(() => new PlaneGeometry(1, 1), []);

  useEffect(() => {
    m.u.core.value.set(palette.markerCore);
    m.u.glow.value.set(palette.marker);
    m.u.ringAlpha.value = palette.stars ? 0.75 : 0.9;
    m.u.haloAlpha.value = palette.markerHalo;
  }, [palette, m]);
  useEffect(() => {
    m.u.selected.value = selected ? 1 : 0;
  }, [selected, m]);
  useEffect(
    () => () => {
      m.dot.dispose();
      m.ring.dispose();
      quad.dispose();
    },
    [m, quad]
  );

  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    g.getWorldPosition(world);
    tmp.copy(camera.position).normalize();
    const dist = camera.position.distanceTo(world);
    const f = tmp.dot(world.normalize());
    facing.current = f;
    const fade = Math.min(1, Math.max(0, (f - 0.02) / 0.22));
    m.u.fade.value = fade;
    const fov = (camera as any).fov ?? 30;
    const wpp = (2 * dist * Math.tan(((fov / 2) * Math.PI) / 180)) / Math.max(1, size.height);
    const t = state.clock.elapsedTime;
    const period = 2.6;
    const pulse = reducedMotion ? 0.55 : ((t + index * 0.83) % period) / period;
    m.u.pulse.value = pulse;
    const q = camera.quaternion;
    const s = selected ? 1.15 : 1;
    for (const [ref, px] of [
      [dotRef, DOT_PX * s],
      [ringRef, RING_PX * s],
      [hitRef, HIT_PX]
    ] as const) {
      const o = ref.current;
      if (!o) continue;
      o.quaternion.multiplyQuaternions(UNSPIN, q);
      o.scale.setScalar(px * wpp);
    }
    if (dotRef.current) dotRef.current.visible = fade > 0.001;
    if (ringRef.current) ringRef.current.visible = fade > 0.001;
  });

  const usable = () => facing.current > 0.12;
  const down = (e: ThreeEvent<PointerEvent>) => {
    store.refs.pointer = e.pointerType;
  };
  const over = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch' || !usable()) return;
    e.stopPropagation();
    store.set({ hovered: place.id });
    root.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    if (e.pointerType === 'touch') return;
    if (store.get().hovered === place.id) store.set({ hovered: null });
    root.style.cursor = '';
  };
  // Mouse: click opens. Touch: first tap shows the card, second tap opens.
  const click = (e: ThreeEvent<MouseEvent>) => {
    if (!usable() || e.delta > 6) return;
    e.stopPropagation();
    if (store.refs.pointer === 'touch' && store.get().pinned !== place.id) {
      store.set({ pinned: place.id, hovered: null });
      return;
    }
    store.open(place.id);
    root.style.cursor = '';
  };

  return (
    <group ref={group} position={local}>
      <mesh ref={ringRef} material={m.ring} renderOrder={10} geometry={quad} />
      <mesh ref={dotRef} material={m.dot} renderOrder={11} geometry={quad} />
      <mesh ref={hitRef} geometry={quad} onPointerDown={down} onPointerOver={over} onPointerOut={out} onClick={click} visible={false} />
    </group>
  );
}

export function Markers({ palette }: { palette: Palette }) {
  const places = useGlobe((s) => s.places);
  return (
    <>
      {places.map((p, i) => (
        <Marker key={p.id} place={p} index={i} palette={palette} />
      ))}
    </>
  );
}
