// CORS and small response helpers shared by the functions in api/.

const ORIGINS = new Set(['https://davidliu.work', 'https://www.davidliu.work', 'https://dahan8473.github.io']);
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function corsFor(request) {
  const origin = request.headers.get('origin') || '';
  const ok = ORIGINS.has(origin) || LOCAL.test(origin) || origin === new URL(request.url).origin;
  return { ok, headers: ok ? { 'access-control-allow-origin': origin, vary: 'origin' } : {} };
}

export function preflight(headers) {
  return new Response(null, {
    status: 204,
    headers: { ...headers, 'access-control-allow-methods': 'POST', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' }
  });
}

export const plain = (text, headers, status = 200) =>
  new Response(text, { status, headers: { ...headers, 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } });

export const isId = (v) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

export function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}
