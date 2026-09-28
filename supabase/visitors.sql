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
  values (p_convo, p_visitor, p_all, (select count(*) from jsonb_array_elements(p_all) m where m->>'role' = 'user'), p_page)
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
