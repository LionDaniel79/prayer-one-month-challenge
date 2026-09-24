alter table prayer_app.member_roster
  add column if not exists password_hash text;
