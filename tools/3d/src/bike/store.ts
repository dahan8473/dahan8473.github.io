// The bike: name, specs and an optional frame color from /hobbies/cycling/bike.json.
import { createStore, storeContext, type Store } from '../lib/store';
import { loadJson } from '../lib/view';

export interface BikeInfo {
  name?: string;
  specs?: string[];
  color?: string;
}

export interface BikeState {
  name: string;
  specs: string[];
  color: string | null;
  hovered: boolean;
  /** Touch: a tap holds the card open. */
  pinned: boolean;
  /** Wheels turning after a click (hover also turns them). */
  riding: boolean;
  ready: boolean;
  failed: boolean;
}

export function createBikeStore() {
  const store = createStore<BikeState>({ name: '', specs: [], color: null, hovered: false, pinned: false, riding: false, ready: false, failed: false });
  return Object.assign(store, { refs: { card: null as HTMLDivElement | null } });
}
export type BikeStore = Store<BikeState> & ReturnType<typeof createBikeStore>;

const ctx = storeContext<BikeState>('bike');
export const BikeProvider = ctx.Provider;
export const useBikeStore = ctx.useStoreRef as () => BikeStore;
export const useBike = ctx.useSelect;

export async function loadBike(url: string, signal: AbortSignal): Promise<BikeInfo> {
  const data = await loadJson<{ bike?: BikeInfo }>(url, signal);
  const b = data?.bike ?? {};
  return {
    name: typeof b.name === 'string' ? b.name.trim() : '',
    specs: Array.isArray(b.specs) ? b.specs.filter((s) => typeof s === 'string' && s.trim()) : [],
    color: typeof b.color === 'string' && CSS.supports('color', b.color.trim()) ? b.color.trim() : undefined
  };
}
