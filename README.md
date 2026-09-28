# davidliu.work

Personal site. Plain HTML/CSS, no build step, served with GitHub Pages on a custom domain.

## Preview locally

```bash
python3 -m http.server
```

Then open http://localhost:8000. The talking head works but can't reach its brain this way; use `npx vercel dev` for the chat.

## The talking head

A cutout of my head floats around every page, splits at the mouth when it talks, and pesters visitors into chatting with it. A floating hand points at things, grabs links and whole sections and drags them to your cursor, and knocks on the screen. It notices devtools, tab switches, theme toggles, right clicks and copying.

| Piece | Where |
|---|---|
| Head, hand, bubble, bits, reactions | `talk/talk.js`, `talk/talk.css` |
| Lines it says on its own | `LINES` at the top of `talk/talk.js` |
| Things it can point at | `talk/targets.json`, hooked with `data-t` in the pages |
| Chat endpoint (Claude Haiku 4.5, streamed) | `api/chat.js`, runs on Vercel |
| Its brain | `api/_neuralink.js` |

Replies stream as plain text with stage directions inline, like `[[point:rag]]` or `[[drag:resume-swe]]`. The page acts them out as the typewriter reaches them. Pointing at something on another page walks the visitor there after the reply.

### Setup

1. Import this repo as a Vercel project named `davidliu-work` (framework: Other). Pages stays the host for the site; Vercel only runs `api/`.
2. Env vars on the project:
   - `ANTHROPIC_API_KEY`
   - `DAVID_BRAIN`: `gzip -c private/persona.md | base64 | npx vercel env add DAVID_BRAIN production` (`private/` is gitignored and never ships)
3. Set a monthly spend cap in the Anthropic console. That's the real rate limit.
4. If the project URL isn't `davidliu-work.vercel.app`, change `API` at the top of `talk/talk.js`.

### Swapping in real photos

```bash
swift tools/cutout.swift head photo.jpg media/head.png   # straight-on, mouth closed
swift tools/cutout.swift hand photo.jpg media/hand.png   # index finger pointing
```

Each prints a JSON config to paste over `HEAD` / `HAND` in `talk/talk.js`. The head config carries the mouth line, which is where the head splits.

### Recording the voice

Open http://localhost:8000/tools/voice.html, hold space and say each letter. Export drops `voice.wav` (goes in `media/`) and prints the `VOICE` config for `talk/talk.js`. Until then it chirps with synthesized blips.
