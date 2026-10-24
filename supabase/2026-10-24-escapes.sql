-- 2026-10-24: the people who got the head out (api/escape.js).
-- Paste into the Supabase SQL editor and run. Safe to run more than once.
-- One row per browser that found the way out. `who` is a one-way hash of the
-- browser's random visitor id, so a row can't be tied back to the visitor log.
-- `name` is only there if they signed the wall; it's public on the 404 page.
-- Server side only: RLS on with no policies, nothing for anon or authenticated.

create table if not exists escapes (
  who text primary key,                    -- sha256 of 'esc:' || visitor id, first 32 hex characters
  name text check (name is null or char_length(name) between 1 and 30),
  at timestamptz not null default now(),   -- when they got it out
  named_at timestamptz                     -- when they signed
);
create index if not exists escapes_named on escapes (named_at desc) where name is not null;
alter table escapes enable row level security;
revoke all on escapes from anon, authenticated;
