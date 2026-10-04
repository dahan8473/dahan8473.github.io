// The four rackets: names, strings and tensions from /hobbies/badminton/rackets.json.
import { createStore, storeContext, type Store } from '../lib/store';
import { loadJson } from '../lib/view';

export interface RacketInfo {
  name?: string;
  color?: string;
  string?: string;
  tension?: string | number;
  /** A traced model of this exact racket (traced from its product photo); the generic one otherwise. */
  model?: string;
  /** Yonex's specs: what it's for, weight and grip classes, balance, flex, materials, string tension range. */
  for?: string;
  weight?: string;
  balance?: string;
  flex?: string;
  frame?: string;
  shaft?: string;
  length?: string;
  range?: string;
  made?: string;
  /** 0 to 1 places on the card's meters: head light to head heavy, flexible to stiff. */
  scale?: { balance?: number; stiffness?: number };
  source?: string;
}

export const COUNT = 4;
// Muted frame colors with one warm one, used until rackets.json gives colors.
export const DEFAULT_COLORS = ['#4f6f96', '#b5525c', '#d9dde3', '#33373f'];

export interface RacketState {
  rackets: RacketInfo[];
  hovered: number | null;
  pinned: number | null;
  /** The racket zoomed in on, with its specs. */
  focus: number | null;
  /** The rally is up over the page. */
  playing: boolean;
  ready: boolean;
  /** rackets.json has answered (or failed), so the models to load are known. */
  listed: boolean;
}

export function createRacketStore() {
  const store = createStore<RacketState>({ rackets: [], hovered: null, pinned: null, focus: null, playing: false, ready: false, listed: false });
  return Object.assign(store, {
    refs: {
      card: null as HTMLDivElement | null,
      stats: null as HTMLDivElement | null,
      pointer: 'mouse',
      /** The last input was a key (vs a pointer). */
      kb: false,
      /** Closes the rally (now: skip the fade, for a page swap). */
      game: null as ((now?: boolean) => void) | null
    }
  });
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

export function modelOf(rackets: RacketInfo[], i: number, generic: string) {
  const m = rackets[i]?.model;
  return typeof m === 'string' && m.trim() ? m.trim() : generic;
}

export function nameOf(rackets: RacketInfo[], i: number) {
  const n = rackets[i]?.name;
  return typeof n === 'string' && n.trim() ? n.trim() : `Racket ${i + 1}`;
}
