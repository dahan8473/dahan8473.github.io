// Racket hits by shot, net, floor taps and whooshes, synthesized (from play/badminton.js).
// Respects the site's mute: the head's speaker toggle writes dl-sound.
export interface Sound {
  muted(): boolean;
  unlock(): void;
  /** A racket hit, by shot: drops and net shots soft, drives punchy, clears clean, smashes sharp. */
  hit(kind: string): void;
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
    // Strings on cork, by shot. Softer shots are quieter and duller, a clear
    // rings clean, a smash cracks.
    hit(kind) {
      if (kind === 'smash') {
        hiss(0.03, 0.9, 'highpass', 3500, 3000, 0.7);
        tone(1800, 700, 0.05, 0.5, 'sine');
        tone(140, 60, 0.12, 0.55, 'sine');
      } else if (kind === 'clear' || kind === 'lift' || kind === 'serveHigh') {
        tone(1650, 1640, 0.24, 0.3, 'sine');
        tone(2480, 2470, 0.2, 0.14, 'sine');
        tone(3300, 3290, 0.16, 0.06, 'sine');
        hiss(0.012, 0.16, 'bandpass', 3500, 3200, 1.2);
        hiss(0.32, 0.03, 'bandpass', 4200, 3600, 0.6, 0.03);
      } else if (kind === 'drive') {
        tone(1400, 600, 0.05, 0.24, 'sine');
        hiss(0.04, 0.2, 'bandpass', 2400, 2000, 1.1);
        tone(300, 180, 0.06, 0.12, 'sine');
      } else {
        tone(1100, 700, 0.04, 0.08, 'sine');
        hiss(0.025, 0.05, 'bandpass', 1600, 1300, 1.2);
      }
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
