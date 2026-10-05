// My boxing gloves: /3d/gloves.js. The pair hangs by its lace from a peg and
// sways a little. Hover and they swing harder, a rim lights up and a "Spar?"
// tag shows; click (or Enter on the keyboard handle) and the sparring ring on
// the Muay Thai page opens (play/muaythai.js listens for dl:start).
import { useGLTF } from '@react-three/drei';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { NeutralToneMapping, Box3, Vector3, type Object3D, type PerspectiveCamera } from 'three';
import { mountCanvas, usePiece } from '../lib/mountCanvas';
import { applyRim, damp, makeRim, Studio } from '../lib/studio';
import { MODELS } from '../lib/view';

const FILE = MODELS + 'gloves.glb';

// The fight lives in the muay thai piece; the gloves just start it.
function spar() {
  const ring = document.querySelector('main [data-play="muaythai"]');
  if (ring) ring.dispatchEvent(new CustomEvent('dl:start'));
  (window as unknown as { dlFound?: (id: string) => void }).dlFound?.('spar');
}

let hovered = false;
let tag: HTMLElement | null = null;
const setHover = (v: boolean, root?: HTMLElement) => {
  hovered = v;
  tag?.classList.toggle('on', v);
  if (root) root.style.cursor = v ? 'pointer' : '';
};

function Gloves() {
  const gltf = useGLTF(FILE, false, true);
  const { reducedMotion, dark, root } = usePiece();
  const { camera, size } = useThree();
  const built = useMemo(() => {
    const object = gltf.scene.clone(true);
    const rim = makeRim();
    const mats = applyRim(object, rim);
    object.updateMatrixWorld(true);
    const box = new Box3().setFromObject(object);
    const pair = object.getObjectByName('pair') as Object3D | undefined;
    return { object, rim, mats, box, pair };
  }, [gltf]);
  useEffect(() => () => built.mats.forEach((m) => m.dispose()), [built]);

  // Fit the whole thing, peg to fists, with a little room to swing.
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    const c = built.box.getCenter(new Vector3());
    const s = built.box.getSize(new Vector3());
    const fit = (Math.max(s.y, s.x / (size.width / size.height)) * 0.62) / Math.tan((cam.fov * Math.PI) / 360);
    cam.position.set(c.x, c.y + s.y * 0.04, c.z + fit);
    cam.lookAt(c.x, c.y, c.z);
    cam.updateProjectionMatrix();
  }, [built, camera, size.width, size.height]);

  const k = useRef({ t: 0, amp: 0.03, speed: 1.3 });
  useFrame((_, raw) => {
    const dt = Math.min(raw, 1 / 20);
    const s = k.current;
    s.amp = damp(s.amp, hovered ? 0.11 : 0.03, 3, dt);
    s.speed = damp(s.speed, hovered ? 2.6 : 1.3, 3, dt);
    s.t += dt * s.speed;
    if (built.pair && !reducedMotion) {
      built.pair.rotation.z = Math.sin(s.t) * s.amp;
      built.pair.rotation.y = Math.sin(s.t * 0.7) * s.amp * 0.6;
    }
    built.rim.uRim.value = damp(built.rim.uRim.value, hovered ? 0.7 : 0, 10, dt);
  });

  const over = (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); setHover(true, root); };
  const out = () => setHover(false, root);
  const click = (e: ThreeEvent<MouseEvent>) => { if (e.delta > 6) return; e.stopPropagation(); setHover(false, root); spar(); };
  const c = built.box.getCenter(new Vector3());
  const sz = built.box.getSize(new Vector3());
  return (
    <>
      <Studio dark={dark} />
      <primitive object={built.object} />
      <mesh position={c} visible={false} onPointerOver={over} onPointerOut={out} onClick={click}>
        <boxGeometry args={[sz.x, sz.y, sz.z * 1.4]} />
      </mesh>
    </>
  );
}

const CSS = `
.p3d-gloves .gv-tag { position: absolute; left: 50%; bottom: 6%; z-index: 2; padding: 6px 14px; border-radius: 999px; background: #88c0d0; color: #0d1418; font-weight: 500; white-space: nowrap; pointer-events: none; transform: translate(-50%, 6px); opacity: 0; transition: opacity 160ms ease, transform 160ms ease; }
.p3d-gloves .gv-tag.on { opacity: 1; transform: translate(-50%, 0); }
.p3d-gloves .gv-sr { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
.p3d-gloves .gv-sr:focus-visible { position: absolute; left: 50%; bottom: 6%; width: auto; height: auto; padding: 6px 14px; clip-path: none; border-radius: 999px; background: #88c0d0; color: #0d1418; transform: translateX(-50%); }
@media (hover: none) { .p3d-gloves .gv-tag { opacity: 1; transform: translate(-50%, 0); } }
`;

function Overlay() {
  return (
    <>
      <span className="gv-tag" ref={(el) => { tag = el; }} aria-hidden="true">Spar?</span>
      <button type="button" className="gv-sr" onClick={spar}>Spar with the head</button>
    </>
  );
}

export function mount(el: HTMLElement): () => void {
  return mountCanvas(el, {
    className: 'p3d-gloves',
    css: CSS,
    camera: { fov: 28, near: 0.02, far: 20, position: [0, 0.22, 1.4] },
    scene: <Gloves />,
    html: <Overlay />,
    canvas: { onCreated: ({ gl }) => { gl.toneMapping = NeutralToneMapping; } },
    fallback: 'My gloves, hanging up. Click to spar.'
  });
}
