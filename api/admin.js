// David's private admin portal, at /admin/<ADMIN_SLUG> on the Vercel domain
// (vercel.json rewrites /admin/* here). A wrong slug is a plain 404. The
// right one shows a password login, then the dashboard. The locks are in
// _auth.js, the queries in _admin_data.js, the page in _admin_page.js.

import { randomBytes } from 'node:crypto';
import { clientIp } from './_http.js';
import { slugOk, loginReady, passwordOk, gate, signSession, sessionOk, sessionCookie, clearCookie } from './_auth.js';
import * as data from './_admin_data.js';
import { loginPage, dashboardPage } from './_admin_page.js';

const SECURITY = {
  'cache-control': 'no-store, max-age=0',
  'x-robots-tag': 'noindex, nofollow, noarchive',
  'x-content-type-options': 'nosniff',
  // same-origin, not no-referrer: forms need a real Origin header, and the
  // slug still never leaves for another site.
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY',
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-resource-policy': 'same-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'strict-transport-security': 'max-age=63072000; includeSubDomains'
};
const csp = (nonce) =>
  `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`;

const notFound = () => new Response('Not found', { status: 404, headers: { ...SECURITY, 'content-type': 'text/plain; charset=utf-8' } });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...SECURITY, 'content-type': 'application/json' } });
function html(render, status = 200, extra = {}) {
  const nonce = randomBytes(16).toString('base64');
  return new Response(render(nonce), {
    status,
    headers: { ...SECURITY, 'content-type': 'text/html; charset=utf-8', 'content-security-policy': csp(nonce), ...extra }
  });
}
const redirect = (to, cookie) => new Response(null, { status: 303, headers: { ...SECURITY, location: to, ...(cookie ? { 'set-cookie': cookie } : {}) } });

// /admin/<slug>/<rest> as the browser sent it. If the platform hands over
// the rewritten URL instead, the rewrite put the same parts in the query.
export function route(request) {
  const url = new URL(request.url);
  const m = /^\/admin\/([^/]+)(?:\/(.*))?$/.exec(url.pathname);
  try {
    if (m) return { slug: decodeURIComponent(m[1]), rest: (m[2] || '').replace(/\/+$/, ''), bare: !m[2] && !url.pathname.endsWith('/'), url };
  } catch {
    return { slug: '', rest: '', url };
  }
  return { slug: url.searchParams.get('slug') || '', rest: (url.searchParams.get('path') || '').replace(/\/+$/, ''), bare: false, url };
}

// Writes only from the portal's own pages.
export function sameOrigin(request) {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin';
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!origin || origin === 'null' || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

const GET = {
  health: () => data.health(),
  overview: () => data.overview(),
  visitors: (q) => data.visitors({ q: q.get('q'), who: q.get('who'), chatted: q.get('chatted') === '1', offset: q.get('offset') }),
  visitor: (q) => data.visitor(q.get('id')),
  conversations: (q) => data.conversations({ q: q.get('q'), offset: q.get('offset') }),
  conversation: (q) => data.conversation(q.get('id')),
  behavior: (q) => data.behavior(Number(q.get('days'))),
  lines: (q) => data.lines(Number(q.get('days'))),
  learning: () => data.learning(),
  inbox: () => data.inbox()
};
const POST = {
  proposal: (b) => data.decide(b),
  knowledge: (b) => data.editKnowledge(b),
  variant: (b) => data.editVariant(b),
  learn: () => data.learnNow()
};

export default {
  async fetch(request) {
    const { slug, rest, bare } = route(request);
    if (!slugOk(slug)) return notFound();
    const base = `/admin/${encodeURIComponent(slug)}`;
    const method = request.method;

    if (rest === '' && method === 'GET') {
      if (bare) return redirect(`${base}/`);
      return sessionOk(request) ? html((n) => dashboardPage(n, { base })) : html((n) => loginPage(n, { base, ready: loginReady() }));
    }

    if (rest === 'login' && method === 'POST') {
      const page = (status, error, ready = true) => html((n) => loginPage(n, { base, ready, error }), status);
      if (!sameOrigin(request)) return page(403, 'Log in from the login page.', loginReady());
      if (!loginReady()) return page(503, '', false);
      const form = new URLSearchParams((await request.text()).slice(0, 2000));
      const g = await gate(clientIp(request));
      if (g.locked) return page(429, 'Too many tries. Wait 15 minutes.');
      if (g.unavailable) return page(503, "Can't check login attempts right now. Try again in a minute.");
      if (!passwordOk(form.get('password') || '')) return page(401, 'Wrong password.');
      await g.done();
      return redirect(`${base}/`, sessionCookie(signSession()));
    }

    if (rest === 'logout' && method === 'POST') {
      if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
      return redirect(`${base}/`, clearCookie());
    }

    const api = /^api\/([a-z]+)$/.exec(rest);
    if (!api) return notFound();
    if (!sessionOk(request)) return json({ error: 'log in' }, 401);
    const name = api[1];
    if (method === 'GET' && GET[name]) {
      const out = await GET[name](new URL(request.url).searchParams);
      return out == null ? json({ error: 'not found' }, 404) : json(out);
    }
    if (method === 'POST' && POST[name]) {
      if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
      let body = {};
      try { body = JSON.parse((await request.text()).slice(0, 20000) || '{}'); } catch { return json({ error: 'bad json' }, 400); }
      const out = await POST[name](body);
      return json(out, out && out.error ? 400 : 200);
    }
    return json({ error: 'not found' }, 404);
  }
};
