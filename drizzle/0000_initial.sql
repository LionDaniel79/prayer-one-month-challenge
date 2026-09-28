create schema if not exists prayer_app;

do $$
begin
  create type prayer_app.prayer_role as enum ('member', 'admin');
exception
  when duplicate_object then null;
end $$;

create table if not exists prayer_app.challenges (
  id uuid primary key default gen_random_uuid(),
  title text not null default '기도운동 1달 도전',
  start_date date not null,
  end_date date not null,
  timezone text not null default 'Asia/Seoul',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  constraint challenges_date_order_check check (end_date >= start_date)
);

create unique index if not exists challenges_one_active_uq
  on prayer_app.challenges (is_active)
  where is_active = true;

create table if not exists prayer_app.sams (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  leader_name varchar(100) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists sams_name_uq
  on prayer_app.sams (name);

create table if not exists prayer_app.users (
  id uuid primary key default gen_random_uuid(),
  display_name varchar(80) not null,
  normalized_name varchar(80) not null,
  phone_lookup_hash varchar(64) not null,
  phone_password_hash text not null,
  sam_id uuid references prayer_app.sams(id),
  role prayer_app.prayer_role not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists users_name_phone_uq
  on prayer_app.users (normalized_name, phone_lookup_hash);
create index if not exists users_sam_idx
  on prayer_app.users (sam_id);

create table if not exists prayer_app.prayer_checkins (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references prayer_app.challenges(id) on delete cascade,
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  prayer_date date not null,
  created_at timestamptz not null default now()
);

create unique index if not exists checkin_user_date_uq
  on prayer_app.prayer_checkins (challenge_id, user_id, prayer_date);
create index if not exists checkin_date_idx
  on prayer_app.prayer_checkins (challenge_id, prayer_date);
create index if not exists checkin_user_idx
  on prayer_app.prayer_checkins (user_id);

create table if not exists prayer_app.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  token_hash varchar(64) not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists sessions_token_uq
  on prayer_app.sessions (token_hash);
create index if not exists sessions_user_idx
  on prayer_app.sessions (user_id);
create index if not exists sessions_expiry_idx
  on prayer_app.sessions (expires_at);

create table if not exists prayer_app.auth_rate_limits (
  key_hash varchar(64) primary key,
  window_started_at timestamptz not null,
  failure_count integer not null default 0,
  blocked_until timestamptz
);

alter table prayer_app.challenges enable row level security;
alter table prayer_app.sams enable row level security;
alter table prayer_app.users enable row level security;
alter table prayer_app.prayer_checkins enable row level security;
alter table prayer_app.sessions enable row level security;
alter table prayer_app.auth_rate_limits enable row level security;

revoke all on schema prayer_app from anon, authenticated;
revoke all on all tables in schema prayer_app from anon, authenticated;
revoke all on all sequences in schema prayer_app from anon, authenticated;
revoke all on all functions in schema prayer_app from anon, authenticated;

alter default privileges in schema prayer_app revoke all on tables from anon, authenticated;
alter default privileges in schema prayer_app revoke all on sequences from anon, authenticated;
alter default privileges in schema prayer_app revoke all on functions from anon, authenticated;
