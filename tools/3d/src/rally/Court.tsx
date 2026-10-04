// The hall: a singles court with its doubles lines, a net with its tape, a
// quiet floor that fades into the page color, soft light, and a few ceiling
// lights for when you look up at a clear.
import { useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  Fog,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type BufferGeometry
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DSIDE, HALF, LONG_D, NET_H, NET_LOW, POST_X, SHORT, SIDE } from './physics';

export interface Palette {
  bg: string;
  floor: string;
  mat: string;
  line: string;
  net: string;
  post: string;
  tape: string;
  trail: string;
  lamp: string;
  shadow: number;
  light: number;
}

export const PALETTE: Record<'light' | 'dark', Palette> = {
  light: { bg: '#eef0f3', floor: '#e4e6ea', mat: '#7e958f', line: '#f7f8f8', net: '#2b2f36', post: '#3b4048', tape: '#fbfbfb', trail: '#3b4252', lamp: '#fbfcfd', shadow: 0.3, light: 1 },
  dark: { bg: '#0f1013', floor: '#17191d', mat: '#2b3936', line: '#d8dee9', net: '#c9ced6', post: '#4c535e', tape: '#e5e9f0', trail: '#e5e9f0', lamp: '#3b4252', shadow: 0.55, light: 0.7 }
};

const LINE = 0.04;

function courtLines(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const bar = (x0: number, z0: number, x1: number, z1: number) => {
    const w = Math.abs(x1 - x0) || LINE;
    const d = Math.abs(z1 - z0) || LINE;
    const g = new PlaneGeometry(w, d).rotateX(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    parts.push(g);
  };
  for (const s of [-1, 1]) {
    bar(s * DSIDE, -HALF, s * DSIDE, HALF); // doubles sidelines
    bar(s * SIDE, -HALF, s * SIDE, HALF); // singles sidelines
    bar(-DSIDE, s * HALF, DSIDE, s * HALF); // back boundary
    bar(-DSIDE, s * LONG_D, DSIDE, s * LONG_D); // doubles long service line
    bar(-DSIDE, s * SHORT, DSIDE, s * SHORT); // short service line
    bar(0, s * SHORT, 0, s * HALF); // centre line
  }
  const g = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return g;
}

/** A knotted mesh: dark squares on transparent, tiled across the net. */
function netTexture(color: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const x = c.getContext('2d')!;
  x.strokeStyle = color;
  x.globalAlpha = 0.6;
  x.lineWidth = 1.6;
  x.strokeRect(0, 0, 32, 32);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  // Squares a bit bigger than a real net's, so they don't shimmer.
  t.repeat.set((POST_X * 2) / 0.045, (NET_H - NET_LOW) / 0.045);
  return t;
}

export function Court({ p }: { p: Palette }) {
  const scene = useThree((s) => s.scene);
  const r = useMemo(() => {
    const lines = courtLines();
    const netTex = netTexture(p.net);
    const mats = {
      floor: new MeshStandardMaterial({ color: p.floor, roughness: 0.95, metalness: 0 }),
      mat: new MeshStandardMaterial({ color: p.mat, roughness: 0.85, metalness: 0 }),
      line: new MeshStandardMaterial({ color: p.line, roughness: 0.8 }),
      net: new MeshBasicMaterial({ map: netTex, transparent: true, depthWrite: false, side: 2, toneMapped: false, opacity: 0.75 }),
      post: new MeshStandardMaterial({ color: p.post, roughness: 0.5, metalness: 0.3 }),
      tape: new MeshStandardMaterial({ color: p.tape, roughness: 0.7 }),
      ceiling: new MeshBasicMaterial({ color: p.lamp, toneMapped: false, fog: true })
    };
    const geos = {
      floor: new PlaneGeometry(80, 80).rotateX(-Math.PI / 2),
      mat: new PlaneGeometry(DSIDE * 2 + 1.6, HALF * 2 + 2.6).rotateX(-Math.PI / 2),
      net: new PlaneGeometry(POST_X * 2, NET_H - NET_LOW),
      tape: new BoxGeometry(POST_X * 2, 0.04, 0.012),
      post: new CylinderGeometry(0.022, 0.026, NET_H + 0.03, 12),
      foot: new CylinderGeometry(0.11, 0.13, 0.05, 20),
      light: new PlaneGeometry(0.6, 0.6).rotateX(Math.PI / 2)
    };
    return { lines, netTex, mats, geos };
  }, [p]);
  useEffect(
    () => () => {
      r.lines.dispose();
      r.netTex.dispose();
      Object.values(r.mats).forEach((m) => m.dispose());
      Object.values(r.geos).forEach((g) => g.dispose());
    },
    [r]
  );
  useEffect(() => {
    scene.background = new Color(p.bg);
    scene.fog = new Fog(p.bg, 16, 46);
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, p.bg]);

  // Lamps along both sides, outside the court, like a real hall.
  const lights: [number, number][] = [];
  for (const x of [-4.6, 4.6]) for (let z = -15; z <= 12; z += 3) lights.push([x, z]);
  return (
    <>
      <hemisphereLight args={['#ffffff', p.floor, 1.6 * p.light]} />
      <directionalLight position={[3, 9, 4]} intensity={1.3 * p.light} />
      <directionalLight position={[-4, 6, -8]} intensity={0.5 * p.light} />
      <mesh geometry={r.geos.floor} material={r.mats.floor} position-y={-0.002} />
      <mesh geometry={r.geos.mat} material={r.mats.mat} />
      <mesh geometry={r.lines} material={r.mats.line} position-y={0.002} />
      <mesh geometry={r.geos.net} material={r.mats.net} position-y={(NET_H + NET_LOW) / 2} renderOrder={3} />
      <mesh geometry={r.geos.tape} material={r.mats.tape} position-y={NET_H - 0.02} />
      {[-POST_X, POST_X].map((x) => (
        <group key={x} position-x={x}>
          <mesh geometry={r.geos.post} material={r.mats.post} position-y={(NET_H + 0.03) / 2} />
          <mesh geometry={r.geos.foot} material={r.mats.post} position-y={0.025} />
        </group>
      ))}
      {lights.map(([x, z]) => (
        <mesh key={x + ':' + z} geometry={r.geos.light} material={r.mats.ceiling} position={[x, 9, z]} />
      ))}
    </>
  );
}

