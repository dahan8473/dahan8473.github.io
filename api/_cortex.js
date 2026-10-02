// The second brain: a condensed copy of the notes David keeps in Obsidian,
// synced with tools/brain/sync.mjs. Loaded once per instance.

import { gunzipSync } from 'node:zlib';

let cortex;

export function cortexNotes() {
  if (cortex !== undefined) return cortex;
  const signal = process.env.DAVID_CORTEX;
  try {
    cortex = signal ? JSON.parse(gunzipSync(Buffer.from(signal, 'base64')).toString('utf8')).notes : [];
  } catch {
    cortex = [];
  }
  return cortex;
}

// For the system prompt: every note, so the brain can draw on any of them.
export function cortexText() {
  const notes = cortexNotes();
  if (!notes.length) return '';
  return '# Your second brain\n\nCondensed notes from the Obsidian vault David keeps. Each has an id, who the story is for, and what it says.\n\n' +
    notes.map((n) => `## ${n.title} (id: ${n.id})\nFor: ${n.audience || 'anyone'}\n${n.summary}`).join('\n\n');
}
