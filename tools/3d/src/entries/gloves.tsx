// The red Fairtex gloves hanging off the Muay Thai card on /hobbies/: /3d/gloves.js.
// Mounted on <span class="hob-gloves" data-3d="gloves"> inside a.hob-card; the CSS
// here places it over the card photo (see src/gloves/layout.ts). Clicking the
// gloves (or Enter on the hidden button over them) throws a punch, sets
// sessionStorage dl-spar-now and goes to /hobbies/muay-thai/, where
// play/muaythai.js starts the fight straight away. The rest of the card is
// still a plain link.
import { useGLTF } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import { NeutralToneMapping } from 'three';
import { PLACE_CSS, CAM_Y, CAM_Z, FOV } from '../gloves/layout';
import { createCtl, GLOVES_FILE, GlovesScene, type Ctl, type Rect } from '../gloves/Scene';
import { mountCanvas, usePiece } from '../lib/mountCanvas';
import { sharedCss } from '../lib/ui';

// sharedCss with its soft edge fade off (the gloves hang right at the canvas's top). Using the
// same shared helpers as the other pieces keeps the shared chunks unchanged by this entry.
const CSS =
  PLACE_CSS +
  sharedCss('p3d-gloves', { x: 0, y: 0 }) +
  `
.p3d-gloves { overflow: visible; }
.p3d-gloves.hot > div:first-child { pointer-events: auto !important; cursor: pointer; }
.p3d-gloves .p3d-note { display: none; }
.p3d-gloves .gl-spar { position: absolute; margin: 0; padding: 0; border: 0; background: none; border-radius: 28%; pointer-events: none; -webkit-tap-highlight-color: transparent; }
.p3d-gloves .gl-spar:focus { outline: none; }
.p3d-gloves .gl-spar:focus-visible { outline: 2px solid rgb(var(--tint, 214, 184, 150)); outline-offset: 2px; }
`;

function SparButton({ ctl }: { ctl: Ctl }) {
  const ref = useRef<HTMLButtonElement>(null);
  const { reducedMotion } = usePiece();
  useEffect(() => {
    const show = (r: Rect | null) => {
      const b = ref.current;
      if (!b) return;
      b.hidden = !r;
      if (!r) return;
      b.style.left = (r.l * 100).toFixed(2) + '%';
      b.style.top = (r.t * 100).toFixed(2) + '%';
      b.style.width = (r.w * 100).toFixed(2) + '%';
      b.style.height = (r.h * 100).toFixed(2) + '%';
    };
    show(ctl.ui.get().rect);
    return ctl.ui.subscribe(() => show(ctl.ui.get().rect));
  }, [ctl]);
  return (
    <button
      ref={ref}
      className="gl-spar"
      type="button"
      aria-label="Spar with the head"
      hidden
      onFocus={() => !reducedMotion && ctl.focus(true)}
      onBlur={() => ctl.focus(false)}
      onClick={(e) => {
        // inside the card's link: don't follow it
        e.preventDefault();
        e.stopPropagation();
        ctl.spar?.();
      }}
    />
  );
}

export function mount(el: HTMLElement): () => void {
  const ctl = createCtl();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stop = mountCanvas(el, {
    className: 'p3d-gloves',
    css: CSS,
    camera: { fov: FOV, near: 0.5, far: 6, position: [0, CAM_Y, CAM_Z], rotation: [0, 0, 0] },
    frameloop: reduce ? 'demand' : 'always',
    scene: <GlovesScene ctl={ctl} />,
    html: <SparButton ctl={ctl} />,
    canvas: {
      shadows: 'variance',
      style: { position: 'absolute', inset: 0, pointerEvents: 'none' },
      onCreated: ({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
      }
    },
    fallback: ''
  });
  return () => {
    stop();
    useGLTF.clear(GLOVES_FILE);
  };
}
