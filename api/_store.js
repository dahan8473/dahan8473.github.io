// Visitor log and chat transcripts, in Supabase (schema: supabase/visitors.sql).
// Talks to the REST API directly with the secret key, server side only. With
// SUPABASE_URL or SUPABASE_SECRET_KEY unset, everything here is a no-op.

const URL_ = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SECRET_KEY;

export const hasStore = Boolean(URL_ && KEY);

// One request to the REST API. Never throws: { ok, status, data, count }.
// status 0 means the store is off or unreachable. count is filled when
// asked for (prefer: count=exact).
export async function call(path, { method = 'GET', body, prefer, timeout } = {}) {
  if (!hasStore) return { ok: false, status: 0 };
  // New-style sb_secret_ keys go in apikey only; legacy service_role JWTs also as a bearer.
  const headers = { apikey: KEY, 'content-type': 'application/json' };
  if (!KEY.startsWith('sb_')) headers.authorization = `Bearer ${KEY}`;
  if (prefer) headers.prefer = prefer;
  try {
    const res = await fetch(`${URL_}/rest/v1/${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeout ? AbortSignal.timeout(timeout) : undefined
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('store', method, path.split('?')[0], res.status, text.slice(0, 300));
      return { ok: false, status: res.status };
    }
    const range = res.headers.get('content-range');
    const count = range && /\/(\d+)$/.test(range) ? Number(range.split('/')[1]) : undefined;
    return { ok: true, status: res.status, data: text ? JSON.parse(text) : null, count };
  } catch (err) {
    console.error('store', path.split('?')[0], err?.name || '', err?.message || err);
    return { ok: false, status: 0 };
  }
}

// Returns the function's result, or undefined when the store is off or fails.
async function rpc(fn, args, opts) {
  const r = await call(`rpc/${fn}`, { method: 'POST', body: args, ...opts });
  return r.ok ? r.data : undefined;
}

// Plain table access, for the inbox.
async function rest(path, opts) {
  const r = await call(path, opts);
  return r.ok ? r.data : undefined;
}

export async function trackVisit({ visitor, path, referrer, request, ip = null, tz = null }) {
  const h = (k) => request.headers.get(k) || null;
  const city = h('x-vercel-ip-city');
  const visit = {
    p_visitor: visitor,
    p_path: path,
    p_referrer: referrer,
    p_country: h('x-vercel-ip-country'),
    p_region: h('x-vercel-ip-country-region'),
    p_city: city ? decodeURIComponent(city) : null,
    p_ua: (h('user-agent') || '').slice(0, 300)
  };
  // IP and timezone need supabase/2026-10-04-visitor-details.sql; until it's
  // run, the visit still gets logged without them.
  const done = await rpc('track_visit', { ...visit, p_ip: ip, p_tz: tz });
  if (done === undefined && hasStore) await rpc('track_visit', visit);
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

export async function leaveNote({ visitor, name, contact, message, page, wall = false, flagged = false, x = null, y = null }) {
  const note = { p_visitor: visitor, p_name: name || '', p_contact: contact || '', p_message: message, p_page: page, p_public: wall, p_flagged: flagged };
  const id = await rpc('leave_note', { ...note, p_x: x, p_y: y });
  if (id != null || !hasStore) return id;
  // A database from before supabase/2026-10-02-note-positions.sql: same note, no spot.
  return rpc('leave_note', note);
}

export async function wallNotes() {
  return (await rpc('list_wall', {})) || [];
}

// The inbox: a visitor messages the real David, it goes to his Telegram, and
// his reply to that Telegram message comes back into their thread.
export async function addMessage({ visitor, sender, name = null, body }) {
  await rest('visitors?on_conflict=id', { method: 'POST', body: { id: visitor }, prefer: 'resolution=ignore-duplicates' });
  const rows = await rest('messages', { method: 'POST', body: { visitor_id: visitor, sender, name, body }, prefer: 'return=representation' });
  return rows && rows[0];
}
export const tagMessage = (id, tg) => rest(`messages?id=eq.${Number(id)}`, { method: 'PATCH', body: { tg_id: tg } });
export async function messageByTelegram(tg) {
  const rows = await rest(`messages?tg_id=eq.${Number(tg)}&select=id,visitor_id&limit=1`);
  return rows && rows[0];
}
export const thread = (visitor) => rest(`messages?visitor_id=eq.${visitor}&select=id,sender,body,at&order=at.asc&limit=200`);

// The newest visitors, for /visitors in Telegram.
export const recentVisitors = (n = 8) => rest(`visitor_log?select=name,position,company,reason,seems_to_be,city,region,country,timezone,ip,views,last_seen,pages,chat_turns,referrer&limit=${Math.min(25, Math.max(1, n))}`);

// ---- Behavior, the learning loop, and the admin portal ------------------------
// Tables from supabase/2026-10-07-learning-admin.sql. Until it's run these
// return undefined and callers carry on without them.

export const saveEvents = (visitor, convo, events) =>
  rpc('track_events', { p_visitor: visitor, p_convo: convo, p_events: events });

// Facts and answers David approved, for the head's prompt. Short timeout: a
// slow store must never hold up a reply.
export const approvedKnowledge = () =>
  rest('knowledge?active=eq.true&select=kind,title,text&order=id.asc&limit=200', { timeout: 1500 });

export const lineStats = (days = 90) =>
  rpc('line_stats', { p_since: new Date(Date.now() - days * 864e5).toISOString() });

export const lineVariants = () =>
  rest('line_variants?active=eq.true&select=id,kind,of_line,text&order=id.asc&limit=300');

// Login attempts. try() records the attempt as a failure and returns the
// recent failure counts including it; ok() clears it once the password matched.
export const adminTry = (ip) => call('rpc/admin_try', { method: 'POST', body: { p_ip: ip } });
export const adminOk = (id) => rpc('admin_ok', { p_id: id });
