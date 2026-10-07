// The admin portal's locks: the secret URL segment, the password, login
// lockouts, and signed session cookies. Everything fails closed: with
// ADMIN_SLUG unset every URL is a 404, and with ADMIN_PASSWORD or
// ADMIN_SECRET unset nobody can log in and no session is valid.

import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';
import { hasStore, adminTry, adminOk } from './_store.js';

export const COOKIE = 'dl_admin';
export const SESSION_DAYS = 7;
const IP_FAILS = 5;       // per IP, per 15 minutes
const ALL_FAILS = 20;     // across everyone, per 15 minutes
const WINDOW = 15 * 60 * 1000;

// Compares two strings in constant time, whatever their lengths: both sides
// go through an HMAC with a key made fresh for this instance.
const KEY = randomBytes(32);
export function same(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = createHmac('sha256', KEY).update(a).digest();
  const y = createHmac('sha256', KEY).update(b).digest();
  return timingSafeEqual(x, y);
}

export function slugOk(slug) {
  const want = process.env.ADMIN_SLUG;
  return Boolean(want && want.length >= 8 && same(String(slug || ''), want));
}

export const loginReady = () => Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SECRET);

export function passwordOk(given) {
  if (!loginReady() || typeof given !== 'string' || !given) return false;
  return same(given, process.env.ADMIN_PASSWORD);
}

// Sessions are signed with a key derived from ADMIN_SECRET and the password,
// so changing either one logs every session out.
function sessionKey() {
  if (!loginReady()) return null;
  return createHmac('sha256', process.env.ADMIN_SECRET).update(`dl-admin-session\0${process.env.ADMIN_PASSWORD}`).digest();
}
const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function signSession(now = Date.now()) {
  const key = sessionKey();
  if (!key) return null;
  const body = b64(JSON.stringify({ v: 1, iat: now, exp: now + SESSION_DAYS * 864e5 }));
  return `${body}.${b64(createHmac('sha256', key).update(body).digest())}`;
}

export function verifySession(token, now = Date.now()) {
  const key = sessionKey();
  if (!key || typeof token !== 'string' || token.length > 400) return false;
  const [body, sig, extra] = token.split('.');
  if (!body || !sig || extra !== undefined) return false;
  const want = b64(createHmac('sha256', key).update(body).digest());
  if (!same(sig, want)) return false;
  try {
    const s = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return s.v === 1 && Number.isFinite(s.exp) && s.exp > now && s.iat <= now + 60000;
  } catch {
    return false;
  }
}

export function cookieValue(request, name = COOKIE) {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export const sessionOk = (request) => verifySession(cookieValue(request));

export const sessionCookie = (token) =>
  `${COOKIE}=${token}; Path=/admin; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`;
export const clearCookie = () => `${COOKIE}=; Path=/admin; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;

// Failed logins. Counted in Supabase (admin_attempts) so a cold start doesn't
// reset them. Until supabase/2026-10-07-learning-admin.sql is run the table
// isn't there (404), and this instance counts on its own (also with no store
// configured, for local runs). Any other store error refuses the login.
const memory = [];
function memoryTry(ip, t = Date.now()) {
  while (memory.length && t - memory[0].at > WINDOW) memory.shift();
  const attempt = { ip, at: t, ok: false };
  memory.push(attempt);
  if (memory.length > 2000) memory.shift();
  const fails = memory.filter((a) => !a.ok);
  return { attempt, ip: fails.filter((a) => a.ip === ip).length, all: fails.length };
}

// Returns { locked } or { unavailable }, or { ok, done() } to call when the
// password matched.
export async function gate(ip) {
  const r = await adminTry(ip);
  if (r.ok && r.data && Number.isFinite(r.data.ip)) {
    const { id, ip: mine, all } = r.data;
    if (mine > IP_FAILS || all > ALL_FAILS) return { locked: true };
    return { ok: true, persisted: true, done: () => adminOk(id) };
  }
  if (hasStore && r.status !== 404) return { unavailable: true };
  const m = memoryTry(ip);
  if (m.ip > IP_FAILS || m.all > ALL_FAILS) return { locked: true };
  return { ok: true, persisted: false, done: () => { m.attempt.ok = true; } };
}

// Exposed for tests.
export const _memory = memory;
