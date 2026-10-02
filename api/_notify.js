// Pings David on Telegram through a small bot of his. With TELEGRAM_BOT_TOKEN
// or TELEGRAM_CHAT_ID unset, it quietly does nothing.

export async function tell(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), disable_web_page_preview: true }),
      signal: AbortSignal.timeout(4000)
    });
    if (!res.ok) console.error('telegram', res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error('telegram', err?.message || err);
    return false;
  }
}
