// The kit: what each part is, what clicking it does, and the state the canvas
// and the DOM overlay share.
import { createStore, storeContext, type Store } from '../lib/store';
import { loadJson } from '../lib/view';

export type PartId = 'a7r2' | 'tamron-17-70' | 'xt200' | 'mini4k' | 'mic-mini';
export type CameraId = 'a7r2' | 'xt200';

export interface Info {
  id: string;
  name: string;
  kind?: string;
  specs?: string[];
  mount?: string;
  on?: string;
}

export const PARTS: PartId[] = ['a7r2', 'tamron-17-70', 'xt200', 'mini4k', 'mic-mini'];

/** What a click does: filter photos by a camera, fly the drone, or nothing. */
export function actionOf(id: PartId): { camera?: CameraId; fly?: boolean } {
  if (id === 'a7r2' || id === 'tamron-17-70') return { camera: 'a7r2' };
  if (id === 'xt200') return { camera: 'xt200' };
  if (id === 'mini4k') return { fly: true };
  return {};
}

// Used until gear.json arrives (or if it can't be read).
const FALLBACK: Record<PartId, Info> = {
  a7r2: { id: 'a7r2', name: 'Sony A7R II', kind: 'camera' },
  'tamron-17-70': { id: 'tamron-17-70', name: 'Tamron 17-70mm f/2.8', kind: 'lens', mount: 'Sony E', on: 'a7r2' },
  xt200: { id: 'xt200', name: 'Fujifilm X-T200', kind: 'camera' },
  mini4k: { id: 'mini4k', name: 'DJI Mini 4K', kind: 'drone' },
  'mic-mini': { id: 'mic-mini', name: 'DJI Mic Mini', kind: 'mic' }
};

interface GearJson {
  bodies?: Info[];
  lenses?: Info[];
  drone?: Info;
  audio?: Info[];
}

export async function loadGear(url: string, signal: AbortSignal): Promise<Record<PartId, Info>> {
  const data = await loadJson<GearJson>(url, signal);
  const out = { ...FALLBACK };
  if (!data) return out;
  const all = [...(data.bodies ?? []), ...(data.lenses ?? []), ...(data.drone ? [data.drone] : []), ...(data.audio ?? [])];
  for (const it of all) {
    if (it && (PARTS as string[]).includes(it.id) && typeof it.name === 'string') out[it.id as PartId] = { ...out[it.id as PartId], ...it };
  }
  return out;
}

export interface KitState {
  info: Record<PartId, Info>;
  /** Card shown by mouse hover or keyboard focus. */
  hovered: PartId | null;
  /** Card held open by a first tap on a touch screen. */
  pinned: PartId | null;
  /** Camera the photo gallery is filtered to. */
  selected: CameraId | null;
  /** Bumped to send the drone up. */
  fly: number;
  ready: boolean;
}

export function createKitStore() {
  const store = createStore<KitState>({ info: FALLBACK, hovered: null, pinned: null, selected: null, fly: 0, ready: false });
  return Object.assign(store, {
    refs: { card: null as HTMLDivElement | null, pointer: 'mouse' as string }
  });
}

export type KitStore = Store<KitState> & ReturnType<typeof createKitStore>;

const ctx = storeContext<KitState>('kit');
export const KitProvider = ctx.Provider;
export const useKitStore = ctx.useStoreRef as () => KitStore;
export const useKit = ctx.useSelect;

/** Runs a part's click: filter the gallery to a camera, or fly the drone. */
export function activate(store: KitStore, id: PartId) {
  const a = actionOf(id);
  if (a.camera) {
    store.set({ selected: a.camera, pinned: null });
    document.dispatchEvent(new CustomEvent('dl:camera', { detail: { id: a.camera } }));
    const gallery = document.querySelector('main [data-play="gallery"]');
    const box = gallery?.getBoundingClientRect();
    if (gallery && box && (box.top > window.innerHeight * 0.55 || box.top < 0)) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Let the gallery re-render its filter first so the scroll lands on it.
      requestAnimationFrame(() => gallery.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' }));
    }
  } else if (a.fly) {
    store.set({ fly: store.get().fly + 1, pinned: null });
  }
}

/** Clears the camera filter (and tells the gallery). */
export function clearSelection(store: KitStore) {
  const had = store.get().selected;
  store.set({ selected: null, pinned: null });
  if (had) document.dispatchEvent(new CustomEvent('dl:camera', { detail: { id: null } }));
}
