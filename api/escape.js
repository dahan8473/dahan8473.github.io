// The way out of the site. The 404 page sends whatever three words were in
// its URL; the answer only lives in the ESCAPE_KEY env var, never in this
// repo. Getting it right counts one escape per browser, and that browser can
// sign the wall of people who got the head out (once).

import { createHash, timingSafeEqual } from 'node:crypto';
import { corsFor, preflight, plain, json, isId, clientIp, limiter } from './_http.js';
import { call } from './_store.js';
import { hasSlur } from './_slurs.js';
import { overDaily } from './_limits.js';
import { decide, noul } from './_jev.js';

const limited = limiter(20, 60 * 60 * 1000);
const KEY = (process.env.ESCAPE_KEY || '').trim().toLowerCase();
const hash = (s) => createHash('sha256').update(s).digest();
const right = (guess) => KEY && timingSafeEqual(hash(guess), hash(KEY));
// The store never sees the visitor id itself.
const who = (visitor) => createHash('sha256').update(`esc:${visitor}`).digest('hex').slice(0, 32);

async function board() {
  const [n, signed] = await Promise.all([
    call('escapes?select=who&limit=1', { prefer: 'count=exact' }),
    call('escapes?select=name,named_at&name=not.is.null&order=named_at.desc&limit=60')
  ]);
  return {
    out: n.ok ? n.count || 0 : null,
    names: signed.ok ? signed.data.map((r) => ({ name: r.name, at: r.named_at })) : []
  };
}

export default {
  async fetch(request) {
    const { ok, headers } = corsFor(request);
    if (request.method === 'OPTIONS') return preflight(headers);
    if (!ok) return plain('forbidden', headers, 403);
    if (request.method === 'GET') return json(await board(), { ...headers, 'cache-control': 'public, s-maxage=15' });
    if (request.method !== 'POST') return plain('GET or POST', headers, 405);

    const ip = clientIp(request);
    if (limited(ip)) return json({ ok: false, slow: true }, headers, 429);
    let body;
    try { body = JSON.parse(await request.text()); } catch { return plain('bad json', headers, 400); }
    if (!body || typeof body !== 'object' || !isId(body.visitor)) return plain('bad request', headers, 400);
    if (await overDaily(ip, 'escape')) return json({ ok: false, slow: true }, headers, 429);
    const id = who(body.visitor);

    // Signing the wall: only a browser that got out, and only once. Names are
    // public, so they get the same checks as wall notes.
    if (typeof body.name === 'string') {
      const name = body.name.replace(/\s+/g, ' ').trim().slice(0, 30);
      if (!name) return plain('bad name', headers, 400);
      if (hasSlur(name)) return json({ ok: false, blocked: true }, headers, 400);
      const a = await decide({ name }, {
        unsafe: noul('Should this `name` stay off a public list of names on a personal website? Yes if it is abusive, hateful, sexual, spam, an ad, a link, or shares private details like phone numbers or addresses.', {
          true: 'keep it off', false: 'fine to show publicly'
        })
      });
      if (!a || a.unsafe.noul > 0.5) return json({ ok: false, blocked: true }, headers, 400);
      const r = await call(`escapes?who=eq.${id}&name=is.null`, { method: 'PATCH', body: { name, named_at: new Date().toISOString() }, prefer: 'return=representation' });
      return json({ ok: r.ok && r.data.length > 0 }, headers);
    }

    const guess = String(body.key || '').toLowerCase().replace(/^\/+|\/+$/g, '');
    if (!/^[a-z]{1,20}-[a-z]{1,20}-[a-z]{1,20}$/.test(guess) || !right(guess)) return json({ ok: false }, headers);
    const r = await call('escapes?on_conflict=who', { method: 'POST', body: { who: id }, prefer: 'resolution=ignore-duplicates,return=representation' });
    const signed = await call(`escapes?who=eq.${id}&select=name`);
    return json({ ok: true, first: r.ok && r.data.length > 0, signed: Boolean(signed.ok && signed.data[0]?.name), ...(await board()) }, headers);
  }
};
