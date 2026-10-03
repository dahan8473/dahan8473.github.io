// Photography kit: /3d/cameras.js. Names and specs from
// /hobbies/photography/gear.json (or el.dataset.gear).
import { useGLTF } from '@react-three/drei';
import { NeutralToneMapping } from 'three';
import { KIT_FILES, KitScene } from '../cameras/Scene';
import { Overlay } from '../cameras/Overlay';
import { clearSelection, createKitStore, KitProvider, loadGear } from '../cameras/store';
import { mountCanvas } from '../lib/mountCanvas';
import { sharedCss } from '../lib/ui';

export function mount(el: HTMLElement): () => void {
  const ac = new AbortController();
  const store = createKitStore();
  loadGear(el.dataset.gear || '/hobbies/photography/gear.json', ac.signal).then((info) => {
    if (!ac.signal.aborted) store.set({ info });
  });

  const stop = mountCanvas(el, {
    className: 'p3d-kit',
    css: sharedCss('p3d-kit'),
    camera: { fov: 30, near: 0.02, far: 20, position: [0, 0.5, 0.8] },
    wrap: (children) => <KitProvider value={store}>{children}</KitProvider>,
    scene: <KitScene />,
    html: <Overlay />,
    canvas: {
      onCreated: ({ gl }) => {
        gl.toneMapping = NeutralToneMapping;
        gl.toneMappingExposure = 1;
      },
      // A tap or click on empty space drops the card and the camera filter.
      onPointerMissed: () => clearSelection(store)
    },
    fallback: 'The kit needs 3D graphics, which this browser has turned off.'
  });

  return () => {
    ac.abort();
    stop();
    useGLTF.clear(KIT_FILES);
  };
}
