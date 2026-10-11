alter table prayer_app.prayer_request_comments
  add column version integer not null default 1,
  add column edited_at timestamptz;
