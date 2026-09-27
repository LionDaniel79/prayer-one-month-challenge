-- Additive migration: existing disabled dates keep their behavior.
alter table prayer_app.visit_blocked_dates
  add column is_enabled boolean not null default false;

create table prayer_app.prayer_participant_exclusions (
  challenge_id uuid not null references prayer_app.challenges(id) on delete cascade,
  user_id uuid not null references prayer_app.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
create index prayer_participant_exclusions_user_idx
  on prayer_app.prayer_participant_exclusions(user_id);
alter table prayer_app.prayer_participant_exclusions enable row level security;
revoke all on table prayer_app.prayer_participant_exclusions from public, anon, authenticated;
