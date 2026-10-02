// The inbox on /messages/: visitors message the real David. Each message goes
// to his Telegram; he replies there (api/telegram.js), the reply lands in their
// thread, and the head tells them.

import { corsFor, preflight, plain, json, isId, clientIp, limiter } from './_http.js';
import { addMessage, tagMessage, thread } from './_store.js';
import { tell } from './_notify.js';

const limited = limiter(10, 60 * 60 * 1000);

export default {
  async fetch(request) {
    const { ok, headers } = corsFor(request);
    if (request.method === 'OPTIONS') return preflight(headers);
    if (!ok) return plain('forbidden', headers, 403);

    if (request.method === 'GET') {
      const visitor = new URL(request.url).searchParams.get('visitor');
      if (!isId(visitor)) return plain('bad visitor', headers, 400);
      return json({ messages: (await thread(visitor)) || [] }, headers);
    }
    if (request.method !== 'POST') return plain('GET or POST', headers, 405);
    if (limited(clientIp(request))) return json({ sent: false }, headers, 429);

    let body;
    try { body = JSON.parse(await request.text()); } catch { return plain('bad json', headers, 400); }
    const text = typeof body.message === 'string' ? body.message.trim().slice(0, 1000) : '';
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 40) : '';
    if (!text || !isId(body.visitor)) return plain('bad message', headers, 400);

    const row = await addMessage({ visitor: body.visitor, sender: 'visitor', name: name || null, body: text });
    if (!row) return json({ sent: false }, headers, 503);
    const tg = await tell(`💬 ${name || 'Someone'} messaged you on davidliu.work\n\n${text}\n\nReply to this message and it shows up in their inbox.`);
    if (tg) await tagMessage(row.id, tg);
    return json({ sent: true, message: { id: row.id, sender: 'visitor', body: text, at: row.at } }, headers);
  }
};
