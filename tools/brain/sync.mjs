// Condenses the notes listed in private/brain.json from my Obsidian vault into
// the head's second brain.
//
//   OPENROUTER_API_KEY=... node tools/brain/sync.mjs   condense into private/cortex.json and brain/graph.json
//   node tools/brain/sync.mjs push                       upload private/cortex.json to Vercel
//
// Writes private/cortex.json (what the head knows, never committed) and
// brain/graph.json (titles, one line each, and links: the public map on /brain/).
// push uploads the cortex to Vercel as DAVID_CORTEX. Redeploy after.

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import OpenAI from 'openai';

const ROOT = new URL('../../', import.meta.url).pathname;
const config = JSON.parse(readFileSync(join(ROOT, 'private/brain.json'), 'utf8'));
const vault = config.vault.replace(/^~/, homedir());
const slug = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-');

function read(path) {
  const raw = readFileSync(join(vault, path), 'utf8');
  const fm = {};
  let body = raw;
  const m = raw.match(/^---\n([\s\S]*?)\n---\n/);
  if (m) {
    body = raw.slice(m[0].length);
    for (const line of m[1].split('\n')) {
      const kv = line.match(/^(\w+):\s*(.*)$/);
      if (kv) fm[kv[1]] = kv[2];
    }
  }
  const title = (body.match(/^# (.+)$/m) || [])[1] || path.split('/').pop().replace(/\.md$/, '');
  const links = [...body.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((x) => x[1].trim());
  body = body
    .replace(/!\[\[[^\]]*\]\]/g, '')
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1');
  return { title, fm, body, links };
}

const RULES = `You condense one note from David Liu's private Obsidian vault for the AI version of him that talks to visitors on his website, davidliu.work. Visitors are recruiters, engineers and friends.

Write JSON with three keys:
- "summary": the facts and the story, in third person, at most WORDS words. Keep one or two of David's own short quotes when they carry his voice. Keep numbers that are already public (awards, team sizes, attendees, results).
- "blurb": one plain line of at most 12 words for a public map of his notes. Nothing private. No em dashes.
- "audience": one short line on who the story is for, taken from the note's use_for if it has one (for example "fun fact for anyone" or "friends only, never for recruiters"). Empty string if nothing applies.

Leave out: names of private people (classmates, coworkers, contacts, family; keep public organizations), contact details, addresses, grades, personal finances, internal operations (credentials, infrastructure internals, budgets), anything about BumBot or OpenClaw, and open questions or to-dos. Never invent anything. No em dashes anywhere.`;

let client;

async function condense(note, words, avoid) {
  client ??= new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY });
  const res = await client.chat.completions.create({
    model: 'openai/gpt-6.1-sol',
    reasoning: { effort: 'low' },
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: RULES.replace('WORDS', String(words)) + (avoid ? `\n\nFor this note, also leave out ${avoid}` : '') },
      { role: 'user', content: `Title: ${note.title}\nHook: ${note.fm.hook || ''}\nuse_for: ${note.fm.use_for || ''}\n\n${note.body}` }
    ]
  });
  const out = JSON.parse(res.choices[0].message.content);
  const clean = (s) => String(s || '').replace(/\s*—\s*/g, ', ').trim();
  return { summary: clean(out.summary), blurb: clean(out.blurb), audience: clean(out.audience) };
}

async function condenseAll() {
  const notes = config.notes.map((n) => ({ ...n, ...read(n.path) }));
  const byTitle = new Map(notes.map((n) => [n.title.toLowerCase(), slug(n.title)]));
  const cortex = [];
  for (const n of notes) {
    const c = await condense(n, n.words || 140, n.avoid);
    cortex.push({ id: slug(n.title), title: n.title, cluster: n.cluster, hook: n.fm.hook || '', ...c });
    console.log('condensed', n.title);
  }

  // Links: wikilinks between chosen notes, both ways, once.
  const links = new Set();
  for (const n of notes) {
    for (const l of n.links) {
      const to = byTitle.get(l.toLowerCase());
      const from = slug(n.title);
      if (to && to !== from) links.add([from, to].sort().join('|'));
    }
  }
  for (const [a, b] of config.extraLinks || []) {
    const x = byTitle.get(a.toLowerCase()), y = byTitle.get(b.toLowerCase());
    if (x && y) links.add([x, y].sort().join('|'));
  }
  const updated = new Date().toISOString().slice(0, 10);
  writeFileSync(join(ROOT, 'private/cortex.json'), JSON.stringify({ updated, notes: cortex }, null, 2) + '\n');
  writeFileSync(join(ROOT, 'brain/graph.json'), JSON.stringify({
    updated,
    nodes: cortex.map(({ id, title, cluster, blurb }) => ({ id, title, cluster, blurb })),
    links: [...links].map((l) => l.split('|'))
  }, null, 2) + '\n');
  console.log(`${cortex.length} notes, ${links.size} links`);
}

function push() {
  const { updated, notes: cortex } = JSON.parse(readFileSync(join(ROOT, 'private/cortex.json'), 'utf8'));
  const signal = gzipSync(JSON.stringify({ updated, notes: cortex })).toString('base64');
  for (const env of ['production', 'preview']) {
    execFileSync('npx', ['--yes', 'vercel', 'env', 'add', 'DAVID_CORTEX', env, '--sensitive', '--force'], { input: signal, cwd: ROOT, stdio: ['pipe', 'ignore', 'inherit'] });
  }
  console.log('pushed DAVID_CORTEX. Redeploy: npx vercel deploy --prod');
}

if (process.argv[2] === 'push') push();
else await condenseAll();
