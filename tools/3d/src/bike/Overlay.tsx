// DOM over the bike: loading note, the card, a keyboard handle, and the quiet
// "coming soon" drawing when there's no model to show.
import { usePiece } from '../lib/mountCanvas';
import { useNarrow } from '../lib/view';
import { useBike, useBikeStore } from './store';

export function Overlay() {
  const failed = useBike((s) => s.failed);
  const { root } = usePiece();
  useNarrow(root);
  if (failed) return <Soon />;
  return (
    <>
      <Wait />
      <Card />
      <Keys />
    </>
  );
}

function Wait() {
  const ready = useBike((s) => s.ready);
  return (
    <p className={'dl-wait' + (ready ? ' off' : '')} aria-hidden={ready || undefined}>
      Loading the bike...
    </p>
  );
}

function Card() {
  const store = useBikeStore();
  const name = useBike((s) => s.name);
  const specs = useBike((s) => s.specs);
  return (
    <div
      className="dl-card bk-card"
      ref={(el) => {
        store.refs.card = el;
      }}
      aria-hidden="true"
    >
      <p className="dl-card-kind">Bike</p>
      <p className="dl-card-name">{name || 'My bike'}</p>
      {specs.length > 0 ? (
        <ul className="dl-card-specs">
          {specs.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      ) : (
        <p className="dl-card-soon">Details soon</p>
      )}
    </div>
  );
}

// Focus shows the card and turns the wheels; Enter keeps them turning.
function Keys() {
  const store = useBikeStore();
  const name = useBike((s) => s.name);
  const specs = useBike((s) => s.specs);
  return (
    <ul className="dl-sr" aria-label="The bike">
      <li>
        <button
          type="button"
          aria-pressed={useBike((s) => s.riding)}
          onFocus={() => store.set({ hovered: true })}
          onBlur={() => store.set({ hovered: false })}
          onClick={() => store.set({ riding: !store.get().riding })}
        >
          {(name || 'My bike') + (specs.length ? ': ' + specs.join(', ') : '')}. Ride
        </button>
      </li>
    </ul>
  );
}

// A line drawing of a road bike that draws itself in, with a note.
export const SOON_HTML = `<svg viewBox="0 0 180 100" aria-hidden="true">
<circle cx="42" cy="64" r="29"/><circle cx="138" cy="64" r="29"/>
<path d="M42 64 L84 66 L76 31 Z M76 31 L123 31 M84 66 L127 41 M123 31 L127 41 L138 64"/>
<path d="M69 27 L84 27 M76 31 L76 27 M123 31 L121 25 L129 25 C135 25 136 31 132 33"/>
<circle cx="84" cy="66" r="4.5"/><path d="M84 66 L90 75 M87 75 L94 75"/>
</svg><p>My bike, in 3D soon.</p>`;

export function Soon() {
  const { reducedMotion } = usePiece();
  return <div className={'bk-soon' + (reducedMotion ? ' still' : '')} dangerouslySetInnerHTML={{ __html: SOON_HTML }} />;
}

export const css = `
.p3d-bike .bk-card { transform: translate(14px, 14px); }
.p3d-bike .dl-card-soon { margin-top: 5px !important; color: var(--t3); }
.p3d-bike .bk-soon { position: absolute; inset: 0; display: grid; place-content: center; justify-items: center; gap: 10px; color: var(--t3); }
.p3d-bike .bk-soon svg { width: min(220px, 52%); height: auto; fill: none; stroke: currentColor; stroke-width: 1.4; stroke-linecap: round; stroke-linejoin: round; }
.p3d-bike .bk-soon p { margin: 0; font-size: 13px; }
.p3d-bike .bk-soon svg > * { stroke-dasharray: 400; stroke-dashoffset: 400; animation: bk-draw 1.8s cubic-bezier(.3, .6, .2, 1) forwards; }
.p3d-bike .bk-soon svg :nth-child(2) { animation-delay: 120ms; }
.p3d-bike .bk-soon svg :nth-child(3) { animation-delay: 260ms; }
.p3d-bike .bk-soon svg :nth-child(4) { animation-delay: 420ms; }
.p3d-bike .bk-soon.still svg > * { animation: none; stroke-dashoffset: 0; }
@keyframes bk-draw { to { stroke-dashoffset: 0; } }
@media (prefers-reduced-motion: reduce) { .p3d-bike .bk-soon svg > * { animation: none; stroke-dashoffset: 0; } }
`;
