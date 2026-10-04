-- Who visits: IP and timezone from every visit, plus what the head learns in
-- the chat (position, company, why they're here). Read it in the visitor_log
-- view, or with /visitors in the Telegram bot.
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

-- The head's [[note:...]] facts also fill the named columns.
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

-- One row per visitor, newest first. Only the secret key can read it.
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
