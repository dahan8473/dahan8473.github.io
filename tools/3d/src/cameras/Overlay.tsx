// DOM over the kit: loading note, the spec card, and a keyboard list of parts.
import { useEffect } from 'react';
import { usePiece } from '../lib/mountCanvas';
import { useNarrow } from '../lib/view';
import { activate, actionOf, PARTS, useKit, useKitStore, type Info, type PartId } from './store';

const KIND: Record<string, string> = { camera: 'Camera', lens: 'Lens', drone: 'Drone', mic: 'Audio' };

function kindLine(info: Info) {
  const k = KIND[info.kind ?? ''] ?? '';
  if (info.kind === 'lens' && info.mount) return `${k}, ${info.mount} mount`;
  return k;
}

function hint(id: PartId, touch: boolean, pinned: boolean) {
  const a = actionOf(id);
  const verb = touch ? (pinned ? 'Tap again' : 'Tap') : 'Click';
  if (a.camera) return id === 'tamron-17-70' ? `${verb} to see A7R II photos` : `${verb} to see its photos`;
  if (a.fly) return `${verb} to fly it to the footage`;
  return '';
}

export function Overlay() {
  const store = useKitStore();
  const { visible, root } = usePiece();
  const pinned = useKit((s) => s.pinned);
  useNarrow(root);

  // Escape drops a card held open by a tap.
  useEffect(() => {
    if (!pinned || !visible) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.set({ pinned: null });
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [pinned, visible, store]);

  // The gallery's own "show all" (or another camera chip) keeps us in sync.
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent).detail?.id ?? null;
      store.set({ selected: id === 'a7r2' || id === 'xt200' ? id : null });
    };
    document.addEventListener('dl:camera', on);
    return () => document.removeEventListener('dl:camera', on);
  }, [store]);

  return (
    <>
      <Wait />
      <Card />
      <PartList />
    </>
  );
}

function Wait() {
  const ready = useKit((s) => s.ready);
  return (
    <p className={'dl-wait' + (ready ? ' off' : '')} aria-hidden={ready || undefined}>
      Loading the kit...
    </p>
  );
}

function Card() {
  const store = useKitStore();
  const id = useKit((s) => s.pinned ?? s.hovered);
  const pinned = useKit((s) => s.pinned !== null);
  const info = useKit((s) => (id ? s.info[id] : null));
  const touch = store.refs.pointer === 'touch';
  const h = id ? hint(id, touch, pinned) : '';
  return (
    <div
      className="dl-card"
      ref={(el) => {
        store.refs.card = el;
      }}
      aria-hidden="true"
    >
      {info && (
        <>
          <p className="dl-card-kind">{kindLine(info)}</p>
          <p className="dl-card-name">{info.name}</p>
          {info.specs && info.specs.length > 0 && (
            <ul className="dl-card-specs">
              {info.specs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
          {h && <p className="dl-card-hint">{h}</p>}
        </>
      )}
    </div>
  );
}

// Hidden until tabbed into. Focus shows the card and lifts the piece; Enter acts.
function PartList() {
  const store = useKitStore();
  const info = useKit((s) => s.info);
  return (
    <ul className="dl-sr" aria-label="The kit">
      {PARTS.map((id) => {
        const a = actionOf(id);
        const label = info[id].name + (a.camera && id !== 'tamron-17-70' ? ': show photos' : a.fly ? ': fly to the footage' : '');
        return (
          <li key={id}>
            <button
              type="button"
              onFocus={() => store.set({ hovered: id })}
              onBlur={() => {
                if (store.get().hovered === id) store.set({ hovered: null });
              }}
              onClick={() => (a.camera || a.fly) && activate(store, id)}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
