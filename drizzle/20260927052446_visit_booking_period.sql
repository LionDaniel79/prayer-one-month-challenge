create table prayer_app.visit_booking_settings (
  id integer primary key default 1 check (id = 1),
  start_date date,
  end_date date,
  updated_at timestamptz not null default now(),
  constraint visit_booking_period_valid check (
    (start_date is null and end_date is null) or
    (start_date is not null and end_date is not null and start_date <= end_date)
  )
);
alter table prayer_app.visit_booking_settings enable row level security;
revoke all on table prayer_app.visit_booking_settings from public, anon, authenticated;
