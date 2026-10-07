// The nightly learn job (see _learn.js), run by Vercel Cron (vercel.json).
// Vercel sends "Authorization: Bearer $CRON_SECRET" with every cron call;
// without CRON_SECRET set, nothing can run it from outside. David can also
// run it from the admin portal.

import { same } from './_auth.js';
import { runLearn } from './_learn.js';

const reply = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'POST') return reply({ error: 'GET or POST' }, 405);
    const secret = process.env.CRON_SECRET;
    if (!secret || !same(request.headers.get('authorization') || '', `Bearer ${secret}`)) return reply({ error: 'forbidden' }, 403);
    return reply(await runLearn());
  }
};
