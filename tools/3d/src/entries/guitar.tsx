// The guitar: /3d/guitar.js. Sound from the site's synth, /play/guitar-audio.js,
// loaded at runtime (not bundled). site.js mounts it full screen over the page
// (data-mode="overlay" on the stage) with a recorder; it tells the page when
// it's drawn (dl:ready), when a take starts (dl:guitar-rec) and when one is done
// (dl:guitar-take, detail { ms, notes }).
import { useGLTF } from '@react-three/drei';
import { NeutralToneMapping } from 'three';
import { mountCanvas } from '../lib/mountCanvas';
import { sharedCss } from '../lib/ui';
import { css } from '../guitar/Overlay';
import { Overlay } from '../guitar/Overlay';
import { disposeRec } from '../guitar/record';
import { GUITAR_FILE, GuitarScene } from '../guitar/Scene';
import { createGuitarStore, GuitarProvider, type Engine } from '../guitar/store';

const AUDIO = '/play/guitar-audio.js';

type AC = typeof AudioContext;

export function mount(el: HTMLElement): () => void {
  const full = el.getAttribute('data-mode') === 'overlay';
  const store = createGuitarStore(full);
  let alive = true;
  store.refs.emit = (type, detail) => {
    if (alive) el.dispatchEvent(new CustomEvent(type, { detail, bubbles: true }));
  };
  const unready = store.subscribe(() => {
    if (!store.get().ready) return;
    unready();
    store.refs.emit('dl:ready');
  });

  // The synth module is small; fetch it once the guitar is near the screen.
  // Over the page it plays through our own context, so the recorder can tap it.
  let engine: Engine | null = null;
  let ctx: AudioContext | null = null;
  const io = new IntersectionObserver(
    ([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      import(/* @vite-ignore */ AUDIO)
        .then((m: { createGuitar: (o?: object) => Engine }) => {
          if (!alive) return;
          const Ctx = (window.AudioContext || (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext) as AC | undefined;
          if (full && Ctx) {
            try {
              ctx = new Ctx();
              const out = ctx.createGain();
              out.connect(ctx.destination);
              store.refs.audio = { ctx, out };
            } catch {
              ctx = null;
            }
          }
          const a = store.refs.audio;
          engine = m.createGuitar(a ? { volume: 0.8, context: a.ctx, destination: a.out } : { volume: 0.8 });
          store.refs.engine = engine;
          // A gesture that already happened on the guitar turns it on now.
          if (store.refs.gesture) engine.ready().catch(() => {});
        })
        .catch((err) => console.warn('guitar sound', err));
    },
    { rootMargin: '600px' }
  );
  io.observe(el);

  const stop = mountCanvas(el, {
    className: 'p3d-guitar',
    css: sharedCss('p3d-guitar', full ? { x: 2, y: 3 } : { x: 3, y: 12 }) + css,
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
    unready();
    io.disconnect();
    disposeRec(store);
    stop();
    engine?.dispose();
    store.refs.engine = null;
    store.refs.audio = null;
    if (ctx && ctx.state !== 'closed') ctx.close().catch(() => {});
    useGLTF.clear(GUITAR_FILE);
  };
}
