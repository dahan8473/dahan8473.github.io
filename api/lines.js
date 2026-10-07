// How the head's own lines land, for talk.js to prefer the ones that work,
// plus the new lines David approved. Aggregates only: no visitors, no text
// anyone typed. Public and cached at the edge for 10 minutes.

import { plain } from './_http.js';
import { lineStats, lineVariants } from './_store.js';

const HEADERS = {
  'access-control-allow-origin': '*',
  'cache-control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=3600'
};

export default {
  async fetch(request) {
    if (request.method !== 'GET') return plain('GET only', { 'access-control-allow-origin': '*' }, 405);
    const [rows, variants] = await Promise.all([lineStats(90), lineVariants()]);
    const stats = {};
    for (const r of (rows || []).slice(0, 1000)) stats[r.line_id] = { shown: r.shown, score: r.score };
    // A new line belongs to the slot of the line it was written to beat
    // ('bit:knock' for 'bit:knock#2'); the head reports it as '<slot>#learned-<n>'.
    const out = {
      stats,
      variants: (variants || []).map((v) => {
        const slot = String(v.of_line || v.kind).split('#')[0];
        return { id: `${slot}#learned-${v.id}`, slot, text: v.text };
      })
    };
    // Not json() from _http.js: that one is always no-store.
    // A failed read is only cached for a minute.
    const cache = rows === undefined ? { 'cache-control': 'public, s-maxage=60' } : {};
    return new Response(JSON.stringify(out), { headers: { ...HEADERS, ...cache, 'content-type': 'application/json' } });
  }
};
