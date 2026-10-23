# Launch checklist

Everything on the launch-security branch that has to be done by hand, in order.

## 1. Supabase (project wuazqhszsqzvmxkvufds, SQL editor)

1. Check the 2026-10-07 migration is applied. All three should come back non-null:

   ```sql
   select to_regclass('public.events'), to_regclass('public.proposals'), to_regclass('public.admin_attempts');
   ```

   If any is null, run `supabase/2026-10-07-learning-admin.sql` first.

2. Check the retention job:

   ```sql
   select jobname, schedule from cron.job;
   ```

   You want `purge-old | 30 4 * * *`. If it's missing, turn on pg_cron (Database > Extensions) and run `supabase/2026-10-15-retention.sql`. The privacy page promises those deletes.

3. Run the new migrations, in this order. Each is safe to run twice.
   1. `supabase/2026-10-23-rate-limits.sql` (the shared daily caps)
   2. `supabase/2026-10-23-lock-old-tables.sql` (revokes anon and authenticated on visitors, page_views, conversations, notes, spend)
   3. `supabase/2026-10-23-forget-visitor.sql` (deletion requests: `select forget_visitor('<visitor id>');`)

## 2. Vercel environment variables (project davidliu-work, Production)

- `DRAFT_SECRET`: set it to 32+ random characters (`openssl rand -base64 48`). Until it's set, drafts are signed with a key derived from the OpenRouter key. Setting it also changes the prompt canary, which is fine.
- `ADMIN_PASSWORD`: the login page at /admin is now public, so it has to be long: 16+ random characters, or a passphrase of 4+ random words. `ADMIN_SECRET` stays as is.
- `ADMIN_SLUG`: no longer used. Delete it after the deploy below.

## 3. Vercel Firewall rate limits

Firewall > Custom Rules > Add, one rule each, in this order (the catch-all last). For all of them: action Rate Limit, fixed window of 60 seconds, keyed by IP, follow-up action 429 Too Many Requests.

| Rule | If | Requests per 60 s per IP |
|---|---|---|
| Admin login | Request Path equals `/admin/login`, Method equals POST | 10 |
| Admin | Request Path starts with `/admin` or with `/api/admin` | 120 |
| Chat | Request Path equals `/api/chat` | 60 |
| Notes | Request Path equals `/api/note` | 5 |
| Inbox | Request Path equals `/api/inbox` | 30 |
| Decide | Request Path equals `/api/decide` | 20 |
| Events | Request Path equals `/api/events` | 30 |
| Visits | Request Path equals `/api/visit` | 30 |
| Everything else | Request Path starts with `/api/` | 120 |

Why those numbers: the chat sends a warm-up, a draft on each typing pause, the message and a commit, so 60 a minute is a fast typist with room to spare. The inbox page polls every 6 seconds (10 a minute). track.js sends a batch every 10 seconds per tab (6 a minute). If the plan caps the number of rate-limit rules, keep Admin login, Chat, Notes and Everything else.

## 4. OpenRouter (account settings)

- Privacy: turn off the setting that allows providers that may train on or log prompts, so no request can reach one even if a call forgets the `data_collection: deny` flag.
- Put a hard credit limit on the key the site uses, a little above `MONTHLY_CAP_USD` (default $20), as the backstop if the spend counter ever fails.

## 5. Things to review

- `DAVID_BRAIN`: treat it as public. The head is told not to reveal its prompt and the canary cuts off a verbatim echo, but a determined visitor can still get it paraphrased. Take out anything you wouldn't put on the site.
- Re-run `node tools/brain/sync.mjs push` from the Mac that has the vault (private/cortex.json), so the friends-only and never-for-recruiters notes leave `DAVID_CORTEX` on Vercel. The function already drops them at runtime; this gets them off Vercel too. Redeploy after.
- Optional: GitHub Pages serves every file in the repo (`/api/chat.js`, `/supabase/*.sql`, `/tools/`, `/README.md`, `/package.json`). robots.txt now keeps crawlers out of /api/, /supabase/, /tools/ and /private/, but the files are still readable. A `_config.yml` with an `exclude:` list would stop serving them, but it changes how Pages builds the site, so try it on a branch first.

## 6. Deploy

1. Merge launch-security to main (GitHub Pages: privacy page, favicons, robots.txt, track.js, the /admin redirect page).
2. `npx vercel deploy --prod` for the functions.
3. Check: https://davidliu-work.vercel.app/admin/ shows the login, davidliu.work/admin redirects there, a wrong password says so, and the head still answers on davidliu.work.
4. Delete `ADMIN_SLUG` from Vercel.
