-- Additive private community board. Existing application records are unchanged.
create table prayer_app.community_folders (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(btrim(name)) between 1 and 60),
 created_at timestamptz not null default now()
);
create unique index community_folder_name_uq on prayer_app.community_folders(lower(name));
insert into prayer_app.community_folders(name) values ('자유게시판');
create table prayer_app.community_posts (
 id uuid primary key,
 folder_id uuid not null references prayer_app.community_folders(id),
 author_user_id uuid references prayer_app.users(id) on delete set null,
 title text not null check (length(btrim(title)) between 1 and 150),
 body text not null check (length(btrim(body)) between 1 and 20000),
 published_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index community_posts_folder_published_idx on prayer_app.community_posts(folder_id,published_at desc,id);
create index community_posts_author_idx on prayer_app.community_posts(author_user_id);
create index community_posts_draft_expiry_idx on prayer_app.community_posts(created_at) where published_at is null;
create table prayer_app.community_files (
 post_id uuid not null references prayer_app.community_posts(id) on delete cascade,
 slot smallint not null check (slot in (0,1)),
 name text not null check (length(name) between 1 and 180),
 size integer not null check (size between 1 and 6291456),
 sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 primary key(post_id,slot)
);
create table prayer_app.community_file_chunks (
 post_id uuid not null,
 slot smallint not null,
 chunk_index smallint not null check(chunk_index between 0 and 11),
 data bytea not null check(octet_length(data) between 1 and 524288),
 primary key(post_id,slot,chunk_index),
 foreign key(post_id,slot) references prayer_app.community_files(post_id,slot) on delete cascade
);
create table prayer_app.community_comments (
 id uuid primary key,
 post_id uuid not null references prayer_app.community_posts(id) on delete cascade,
 author_user_id uuid references prayer_app.users(id) on delete set null,
 body text not null check(length(btrim(body)) between 1 and 2000),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index community_comments_post_created_idx on prayer_app.community_comments(post_id,created_at,id);
create index community_comments_author_idx on prayer_app.community_comments(author_user_id);
create table prayer_app.community_post_likes (
 post_id uuid not null references prayer_app.community_posts(id) on delete cascade,
 user_id uuid not null references prayer_app.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create index community_likes_user_idx on prayer_app.community_post_likes(user_id);
alter table prayer_app.community_folders enable row level security;
create policy deny_non_backend_access on prayer_app.community_folders as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.community_folders from public,anon,authenticated;
alter table prayer_app.community_posts enable row level security;
create policy deny_non_backend_access on prayer_app.community_posts as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.community_posts from public,anon,authenticated;
alter table prayer_app.community_files enable row level security;
create policy deny_non_backend_access on prayer_app.community_files as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.community_files from public,anon,authenticated;
alter table prayer_app.community_file_chunks enable row level security;
create policy deny_non_backend_access on prayer_app.community_file_chunks as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.community_file_chunks from public,anon,authenticated;
alter table prayer_app.community_comments enable row level security;
create policy deny_non_backend_access on prayer_app.community_comments as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.community_comments from public,anon,authenticated;
alter table prayer_app.community_post_likes enable row level security;
create policy deny_non_backend_access on prayer_app.community_post_likes as restrictive for all to public using(false) with check(false);
revoke all on prayer_app.community_post_likes from public,anon,authenticated;
