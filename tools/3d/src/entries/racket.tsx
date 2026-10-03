// Badminton rackets: /3d/racket.js. Names, strings, tensions and frame colors
// from /hobbies/badminton/rackets.json (or el.dataset.rackets).
import { useGLTF } from '@react-three/drei';
import { NeutralToneMapping } from 'three';
import { mountCanvas } from '../lib/mountCanvas';
import { sharedCss } from '../lib/ui';
import { css, Overlay } from '../racket/Overlay';
import { RACKET_FILE, RacketScene } from '../racket/Scene';
import { createRacketStore, loadRackets, RacketProvider } from '../racket/store';

export function mount(el: HTMLElement): () => void {
  const ac = new AbortController();
  const store = createRacketStore();
  loadRackets(el.dataset.rackets || '/hobbies/badminton/rackets.json', ac.signal).then((rackets) => {
    if (!ac.signal.aborted) store.set({ rackets });
  });
  const stop = mountCanvas(el, {
    className: 'p3d-racket',
    css: sharedCss('p3d-racket') + css,
    camera: { fov: 30, near: 0.05, far: 20, position: [0, 0.4, 2.4] },
    wrap: (children) => <RacketProvider value={store}>{children}</RacketProvider>,
    scene: <RacketScene />,
    html: <Overlay />,
    canvas: {
      onCreated: ({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
      },
      onPointerMissed: () => store.get().pinned != null && store.set({ pinned: null })
    },
    fallback: 'The rackets need 3D graphics, which this browser has turned off.'
  });
  return () => {
    ac.abort();
    stop();
    useGLTF.clear(RACKET_FILE);
  };
}
