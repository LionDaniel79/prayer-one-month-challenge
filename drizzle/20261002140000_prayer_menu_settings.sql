create table prayer_app.prayer_menu_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table prayer_app.prayer_menu_settings enable row level security;
revoke all on table prayer_app.prayer_menu_settings from public, anon, authenticated;
insert into prayer_app.prayer_menu_settings (id, enabled) values (1, true)
  on conflict (id) do nothing;
