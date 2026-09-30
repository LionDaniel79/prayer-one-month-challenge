-- Additive only. Apply once, before deploying the pastoral reports routes.
-- No existing roster, report, community, prayer or visit data is copied/deleted.
create table prayer_app.village_leaders (
  id uuid primary key default gen_random_uuid(),
  name varchar(30) not null unique,
  village varchar(3) not null unique check (village ~ '^[1-9][0-9]{0,2}$'),
  leader_name varchar(100) not null check (length(btrim(leader_name)) > 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (name = village || '마을장')
);
create table prayer_app.pastoral_schedule_versions (
  year integer primary key check (year between 2000 and 9998),
  version integer not null default 0 check (version >= 0)
);
create table prayer_app.pastoral_requests (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 2000 and 9998),
  month integer not null check (month between 1 and 12),
  enabled boolean not null default true,
  created_by uuid references prayer_app.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);
create index pastoral_requests_enabled_month_idx on prayer_app.pastoral_requests(year,month) where enabled;
create table prayer_app.pastoral_reports (
  id uuid primary key,
  request_id uuid not null references prayer_app.pastoral_requests(id),
  sam_id uuid not null references prayer_app.sams(id),
  author_user_id uuid references prayer_app.users(id) on delete set null,
  sam_name text not null,
  village text not null,
  leader_name text not null,
  submitted_by text not null,
  written_date date not null,
  method text not null check (method in ('photo','file','form')),
  form jsonb,
  files jsonb not null,
  fingerprint varchar(64) not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 2),
  check ((method='form' and form is not null and jsonb_typeof(form)='object' and jsonb_array_length(files)=0)
    or (method in ('photo','file') and form is null and jsonb_array_length(files) between 1 and 2))
);
create index pastoral_reports_month_sam_idx on prayer_app.pastoral_reports(request_id,sam_id) where submitted_at is not null;
create index pastoral_reports_request_idx on prayer_app.pastoral_reports(request_id);
create index pastoral_reports_sam_idx on prayer_app.pastoral_reports(sam_id);
create index pastoral_reports_author_created_idx on prayer_app.pastoral_reports(author_user_id,created_at);
create index pastoral_reports_submitted_idx on prayer_app.pastoral_reports(submitted_at desc) where submitted_at is not null;
create table prayer_app.pastoral_report_chunks (
  report_id uuid not null references prayer_app.pastoral_reports(id) on delete cascade,
  slot smallint not null check (slot in (0,1)),
  chunk_index smallint not null check (chunk_index between 0 and 11),
  data bytea not null check (octet_length(data) between 1 and 524288),
  primary key (report_id,slot,chunk_index)
);
-- Server-only access. Authenticated app membership is checked by the server, not Supabase Auth.
alter table prayer_app.village_leaders enable row level security;
alter table prayer_app.pastoral_schedule_versions enable row level security;
alter table prayer_app.pastoral_requests enable row level security;
alter table prayer_app.pastoral_reports enable row level security;
alter table prayer_app.pastoral_report_chunks enable row level security;
create policy deny_non_backend_access on prayer_app.village_leaders as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.pastoral_schedule_versions as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.pastoral_requests as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.pastoral_reports as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.pastoral_report_chunks as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.village_leaders, prayer_app.pastoral_schedule_versions, prayer_app.pastoral_requests, prayer_app.pastoral_reports, prayer_app.pastoral_report_chunks from public, anon, authenticated;
