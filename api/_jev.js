// Fast decisions: Jev, TypeSafe's System One model. It answers typed
// questions (pick one, yes or no) with probabilities in about 100ms, for a
// fraction of a cent per thousand calls. It never writes prose; the brain does.

import { TypeSafeClient } from '@typesafe-ai/sdk';

let client;

export const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });
export const noul = (instructions, criteria) => ({ type: 'noul', instructions, criteria });

// Resolves to the answers, or null when Jev is off, slow, or failing. Callers
// always have a fallback, so a miss costs nothing but the decision.
export async function decide(state, questions, { timeout = 1500 } = {}) {
  if (!process.env.TYPESAFE_API_KEY) return null;
  client ??= new TypeSafeClient({ timeout, retry: { maxRetries: 0 }, logLevel: 'error' });
  try {
    const { answers } = await client.systemOne({ state, questions }, { timeout });
    return answers;
  } catch (err) {
    console.error('jev', err?.status || '', err?.message || err);
    return null;
  }
}
