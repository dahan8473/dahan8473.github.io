// The small card next to a marker on hover, keyboard focus, or a first tap.
// <Card> is the DOM; <CardTracker> lives in the canvas and moves it each frame.
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { Vector3 } from 'three';
import { worldDir } from './Rig';
import { coverOf, useGlobe, useGlobeStore } from './store';

const RADIUS = 1.012;
const GAP = 18;
const EDGE = 10;

export function Card() {
  const store = useGlobeStore();
  const id = useGlobe((s) => (s.selected ? null : (s.pinned ?? s.hovered)));
  const pinned = useGlobe((s) => s.pinned !== null && s.pinned === id);
  const place = useGlobe((s) => s.places.find((p) => p.id === id));
  const photos = place ? coverOf(place) : [];
  return (
    <div
      className={'g-card' + (pinned ? ' pinned' : '')}
      ref={(el) => {
        store.refs.card = el;
      }}
      aria-hidden="true"
      onClick={() => place && pinned && store.open(place.id)}
    >
      {place && (
        <>
          {photos.length > 0 && (
            <div className={'g-card-photos n' + photos.length}>
              {photos.map((src) => (
                <img key={src} src={src} alt="" loading="lazy" decoding="async" />
              ))}
            </div>
          )}
          <div className="g-card-text">
            <p className="g-card-name">{place.name}</p>
            {place.date && <p className="g-card-date">{place.date}</p>}
            {place.for && <p className="g-card-for">{place.for}</p>}
            {pinned && <p className="g-card-more">Tap for more</p>}
          </div>
        </>
      )}
    </div>
  );
}

export function CardTracker() {
  const store = useGlobeStore();
  const { camera, size } = useThree();
  const p = useMemo(() => new Vector3(), []);
  const c = useMemo(() => new Vector3(), []);
  const n = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const card = store.refs.card;
    if (!card) return;
    const s = store.get();
    const id = s.selected ? null : (s.pinned ?? s.hovered);
    const place = id ? s.places.find((x) => x.id === id) : null;
    if (!place) {
      card.style.opacity = '0';
      card.style.visibility = 'hidden';
      return;
    }
    p.copy(worldDir(place.lat, place.lng, RADIUS));
    const facing = c.copy(camera.position).normalize().dot(n.copy(p).normalize());
    // Hide once the place turns to the far side of the globe.
    const show = facing > 0.18;
    card.style.opacity = show ? '1' : '0';
    card.style.visibility = show ? 'visible' : 'hidden';
    if (!show) return;
    p.project(camera);
    const x = ((p.x + 1) / 2) * size.width;
    const y = ((1 - p.y) / 2) * size.height;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    // Right of the marker; flip left, then above or below, to stay on screen.
    let left = x + GAP;
    let top = y - h / 2;
    if (left + w > size.width - EDGE) left = x - GAP - w;
    if (left < EDGE) {
      left = Math.min(Math.max(x - w / 2, EDGE), size.width - w - EDGE);
      top = y - GAP - h;
      if (top < EDGE) top = y + GAP;
    }
    top = Math.min(Math.max(top, EDGE), size.height - h - EDGE);
    card.style.transform = `translate(${left.toFixed(1)}px, ${top.toFixed(1)}px)`;
  });
  return null;
}
