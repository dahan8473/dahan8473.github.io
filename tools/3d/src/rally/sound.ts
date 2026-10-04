// Pocks, net, floor taps and whooshes, synthesized (from play/badminton.js).
// Respects the site's mute: the head's speaker toggle writes dl-sound.
export interface Sound {
  muted(): boolean;
  unlock(): void;
  pock(p?: number): void;
  crack(): void;
  net(): void;
  floor(p?: number): void;
  whoosh(p?: number): void;
  point(good: boolean): void;
  close(): void;
}

export function makeSound(): Sound {
  let ctx: AudioContext | null = null;
  let out: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  const muted = () => {
    try {
      if (localStorage.getItem('dl-sound') === '0') return true;
    } catch {}
    const dl = document.querySelector('.dl');
    return !!(dl && dl.classList.contains('muted'));
  };
  const live = () => !!ctx && ctx.state === 'running' && !muted();
  function env(g: GainNode, t: number, vol: number, dur: number, attack = 0.003) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(f0: number, f1: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0) {
    if (!live()) return;
    const c = ctx!;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, vol, dur);
    o.connect(g).connect(out!);
    o.start(t);
    o.stop(t + dur + 0.03);
  }
  function hiss(dur: number, vol: number, type: BiquadFilterType, f0: number, f1: number, q = 1, delay = 0) {
    if (!live()) return;
    const c = ctx!;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    src.buffer = noise;
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, vol, dur, 0.004);
    src.connect(f).connect(g).connect(out!);
    src.start(t, Math.random() * 0.3);
    src.stop(t + dur + 0.03);
  }
  const s: Sound = {
    muted,
    unlock() {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      if (!ctx) {
        try {
          ctx = new AC();
        } catch {
          return;
        }
        out = ctx.createGain();
        out.gain.value = 0.7;
        out.connect(ctx.destination);
        noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    // Strings on cork: a short hollow pock, crisper the harder it's hit.
    pock(p = 1) {
      tone(1250 + 300 * p, 520, 0.035, 0.16 + 0.12 * p, 'triangle');
      hiss(0.028 + 0.012 * p, 0.14 + 0.16 * p, 'bandpass', 3400, 2300, 2.2);
      tone(420, 230, 0.05, 0.08 * p);
    },
    crack() {
      s.pock(1.5);
      hiss(0.05, 0.22, 'highpass', 5200, 3200, 0.8);
    },
    net() {
      hiss(0.18, 0.22, 'lowpass', 900, 220, 0.8);
      tone(160, 70, 0.14, 0.16);
    },
    floor(p = 1) {
      tone(300, 130, 0.05, 0.14 * p);
      hiss(0.035, 0.09 * p, 'bandpass', 1900, 900, 1.6);
    },
    whoosh(p = 1) {
      hiss(0.1 + 0.07 * p, 0.04 + 0.05 * p, 'bandpass', 520, 2600, 1.4);
    },
    point(good) {
      const [a, b] = good ? [587, 880] : [523, 392];
      tone(a, a, 0.12, 0.06, 'sine');
      tone(b, b, 0.2, 0.06, 'sine', 0.1);
    },
    close() {
      if (ctx) ctx.close().catch(() => {});
      ctx = out = null;
      noise = null;
    }
  };
  return s;
}
