// Visitor log and chat transcripts, in Supabase (schema: supabase/visitors.sql).
// Talks to the REST API directly with the secret key, server side only. With
// SUPABASE_URL or SUPABASE_SECRET_KEY unset, everything here is a no-op.

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;

export const hasStore = Boolean(URL_ && KEY);

// Returns the function's result, or undefined when the store is off or fails.
async function rpc(fn, args) {
  if (!hasStore) return;
  // New-style sb_secret_ keys go in apikey only; legacy service_role JWTs also as a bearer.
  const headers = { apikey: KEY, 'content-type': 'application/json' };
  if (!KEY.startsWith('sb_')) headers.authorization = `Bearer ${KEY}`;
  try {
    const res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args) });
    if (!res.ok) { console.error('store', fn, res.status, await res.text()); return; }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.error('store', fn, err);
  }
}

export function trackVisit({ visitor, path, referrer, request }) {
  const h = (k) => request.headers.get(k) || null;
  const city = h('x-vercel-ip-city');
  return rpc('track_visit', {
    p_visitor: visitor,
    p_path: path,
    p_referrer: referrer,
    p_country: h('x-vercel-ip-country'),
    p_region: h('x-vercel-ip-country-region'),
    p_city: city ? decodeURIComponent(city) : null,
    p_ua: (h('user-agent') || '').slice(0, 300)
  });
}

// The head leaves [[note:key=value]] in its replies when it learns something.
export function notesIn(text) {
  const notes = {};
  for (const m of text.matchAll(/\[\[note:\s*([a-z_]{1,20})\s*=\s*([^\]]{1,120})\]\]/gi)) {
    notes[m[1].toLowerCase()] = m[2].trim();
  }
  return notes;
}

export function saveChat({ convo, visitor, messages, reply, page }) {
  const all = [...messages, { role: 'assistant', content: reply }];
  const last = messages[messages.length - 1];
  return rpc('save_chat', {
    p_convo: convo,
    p_visitor: visitor,
    p_all: all,
    p_new: [last, { role: 'assistant', content: reply }],
    p_notes: notesIn(reply),
    p_page: page
  });
}

// Monthly spend on the brain, in dollars. Without a store the count lives in
// this instance only, which is a floor, not a cap; the OpenAI project budget
// is the backstop.
let local = 0;
export async function spent() {
  const v = await rpc('spent_this_month', {});
  return v == null ? local : Number(v);
}
export async function addSpend(usd) {
  local += usd;
  if (usd > 0) await rpc('add_spend', { p_usd: usd });
}

export function recall(visitor) {
  return rpc('recall', { p_visitor: visitor });
}

export function leaveNote({ visitor, name, contact, message, page }) {
  return rpc('leave_note', { p_visitor: visitor, p_name: name || '', p_contact: contact || '', p_message: message, p_page: page });
}
