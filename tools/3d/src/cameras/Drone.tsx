// The Mini 4K's little flight: props spin up, it climbs and hovers, the page
// jumps to the footage, then it settles back down. Reduced motion skips the
// flight and goes straight to the footage.
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { CircleGeometry, Color, Group, Mesh, ShaderMaterial, type Object3D } from 'three';
import { usePiece } from '../lib/mountCanvas';
import { useKit } from './store';

const SPIN_MAX = 46; // rad/s at full throttle
const CLIMB = 0.085; // meters
const HOVER_S = 4.2;

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function Drone({ object, dirty, children }: { object: Object3D; dirty: { current: number }; children: ReactNode }) {
  const fly = useKit((s) => s.fly);
  const { reducedMotion } = usePiece();
  const flight = useRef<Group>(null);
  // t: seconds into the flight, -1 when parked. hold: hover time left.
  const st = useRef({ t: -1, hold: 0, told: false, spin: 0 });

  const props = useMemo(() => {
    const out: { node: Object3D; dir: number; disc: Mesh }[] = [];
    const geo = new CircleGeometry(1, 40).rotateX(-Math.PI / 2);
    // A spinning prop reads as a faint disc, denser toward the tips.
    const mat = new ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new Color('#8b929b') }, uOpacity: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader:
        'uniform vec3 uColor; uniform float uOpacity; varying vec2 vUv;' +
        'void main() { float r = length(vUv - 0.5) * 2.0;' +
        ' float a = smoothstep(0.12, 0.75, r) * (1.0 - smoothstep(0.9, 1.0, r));' +
        ' gl_FragColor = vec4(uColor, a * uOpacity); }'
    });
    for (const name of ['prop_fl', 'prop_fr', 'prop_rl', 'prop_rr']) {
      const node = object.getObjectByName(name);
      if (!node) continue;
      const geoNode = node.children[0];
      // Radius from the blade's extent around the pivot.
      let r = 0.048;
      if (geoNode) {
        const s = geoNode.scale.x;
        if (s > 0.02 && s < 0.08) r = s;
      }
      const disc = new Mesh(geo, mat);
      disc.scale.setScalar(r);
      disc.position.y = 0.002;
      disc.renderOrder = 3;
      disc.visible = false;
      disc.raycast = () => {};
      node.parent?.add(disc);
      disc.position.add(node.position);
      out.push({ node, dir: Number(node.userData?.spin) || 1, disc });
    }
    return { list: out, geo, mat };
  }, [object]);
  useEffect(
    () => () => {
      for (const p of props.list) p.disc.removeFromParent();
      props.geo.dispose();
      props.mat.dispose();
    },
    [props]
  );

  // Each click (re)starts or extends the flight.
  const lastFly = useRef(fly);
  useEffect(() => {
    if (fly === lastFly.current) return;
    lastFly.current = fly;
    const s = st.current;
    if (reducedMotion) {
      document.dispatchEvent(new CustomEvent('dl:footage'));
      return;
    }
    if (s.t < 0) {
      s.t = 0;
      s.told = false;
      s.hold = HOVER_S;
    } else {
      // Already up: keep hovering a bit longer and point at the footage again.
      s.hold = Math.max(s.hold, HOVER_S);
      if (s.t > 2.2) s.t = 2.2;
      document.dispatchEvent(new CustomEvent('dl:footage'));
    }
  }, [fly, reducedMotion]);

  useFrame((state, rawDt) => {
    const g = flight.current;
    const s = st.current;
    if (!g || s.t < 0) return;
    const dt = Math.min(rawDt, 1 / 20);
    s.t += dt;
    // Timeline: 0-0.8 spin up, 0.5-2.1 climb, then hover for `hold`, 1.6 s down, spin down.
    const up = 2.1;
    const hoverEnd = up + s.hold;
    const down = hoverEnd + 1.6;
    const end = down + 0.9;
    let y = 0;
    let throttle = 0;
    if (s.t < up) {
      throttle = ease(clamp01(s.t / 0.8));
      y = CLIMB * ease(clamp01((s.t - 0.5) / 1.6));
    } else if (s.t < hoverEnd) {
      throttle = 1;
      y = CLIMB + 0.004 * Math.sin((s.t - up) * 2.4);
    } else if (s.t < down) {
      throttle = 1 - 0.25 * clamp01((s.t - hoverEnd) / 1.6);
      y = CLIMB * (1 - ease(clamp01((s.t - hoverEnd) / 1.6))) + 0.004 * Math.sin((s.t - up) * 2.4) * (1 - clamp01((s.t - hoverEnd) / 1.6));
    } else {
      throttle = 0.75 * (1 - ease(clamp01((s.t - down) / 0.9)));
      y = 0;
    }
    if (!s.told && s.t > 1.5) {
      s.told = true;
      document.dispatchEvent(new CustomEvent('dl:footage'));
    }
    g.position.y = Math.max(0, y);
    // A touch of attitude: nose dips as it climbs, a slow wobble at the hover.
    const k = Math.min(1, y / CLIMB);
    g.rotation.x = 0.05 * Math.sin(Math.PI * clamp01((s.t - 0.5) / 1.6)) * (s.t < up ? 1 : 0) + 0.012 * k * Math.sin(state.clock.elapsedTime * 1.7);
    g.rotation.z = 0.014 * k * Math.sin(state.clock.elapsedTime * 1.3 + 0.7);
    s.spin = throttle * SPIN_MAX;
    for (const p of props.list) {
      p.node.rotation.y += p.dir * s.spin * dt;
      const blur = clamp01((s.spin - 14) / 26);
      p.disc.visible = blur > 0.01;
      props.mat.uniforms.uOpacity.value = 0.22 * blur;
    }
    dirty.current = Math.max(dirty.current, 1);
    if (s.t >= end) {
      s.t = -1;
      g.position.y = 0;
      g.rotation.set(0, 0, 0);
      for (const p of props.list) p.disc.visible = false;
    }
  });

  return <group ref={flight}>{children}</group>;
}
