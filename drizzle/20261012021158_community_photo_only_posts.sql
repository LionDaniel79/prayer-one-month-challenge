-- Presence of text or a photo is checked with the attachment manifest under the
-- post lock. The database still bounds text length and disallows NULL bodies.
alter table prayer_app.community_posts
  drop constraint community_posts_body_check,
  add constraint community_posts_body_check check (length(btrim(body)) between 0 and 20000);

alter table prayer_app.community_post_edits
  drop constraint community_post_edits_body_check,
  add constraint community_post_edits_body_check check (length(btrim(body)) between 0 and 20000);
