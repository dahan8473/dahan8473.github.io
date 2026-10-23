-- 2026-10-23: the first tables (supabase/visitors.sql) turned RLS on but never
-- revoked anon and authenticated, unlike everything added since. Same lock as
-- the rest: RLS on with no policies, nothing readable or writable by anon or
-- authenticated. Only the server's secret key touches these.
-- Paste into the Supabase SQL editor and run. Safe to run more than once.

alter table visitors enable row level security;
alter table page_views enable row level security;
alter table conversations enable row level security;
alter table notes enable row level security;
alter table spend enable row level security;

revoke all on visitors from anon, authenticated;
revoke all on page_views from anon, authenticated;
revoke all on conversations from anon, authenticated;
revoke all on notes from anon, authenticated;
revoke all on spend from anon, authenticated;
