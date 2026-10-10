// The recorder on the brought-out guitar. A take is every note they play, with
// its time, string, fret or chord, velocity and strum direction; when the
// browser can, the synth's output is taped too (MediaRecorder on our own
// AudioContext). Playing it back moves the strings from the notes, with the
// taped sound under them, or the synth replaying the notes when there's no tape.
import { isMuted, playPluck, playStrum, setChord, type GuitarStore, type Tape, type Take, type TakeEvent } from './store';

const MAX_MS = 180000; // a take stops itself after 3 minutes
/** A take this long with this many notes makes the head cry (talk.js, dlHead.moved). */
export const GOAL = { ms: 3000, notes: 4 };
export const moving = (t: { ms: number; notes: number }) => t.ms >= GOAL.ms && t.notes >= GOAL.notes;
const TAIL_MS = 1400; // the tape keeps rolling this long after Stop, for the ring-out
const LEAD_MS = 150; // playback starts this long before the first note
const RING_MS = 1800; // how long the last note rings on a replay without a tape
const TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
// The chord they had picked before a playback, put back when it ends.
const picked = new WeakMap<GuitarStore, string | null>();

function later(store: GuitarStore, fn: () => void, ms: number) {
  const id = window.setTimeout(() => {
    store.refs.recTimers = store.refs.recTimers.filter((x) => x !== id);
    fn();
  }, ms);
  store.refs.recTimers.push(id);
}
function every(store: GuitarStore, fn: () => void, ms: number) {
  const id = window.setInterval(fn, ms);
  store.refs.recTimers.push(id);
}
function clearTimers(store: GuitarStore) {
  for (const id of store.refs.recTimers) {
    clearTimeout(id);
    clearInterval(id);
  }
  store.refs.recTimers = [];
}

function startTape(store: GuitarStore): Tape | null {
  const a = store.refs.audio;
  if (!a || typeof MediaRecorder === 'undefined' || typeof a.ctx.createMediaStreamDestination !== 'function') return null;
  try {
    const dest = a.ctx.createMediaStreamDestination();
    a.out.connect(dest);
    const type = TYPES.find((t) => MediaRecorder.isTypeSupported?.(t));
    const rec = new MediaRecorder(dest.stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    let done!: (b: Blob | null) => void;
    const tape: Tape = { rec, dest, at: performance.now(), blob: new Promise((r) => (done = r)), stopTimer: 0, gaps: false };
    rec.ondataavailable = (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      try {
        a.out.disconnect(dest);
      } catch {
        /* already gone */
      }
      done(chunks.length ? new Blob(chunks, { type: rec.mimeType || type || 'audio/webm' }) : null);
    };
    rec.onerror = () => done(null);
    // The tape's first sample lines up with the start() call (the start event comes ~60ms later).
    tape.at = performance.now();
    rec.start();
    return tape;
  } catch {
    return null;
  }
}

function endTape(tape: Tape | null, after = 0) {
  if (!tape) return;
  clearTimeout(tape.stopTimer);
  const stop = () => {
    if (tape.rec.state === 'inactive') return;
    try {
      tape.rec.stop();
    } catch {
      /* already stopping */
    }
  };
  if (after > 0) tape.stopTimer = window.setTimeout(stop, after);
  else stop();
}

export function startRec(store: GuitarStore) {
  stopPlay(store);
  endTape(store.refs.take?.tape ?? null);
  store.refs.engine?.ready().catch(() => {});
  const t0 = performance.now();
  store.refs.take = { events: [], t0, ms: 0, notes: 0, chord0: store.get().chord, tape: startTape(store), buffer: null };
  store.set({ rec: 'rec', clock: 0, notes: 0, takeNo: store.get().takeNo + 1 });
  every(
    store,
    () => {
      const ms = performance.now() - t0;
      if (ms >= MAX_MS) stopRec(store);
      else store.set({ clock: Math.floor(ms / 1000) });
    },
    250
  );
  store.refs.emit('dl:guitar-rec');
}

export function stopRec(store: GuitarStore) {
  const take = store.refs.take;
  if (!take || store.get().rec !== 'rec') return;
  clearTimers(store);
  take.ms = performance.now() - take.t0;
  endTape(take.tape, TAIL_MS);
  store.set({ rec: 'done', clock: Math.round(take.ms / 1000) });
  store.refs.takes.push({ ms: Math.round(take.ms), notes: take.notes });
  store.refs.emit('dl:guitar-take', { ms: Math.round(take.ms), notes: take.notes });
}

/** The chord showing at time t of the take. */
function chordAt(take: Take, t: number) {
  let c = take.chord0;
  for (const e of take.events) {
    if (e.t > t) break;
    if (e.kind === 'chord') c = e.chord;
  }
  return c;
}

function apply(store: GuitarStore, e: TakeEvent, sound: boolean) {
  if (e.kind === 'chord') setChord(store, e.chord);
  else if (e.kind === 'pluck') playPluck(store, e.string, e.fret, e.velocity, e.where, sound);
  else playStrum(store, e.frets, e.down, e.velocity, sound);
}

async function soundOf(store: GuitarStore, take: Take): Promise<AudioBuffer | null> {
  const a = store.refs.audio;
  if (!a || !take.tape || take.tape.gaps) return null;
  if (take.buffer) return take.buffer;
  endTape(take.tape);
  const blob = await Promise.race([take.tape.blob, new Promise<null>((r) => setTimeout(() => r(null), 2500))]);
  if (!blob) return null;
  try {
    take.buffer = await a.ctx.decodeAudioData(await blob.arrayBuffer());
  } catch {
    take.buffer = null;
  }
  return take.buffer;
}

export async function playTake(store: GuitarStore) {
  const take = store.refs.take;
  if (!take || store.get().rec === 'rec') return;
  stopPlay(store);
  const seq = ++store.refs.playSeq;
  picked.set(store, store.get().chord);
  store.set({ rec: 'play', clock: 0 });
  // The tape doesn't go through the synth, so tell the page here (it pauses its recordings).
  document.dispatchEvent(new CustomEvent('dl:guitar-play'));
  store.refs.engine?.ready().catch(() => {});
  const buf = isMuted() ? null : await soundOf(store, take);
  if (seq !== store.refs.playSeq) return;
  const a = store.refs.audio;

  const notes = take.events.filter((e) => e.kind !== 'chord');
  const first = notes.length ? notes[0].t : 0;
  const lead = Math.max(0, first - LEAD_MS);
  const start = performance.now() + 60;
  let endMs = (notes.length ? notes[notes.length - 1].t - lead : 0) + RING_MS;

  if (buf && a) {
    // Event time t sits at (t - tapeLead) in the tape.
    const tapeLead = take.tape ? take.tape.at - take.t0 : 0;
    let when = a.ctx.currentTime + 0.06;
    let off = (lead - tapeLead) / 1000;
    if (off < 0) {
      when -= off;
      off = 0;
    }
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(a.ctx.destination);
    src.start(when, Math.min(off, Math.max(0, buf.duration - 0.05)));
    store.refs.source = src;
    endMs = Math.max(0, (buf.duration - off) * 1000) + 60;
  }

  setChord(store, chordAt(take, lead));
  for (const e of take.events) {
    if (e.t < lead) continue;
    later(store, () => apply(store, e, !buf), start - performance.now() + (e.t - lead));
  }
  every(store, () => store.set({ clock: Math.floor((performance.now() - start) / 1000) }), 250);
  later(
    store,
    () => {
      if (seq === store.refs.playSeq) finishPlay(store);
    },
    endMs + 80
  );
}

function finishPlay(store: GuitarStore) {
  clearTimers(store);
  const src = store.refs.source;
  store.refs.source = null;
  if (src) {
    try {
      src.stop();
    } catch {
      /* not started */
    }
    src.disconnect();
  }
  const take = store.refs.take;
  store.set({ rec: take ? 'done' : 'idle', clock: take ? Math.round(take.ms / 1000) : 0 });
  if (picked.has(store)) {
    setChord(store, picked.get(store) ?? null);
    picked.delete(store);
  }
}

export function stopPlay(store: GuitarStore) {
  if (store.get().rec !== 'play') return;
  store.refs.playSeq++;
  finishPlay(store);
  store.refs.engine?.damp();
}

/**
 * How it went, for the head (game_end): how many takes, the best one's length
 * and notes, and whether any was enough to make it cry. A take still rolling
 * counts as it stands. played is every note, recorded or not.
 */
export function summary(store: GuitarStore) {
  const all = store.refs.takes.slice();
  const t = store.refs.take;
  if (t && store.get().rec === 'rec') all.push({ ms: Math.round(performance.now() - t.t0), notes: t.notes });
  const rank = (a: { ms: number; notes: number }) => (moving(a) ? 1e9 : 0) + a.notes * 1e5 + a.ms;
  const best = all.reduce<{ ms: number; notes: number } | null>((b, a) => (!b || rank(a) > rank(b) ? a : b), null);
  return {
    takes: all.length,
    secs: best ? Math.floor(best.ms / 100) / 10 : 0,
    notes: best ? best.notes : 0,
    cried: all.some(moving),
    played: store.refs.mine
  };
}

/** Unmounting: stop everything the recorder started. */
export function disposeRec(store: GuitarStore) {
  store.refs.playSeq++;
  clearTimers(store);
  const src = store.refs.source;
  store.refs.source = null;
  if (src) {
    try {
      src.stop();
    } catch {
      /* not started */
    }
  }
  endTape(store.refs.take?.tape ?? null);
  store.refs.take = null;
}
