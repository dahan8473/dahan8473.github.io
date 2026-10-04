// DOM over the rackets: loading note, the card, and a keyboard list.
import { useEffect } from 'react';
import { usePiece } from '../lib/mountCanvas';
import { useNarrow } from '../lib/view';
import { COUNT, nameOf, useRacket, useRacketStore, type RacketInfo } from './store';

function tension(t: RacketInfo['tension']) {
  if (typeof t === 'number') return `${t} lbs`;
  return typeof t === 'string' && t.trim() ? t.trim() : '';
}

export function Overlay() {
  const store = useRacketStore();
  const { visible, root } = usePiece();
  const pinned = useRacket((s) => s.pinned);
  useNarrow(root);
  useEffect(() => {
    if (pinned == null || !visible) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.set({ pinned: null });
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [pinned, visible, store]);
  return (
    <>
      <Wait />
      <Card />
      <List />
    </>
  );
}

function Wait() {
  const ready = useRacket((s) => s.ready);
  return (
    <p className={'dl-wait' + (ready ? ' off' : '')} aria-hidden={ready || undefined}>
      Loading the rackets...
    </p>
  );
}

function specsOf(r: RacketInfo | undefined) {
  const out: string[] = [];
  if (r?.string && r.string.trim()) out.push(r.string.trim() + ' string');
  const t = tension(r?.tension);
  if (t) out.push('strung at ' + t);
  return out;
}

function Card() {
  const store = useRacketStore();
  const i = useRacket((s) => s.pinned ?? s.hovered);
  const rackets = useRacket((s) => s.rackets);
  const r = i == null ? undefined : rackets[i];
  const specs = specsOf(r);
  return (
    <div
      className="dl-card"
      ref={(el) => {
        store.refs.card = el;
      }}
      aria-hidden="true"
    >
      {i != null && (
        <>
          <p className="dl-card-kind">Racket {i + 1} of {COUNT}</p>
          <p className="dl-card-name">{nameOf(rackets, i)}</p>
          {specs.length > 0 && (
            <ul className="dl-card-specs">
              {specs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function List() {
  const store = useRacketStore();
  const rackets = useRacket((s) => s.rackets);
  return (
    <ul className="dl-sr" aria-label="Rackets">
      {Array.from({ length: COUNT }, (_, i) => {
        const specs = specsOf(rackets[i]);
        return (
          <li key={i}>
            <button
              type="button"
              onFocus={() => store.set({ hovered: i })}
              onBlur={() => {
                if (store.get().hovered === i) store.set({ hovered: null });
              }}
            >
              {nameOf(rackets, i)}
              {specs.length ? ': ' + specs.join(', ') : ''}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const css = '';
