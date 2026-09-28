create table prayer_app.member_roster (
  id uuid primary key default gen_random_uuid(),
  source_name varchar(120) not null,
  canonical_name varchar(80) not null,
  position varchar(80),
  phone_lookup_hash varchar(64),
  phone_ciphertext text,
  village varchar(80),
  sam varchar(80),
  sam_label varchar(100),
  is_active boolean not null default true,
  is_admin boolean not null default false,
  source varchar(20) not null,
  source_row integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index member_roster_name_phone_uq
  on prayer_app.member_roster (canonical_name, phone_lookup_hash)
  where phone_lookup_hash is not null;
create index member_roster_name_idx
  on prayer_app.member_roster (canonical_name);
create index member_roster_sam_idx
  on prayer_app.member_roster (sam_label);

alter table prayer_app.member_roster enable row level security;

create policy deny_non_backend_access on prayer_app.member_roster
  as restrictive for all to public using (false) with check (false);

revoke all on prayer_app.member_roster from anon, authenticated;

alter table prayer_app.users
  add column roster_id uuid references prayer_app.member_roster(id);

create unique index users_roster_uq
  on prayer_app.users (roster_id);
