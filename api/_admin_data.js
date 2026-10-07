// What the admin portal reads and writes. Everything goes through call() in
// _store.js. Parts that need supabase/2026-10-07-learning-admin.sql answer
// { missing: true } (or fall back to the older tables) until it's run.

import { call, hasStore } from './_store.js';
import { isId } from './_http.js';
import { runLearn } from './_learn.js';

export const MIGRATION = 'supabase/2026-10-07-learning-admin.sql';
const WHO = new Set(['recruiter', 'engineer', 'student', 'friend', 'unknown']);
const ago = (days) => new Date(Date.now() - days * 864e5).toISOString();
const off = (v) => Math.max(0, Math.min(100000, Math.floor(Number(v) || 0)));
const rows = (r) => (r.ok && Array.isArray(r.data) ? r.data : []);
const post = (fn, body) => call(`rpc/${fn}`, { method: 'POST', body });

// Free text for an ilike filter: letters, numbers and a little punctuation,
// nothing PostgREST would read as syntax.
export const searchTerm = (raw) =>
  String(raw || '').replace(/[^\p{L}\p{N} @._'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
const anyOf = (cols, term) =>
  `or=${encodeURIComponent(`(${cols.map((c) => `${c}.ilike."*${term}*"`).join(',')})`)}`;

export async function health() {
  if (!hasStore) return { store: false, migration: MIGRATION, pending: 0 };
  const checks = await Promise.all([
    call('visitors?select=ip&limit=0'),
    call('events?select=id&limit=0'),
    call('knowledge?select=id&limit=0'),
    call('line_variants?select=id&limit=0'),
    call('admin_attempts?select=id&limit=0'),
    call('conversation_log?select=id&limit=0'),
    call('proposals?status=eq.pending&select=id&limit=1', { prefer: 'count=exact' })
  ]);
  const missing = checks.some((c) => !c.ok);
  return { store: true, migration: missing ? MIGRATION : null, pending: checks[6].count || 0 };
}

// ---- Overview ----------------------------------------------------------------

export async function overview() {
  const [o, recent] = await Promise.all([post('admin_overview', { p_tz: 'America/Toronto' }), activity()]);
  const cap = Number(process.env.MONTHLY_CAP_USD || 20);
  if (o.ok && o.data) return { ...o.data, cap, recent };
  return { ...(await overviewFromTables()), cap, recent, approx: true };
}

// Before the new SQL: counts from the old tables, pages from the latest 1000 views.
async function overviewFromTables() {
  const count = async (path) => (await call(`${path}${path.includes('?') ? '&' : '?'}select=*&limit=1`, { prefer: 'count=exact' })).count ?? null;
  const [today, d7, d30, total, chats30, chats, msgs, notes, spend, views, refs] = await Promise.all([
    count(`visitors?last_seen=gte.${ago(1)}`), count(`visitors?last_seen=gte.${ago(7)}`), count(`visitors?last_seen=gte.${ago(30)}`), count('visitors'),
    count(`conversations?updated_at=gte.${ago(30)}`), count('conversations'), count('messages'), count('notes'),
    post('spent_this_month', {}),
    call(`page_views?select=path,visitor_id,at&at=gte.${ago(30)}&order=at.desc&limit=1000`),
    call(`visitors?select=referrer&first_seen=gte.${ago(30)}&referrer=not.is.null&limit=1000`)
  ]);
  const pages = new Map();
  const daily = new Map();
  for (const v of rows(views)) {
    const p = pages.get(v.path) || { path: v.path, views: 0, ids: new Set() };
    p.views++; p.ids.add(v.visitor_id); pages.set(v.path, p);
    const day = v.at.slice(0, 10);
    daily.set(day, (daily.get(day) || new Set()).add(v.visitor_id));
  }
  const hosts = new Map();
  for (const r of rows(refs)) {
    let host = '';
    try { host = new URL(r.referrer).hostname.replace(/^www\./, ''); } catch { continue; }
    if (/(^|\.)(davidliu\.work|dahan8473\.github\.io|davidliu-work\.vercel\.app)$/.test(host)) continue;
    hosts.set(host, (hosts.get(host) || 0) + 1);
  }
  const days = [];
  for (let i = 29; i >= 0; i--) { const d = ago(i).slice(0, 10); days.push({ day: d, visitors: daily.has(d) ? daily.get(d).size : 0 }); }
  return {
    visitors: { today, d7, d30, total },
    chats: { d30: chats30, total: chats },
    messages: { total: msgs },
    notes: { total: notes },
    spend: spend.ok ? Number(spend.data) : null,
    pending: null,
    daily: days,
    pages: [...pages.values()].map((p) => ({ path: p.path, views: p.views, visitors: p.ids.size })).sort((a, b) => b.views - a.views).slice(0, 12),
    referrers: [...hosts].map(([host, visitors]) => ({ host, visitors })).sort((a, b) => b.visitors - a.visitors).slice(0, 10)
  };
}

// The latest page views, chats, notes and messages, newest first. Page views
// in a row from the same visitor are folded into one entry.
async function activity() {
  const [views, chats, notes, msgs] = await Promise.all([
    call('page_views?select=path,at,visitor_id,visitors(name,city,country)&order=at.desc&limit=60'),
    call('conversations?select=id,visitor_id,updated_at,turns,last_page,visitors(name)&order=updated_at.desc&limit=10'),
    call('notes?select=id,visitor_id,name,message,public,flagged,at&order=at.desc&limit=8'),
    call('messages?select=id,visitor_id,sender,name,body,at&order=at.desc&limit=8')
  ]);
  const items = [];
  for (const v of rows(views)) {
    const last = items[items.length - 1];
    if (last && last.kind === 'views' && last.visitor === v.visitor_id && Date.parse(last.from) - Date.parse(v.at) < 30 * 60e3) {
      last.paths.unshift(v.path); last.from = v.at; continue;
    }
    items.push({ kind: 'views', at: v.at, from: v.at, visitor: v.visitor_id, name: v.visitors?.name || '', where: [v.visitors?.city, v.visitors?.country].filter(Boolean).join(', '), paths: [v.path] });
  }
  for (const c of rows(chats)) items.push({ kind: 'chat', at: c.updated_at, visitor: c.visitor_id, convo: c.id, name: c.visitors?.name || '', turns: c.turns, page: c.last_page });
  for (const n of rows(notes)) items.push({ kind: 'note', at: n.at, visitor: n.visitor_id, name: n.name || '', text: n.message, wall: n.public, flagged: n.flagged });
  for (const m of rows(msgs)) items.push({ kind: 'message', at: m.at, visitor: m.visitor_id, name: m.name || '', text: m.body, sender: m.sender });
  return items.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 25);
}

// ---- Visitors ----------------------------------------------------------------

export async function visitors({ q, who, chatted, offset } = {}) {
  const term = searchTerm(q);
  const params = ['select=*', 'order=last_seen.desc', 'limit=100', `offset=${off(offset)}`];
  if (term) params.push(anyOf(['name', 'position', 'company', 'reason', 'city', 'region', 'country', 'ip', 'referrer', 'pages', 'timezone'], term));
  if (WHO.has(who)) params.push(who === 'unknown' ? 'seems_to_be=is.null' : `seems_to_be=eq.${who}`);
  if (chatted) params.push('chat_turns=gt.0');
  const r = await call(`visitor_log?${params.join('&')}`, { prefer: 'count=exact' });
  if (r.ok) return { rows: r.data, total: r.count };
  // No visitor_log before 2026-10-04's SQL: the bare table.
  const p = ['select=*', 'order=last_seen.desc', 'limit=100', `offset=${off(offset)}`];
  if (term) p.push(anyOf(['name', 'city', 'region', 'country', 'referrer'], term));
  const b = await call(`visitors?${p.join('&')}`, { prefer: 'count=exact' });
  return { rows: rows(b).map((v) => ({ ...v, seems_to_be: v.profile?.who || null })), total: b.count, approx: true };
}

export async function visitor(id) {
  if (!isId(id)) return null;
  const [v, views, events, chats, notes, msgs] = await Promise.all([
    call(`visitor_log?id=eq.${id}&select=*`),
    call(`page_views?visitor_id=eq.${id}&select=path,referrer,at&order=at.desc&limit=500`),
    call(`events?visitor_id=eq.${id}&select=type,path,data,at,convo_id&order=at.desc&limit=1000`),
    call(`conversations?visitor_id=eq.${id}&select=id,started_at,updated_at,turns,last_page,messages&order=updated_at.desc&limit=30`),
    call(`notes?visitor_id=eq.${id}&select=*&order=at.desc&limit=100`),
    call(`messages?visitor_id=eq.${id}&select=id,sender,name,body,at&order=at.asc&limit=300`)
  ]);
  let row = rows(v)[0];
  if (!v.ok) row = rows(await call(`visitors?id=eq.${id}&select=*`))[0];
  if (!row) return null;
  return { visitor: row, views: rows(views), events: events.ok ? events.data : null, chats: rows(chats), notes: rows(notes), messages: rows(msgs) };
}

// ---- Conversations -----------------------------------------------------------

const preview = (messages) => {
  for (const m of Array.isArray(messages) ? messages : []) {
    if (m?.role === 'user' && typeof m.content === 'string' && !m.content.startsWith('(')) return m.content.slice(0, 200);
  }
  return '';
};

export async function conversations({ q, offset } = {}) {
  const term = searchTerm(q);
  const params = ['select=id,visitor_id,name,position,company,seems_to_be,started_at,updated_at,turns,last_page,preview', 'order=updated_at.desc', 'limit=60', `offset=${off(offset)}`];
  if (term) params.push(`search=ilike.${encodeURIComponent(`*${term}*`)}`);
  const r = await call(`conversation_log?${params.join('&')}`, { prefer: 'count=exact' });
  if (r.ok) return { rows: r.data, total: r.count };
  // Before the new SQL: the latest 100, searched here.
  const b = rows(await call('conversations?select=id,visitor_id,started_at,updated_at,turns,last_page,messages,visitors(name,profile)&order=updated_at.desc&limit=100'));
  const low = term.toLowerCase();
  const list = b.filter((c) => !low || JSON.stringify(c.messages).toLowerCase().includes(low) || (c.visitors?.name || '').toLowerCase().includes(low))
    .map((c) => ({ id: c.id, visitor_id: c.visitor_id, name: c.visitors?.name, company: c.visitors?.profile?.company, seems_to_be: c.visitors?.profile?.who, started_at: c.started_at, updated_at: c.updated_at, turns: c.turns, last_page: c.last_page, preview: preview(c.messages) }));
  return { rows: list, total: list.length, approx: true };
}

export async function conversation(id) {
  if (!isId(id)) return null;
  return rows(await call(`conversations?id=eq.${id}&select=*,visitors(*)`))[0] || null;
}

// ---- Behavior and lines --------------------------------------------------------

export async function behavior(days) {
  const r = await post('admin_behavior', { p_days: Math.max(1, Math.min(365, Math.floor(days) || 30)) });
  return r.ok ? r.data : { missing: true };
}

export async function lines(days) {
  const since = ago(Math.max(1, Math.min(365, Math.floor(days) || 90)));
  const [stats, variants] = await Promise.all([post('line_stats', { p_since: since }), call('line_variants?select=*&order=created_at.desc&limit=300')]);
  if (!stats.ok) return { missing: true };
  return { stats: stats.data || [], variants: rows(variants) };
}

// ---- Learning ------------------------------------------------------------------

export async function learning() {
  const [pending, decided, knowledge, variants, stats] = await Promise.all([
    call('proposals?status=eq.pending&select=*&order=created_at.desc&limit=100'),
    call('proposals?status=neq.pending&select=id,kind,title,text,status,decided_at&order=decided_at.desc.nullslast&limit=40'),
    call('knowledge?select=*&order=created_at.desc&limit=300'),
    call('line_variants?select=*&order=created_at.desc&limit=300'),
    post('line_stats', { p_since: ago(90) })
  ]);
  if (!pending.ok) return { missing: true };
  // The current text of the lines a proposal would replace, to compare.
  const current = {};
  for (const s of rows(stats)) current[s.line_id] = { text: s.text, score: s.score, shown: s.shown };
  return { pending: rows(pending), decided: rows(decided), knowledge: rows(knowledge), variants: rows(variants), lines: current };
}

const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : null);

export async function decide(body) {
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'bad id' };
  const approve = body.action === 'approve';
  if (!approve && body.action !== 'reject') return { error: 'bad action' };
  const title = str(body.title, 200);
  const text = str(body.text, 1000);
  if (approve) {
    const p = rows(await call(`proposals?id=eq.${id}&select=kind,text`))[0];
    if (!p) return { error: 'not found' };
    const final = text ?? p.text;
    if ((p.kind === 'fact' || p.kind === 'faq' || p.kind === 'line') && !final) return { error: 'write the text first' };
    if (/_{3,}/.test(final)) return { error: 'fill in the ___ first' };
    if (p.kind === 'line' && final.length > 300) return { error: 'too long for a line' };
  }
  const r = await post('decide_proposal', { p_id: id, p_approve: approve, p_title: title, p_text: text });
  if (!r.ok) return { error: 'could not save' };
  return r.data ? { ok: true, proposal: r.data } : { error: 'already decided' };
}

async function edit(table, body, { maxText }) {
  const id = Number(body?.id);
  if (!Number.isSafeInteger(id) || id < 1) return { error: 'bad id' };
  if (body.remove === true) {
    const r = await call(`${table}?id=eq.${id}`, { method: 'DELETE' });
    return r.ok ? { ok: true } : { error: 'could not delete' };
  }
  const patch = {};
  if (typeof body.active === 'boolean') patch.active = body.active;
  const text = str(body.text, maxText);
  if (text) patch.text = text;
  if (table === 'knowledge') {
    const title = str(body.title, 200);
    if (title) patch.title = title;
    patch.updated_at = new Date().toISOString();
  }
  if (!Object.keys(patch).length) return { error: 'nothing to change' };
  const r = await call(`${table}?id=eq.${id}`, { method: 'PATCH', body: patch, prefer: 'return=representation' });
  return r.ok && rows(r).length ? { ok: true, row: r.data[0] } : { error: 'could not save' };
}
export const editKnowledge = (body) => edit('knowledge', body, { maxText: 1000 });
export const editVariant = (body) => edit('line_variants', body, { maxText: 300 });

// The same job the cron runs, on demand. One at a time per instance.
let running = null;
let lastRun = 0;
export async function learnNow() {
  if (running) return running;
  if (Date.now() - lastRun < 60e3) return { ok: false, reason: 'ran less than a minute ago' };
  lastRun = Date.now();
  running = runLearn().finally(() => { running = null; });
  return running;
}

// ---- Inbox ---------------------------------------------------------------------

export async function inbox() {
  const [msgs, notes] = await Promise.all([
    call('messages?select=id,visitor_id,sender,name,body,at,visitors(name)&order=at.desc&limit=120'),
    call('notes?select=id,visitor_id,name,contact,message,page,public,flagged,at&order=at.desc&limit=60')
  ]);
  return { messages: rows(msgs), notes: rows(notes) };
}
