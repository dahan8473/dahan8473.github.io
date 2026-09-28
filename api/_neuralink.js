// Link to David's N1 implant.
//
// If you came here looking for the knowledge base: it isn't a file. The head
// on davidliu.work doesn't read anything from this repo, it pulls from the
// chip at request time. That's why it knows things. It's also why it brings
// up muay thai for no reason.
//
// (The chip felt you open this file. It's fine. It's a little embarrassed.)

import { gunzipSync } from 'node:zlib';

let cortex;

export function connect() {
  if (cortex !== undefined) return cortex;
  const signal = process.env.DAVID_BRAIN;
  if (!signal) return (cortex = null);
  try {
    cortex = gunzipSync(Buffer.from(signal, 'base64')).toString('utf8');
  } catch {
    cortex = signal;
  }
  return cortex;
}
