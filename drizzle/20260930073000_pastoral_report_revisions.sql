-- Additive revision support. Existing reports, authors, completion dates and legacy JSON are preserved.
alter table prayer_app.pastoral_reports add column version integer not null default 0 check(version >= 0);
alter table prayer_app.pastoral_reports add column updated_at timestamptz not null default now();
alter table prayer_app.pastoral_reports add column updated_by uuid references prayer_app.users(id) on delete set null;
create table prayer_app.pastoral_report_edits (
 id uuid primary key,
 report_id uuid not null references prayer_app.pastoral_reports(id) on delete cascade,
 actor_id uuid not null references prayer_app.users(id) on delete cascade,
 expected_version integer not null check(expected_version >= 0),
 payload jsonb not null check(jsonb_typeof(payload)='object'),
 fingerprint varchar(64) not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 applied_at timestamptz,
 created_at timestamptz not null default now()
);
create index pastoral_report_edits_report_idx on prayer_app.pastoral_report_edits(report_id);
create index pastoral_report_edits_actor_created_idx on prayer_app.pastoral_report_edits(actor_id,created_at);
create table prayer_app.pastoral_edit_chunks (
 edit_id uuid not null references prayer_app.pastoral_report_edits(id) on delete cascade,
 slot smallint not null check(slot in (0,1)),
 chunk_index smallint not null check(chunk_index between 0 and 11),
 data bytea not null check(octet_length(data) between 1 and 524288),
 primary key(edit_id,slot,chunk_index)
);
alter table prayer_app.pastoral_report_edits enable row level security;
alter table prayer_app.pastoral_edit_chunks enable row level security;
create policy deny_non_backend_access on prayer_app.pastoral_report_edits as restrictive for all to public using(false) with check(false);
create policy deny_non_backend_access on prayer_app.pastoral_edit_chunks as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.pastoral_report_edits,prayer_app.pastoral_edit_chunks from public,anon,authenticated;
