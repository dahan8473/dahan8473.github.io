// Notes for the real David, left through the head: saved, then emailed to him.

import { corsFor, preflight, plain, json, isId, clientIp, limiter } from './_http.js';
import { leaveNote } from './_store.js';
import { decide, noul } from './_jev.js';

const TO = 'davidliu8473@gmail.com';
const limited = limiter(5, 60 * 60 * 1000);
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

async function mail({ name, contact, message, page }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const replyTo = (contact.match(EMAIL) || [])[0];
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: 'davidliu.work <onboarding@resend.dev>',
        to: [TO],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: `Note from ${name || 'a visitor'} on davidliu.work`,
        text: `${message}\n\nFrom: ${name || 'no name given'}\nReply to: ${contact || 'no contact given'}\nLeft on: https://davidliu.work${page}`
      })
    });
    if (!res.ok) console.error('resend', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('resend', err);
    return false;
  }
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
      page: typeof body.page === 'string' && /^\/[\w/.-]{0,60}$/.test(body.page) ? body.page : '/'
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
    const [id, mailed] = await Promise.all([leaveNote({ ...note, wall, flagged }), mail(note)]);
    return json({ saved: id != null, posted: id != null && wall, mailed }, headers);
  }
};
