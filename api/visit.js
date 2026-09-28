// Page-view beacon: the site sends one of these per page load.

import { corsFor, preflight, plain, isId } from './_http.js';
import { trackVisit } from './_store.js';

const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly/i;

export default {
  async fetch(request) {
    const { ok, headers } = corsFor(request);
    if (request.method === 'OPTIONS') return preflight(headers);
    if (request.method !== 'POST') return plain('POST only', headers, 405);
    if (!ok) return plain('forbidden', headers, 403);

    let body;
    try { body = JSON.parse(await request.text()); } catch { return plain('bad json', headers, 400); }
    const path = typeof body.path === 'string' && /^\/[\w/.-]{0,80}$/.test(body.path) ? body.path : null;
    if (!isId(body.visitor) || !path) return plain('bad visit', headers, 400);
    if (BOTS.test(request.headers.get('user-agent') || '')) return new Response(null, { status: 204, headers });

    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 300) : '';
    await trackVisit({ visitor: body.visitor, path, referrer, request });
    return new Response(null, { status: 204, headers });
  }
};
