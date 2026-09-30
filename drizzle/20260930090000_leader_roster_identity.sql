-- Add stable roster references without copying secrets or changing member/report records.
alter table prayer_app.sams
  add column leader_roster_id uuid references prayer_app.member_roster(id) on delete set null,
  add column leader_binding_locked boolean not null default false;
alter table prayer_app.village_leaders
  add column leader_roster_id uuid references prayer_app.member_roster(id) on delete set null,
  add column leader_binding_locked boolean not null default false;
create index sams_leader_roster_idx on prayer_app.sams(leader_roster_id) where leader_roster_id is not null;
create index village_leaders_roster_idx on prayer_app.village_leaders(leader_roster_id) where leader_roster_id is not null;

-- Session-local helpers mirror the pure policy. No public/RLS-bypassing function is installed.
create function pg_temp.leader_name_key(value text) returns text language sql immutable as $$
 select regexp_replace(regexp_replace(btrim(normalize(coalesce(value,''),NFC)), '\s*(\(|\[)?(담임목사|부목사|목사|전도사|장로|권사|안수집사|집사|성도)(님)?(\)|\])?$','','g'),'\s+','','g');
$$;
create function pg_temp.leader_scope_key(value text) returns text language sql immutable as $$
 select string_agg(case when part ~ '^[0-9]+$' then coalesce(nullif(ltrim(part,'0'),''),'0') else part end,'-' order by n)
 from unnest(string_to_array(regexp_replace(regexp_replace(regexp_replace(normalize(coalesce(value,''),NFC),'\s+','','g'),'마을-?','-','g'),'샘$',''),'-')) with ordinality as p(part,n);
$$;
create function pg_temp.leader_village_key(value text) returns text language sql immutable as $$
 select pg_temp.leader_scope_key(regexp_replace(regexp_replace(coalesce(value,''),'\s+','','g'),'마을$',''));
$$;

with candidates as (
 select s.id,count(r.id) as total,(array_agg(r.id))[1] as roster_id
 from prayer_app.sams s join prayer_app.member_roster r on r.is_active
 and pg_temp.leader_name_key(s.leader_name) in (pg_temp.leader_name_key(r.source_name),pg_temp.leader_name_key(r.canonical_name))
 where s.leader_name<>'' group by s.id
)
update prayer_app.sams s set leader_roster_id=c.roster_id,leader_binding_locked=true
from candidates c,prayer_app.member_roster r
where s.id=c.id and c.total=1 and r.id=c.roster_id
and pg_temp.leader_scope_key(s.name)=pg_temp.leader_scope_key(r.sam_label);

with candidates as (
 select h.id,count(r.id) as total,(array_agg(r.id))[1] as roster_id
 from prayer_app.village_leaders h join prayer_app.member_roster r on r.is_active
 and pg_temp.leader_name_key(h.leader_name) in (pg_temp.leader_name_key(r.source_name),pg_temp.leader_name_key(r.canonical_name))
 group by h.id
)
update prayer_app.village_leaders h set leader_roster_id=c.roster_id,leader_binding_locked=true
from candidates c,prayer_app.member_roster r
where h.id=c.id and c.total=1 and r.id=c.roster_id
and h.village=pg_temp.leader_village_key(r.village);

-- Public clients remain unable to read or alter role assignments, even column-by-column.
revoke all on prayer_app.sams,prayer_app.village_leaders from anon,authenticated;
