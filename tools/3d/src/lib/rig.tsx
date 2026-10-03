// Orbit within limits around a home view, page-friendly gestures, and an easy
// glide back home (with an optional slow drift) once the visitor lets go.
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Spherical, Vector3, type PerspectiveCamera } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { usePageFriendlyGestures } from './gestures';
import { usePiece } from './mountCanvas';
import { damp } from './studio';

export interface Home {
  target: Vector3;
  dist: number;
  /** Radians from straight up. */
  polar: number;
  azimuth: number;
}

export function OrbitRig({
  home,
  polarRange = [0.35, 1.45],
  azimuthRange = 0.9,
  zoom = [0.7, 1.35],
  drift = 0,
  idleMs = 4000
}: {
  home: Home | null;
  polarRange?: [number, number];
  azimuthRange?: number;
  zoom?: [number, number];
  /** Azimuth swing (radians) of the idle drift; 0 for none. */
  drift?: number;
  idleMs?: number;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const { reducedMotion } = usePiece();
  const placed = useRef<Home | null>(null);
  const idleAt = useRef(-1e9);
  const dragging = useRef(false);
  const clock = useRef(0);
  const sph = useMemo(() => new Spherical(), []);
  const off = useMemo(() => new Vector3(), []);

  useLayoutEffect(() => {
    if (!home) return;
    const c = controls.current;
    const prev = placed.current;
    if (!prev) {
      sph.set(home.dist, home.polar, home.azimuth);
      camera.position.setFromSpherical(sph).add(home.target);
    } else {
      // Keep the visitor's angle and zoom when the stage resizes.
      off.copy(camera.position).sub(prev.target).multiplyScalar(home.dist / prev.dist);
      camera.position.copy(home.target).add(off);
    }
    placed.current = { ...home, target: home.target.clone() };
    const cam = camera as PerspectiveCamera;
    cam.near = home.dist * 0.05;
    cam.far = home.dist * 8;
    cam.updateProjectionMatrix();
    if (c) {
      c.target.copy(home.target);
      c.update();
    }
  }, [home, camera, sph, off]);

  usePageFriendlyGestures();

  useFrame((_, rawDt) => {
    const c = controls.current;
    const h = placed.current;
    if (!c || !h) return;
    const dt = Math.min(rawDt, 1 / 20);
    c.minDistance = h.dist * zoom[0];
    c.maxDistance = h.dist * zoom[1];
    if (dragging.current || reducedMotion || performance.now() - idleAt.current < idleMs) return;
    clock.current += dt;
    const t = clock.current;
    off.copy(camera.position).sub(c.target);
    sph.setFromVector3(off);
    sph.theta = damp(sph.theta, h.azimuth + drift * Math.sin(t * 0.21), 0.45, dt);
    sph.phi = damp(sph.phi, h.polar + (drift ? 0.2 * drift * Math.sin(t * 0.16 + 1.3) : 0), 0.45, dt);
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
      minPolarAngle={polarRange[0]}
      maxPolarAngle={polarRange[1]}
      minAzimuthAngle={home ? home.azimuth - azimuthRange : -azimuthRange}
      maxAzimuthAngle={home ? home.azimuth + azimuthRange : azimuthRange}
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
