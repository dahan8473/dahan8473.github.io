// Guitar state shared by the canvas and the chord bar, plus the playing logic:
// plucks and strums go to the site's synth (/play/guitar-audio.js) and set the
// strings vibrating.
import { createStore, storeContext, type Store } from '../lib/store';

export interface Engine {
  pluck(string: number, fret?: number, velocity?: number, where?: number): void;
  strum(frets: (number | null)[] | string, opts?: { down?: boolean; spread?: number; velocity?: number }): void;
  damp(string?: number): void;
  ready(): Promise<boolean>;
  setVolume(v: number): void;
  dispose(): void;
}

// Same shapes as the synth's chord table: frets low E to high E, null = muted.
export const CHORDS: Record<string, (number | null)[]> = {
  Am: [null, 0, 2, 2, 1, 0],
  C: [null, 3, 2, 0, 1, 0],
  D: [null, null, 0, 2, 3, 2],
  Em: [0, 2, 2, 0, 0, 0],
  G: [3, 2, 0, 0, 0, 3],
  E: [0, 2, 2, 1, 0, 0],
  A: [null, 0, 2, 2, 2, 0],
  F: [1, 3, 3, 2, 1, 1]
};
export const CHORD_NAMES = Object.keys(CHORDS);
const OPEN = [0, 0, 0, 0, 0, 0];

/** One string's geometry in guitar space (meters): nut and saddle ends. */
export interface StringGeom {
  nut: [number, number, number];
  saddle: [number, number, number];
  radius: number;
  wound: boolean;
}

export interface Geom {
  strings: StringGeom[];
  /** Distance from the nut of each fret, index = fret number (0 = nut). */
  frets: number[];
  scale: number;
}

/** Screen segment of a string, px inside the stage, a = nut end. */
export interface Seg {
  ax: number;
  ay: number;
  bx: number;
  by: number;
}

export interface Vib {
  /** Peak displacement now, meters. */
  amp: number;
  /** Seconds until a scheduled pluck lands (strums roll across the strings). */
  delay: number;
  pending: number;
  /** Fast decay after a damp. */
  damped: boolean;
  phase: number;
  /** Accent glow, 0..1. */
  flash: number;
}

/** What one take holds: every note and chord change, ms after Record was pressed. */
export type TakeEvent =
  | { t: number; kind: 'pluck'; string: number; fret: number | null; chord: string | null; velocity: number; where: number }
  | { t: number; kind: 'strum'; frets: (number | null)[]; chord: string | null; velocity: number; down: boolean }
  | { t: number; kind: 'chord'; chord: string | null };

/** The synth's output, taped with MediaRecorder while recording. */
export interface Tape {
  rec: MediaRecorder;
  dest: MediaStreamAudioDestinationNode;
  /** performance.now() at the tape's first sample. */
  at: number;
  blob: Promise<Blob | null>;
  stopTimer: number;
  /** A note was dropped while recording (the site was muted), so the tape is missing it. */
  gaps: boolean;
}

export interface Take {
  events: TakeEvent[];
  t0: number;
  ms: number;
  /** Plucks plus strums. */
  notes: number;
  chord0: string | null;
  tape: Tape | null;
  buffer: AudioBuffer | null;
}

export type RecState = 'idle' | 'rec' | 'done' | 'play';

export interface GuitarState {
  chord: string | null;
  ready: boolean;
  /** Touch: after a first tap, swipes strum instead of scrolling. */
  armed: boolean;
  /** The site's sound is muted (the head's speaker toggle). */
  muted: boolean;
  /** Bumped on every note, for the chord bar's hint. */
  played: number;
  /** Brought out over the page (site.js's overlay): full screen, with a recorder. */
  full: boolean;
  rec: RecState;
  /** Whole seconds on the recorder's clock. */
  clock: number;
  /** Notes on the take being recorded, for the goal meter. */
  notes: number;
  /** Bumped per take, so the goal meter starts over. */
  takeNo: number;
}

export function createGuitarStore(full = false) {
  const store = createStore<GuitarState>({ chord: null, ready: false, armed: full, muted: false, played: 0, full, rec: 'idle', clock: 0, notes: 0, takeNo: 0 });
  return Object.assign(store, {
    refs: {
      engine: null as Engine | null,
      /** Our own context and output, so the recorder can tap what the synth plays. */
      audio: null as { ctx: AudioContext; out: GainNode } | null,
      take: null as Take | null,
      /** Every finished take this time out: length and notes. */
      takes: [] as { ms: number; notes: number }[],
      /** Notes they played themselves (not playbacks). */
      mine: 0,
      /** Timers and the playing source of the recorder, cleared together. */
      recTimers: [] as number[],
      source: null as AudioBufferSourceNode | null,
      playSeq: 0,
      /** Tells the page (site.js) about the piece: ready, a take finished. */
      emit: (_type: string, _detail?: object) => {},
      geom: null as Geom | null,
      segs: [] as Seg[],
      vib: Array.from({ length: 6 }, (): Vib => ({ amp: 0, delay: 0, pending: 0, damped: false, phase: Math.random() * 6, flash: 0 })),
      hover: -1,
      lastPlay: 0,
      down: true,
      /** Set by the first pointer press or key press inside the stage. */
      gesture: false
    }
  });
}

export type GuitarStore = Store<GuitarState> & ReturnType<typeof createGuitarStore>;

const ctx = storeContext<GuitarState>('guitar');
export const GuitarProvider = ctx.Provider;
export const useGuitarStore = ctx.useStoreRef as () => GuitarStore;
export const useGuitar = ctx.useSelect;

export function shapeOf(store: GuitarStore): (number | null)[] {
  const c = store.get().chord;
  return c && CHORDS[c] ? CHORDS[c] : OPEN;
}

export function isMuted() {
  try {
    if (localStorage.getItem('dl-sound') === '0') return true;
  } catch {
    /* storage blocked */
  }
  return !!document.querySelector('.dl.muted');
}

/** Sound only once the page has had a real gesture (browsers block audio before). */
function canSound(store: GuitarStore) {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return store.refs.gesture || !!ua?.hasBeenActive;
}

// The first note after a pause tells the page, which pauses any recording.
function noted(store: GuitarStore, sounded: boolean) {
  const now = performance.now();
  if (sounded) {
    if (now - store.refs.lastPlay > 2500) document.dispatchEvent(new CustomEvent('dl:guitar-play'));
    store.refs.lastPlay = now;
  }
  const muted = isMuted();
  store.set({ played: store.get().played + 1, muted });
}

const ampFor = (velocity: number) => 0.0012 + 0.0028 * velocity;

function excite(store: GuitarStore, s: number, velocity: number, delay = 0) {
  const v = store.refs.vib[s];
  if (delay > 0) {
    v.delay = delay;
    v.pending = ampFor(velocity);
  } else {
    v.amp = Math.max(v.amp * 0.4, ampFor(velocity));
    v.damped = false;
    v.flash = 1;
  }
}

type Untimed<E> = E extends unknown ? Omit<E, 't'> : never;

// While recording, every note goes on the take.
function capture(store: GuitarStore, ev: Untimed<TakeEvent>) {
  const take = store.refs.take;
  if (!take || store.get().rec !== 'rec') return;
  take.events.push({ ...ev, t: performance.now() - take.t0 } as TakeEvent);
  if (ev.kind !== 'chord') {
    take.notes++;
    store.set({ notes: take.notes });
    if (take.tape && isMuted()) take.tape.gaps = true;
  }
}

// A note played after Stop ends the tape's ring-out, so it never lands on the take.
function cutTail(store: GuitarStore) {
  const tape = store.refs.take?.tape;
  if (tape && store.get().rec === 'done' && tape.rec.state === 'recording') {
    clearTimeout(tape.stopTimer);
    try {
      tape.rec.stop();
    } catch {
      /* already stopping */
    }
  }
}

/** One string at a given fret (null: the fretting hand mutes it). sound false: the strings only move. */
export function playPluck(store: GuitarStore, s: number, f: number | null, velocity: number, where: number, sound = true) {
  if (sound) cutTail(store);
  const eng = sound && canSound(store) ? store.refs.engine : null;
  if (f == null) {
    // A string the chord mutes just thuds.
    eng?.damp(s);
    const v = store.refs.vib[s];
    v.amp = Math.max(v.amp, 0.0004);
    v.damped = true;
    v.flash = 0.5;
    noted(store, !!eng);
    return;
  }
  eng?.pluck(s, f, velocity, where);
  excite(store, s, velocity);
  noted(store, !!eng);
}

/** A strum across a shape (frets low E to high E, null = muted). */
export function playStrum(store: GuitarStore, shape: (number | null)[], down: boolean, velocity: number, sound = true) {
  if (sound) cutTail(store);
  const eng = sound && canSound(store) ? store.refs.engine : null;
  eng?.strum(shape, { down, velocity, spread: 16 });
  let k = 0;
  for (let i = 0; i < 6; i++) {
    const s = down ? i : 5 - i;
    if (shape[s] == null) {
      store.refs.vib[s].damped = true;
      continue;
    }
    excite(store, s, velocity * (1 - 0.04 * k), k * 0.016);
    k++;
  }
  noted(store, !!eng);
}

/** Pluck one string (0 = low E) with the current chord's fret. */
export function pluck(store: GuitarStore, s: number, velocity = 0.7, where = 0.5) {
  const f = shapeOf(store)[s] ?? null;
  capture(store, { kind: 'pluck', string: s, fret: f, chord: store.get().chord, velocity, where });
  store.refs.mine++;
  playPluck(store, s, f, velocity, where);
}

/** Strum the current chord (or open strings). Alternates down and up when down is omitted. */
export function strum(store: GuitarStore, opts: { down?: boolean; velocity?: number } = {}) {
  const down = opts.down ?? store.refs.down;
  store.refs.down = !down;
  const velocity = opts.velocity ?? 0.8;
  const shape = shapeOf(store);
  capture(store, { kind: 'strum', frets: shape.slice(), chord: store.get().chord, velocity, down });
  store.refs.mine++;
  playStrum(store, shape, down, velocity);
}

/** Changing the chord stops what's ringing on the strings it mutes. */
export function setChord(store: GuitarStore, chord: string | null) {
  if (chord !== store.get().chord) capture(store, { kind: 'chord', chord });
  store.set({ chord });
  const shape = shapeOf(store);
  shape.forEach((f, s) => {
    if (f == null) store.refs.vib[s].damped = true;
  });
}

/** The pluck position the synth wants: 0 at the bridge, ~0.55 over the soundhole, 1 at the fingerboard end. */
export function whereFor(fromSaddle: number, vibrating: number) {
  const beta = fromSaddle / Math.max(vibrating, 1e-3);
  return Math.min(1, Math.max(0, (beta - 0.035) / 0.3));
}

/** Turn the audio on inside a user gesture. */
export function gesture(store: GuitarStore) {
  store.refs.gesture = true;
  store.refs.engine?.ready().catch(() => {});
}
