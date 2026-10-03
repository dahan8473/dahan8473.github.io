// Shared mount for every 3D piece on davidliu.work.
//
// site.js imports /3d/<entry>.js and calls mount(el). An entry does:
//
//   export function mount(el: HTMLElement) {
//     return mountCanvas(el, { scene: <MyScene />, html: <MyOverlay /> });
//   }
//
// mountCanvas renders a React root into el: a transparent <Canvas> plus an
// optional DOM overlay, both inside one container. It tracks the site theme
// (data-theme on <html>), prefers-reduced-motion and whether el is on screen
// (rendering pauses offscreen), caps the DPR, shows a quiet message when the
// browser cannot draw 3D, and returns a cleanup that tears all of it down.
import { Canvas, type CanvasProps } from '@react-three/fiber';
import {
  Component,
  createContext,
  Suspense,
  useContext,
  useSyncExternalStore,
  type ReactNode
} from 'react';
import { createRoot } from 'react-dom/client';

export type Theme = 'light' | 'dark';
export type RendererKind = 'webgl' | 'webgpu';

export interface Piece {
  /** The stage element site.js handed to mount(). */
  el: HTMLElement;
  /** Our container inside el (position absolute, inset 0). Put DOM overlays here. */
  root: HTMLDivElement;
  theme: Theme;
  dark: boolean;
  reducedMotion: boolean;
  /** False while el is scrolled offscreen; the canvas is paused then. */
  visible: boolean;
  renderer: RendererKind;
}

export interface MountOptions {
  /** Rendered inside <Canvas>, wrapped in Suspense. */
  scene: ReactNode;
  /** DOM overlay rendered above the canvas, inside el. */
  html?: ReactNode;
  /** Providers shared by scene and html (R3F bridges context into the canvas). */
  wrap?: (children: ReactNode) => ReactNode;
  /** 'webgl' (default) or 'webgpu' (three/webgpu, falls back to WebGL2 by itself). */
  renderer?: RendererKind;
  /** Camera props. Default { position: [0, 0, 5], fov: 35 }. */
  camera?: CanvasProps['camera'];
  /** Highest device pixel ratio to render at. Default 2. */
  maxDpr?: number;
  /** 'always' (default) or 'demand'. Becomes 'never' while offscreen. */
  frameloop?: 'always' | 'demand';
  /** CSS injected while mounted. Scope selectors under your className. */
  css?: string;
  /** Class added to the container, for scoping css. */
  className?: string;
  /** Shown when the browser cannot draw 3D or the scene throws. */
  fallback?: string;
  /** Extra Canvas props (flat, linear, shadows, onCreated, gl overrides...). */
  canvas?: Partial<CanvasProps>;
}

const PieceContext = createContext<Piece | null>(null);

/** Theme, motion and visibility for the piece this component lives in. */
export function usePiece(): Piece {
  const p = useContext(PieceContext);
  if (!p) throw new Error('usePiece() must be used inside mountCanvas');
  return p;
}

/** Pick a value by theme: useThemed('#fff', '#000'). */
export function useThemed<T>(light: T, dark: T): T {
  return usePiece().dark ? dark : light;
}

const readTheme = (): Theme =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

/** True when this browser can make the context the renderer needs. */
export function canRender(kind: RendererKind = 'webgl'): boolean {
  if (kind === 'webgpu' && 'gpu' in navigator) return true;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || (kind === 'webgl' ? c.getContext('webgl') : null)) as
      | WebGLRenderingContext
      | null;
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

class Boundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Note({ text }: { text: string }) {
  return <p className="p3d-note">{text}</p>;
}

const BASE_CSS = `
.p3d { position: absolute; inset: 0; overflow: hidden; }
.p3d > div:first-child { position: absolute !important; inset: 0; }
.p3d canvas { display: block; outline: none; -webkit-tap-highlight-color: transparent; }
.p3d-note { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; padding: 24px; text-align: center; color: var(--t3); }
`;

export function mountCanvas(el: HTMLElement, opts: MountOptions): () => void {
  const kind = opts.renderer ?? 'webgl';
  const root = document.createElement('div');
  root.className = 'p3d' + (opts.className ? ' ' + opts.className : '');
  const style = document.createElement('style');
  style.textContent = BASE_CSS + (opts.css ?? '');
  el.appendChild(style);
  el.appendChild(root);

  // One small store for theme, motion and visibility.
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let piece: Piece = {
    el,
    root,
    theme: readTheme(),
    dark: readTheme() === 'dark',
    reducedMotion: motion.matches,
    visible: true,
    renderer: kind
  };
  const subs = new Set<() => void>();
  const set = (patch: Partial<Piece>) => {
    const next = { ...piece, ...patch };
    next.dark = next.theme === 'dark';
    if (Object.keys(patch).every((k) => (piece as any)[k] === (next as any)[k])) return;
    piece = next;
    subs.forEach((f) => f());
  };
  const subscribe = (f: () => void) => {
    subs.add(f);
    return () => subs.delete(f);
  };

  const themeObs = new MutationObserver(() => set({ theme: readTheme() }));
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const onMotion = () => set({ reducedMotion: motion.matches });
  motion.addEventListener('change', onMotion);
  const io = new IntersectionObserver(([e]) => set({ visible: e.isIntersecting }), { rootMargin: '120px' });
  io.observe(el);

  const fallback = opts.fallback ?? "This piece needs 3D graphics, which this browser has turned off.";
  const dpr = Math.min(opts.maxDpr ?? 2, window.devicePixelRatio || 1);

  const gl: CanvasProps['gl'] =
    kind === 'webgpu'
      ? async (props) => {
          const { WebGPURenderer } = await import('three/webgpu');
          const r = new WebGPURenderer({ ...(props as object), antialias: true, alpha: true });
          await r.init();
          return r as never;
        }
      : { antialias: true, alpha: true, powerPreference: 'high-performance' };

  function App() {
    const p = useSyncExternalStore(subscribe, () => piece);
    const content = (
      <>
        <Canvas
          gl={gl}
          dpr={[1, Math.max(1, dpr)]}
          camera={opts.camera ?? { position: [0, 0, 5], fov: 35 }}
          frameloop={p.visible ? (opts.frameloop ?? 'always') : 'never'}
          style={{ position: 'absolute', inset: 0, touchAction: 'pan-y' }}
          onContextMenu={(e) => e.preventDefault()}
          {...opts.canvas}
        >
          <Suspense fallback={null}>{opts.scene}</Suspense>
        </Canvas>
        {opts.html}
      </>
    );
    return (
      <PieceContext.Provider value={p}>
        <Boundary fallback={<Note text={fallback} />}>{opts.wrap ? opts.wrap(content) : content}</Boundary>
      </PieceContext.Provider>
    );
  }

  // Errors the boundary catches become a quiet warning instead of a console error.
  const reactRoot = createRoot(root, {
    onCaughtError: (error) => console.warn('3d piece failed:', error instanceof Error ? error.message : error)
  });
  if (canRender(kind)) {
    reactRoot.render(<App />);
  } else {
    reactRoot.render(<Note text={fallback} />);
  }

  let done = false;
  return () => {
    if (done) return;
    done = true;
    io.disconnect();
    themeObs.disconnect();
    motion.removeEventListener('change', onMotion);
    subs.clear();
    // R3F frees the renderer (and its context) as part of unmount.
    reactRoot.unmount();
    root.remove();
    style.remove();
  };
}
