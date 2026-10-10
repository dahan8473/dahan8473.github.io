# davidliu.work

My personal site. A floating cutout of my head lives on it. It's an AI version of me, wired into my second brain (a condensed copy of the notes I keep in Obsidian), so it knows my stories, not just my resume. It talks to you, points at things, carries them around, and keeps the conversation going while you browse.

[![The demo](docs/poster.webp)](https://davidliu.work/docs/demo.mp4)

**[Watch the 75-second demo](https://davidliu.work/docs/demo.mp4)**

## What the head does

- **Knows me.** It's wired into my second brain. When it pulls from a note, the bubble says what it's recalling, and that note lights up on the map at `/brain/`.
- **Starts the conversation.** It waits for you to settle in, pops onto the page, introduces itself and asks your name.
- **Acts before it talks.** Every message goes through Jev first. In about 100ms it knows what you want, so the hand is already moving when the reply starts typing. Say you're a recruiter and it walks you to my resume and puts the PDF next to your cursor.
- **Picks things up.** The hand points at things, brings them to your cursor, and carries photos and project cards around before putting them back.
- **Eats things.** Drag anything on the page onto its face. It eats it, then tells you about it.
- **Notices you.** Open something or stop to read it and it says something about it, once. It also reacts to inspect element, right clicks, dark mode, leaving the tab, and getting thrown across the screen.
- **Gives tours.** "just lookin around" gets you a walk through every page.
- **Takes notes.** `/notes/` is a wall of sticky notes. Take one off the pad in the corner, write on it, and stick it wherever you want. It stays where you put it (Jev checks it first). Tell the head you want to leave me a private note and it passes it on instead. Either way I get a ping on Telegram.
- **Pitches the games.** On a game page the head asks its question first, then dims the page, comes right up to the screen and asks: spar me? climb with me? rally me with the racket you just picked? Say yes and it flies straight into the ring or onto the wall. Every game also has a Play button on the side, and typing "can i rally you again" anywhere starts it instead of talking about it.
- **Keeps you exploring.** Twelve things to do (spar it, rally it, climb the page, play the guitar, call the cat, leave a note, message me...) live behind the star in the header. Doing one checks it off and a toast says what's next, most pages end with a few you haven't tried, and if your mouse heads for the tab bar, the head names one you missed.
- **Can't be talked out of being me.** Prompt injection and trolls get caught by Jev before they reach the brain.
- **Answers fast.** First word in under a second.

It's supposed to feel like I'm there, not like a chatbot in the corner. So it doesn't push: one check-in if it gets quiet, and it only drags things to your cursor when you ask, or when you're clearly a recruiter and it's the resume.

## Screenshots

| | |
|---|---|
| ![The home page, with the head saying hi](docs/screens/home.webp) | ![The resume with a note open in the margin](docs/screens/resume.webp) |
| The head says hi on your first visit. | The resume. Hover any entry and a note opens in the margin. |
| ![The hand bringing the resume to the cursor](docs/screens/fetch.webp) | ![The head carrying a project card](docs/screens/carry.webp) |
| The hand brings the resume to your cursor. | Carrying a project card around. |
| ![The projects page](docs/screens/projects.webp) | ![The guitar page with four recordings](docs/screens/guitar.webp) |
| Projects, with the stack and the code. | Recordings keep playing while you browse. |
| ![The second brain map](docs/screens/brain.webp) | ![The note wall](docs/screens/notes.webp) |
| The second brain, as a map. Drag it around, click to see what connects. | The note wall, with sample notes, each where someone stuck it. Click one to read it up close. |
| ![The resume in dark mode](docs/screens/resume-dark.webp) | |
| Dark mode. | |

<img src="docs/screens/phone.webp" width="300" alt="The site on a phone">

## How it works

The site is served by GitHub Pages. Pages swap in place instead of reloading, so the head stays mid-conversation and the music keeps playing.

The head talks to a few small functions on Vercel. The models all go through OpenRouter:

| Model | Job |
|---|---|
| **Jev** (`typesafe/jev-1.13`) | Fast typed decisions. Reads every message (troll or not, what you want, which thing on the site it's about, who you are, which notes to recall), picks the head's next move while you browse, and screens public notes. About 100ms, fractions of a cent. |
| **DeepSeek V4.1 Flash** (`deepseek/deepseek-v4.1-flash`) | Writes the replies, in my voice, with reasoning off. First word in under a second, about $0.0002 a reply. |
| **GPT-6.1 Sol** (`openai/gpt-6.1-sol`) | Backup. Takes the reply if DeepSeek errors or comes back empty. |

I picked the brain by racing 11 models through the real chat function (my rules, persona and notes, Jev in front) on recruiter intros, my stories, a friends-only story asked by a recruiter, GPA, "are you an AI?", and off-topic requests. Several cheap models made up travel details. DeepSeek V4.1 Flash never did, followed every rule, and was the fastest and cheapest. Requests only go to hosts that don't train on what they're sent. `BRAIN_MODEL` and `BRAIN_REASONING` swap it without a code change.

```mermaid
sequenceDiagram
  participant V as Visitor
  participant H as Head (talk.js)
  participant C as api/chat
  participant J as Jev
  participant G as DeepSeek V4.1 Flash
  V->>H: "can i see your resume?"
  H->>C: the message, and what's on the page
  C->>J: bouncer, intent, target, who
  J-->>C: resume, recruiter (~100ms)
  C-->>H: [[drag:resume-swe]], so the hand moves now
  C->>G: rules, site map, what it knows about me
  G-->>H: the reply, streamed, with stage directions
```

Replies stream as plain text with stage directions inline. The page acts them out when the typewriter gets to them:

| Marker | What happens |
|---|---|
| `[[point:ID]]` | The hand flies over and taps it, walking to another page first if it has to. |
| `[[drag:ID]]` | The hand brings it to your cursor. |
| `[[carry:ID]]` | The head picks it up and floats around with it. |
| `[[face:happy]]` | My photo morphs into that face. Also `sad` and `angry`. |
| `[[summon:cat]]` | My cat walks in from the edge of the screen and lies down. |
| `[[note:key=value]]` | Remembers something you told it. Never shown. |
| `[[mode:note]]` | Takes a private note for me. `[[mode:tour]]` starts the tour. |
| `[[play:ID]]` | Starts a game (`rally`, `spar`, `climb`, `chess`, `guitar`) or calls the cat, walking to its page first. |
| `[[bring:guitar]]` | Brings the guitar out over the page. |
| `[[show:bus]]` | Holds up a picture next to the bubble. |
| `[[recall:IDS]]` | Shows what it's remembering and lights those notes up on `/brain/`. |
| `[[ask:camera]]` | "rate me": asks for the camera for a few seconds. Nothing is recorded or sent. |

IDs come from `talk/targets.json`, hooked into the pages with `data-t`.

What the head knows about me isn't in this repo. It gets loaded when the function starts.

### How the head decides what to do

Everything the head says goes through one queue, `utter()` in `talk/talk.js`. Each line has a priority and belongs to whatever is on screen when it was queued:

| Priority | What | Example |
|---|---|---|
| reply | Answers to what you typed or clicked in the chat | the brain's replies |
| react | Something you just opened or clicked | "that's meowmeow..." |
| page | Things a page says when you land on it | the climbing question, game pitches, the hobby nudge |
| ambient | Small talk and idle bits | "how'd you find the site?" |

A higher line cuts a lower one off mid-word. A lower one waits its turn and drops out if it waits too long. Leaving the page (or opening a project, a demo or a game over it) stops the current line and drops everything queued about the old screen. Lines the head starts on its own also wait for a gap: one every 8 seconds at most, never while you're typing or a reply is streaming.

**Landing on a page.** `site.js` swaps the page and says so on `window.dlBus`. The head bumps a page counter that every pending exchange checks, so nothing from the last page leaks onto this one, then `pageLines()` picks what this page does:

```mermaid
flowchart TD
  L[Page swap] --> T["New page token, close any pitch, log the visit"]
  T --> N{"Asked to play this game from another page?"}
  N -- yes --> G[Start the game as soon as it's ready]
  N -- no --> P{Which page?}
  P -- "/hobbies/" --> H[Nudge them to pick a hobby, again 8s later]
  P -- Meowmeow --> C["aww u wanna see meowmeow? psst psst"] --> CW[Cat walks in] --> CP[Asks about their pets, once]
  P -- Guitar --> GQ["do you play?"] --> GB[Yes brings the guitar out]
  P -- "Hiking, climbing, badminton, muay thai, travel, lumosity, chess, photography" --> Q[That page's question, with answer buttons]
  Q --> GP{Game page?}
  GP -- yes --> PI[Pitch: dim the page, yes or later]
  P -- "/notes/" --> W[A line about the wall]
```

Each page does its full exchange once a visit. If the head is busy (a game or the guitar is open, or it's waiting on your answer) it waits instead of giving up, and if a line gets cut it tries again. The pitch also waits while you're mid-conversation, so it never shuts a chat you're in. After the first time, the page's own buttons start things: the gloves, Rally me, and a Play button on every game page.

**Starting a game.** There are three ways in, and they all end in the same place:

```mermaid
flowchart TD
  A[Pitch: yes] --> S
  B[Play button on the side] --> S
  C["Typed: can i rally you again"] --> K{Matches in the browser?}
  K -- yes --> S
  K -- no --> J["Jev on the server: intent play, which game"] --> M["[[play:rally]]"] --> S
  S[playNow] --> O{On that game's page?}
  O -- no --> GO[Remember it, walk there] --> R
  O -- yes --> R[Wait until the game has loaded] --> X[Close the chat, start it]
  X --> F[Spar and climb: the head flies in as the opponent]
```

**A message you type.** The browser handles what it can without the server, then the server handles what it can without the brain:

```mermaid
flowchart TD
  U[You hit enter] --> L1{25 messages this visit?}
  L1 -- yes --> E[Points you at email]
  L1 -- no --> L2{Asking to play something?}
  L2 -- yes --> PL[Set line, game starts]
  L2 -- no --> API["POST /api/chat: page, what's on it, last 16 messages, local time, name"]
  API --> CK["Rate limit, slur filter, monthly spend cap"]
  CK --> J["Jev, about 100ms: troll? intent, game, target, who, which notes"]
  J --> SET{Set line?}
  SET -- "troll, slur, note for David, tour, play, guitar answer" --> OUT[Reply without the brain]
  SET -- no --> HAND["Hand moves first: drag the resume, point at the project"]
  HAND --> PACE["Pace hint: short for short, ask why before giving a take"]
  PACE --> BR[DeepSeek streams the reply]
  BR --> TW[Typewriter acts out markers as it reaches them]
```

The pace hint is worked out per message from how many words you wrote, whether you're answering a question the head just asked, and whether you asked for its side ("wbu?"). It keeps the head from answering "lol idk" with a paragraph, and from giving its take before asking why you think what you think.

**When nobody's talking.** Every second the head checks what's in the middle of your screen. Stop on something it hasn't mentioned for about 5 seconds and it says one line about it. If the chat goes quiet it asks a light question about you (six a visit at most, never a second one before you've answered), and once a visit, after some small talk, a deeper one. Between those, Jev picks its next move from what you're doing: wait, comment, point, carry a photo, nap, or for a recruiter, bring the resume over. Nothing happens while a game or overlay is open or the chat is mid-conversation.

### The second brain

I keep my notes in Obsidian. `tools/brain/sync.mjs` reads the notes I've picked (a list that lives outside the repo), condenses each one, and writes two things:

- the private copy the head reads from, uploaded to Vercel as `DAVID_CORTEX`
- `brain/graph.json`: each note's title, one line, and how the notes connect

Condensing keeps my words and drops anything that shouldn't leave the vault: other people's names, contact details, internal stuff. Some stories are marked friends-only, and the head keeps those away from recruiters.

```bash
OPENROUTER_API_KEY=... node tools/brain/sync.mjs   # condense
node tools/brain/sync.mjs push                       # upload, then redeploy
```

`/brain/` draws everything as one graph, Obsidian style. `brain/map.json` is the tree (me, then topics like projects, leadership and hobbies, then what's under each, down to single facts) plus the cross links, like which skills went into which project. The synced notes hang off it by id, so a note the head recalls lights up in place. Big nodes are topics, small ones are stories and facts. Drag nodes or the canvas, scroll or pinch to zoom, click a node to see what it touches, double click to ask the head about it.

Every note is in the head's instructions (cached, so it's cheap). For each message, Jev picks the notes that fit, the page shows "recalling", and the brain leans on them.

### Spend

Replies cost money, so there's a monthly cap in the chat function (default $20, after which the head falls back to its own lines), per-IP limits, 25 messages per visit, and a credit limit on the OpenRouter key as the backstop. The head's own lines (comments, the tour, notes, the bouncer) never touch the brain.

### What visitors do, and what the head learns from it

`track.js` records what people do on the site: pages, clicks on anything the head knows (`data-t`), how far they scroll, how long they stay, and everything the head reports on `window.dlBus` (its own lines, replies, project overlays, demos, games). It batches them to `api/events.js` every 10 seconds and when the tab closes. With Do Not Track or Global Privacy Control on, it doesn't collect or send anything, and the server drops anything sent with those headers anyway. Bots are ignored.

The head scores its own lines from that: how often a line gets a reply within 20 seconds, smoothed toward the average line, minus a bit for every visitor who leaves right after it. `api/lines.js` serves the scores (counts only, nothing about anyone) so the head can lean toward the lines that land.

Every night a Vercel Cron runs `api/learn.js`. It reads the day's chats and behavior and proposes things: questions the head couldn't answer, facts it's missing, new versions of lines that land badly, and how people use the site (where they drop off, what recruiters look at). The head never changes itself. Proposals wait in my admin portal until I approve them, usually after filling in the answer myself. Approved facts and answers go into the head's prompt; approved lines join its options and get scored like the rest. I get a one-line Telegram ping when there's something to review.

The admin portal is a private page on the Vercel domain at `/admin/<ADMIN_SLUG>`: visitors, every chat, behavior (the funnel from home to a demo, games, time and scroll per page), line scores, and the proposals. A wrong slug is a 404. Behind it is a password (`ADMIN_PASSWORD`), a lockout after 5 wrong tries per IP or 20 overall in 15 minutes (counted in Supabase, so cold starts don't reset it), and a signed, HttpOnly, SameSite=Strict session cookie that lasts 7 days. Changing the password logs every session out. The page runs under a strict CSP, isn't cached or indexed, and puts everything visitors typed on the page as text, never as HTML.

## Repo

| Path | What's in it |
|---|---|
| `index.html`, `resume/`, `projects/`, `hobbies/`, `brain/`, `notes/` | The pages |
| `tethos/`, `dashboard/`, `rag/`, `kunlun/` | Case studies |
| `styles.css` | The whole site's styles. One typeface, hierarchy by opacity. |
| `site.js` | Page swaps, the guitar player, resume notes, hover photos, the note wall, the brain map, the things to do (`FINDS`) |
| `talk/talk.js`, `talk/talk.css` | The head, the hand, the cat, and everything they do |
| `LINES` in `talk/talk.js` | Every line the head says on its own |
| `talk/targets.json` | Everything the head can point at |
| `brain/` | The second brain page. `map.json` is the graph, `graph.json` the synced notes |
| `tools/build.py` | Writes the pages (home, resume, projects, every hobby, brain, notes). Edit it, then `python3 tools/build.py` |
| `tools/brain/sync.mjs` | Condenses my Obsidian notes into the second brain |
| `api/chat.js` | The conversation: Jev first, then the brain, streamed |
| `api/decide.js` | Jev picks the head's next move |
| `api/note.js`, `api/wall.js` | Notes for me (sent to my Telegram), and the public wall |
| `api/visit.js` | Page-view beacon |
| `track.js`, `api/events.js` | What visitors do on the site, batched into the `events` table |
| `api/lines.js` | How each of the head's lines lands, plus the new lines I approved |
| `api/learn.js`, `api/_learn.js` | The nightly learn job |
| `api/admin.js`, `api/_auth.js`, `api/_admin_data.js`, `api/_admin_page.js` | The admin portal |
| `supabase/visitors.sql` | Visitors, chats, notes, the spend counter, events, proposals and what the head learned. Changes since the first run are also in dated files (`supabase/2026-10-07-learning-admin.sql` is the latest) |
| `tools/cutout.swift` | Cuts my head, hands and cat out of photos with Apple's Vision framework |
| `tools/voice.html` | Records letters for the head's voice |

## Run it locally

```bash
python3 -m http.server 8000
```

Open http://localhost:8000. Everything works except the brain, so the head sticks to its own lines. For the brain, run `npx vercel dev` with the environment variables below.

## Deploy

The site deploys through GitHub Pages on push. The functions in `api/` run as the Vercel project `davidliu-work`:

```bash
npx vercel deploy --prod
```

| Environment variable | What it's for |
|---|---|
| `OPENROUTER_API_KEY` | Every model |
| `BRAIN_MODEL`, `BRAIN_REASONING` | Optional. Default `deepseek/deepseek-v4.1-flash` with reasoning `off` |
| `DAVID_BRAIN` | What the head knows about me |
| `DAVID_CORTEX` | The second brain, from `tools/brain/sync.mjs push` |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Visitor memory, chat logs, notes and the spend counter. Use a dedicated Supabase project and run `supabase/visitors.sql` in it once. |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Messages me on Telegram when someone leaves a note |
| `MONTHLY_CAP_USD` | Optional, defaults to 20 |
| `ADMIN_SLUG` | The secret segment in the admin portal's URL. At least 8 characters; make it long and random |
| `ADMIN_SECRET` | Signs admin sessions. Long and random |
| `ADMIN_PASSWORD` | The admin password. Until it's set, nobody can log in |
| `CRON_SECRET` | Vercel sends it with the nightly cron call; without it the learn job can't run |
| `LEARN_MODEL`, `LEARN_REASONING` | Optional. Default `deepseek/deepseek-v4.1-flash` with reasoning `low` |

If the project URL changes, update `API` at the top of `talk/talk.js` and `site.js`.

## New photos

```bash
swift tools/cutout.swift head photo.jpg media/head.webp
swift tools/cutout.swift hand point.jpg media/hands/point.webp point
```

Each prints a config to paste into `HEAD`, `HANDS` or `PET` at the top of `talk/talk.js`. Needs `brew install webp`.
