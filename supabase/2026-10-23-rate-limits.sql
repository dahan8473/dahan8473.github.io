-- 2026-10-23: daily caps per IP, shared by every Vercel instance (api/_limits.js).
-- Paste into the Supabase SQL editor and run. Safe to run more than once.
-- The key is a hash of the IP, never the IP itself. Rows only matter for the
-- current UTC day and are cleared after two days.
-- Server side only, like everything else here: RLS on with no policies, and
-- nothing is readable or callable by anon or authenticated.

create table if not exists rate_limits (
  key text not null,                       -- sha256 of 'rl:' || ip, first 32 hex characters
  bucket text not null,                    -- note, inbox, events, chat, draft
  day date not null,
  hits int not null default 0,
  primary key (key, bucket, day)
);
create index if not exists rate_limits_day on rate_limits (day);
alter table rate_limits enable row level security;
revoke all on rate_limits from anon, authenticated;

-- Counts one hit and returns today's total for that key and bucket.
create or replace function hit_limit(p_key text, p_bucket text)
returns int
language plpgsql
set search_path = public
as $$
declare
  v_hits int;
  v_day date := (now() at time zone 'utc')::date;
begin
  insert into rate_limits (key, bucket, day, hits)
  values (left(p_key, 64), left(p_bucket, 24), v_day, 1)
  on conflict (key, bucket, day) do update set hits = rate_limits.hits + 1
  returning hits into v_hits;
  -- Now and then, clear out old days.
  if random() < 0.01 then
    delete from rate_limits where day < v_day - 1;
  end if;
  return v_hits;
end;
$$;
revoke execute on function hit_limit(text, text) from public, anon, authenticated;
