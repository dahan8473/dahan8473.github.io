// The photography kit as a flat-lay on an invisible desk: A7R II with the
// Tamron, X-T200, Mini 4K and the Mic Mini set. Hover lifts a piece with an
// accent rim and a spec card; click a camera to filter the photos, click the
// drone to fly it and jump to the footage.
import { OrbitControls, useGLTF } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Box3, Group, Spherical, Vector3, type Mesh, type Object3D, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { usePageFriendlyGestures } from '../lib/gestures';
import { usePiece } from '../lib/mountCanvas';
import { ACCENT, applyRim, ContactShadow, damp, makeRim, Studio, type Rim } from '../lib/studio';
import { corners, fitCentered, MODELS, placeBeside, projectBox } from '../lib/view';
import { Drone } from './Drone';
import { actionOf, activate, useKit, useKitStore, type PartId } from './store';

interface GroupDef {
  key: 'a7' | 'xt' | 'drone' | 'mic';
  file: string;
  parts: { id: PartId; node: string }[];
  hide?: string[];
}

export const GROUPS: GroupDef[] = [
  { key: 'a7', file: 'a7r2-tamron.glb', parts: [{ id: 'a7r2', node: 'a7r2' }, { id: 'tamron-17-70', node: 'tamron' }] },
  { key: 'xt', file: 'xt200.glb', parts: [{ id: 'xt200', node: 'xt200' }], hide: ['xc1545'] },
  { key: 'drone', file: 'mini4k.glb', parts: [{ id: 'mini4k', node: 'mini4k_drone' }] },
  { key: 'mic', file: 'mic-mini.glb', parts: [{ id: 'mic-mini', node: 'mic_mini' }] }
];

/** The model files, in GROUPS order (useGLTF caches them under this exact list). */
export const KIT_FILES = GROUPS.map((g) => MODELS + g.file);

type Place = { x: number; z: number; yaw: number };
// Positions on the desk in meters (front is +z, toward the viewer).
const WIDE: Record<GroupDef['key'], Place> = {
  a7: { x: -0.135, z: 0.035, yaw: 0.62 },
  xt: { x: 0.155, z: 0.045, yaw: 2.62 },
  drone: { x: 0.0, z: -0.155, yaw: 0.1 },
  mic: { x: 0.015, z: 0.165, yaw: -0.18 }
};
const COMPACT: Record<GroupDef['key'], Place> = {
  a7: { x: -0.115, z: 0.04, yaw: 0.62 },
  xt: { x: 0.13, z: 0.045, yaw: 2.62 },
  drone: { x: 0.0, z: -0.14, yaw: 0.1 },
  mic: { x: 0.01, z: 0.16, yaw: -0.18 }
};

const HOME_POLAR = 0.86; // radians from straight up: the camera sits about 41 degrees above the desk
const LIFT = 0.014;

export interface PartRef {
  id: PartId;
  space: Object3D; // the model root; box is in its local space
  box: Box3;
  rim: Rim;
}

export function KitScene() {
  const { dark } = usePiece();
  const dirty = useRef(4);
  return (
    <>
      <Studio dark={dark} />
      <Kit dirty={dirty} />
      <ContactShadow
        width={1.6}
        height={1.6}
        resolution={1024}
        blur={dark ? 2.2 : 2.6}
        far={0.22}
        opacity={dark ? 0.85 : 0.52}
        color={dark ? '#000000' : '#1b2026'}
        dirty={dirty}
        pool={dark ? { radius: 0.38, color: '#b4bcc6', opacity: 0.1 } : { radius: 0.38, color: '#5a6470', opacity: 0.03 }}
      />
    </>
  );
}

function Kit({ dirty }: { dirty: { current: number } }) {
  const gltfs = useGLTF(KIT_FILES, false, true);
  const store = useKitStore();
  const { root, reducedMotion } = usePiece();
  const { size } = useThree();
  const compact = size.width < 560;
  const layout = compact ? COMPACT : WIDE;

  // Clone each model so this mount owns its materials, add rims, hide extras.
  const prepared = useMemo(() => {
    const made: { def: GroupDef; object: Object3D; parts: { id: PartId; node: Object3D; box: Box3; rim: Rim }[] }[] = [];
    const materials: { dispose(): void }[] = [];
    GROUPS.forEach((def, i) => {
      const object = gltfs[i].scene.clone(true);
      for (const name of def.hide ?? []) {
        const n = object.getObjectByName(name);
        if (n) n.visible = false;
      }
      object.updateMatrixWorld(true);
      const parts = def.parts.map((p) => {
        const node = object.getObjectByName(p.node) ?? object;
        const rim = makeRim(ACCENT);
        materials.push(...applyRim(node, rim));
        const box = new Box3().setFromObject(node);
        // Small pieces get a slightly bigger target.
        const min = 0.03;
        const c = box.getCenter(new Vector3());
        const s = box.getSize(new Vector3());
        box.setFromCenterAndSize(c, new Vector3(Math.max(s.x, min), Math.max(s.y, min), Math.max(s.z, min)));
        return { id: p.id, node, box, rim };
      });
      object.traverse((o) => {
        const m = o as Mesh;
        if (m.isMesh) {
          m.raycast = () => {};
        }
      });
      made.push({ def, object, parts });
    });
    return { groups: made, materials };
  }, [gltfs]);
  useEffect(() => () => prepared.materials.forEach((m) => m.dispose()), [prepared]);

  const lifts = useRef<Record<string, Group | null>>({});
  const parts = useRef<PartRef[]>([]);
  const lifted = useRef<Record<string, number>>({});

  useLayoutEffect(() => {
    parts.current = prepared.groups.flatMap((g) =>
      g.parts.map((p) => ({ id: p.id, space: g.object, box: p.box, rim: p.rim }))
    );
    dirty.current = Math.max(dirty.current, 3);
  }, [prepared, dirty, compact]);

  // Hover lift and rim, eased.
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const s = store.get();
    const active = s.pinned ?? s.hovered;
    for (const g of prepared.groups) {
      const lift = lifts.current[g.def.key];
      if (!lift) continue;
      const on = g.parts.some((p) => p.id === active);
      const target = on ? LIFT : 0;
      const cur = lifted.current[g.def.key] ?? 0;
      const next = reducedMotion ? target : damp(cur, target, 14, dt);
      if (Math.abs(next - cur) > 1e-6) {
        lifted.current[g.def.key] = next;
        lift.position.y = next;
        dirty.current = Math.max(dirty.current, 1);
      }
      for (const p of g.parts) {
        const sel = s.selected && actionOf(p.id).camera === s.selected;
        const want = p.id === active ? 1 : sel ? 0.42 : 0;
        p.rim.uRim.value = reducedMotion ? want : damp(p.rim.uRim.value, want, 12, dt);
      }
    }
  });

  const handlers = (id: PartId) => {
    const clickable = !!(actionOf(id).camera || actionOf(id).fly);
    return {
      onPointerDown: (e: ThreeEvent<PointerEvent>) => {
        store.refs.pointer = e.pointerType;
      },
      onPointerOver: (e: ThreeEvent<PointerEvent>) => {
        if (e.pointerType === 'touch') return;
        e.stopPropagation();
        store.set({ hovered: id });
        root.style.cursor = clickable ? 'pointer' : '';
      },
      onPointerOut: (e: ThreeEvent<PointerEvent>) => {
        if (e.pointerType === 'touch') return;
        if (store.get().hovered === id) store.set({ hovered: null });
        root.style.cursor = '';
      },
      onClick: (e: ThreeEvent<MouseEvent>) => {
        if (e.delta > 6) return;
        e.stopPropagation();
        // Touch: the first tap shows the card, a second tap acts.
        if (store.refs.pointer === 'touch' && store.get().pinned !== id) {
          store.set({ pinned: id, hovered: null });
          return;
        }
        if (!clickable) {
          store.set({ pinned: null });
          return;
        }
        activate(store, id);
      }
    };
  };

  return (
    <>
      {prepared.groups.map((g) => {
        const at = layout[g.def.key];
        const inner = (
          <>
            <primitive object={g.object} />
            {g.parts.map((p) => {
              const c = p.box.getCenter(new Vector3());
              const s = p.box.getSize(new Vector3());
              return (
                <mesh key={p.id} position={c} visible={false} {...handlers(p.id)}>
                  <boxGeometry args={[s.x, s.y, s.z]} />
                </mesh>
              );
            })}
          </>
        );
        return (
          <group key={g.def.key} position={[at.x, 0, at.z]} rotation-y={at.yaw}>
            <group ref={(el) => void (lifts.current[g.def.key] = el)}>
              {g.def.key === 'drone' ? (
                <Drone object={g.object} dirty={dirty}>
                  {inner}
                </Drone>
              ) : (
                inner
              )}
            </group>
          </group>
        );
      })}
      <Rig layoutKey={compact ? 'compact' : 'wide'} />
      <CardTracker parts={parts} />
      <Ready />
    </>
  );
}

function Ready() {
  const store = useKitStore();
  const frames = useRef(0);
  useFrame(() => {
    if (frames.current++ === 2) store.set({ ready: true });
  });
  return null;
}

// Moves the DOM card next to the hovered (or tapped) part every frame.
function CardTracker({ parts }: { parts: { current: PartRef[] } }) {
  const store = useKitStore();
  const { camera, size } = useThree();
  useFrame(() => {
    const card = store.refs.card;
    if (!card) return;
    const s = store.get();
    const id = s.pinned ?? s.hovered;
    const p = id ? parts.current.find((x) => x.id === id) : null;
    if (!p) {
      card.classList.remove('on');
      return;
    }
    // Beside the part's box on screen, never over it.
    const r = projectBox(p.box.min, p.box.max, p.space.matrixWorld, camera as PerspectiveCamera, size.width, size.height);
    placeBeside(card, r, size.width, size.height);
    card.classList.add('on');
  });
  return null;
}

// Orbit within limits, page-friendly gestures, and a slow drift back home when idle.
function Rig({ layoutKey }: { layoutKey: string }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, size, scene } = useThree();
  const { reducedMotion } = usePiece();
  const home = useRef({ dist: 1, target: new Vector3(0, 0.03, 0), placed: false });
  const idleAt = useRef(-1e9);
  const dragging = useRef(false);
  const clock = useRef(0);
  const sph = useMemo(() => new Spherical(), []);
  const off = useMemo(() => new Vector3(), []);

  // Fit the resting kit (drone on the ground) into the view.
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    const box = new Box3();
    const pts: Vector3[] = [];
    const lb = new Box3();
    scene.updateMatrixWorld(true);
    scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh || !m.geometry || m.geometry.type.startsWith('Plane') || m.geometry.type.startsWith('Circle')) return;
      for (let p: Object3D | null = o; p; p = p.parent) if (!p.visible) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      lb.copy(m.geometry.boundingBox!);
      for (const c of corners(lb.min, lb.max)) {
        c.applyMatrix4(m.matrixWorld);
        pts.push(c);
        box.expandByPoint(c);
      }
    });
    if (box.isEmpty()) return;
    const dir = new Vector3().setFromSphericalCoords(1, HOME_POLAR, 0);
    const compact = size.width < 560;
    const start = box.getCenter(new Vector3());
    start.y = 0.03;
    const fit = fitCentered(cam.fov, size.width / size.height, start, dir, pts, compact ? 0.94 : 0.9, compact ? 0.9 : 0.86);
    const dist = fit.dist;
    const target = fit.target;
    const h = home.current;
    const c = controls.current;
    if (!h.placed) {
      camera.position.copy(dir.multiplyScalar(dist)).add(target);
      h.placed = true;
    } else {
      // Keep the visitor's zoom when the stage resizes.
      off.copy(camera.position).sub(h.target).multiplyScalar(dist / h.dist);
      camera.position.copy(target).add(off);
    }
    h.dist = dist;
    h.target.copy(target);
    if (c) {
      c.target.copy(target);
      c.update();
    }
    cam.near = dist * 0.05;
    cam.far = dist * 6;
    cam.updateProjectionMatrix();
  }, [camera, scene, size.width, size.height, layoutKey, off]);

  usePageFriendlyGestures();

  useFrame((_, rawDt) => {
    const c = controls.current;
    if (!c) return;
    const dt = Math.min(rawDt, 1 / 20);
    const h = home.current;
    c.minDistance = h.dist * 0.62;
    c.maxDistance = h.dist * 1.4;
    if (dragging.current || reducedMotion || performance.now() - idleAt.current < 4000) return;
    clock.current += dt;
    const t = clock.current;
    off.copy(camera.position).sub(c.target);
    sph.setFromVector3(off);
    sph.theta = damp(sph.theta, 0.2 * Math.sin(t * 0.21), 0.45, dt);
    sph.phi = damp(sph.phi, HOME_POLAR + 0.04 * Math.sin(t * 0.16 + 1.3), 0.45, dt);
    sph.radius = damp(sph.radius, h.dist, 0.35, dt);
    c.target.lerp(h.target, 1 - Math.exp(-0.8 * dt));
    camera.position.setFromSpherical(sph).add(c.target);
    c.update();
  });

  return (
    <OrbitControls
      ref={controls}
      enablePan={false}
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
      minPolarAngle={0.32}
      maxPolarAngle={1.32}
      minAzimuthAngle={-1.05}
      maxAzimuthAngle={1.05}
      onStart={() => {
        dragging.current = true;
      }}
      onEnd={() => {
        dragging.current = false;
        idleAt.current = performance.now();
      }}
    />
  );
}
