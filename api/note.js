// Notes for the real David, left through the head or on the wall: saved, then
// sent to him on Telegram.

import { corsFor, preflight, plain, json, isId, clientIp, limiter } from './_http.js';
import { leaveNote, addMessage, tagMessage } from './_store.js';
import { decide, noul } from './_jev.js';
import { tell } from './_notify.js';

const limited = limiter(5, 60 * 60 * 1000);

function telegramText({ name, contact, message, page }, where) {
  const lines = [where, '', message, '', `from: ${name || 'no name'}`];
  if (contact) lines.push(`reply to: ${contact}`);
  lines.push(`on: davidliu.work${page}`);
  return lines.join('\n');
}

export default {
  async fetch(request) {
    const { ok, headers } = corsFor(request);
    if (request.method === 'OPTIONS') return preflight(headers);
    if (request.method !== 'POST') return plain('POST only', headers, 405);
    if (!ok) return plain('forbidden', headers, 403);
    if (limited(clientIp(request))) return json({ saved: false, mailed: false }, headers, 429);

    let body;
    try { body = JSON.parse(await request.text()); } catch { return plain('bad json', headers, 400); }
    const message = typeof body.message === 'string' ? body.message.trim().slice(0, 2000) : '';
    if (!message || !isId(body.visitor)) return plain('bad note', headers, 400);
    const note = {
      visitor: body.visitor,
      name: typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '',
      contact: typeof body.contact === 'string' ? body.contact.trim().slice(0, 200) : '',
      message,
      page: typeof body.page === 'string' && /^\/[\w/.-]{0,60}$/.test(body.page) ? body.page : '/',
      // Where on the wall the writer stuck it, 0 to 1 each way.
      x: Number.isFinite(body.x) ? Math.min(1, Math.max(0, body.x)) : null,
      y: Number.isFinite(body.y) ? Math.min(1, Math.max(0, body.y)) : null
    };
    // Wall notes are public, so Jev reads them first. Anything it flags (or
    // anything it can't check) stays private and only David sees it.
    let wall = body.public === true;
    let flagged = false;
    if (wall) {
      const a = await decide({ note: message, name: note.name }, {
        unsafe: noul('Should this `note` stay off a public guestbook on a personal website? Yes if it is abusive, hateful, sexual, spam, an ad, or shares private details like phone numbers or addresses.', {
          true: 'keep it private', false: 'fine to show publicly'
        })
      });
      flagged = !a || a.unsafe.noul > 0.5;
      wall = !flagged;
    }
    const where = wall ? 'New note on your wall' : flagged ? "A note that didn't pass the check for the wall (kept private)" : 'Private note for you';
    // Notes that only David sees can get an answer: they join the visitor's
    // inbox thread, and his reply to the Telegram message comes back there.
    const text = telegramText(note, where) + (wall ? '' : '\n\nReply to this message and it shows up on the site for them.');
    const [id, tg] = await Promise.all([leaveNote({ ...note, wall, flagged }), tell(text)]);
    if (!wall && tg) {
      const row = await addMessage({ visitor: note.visitor, sender: 'visitor', name: note.name || null, body: note.message });
      if (row) await tagMessage(row.id, tg);
    }
    return json({ saved: id != null, posted: id != null && wall, mailed: Boolean(tg) }, headers);
  }
};
