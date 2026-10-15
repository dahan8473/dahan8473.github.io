// Page-view beacon: the site sends one of these per page load.

import { corsFor, preflight, plain, isId, clientIp, limiter } from './_http.js';
import { trackVisit } from './_store.js';

// A page view a few seconds, plenty for a real visit, per IP and instance.
const limited = limiter(120, 10 * 60 * 1000);

const BOTS = /bot|crawl|spider|slurp|headless|lighthouse|preview|facebookexternalhit|embedly/i;

export default {
  async fetch(request) {
    const { ok, headers } = corsFor(request);
    if (request.method === 'OPTIONS') return preflight(headers);
    if (request.method !== 'POST') return plain('POST only', headers, 405);
    if (!ok) return plain('forbidden', headers, 403);
    if (limited(clientIp(request))) return new Response(null, { status: 204, headers });

    let body;
    try { body = JSON.parse(await request.text()); } catch { return plain('bad json', headers, 400); }
    if (!body || typeof body !== 'object') return plain('bad json', headers, 400);
    const path = typeof body.path === 'string' && /^\/[\w/.-]{0,80}$/.test(body.path) ? body.path : null;
    if (!isId(body.visitor) || !path) return plain('bad visit', headers, 400);
    if (BOTS.test(request.headers.get('user-agent') || '')) return new Response(null, { status: 204, headers });
    // Do Not Track or Global Privacy Control: nothing logged.
    if (request.headers.get('dnt') === '1' || request.headers.get('sec-gpc') === '1') return new Response(null, { status: 204, headers });

    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 300) : '';
    const tz = typeof body.tz === 'string' && /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(body.tz) ? body.tz.slice(0, 60) : null;
    const ip = clientIp(request);
    await trackVisit({ visitor: body.visitor, path, referrer, request, ip: ip === 'unknown' ? null : ip, tz });
    return new Response(null, { status: 204, headers });
  }
};
