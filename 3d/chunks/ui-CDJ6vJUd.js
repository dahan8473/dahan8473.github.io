import{r as e}from"./rolldown-runtime-hePW80VL.js";import{d as t}from"./react-C1Rx6iQb.js";var n=e(t(),1);function r(e){let t=e,n=new Set;return{get:()=>t,set(e){let r=!1;for(let n in e)t[n]!==e[n]&&(r=!0);r&&(t={...t,...e},n.forEach(e=>e()))},subscribe(e){return n.add(e),()=>{n.delete(e)}}}}function i(e){let t=(0,n.createContext)(null);function r(){let r=(0,n.useContext)(t);if(!r)throw Error(e+` store missing`);return r}function i(e){let t=r();return(0,n.useSyncExternalStore)(t.subscribe,()=>e(t.get()))}return{Provider:t.Provider,useStoreRef:r,useSelect:i}}function a(e,t={}){let n=`.`+e,r=t.x??5,i=t.y??6,a=`linear-gradient(to right, transparent, #000 ${r}%, #000 ${100-r}%, transparent), linear-gradient(to bottom, transparent, #000 ${i}%, #000 ${100-i}%, transparent)`;return`
${n} { font: inherit; color: var(--t1); }
${n} canvas { -webkit-mask-image: ${a}; -webkit-mask-composite: source-in; mask-image: ${a}; mask-composite: intersect; }
${n} button { font: inherit; color: inherit; }
${n} .dl-wait { position: absolute; inset: 0; display: grid; place-items: center; margin: 0; color: var(--t3); pointer-events: none; transition: opacity 400ms ease; }
${n} .dl-wait.off { opacity: 0; }

${n} .dl-card {
  position: absolute; left: 0; top: 0; z-index: 2;
  width: max-content; min-width: 168px; max-width: 248px; padding: 11px 13px 12px;
  border-radius: 12px; font-size: 13px; line-height: 1.4;
  background: var(--panel); color: var(--t1);
  box-shadow: 0 0 0 1px var(--rule), 0 8px 24px rgba(0, 0, 0, 0.12);
  -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
  pointer-events: none; opacity: 0; visibility: hidden;
  transition: opacity 140ms ease, visibility 140ms;
}
${n} .dl-card.on { opacity: 1; visibility: visible; }
${n} .dl-card p { margin: 0; }
${n} .dl-card-kind { font-size: 12px; color: var(--t3); }
${n} .dl-card-name { margin-top: 1px !important; font-weight: 500; color: var(--t1); }
${n} .dl-card-specs { margin: 7px 0 0; padding: 0; list-style: none; color: var(--t2); }
${n} .dl-card-specs li { position: relative; padding-left: 11px; }
${n} .dl-card-specs li + li { margin-top: 2px; }
${n} .dl-card-specs li::before { content: ''; position: absolute; left: 0; top: 0.62em; width: 4px; height: 4px; border-radius: 50%; background: var(--t3); }
${n} .dl-card-hint { display: flex; align-items: center; gap: 7px; margin-top: 9px !important; padding-top: 8px; border-top: 1px solid var(--rule); color: var(--t2); }
${n} .dl-card-hint::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: #88c0d0; box-shadow: 0 0 0 3px rgba(136, 192, 208, 0.22); }

/* Small stages: a tighter card, specs on one wrapped line. */
${n}.narrow .dl-card { min-width: 0; max-width: 200px; padding: 9px 11px 10px; font-size: 12px; border-radius: 10px; }
${n}.narrow .dl-card-kind { font-size: 11px; }
${n}.narrow .dl-card-specs { margin-top: 5px; }
${n}.narrow .dl-card-specs li { display: inline; padding: 0; }
${n}.narrow .dl-card-specs li::before { display: none; }
${n}.narrow .dl-card-specs li + li::before { display: inline; position: static; content: ', '; width: auto; height: auto; background: none; }
${n}.narrow .dl-card-hint { margin-top: 7px !important; padding-top: 6px; }

${n} .dl-sr {
  position: absolute; z-index: 4; left: 12px; bottom: 12px; margin: 0; padding: 0; list-style: none;
  width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
${n} .dl-sr:focus-within {
  width: auto; height: auto; overflow: visible; clip-path: none;
  padding: 6px; border-radius: 10px; background: var(--panel); box-shadow: 0 0 0 1px var(--rule);
}
${n} .dl-sr button { display: block; width: 100%; padding: 4px 8px; border: 0; border-radius: 6px; background: transparent; text-align: left; font-size: 13px; color: var(--t2); cursor: pointer; }
${n} .dl-sr button:focus-visible { outline: none; color: var(--t1); background: var(--fill); }
@media (prefers-reduced-motion: reduce) {
  ${n} .dl-card, ${n} .dl-wait { transition: none; }
}
`}export{r as n,i as r,a as t};