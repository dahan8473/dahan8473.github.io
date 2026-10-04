// The first person court: the game loop, the camera (your eyes), and the
// bridge to the DOM (the head's speech bubble, pops, a caret when the
// shuttle is off screen, and the head's rect for flying the real one in).
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { usePiece } from '../lib/mountCanvas';
import { ACCENT } from '../lib/studio';
import { ContactRing, Head, HandRacket, Reticle, Shuttle } from './Actors';
import { Court, PALETTE } from './Court';
import { EYE, FOE_H, FOE_W, type Rally } from './engine';

export interface Ui {
  say: HTMLDivElement | null;
  pops: HTMLDivElement | null;
  caret: HTMLDivElement | null;
  /** Screen rect of the head billboard (px, viewport), set every frame. */
  head: { x: number; y: number; w: number; h: number } | null;
  /** Called once the scene has drawn a few frames. */
  onReady: () => void;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function RallyScene({ g, ui, model, foeModel }: { g: Rally; ui: Ui; model: string; foeModel: string }) {
  const { dark } = usePiece();
  const p = PALETTE[dark ? 'dark' : 'light'];
  return (
    <>
      <Sim g={g} />
      <Eyes g={g} />
      <Court p={p} />
      <Head g={g} model={foeModel} p={p} />
      <Shuttle g={g} p={p} dark={dark} />
      <Reticle g={g} accent={ACCENT} />
      <ContactRing g={g} />
      <HandRacket g={g} model={model} />
      <Project g={g} ui={ui} />
    </>
  );
}

function Sim({ g }: { g: Rally }) {
  useFrame((_, dt) => g.update(Math.min(dt, 0.05)), -3);
  return null;
}

/** Your eyes: where your body is, looking across, following the shuttle a little. */
function Eyes({ g }: { g: Rally }) {
  const { camera, size } = useThree();
  const look = useMemo(() => new Vector3(0, 1.2, -6), []);
  const view = useRef({ yaw: 0, pitch: -0.05, first: true });
  const want = useMemo(() => new Vector3(), []);
  const walk = useRef(0);
  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const cam = camera as PerspectiveCamera;
    // Keep about 64 degrees across, within reason on a tall phone.
    const aspect = size.width / Math.max(1, size.height);
    const fov = clamp((2 * Math.atan(Math.tan((32 * Math.PI) / 180) / aspect) * 180) / Math.PI, 52, 86);
    if (Math.abs(cam.fov - fov) > 0.05 || cam.near !== 0.04) {
      cam.fov = fov;
      cam.near = 0.04;
      cam.far = 120;
      cam.updateProjectionMatrix();
    }
    const m = g.me;
    const reduce = g.o.reduce;
    const speed = Math.hypot(m.vx, m.vz);
    walk.current += speed * dt * 2.2;
    const bob = reduce ? 0 : Math.sin(walk.current * 2) * 0.018 * clamp(speed / 3, 0, 1);
    camera.position.set(m.x, EYE + bob, m.z);
    if (g.shake > 0 && !reduce) {
      const a = g.shake * 0.12;
      camera.position.x += (Math.random() - 0.5) * a;
      camera.position.y += (Math.random() - 0.5) * a;
    }
    if (g.shake > 0) g.shake = Math.max(0, g.shake - dt);
    // Across the net toward the head, and partway to the shuttle when it's
    // live: blended as angles, so a shuttle right overhead pulls the view up.
    want.set(g.foe.x * 0.3 + m.x * 0.25, 1.15, -6.5);
    const sh = g.sh;
    if (g.phase === 'serve' && sh.held === 'me') want.set(m.x * 0.5 + 0.3, 0.9, -5);
    let yaw = Math.atan2(want.x - m.x, m.z - want.z);
    let pitch = Math.atan2(want.y - EYE, Math.hypot(want.x - m.x, want.z - m.z));
    let maxPitch = 0.6;
    if ((g.phase === 'rally' || g.phase === 'point') && !sh.held) {
      const mine = sh.last === 'foe' && !sh.down && !sh.netted && sh.z > -0.5;
      const w = sh.down ? 0.25 : mine ? 0.8 : sh.last === 'foe' ? 0.5 : 0.35;
      const hd = Math.max(0.35, Math.hypot(sh.x - m.x, sh.z - m.z));
      const sy = Math.atan2(sh.x - m.x, Math.max(0.2, m.z - sh.z));
      const sp = Math.atan2(sh.y - EYE, hd);
      yaw += (clamp(sy, -0.9, 0.9) - yaw) * w;
      pitch += (sp - pitch) * w;
      if (mine) maxPitch = 1.12;
    }
    pitch = clamp(pitch, -0.45, maxPitch);
    const ang = view.current;
    // Snappier right after your hit, so you see where it goes.
    const quick = sh.last === 'me' && g.gt - sh.at > 0.07 && g.gt - sh.at < 0.6 && !sh.held;
    const k = reduce ? 1 - Math.exp(-14 * dt) : 1 - Math.exp(-(quick ? 10 : 5.5) * dt);
    ang.yaw += (yaw - ang.yaw) * k;
    ang.pitch += (pitch - ang.pitch) * k;
    look.set(
      camera.position.x + Math.sin(ang.yaw) * Math.cos(ang.pitch) * 6,
      camera.position.y + Math.sin(ang.pitch) * 6,
      camera.position.z - Math.cos(ang.yaw) * Math.cos(ang.pitch) * 6
    );
    camera.lookAt(look);
    camera.updateMatrixWorld();
  }, -2);
  return null;
}

const _p = new Vector3();
/** Screen px of a world point, and whether it's in front of the camera. */
function project(v: Vector3, cam: PerspectiveCamera, w: number, h: number) {
  _p.copy(v).project(cam);
  return { x: ((_p.x + 1) / 2) * w, y: ((1 - _p.y) / 2) * h, front: _p.z < 1 };
}

function Project({ g, ui }: { g: Rally; ui: Ui }) {
  const { camera, size, gl } = useThree();
  const frames = useRef(0);
  const typed = useRef({ text: '', n: -1, w: 0, h: 0 });
  const v = useMemo(() => new Vector3(), []);
  useEffect(() => () => ui.pops?.replaceChildren(), [ui]);
  useFrame(() => {
    const cam = camera as PerspectiveCamera;
    const W = size.width, H = size.height;
    const rect = gl.domElement.getBoundingClientRect();
    if (frames.current++ === 3) ui.onReady();
    // The head's rect (for flying the floating head in and out).
    const f = g.foe;
    const yaw = Math.atan2(camera.position.x - f.x, camera.position.z - f.z);
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);
    const cy = g.foeY();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const sx of [-1, 1])
      for (const sy of [-1, 1]) {
        v.set(f.x + rx * sx * FOE_W * 0.5, cy + sy * FOE_H * 0.5, f.z + rz * sx * FOE_W * 0.5);
        const q = project(v, cam, W, H);
        x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x);
        y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
      }
    ui.head = { x: rect.left + x0, y: rect.top + y0, w: x1 - x0, h: y1 - y0 };

    // What the head is saying, typed out beside it.
    const say = ui.say;
    if (say) {
      const s = g.say;
      const on = g.wall < s.until && f.shown && !!s.text;
      const t = typed.current;
      if (s.text !== t.text) {
        t.text = s.text;
        t.n = -1;
        say.style.width = say.style.height = '';
        say.textContent = s.text;
        const b = say.getBoundingClientRect();
        t.w = Math.ceil(b.width) + 1;
        t.h = Math.ceil(b.height);
        say.style.width = t.w + 'px';
        say.style.height = t.h + 'px';
        say.textContent = '';
      }
      const chars = Array.from(s.text);
      const n = g.o.reduce ? chars.length : Math.min(chars.length, Math.floor((g.wall - s.t0) / 0.026));
      if (n !== t.n) {
        say.textContent = chars.slice(0, n).join('');
        t.n = n;
      }
      say.classList.toggle('on', on);
      if (on) {
        // Beside the head on its right (your left), else above it.
        let bx = x1 + 6, by = y0 + (y1 - y0) * 0.08;
        if (bx + t.w > W - 10) bx = x0 - t.w - 6;
        if (bx < 10) {
          bx = clamp((x0 + x1) / 2 - t.w / 2, 10, W - t.w - 10);
          by = y0 - t.h - 8;
        }
        say.style.transform = `translate(${bx.toFixed(1)}px,${clamp(by, 56, H - t.h - 10).toFixed(1)}px)`;
      }
    }

    // Pops: words that rise and fade where something happened.
    const pops = ui.pops;
    if (pops) {
      for (let i = g.fx.length - 1; i >= 0; i--) {
        const fx = g.fx[i];
        if (fx.kind !== 'pop') continue;
        g.fx.splice(i, 1);
        let x: number, y: number;
        if (fx.at === 'racket') {
          x = W * 0.66;
          y = H * 0.62;
        } else {
          const q = project(v.set(fx.x, fx.y, fx.z), cam, W, H);
          if (!q.front) continue;
          x = q.x;
          y = q.y;
        }
        const e = document.createElement('span');
        e.className = 'rl-pop' + (fx.good ? ' good' : '');
        e.textContent = fx.text;
        pops.appendChild(e);
        const base = `translate(${clamp(x, 40, W - 40).toFixed(1)}px,${clamp(y, 70, H - 20).toFixed(1)}px) translate(-50%,-50%)`;
        const kf = g.o.reduce
          ? [{ transform: base, opacity: 0 }, { transform: base, opacity: 1, offset: 0.2 }, { transform: base, opacity: 0 }]
          : [{ transform: base + ' translateY(6px) scale(.9)', opacity: 0 }, { transform: base + ' scale(1)', opacity: 1, offset: 0.18 }, { transform: base + ' translateY(-26px)', opacity: 0 }];
        e.animate(kf, { duration: 1000, easing: 'ease-out', fill: 'forwards' }).onfinish = () => e.remove();
      }
    }

    // A caret at the edge when the shuttle is off screen.
    const caret = ui.caret;
    if (caret) {
      const sh = g.sh;
      const live = (g.phase === 'rally' || g.phase === 'serve') && !sh.down && !(sh.held === 'foe' && !f.shown);
      const q = project(v.set(sh.x, sh.y, sh.z), cam, W, H);
      const off = live && (!q.front || q.y < 8 || q.x < 8 || q.x > W - 8);
      caret.classList.toggle('on', off);
      if (off) {
        const x = clamp(q.front ? q.x : W - q.x, 22, W - 22);
        const up = !q.front || q.y < 8;
        const side = !up ? (q.x < 8 ? -1 : 1) : 0;
        const cx = side < 0 ? 22 : side > 0 ? W - 22 : x;
        const cyy = up ? 64 : clamp(q.y, 70, H - 30);
        caret.style.transform = `translate(${cx.toFixed(1)}px,${cyy.toFixed(1)}px) translate(-50%,-50%) rotate(${side < 0 ? -90 : side > 0 ? 90 : 0}deg)`;
      }
    }
  }, -1);
  return null;
}

