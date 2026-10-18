// State the canvas and the DOM overlay share. One store per mount.
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { Place } from './data';

export interface GlobeState {
  places: Place[];
  /** Card shown by mouse hover or keyboard focus. */
  hovered: string | null;
  /** Card held open by a first tap on touch screens. */
  pinned: string | null;
  /** Place whose popup is open. */
  selected: string | null;
  /** Place the camera should turn to; faceTick bumps re-run the turn. */
  face: string | null;
  faceTick: number;
  ready: boolean;
}

export function createGlobeStore() {
  let state: GlobeState = {
    places: [],
    hovered: null,
    pinned: null,
    selected: null,
    face: null,
    faceTick: 0,
    ready: false
  };
  const subs = new Set<() => void>();
  const store = {
    /** DOM the canvas writes to every frame, and how the last pointer pressed. */
    refs: { card: null as HTMLDivElement | null, pointer: 'mouse' as string },
    get: () => state,
    set(patch: Partial<GlobeState>) {
      state = { ...state, ...patch };
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    },
    /** Turn the globe to a place. */
    faceTo(id: string) {
      store.set({ face: id, faceTick: state.faceTick + 1 });
    },
    /** Open the popup for a place (and turn to it). */
    open(id: string) {
      store.set({ selected: id, hovered: null, pinned: null, face: id, faceTick: state.faceTick + 1 });
    },
    close() {
      store.set({ selected: null });
    }
  };
  return store;
}

export type GlobeStore = ReturnType<typeof createGlobeStore>;

export const GlobeContext = createContext<GlobeStore | null>(null);

export function useGlobeStore(): GlobeStore {
  const s = useContext(GlobeContext);
  if (!s) throw new Error('GlobeContext missing');
  return s;
}

export function useGlobe<T>(pick: (s: GlobeState) => T): T {
  const s = useGlobeStore();
  return useSyncExternalStore(s.subscribe, () => pick(s.get()));
}

/** The globe's points and markers spin with this (radians about Y), as in tsi-globe. */
export const GLOBE_SPIN = 3.45;

/** Photos for the hover card: cover if set, else the first three photos. */
export function coverOf(p: { cover?: string[]; photos?: string[] }): string[] {
  return (p.cover && p.cover.length ? p.cover : p.photos ?? []).slice(0, 3);
}
