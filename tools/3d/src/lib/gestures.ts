// Controls inside a page that scrolls. Call from a component inside the Canvas
// after mounting OrbitControls (or any controls bound to events.connected).
//
// - wheel zooms only once the piece is engaged (pointer pressed on it since the
//   pointer came in) or when it is a trackpad pinch (ctrlKey); otherwise the
//   page scrolls as usual
// - touch: vertical swipes scroll the page, horizontal drags and pinches reach
//   the controls (touch-action: pan-y)
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { usePiece } from './mountCanvas';

export function usePageFriendlyGestures() {
  const { events } = useThree();
  const { root } = usePiece();
  useEffect(() => {
    const target = events.connected as HTMLElement | undefined;
    if (!target) return;
    // OrbitControls sets touch-action: none when it connects; undo that.
    target.style.touchAction = 'pan-y';
    let engaged = false;
    const down = () => (engaged = true);
    const leave = () => (engaged = false);
    const wheel = (e: WheelEvent) => {
      if (!engaged && !e.ctrlKey) e.stopImmediatePropagation();
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('pointerleave', leave);
    target.addEventListener('wheel', wheel, { capture: true });
    return () => {
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('pointerleave', leave);
      target.removeEventListener('wheel', wheel, { capture: true });
    };
  }, [events.connected, root]);
}
