# davidliu.work

Personal site. Plain HTML/CSS, no build step, served with GitHub Pages on a custom domain.

## Preview locally

```bash
python3 -m http.server
```

Then open http://localhost:8000. The talking head works but can't reach its brain this way; use `npx vercel dev` for the chat.

## The talking head

A cutout of my head waits for you to settle in, pops onto the page and starts the conversation: who it is, your name, then icebreakers until it finds something we have in common (have a pet? my cat waddles onto the screen and lies down). It splits at the mouth when it talks, blinks, and morphs into happy, sad or angry faces. My hands point at things, pinch links and whole sections and drag them to your cursor, knock on the screen, wave, and flash a peace sign. You can drag the head around and throw it (it yells weee). It notices devtools, tab switches, theme toggles, right clicks and copying.

| Piece | Where |
|---|---|
| Head, hand, bubble, bits, reactions | `talk/talk.js`, `talk/talk.css` |
| Lines it says on its own | `LINES` at the top of `talk/talk.js` |
| Things it can point at | `talk/targets.json`, hooked with `data-t` in the pages |
| Chat endpoint (Claude Haiku 4.5, streamed) | `api/chat.js`, runs on Vercel |
| Page-view beacon | `api/visit.js` |
| Visitor log and chat transcripts | Supabase, schema in `supabase/visitors.sql` |
| Its brain | `api/_neuralink.js` |

Replies stream as plain text with stage directions inline: `[[point:rag]]`, `[[drag:resume-swe]]`, `[[face:angry]]`, `[[summon:cat]]`, and `[[note:name=Alex]]` for things the head learns about the visitor (saved to their profile, never shown). The page acts them out as the typewriter reaches them. Pointing at something on another page walks the visitor there after the reply.

### Setup

1. Import this repo as a Vercel project named `davidliu-work` (framework: Other). Pages stays the host for the site; Vercel only runs `api/`.
2. Env vars on the project:
   - `ANTHROPIC_API_KEY`
   - `DAVID_BRAIN`: `gzip -c private/persona.md | base64 | npx vercel env add DAVID_BRAIN production` (`private/` is gitignored and never ships)
   - `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for the visitor log. Use a dedicated Supabase project and run `supabase/visitors.sql` in its SQL editor once. Without these, nothing is stored.
3. Set a monthly spend cap in the Anthropic console. That's the real rate limit.
4. If the project URL isn't `davidliu-work.vercel.app`, change `API` at the top of `talk/talk.js`.

Reading chats: the `conversations` table in Supabase, newest first by `updated_at`; `visitors.profile` has what the head learned about each person.

### Swapping in real photos

```bash
swift tools/cutout.swift head photo.jpg media/head.webp                   # straight-on, mouth closed
swift tools/cutout.swift hand point.jpg media/hands/point.webp point      # also pinch, fist, open
swift tools/cutout.swift thing cat.jpg media/cat-walk.webp                # and cat-lie.webp
```

Each prints a JSON config to paste into `HEAD`, `HANDS` or `PET` in `talk/talk.js`. The head config carries the mouth line (where the head splits) and the morphed faces it writes next to it: blink, angry, sad, happy. `.webp` output needs `brew install webp`.

### Recording the voice

Open http://localhost:8000/tools/voice.html, hold space and say each letter. Export drops `voice.wav` (goes in `media/`) and prints the `VOICE` config for `talk/talk.js`. Until then it chirps with synthesized blips.
