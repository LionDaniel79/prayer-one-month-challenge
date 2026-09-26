create table prayer_app.visit_requests (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null references prayer_app.users(id),
  visit_date date not null,
  visit_type varchar(20) not null check (visit_type in ('personal','sam')),
  attendees text not null,
  location text not null,
  preferred_time text not null,
  reason text not null,
  status varchar(20) not null default 'requested'
    check (status in ('requested','confirmed','completed','cancelled')),
  calendar_sync_status varchar(20) not null default 'pending'
    check (calendar_sync_status in ('pending','synced','failed')),
  google_event_id text,
  confirmed_at timestamptz,
  confirmed_by_user_id uuid references prayer_app.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index visit_requests_active_date_uq
  on prayer_app.visit_requests(visit_date)
  where status <> 'cancelled';

create index visit_requests_status_date_idx
  on prayer_app.visit_requests(status, visit_date);

create table prayer_app.visit_blocked_dates (
  visit_date date primary key,
  reason text,
  created_by_user_id uuid not null references prayer_app.users(id),
  created_at timestamptz not null default now()
);

create table prayer_app.visit_blocked_weekdays (
  weekday integer primary key check (weekday between 0 and 6),
  created_by_user_id uuid not null references prayer_app.users(id),
  created_at timestamptz not null default now()
);

create table prayer_app.google_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  connected_by_user_id uuid not null references prayer_app.users(id),
  google_account_email text,
  refresh_token_ciphertext text not null,
  selected_calendar_id text,
  selected_calendar_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index google_calendar_single_connection_uq
  on prayer_app.google_calendar_connections ((true));

revoke all on table prayer_app.visit_requests from anon, authenticated;
revoke all on table prayer_app.visit_blocked_dates from anon, authenticated;
revoke all on table prayer_app.visit_blocked_weekdays from anon, authenticated;
revoke all on table prayer_app.google_calendar_connections from anon, authenticated;
