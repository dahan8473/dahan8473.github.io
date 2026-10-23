// Fast decisions: Jev, TypeSafe's System One model, through OpenRouter. It
// answers typed questions (pick one, yes or no) with probabilities in about
// 100ms, for a fraction of a cent per thousand calls. It never writes prose;
// the brain does.

import { waitUntil } from '@vercel/functions';
import { CAP, spentNow, chargeJev } from './_spend.js';

const URL_ = 'https://openrouter.ai/api/alpha/decisions';
const MODEL = 'typesafe/jev-1.13';

export const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });
export const noul = (instructions, criteria) => ({ type: 'noul', instructions, criteria });

// Resolves to the answers, or null when Jev is off, slow, or failing, or the
// monthly cap is hit (_spend.js). Callers always have a fallback, so a miss
// costs nothing but the decision. Each call counts toward the cap.
export async function decide(state, questions, { timeout = 1500 } = {}) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return null;
  if ((await spentNow()) >= CAP) return null;
  const write = chargeJev();
  if (write) waitUntil(write);
  try {
    const res = await fetch(URL_, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', 'HTTP-Referer': 'https://davidliu.work', 'X-Title': 'davidliu.work' },
      // Only hosts that don't train on what they're sent, like the brain (_gpt.js).
      body: JSON.stringify({ model: MODEL, provider: { data_collection: 'deny' }, state, questions }),
      signal: AbortSignal.timeout(timeout)
    });
    if (!res.ok) { console.error('jev', res.status, (await res.text()).slice(0, 200)); return null; }
    return (await res.json()).answers || null;
  } catch (err) {
    console.error('jev', err?.name || '', err?.message || err);
    return null;
  }
}
