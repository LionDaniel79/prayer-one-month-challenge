-- Presentation only: preserve all challenge periods and participation records.
alter table prayer_app.prayer_menu_settings
  add column name text not null default '기도운동',
  add column description text not null default '',
  add constraint prayer_menu_name_length check (char_length(btrim(name)) between 1 and 40),
  add constraint prayer_menu_description_length check (char_length(description) <= 2000);
