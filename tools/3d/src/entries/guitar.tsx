// Guitar strip: /3d/guitar.js. Sound from the site's synth, /play/guitar-audio.js,
// loaded at runtime (not bundled).
import { useGLTF } from '@react-three/drei';
import { NeutralToneMapping } from 'three';
import { mountCanvas } from '../lib/mountCanvas';
import { sharedCss } from '../lib/ui';
import { css } from '../guitar/Overlay';
import { Overlay } from '../guitar/Overlay';
import { GUITAR_FILE, GuitarScene } from '../guitar/Scene';
import { createGuitarStore, GuitarProvider, type Engine } from '../guitar/store';

const AUDIO = '/play/guitar-audio.js';

export function mount(el: HTMLElement): () => void {
  const store = createGuitarStore();
  let alive = true;

  // The synth module is small; fetch it once the strip is near the screen.
  let engine: Engine | null = null;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      import(/* @vite-ignore */ AUDIO)
        .then((m: { createGuitar: (o?: object) => Engine }) => {
          if (!alive) return;
          engine = m.createGuitar({ volume: 0.8 });
          store.refs.engine = engine;
          // A gesture that already happened on the strip turns it on now.
          if (store.refs.gesture) engine.ready().catch(() => {});
        })
        .catch((err) => console.warn('guitar sound', err));
    },
    { rootMargin: '600px' }
  );
  io.observe(el);

  const stop = mountCanvas(el, {
    className: 'p3d-guitar',
    css: sharedCss('p3d-guitar', { x: 3, y: 12 }) + css,
    camera: { fov: 26, near: 0.05, far: 20, position: [0, 0.2, 1.4] },
    wrap: (children) => <GuitarProvider value={store}>{children}</GuitarProvider>,
    scene: <GuitarScene />,
    html: <Overlay />,
    canvas: {
      onCreated: ({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
      }
    },
    fallback: 'The guitar needs 3D graphics, which this browser has turned off.'
  });

  return () => {
    alive = false;
    io.disconnect();
    stop();
    engine?.dispose();
    store.refs.engine = null;
    useGLTF.clear(GUITAR_FILE);
  };
}
