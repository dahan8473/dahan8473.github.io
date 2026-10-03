// The guitar lying across the strip, framed on the neck, soundhole and bridge.
// The model's strings are swapped for tubes that bend (a vertex shader moves
// them by a decaying standing wave); a faint ribbon shows the blur of a string
// in motion. Chord shapes show as accent dots on the fretboard.
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import {
  CircleGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  Vector3,
  type Material,
  type MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera
} from 'three';
import { usePiece } from '../lib/mountCanvas';
import { ACCENT, Studio } from '../lib/studio';
import { fitCentered, MODELS, useNear } from '../lib/view';
import { CHORDS, useGuitar, useGuitarStore, type Geom, type StringGeom } from './store';

export const GUITAR_FILE = MODELS + 'guitar.glb';

const YAW = -0.13; // the neck recedes a little
const YAW_NARROW = -0.36; // more on phones, so the strings over the soundhole come closer
const ELEV = 0.2; // camera a little above the strings, radians
const DECAY = [1.5, 1.35, 1.2, 1.05, 0.95, 0.85]; // seconds, visual
const WIGGLE = [19, 21, 23, 25, 27, 29]; // Hz the core string shimmers at
const Y = new Vector3(0, 1, 0);

export function GuitarScene() {
  const { el, dark } = usePiece();
  const near = useNear(el, '500px');
  return (
    <>
      <Studio dark={dark} />
      {near && <Guitar />}
    </>
  );
}

function readGeom(root: Object3D): Geom | null {
  const strings: StringGeom[] = [];
  for (let i = 0; i < 6; i++) {
    const n = root.getObjectByName('string_' + i);
    const x = n?.userData as { nut?: number[]; saddle?: number[]; gauge_mm?: number; wound?: boolean } | undefined;
    if (!x?.nut || !x.saddle) return null;
    strings.push({
      nut: x.nut as [number, number, number],
      saddle: x.saddle as [number, number, number],
      radius: ((x.gauge_mm ?? 0.9) / 2000) * 1.15,
      wound: !!x.wound
    });
  }
  const frets = [0];
  for (let f = 1; f <= 19; f++) {
    const d = (root.getObjectByName('fret_' + f)?.userData as { from_nut_m?: number })?.from_nut_m;
    frets[f] = typeof d === 'number' ? d : 0.65 * (1 - Math.pow(2, -f / 12));
  }
  return { strings, frets, scale: 0.65 };
}

interface StringParts {
  mesh: Mesh;
  ribbon: Mesh;
  core: MeshStandardMaterial;
  rib: ShaderMaterial;
  len: number;
  nut: Vector3;
  saddle: Vector3;
}

const SHAPE = `
  float su = 0.5 - position.y / uLen;
  float sw = su > uU0 ? sin(3.14159265 * (su - uU0) / max(1.0 - uU0, 0.001)) : 0.0;
`;

function makeString(g: StringGeom, base: Material, color: string): StringParts {
  const nut = new Vector3(...g.nut);
  const saddle = new Vector3(...g.saddle);
  const dir = nut.clone().sub(saddle);
  const len = dir.length();
  dir.normalize();
  const q = new Quaternion().setFromUnitVectors(Y, dir);
  const mid = nut.clone().add(saddle).multiplyScalar(0.5);

  const u = {
    uDisp: { value: 0 },
    uU0: { value: 0 },
    uLen: { value: len },
    uGlow: { value: 0 },
    uGlowColor: { value: new Color(ACCENT) }
  };
  const core = base.clone() as MeshStandardMaterial;
  core.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uDisp;\nuniform float uU0;\nuniform float uLen;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>\n${SHAPE}\n  transformed.x += uDisp * sw;\n  transformed.z += uDisp * sw * 0.25;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;\nuniform vec3 uGlowColor;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += uGlowColor * uGlow;');
  };
  core.customProgramCacheKey = () => 'dl-string';
  core.userData.u = u;
  const geo = new CylinderGeometry(g.radius, g.radius, len, 8, 128, true);
  const mesh = new Mesh(geo, core);
  mesh.position.copy(mid);
  mesh.quaternion.copy(q);
  mesh.raycast = () => {};

  // The blur of a vibrating string: a lens-shaped ribbon, densest at its edges.
  const rib = new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    uniforms: { uAmp: { value: 0 }, uU0: u.uU0, uLen: u.uLen, uR: { value: g.radius }, uColor: { value: new Color(color) }, uAlpha: { value: 0 } },
    vertexShader: `
      uniform float uAmp; uniform float uU0; uniform float uLen; uniform float uR;
      varying float vX;
      void main() {
        ${SHAPE}
        vec3 p = position;
        p.x = position.x * 2.0 * (uAmp * sw * 0.9 + uR);
        vX = position.x * 2.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uAlpha; varying float vX;
      void main() {
        float e = abs(vX);
        float a = (0.35 + 0.65 * e * e) * (1.0 - smoothstep(0.82, 1.0, e));
        gl_FragColor = vec4(uColor, a * uAlpha);
      }`
  });
  const ribbon = new Mesh(new PlaneGeometry(1, len, 1, 96), rib);
  ribbon.position.copy(mid);
  ribbon.quaternion.copy(q);
  ribbon.renderOrder = 4;
  ribbon.visible = false;
  ribbon.raycast = () => {};
  return { mesh, ribbon, core, rib, len, nut, saddle };
}

function Guitar() {
  const gltf = useGLTF(GUITAR_FILE, false, true);
  const store = useGuitarStore();
  const { camera, size } = useThree();
  const { reducedMotion, dark } = usePiece();
  const chord = useGuitar((s) => s.chord);
  const turned = useRef<Group>(null);

  const built = useMemo(() => {
    const root = gltf.scene.clone(true);
    const geom = readGeom(root);
    if (!geom) throw new Error('guitar.glb has no string data');
    const baseWound = (root.getObjectByName('string_0') as Mesh | undefined)?.material as Material;
    const baseNylon = (root.getObjectByName('string_5') as Mesh | undefined)?.material as Material;
    for (let i = 0; i < 6; i++) {
      const n = root.getObjectByName('string_' + i);
      if (n) n.visible = false;
    }
    root.traverse((o) => {
      if ((o as Mesh).isMesh) o.raycast = () => {};
    });
    const strings = geom.strings.map((g) => makeString(g, g.wound ? baseWound : baseNylon, g.wound ? '#d4d4da' : '#ede6d3'));
    return { root, geom, strings };
  }, [gltf]);

  useLayoutEffect(() => {
    store.refs.geom = built.geom;
  }, [built, store]);
  useEffect(
    () => () => {
      for (const s of built.strings) {
        s.mesh.geometry.dispose();
        s.ribbon.geometry.dispose();
        s.core.dispose();
        s.rib.dispose();
      }
    },
    [built]
  );

  // The blur of a ringing string: pale, so it shows over the fretboard and soundhole.
  useEffect(() => {
    built.strings.forEach((s) => s.rib.uniforms.uColor.value.set(dark ? '#e6f3f7' : '#f4f8fa'));
  }, [built, dark]);

  // Fretted strings vibrate from their fret to the saddle.
  useEffect(() => {
    const shape = chord ? CHORDS[chord] : null;
    built.strings.forEach((s, i) => {
      const f = shape?.[i];
      (s.core.userData.u as { uU0: { value: number } }).uU0.value = f && f > 0 ? built.geom.frets[f] / s.len : 0;
    });
  }, [chord, built]);

  // Frame the strings: nut to bridge across the width.
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    const g = turned.current;
    if (!g) return;
    g.updateMatrixWorld(true);
    const pts: Vector3[] = [];
    for (const s of built.strings) {
      const d = s.nut.clone().sub(s.saddle).normalize();
      pts.push(s.nut.clone().addScaledVector(d, 0.03).applyMatrix4(g.matrixWorld));
      pts.push(s.saddle.clone().addScaledVector(d, -0.035).applyMatrix4(g.matrixWorld));
    }
    const center = new Vector3();
    pts.forEach((p) => center.add(p));
    center.multiplyScalar(1 / pts.length);
    const dir = new Vector3(0, Math.sin(ELEV), Math.cos(ELEV));
    const aspect = size.width / size.height;
    const fit = fitCentered(cam.fov, aspect, center, dir, pts, aspect > 2.6 ? 0.95 : 0.97, 0.7);
    // Sit the strings a touch above center so the chord bar has the body below.
    const target = fit.target.clone().add(new Vector3(0, -0.012, 0).multiplyScalar(fit.dist));
    cam.position.copy(target).addScaledVector(dir, fit.dist);
    cam.near = fit.dist * 0.2;
    cam.far = fit.dist * 4;
    cam.lookAt(target);
    cam.updateProjectionMatrix();
  }, [camera, size.width, size.height, built, size.width / size.height < 2.5]);

  const tmpA = useMemo(() => new Vector3(), []);
  const tmpB = useMemo(() => new Vector3(), []);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const g = turned.current;
    if (!g) return;
    const vib = store.refs.vib;
    const hover = store.refs.hover;
    const t = state.clock.elapsedTime;
    built.strings.forEach((s, i) => {
      const v = vib[i];
      if (v.delay > 0) {
        v.delay -= dt;
        if (v.delay <= 0) {
          v.amp = Math.max(v.amp * 0.4, v.pending);
          v.damped = false;
          v.flash = 1;
        }
      }
      v.amp *= Math.exp(-dt / (v.damped ? 0.07 : DECAY[i]));
      if (v.amp < 1e-5) v.amp = 0;
      v.flash *= Math.exp(-dt / 0.35);
      v.phase += dt * WIGGLE[i] * Math.PI * 2;
      const u = s.core.userData.u as { uDisp: { value: number }; uGlow: { value: number } };
      // Reduced motion: no shimmer, just the fading blur.
      u.uDisp.value = reducedMotion ? 0 : v.amp * Math.cos(v.phase) * (0.85 + 0.15 * Math.sin(t * 7 + i));
      u.uGlow.value = Math.min(1, 0.55 * v.flash + (hover === i ? 0.22 : 0)) * (dark ? 0.9 : 0.7);
      s.rib.uniforms.uAmp.value = v.amp;
      s.rib.uniforms.uAlpha.value = Math.min(1, v.amp / 0.003) * (dark ? 0.34 : 0.4);
      s.ribbon.visible = v.amp > 0.00005;
    });

    // Strings on screen, for the pointer (px inside the stage, a = nut end).
    const segs = store.refs.segs;
    built.strings.forEach((s, i) => {
      tmpA.copy(s.nut).applyMatrix4(g.matrixWorld).project(camera);
      tmpB.copy(s.saddle).applyMatrix4(g.matrixWorld).project(camera);
      const seg = segs[i] ?? (segs[i] = { ax: 0, ay: 0, bx: 0, by: 0 });
      seg.ax = ((tmpA.x + 1) / 2) * size.width;
      seg.ay = ((1 - tmpA.y) / 2) * size.height;
      seg.bx = ((tmpB.x + 1) / 2) * size.width;
      seg.by = ((1 - tmpB.y) / 2) * size.height;
    });
  });

  const yaw = size.width / size.height < 2.5 ? YAW_NARROW : YAW;
  return (
    <group rotation-y={yaw}>
      <group ref={turned} rotation-z={Math.PI / 2}>
        <primitive object={built.root} />
        {built.strings.map((s, i) => (
          <group key={i}>
            <primitive object={s.mesh} />
            <primitive object={s.ribbon} />
          </group>
        ))}
        <Fingers geom={built.geom} strings={built.strings} chord={chord} />
      </group>
      <Ready />
    </group>
  );
}

function Ready() {
  const store = useGuitarStore();
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current++ === 2) store.set({ ready: true });
  });
  return null;
}

const BOARD_Z = 0.0466; // just above the fretboard, under the strings
const DOT_R = 0.0041;

// Accent dots where the chord's fingers go; open and muted strings get o and x past the nut.
function Fingers({ geom, strings, chord }: { geom: Geom; strings: StringParts[]; chord: string | null }) {
  const { reducedMotion } = usePiece();
  const group = useRef<Group>(null);
  const grow = useRef(1);
  const r = useMemo(() => {
    const dotGeo = new CircleGeometry(DOT_R, 32);
    const haloGeo = new CircleGeometry(DOT_R * 1.9, 32);
    const ringGeo = new RingGeometry(DOT_R * 0.55, DOT_R * 0.85, 28);
    const barGeo = new PlaneGeometry(DOT_R * 1.7, 0.0011);
    const dot = new MeshBasicMaterial({ color: ACCENT, toneMapped: false });
    const halo = new MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
    const mark = new MeshBasicMaterial({ color: '#e9e3d6', transparent: true, opacity: 0.92, depthTest: false, depthWrite: false, toneMapped: false });
    return { dotGeo, haloGeo, ringGeo, barGeo, dot, halo, mark };
  }, []);
  useEffect(
    () => () => {
      Object.values(r).forEach((x) => (x as { dispose(): void }).dispose());
    },
    [r]
  );
  useEffect(() => {
    grow.current = reducedMotion ? 1 : 0;
  }, [chord, reducedMotion]);
  useFrame((_, dt) => {
    if (grow.current >= 1 || !group.current) return;
    grow.current = Math.min(1, grow.current + dt / 0.18);
    const k = 1 - Math.pow(1 - grow.current, 3);
    group.current.children.forEach((c) => c.userData.dot && c.scale.setScalar(k));
  });

  const shape = chord ? CHORDS[chord] : null;
  if (!shape) return <group ref={group} />;
  const at = (s: number, fromNut: number, z: number) => {
    const p = strings[s].nut.clone().lerp(strings[s].saddle, fromNut / strings[s].len);
    p.z = z;
    return p;
  };
  return (
    <group ref={group}>
      {shape.map((f, s) => {
        if (f == null || f === 0) {
          const p = at(s, -0.011, 0.0505);
          return f == null ? (
            <group key={s} position={p} rotation-z={Math.PI / 4} renderOrder={6}>
              <mesh geometry={r.barGeo} material={r.mark} renderOrder={6} />
              <mesh geometry={r.barGeo} material={r.mark} rotation-z={Math.PI / 2} renderOrder={6} />
            </group>
          ) : (
            <mesh key={s} position={p} geometry={r.ringGeo} material={r.mark} renderOrder={6} />
          );
        }
        // Just behind the fret, where a fingertip presses.
        const d = geom.frets[f - 1] + 0.7 * (geom.frets[f] - geom.frets[f - 1]);
        const p = at(s, d, BOARD_Z);
        return (
          <group key={s} position={p} userData={{ dot: true }}>
            <mesh geometry={r.haloGeo} material={r.halo} renderOrder={3} />
            <mesh geometry={r.dotGeo} material={r.dot} position-z={0.0001} renderOrder={3} />
          </group>
        );
      })}
    </group>
  );
}
