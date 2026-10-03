// The four rackets: names, strings and tensions from /hobbies/badminton/rackets.json.
import { createStore, storeContext, type Store } from '../lib/store';
import { loadJson } from '../lib/view';

export interface RacketInfo {
  name?: string;
  color?: string;
  string?: string;
  tension?: string | number;
}

export const COUNT = 4;
// Muted frame colors with one warm one, used until rackets.json gives colors.
export const DEFAULT_COLORS = ['#4f6f96', '#b5525c', '#d9dde3', '#33373f'];

export interface RacketState {
  rackets: RacketInfo[];
  hovered: number | null;
  pinned: number | null;
  ready: boolean;
}

export function createRacketStore() {
  const store = createStore<RacketState>({ rackets: [], hovered: null, pinned: null, ready: false });
  return Object.assign(store, { refs: { card: null as HTMLDivElement | null, pointer: 'mouse' } });
}
export type RacketStore = Store<RacketState> & ReturnType<typeof createRacketStore>;

const ctx = storeContext<RacketState>('racket');
export const RacketProvider = ctx.Provider;
export const useRacketStore = ctx.useStoreRef as () => RacketStore;
export const useRacket = ctx.useSelect;

export async function loadRackets(url: string, signal: AbortSignal): Promise<RacketInfo[]> {
  const data = await loadJson<{ rackets?: RacketInfo[] }>(url, signal);
  return Array.isArray(data?.rackets) ? data!.rackets.filter((r) => r && typeof r === 'object').slice(0, COUNT) : [];
}

export function colorOf(rackets: RacketInfo[], i: number) {
  const c = rackets[i]?.color?.trim();
  return c && CSS.supports('color', c) ? c : DEFAULT_COLORS[i];
}

export function nameOf(rackets: RacketInfo[], i: number) {
  const n = rackets[i]?.name;
  return typeof n === 'string' && n.trim() ? n.trim() : `Racket ${i + 1}`;
}
