-- 2026-10-07: behavior tracking, the learning loop, and the admin portal.
-- Paste into the Supabase SQL editor and run. Safe to run more than once, and
-- it also brings in supabase/2026-10-04-visitor-details.sql (and the inbox
-- table from 2026-10-02) in case those weren't run.
-- Server side only, like everything else here: RLS on with no policies, and
-- nothing is readable or callable by anon or authenticated.

-- ---- From 2026-10-02 and 2026-10-04 (no-ops if already run) ------------------

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

alter table visitors add column if not exists ip text;
alter table visitors add column if not exists timezone text;
alter table visitors add column if not exists position text;
alter table visitors add column if not exists company text;
alter table visitors add column if not exists reason text;

drop function if exists track_visit(uuid, text, text, text, text, text, text);
create or replace function track_visit(p_visitor uuid, p_path text, p_referrer text, p_country text, p_region text, p_city text, p_ua text, p_ip text default null, p_tz text default null)
returns void
language sql
set search_path = public
as $$
  insert into visitors (id, views, country, region, city, referrer, user_agent, ip, timezone)
  values (p_visitor, 1, p_country, p_region, p_city, nullif(p_referrer, ''), p_ua, p_ip, p_tz)
  on conflict (id) do update set
    last_seen = now(),
    views = visitors.views + 1,
    country = coalesce(excluded.country, visitors.country),
    region = coalesce(excluded.region, visitors.region),
    city = coalesce(excluded.city, visitors.city),
    user_agent = excluded.user_agent,
    ip = coalesce(excluded.ip, visitors.ip),
    timezone = coalesce(excluded.timezone, visitors.timezone);
  insert into page_views (visitor_id, path, referrer) values (p_visitor, p_path, nullif(p_referrer, ''));
$$;
revoke execute on function track_visit(uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;

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
    set profile = profile || p_notes,
        name = coalesce(p_notes->>'name', name),
        position = coalesce(p_notes->>'role', p_notes->>'position', position),
        company = coalesce(p_notes->>'company', company),
        reason = coalesce(p_notes->>'reason', reason)
    where id = p_visitor;
  end if;
end;
$$;
revoke execute on function save_chat(uuid, uuid, jsonb, jsonb, jsonb, text) from public, anon, authenticated;

create or replace view visitor_log with (security_invoker = true) as
select
  v.name, v.position, v.company, v.reason,
  v.profile->>'who' as seems_to_be,
  v.city, v.region, v.country, v.timezone, v.ip,
  v.views, v.first_seen, v.last_seen, v.referrer,
  (select string_agg(distinct p.path, ' ') from page_views p where p.visitor_id = v.id) as pages,
  (select coalesce(sum(c.turns), 0) from conversations c where c.visitor_id = v.id) as chat_turns,
  v.profile, v.user_agent, v.id
from visitors v
order by v.last_seen desc;
revoke all on visitor_log from public, anon, authenticated;

-- ---- Behavior events: what visitors do on the page (track.js, api/events.js) ---

create table if not exists events (
  id bigint generated always as identity primary key,
  visitor_id uuid not null references visitors (id) on delete cascade,
  convo_id uuid,
  type text not null check (char_length(type) between 1 and 24),
  path text,
  data jsonb not null default '{}',
  at timestamptz not null default now()
);
create index if not exists events_visitor_at on events (visitor_id, at);
create index if not exists events_type_at on events (type, at);
create index if not exists events_at on events (at);
alter table events enable row level security;
revoke all on events from anon, authenticated;

create or replace function track_events(p_visitor uuid, p_convo uuid, p_events jsonb)
returns int
language sql
set search_path = public
as $$
  insert into visitors (id) values (p_visitor) on conflict (id) do nothing;
  with ins as (
    insert into events (visitor_id, convo_id, type, path, data, at)
    select p_visitor, p_convo, e->>'type', left(e->>'path', 100), coalesce(e->'data', '{}'::jsonb), coalesce((e->>'at')::timestamptz, now())
    from jsonb_array_elements(p_events) e
    returning 1
  )
  select count(*)::int from ins;
$$;
revoke execute on function track_events(uuid, uuid, jsonb) from public, anon, authenticated;

-- ---- The learning loop -------------------------------------------------------
-- api/learn.js reads yesterday's chats and events every night and proposes
-- things. Nothing reaches the head until David approves it in the portal.

create table if not exists proposals (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('fact', 'faq', 'line', 'insight')),
  title text not null check (char_length(title) between 1 and 200),
  text text not null default '',
  evidence jsonb not null default '[]',
  confidence real,
  meta jsonb not null default '{}',       -- line proposals: { line_id, kind }
  key text not null,                       -- kind + normalized title; a rejected idea never comes back
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index if not exists proposals_key on proposals (key);
create index if not exists proposals_status on proposals (status, created_at desc);
alter table proposals enable row level security;
revoke all on proposals from anon, authenticated;

-- Approved facts and answers. api/chat.js adds the active ones to the prompt.
create table if not exists knowledge (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('fact', 'faq')),
  title text not null check (char_length(title) between 1 and 200),  -- the question, for faq
  text text not null check (char_length(text) between 1 and 1000),
  active boolean not null default true,
  proposal_id bigint references proposals (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table knowledge enable row level security;
revoke all on knowledge from anon, authenticated;

-- Approved new versions of the head's own lines, served by api/lines.js. The
-- head reports them back as line id '<slot>#learned-<id>' so they get scored too.
create table if not exists line_variants (
  id bigint generated always as identity primary key,
  kind text not null,                      -- the group of lines it joins
  of_line text,                            -- the line it was written to beat
  text text not null check (char_length(text) between 1 and 300),
  active boolean not null default true,
  proposal_id bigint references proposals (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table line_variants enable row level security;
revoke all on line_variants from anon, authenticated;

-- Approve or reject one pending proposal, with David's edits. Approving a
-- fact or faq makes it knowledge; approving a line makes it a variant.
create or replace function decide_proposal(p_id bigint, p_approve boolean, p_title text default null, p_text text default null)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  p proposals;
begin
  update proposals set
    status = case when p_approve then 'approved' else 'rejected' end,
    title = coalesce(nullif(btrim(p_title), ''), title),
    text = coalesce(btrim(p_text), text),
    decided_at = now()
  where id = p_id and status = 'pending'
  returning * into p;
  if not found then return null; end if;
  if p_approve and p.kind in ('fact', 'faq') then
    insert into knowledge (kind, title, text, proposal_id) values (p.kind, p.title, p.text, p.id);
  elsif p_approve and p.kind = 'line' then
    insert into line_variants (kind, of_line, text, proposal_id)
    values (coalesce(nullif(p.meta->>'kind', ''), 'line'), nullif(p.meta->>'line_id', ''), p.text, p.id);
  end if;
  return to_jsonb(p);
end;
$$;
revoke execute on function decide_proposal(bigint, boolean, text, text) from public, anon, authenticated;

-- How each of the head's lines lands, per line id, from the line, line_done,
-- line_cut, reply, page, overlay_close and hidden events.
--   replies: times the visitor replied within 20s and this was the head's
--            latest line before the reply
--   leaves:  times they changed page, closed an overlay or left the tab within 3s
--   score:   reply rate smoothed toward the average line (10 views of prior),
--            minus half a reply per leave, floored at 0
create or replace function line_stats(p_since timestamptz default now() - interval '90 days')
returns table (line_id text, kind text, text text, shown int, done int, cut int, replies int, leaves int, score real)
language sql
stable
set search_path = public
as $$
  with shown as (
    select e.id, e.visitor_id, e.at, e.data->>'id' as line_id, e.data->>'kind' as kind, e.data->>'text' as text
    from events e
    where e.type = 'line' and e.at >= p_since and coalesce(e.data->>'id', '') <> ''
  ),
  replied as (
    select distinct l.id
    from events r
    cross join lateral (
      select s.id from events s
      where s.visitor_id = r.visitor_id and s.type = 'line' and s.at < r.at and s.at >= r.at - interval '20 seconds'
      order by s.at desc limit 1
    ) l
    where r.type = 'reply' and r.at >= p_since
  ),
  per as (
    select s.line_id,
      (array_agg(s.kind order by s.at desc))[1] as kind,
      (array_agg(s.text order by s.at desc))[1] as text,
      count(*)::int as shown,
      count(*) filter (where s.id in (select id from replied))::int as replies,
      count(*) filter (where exists (
        select 1 from events x
        where x.visitor_id = s.visitor_id and x.type in ('page', 'overlay_close', 'hidden')
          and x.at > s.at and x.at <= s.at + interval '3 seconds'
      ))::int as leaves
    from shown s
    group by s.line_id
  ),
  ends as (
    select e.data->>'id' as line_id,
      count(*) filter (where e.type = 'line_done')::int as done,
      count(*) filter (where e.type = 'line_cut')::int as cut
    from events e
    where e.type in ('line_done', 'line_cut') and e.at >= p_since
    group by 1
  ),
  prior as (select coalesce(sum(replies)::real / nullif(sum(shown), 0), 0.2) as p from per)
  select per.line_id, per.kind, per.text, per.shown, coalesce(ends.done, 0), coalesce(ends.cut, 0), per.replies, per.leaves,
    round(greatest(0, (per.replies + 10 * prior.p - 0.5 * per.leaves) / (per.shown + 10))::numeric, 4)::real
  from per
  left join ends on ends.line_id = per.line_id
  cross join prior
  order by per.shown desc;
$$;
revoke execute on function line_stats(timestamptz) from public, anon, authenticated;

-- ---- Admin portal -------------------------------------------------------------

-- Every login attempt, so the lockout survives cold starts. Each attempt is
-- written as a failure first and flipped to ok only if the password matched.
create table if not exists admin_attempts (
  id bigint generated always as identity primary key,
  ip text not null,
  ok boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists admin_attempts_at on admin_attempts (at);
alter table admin_attempts enable row level security;
revoke all on admin_attempts from anon, authenticated;

create or replace function admin_try(p_ip text)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_id bigint;
  v_ip int;
  v_all int;
begin
  delete from admin_attempts where at < now() - interval '30 days';
  insert into admin_attempts (ip) values (left(coalesce(p_ip, 'unknown'), 64)) returning id into v_id;
  select count(*) filter (where ip = left(coalesce(p_ip, 'unknown'), 64)), count(*)
  into v_ip, v_all
  from admin_attempts where not ok and at > now() - interval '15 minutes';
  return jsonb_build_object('id', v_id, 'ip', v_ip, 'all', v_all);
end;
$$;
revoke execute on function admin_try(text) from public, anon, authenticated;

create or replace function admin_ok(p_id bigint)
returns void
language sql
set search_path = public
as $$
  update admin_attempts set ok = true where id = p_id;
$$;
revoke execute on function admin_ok(bigint) from public, anon, authenticated;

-- Chats with who had them, and the first thing the visitor said.
create or replace view conversation_log with (security_invoker = true) as
select
  c.id, c.visitor_id, v.name, v.position, v.company, v.profile->>'who' as seems_to_be,
  c.started_at, c.updated_at, c.turns, c.last_page,
  (select e.m->>'content' from jsonb_array_elements(c.messages) with ordinality as e(m, i)
   where e.m->>'role' = 'user' and left(e.m->>'content', 1) <> '('
   order by e.i limit 1) as preview,
  c.messages::text as search
from conversations c
join visitors v on v.id = c.visitor_id;
revoke all on conversation_log from public, anon, authenticated;

-- Everything on the Overview tab in one call. "Today" is in p_tz.
create or replace function admin_overview(p_tz text default 'America/Toronto')
returns jsonb
language sql
stable
set search_path = public
as $$
  with b as (select date_trunc('day', now() at time zone p_tz) at time zone p_tz as today)
  select jsonb_build_object(
    'visitors', jsonb_build_object(
      'today', (select count(distinct visitor_id) from page_views, b where at >= b.today),
      'd7', (select count(distinct visitor_id) from page_views where at >= now() - interval '7 days'),
      'd30', (select count(distinct visitor_id) from page_views where at >= now() - interval '30 days'),
      'total', (select count(*) from visitors),
      'new_d7', (select count(*) from visitors where first_seen >= now() - interval '7 days')
    ),
    'views_d30', (select count(*) from page_views where at >= now() - interval '30 days'),
    'chats', jsonb_build_object(
      'today', (select count(*) from conversations, b where updated_at >= b.today),
      'd30', (select count(*) from conversations where updated_at >= now() - interval '30 days'),
      'total', (select count(*) from conversations),
      'turns_d30', (select coalesce(sum(turns), 0) from conversations where updated_at >= now() - interval '30 days')
    ),
    'messages', jsonb_build_object(
      'total', (select count(*) from messages),
      'd30', (select count(*) from messages where at >= now() - interval '30 days'),
      'unanswered', (select count(*) from (
        select distinct on (visitor_id) sender from messages order by visitor_id, at desc
      ) last where sender = 'visitor')
    ),
    'notes', jsonb_build_object(
      'total', (select count(*) from notes),
      'd30', (select count(*) from notes where at >= now() - interval '30 days')
    ),
    'spend', spent_this_month(),
    'pending', (select count(*) from proposals where status = 'pending'),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d.day, 'visitors', coalesce(c.n, 0)) order by d.day), '[]'::jsonb)
      from (select generate_series((now() at time zone p_tz)::date - 29, (now() at time zone p_tz)::date, interval '1 day')::date as day) d
      left join (
        select (at at time zone p_tz)::date as day, count(distinct visitor_id) as n
        from page_views where at >= now() - interval '31 days' group by 1
      ) c on c.day = d.day
    ),
    'pages', (
      select coalesce(jsonb_agg(x order by x.views desc), '[]'::jsonb) from (
        select path, count(*) as views, count(distinct visitor_id) as visitors
        from page_views where at >= now() - interval '30 days'
        group by path order by 2 desc limit 12
      ) x
    ),
    'referrers', (
      select coalesce(jsonb_agg(x order by x.visitors desc), '[]'::jsonb) from (
        select lower(regexp_replace(referrer, '^[a-z]+://(www\.)?([^/:?#]+).*$', '\2', 'i')) as host, count(*) as visitors
        from visitors
        where first_seen >= now() - interval '30 days' and referrer is not null
          and referrer !~* '^[a-z]+://(www\.)?(davidliu\.work|dahan8473\.github\.io|davidliu-work\.vercel\.app)'
        group by 1 order by 2 desc limit 10
      ) x
    )
  );
$$;
revoke execute on function admin_overview(text) from public, anon, authenticated;

-- Everything on the Behavior tab, over the last p_days days.
create or replace function admin_behavior(p_days int default 30)
returns jsonb
language sql
stable
set search_path = public
as $$
  with s as (select now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365))) as t),
  ev as (select e.* from events e, s where e.at >= s.t),
  pv as (select p.* from page_views p, s where p.at >= s.t),
  -- Home, then Projects, then a project overlay, then a demo, in that order.
  f1 as (select visitor_id, min(at) as t from pv where path = '/' group by 1),
  f2 as (select pv.visitor_id, min(pv.at) as t from pv join f1 on f1.visitor_id = pv.visitor_id where pv.path = '/projects/' and pv.at >= f1.t group by 1),
  f3 as (select ev.visitor_id, min(ev.at) as t from ev join f2 on f2.visitor_id = ev.visitor_id where ev.type = 'overlay_open' and ev.at >= f2.t group by 1),
  f4 as (select ev.visitor_id, min(ev.at) as t from ev join f3 on f3.visitor_id = ev.visitor_id where ev.type = 'demo_open' and ev.at >= f3.t group by 1),
  -- One row per page view the tracker timed: the furthest it got.
  dw as (
    select visitor_id, data->>'pv' as pv, max(path) as path,
      max(case when jsonb_typeof(data->'ms') = 'number' then (data->>'ms')::numeric end) as ms,
      max(case when jsonb_typeof(data->'depth') = 'number' then (data->>'depth')::numeric end) as depth
    from ev where type = 'dwell' group by 1, 2
  ),
  -- The last page each visitor saw each day: where they left.
  exits as (
    select distinct on (visitor_id, (at at time zone 'America/Toronto')::date) path
    from pv order by visitor_id, (at at time zone 'America/Toronto')::date, at desc
  )
  select jsonb_build_object(
    'days', greatest(1, least(coalesce(p_days, 30), 365)),
    'funnel', jsonb_build_array(
      jsonb_build_object('step', 'Home', 'visitors', (select count(*) from f1)),
      jsonb_build_object('step', 'Projects', 'visitors', (select count(*) from f2)),
      jsonb_build_object('step', 'Opened a project', 'visitors', (select count(*) from f3)),
      jsonb_build_object('step', 'Opened a demo', 'visitors', (select count(*) from f4))
    ),
    'events', (select coalesce(jsonb_object_agg(type, n), '{}'::jsonb) from (select type, count(*) as n from ev group by 1) x),
    'games', (
      select coalesce(jsonb_agg(x order by x.plays desc), '[]'::jsonb) from (
        select g.game,
          count(*) filter (where g.type = 'game_start') as plays,
          count(*) filter (where g.type = 'game_end') as finished,
          count(distinct g.visitor_id) as visitors,
          -- A result is a word (won, lost) or, for the Lumosity games, a
          -- score against David's (result_score, result_david).
          (select coalesce(jsonb_object_agg(r.result, r.n), '{}'::jsonb) from (
            select coalesce(
              data->>'result',
              case when jsonb_typeof(data->'result_score') = 'number' and jsonb_typeof(data->'result_david') = 'number'
                then case when (data->>'result_score')::numeric > (data->>'result_david')::numeric then 'beat david' else 'under david' end end,
              'ended') as result, count(*) as n
            from ev where type = 'game_end' and data->>'game' = g.game group by 1
          ) r) as results
        from (select type, visitor_id, data->>'game' as game from ev where type in ('game_start', 'game_end') and data ? 'game') g
        group by g.game
      ) x
    ),
    'overlays', (
      select coalesce(jsonb_agg(x order by x.opens desc), '[]'::jsonb) from (
        select data->>'id' as id, max(data->>'kind') as kind, count(*) as opens, count(distinct visitor_id) as visitors
        from ev where type = 'overlay_open' group by 1 order by 3 desc limit 30
      ) x
    ),
    'demos', (
      select coalesce(jsonb_agg(x order by x.opens desc), '[]'::jsonb) from (
        select data->>'id' as id, count(*) as opens, count(distinct visitor_id) as visitors
        from ev where type = 'demo_open' group by 1 order by 2 desc limit 30
      ) x
    ),
    'brings', (
      select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
        select data->>'id' as id, count(*) as n from ev where type = 'bring' group by 1 order by 2 desc limit 20
      ) x
    ),
    'clicks', (
      select coalesce(jsonb_agg(x order by x.clicks desc), '[]'::jsonb) from (
        select data->>'t' as target, count(*) as clicks, count(distinct visitor_id) as visitors
        from ev where type = 'click' group by 1 order by 2 desc limit 25
      ) x
    ),
    'dwell', (
      select coalesce(jsonb_agg(x order by x.views desc), '[]'::jsonb) from (
        select path, count(*) as views,
          round(percentile_cont(0.5) within group (order by ms))::int as median_ms,
          round(avg(depth))::int as avg_depth,
          round(100.0 * count(*) filter (where depth >= 75) / count(*))::int as pct_75
        from dw where path is not null and ms is not null group by path order by 2 desc limit 25
      ) x
    ),
    'exits', (
      select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb) from (
        select path, count(*) as n from exits group by 1 order by 2 desc limit 12
      ) x
    ),
    'by_who', (
      select coalesce(jsonb_object_agg(w.who, w.pages), '{}'::jsonb) from (
        select who, jsonb_agg(jsonb_build_object('path', path, 'visitors', n) order by n desc) as pages from (
          select v.profile->>'who' as who, pv.path, count(distinct pv.visitor_id) as n,
            row_number() over (partition by v.profile->>'who' order by count(distinct pv.visitor_id) desc) as r
          from pv join visitors v on v.id = pv.visitor_id
          where v.profile->>'who' in ('recruiter', 'engineer', 'student', 'friend')
          group by 1, 2
        ) y where r <= 6 group by who
      ) w
    )
  );
$$;
revoke execute on function admin_behavior(int) from public, anon, authenticated;
