create table prayer_app.notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  status varchar(20) not null check (status in ('draft','published')),
  author_user_id uuid not null references prayer_app.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notices_status_published_idx
  on prayer_app.notices(status, published_at desc);

create table prayer_app.notice_reads (
  notice_id uuid not null references prayer_app.notices(id) on delete cascade,
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notice_id, user_id)
);

create table prayer_app.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index push_subscriptions_endpoint_uq
  on prayer_app.push_subscriptions(endpoint);

create index push_subscriptions_user_idx
  on prayer_app.push_subscriptions(user_id);

alter table prayer_app.notices enable row level security;
alter table prayer_app.notice_reads enable row level security;
alter table prayer_app.push_subscriptions enable row level security;

create policy deny_non_backend_access on prayer_app.notices
  as restrictive for all to public using (false) with check (false);
create policy deny_non_backend_access on prayer_app.notice_reads
  as restrictive for all to public using (false) with check (false);
create policy deny_non_backend_access on prayer_app.push_subscriptions
  as restrictive for all to public using (false) with check (false);
