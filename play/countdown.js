// 3, 2, 1, go: shown over a game before its timed run starts (pinball,
// ebbflow, penguin). countdown(host) lays a glass over host, counts down and
// resolves when it's done, or straight away with reduced motion. Resolves
// false if host left the page meanwhile (they quit), so the caller can bail.

const CSS_ID = 'play-countdown-css';
const CSS = `
.pcd { position: absolute; inset: 0; z-index: 5; display: grid; place-items: center; border-radius: inherit;
  background: color-mix(in srgb, var(--bg) 62%, transparent); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
  pointer-events: none; transition: opacity 220ms ease; }
.pcd.out { opacity: 0; }
.pcd b { color: var(--t1); font-size: 64px; font-weight: 500; line-height: 1; font-variant-numeric: tabular-nums; animation: pcd-pop 600ms cubic-bezier(.2, 1.4, .4, 1) both; }
.pcd b.go { color: #88c0d0; }
@keyframes pcd-pop { 0% { opacity: 0; transform: scale(1.6); } 30% { opacity: 1; transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: scale(0.85); } }
`;

export function countdown(host, { from = 3, step = 650 } = {}) {
  if (!host || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve(true);
  if (!document.getElementById(CSS_ID)) {
    const s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const veil = document.createElement('div');
  veil.className = 'pcd';
  veil.setAttribute('aria-live', 'assertive');
  host.appendChild(veil);
  const show = (t) => {
    const b = document.createElement('b');
    b.textContent = t;
    if (t === 'Go!') b.className = 'go';
    veil.replaceChildren(b);
  };
  return new Promise((resolve) => {
    let n = from;
    show(String(n));
    const tick = () => {
      if (!document.contains(veil)) { resolve(false); return; }
      n--;
      if (n > 0) { show(String(n)); setTimeout(tick, step); return; }
      if (n === 0) { show('Go!'); setTimeout(tick, step * 0.7); return; }
      veil.classList.add('out');
      setTimeout(() => veil.remove(), 220);
      resolve(true);
    };
    setTimeout(tick, step);
  });
}
