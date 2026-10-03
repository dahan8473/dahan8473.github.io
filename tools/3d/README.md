# tools/3d

3D pieces for davidliu.work. Vite + React 19 + @react-three/fiber + drei + three.
Builds into the repo's `/3d/` folder, which site.js loads:

```html
<div class="stage3d tall" data-3d="globe" data-v="1"><p class="piece-note">Loading the globe...</p></div>
```

site.js does `import('/3d/globe.js?v=1')`, calls `mount(el)` and keeps the
returned function to clean up when the page swaps. Bump `data-v` after a rebuild
so browsers fetch the new entry (chunks are content hashed).

## Build

```sh
cd tools/3d
npm install
npm run build        # typecheck, then build to ../../3d (wipes /3d first)
npm run build:fast   # skip the typecheck
npm run dev          # rebuild on change
```

Output: `/3d/<entry>.js` per entry, shared code in `/3d/chunks/` (stable
`react`, `three` and `three-webgpu` vendor chunks so every piece reuses one
cached copy), everything in `public/` copied as is (`public/models/x.glb` is
served at `/3d/models/x.glb`).

## Add an entry

Create `src/entries/<name>.tsx`; it is picked up automatically and becomes
`/3d/<name>.js`. It must export `mount(el)` returning a cleanup function, which
`mountCanvas` already does:

```tsx
import { mountCanvas } from '../lib/mountCanvas';
import { Cameras } from '../cameras/Scene';

export function mount(el: HTMLElement) {
  return mountCanvas(el, { scene: <Cameras />, className: 'p3d-cameras' });
}
```

Then put `<div class="stage3d" data-3d="<name>" data-v="1">` on a page (the lead
adds it through tools/build.py).

## The helper: src/lib/mountCanvas.tsx

`mountCanvas(el, options) => cleanup`

| option | default | |
| --- | --- | --- |
| `scene` | required | React nodes rendered inside `<Canvas>` (wrapped in Suspense, so `useGLTF` and `use()` work) |
| `html` | none | DOM overlay rendered above the canvas, inside el |
| `wrap` | none | `(children) => <Provider>{children}</Provider>`, shared by scene and html (R3F bridges context into the canvas) |
| `renderer` | `'webgl'` | `'webgpu'` uses three/webgpu (lazy loaded) and falls back to WebGL2 by itself |
| `camera` | `{ position: [0, 0, 5], fov: 35 }` | R3F camera props |
| `maxDpr` | `2` | DPR cap |
| `frameloop` | `'always'` | or `'demand'`; switches to `'never'` while el is offscreen |
| `css` | none | CSS injected while mounted; scope it under `className` |
| `className` | none | added to the container (`.p3d`) |
| `fallback` | generic | text shown when WebGL/WebGPU is missing or the scene throws |
| `canvas` | none | extra Canvas props (`flat`, `shadows`, `onCreated`, `gl` overrides...) |

What it handles: transparent canvas over the page, theme (watches `data-theme`
on `<html>`), `prefers-reduced-motion`, pausing offscreen (IntersectionObserver),
DPR cap, resizing (R3F), a quiet fallback note, errors caught into that note, and
a cleanup that unmounts React, lets R3F dispose the renderer and lose its
context, and removes every node and listener it added.

Hooks for anything inside `scene` or `html`:

- `usePiece()` returns `{ el, root, theme, dark, reducedMotion, visible, renderer }`
- `useThemed(lightValue, darkValue)`
- `usePageFriendlyGestures()` from `src/lib/gestures.ts`: call it in a component
  that also renders OrbitControls. Wheel zooms only after the visitor presses on
  the piece (or pinches on a trackpad), so the page still scrolls past it; touch
  keeps vertical swipes for page scroll.

Site tokens for overlays: `--t1 --t2 --t3` text by opacity, `--rule`, `--fill`,
`--panel`, `--bg`; one accent `#88c0d0`. No em dashes in visible text.

## Models

Put models in `public/models/` and load them with
`useGLTF(import.meta.env.BASE_URL + 'models/x.glb')`. Compress first:

```sh
npx gltf-transform optimize in.glb public/models/x.glb --compress meshopt --texture-compress webp
```

drei's `useGLTF` decodes meshopt and draco out of the box.

The globe's point cloud is `public/models/globe.bin` (688 KB), packed from
tsi-globe's 10 MB `globe.glb` by `scripts/pack-globe.mjs` (gzip of a run length
land mask plus one byte of elevation per point; decoded in `src/globe/data.ts`).
gltf-transform could not shrink that file (it was already meshopt, and its
float attributes don't quantize), which is why it has its own format.

## Globe

`src/entries/globe.tsx`, code in `src/globe/`. Reads
`/hobbies/travel/places.json` (or `el.dataset.places`):
`{ places: [{ id, name, country, lat, lng, date, for, note, videos: [youtubeId], photos: [path], cover: [up to 3 paths] }] }`.

- Fit: the globe spans about 74% (landscape) or 80% (portrait) of the stage's
  smaller side, a little below the middle, and moves down (or shrinks) to clear
  `el.dataset.avoid` (default `main > .header`, the page title).
- Hover, keyboard focus, or a first tap on a marker shows a card (name, date,
  `for`, up to 3 `cover` photos) that follows the marker. Click, Enter, or a
  second tap opens the popup, portaled to `<body>`: details, vlog lite embeds,
  and all photos (each opens larger inside it).
