// The watercolor: /3d/painting.js. The painting on a sheet of cold-press paper
// that tilts toward the cursor and settles back. Without 3D, the flat scan.
import { NeutralToneMapping } from 'three';
import { useSyncExternalStore } from 'react';
import { canRender, mountCanvas } from '../lib/mountCanvas';
import { sharedCss } from '../lib/ui';
import { PaintingScene } from '../painting/Scene';

const SRC = '/media/watercolor/koi-pond.webp';
const ALT = 'A watercolor of koi swimming between lily pads and pink water lilies, with a willow branch hanging in from the top right';

const css = `
.p3d-paint canvas { cursor: default; }
.p3d-paint-flat { position: absolute; inset: 0; display: grid; place-items: center; }
.p3d-paint-flat img { max-width: 70%; max-height: 88%; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.18); }
`;

export function mount(el: HTMLElement): () => void {
  const src = el.dataset.src || SRC;
  const alt = el.dataset.alt || ALT;
  const aspect = el.style.aspectRatio;
  const phone = window.matchMedia('(max-width: 640px)');
  const fit = () => {
    el.style.aspectRatio = phone.matches ? '4 / 5' : '16 / 11';
  };
  fit();
  phone.addEventListener('change', fit);
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', alt);

  let stop: () => void;
  if (!canRender('webgl')) {
    const box = document.createElement('div');
    box.className = 'p3d-paint-flat';
    const style = document.createElement('style');
    style.textContent = css;
    const img = new Image();
    img.src = src;
    img.alt = '';
    box.appendChild(img);
    el.append(style, box);
    stop = () => {
      box.remove();
      style.remove();
    };
  } else {
    let ready = false;
    const subs = new Set<() => void>();
    const onReady = () => {
      if (ready) return;
      ready = true;
      subs.forEach((f) => f());
    };
    const subscribe = (f: () => void) => {
      subs.add(f);
      return () => subs.delete(f);
    };
    function Wait() {
      const on = useSyncExternalStore(subscribe, () => ready);
      return <p className={'dl-wait' + (on ? ' off' : '')}>Loading the painting...</p>;
    }
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    stop = mountCanvas(el, {
      className: 'p3d-paint',
      css: sharedCss('p3d-paint') + css,
      camera: { fov: 26, near: 0.1, far: 40, position: [0, 0, 9] },
      frameloop: still ? 'demand' : 'always',
      scene: <PaintingScene src={src} onReady={onReady} />,
      html: <Wait />,
      canvas: {
        onCreated: ({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
        }
      },
      fallback: 'The painting needs 3D graphics, which this browser has turned off.'
    });
  }

  return () => {
    stop();
    phone.removeEventListener('change', fit);
    el.style.aspectRatio = aspect;
    el.removeAttribute('role');
    el.removeAttribute('aria-label');
  };
}
