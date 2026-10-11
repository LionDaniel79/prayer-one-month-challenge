-- Additive migration: existing requests remain visible to their original owners.
alter table prayer_app.prayer_requests
  add column version integer not null default 1,
  add column completed_by_requester boolean not null default false,
  add column completed_at timestamptz,
  add column requester_read_sequence bigint not null default 0;

create table prayer_app.prayer_request_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references prayer_app.prayer_requests(id) on delete cascade,
  author_user_id uuid not null references prayer_app.users(id) on delete cascade,
  author_role prayer_app.prayer_role not null,
  content text not null check (length(btrim(content)) between 1 and 2000),
  client_id uuid not null,
  sequence bigserial not null unique,
  created_at timestamptz not null default now(),
  unique (request_id, author_user_id, client_id)
);
create index prayer_request_comments_request_sequence_idx
  on prayer_app.prayer_request_comments(request_id, sequence desc);
alter table prayer_app.prayer_request_comments enable row level security;
create policy deny_non_backend_access on prayer_app.prayer_request_comments
  as restrictive for all to public using (false) with check (false);
revoke all on prayer_app.prayer_request_comments from public, anon, authenticated;
revoke all on sequence prayer_app.prayer_request_comments_sequence_seq from public, anon, authenticated;
