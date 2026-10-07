-- Additive, server-only metrics. Do not change membership, permissions or report contents.
alter table prayer_app.users add column first_login_at timestamptz;
-- Existing session creation (including expired/revoked sessions) is positive login evidence.
-- Pre-created users without a session deliberately remain null until a successful login.
update prayer_app.users u set first_login_at=s.first_login_at
from (select user_id,min(created_at) as first_login_at from prayer_app.sessions group by user_id) s
where u.id=s.user_id and u.first_login_at is null;

-- Report versions start at 0; -1 means no administrator has acknowledged a version.
alter table prayer_app.pastoral_reports
  add column reviewed_version integer not null default -1 check (reviewed_version >= -1),
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references prayer_app.users(id) on delete set null;
create index pastoral_reports_unreviewed_idx on prayer_app.pastoral_reports(submitted_at desc,id)
  where submitted_at is not null and reviewed_version < version;
-- Existing RLS and role privileges on these private tables are unchanged.
