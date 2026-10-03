// The place popup: a modal over the whole page (portaled to <body>), with the
// trip details, vlog embeds and every photo. Photos open larger inside it.
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Place } from './data';
import { useGlobe, useGlobeStore } from './store';

const norm = (s?: string) => (s ?? '').trim().replace(/[.!]+$/, '').toLowerCase();
const FOCUSABLE = 'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';

export function Modal() {
  const host = useMemo(() => {
    const d = document.createElement('div');
    d.className = 'p3d-globe-modal';
    return d;
  }, []);
  useEffect(() => {
    document.body.appendChild(host);
    return () => host.remove();
  }, [host]);
  const place = useGlobe((s) => s.places.find((p) => p.id === s.selected));
  return createPortal(place ? <Dialog key={place.id} place={place} /> : null, host);
}

function Dialog({ place }: { place: Place }) {
  const store = useGlobeStore();
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<number | null>(null);
  const photos = place.photos ?? [];
  const videos = place.videos ?? [];
  const meta = [place.country, place.date].filter(Boolean).join(' · ');

  // Focus in, trap Tab, Escape closes (the photo first), focus back out.
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    box.current?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = overflow;
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (view !== null) setView(null);
        else store.close();
        return;
      }
      if (view !== null && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const n = photos.length;
        setView((view + (e.key === 'ArrowRight' ? 1 : n - 1)) % n);
        return;
      }
      if (e.key !== 'Tab' || !box.current) return;
      const list = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      const at = document.activeElement;
      if (e.shiftKey && (at === first || at === box.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (at === last || !box.current.contains(at))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [view, photos.length, store]);

  return (
    <div
      className="gm-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) store.close();
      }}
    >
      <div className="gm-dialog" role="dialog" aria-modal="true" aria-labelledby="gm-title" tabIndex={-1} ref={box}>
        <button className="gm-close" type="button" aria-label="Close" onClick={() => store.close()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="gm-scroll">
          {meta && <p className="gm-meta">{meta}</p>}
          <h2 className="gm-title" id="gm-title">
            {place.name}
          </h2>
          {place.for && <p className="gm-for">{place.for}</p>}
          {place.note && norm(place.note) !== norm(place.for) && <p className="gm-note">{place.note}</p>}

          <section className="gm-sec" aria-label="Videos">
            <p className="gm-label">Vlog</p>
            {videos.length ? (
              <div className="gm-videos">
                {videos.map((id) => (
                  <LiteYouTube key={id} id={id} title={place.name} />
                ))}
              </div>
            ) : (
              <p className="gm-empty">No videos yet.</p>
            )}
          </section>

          {photos.length > 0 && (
            <section className="gm-sec" aria-label="Photos">
              <p className="gm-label">Photos</p>
              <div className="gm-photos">
                {photos.map((src, i) => (
                  <button key={src} type="button" className="gm-photo" aria-label={`Photo ${i + 1} of ${photos.length}`} onClick={() => setView(i)}>
                    <img src={src} alt="" loading="lazy" decoding="async" />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {view !== null && (
          <div className="gm-viewer" role="group" aria-label={`Photo ${view + 1} of ${photos.length}`}>
            <img src={photos[view]} alt="" />
            <button className="gm-v-close" type="button" aria-label="Back to the place" onClick={() => setView(null)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
            {photos.length > 1 && (
              <>
                <button className="gm-v-prev" type="button" aria-label="Previous photo" onClick={() => setView((view + photos.length - 1) % photos.length)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <button className="gm-v-next" type="button" aria-label="Next photo" onClick={() => setView((view + 1) % photos.length)}>
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <p className="gm-v-count">
                  {view + 1} / {photos.length}
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LiteYouTube({ id, title }: { id: string; title: string }) {
  const [on, setOn] = useState(false);
  const safe = encodeURIComponent(id);
  if (on) {
    return (
      <div className="gm-yt">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${safe}?autoplay=1&rel=0&playsinline=1`}
          title={`${title} vlog`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        />
      </div>
    );
  }
  return (
    <button type="button" className="gm-yt" aria-label={`Play the ${title} vlog`} onClick={() => setOn(true)}>
      <img src={`https://i.ytimg.com/vi/${safe}/hqdefault.jpg`} alt="" loading="lazy" decoding="async" />
      <span className="gm-play" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M9 7.5v9l7.5-4.5z" />
        </svg>
      </span>
    </button>
  );
}
