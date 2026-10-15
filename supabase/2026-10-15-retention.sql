-- How long visitor data is kept (the privacy page promises a delete on
-- request; this makes old data go away on its own too). Run once in the
-- Supabase SQL editor. Nightly at 04:30 UTC:
--   IP addresses: cleared 30 days after a visitor was last seen
--   page views and behavior events: deleted after 90 days
--   chats with the head: deleted after 12 months
-- Notes, messages, what the head learned about a visitor (their profile) and
-- the spend counter stay. Deletes are permanent.

create extension if not exists pg_cron;

create or replace function purge_old()
returns void
language sql
security definer
set search_path = public
as $$
  update visitors set ip = null where ip is not null and last_seen < now() - interval '30 days';
  delete from page_views where at < now() - interval '90 days';
  delete from events where at < now() - interval '90 days';
  delete from conversations where updated_at < now() - interval '12 months';
$$;
revoke all on function purge_old() from public, anon, authenticated;

select cron.unschedule('purge-old') where exists (select 1 from cron.job where jobname = 'purge-old');
select cron.schedule('purge-old', '30 4 * * *', 'select purge_old()');
