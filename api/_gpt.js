// The brain, through OpenRouter's Chat Completions API (OpenAI compatible).
// DeepSeek V4.1 Flash with reasoning off: in testing it was the fastest (first
// word in under a second), the cheapest, and never made things up. If it
// errors or comes back empty, the reply retries once on GPT-6.1 Sol.

import OpenAI from 'openai';

// Swap models with BRAIN_MODEL (and BRAIN_REASONING: off, low, medium) on
// Vercel; no code change needed. Read per call, not at load.
const brainModel = () => process.env.BRAIN_MODEL || 'deepseek/deepseek-v4.1-flash';
const brainReasoning = () => process.env.BRAIN_REASONING || 'off';
const FALLBACK = { model: 'openai/gpt-6.1-sol', reasoning: 'low' };
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
export async function think(opts) {
  let wrote = false;
  const onText = (t) => { wrote = true; opts.onText(t); };
  try {
    const out = await ask({ ...opts, onText }, brainModel(), brainReasoning());
    if (wrote) return out;
    console.error('brain', brainModel(), 'came back empty');
  } catch (err) {
    if (wrote || opts.signal?.aborted) throw err;
    console.error('brain', brainModel(), err?.status || '', err?.message || err);
  }
  return ask({ ...opts, onText }, FALLBACK.model, FALLBACK.reasoning);
}

async function ask({ system, context, messages, onText, signal }, model, reasoning) {
  client ??= new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    defaultHeaders: { 'HTTP-Referer': 'https://davidliu.work', 'X-Title': 'davidliu.work' }
  });
  const stream = await client.chat.completions.create(
    {
      model,
      // Only hosts that don't train on what they're sent.
      provider: { data_collection: 'deny' },
      messages: [{ role: 'system', content: system }, { role: 'system', content: context }, ...messages],
      // Off for chat-speed models; low for ones that need a moment to think.
      reasoning: reasoning === 'off' ? { enabled: false } : { effort: reasoning },
      max_tokens: 1500,
      stream: true,
      stream_options: { include_usage: true }
    },
    { signal }
  );
  let usage = null;
  let refused = false;
  let served = '';
  for await (const chunk of stream) {
    if (chunk.model) served = chunk.model;
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.content) onText(delta.content);
    if (delta?.refusal) refused = true;
    if (chunk.usage) usage = chunk.usage;
    if (process.env.BRAIN_DEBUG && chunk.choices?.[0]?.finish_reason) console.error('finish', chunk.choices[0].finish_reason);
  }
  if (process.env.BRAIN_DEBUG) console.error('served', served);
  if (process.env.BRAIN_DEBUG) console.error('reasoning', usage?.completion_tokens_details?.reasoning_tokens, 'out', usage?.completion_tokens);
  return { usage, refused };
}
