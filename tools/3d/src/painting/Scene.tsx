// The watercolor on a sheet of cold-press paper. The scan sits inside a narrow
// unpainted border; the paper has real thickness and a procedural grain that a
// raking key light picks out. The sheet tilts toward the cursor (or follows a
// sideways drag on touch) and settles back; a soft shadow on an invisible wall
// behind it slides the other way. Reduced motion: a still sheet, no tilt.
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  BoxGeometry,
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SRGBColorSpace,
  type PerspectiveCamera
} from 'three';
import { usePiece } from '../lib/mountCanvas';
import { damp, Studio } from '../lib/studio';
import { useNear } from '../lib/view';

const H = 2; // sheet height, scene units
const BORDER = 0.045; // unpainted margin, as a share of the sheet's width
const THICK = 0.012; // a heavy sheet, a little exaggerated so the edge reads when tilted
const TILT = 0.2; // radians toward the cursor at the stage's edge
const DRAG = 0.42; // radians for a full-width drag on touch
const PAPER = '#f2efe7';

export function PaintingScene({ src, onReady }: { src: string; onReady: () => void }) {
  const { dark, el } = usePiece();
  const near = useNear(el);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!near) return;
    let live = true;
    const i = new Image();
    i.decoding = 'async';
    i.onload = () => live && setImg(i);
    i.src = src;
    return () => {
      live = false;
    };
  }, [near, src]);
  return (
    <>
      <Studio dark={dark} />
      {/* Raking key from the upper left: it's what makes the grain read. */}
      <directionalLight position={[-3.2, 2.6, 1.6]} intensity={dark ? 0.9 : 1.05} />
      <ambientLight intensity={dark ? 0.08 : 0.12} />
      {img && <Sheet img={img} onReady={onReady} />}
    </>
  );
}

// Cold-press grain: tileable value noise at two scales, as a bump map.
function grainTexture() {
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d')!;
  const data = ctx.createImageData(N, N);
  const octave = (cells: number, seed: number) => {
    const g = new Float32Array(cells * cells);
    let s = seed;
    for (let i = 0; i < g.length; i++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      g[i] = s / 4294967296;
    }
    const at = (x: number, y: number) => g[((y + cells) % cells) * cells + ((x + cells) % cells)];
    const out = new Float32Array(N * N);
    const k = cells / N;
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const fx = x * k, fy = y * k;
        const x0 = Math.floor(fx), y0 = Math.floor(fy);
        let tx = fx - x0, ty = fy - y0;
        tx = tx * tx * (3 - 2 * tx);
        ty = ty * ty * (3 - 2 * ty);
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
        out[y * N + x] = a + (b - a) * ty;
      }
    }
    return out;
  };
  const coarse = octave(64, 7);
  const fine = octave(160, 13);
  for (let i = 0; i < N * N; i++) {
    // Rounded bumps with flatter valleys, like pressed cotton paper.
    const v = Math.pow(coarse[i], 1.6) * 0.7 + fine[i] * 0.3;
    const p = Math.round(v * 255);
    data.data[i * 4] = data.data[i * 4 + 1] = data.data[i * 4 + 2] = p;
    data.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(data, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

// The front face: paper, then the scan inside the border.
function faceTexture(img: HTMLImageElement, w: number, h: number) {
  const scale = Math.min(2048 / h, (img.naturalHeight / (1 - 2 * BORDER * (w / h))) / h);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, c.width, c.height);
  const b = BORDER * c.width;
  ctx.drawImage(img, b, b, c.width - 2 * b, c.height - 2 * b);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.minFilter = LinearFilter;
  t.generateMipmaps = false;
  return t;
}

// A soft rectangle, blurred on a canvas: the shadow on the wall behind.
function shadowTexture(aspect: number) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.round(256 / aspect);
  const ctx = c.getContext('2d')!;
  const pad = 40;
  ctx.filter = 'blur(16px)';
  ctx.fillStyle = '#000';
  ctx.fillRect(pad, pad, c.width - 2 * pad, c.height - 2 * pad);
  return new CanvasTexture(c);
}

function Sheet({ img, onReady }: { img: HTMLImageElement; onReady: () => void }) {
  const { dark, reducedMotion, el } = usePiece();
  const { camera, size, invalidate } = useThree();
  const sheet = useRef<Group>(null);
  const shade = useRef<Mesh>(null);

  // The scan fills the sheet minus the border on every side.
  const inner = img.naturalWidth / img.naturalHeight;
  const W = useMemo(() => {
    // (W - 2bW) / (H - 2bW) = inner  ->  W = inner*H / (1 - 2b + 2b*inner)
    return (inner * H) / (1 - 2 * BORDER + 2 * BORDER * inner);
  }, [inner]);

  const built = useMemo(() => {
    const grain = grainTexture();
    grain.repeat.set(3 * (W / H), 3);
    const face = faceTexture(img, W, H);
    const front = new MeshStandardMaterial({ map: face, bumpMap: grain, bumpScale: 0.55, roughness: 0.93, metalness: 0 });
    const edgeGrain = grain.clone();
    edgeGrain.repeat.set(3, 3);
    const paper = new MeshStandardMaterial({ color: new Color(PAPER), bumpMap: edgeGrain, bumpScale: 1, roughness: 0.96, metalness: 0 });
    const geo = new BoxGeometry(W, H, THICK);
    const sh = shadowTexture(W / H);
    const shadow = new MeshBasicMaterial({ map: sh, color: '#000000', transparent: true, depthWrite: false, opacity: 0.3 });
    const shadowGeo = new PlaneGeometry(W * 1.12, H * 1.1);
    return { grain, edgeGrain, face, front, paper, geo, sh, shadow, shadowGeo };
  }, [img, W]);
  useEffect(
    () => () => {
      const b = built;
      [b.grain, b.edgeGrain, b.face, b.sh].forEach((t) => t.dispose());
      [b.front, b.paper, b.shadow].forEach((m) => m.dispose());
      b.geo.dispose();
      b.shadowGeo.dispose();
    },
    [built]
  );
  // The scan already carries the grain it was photographed with; the bump only
  // has to answer the light. Dark mode's rim strips rake harder, so less there.
  useEffect(() => {
    built.shadow.opacity = dark ? 0.55 : 0.34;
    built.front.bumpScale = dark ? 0.3 : 0.55;
    built.paper.bumpScale = dark ? 0.35 : 0.6;
    invalidate();
  }, [dark, built, invalidate]);

  // Frame the sheet with room for the tilt and the shadow.
  useLayoutEffect(() => {
    const cam = camera as PerspectiveCamera;
    const tv = Math.tan((cam.fov * Math.PI) / 360);
    const aspect = size.width / size.height;
    const fill = 0.8;
    const d = Math.max(H / 2 / (tv * fill), W / 2 / (tv * aspect * fill));
    cam.position.set(0, 0, d);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    invalidate();
  }, [camera, size.width, size.height, W, invalidate]);

  // Where the sheet wants to face: the cursor over the stage, a drag on touch.
  const aim = useRef({ x: 0, y: 0, active: false });
  useEffect(() => {
    if (reducedMotion) return;
    let drag: { id: number; x0: number; y0: number } | null = null;
    const norm = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: ((e.clientY - r.top) / r.height) * 2 - 1, w: r.width };
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') {
        if (!drag || e.pointerId !== drag.id) return;
        const r = el.getBoundingClientRect();
        aim.current = {
          x: Math.max(-1, Math.min(1, ((e.clientX - drag.x0) / r.width) * (DRAG / TILT))),
          y: Math.max(-1, Math.min(1, ((e.clientY - drag.y0) / r.height) * (DRAG / TILT) * 0.6)),
          active: true
        };
      } else {
        const p = norm(e);
        aim.current = { x: Math.max(-1, Math.min(1, p.x)), y: Math.max(-1, Math.min(1, p.y)), active: true };
      }
      invalidate();
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (drag && e.pointerId === drag.id) drag = null;
      aim.current = { x: 0, y: 0, active: false };
      invalidate();
    };
    const leave = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      aim.current = { x: 0, y: 0, active: false };
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerleave', leave);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointerleave', leave);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [el, reducedMotion, invalidate]);

  const st = useRef({ rx: 0, ry: 0, t: 0 });
  const readied = useRef(0);
  useFrame((_, raw) => {
    const dt = Math.min(raw, 1 / 20);
    const k = st.current;
    const s = sheet.current;
    if (!s) return;
    if (!reducedMotion) {
      k.t += dt;
      const a = aim.current;
      // A slow breath while nobody's touching it, so it reads as an object.
      const idle = a.active ? 0 : 1;
      const tx = a.y * TILT + idle * Math.sin(k.t * 0.55) * 0.025;
      const ty = a.x * TILT + idle * Math.sin(k.t * 0.4 + 1.3) * 0.045;
      k.rx = damp(k.rx, tx, a.active ? 7 : 2.4, dt);
      k.ry = damp(k.ry, ty, a.active ? 7 : 2.4, dt);
    }
    s.rotation.set(k.rx, k.ry, 0);
    // Light from the upper left, so the shadow falls down and right, and slides opposite the tilt.
    const sh = shade.current;
    if (sh) sh.position.set(0.11 - k.ry * 0.55, -0.15 + k.rx * 0.55, -0.42);
    if (readied.current < 3 && ++readied.current === 3) onReady();
  });
  // Still (reduced motion): frames only on demand, so draw a few and call it ready.
  useEffect(() => {
    if (!reducedMotion) return;
    invalidate();
    const t = setTimeout(onReady, 120);
    return () => clearTimeout(t);
  }, [reducedMotion, invalidate, onReady]);

  return (
    <>
      <mesh ref={shade} geometry={built.shadowGeo} material={built.shadow} renderOrder={-1} />
      <group ref={sheet}>
        <mesh geometry={built.geo} material={[built.paper, built.paper, built.paper, built.paper, built.front, built.paper]} />
      </group>
    </>
  );
}
