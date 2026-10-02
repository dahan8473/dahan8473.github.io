-- Visitor log and chat transcripts for davidliu.work.
-- Run once in a dedicated Supabase project (SQL editor, or `supabase db push`).
-- Only the server (secret key) touches these: RLS is on with no policies, and
-- the functions aren't callable by anon or authenticated users.

create table if not exists visitors (
  id uuid primary key,                    -- random id kept in the visitor's localStorage
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  views int not null default 0,
  name text,
  profile jsonb not null default '{}',    -- what the head learned: name, role, company, interests
  country text,
  region text,
  city text,
  referrer text,                          -- where they first came from
  user_agent text
);

create table if not exists page_views (
  id bigint generated always as identity primary key,
  visitor_id uuid not null references visitors (id) on delete cascade,
  path text not null,
  referrer text,
  at timestamptz not null default now()
);
create index if not exists page_views_visitor_at on page_views (visitor_id, at desc);

create table if not exists conversations (
  id uuid primary key,                    -- one per browser session
  visitor_id uuid not null references visitors (id) on delete cascade,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_page text,
  turns int not null default 0,
  messages jsonb not null default '[]'
);
create index if not exists conversations_updated on conversations (updated_at desc);

alter table visitors enable row level security;
alter table page_views enable row level security;
alter table conversations enable row level security;

create or replace function track_visit(p_visitor uuid, p_path text, p_referrer text, p_country text, p_region text, p_city text, p_ua text)
returns void
language sql
set search_path = public
as $$
  insert into visitors (id, views, country, region, city, referrer, user_agent)
  values (p_visitor, 1, p_country, p_region, p_city, nullif(p_referrer, ''), p_ua)
  on conflict (id) do update set
    last_seen = now(),
    views = visitors.views + 1,
    country = coalesce(excluded.country, visitors.country),
    region = coalesce(excluded.region, visitors.region),
    city = coalesce(excluded.city, visitors.city),
    user_agent = excluded.user_agent;
  insert into page_views (visitor_id, path, referrer) values (p_visitor, p_path, nullif(p_referrer, ''));
$$;

-- p_all is the whole conversation, used the first time. After that only the
-- new exchange (p_new) is appended, so long chats never get cut short.
create or replace function save_chat(p_convo uuid, p_visitor uuid, p_all jsonb, p_new jsonb, p_notes jsonb, p_page text)
returns void
language plpgsql
set search_path = public
as $$
begin
  insert into visitors (id) values (p_visitor)
  on conflict (id) do update set last_seen = now();

  insert into conversations (id, visitor_id, messages, turns, last_page)
  values (p_convo, p_visitor, p_all, 1, p_page)
  on conflict (id) do update set
    messages = conversations.messages || p_new,
    turns = conversations.turns + 1,
    updated_at = now(),
    last_page = excluded.last_page;

  if p_notes <> '{}'::jsonb then
    update visitors
    set profile = profile || p_notes, name = coalesce(p_notes->>'name', name)
    where id = p_visitor;
  end if;
end;
$$;

revoke execute on function track_visit(uuid, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function save_chat(uuid, uuid, jsonb, jsonb, jsonb, text) from public, anon, authenticated;

-- ---- Added 2026-10: spend cap, notes for David, memory -----------------------

-- What the brain has cost, per calendar month (UTC), in dollars.
create table if not exists spend (
  month text primary key,                 -- 'YYYY-MM'
  usd numeric not null default 0,
  updated_at timestamptz not null default now()
);
alter table spend enable row level security;

create or replace function add_spend(p_usd numeric)
returns numeric
language sql
set search_path = public
as $$
  insert into spend (month, usd) values (to_char(now() at time zone 'utc', 'YYYY-MM'), p_usd)
  on conflict (month) do update set usd = spend.usd + excluded.usd, updated_at = now()
  returning usd;
$$;

create or replace function spent_this_month()
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((select usd from spend where month = to_char(now() at time zone 'utc', 'YYYY-MM')), 0);
$$;

-- Notes visitors leave for the real David through the head.
create table if not exists notes (
  id bigint generated always as identity primary key,
  visitor_id uuid references visitors (id) on delete set null,
  name text,
  contact text,
  message text not null,
  page text,
  at timestamptz not null default now()
);
alter table notes enable row level security;

-- Public notes show on the wall at /notes/. Jev screens them first; anything
-- it flags stays private (flagged) and only David sees it.
alter table notes add column if not exists public boolean not null default false;
alter table notes add column if not exists flagged boolean not null default false;

drop function if exists leave_note(uuid, text, text, text, text);
create or replace function leave_note(p_visitor uuid, p_name text, p_contact text, p_message text, p_page text, p_public boolean, p_flagged boolean)
returns bigint
language sql
set search_path = public
as $$
  insert into visitors (id) values (p_visitor) on conflict (id) do nothing;
  insert into notes (visitor_id, name, contact, message, page, public, flagged)
  values (p_visitor, nullif(p_name, ''), nullif(p_contact, ''), p_message, p_page, p_public, p_flagged)
  returning id;
$$;

create or replace function list_wall()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', name, 'message', message, 'at', at) order by at desc), '[]'::jsonb)
  from (select name, message, at from notes where public and not flagged order by at desc limit 100) w;
$$;

-- What the head remembers about a returning visitor.
create or replace function recall(p_visitor uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'name', v.name,
    'profile', v.profile,
    'visits', (select count(distinct date_trunc('day', at)) from page_views where visitor_id = v.id),
    'first_seen', v.first_seen,
    'last_seen', v.last_seen,
    'last_asked', (
      select coalesce(jsonb_agg(m->>'content'), '[]'::jsonb)
      from (
        select e.m from conversations c, jsonb_array_elements(c.messages) with ordinality as e(m, i)
        where c.visitor_id = v.id and e.m->>'role' = 'user' and left(e.m->>'content', 1) <> '('
        order by c.updated_at desc, e.i desc
        limit 4
      ) last
    )
  )
  from visitors v where v.id = p_visitor;
$$;

revoke execute on function add_spend(numeric) from public, anon, authenticated;
revoke execute on function spent_this_month() from public, anon, authenticated;
revoke execute on function leave_note(uuid, text, text, text, text, boolean, boolean) from public, anon, authenticated;
revoke execute on function list_wall() from public, anon, authenticated;
revoke execute on function recall(uuid) from public, anon, authenticated;

-- ---- Added 2026-10-02: notes remember where they were stuck -------------------

alter table notes add column if not exists x real;
alter table notes add column if not exists y real;

drop function if exists leave_note(uuid, text, text, text, text, boolean, boolean);
create or replace function leave_note(p_visitor uuid, p_name text, p_contact text, p_message text, p_page text, p_public boolean, p_flagged boolean, p_x real default null, p_y real default null)
returns bigint
language sql
set search_path = public
as $$
  insert into visitors (id) values (p_visitor) on conflict (id) do nothing;
  insert into notes (visitor_id, name, contact, message, page, public, flagged, x, y)
  values (p_visitor, nullif(p_name, ''), nullif(p_contact, ''), p_message, p_page, p_public, p_flagged, p_x, p_y)
  returning id;
$$;

create or replace function list_wall()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', name, 'message', message, 'at', at, 'x', x, 'y', y) order by at), '[]'::jsonb)
  from (select id, name, message, at, x, y from notes where public and not flagged order by at desc limit 150) w;
$$;

revoke execute on function leave_note(uuid, text, text, text, text, boolean, boolean, real, real) from public, anon, authenticated;
revoke execute on function list_wall() from public, anon, authenticated;

-- The inbox: visitors message the real David from /messages/ (or a private
-- note through the head). Each one goes to his Telegram; tg_id is that
-- Telegram message, so when he replies to it the reply lands in the right
-- thread. Server side only, through the secret key.
create table if not exists messages (
  id bigserial primary key,
  visitor_id uuid not null references visitors (id) on delete cascade,
  sender text not null check (sender in ('visitor', 'david')),
  name text,
  body text not null check (char_length(body) between 1 and 2000),
  tg_id bigint,
  at timestamptz not null default now()
);
create index if not exists messages_visitor_at on messages (visitor_id, at);
create index if not exists messages_tg on messages (tg_id);
alter table messages enable row level security;
revoke all on messages from anon, authenticated;
