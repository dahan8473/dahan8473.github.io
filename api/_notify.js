// Pings David on Telegram through a small bot of his. With TELEGRAM_BOT_TOKEN
// or TELEGRAM_CHAT_ID unset, it quietly does nothing.

// Returns the Telegram message id, so a reply to it can be traced back.
export async function tell(text) {
  return call('sendMessage', { text: text.slice(0, 4000), disable_web_page_preview: true }).then((r) => r?.message_id || false);
}

// A thumbs up on one of David's messages: his reply went through.
export function react(messageId, emoji = '👍') {
  return call('setMessageReaction', { message_id: messageId, reaction: [{ type: 'emoji', emoji }] });
}

async function call(method, params) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, ...params }),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) { console.error('telegram', method, res.status, await res.text()); return null; }
    return (await res.json()).result;
  } catch (err) {
    console.error('telegram', method, err?.message || err);
    return null;
  }
}
