// Shared studio for the product-style pieces (cameras, guitar, rackets, bike):
// a generated environment (no HDR download), soft contact shadows that only
// re-render when something moved, an optional pool of light on the floor, and
// an accent rim that a hover can turn up on any part of a model.
import { Environment, Lightformer } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Color,
  Group,
  Vector3,
  Mesh,
  MeshBasicMaterial,
  MeshDepthMaterial,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  WebGLRenderTarget,
  type Material,
  type Object3D
} from 'three';
import { HorizontalBlurShader, VerticalBlurShader } from 'three-stdlib';

export const ACCENT = '#88c0d0';

/**
 * Studio lighting as an environment map, rendered once from light cards.
 * Light: a bright, airy softbox studio. Dark: dimmer, with stronger rim strips
 * so black camera bodies still read against a near-black page.
 */
export function Studio({ dark, children }: { dark: boolean; children?: ReactNode }) {
  return (
    <Environment key={dark ? 'd' : 'l'} resolution={256} frames={1} environmentIntensity={dark ? 1.1 : 1}>
      <color attach="background" args={[dark ? '#383b42' : '#d9dadf']} />
      {/* overhead softbox */}
      <Lightformer form="rect" intensity={dark ? 2.6 : 2.6} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={dark ? [11, 11, 1] : [7, 7, 1]} />
      {/* key, front left */}
      <Lightformer form="rect" intensity={dark ? 4 : 2.4} position={[-5, 3, 4]} scale={dark ? [6, 4, 1] : [3.5, 2.5, 1]} target={[0, 0, 0]} />
      {/* fill, front right */}
      <Lightformer form="rect" intensity={dark ? 1.3 : 1.1} position={[5, 2, 3]} scale={dark ? [5, 4, 1] : [3, 2.5, 1]} target={[0, 0, 0]} />
      {/* rim strips behind and to the sides */}
      <Lightformer form="rect" intensity={dark ? 4.5 : 1.6} position={[0, 2, -6]} scale={[10, 0.8, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={dark ? 2.6 : 0.8} position={[-6, 1.2, -2]} scale={[0.6, 4, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={dark ? 2.6 : 0.8} position={[6, 1.2, -2]} scale={[0.6, 4, 1]} target={[0, 0, 0]} />
      {children}
    </Environment>
  );
}

export interface PoolProps {
  radius: number;
  color: string;
  opacity: number;
}

/**
 * Contact shadows on an invisible floor at y=0 (local). Renders the scene
 * from below into a small blurred depth map; only while dirty.current > 0, so
 * a still scene costs nothing. Anything that moves bumps dirty.
 */
export function ContactShadow({
  width,
  height,
  resolution = 512,
  blur = 2.4,
  far = 0.25,
  opacity = 0.55,
  color = '#000000',
  dirty,
  pool,
  position
}: {
  width: number;
  height: number;
  resolution?: number;
  blur?: number;
  far?: number;
  opacity?: number;
  color?: string;
  dirty: { current: number };
  pool?: PoolProps | null;
  position?: [number, number, number];
}) {
  const scene = useThree((s) => s.scene);
  const gl = useThree((s) => s.gl);
  const group = useRef<Group>(null);
  const r = useMemo(() => {
    const target = new WebGLRenderTarget(resolution, resolution);
    const targetBlur = new WebGLRenderTarget(resolution, resolution);
    target.texture.generateMipmaps = targetBlur.texture.generateMipmaps = false;
    const plane = new PlaneGeometry(width, height).rotateX(Math.PI / 2);
    const blurPlane = new Mesh(plane);
    const depth = new MeshDepthMaterial();
    depth.depthTest = depth.depthWrite = false;
    const tint = new Color(color);
    depth.onBeforeCompile = (shader) => {
      shader.uniforms.ucolor = { value: tint };
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 ucolor;\nvoid main() {')
        .replace('vec4( vec3( 1.0 - fragCoordZ ), opacity );', 'vec4( ucolor * fragCoordZ * 2.0, ( 1.0 - fragCoordZ ) * 1.0 );');
    };
    const hBlur = new ShaderMaterial(HorizontalBlurShader);
    const vBlur = new ShaderMaterial(VerticalBlurShader);
    hBlur.depthTest = vBlur.depthTest = false;
    const cam = new OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 0, far);
    const shadowMat = new MeshBasicMaterial({ transparent: true, map: target.texture, depthWrite: false });
    return { target, targetBlur, plane, blurPlane, depth, hBlur, vBlur, cam, shadowMat };
  }, [resolution, width, height, far, color]);

  useEffect(() => {
    dirty.current = Math.max(dirty.current, 2);
    return () => {
      r.target.dispose();
      r.targetBlur.dispose();
      r.plane.dispose();
      r.depth.dispose();
      r.hBlur.dispose();
      r.vBlur.dispose();
      r.shadowMat.dispose();
    };
  }, [r, dirty]);
  useEffect(() => {
    r.shadowMat.opacity = opacity;
  }, [r, opacity]);

  const blurPass = (amount: number) => {
    const { blurPlane, hBlur, vBlur, target, targetBlur, cam } = r;
    blurPlane.visible = true;
    blurPlane.material = hBlur;
    hBlur.uniforms.tDiffuse.value = target.texture;
    hBlur.uniforms.h.value = amount / 256;
    gl.setRenderTarget(targetBlur);
    gl.render(blurPlane, cam);
    blurPlane.material = vBlur;
    vBlur.uniforms.tDiffuse.value = targetBlur.texture;
    vBlur.uniforms.v.value = amount / 256;
    gl.setRenderTarget(target);
    gl.render(blurPlane, cam);
    blurPlane.visible = false;
  };

  useFrame(() => {
    const g = group.current;
    if (!g || dirty.current <= 0) return;
    dirty.current--;
    const bg = scene.background;
    const override = scene.overrideMaterial;
    g.visible = false;
    scene.background = null;
    scene.overrideMaterial = r.depth;
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(r.target);
    gl.clear();
    gl.render(scene, r.cam);
    blurPass(blur);
    blurPass(blur * 0.4);
    gl.setRenderTarget(prev);
    g.visible = true;
    scene.overrideMaterial = override;
    scene.background = bg;
  });

  return (
    <group ref={group} position={position}>
      {pool && <Pool {...pool} />}
      <group rotation-x={Math.PI / 2}>
        <mesh geometry={r.plane} material={r.shadowMat} scale={[1, -1, 1]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} />
        <primitive object={r.cam} />
      </group>
    </group>
  );
}

/**
 * A soft round glow that fades to nothing, standing upright. With `behind`, it
 * stays behind `around` as seen from the camera (a light on the backdrop that
 * follows an orbit), `behind` meters further back.
 */
export function Glow({
  position,
  rotation,
  behind,
  around,
  ...p
}: PoolProps & { position?: [number, number, number]; rotation?: [number, number, number]; behind?: number; around?: Vector3 }) {
  const g = useRef<Group>(null);
  const v = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    if (!g.current || behind == null || !around) return;
    v.copy(around).sub(camera.position).normalize();
    g.current.position.copy(around).addScaledVector(v, behind);
    g.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={g} position={position} rotation={rotation}>
      <Pool {...p} upright />
    </group>
  );
}

function Pool({ radius, color, opacity, upright }: PoolProps & { upright?: boolean }) {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: opacity } },
        vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader:
          'uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;' +
          'void main() { float r = length(vUv - 0.5) * 2.0; float a = pow(clamp(1.0 - r, 0.0, 1.0), 1.8);' +
          ' gl_FragColor = vec4(uColor, a * uOpacity); }'
      }),
    []
  );
  useEffect(() => {
    mat.uniforms.uColor.value.set(color);
    mat.uniforms.uOpacity.value = opacity;
  }, [mat, color, opacity]);
  useEffect(() => () => mat.dispose(), [mat]);
  return (
    <mesh rotation-x={upright ? 0 : -Math.PI / 2} position-y={upright ? 0 : -0.0004} material={mat} renderOrder={1}>
      <planeGeometry args={[radius * 2, radius * 2]} />
    </mesh>
  );
}

export interface Rim {
  uRim: { value: number };
  uRimColor: { value: Color };
}

export function makeRim(color = ACCENT): Rim {
  return { uRim: { value: 0 }, uRimColor: { value: new Color(color) } };
}

/**
 * Clones every material under root and adds a fresnel rim in the accent color
 * whose strength is rim.uRim.value (0 off, 1 full). Returns the clones so the
 * caller can dispose them.
 */
export function applyRim(root: Object3D, rim: Rim): Material[] {
  const made: Material[] = [];
  const seen = new Map<Material, Material>();
  const patch = (m: Material) => {
    let c = seen.get(m);
    if (c) return c;
    c = m.clone();
    c.onBeforeCompile = (shader) => {
      shader.uniforms.uRim = rim.uRim;
      shader.uniforms.uRimColor = rim.uRimColor;
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uRim;\nuniform vec3 uRimColor;')
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          if (uRim > 0.001) {
            float fr = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
            totalEmissiveRadiance += uRimColor * pow(fr, 4.5) * 1.8 * uRim;
          }`
        );
    };
    c.customProgramCacheKey = () => 'dl-rim';
    seen.set(m, c);
    made.push(c);
    return c;
  };
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(patch) : patch(mesh.material);
  });
  return made;
}

/** Eases a value toward a target, frame rate independent. */
export function damp(current: number, target: number, rate: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
