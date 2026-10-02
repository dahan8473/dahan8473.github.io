-- Notes remember where their writer stuck them on the wall.
-- Paste into the Supabase SQL editor and run once.

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
