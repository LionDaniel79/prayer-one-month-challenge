-- Additive refinement. Preserve all existing posts, attachments, comments and likes.
alter table prayer_app.community_folders add column sort_order integer not null default 0;
with positions as (
 select id, (row_number() over(order by created_at,id)-1)::integer as position
 from prayer_app.community_folders
) update prayer_app.community_folders f set sort_order=p.position from positions p where p.id=f.id;
create index community_folders_order_idx on prayer_app.community_folders(sort_order,created_at,id);
alter table prayer_app.community_posts add column version integer not null default 0 check(version>=0);

-- Separate uploads: published attachments never change until the final transaction commits.
create table prayer_app.community_post_edits (
 id uuid primary key,
 post_id uuid not null references prayer_app.community_posts(id) on delete cascade,
 author_user_id uuid not null references prayer_app.users(id) on delete cascade,
 base_version integer not null check(base_version>=0),
 title text not null check(length(btrim(title)) between 1 and 150),
 body text not null check(length(btrim(body)) between 1 and 20000),
 keep_slots smallint[] not null default '{}',
 files jsonb not null check(jsonb_typeof(files)='array' and jsonb_array_length(files)<=2),
 applied_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(keep_slots <@ array[0,1]::smallint[] and cardinality(keep_slots)+jsonb_array_length(files)<=2)
);
create index community_post_edits_post_idx on prayer_app.community_post_edits(post_id);
create index community_post_edits_author_created_idx on prayer_app.community_post_edits(author_user_id,created_at);
create table prayer_app.community_edit_chunks (
 edit_id uuid not null references prayer_app.community_post_edits(id) on delete cascade,
 slot smallint not null check(slot in (0,1)),
 chunk_index smallint not null check(chunk_index between 0 and 11),
 data bytea not null check(octet_length(data) between 1 and 524288),
 primary key(edit_id,slot,chunk_index)
);
alter table prayer_app.community_post_edits enable row level security;
create policy deny_non_backend_access on prayer_app.community_post_edits as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.community_post_edits from public,anon,authenticated;
alter table prayer_app.community_edit_chunks enable row level security;
create policy deny_non_backend_access on prayer_app.community_edit_chunks as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.community_edit_chunks from public,anon,authenticated;
