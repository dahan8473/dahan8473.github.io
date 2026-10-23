-- 2026-10-23: forget_visitor(id) deletes a visitor and everything tied to
-- them, for the deletion requests the privacy page promises. In the Supabase
-- SQL editor:
--   select forget_visitor('<their visitor id>');
-- It returns how many rows it deleted from each table.
-- Paste this file into the SQL editor and run it once first. Safe to run more
-- than once. Needs supabase/2026-10-07-learning-admin.sql (events, proposals)
-- and supabase/2026-10-23-rate-limits.sql (rate_limits) applied.
-- What it can't reach: copies already on David's phone (Telegram) and
-- Supabase's backups, which expire on their own.

-- True when one evidence item of a learning proposal quotes one of the
-- visitor's messages. api/_learn.js redacts emails and numbers and trims
-- before it saves a quote, so p_said is redacted the same way (lowercase), and
-- either side's first 60 characters showing up in the other counts.
create or replace function evidence_quotes(p_item text, p_said text[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select exists (
    select 1
    from unnest(p_said) s,
      lateral (select lower(btrim(coalesce(p_item, ''), ' "''“”‘’…')) as e) x
    where (length(x.e) >= 12 and position(left(x.e, 60) in s) > 0)
       or (length(s) >= 12 and position(left(s, 60) in x.e) > 0)
  );
$$;
revoke execute on function evidence_quotes(text, text[]) from public, anon, authenticated;

create or replace function forget_visitor(p_visitor uuid)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_ip text;
  v_convos uuid[];
  v_said text[];
  n jsonb := '{}'::jsonb;
  c int;
begin
  select ip into v_ip from visitors where id = p_visitor;
  select coalesce(array_agg(id), '{}') into v_convos from conversations where visitor_id = p_visitor;

  -- Everything they said to the head, redacted the way the learn job redacts
  -- the quotes it keeps as evidence.
  select coalesce(array_agg(distinct s), '{}') into v_said
  from (
    select lower(regexp_replace(regexp_replace(e.m->>'content',
      '[\w.+-]+@[\w-]+(\.[\w-]+)+', '[email]', 'g'),
      '\+?\d[\d\s().-]{7,}\d', '[number]', 'g')) as s
    from conversations c, jsonb_array_elements(c.messages) e(m)
    where c.visitor_id = p_visitor and e.m->>'role' = 'user'
  ) said
  where length(s) >= 12;

  -- Learning proposals that quote them: pending ones go; ones David already
  -- decided keep the decision (so a rejected idea stays rejected) and lose
  -- the quotes.
  delete from proposals p
  where p.status = 'pending'
    and exists (select 1 from jsonb_array_elements_text(p.evidence) ev(item) where evidence_quotes(ev.item, v_said));
  get diagnostics c = row_count;
  n := n || jsonb_build_object('proposals_deleted', c);

  update proposals p
  set evidence = coalesce((
    select jsonb_agg(ev.item order by ev.i)
    from jsonb_array_elements(p.evidence) with ordinality ev(item, i)
    where not evidence_quotes(ev.item #>> '{}', v_said)
  ), '[]'::jsonb)
  where p.status <> 'pending'
    and exists (select 1 from jsonb_array_elements_text(p.evidence) ev(item) where evidence_quotes(ev.item, v_said));
  get diagnostics c = row_count;
  n := n || jsonb_build_object('proposals_scrubbed', c);

  delete from events where visitor_id = p_visitor or convo_id = any (v_convos);
  get diagnostics c = row_count;
  n := n || jsonb_build_object('events', c);

  -- Notes would only lose their visitor (on delete set null), so they go first.
  delete from notes where visitor_id = p_visitor;
  get diagnostics c = row_count;
  n := n || jsonb_build_object('notes', c);

  delete from messages where visitor_id = p_visitor;
  get diagnostics c = row_count;
  n := n || jsonb_build_object('messages', c);

  delete from conversations where visitor_id = p_visitor;
  get diagnostics c = row_count;
  n := n || jsonb_build_object('conversations', c);

  delete from page_views where visitor_id = p_visitor;
  get diagnostics c = row_count;
  n := n || jsonb_build_object('page_views', c);

  -- Today's rate limit counts for their IP (keyed by its hash, api/_limits.js).
  if v_ip is not null then
    delete from rate_limits where key = left(encode(sha256(convert_to('rl:' || v_ip, 'UTF8')), 'hex'), 32);
    get diagnostics c = row_count;
    n := n || jsonb_build_object('rate_limits', c);
  end if;

  delete from visitors where id = p_visitor;
  get diagnostics c = row_count;
  n := n || jsonb_build_object('visitor', c);
  return n;
end;
$$;
revoke execute on function forget_visitor(uuid) from public, anon, authenticated;
