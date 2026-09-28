-- One bounded, decoded image per notice. Kept apart so list queries never read bytes.
create table prayer_app.notice_images (
  notice_id uuid primary key references prayer_app.notices(id) on delete cascade,
  version uuid not null default gen_random_uuid(),
  data bytea not null check (octet_length(data) between 1 and 2097152),
  width integer not null check (width between 1 and 2400),
  height integer not null check (height between 1 and 2400)
);
alter table prayer_app.notice_images enable row level security;
create policy deny_non_backend_access on prayer_app.notice_images
  as restrictive for all to public using (false) with check (false);
revoke all on prayer_app.notice_images from public, anon, authenticated;
