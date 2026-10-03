// The globe itself, ported from tsi-globe (GlobeAnimated.tsx + Scene.tsx):
// a point cloud where land rises and falls with elevation, over a translucent
// sphere. Dark mode adds the radial backdrop and a faint star field.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, Vector2, Vector3 } from 'three';
import {
  attribute,
  float,
  fract,
  max,
  min,
  positionGeometry,
  screenUV,
  smoothstep,
  time,
  uniform,
  vec2,
  vec3,
  vec4
} from 'three/tsl';
import { MeshStandardNodeMaterial, PointsNodeMaterial, SpriteNodeMaterial } from 'three/webgpu';
import { usePiece } from '../lib/mountCanvas';
import type { Palette } from './palette';

/* eslint-disable @typescript-eslint/no-explicit-any */
type U<T> = { value: T };

function pointMaterial(radius: number) {
  const direction = positionGeometry;
  const meta = attribute('_meta', 'float');
  const elevation = max(meta, 0.0);
  const land = meta.greaterThanEqual(0.0).toFloat();

  const animate = uniform(1.0);
  const scale = uniform(0.09);
  const t = uniform(0.0);
  const cameraDelta = uniform(new Vector3());
  const landColor = uniform(new Color());
  const waterColor = uniform(new Color());
  const blendFactor = uniform(0.96);

  // Animated position
  const baseRadius = float(radius).add(elevation.mul(scale.mul(0.84)));
  const targetRadius = float(radius).add(elevation.mul(scale));
  const travelTime = float(3.6);
  const distance = targetRadius.sub(baseRadius);
  const directionHash = direction.dot(vec3(12.9898, 78.233, 37.719)).sin().mul(43758.5453).fract();
  const offset = directionHash.add(elevation.mul(0.36)).fract();
  const phase = fract(t.div(travelTime).add(offset));
  const easedT = phase.mul(phase).mul(float(3.0).sub(phase.mul(2.1)));
  const elevationWobbleScale = float(1.0).add(elevation.mul(3));
  const wobbleAxis = direction.cross(vec3(0.3, 1.0, 0.3)).add(direction.cross(vec3(1.0, 0.3, 0.3))).normalize();
  const wobbleSignal = t.mul(3).add(directionHash.mul(6)).sin();
  const wobbleEnvelope = easedT.mul(float(1.0).sub(easedT));
  const wobble = wobbleAxis.mul(wobbleSignal).mul(wobbleEnvelope).mul(0.006).mul(elevationWobbleScale).mul(land);
  const wobbledPosition = baseRadius.add(distance.mul(easedT)).add(wobble);
  const animatedPosition = targetRadius.add(wobbledPosition.sub(targetRadius).mul(animate));

  // Motion delay: high points trail the camera a little
  const worldPosition = animatedPosition.mul(direction);
  const cameraMotion = cameraDelta.negate();
  const viewDirection = worldPosition.normalize().add(wobble.mul(150));
  const lateralMotion = cameraMotion.sub(viewDirection.mul(cameraMotion.dot(viewDirection)));
  const elevationMask = smoothstep(0.03, 0.33, elevation);
  const blurFactor = elevation.mul(scale).mul(9).add(wobble.mul(scale)).mul(elevationMask).mul(animate);
  const position = worldPosition.add(lateralMotion.mul(blurFactor));

  // Fade the highest points as they top out
  const fadeThreshold = float(0.69);
  const rawFade = phase.sub(fadeThreshold).div(float(1.0).sub(fadeThreshold)).clamp(0.0, 1.0);
  const smoothFade = rawFade.mul(rawFade).mul(float(3.0).sub(rawFade.mul(2.0)));
  const fadeMask = elevation.greaterThanEqual(fadeThreshold).toFloat();
  const fade = float(1.0).sub(smoothFade.mul(fadeMask).mul(animate));

  // Color
  const landLow = landColor.mul(float(1.0).sub(blendFactor)).add(waterColor.mul(blendFactor));
  const landElevated = landLow.add(landColor.sub(landLow).mul(elevation));
  const color = land.equal(1.0).select(landElevated, waterColor);

  const material = new PointsNodeMaterial({ transparent: true });
  material.positionNode = position as any;
  material.colorNode = color as any;
  material.opacityNode = fade as any;

  return {
    material,
    u: { animate, scale, t, cameraDelta, landColor, waterColor, blendFactor } as unknown as {
      animate: U<number>;
      scale: U<number>;
      t: U<number>;
      cameraDelta: U<Vector3>;
      landColor: U<Color>;
      waterColor: U<Color>;
      blendFactor: U<number>;
    }
  };
}

export function Earth({ geometry, palette }: { geometry: BufferGeometry; palette: Palette }) {
  const { camera, scene } = useThree();
  const { reducedMotion, dark } = usePiece();
  const { material, u } = useMemo(() => pointMaterial(1.0), []);
  const prevCam = useRef(new Vector3());
  const smoothed = useRef(new Vector3());
  const delta = useMemo(() => new Vector3(), []);
  const clock = useRef(0);

  const sphereMat = useMemo(() => {
    const m = new MeshStandardNodeMaterial({ transparent: true, side: DoubleSide });
    return m;
  }, []);

  // Light that rides with the camera, as in tsi-globe.
  const camLight = useMemo(() => {
    const l = new DirectionalLight('#ffffff', 0.6);
    l.position.set(0, -6, -3);
    return l;
  }, []);
  useEffect(() => {
    camera.add(camLight);
    scene.add(camera);
    return () => {
      camera.remove(camLight);
      scene.remove(camera);
    };
  }, [camera, scene, camLight]);

  useEffect(() => {
    u.landColor.value.set(palette.land);
    u.waterColor.value.set(palette.water);
    u.blendFactor.value = palette.blend;
    u.scale.value = palette.scale;
    sphereMat.color.set(palette.water);
    sphereMat.emissive.set(palette.water);
    sphereMat.emissiveIntensity = palette.sphereGlow;
    sphereMat.opacity = palette.sphereOpacity;
  }, [palette, u, sphereMat]);

  useEffect(() => {
    u.animate.value = reducedMotion ? 0 : 1;
  }, [reducedMotion, u]);

  useEffect(
    () => () => {
      material.dispose();
      sphereMat.dispose();
      geometry.dispose();
    },
    [material, sphereMat, geometry]
  );

  useFrame((state, dt) => {
    if (!reducedMotion) clock.current += Math.min(dt, 0.1);
    u.t.value = clock.current;
    const cam = state.camera.position;
    if (reducedMotion) smoothed.current.set(0, 0, 0);
    else if (prevCam.current.lengthSq() > 0) {
      delta.subVectors(cam, prevCam.current);
      const clamped = Math.min(dt, 0.24);
      const alpha = 1 - Math.exp(-6 * clamped);
      smoothed.current.lerp(delta, alpha);
      smoothed.current.clampLength(0, 0.24);
    }
    u.cameraDelta.value.copy(smoothed.current);
    prevCam.current.copy(cam);
  });

  return (
    <>
      <ambientLight intensity={palette.lightIntensity / 2} />
      <directionalLight position={[1.2, 0, 0.66]} color={palette.light} intensity={palette.lightIntensity} />
      {dark && <Backdrop strength={palette.backdrop} />}
      {dark && <Stars still={reducedMotion} />}
      <points geometry={geometry} material={material} frustumCulled={false} />
      <mesh material={sphereMat}>
        <sphereGeometry args={[0.999, 96, 64]} />
      </mesh>
    </>
  );
}

// A soft dark disc behind the globe. Fades out before the stage edges so the
// canvas never shows as a box on the page.
function edgeFade() {
  const e = min(min(screenUV.x, float(1).sub(screenUV.x)), min(screenUV.y, float(1).sub(screenUV.y)));
  return smoothstep(0.0, 0.22, e);
}

function Backdrop({ strength }: { strength: number }) {
  const { camera, size } = useThree();
  const { material, u } = useMemo(() => {
    const center = uniform(new Vector2(0.5, 0.5));
    const aspect = uniform(1.0);
    const inner = uniform(0.2);
    const outer = uniform(0.5);
    const m = new SpriteNodeMaterial({ transparent: true, depthWrite: false, depthTest: false });
    // Distance from the globe's center on screen, in units of stage height.
    const d = screenUV.sub(center).mul(vec2(aspect, 1.0)).length();
    const a = float(1.0).sub(smoothstep(inner, outer, d)).mul(strength);
    m.colorNode = vec4(0, 0, 0, a) as any;
    return { material: m, u: { center, aspect, inner, outer } as unknown as Record<'aspect' | 'inner' | 'outer', { value: number }> & { center: { value: Vector2 } } };
  }, [strength]);
  const p = useMemo(() => new Vector3(), []);
  useFrame(() => {
    p.set(0, 0, 0).project(camera);
    u.center.value.set((p.x + 1) / 2, (1 - p.y) / 2);
    u.aspect.value = size.width / Math.max(1, size.height);
    const dist = camera.position.length();
    const fov = ((camera as any).fov ?? 30) * (Math.PI / 180);
    const r = 0.5 / (Math.tan(fov / 2) * Math.sqrt(Math.max(1e-3, dist * dist - 1))); // globe radius / stage height
    // never reach past the stage edge, so the canvas has no visible box
    const edge = Math.min(u.center.value.y, 1 - u.center.value.y, u.center.value.x * u.aspect.value, (1 - u.center.value.x) * u.aspect.value);
    u.outer.value = Math.min(edge - 0.01, r * 2.1);
    u.inner.value = Math.min(u.outer.value - 0.05, r * 0.9);
  });
  useEffect(() => () => material.dispose(), [material]);
  return <sprite material={material} scale={[30, 30, 1]} renderOrder={-1} frustumCulled={false} />;
}

function Stars({ still }: { still: boolean }) {
  const { geometry, material } = useMemo(() => {
    const n = 1400;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Uniform on a shell well behind the globe.
      const z = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 20;
      const s = Math.sqrt(1 - z * z);
      pos.set([r * s * Math.cos(a), r * z, r * s * Math.sin(a)], i * 3);
      seed[i] = Math.random();
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('_seed', new BufferAttribute(seed, 1));
    const m = new PointsNodeMaterial({ transparent: true, depthWrite: false });
    const s = attribute('_seed', 'float');
    const twinkle = still ? float(0.8) : time.mul(s.mul(1.3).add(0.4)).add(s.mul(40)).sin().mul(0.35).add(0.65);
    const bright = s.pow(3.0).mul(0.75).add(0.12);
    m.colorNode = vec3(0.86, 0.9, 1.0) as any;
    m.opacityNode = bright.mul(twinkle).mul(edgeFade()) as any;
    return { geometry: g, material: m };
  }, [still]);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material]
  );
  return <points geometry={geometry} material={material} renderOrder={-2} frustumCulled={false} />;
}
