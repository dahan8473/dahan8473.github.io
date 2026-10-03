// DOM over the globe: loading note, hover card, a keyboard list of places, and
// the popup (portaled to <body>).
import { useEffect } from 'react';
import { usePiece } from '../lib/mountCanvas';
import { Card } from './Card';
import { Modal } from './Modal';
import { useGlobe, useGlobeStore } from './store';

export function Overlay() {
  const store = useGlobeStore();
  const { visible } = usePiece();
  const pinned = useGlobe((s) => s.pinned);
  // Escape drops a card held open by a tap.
  useEffect(() => {
    if (!pinned || !visible) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !store.get().selected) store.set({ pinned: null });
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [pinned, visible, store]);
  return (
    <>
      <Wait />
      <Card />
      <PlaceList />
      <Modal />
    </>
  );
}

function Wait() {
  const ready = useGlobe((s) => s.ready);
  return (
    <p className={'g-wait' + (ready ? ' off' : '')} aria-hidden={ready || undefined}>
      Loading the globe...
    </p>
  );
}

// Hidden until tabbed into. Focus shows the card and turns the globe; Enter opens.
function PlaceList() {
  const store = useGlobeStore();
  const places = useGlobe((s) => s.places);
  if (!places.length) return null;
  return (
    <ul className="g-sr" aria-label="Places on the globe">
      {places.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onFocus={() => {
              store.set({ hovered: p.id });
              store.faceTo(p.id);
            }}
            onBlur={() => {
              if (store.get().hovered === p.id) store.set({ hovered: null });
            }}
            onClick={() => store.open(p.id)}
          >
            {p.name}
            {p.country ? ', ' + p.country : ''}
          </button>
        </li>
      ))}
    </ul>
  );
}
