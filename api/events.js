// Behavior events from /track.js: what visitors do on the page and how the
// head's lines land. Batched, sent with sendBeacon as text/plain (no
// preflight). Stored in the events table (supabase/2026-10-07-learning-admin.sql).

import { corsFor, preflight, plain, isId, clientIp, limiter } from './_http.js';
import { saveEvents } from './_store.js';

const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly/i;
const TYPES = new Set([
  // from the head (window.dlBus)
  'page', 'overlay_open', 'overlay_close', 'demo_open', 'demo_close', 'game_start', 'game_end', 'bring',
  'line', 'line_done', 'line_cut', 'line_drop', 'reply',
  // from track.js itself
  'click', 'dwell', 'hidden', 'visible'
]);
const MAX_BODY = 64 * 1024;
const MAX_EVENTS = 200;
const PATH = /^\/[\w/.-]{0,99}$/;
// A batch can sit in a hidden tab for a while; anything older is dropped.
const MAX_AGE = 6 * 60 * 60 * 1000;

// About 10s between batches per tab, so this leaves room for a few tabs.
const limited = limiter(150, 10 * 60 * 1000);

// Flat objects only: short keys, short strings, finite numbers, booleans.
// One level of nesting is flattened ({ result: { score } } → result_score).
export function cleanData(d) {
  const out = {};
  if (!d || typeof d !== 'object' || Array.isArray(d)) return out;
  let n = 0;
  const put = (k, v) => {
    if (n >= 12 || !/^[a-z][a-z0-9_]{0,23}$/i.test(k)) return;
    if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.round(v * 1000) / 1000;
    else if (typeof v === 'boolean' || v === null) out[k] = v;
    else return;
    n++;
  };
  for (const [k, v] of Object.entries(d)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) for (const [k2, v2] of Object.entries(v)) put(`${k}_${k2}`, v2);
    else put(k, v);
  }
  return out;
}

// The tab's clock can be off: shift every event by how far its clock is from
// ours when it sent the batch, then keep it inside the last six hours.
export function cleanBatch(body, now = Date.now()) {
  if (!body || typeof body !== 'object' || !isId(body.visitor) || !Array.isArray(body.events)) return null;
  if (!body.events.length || body.events.length > MAX_EVENTS) return null;
  const skew = Number.isFinite(body.sent) ? now - body.sent : 0;
  const events = [];
  for (const e of body.events) {
    if (!e || typeof e !== 'object' || !TYPES.has(e.type)) continue;
    const at = Number.isFinite(e.at) ? Math.min(now, Math.max(now - MAX_AGE, e.at + skew)) : now;
    const data = cleanData(e.data);
    const path = typeof e.path === 'string' && PATH.test(e.path) ? e.path
      : typeof data.path === 'string' && PATH.test(data.path) ? data.path : null;
    events.push({ type: e.type, at: new Date(at).toISOString(), path, data });
  }
  if (!events.length) return null;
  return { visitor: body.visitor, convo: isId(body.convo) ? body.convo : null, events };
}

export default {
  async fetch(request) {
    const { ok, headers } = corsFor(request);
    if (request.method === 'OPTIONS') return preflight(headers);
    if (request.method !== 'POST') return plain('POST only', headers, 405);
    if (!ok) return plain('forbidden', headers, 403);
    // track.js doesn't send under Do Not Track or Global Privacy Control; this
    // catches any other client that does.
    if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new Response(null, { status: 204, headers });
    if (BOTS.test(request.headers.get('user-agent') || '')) return new Response(null, { status: 204, headers });
    if (limited(clientIp(request))) return plain('slow down', headers, 429);

    if (Number(request.headers.get('content-length')) > MAX_BODY) return plain('too big', headers, 413);
    const raw = await request.text();
    if (raw.length > MAX_BODY) return plain('too big', headers, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return plain('bad json', headers, 400); }
    const batch = cleanBatch(body);
    if (!batch) return plain('bad events', headers, 400);

    await saveEvents(batch.visitor, batch.convo, batch.events);
    return new Response(null, { status: 204, headers });
  }
};
