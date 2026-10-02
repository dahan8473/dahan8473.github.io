// Telegram webhook. David replies to a message from the site and the reply
// lands in that visitor's thread on /messages/. Only his chat, and only with
// the secret Telegram sends with every update (TELEGRAM_WEBHOOK_SECRET).

import { addMessage, messageByTelegram } from './_store.js';
import { tell, react } from './_notify.js';

const done = () => new Response('ok');

export default {
  async fetch(request) {
    if (request.method !== 'POST') return new Response('POST only', { status: 405 });
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!secret || request.headers.get('x-telegram-bot-api-secret-token') !== secret) return new Response('forbidden', { status: 403 });

    let update;
    try { update = await request.json(); } catch { return done(); }
    const msg = update.message;
    if (!msg || String(msg.chat?.id) !== String(process.env.TELEGRAM_CHAT_ID) || typeof msg.text !== 'string') return done();

    const original = msg.reply_to_message && (await messageByTelegram(msg.reply_to_message.message_id));
    if (!original) {
      if (!msg.text.startsWith('/')) await tell('To answer someone, reply to their message (swipe left on it).');
      return done();
    }
    const row = await addMessage({ visitor: original.visitor_id, sender: 'david', body: msg.text.trim().slice(0, 2000) });
    if (row) await react(msg.message_id);
    else await tell("That reply didn't save. Try again in a bit.");
    return done();
  }
};
