// Daily caps per IP, counted in Supabase (supabase/2026-10-23-rate-limits.sql)
// so every instance shares them. The short per-instance limits in each
// endpoint still run first. If the store is off, slow or failing, this falls
// back to a per-instance daily count, so a database blip never breaks the site.

import { createHash } from 'node:crypto';
import { hitLimit } from './_store.js';
import { limiter } from './_http.js';

export const DAILY = {
  note: 10,     // notes, wall or private
  inbox: 20,    // messages on /messages/
  events: 500,  // track.js batches: a busy tab sends one every 10s, so about 80 minutes of nonstop use
  chat: 200,    // messages to the head (an Enter on a draft counts as one)
  draft: 600    // replies started while they pause typing
};
const DAY = 24 * 60 * 60 * 1000;
const local = Object.fromEntries(Object.keys(DAILY).map((b) => [b, limiter(DAILY[b], DAY)]));

// The store only ever sees a hash of the IP.
export const ipKey = (ip) => createHash('sha256').update(`rl:${ip}`).digest('hex').slice(0, 32);

// True when this IP is over today's cap for bucket. Counts the hit either way.
export async function overDaily(ip, bucket, { timeout = 800 } = {}) {
  if (!DAILY[bucket]) return false;
  const key = ipKey(ip);
  const hits = await hitLimit(key, bucket, timeout);
  if (hits !== undefined) return hits > DAILY[bucket];
  return local[bucket](key);
}
