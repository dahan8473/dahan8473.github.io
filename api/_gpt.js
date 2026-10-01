// The brain: GPT-6.1 Sol through the OpenAI Responses API. Reasoning stays on
// low, which keeps replies quick and cheap for a speech bubble.

import OpenAI from 'openai';

export const MODEL = 'gpt-6.1-sol';
// Dollars per million tokens.
const PRICE = { input: 2, cached: 0.1, output: 10 };

let client;

export function costOf(usage) {
  if (!usage) return 0;
  const cached = usage.input_tokens_details?.cached_tokens || 0;
  return ((usage.input_tokens - cached) * PRICE.input + cached * PRICE.cached + usage.output_tokens * PRICE.output) / 1e6;
}

// Streams the reply through onText. The static instructions go first so the
// long prefix (rules, site map, persona) is served from the prompt cache.
export async function think({ instructions, input, onText, signal }) {
  client ??= new OpenAI();
  const stream = await client.responses.create(
    {
      model: MODEL,
      instructions,
      input,
      reasoning: { effort: 'low' },
      max_output_tokens: 1500,
      store: false,
      stream: true
    },
    { signal }
  );
  let usage = null;
  let refused = false;
  for await (const event of stream) {
    if (event.type === 'response.output_text.delta') onText(event.delta);
    else if (event.type === 'response.refusal.delta') refused = true;
    else if (event.type === 'response.completed' || event.type === 'response.incomplete') usage = event.response.usage;
    else if (event.type === 'response.failed') throw new Error(event.response?.error?.message || 'response failed');
    else if (event.type === 'error') throw new Error(event.message || 'stream error');
  }
  return { usage, refused };
}
