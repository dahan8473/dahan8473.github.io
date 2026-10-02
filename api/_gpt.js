// The brain: GPT-6.1 Sol through OpenRouter's Chat Completions API (OpenAI
// compatible). Reasoning stays on low, which keeps replies quick and cheap for
// a speech bubble.

import OpenAI from 'openai';

export const MODEL = 'openai/gpt-6.1-sol';
// Dollars per million tokens, only used when OpenRouter doesn't report cost.
const PRICE = { input: 2, cached: 0.1, output: 10 };

let client;

export function costOf(usage) {
  if (!usage) return 0;
  if (typeof usage.cost === 'number') return usage.cost;
  const cached = usage.prompt_tokens_details?.cached_tokens || 0;
  return ((usage.prompt_tokens - cached) * PRICE.input + cached * PRICE.cached + usage.completion_tokens * PRICE.output) / 1e6;
}

// Streams the reply through onText. The static system prompt goes first so
// the long prefix (rules, site map, persona) is served from the prompt cache.
export async function think({ system, context, messages, onText, signal }) {
  client ??= new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: { 'HTTP-Referer': 'https://davidliu.work', 'X-Title': 'davidliu.work' }
  });
  const stream = await client.chat.completions.create(
    {
      model: MODEL,
      messages: [{ role: 'system', content: system }, { role: 'system', content: context }, ...messages],
      reasoning: { effort: 'low' },
      max_tokens: 1500,
      stream: true,
      stream_options: { include_usage: true }
    },
    { signal }
  );
  let usage = null;
  let refused = false;
  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content) onText(delta.content);
    if (delta?.refusal) refused = true;
    if (chunk.usage) usage = chunk.usage;
  }
  return { usage, refused };
}
