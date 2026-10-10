-- Additive, private receipt-email state. No historical submissions are backfilled.
create table prayer_app.email_notification_settings (
  id integer primary key check (id=1),
  recipient text not null default '',
  production_origin text not null default '',
  enabled boolean not null default false,
  enabled_at timestamptz,
  generation integer not null default 1,
  refresh_token_ciphertext text,
  google_email text,
  token_client_id text,
  connected_by uuid references prayer_app.users(id) on delete set null,
  connected_at timestamptz,
  verified_at timestamptz,
  dispatch_secret_hash varchar(64),
  last_test_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now(),
  check (length(recipient)<=254),
  check (generation>0)
);
insert into prayer_app.email_notification_settings(id) values(1);
create table prayer_app.email_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('pastoral','visit','prayer','test')),
  source_id uuid not null,
  generation integer not null,
  recipient text,
  sam_label text,
  requester_name text,
  visit_date date,
  visit_time text,
  status text not null default 'pending' check (status in ('pending','leased','sending','retry','sent','failed','unknown','cancelled')),
  attempts integer not null default 0,
  not_before timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique(kind,source_id),
  check (attempts>=0 and attempts<=5)
);
create index email_outbox_pending_idx on prayer_app.email_notification_outbox(not_before,created_at) where status in ('pending','retry');
create index email_outbox_retention_idx on prayer_app.email_notification_outbox(created_at);
create table prayer_app.email_oauth_states (
  state_hash varchar(64) primary key,
  admin_id uuid not null references prayer_app.users(id) on delete cascade,
  session_hash varchar(64) not null,
  generation integer not null,
  verifier_ciphertext text not null,
  expires_at timestamptz not null
);
create index email_oauth_expiry_idx on prayer_app.email_oauth_states(expires_at);
alter table prayer_app.email_notification_settings enable row level security;
alter table prayer_app.email_notification_outbox enable row level security;
alter table prayer_app.email_oauth_states enable row level security;
revoke all on prayer_app.email_notification_settings,prayer_app.email_notification_outbox,prayer_app.email_oauth_states from public,anon,authenticated;
create policy email_settings_deny on prayer_app.email_notification_settings as restrictive for all to anon,authenticated using(false) with check(false);
create policy email_outbox_deny on prayer_app.email_notification_outbox as restrictive for all to anon,authenticated using(false) with check(false);
create policy email_oauth_deny on prayer_app.email_oauth_states as restrictive for all to anon,authenticated using(false) with check(false);

create function prayer_app.cancel_submission_email(source_kind text, source_uuid uuid) returns void
language sql set search_path='' as $$
 update prayer_app.email_notification_outbox set status='cancelled',recipient=null,sam_label=null,requester_name=null,visit_date=null,visit_time=null,
   lease_token=null,lease_until=null,finished_at=now(),error_code=null
 where kind=source_kind and source_id=source_uuid and status in ('pending','retry','leased','failed','unknown');
$$;
create function prayer_app.capture_submission_email() returns trigger
language plpgsql set search_path='' as $$
declare
 cfg prayer_app.email_notification_settings%rowtype;
 source_kind text := TG_ARGV[0];
 who uuid;
 sam_text text;
 name_text text;
 day_value date;
 time_text text;
begin
 if TG_OP='DELETE' then
   perform prayer_app.cancel_submission_email(source_kind,OLD.id);
   return OLD;
 end if;
 -- Keep table-specific record fields inside their own branch.
 if source_kind='visit' then
   if NEW.status='cancelled' then
     perform prayer_app.cancel_submission_email(source_kind,NEW.id);
     return NEW;
   end if;
 end if;
 -- LOCAL is set by the server transaction wrapper, never from browser input.
 -- Preview/CI writes to a shared DB must not enqueue live notifications.
 if coalesce(current_setting('prayer_app.email_capture',true),'') <> 'production' then return NEW; end if;
 if source_kind='pastoral' then
   if TG_OP<>'UPDATE' then return NEW; end if;
   if OLD.submitted_at is not null or NEW.submitted_at is null then return NEW; end if;
   sam_text:=NEW.sam_name; name_text:=NEW.submitted_by;
 elsif source_kind='prayer' then
   if TG_OP<>'INSERT' then return NEW; end if;
   who:=NEW.user_id;
 elsif source_kind='visit' then
   if TG_OP<>'UPDATE' then return NEW; end if;
   if OLD.google_event_id is not null or NEW.google_event_id is null or NEW.calendar_sync_status<>'synced' or NEW.status<>'requested' then return NEW; end if;
   who:=NEW.requester_user_id;day_value:=NEW.visit_date;
   -- Never copy arbitrary preferred-time notes into the outbox.
   if length(NEW.preferred_time)<=30 and (btrim(NEW.preferred_time) ~ '^([0-9]{1,2}):([0-9]{2})(:00)?$'
     or btrim(NEW.preferred_time) ~ '^(오전|오후)[[:space:]]*[0-9]{1,2}[[:space:]]*시([[:space:]]*[0-9]{1,2}[[:space:]]*분)?$') then time_text:=btrim(NEW.preferred_time); end if;
 else return NEW;
 end if;
 select * into cfg from prayer_app.email_notification_settings where id=1;
 if not cfg.enabled or cfg.verified_at is null or cfg.refresh_token_ciphertext is null or cfg.recipient='' or cfg.google_email is distinct from cfg.recipient then return NEW; end if;
 if cfg.enabled_at is not null and NEW.created_at<cfg.enabled_at then return NEW; end if;
 if who is not null then
   select u.display_name,coalesce(nullif(r.sam_label,''),s.name) into name_text,sam_text
   from prayer_app.users u left join prayer_app.member_roster r on r.id=u.roster_id left join prayer_app.sams s on s.id=u.sam_id where u.id=who;
 end if;
 if name_text is null then return NEW; end if;
 insert into prayer_app.email_notification_outbox(kind,source_id,generation,recipient,sam_label,requester_name,visit_date,visit_time)
 values(source_kind,NEW.id,cfg.generation,cfg.recipient,left(sam_text,100),left(name_text,80),day_value,time_text)
 on conflict(kind,source_id) do nothing;
 return NEW;
end;
$$;
create trigger pastoral_receipt_email after update or delete on prayer_app.pastoral_reports for each row execute function prayer_app.capture_submission_email('pastoral');
create trigger prayer_receipt_email after insert or delete on prayer_app.prayer_requests for each row execute function prayer_app.capture_submission_email('prayer');
create trigger visit_receipt_email after update or delete on prayer_app.visit_requests for each row execute function prayer_app.capture_submission_email('visit');

create function prayer_app.email_settings_changed() returns trigger
language plpgsql set search_path='' as $$
begin
 if NEW.generation<>OLD.generation or NEW.recipient<>OLD.recipient or (OLD.enabled and not NEW.enabled) then
   update prayer_app.email_notification_outbox set status='cancelled',recipient=null,sam_label=null,requester_name=null,visit_date=null,visit_time=null,
     lease_token=null,lease_until=null,finished_at=now(),error_code=null where status in ('pending','retry','leased','failed','unknown');
 end if;
 if NEW.generation<>OLD.generation or NEW.recipient<>OLD.recipient then delete from prayer_app.email_oauth_states; end if;
 return NEW;
end;
$$;
create trigger email_settings_cancel after update on prayer_app.email_notification_settings for each row execute function prayer_app.email_settings_changed();
create function prayer_app.maintain_submission_email() returns void
language plpgsql set search_path='' as $$
begin
 delete from prayer_app.email_oauth_states where expires_at<now();
 update prayer_app.email_notification_outbox set status=case when attempts<5 then 'retry' else 'failed' end,
   lease_token=null,lease_until=null,error_code='WORKER_INTERRUPTED',not_before=now(),finished_at=case when attempts>=5 then now() else null end
 where status='leased' and lease_until<now();
 update prayer_app.email_notification_outbox set status='unknown',lease_token=null,lease_until=null,error_code='DELIVERY_UNKNOWN',finished_at=now()
 where status='sending' and lease_until<now();
 update prayer_app.email_notification_outbox set status=case when status in ('pending','retry','leased') then 'cancelled' else status end,
   recipient=null,sam_label=null,requester_name=null,visit_date=null,visit_time=null,lease_token=null,lease_until=null,
   finished_at=coalesce(finished_at,now()) where created_at<now()-interval '7 days' and status<>'sending';
 delete from prayer_app.email_notification_outbox where created_at<now()-interval '30 days' and status not in ('sending','leased');
end;
$$;
revoke all on function prayer_app.cancel_submission_email(text,uuid),prayer_app.capture_submission_email(),prayer_app.email_settings_changed(),prayer_app.maintain_submission_email() from public,anon,authenticated;
