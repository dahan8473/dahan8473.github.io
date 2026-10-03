// DOM styles shared by the product pieces: the hover card, the loading note and
// the keyboard list (hidden until tabbed into). Scoped under a class.
export function sharedCss(scope: string, fade: { x?: number; y?: number } = {}) {
  const s = '.' + scope;
  const fx = fade.x ?? 5;
  const fy = fade.y ?? 6;
  // Soft edges: nothing the canvas draws (floor glow, shadows, a model orbited
  // close) ever shows a hard box edge.
  const mask = `linear-gradient(to right, transparent, #000 ${fx}%, #000 ${100 - fx}%, transparent), linear-gradient(to bottom, transparent, #000 ${fy}%, #000 ${100 - fy}%, transparent)`;
  return `
${s} { font: inherit; color: var(--t1); }
${s} canvas { -webkit-mask-image: ${mask}; -webkit-mask-composite: source-in; mask-image: ${mask}; mask-composite: intersect; }
${s} button { font: inherit; color: inherit; }
${s} .dl-wait { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: var(--t3); pointer-events: none; transition: opacity 400ms ease; }
${s} .dl-wait.off { opacity: 0; }

${s} .dl-card {
  position: absolute; left: 0; top: 0; z-index: 2;
  width: max-content; min-width: 168px; max-width: 248px; padding: 11px 13px 12px;
  border-radius: 12px; font-size: 13px; line-height: 1.4;
  background: var(--panel); color: var(--t1);
  box-shadow: 0 0 0 1px var(--rule), 0 8px 24px rgba(0, 0, 0, 0.12);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity 140ms ease, visibility 140ms;
}
${s} .dl-card.on { opacity: 1; visibility: visible; }
${s} .dl-card p { margin: 0; }
${s} .dl-card-kind { font-size: 12px; color: var(--t3); }
${s} .dl-card-name { margin-top: 1px !important; font-weight: 500; color: var(--t1); }
${s} .dl-card-specs { margin: 7px 0 0; padding: 0; list-style: none; color: var(--t2); }
${s} .dl-card-specs li { position: relative; padding-left: 11px; }
${s} .dl-card-specs li + li { margin-top: 2px; }
${s} .dl-card-specs li::before { content: ''; position: absolute; left: 0; top: 0.62em; width: 4px; height: 4px; border-radius: 50%; background: var(--t3); }
${s} .dl-card-hint { display: flex; align-items: center; gap: 7px; margin-top: 9px !important; padding-top: 8px; border-top: 1px solid var(--rule); color: var(--t2); }
${s} .dl-card-hint::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: #88c0d0; box-shadow: 0 0 0 3px rgba(136, 192, 208, 0.22); }

/* Small stages: a tighter card, specs on one wrapped line. */
${s}.narrow .dl-card { min-width: 0; max-width: 200px; padding: 9px 11px 10px; font-size: 12px; border-radius: 10px; }
${s}.narrow .dl-card-kind { font-size: 11px; }
${s}.narrow .dl-card-specs { margin-top: 5px; }
${s}.narrow .dl-card-specs li { display: inline; padding: 0; }
${s}.narrow .dl-card-specs li::before { display: none; }
${s}.narrow .dl-card-specs li + li::before { display: inline; position: static; content: ', '; width: auto; height: auto; background: none; }
${s}.narrow .dl-card-hint { margin-top: 7px !important; padding-top: 6px; }

${s} .dl-sr {
  position: absolute; z-index: 4; left: 12px; bottom: 12px; margin: 0; padding: 0; list-style: none;
  width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
${s} .dl-sr:focus-within {
  width: auto; height: auto; overflow: visible; clip-path: none;
  padding: 6px; border-radius: 10px; background: var(--panel); box-shadow: 0 0 0 1px var(--rule);
}
${s} .dl-sr button { display: block; width: 100%; padding: 4px 8px; border: 0; border-radius: 6px; background: transparent; text-align: left; font-size: 13px; color: var(--t2); cursor: pointer; }
${s} .dl-sr button:focus-visible { outline: none; color: var(--t1); background: var(--fill); }
@media (prefers-reduced-motion: reduce) {
  ${s} .dl-card, ${s} .dl-wait { transition: none; }
}
`;
}
