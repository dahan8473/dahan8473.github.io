// The bike: /3d/bike.js. A turntable of /3d/models/bike.glb with a card from
// /hobbies/cycling/bike.json, or a quiet "coming soon" drawing (no 3D at all)
// when the model isn't there.
import { useGLTF } from '@react-three/drei';
import { NeutralToneMapping } from 'three';
import { BikeScene, BIKE_FILE } from '../bike/Scene';
import { css, Overlay, SOON_HTML } from '../bike/Overlay';
import { BikeProvider, createBikeStore, loadBike } from '../bike/store';
import { mountCanvas } from '../lib/mountCanvas';
import { sharedCss } from '../lib/ui';

const SHORT = '16 / 7';

export function mount(el: HTMLElement): () => void {
  const ac = new AbortController();
  const store = createBikeStore();
  const aspect = el.style.aspectRatio;
  let stop: (() => void) | null = null;

  loadBike(el.dataset.bike || '/hobbies/cycling/bike.json', ac.signal).then((b) => {
    if (!ac.signal.aborted) store.set({ name: b.name ?? '', specs: b.specs ?? [], color: b.color ?? null });
  });

  // A model that fails to load after all also falls back to the drawing.
  const unsub = store.subscribe(() => {
    if (store.get().failed) el.style.aspectRatio = SHORT;
  });

  const start3d = () =>
    mountCanvas(el, {
      className: 'p3d-bike',
      css: sharedCss('p3d-bike') + css,
      camera: { fov: 30, near: 0.05, far: 30, position: [0, 0.8, 4] },
      wrap: (children) => <BikeProvider value={store}>{children}</BikeProvider>,
      scene: <BikeScene />,
      html: <Overlay />,
      canvas: {
        onCreated: ({ gl }) => {
          gl.toneMapping = NeutralToneMapping;
        },
        onPointerMissed: () => store.get().pinned && store.set({ pinned: false, riding: false })
      },
      fallback: 'The bike needs 3D graphics, which this browser has turned off.'
    });

  const startSoon = () => {
    el.style.aspectRatio = SHORT;
    const style = document.createElement('style');
    style.textContent = css;
    const root = document.createElement('div');
    root.className = 'p3d p3d-bike';
    root.style.cssText = 'position:absolute;inset:0';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.innerHTML = `<div class="bk-soon${reduce ? ' still' : ''}">${SOON_HTML}</div>`;
    el.append(style, root);
    return () => {
      root.remove();
      style.remove();
    };
  };

  // Only build the 3D stage once we know there's a model to show.
  fetch(BIKE_FILE, { method: 'HEAD', signal: ac.signal })
    .then((r) => r.ok)
    .catch(() => false)
    .then((ok) => {
      if (ac.signal.aborted) return;
      stop = ok ? start3d() : startSoon();
    });

  return () => {
    ac.abort();
    unsub();
    stop?.();
    el.style.aspectRatio = aspect;
    useGLTF.clear(BIKE_FILE);
  };
}
