-- Supabase-only setup, AFTER drizzle migrations and private production_origin configuration.
-- Do not place this in drizzle/: local disposable Postgres does not provide these extensions.
-- Secret is generated inside the database, stored in Vault, and never printed.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
do $$
declare token text; token_id uuid; origin text;
begin
 select production_origin into origin from prayer_app.email_notification_settings where id=1;
 if origin is null or origin !~ '^https://[A-Za-z0-9.-]+(:[0-9]+)?$' then raise exception 'Configure the exact production origin first'; end if;
 select id into token_id from vault.secrets where name='56love_submission_email_dispatch' limit 1;
 if token_id is null then
   token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
   perform vault.create_secret(token,'56love_submission_email_dispatch','Private submission email worker bearer; never expose in logs');
 else
   select decrypted_secret into token from vault.decrypted_secrets where id=token_id;
 end if;
 update prayer_app.email_notification_settings set dispatch_secret_hash=encode(sha256(convert_to(token,'UTF8')),'hex'),updated_at=now() where id=1;
end;
$$;
create or replace function prayer_app.wake_submission_email() returns void
language plpgsql set search_path='' as $$
declare cfg prayer_app.email_notification_settings%rowtype; token text;
begin
 perform prayer_app.maintain_submission_email();
 select * into cfg from prayer_app.email_notification_settings where id=1;
 if cfg.refresh_token_ciphertext is null or cfg.google_email is distinct from cfg.recipient then return; end if;
 if not exists(select 1 from prayer_app.email_notification_outbox where status in ('pending','retry') and attempts<5 and not_before<=now()
   and generation=cfg.generation and recipient=cfg.recipient and (kind='test' or (cfg.enabled and cfg.verified_at is not null))) then return; end if;
 select decrypted_secret into token from vault.decrypted_secrets where name='56love_submission_email_dispatch' limit 1;
 if token is null then return; end if;
 perform net.http_post(url:=cfg.production_origin||'/api/internal/email-notifications',
   headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=55000);
end;
$$;
revoke all on function prayer_app.wake_submission_email() from public,anon,authenticated;
select cron.schedule('56love-submission-email','* * * * *','select prayer_app.wake_submission_email();');
