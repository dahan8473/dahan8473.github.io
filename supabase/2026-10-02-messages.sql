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
