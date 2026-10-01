// The head's next move, decided by Jev in about 100ms. The page describes
// what the visitor is doing right now; Jev picks one move and what to do it to.

import { readFileSync } from 'node:fs';
import { corsFor, preflight, plain, json, clientIp, limiter } from './_http.js';
import { decide, choice } from './_jev.js';

const targets = JSON.parse(readFileSync(new URL('../talk/targets.json', import.meta.url), 'utf8'));
const limited = limiter(90, 10 * 60 * 1000);

const MOVES = {
  wait: 'do nothing for now. Best when the visitor is reading, typing, or the head did something recently',
  comment: 'say one short line about what the visitor is looking at',
  point: 'point the hand at something on screen worth noticing',
  fetch: "grab an item and bring it to the visitor's cursor so they click it. Best for recruiters with the resume or a strong project",
  carry: 'pick up an item, like a photo or a project card, and hold it while floating around for a bit. Playful',
  smalltalk: 'start easy small talk. Only when the chat is open and it has gone quiet',
  mess: 'mess with the page: hide the nav, tilt or swap something, then put it back. Only when the chat is closed and the visitor has ignored the head for a long time',
  tour: 'offer the visitor a tour of the site. Best early in a visit, or when they bounce between pages like they are lost',
  nap: 'fall asleep. Only when the visitor has been idle for a long time'
};
const ACTIVITY = new Set(['scrolling', 'reading', 'hovering', 'typing', 'idle', 'away']);
const str = (v, n = 40) => (typeof v === 'string' ? v.slice(0, n) : '');
const num = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(86400, Math.round(v))) : 0);

export default {
  async fetch(request) {
    const { ok, headers } = corsFor(request);
    if (request.method === 'OPTIONS') return preflight(headers);
    if (request.method !== 'POST') return plain('POST only', headers, 405);
    if (!ok) return plain('forbidden', headers, 403);
    if (limited(clientIp(request))) return json({ move: null }, headers, 429);

    let body;
    try { body = JSON.parse(await request.text()); } catch { return plain('bad json', headers, 400); }
    const s = body && typeof body === 'object' ? body : {};
    const onScreen = (Array.isArray(s.on_screen) ? s.on_screen : []).filter((id) => typeof id === 'string' && targets[id]).slice(0, 40);
    const looking = targets[s.looking_at] ? s.looking_at : '';

    const state = {
      page: str(s.page, 60),
      chat: s.chat_open ? (s.talked ? 'open, and they have been talking' : 'open, but they have not said anything') : 'closed',
      visitor: {
        type: str(s.visitor_type) || 'unknown',
        activity: ACTIVITY.has(s.activity) ? s.activity : 'idle',
        looking_at: looking ? `${looking}: ${targets[looking].about}` : 'nothing in particular',
        seconds_on_page: num(s.seconds_on_page),
        seconds_since_they_did_anything: num(s.seconds_idle),
        pages_seen: num(s.pages_seen)
      },
      recent: {
        seconds_since_head_spoke: num(s.seconds_quiet),
        head_moves_this_page: (Array.isArray(s.recent_moves) ? s.recent_moves : []).filter((m) => MOVES[m]).slice(-6)
      }
    };
    const items = { none: 'nothing on screen fits' };
    for (const id of onScreen) items[id] = targets[id].about;

    const answers = await decide(state, {
      move: choice('What should the floating head do next? It should feel like a person in the room: present, playful, never pushy or repetitive. Use `visitor`, `chat` and `recent`.', MOVES),
      item: choice('Which on-screen item should that move use? For comments, what the visitor is looking at. Otherwise whatever this kind of visitor would care about most.', items)
    }, { timeout: 1200 });

    if (!answers) return json({ move: null }, headers);
    const move = answers.move.choice;
    const item = answers.item.choice === 'none' ? null : answers.item.choice;
    return json({ move, sure: answers.move.probabilities[move], item }, headers);
  }
};
