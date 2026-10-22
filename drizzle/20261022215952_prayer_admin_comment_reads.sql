-- Shared administrator read cursor; requester unread state stays independent.
alter table prayer_app.prayer_requests
  add column if not exists admin_read_sequence bigint not null default 0;
