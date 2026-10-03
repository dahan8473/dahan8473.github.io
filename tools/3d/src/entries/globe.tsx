// Travel globe: /3d/globe.js. Markers come from /hobbies/travel/places.json
// (or el.dataset.places).
import { css } from '../globe/css';
import { loadGlobePoints, loadPlaces } from '../globe/data';
import { GlobeScene } from '../globe/GlobeScene';
import { Overlay } from '../globe/Overlay';
import { createGlobeStore, GlobeContext } from '../globe/store';
import { mountCanvas } from '../lib/mountCanvas';

export function mount(el: HTMLElement): () => void {
  const ac = new AbortController();
  const store = createGlobeStore();

  loadPlaces(el.dataset.places || '/hobbies/travel/places.json', ac.signal)
    .then((places) => store.set({ places }))
    .catch((err) => {
      if (!ac.signal.aborted) console.warn('globe places', err);
    });
  const points = loadGlobePoints(import.meta.env.BASE_URL + 'models/globe.bin', ac.signal);
  points.catch(() => {});

  const stop = mountCanvas(el, {
    renderer: 'webgpu',
    className: 'p3d-globe',
    css,
    camera: { fov: 30, near: 0.1, far: 200, position: [0, 1, 5.1] },
    wrap: (children) => <GlobeContext.Provider value={store}>{children}</GlobeContext.Provider>,
    scene: <GlobeScene points={points} />,
    html: <Overlay />,
    // A tap on empty globe drops a card held open by an earlier tap.
    canvas: { onPointerMissed: () => store.get().pinned && store.set({ pinned: null }) },
    fallback: 'The globe needs 3D graphics, which this browser has turned off.'
  });

  return () => {
    ac.abort();
    stop();
  };
}
