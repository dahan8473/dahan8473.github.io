// Styles for the globe's DOM, scoped under .p3d-globe (inside the stage) and
// .p3d-globe-modal (the popup, portaled to <body>). Site tokens:
// --t1/--t2/--t3 text, --rule hairlines, --fill subtle fill, --panel surfaces, --bg.
export const css = `
.p3d-globe { font: inherit; color: var(--t1); }
.p3d-globe button { font: inherit; color: inherit; }
.p3d-globe .g-wait { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: var(--t3); pointer-events: none; transition: opacity 400ms ease; }
.p3d-globe .g-wait.off { opacity: 0; }

.p3d-globe .g-card {
  position: absolute; left: 0; top: 0; z-index: 2;
  display: flex; flex-direction: column; gap: 10px;
  width: max-content; min-width: 150px; max-width: 232px; padding: 10px;
  border-radius: 12px; font-size: 13px; line-height: 1.35;
  background: var(--panel); color: var(--t1);
  box-shadow: 0 0 0 1px var(--rule), 0 8px 24px rgba(0, 0, 0, 0.12);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity 140ms ease, visibility 140ms;
}
.p3d-globe .g-card.pinned { pointer-events: auto; cursor: pointer; }
.p3d-globe .g-card p { margin: 0; }
.p3d-globe .g-card-text { padding: 0 2px; }
.p3d-globe .g-card-name { font-weight: 500; color: var(--t1); }
.p3d-globe .g-card-date { color: var(--t3); }
.p3d-globe .g-card-for { margin-top: 4px !important; color: var(--t2); }
.p3d-globe .g-card-more { margin-top: 6px !important; color: var(--t3); }
.p3d-globe .g-card-photos { display: grid; gap: 4px; width: 212px; max-width: 100%; }
.p3d-globe .g-card-photos.n1 { grid-template-columns: 1fr; width: 160px; }
.p3d-globe .g-card-photos.n2 { grid-template-columns: 1fr 1fr; width: 180px; }
.p3d-globe .g-card-photos.n3 { grid-template-columns: 1fr 1fr 1fr; }
.p3d-globe .g-card-photos img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 7px; background: var(--fill); }
.p3d-globe .g-card-photos.n1 img { aspect-ratio: 4 / 3; }

.p3d-globe .g-sr {
  position: absolute; z-index: 4; left: 16px; bottom: 16px; margin: 0; padding: 0; list-style: none;
  width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
.p3d-globe .g-sr:focus-within {
  width: auto; height: auto; overflow: visible; clip-path: none;
  padding: 6px; border-radius: 10px; background: var(--panel); box-shadow: 0 0 0 1px var(--rule);
}
.p3d-globe .g-sr button { display: block; width: 100%; padding: 4px 8px; border: 0; border-radius: 6px; background: transparent; text-align: left; font-size: 13px; color: var(--t2); cursor: pointer; }
.p3d-globe .g-sr button:focus-visible { color: var(--t1); background: var(--fill); }

.p3d-globe-modal { font: 400 16px/1.6 -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Geist', 'Segoe UI', sans-serif; letter-spacing: -0.011em; color: var(--t1); }
.p3d-globe-modal button { font: inherit; color: inherit; }
.p3d-globe-modal p, .p3d-globe-modal h2 { margin: 0; }
.p3d-globe-modal .gm-backdrop {
  position: fixed; inset: 0; z-index: 100;
  display: grid; place-items: center; padding: 32px 24px;
  background: color-mix(in srgb, var(--bg) 52%, transparent);
  -webkit-backdrop-filter: blur(10px) saturate(0.9); backdrop-filter: blur(10px) saturate(0.9);
  animation: gm-fade 180ms ease;
}
.p3d-globe-modal .gm-dialog {
  position: relative; display: flex; flex-direction: column;
  width: min(760px, 100%); max-height: calc(100dvh - 64px); overflow: hidden;
  border-radius: 18px; background: var(--panel);
  box-shadow: 0 0 0 1px var(--rule), 0 24px 64px rgba(0, 0, 0, 0.22);
  -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
  outline: none; animation: gm-rise 240ms cubic-bezier(.2, .7, .2, 1);
}
.p3d-globe-modal .gm-scroll { overflow: auto; overscroll-behavior: contain; padding: 28px 30px 30px; scrollbar-width: thin; }
.p3d-globe-modal .gm-close, .p3d-globe-modal .gm-v-close {
  position: absolute; top: 14px; right: 14px; z-index: 2;
  display: grid; place-items: center; width: 32px; height: 32px; padding: 0;
  border: 0; border-radius: 50%; background: var(--fill); color: var(--t2); cursor: pointer;
  transition: background 120ms ease, color 120ms ease;
}
.p3d-globe-modal .gm-close:hover { color: var(--t1); background: var(--rule); }
.p3d-globe-modal svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.p3d-globe-modal .gm-meta { margin-right: 44px; font-size: 13px; color: var(--t3); }
.p3d-globe-modal .gm-title { margin: 2px 44px 0 0; font: inherit; font-weight: 500; color: var(--t1); }
.p3d-globe-modal .gm-for { margin-top: 4px; color: var(--t2); }
.p3d-globe-modal .gm-note { margin-top: 14px; color: var(--t2); max-width: 36em; }
.p3d-globe-modal .gm-sec { margin-top: 26px; padding-top: 18px; border-top: 1px solid var(--rule); }
.p3d-globe-modal .gm-label { margin-bottom: 10px !important; font-size: 13px; color: var(--t3); }
.p3d-globe-modal .gm-empty { font-size: 14px; color: var(--t3); }
.p3d-globe-modal .gm-videos { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)); gap: 12px; }
.p3d-globe-modal .gm-yt {
  position: relative; display: block; width: 100%; aspect-ratio: 16 / 9; padding: 0; overflow: hidden;
  border: 0; border-radius: 10px; background: var(--fill); cursor: pointer;
}
.p3d-globe-modal .gm-yt img { width: 100%; height: 100%; object-fit: cover; transition: opacity 150ms ease; }
.p3d-globe-modal .gm-yt:hover img { opacity: 0.9; }
.p3d-globe-modal .gm-yt iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
.p3d-globe-modal .gm-play {
  position: absolute; left: 50%; top: 50%; translate: -50% -50%;
  display: grid; place-items: center; width: 50px; height: 50px; border-radius: 50%;
  background: rgba(0, 0, 0, 0.55); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  transition: background 150ms ease;
}
.p3d-globe-modal .gm-yt:hover .gm-play { background: rgba(0, 0, 0, 0.72); }
.p3d-globe-modal .gm-play svg { width: 24px; height: 24px; fill: #fff; stroke: none; margin-left: 2px; }
.p3d-globe-modal .gm-photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); gap: 8px; }
.p3d-globe-modal .gm-photo { display: block; padding: 0; border: 0; border-radius: 8px; overflow: hidden; background: var(--fill); cursor: zoom-in; }
.p3d-globe-modal .gm-photo img { width: 100%; aspect-ratio: 1; object-fit: cover; transition: transform 200ms ease; }
.p3d-globe-modal .gm-photo:hover img { transform: scale(1.03); }

.p3d-globe-modal .gm-viewer {
  position: absolute; inset: 0; z-index: 3; display: grid; place-items: center;
  background: rgba(8, 8, 9, 0.97); animation: gm-fade 160ms ease;
}
.p3d-globe-modal .gm-viewer img { max-width: calc(100% - 112px); max-height: calc(100% - 88px); object-fit: contain; border-radius: 6px; }
.p3d-globe-modal .gm-v-close { background: rgba(255, 255, 255, 0.12); color: #fff; }
.p3d-globe-modal .gm-v-prev, .p3d-globe-modal .gm-v-next {
  position: absolute; top: 50%; translate: 0 -50%;
  display: grid; place-items: center; width: 40px; height: 40px; padding: 0;
  border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.12); color: #fff; cursor: pointer;
}
.p3d-globe-modal .gm-v-prev { left: 12px; }
.p3d-globe-modal .gm-v-next { right: 12px; }
.p3d-globe-modal .gm-v-prev:hover, .p3d-globe-modal .gm-v-next:hover, .p3d-globe-modal .gm-v-close:hover { background: rgba(255, 255, 255, 0.22); }
.p3d-globe-modal .gm-v-count { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; font-size: 13px; color: rgba(255, 255, 255, 0.6); }

@media (max-width: 600px) {
  .p3d-globe-modal .gm-backdrop { padding: 0; }
  .p3d-globe-modal .gm-dialog { width: 100%; height: 100dvh; max-height: none; border-radius: 0; animation-name: gm-sheet; }
  .p3d-globe-modal .gm-scroll { flex: 1; padding: calc(22px + env(safe-area-inset-top, 0px)) 20px calc(28px + env(safe-area-inset-bottom, 0px)); }
  .p3d-globe-modal .gm-close { top: calc(12px + env(safe-area-inset-top, 0px)); right: 12px; }
  .p3d-globe-modal .gm-photos { grid-template-columns: repeat(3, 1fr); gap: 6px; }
  .p3d-globe-modal .gm-viewer img { max-width: 100%; max-height: calc(100% - 140px); border-radius: 0; }
  .p3d-globe-modal .gm-v-prev, .p3d-globe-modal .gm-v-next { top: auto; bottom: 8px; translate: none; }
  .p3d-globe-modal .gm-v-count { bottom: 20px; }
}
@keyframes gm-fade { from { opacity: 0; } }
@keyframes gm-rise { from { opacity: 0; transform: translateY(10px) scale(0.985); } }
@keyframes gm-sheet { from { transform: translateY(24px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .p3d-globe .g-card, .p3d-globe .g-wait { transition: none; }
  .p3d-globe-modal .gm-backdrop, .p3d-globe-modal .gm-dialog, .p3d-globe-modal .gm-viewer { animation: none; }
}
`;
