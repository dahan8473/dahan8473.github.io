// The second brain: a condensed copy of the notes David keeps in Obsidian,
// synced with tools/brain/sync.mjs. Loaded once per instance.

import { gunzipSync } from 'node:zlib';

// Notes whose audience marks them private ("friends only", "never for
// recruiters") never reach any prompt, and tools/brain/sync.mjs push leaves
// them out of DAVID_CORTEX. Set this to true to bring them back, only for
// visitors Jev itself reads as a friend on the server (never what the browser
// says). Jev's read is still only what the visitor claims, so keep it off
// unless that's good enough.
export const FRIEND_NOTES = false;

const PRIVATE = /friends?[\s-]*only|only\s+(for|with|to)\s+(close\s+)?friends|close\s+friends|family\s+only|never\s+(for|to|with)\b|not\s+for\s+(recruiters?|strangers?|the\s+public|public|everyone|anyone)|\bprivate\b|(don'?t|do\s+not)\s+share/i;
export const isPrivate = (note) => PRIVATE.test(String(note?.audience || ''));

let all;
let open;

function load() {
  if (all !== undefined) return all;
  const signal = process.env.DAVID_CORTEX;
  try {
    all = signal ? JSON.parse(gunzipSync(Buffer.from(signal, 'base64')).toString('utf8')).notes : [];
  } catch {
    all = [];
  }
  if (!Array.isArray(all)) all = [];
  open = all.filter((n) => !isPrivate(n));
  return all;
}

// The notes the head may use. friend only counts when FRIEND_NOTES is on.
export function cortexNotes({ friend = false } = {}) {
  load();
  return FRIEND_NOTES && friend ? all : open;
}

// For the system prompt: every note it may use, so the brain can draw on any of them.
export function cortexText({ friend = false } = {}) {
  const notes = cortexNotes({ friend });
  if (!notes.length) return '';
  return '# Your second brain\n\nCondensed notes from the Obsidian vault David keeps. Each has an id, who the story is for, and what it says.\n\n' +
    notes.map((n) => `## ${n.title} (id: ${n.id})\nFor: ${n.audience || 'anyone'}\n${n.summary}`).join('\n\n');
}
