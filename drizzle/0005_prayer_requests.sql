create table prayer_app.prayer_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  content text not null,
  status varchar(20) not null default 'received'
    check (status in ('received','praying','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index prayer_requests_status_created_idx
  on prayer_app.prayer_requests(status, created_at desc);

create index prayer_requests_user_created_idx
  on prayer_app.prayer_requests(user_id, created_at desc);

alter table prayer_app.prayer_requests enable row level security;

create policy deny_non_backend_access on prayer_app.prayer_requests
  as restrictive for all to public using (false) with check (false);

revoke all on prayer_app.prayer_requests from anon, authenticated;
