// A tiny external store: one per mount, shared by the canvas and the DOM overlay.
import { createContext, useContext, useSyncExternalStore } from 'react';

export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(f: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      let changed = false;
      for (const k in patch) if ((state as any)[k] !== (patch as any)[k]) changed = true;
      if (!changed) return;
      state = { ...state, ...patch };
      subs.forEach((f) => f());
    },
    subscribe(f) {
      subs.add(f);
      return () => {
        subs.delete(f);
      };
    }
  };
}

/** Context plus hooks for one store type. */
export function storeContext<T extends object>(name: string) {
  const Ctx = createContext<Store<T> | null>(null);
  function useStoreRef(): Store<T> {
    const s = useContext(Ctx);
    if (!s) throw new Error(name + ' store missing');
    return s;
  }
  function useSelect<R>(pick: (s: T) => R): R {
    const s = useStoreRef();
    return useSyncExternalStore(s.subscribe, () => pick(s.get()));
  }
  return { Provider: Ctx.Provider, useStoreRef, useSelect };
}
