import {randomUUID} from "node:crypto";
import {getDb,rows,sql,type Executor} from "../pastoral/db";
import {getEnv} from "../../lib/env";
import {DomainError} from "../../lib/http";
import {normalizeRecipient,runtimeAllowed,type NotificationKind} from "./policy";

export type EmailSettings={id:number;recipient:string;production_origin:string;enabled:boolean;enabled_at:Date|null;generation:number;refresh_token_ciphertext:string|null;google_email:string|null;token_client_id:string|null;connected_by:string|null;connected_at:Date|null;verified_at:Date|null;dispatch_secret_hash:string|null;last_test_at:Date|null;last_error:string|null};
export type EmailJob={id:string;kind:NotificationKind;source_id:string;generation:number;recipient:string;sam_label:string|null;requester_name:string|null;visit_date:string|null;visit_time:string|null;attempts:number;lease_token:string;created_at:Date};
export function emailConfig(){
 const env=getEnv();
 if(!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_CLIENT_SECRET || !env.ROSTER_ENCRYPTION_KEY)throw new DomainError("EMAIL_NOT_CONFIGURED",503);
 return {clientId:env.GOOGLE_OAUTH_CLIENT_ID,clientSecret:env.GOOGLE_OAUTH_CLIENT_SECRET,key:env.ROSTER_ENCRYPTION_KEY};
}
export async function getEmailSettings(db:Executor=getDb(),lock=false):Promise<EmailSettings>{
 const [setting]=await rows<EmailSettings>(db,sql`select * from prayer_app.email_notification_settings where id=1 ${lock?sql`for update`:sql``}`);
 if(!setting)throw new DomainError("EMAIL_NOT_CONFIGURED",503);
 return setting;
}
export function requireEmailProduction(origin:string,setting:EmailSettings){
 if(!runtimeAllowed(process.env,origin,setting.production_origin))throw new DomainError("EMAIL_PRODUCTION_REQUIRED",403);
}
export async function emailStatus(origin:string){
 const db=getDb(),s=await getEmailSettings(db);
 let clientId:string|null=null;try{clientId=emailConfig().clientId;}catch{/* Report configuration absence, never credentials. */}
 const connected=Boolean(s.refresh_token_ciphertext && s.google_email===s.recipient && clientId===s.token_client_id && s.connected_by);
 const counts={pending:0,sent:0,failed:0,unknown:0};
 for(const row of await rows<{status:string;n:number}>(db,sql`select status,count(*)::int as n from prayer_app.email_notification_outbox group by status`)){
  if(["pending","retry","leased","sending"].includes(row.status))counts.pending+=row.n;
  else if(row.status==="sent" || row.status==="failed" || row.status==="unknown")counts[row.status]+=row.n;
 }
 return {recipient:s.recipient,enabled:s.enabled,connected,googleEmail:s.google_email,verified:connected&&Boolean(s.verified_at),configured:clientId!==null,
   production:runtimeAllowed(process.env,origin,s.production_origin),counts,lastError:s.last_error};
}
export async function saveEmailSettings(origin:string,recipientInput:unknown,enabled:unknown){
 let recipient:string;try{recipient=normalizeRecipient(recipientInput);}catch{throw new DomainError("INVALID_EMAIL_RECIPIENT",400);}
 if(typeof enabled!=="boolean")throw new DomainError("INVALID_EMAIL_SETTING",400);
 await getDb().transaction(async tx=>{
  const s=await getEmailSettings(tx,true);requireEmailProduction(origin,s);
  const changed=recipient!==s.recipient;
  if(enabled && (changed || !s.refresh_token_ciphertext || !s.verified_at || s.google_email!==recipient || s.token_client_id!==emailConfig().clientId))throw new DomainError("EMAIL_VERIFICATION_REQUIRED",409);
  if(changed){
   await tx.execute(sql`update prayer_app.email_notification_settings set recipient=${recipient},enabled=false,enabled_at=null,generation=generation+1,
     refresh_token_ciphertext=null,google_email=null,token_client_id=null,connected_by=null,connected_at=null,verified_at=null,last_error=null,last_test_at=null,updated_at=now() where id=1`);
  }else await tx.execute(sql`update prayer_app.email_notification_settings set enabled=${enabled},enabled_at=case when ${enabled} and not enabled then now() else enabled_at end,updated_at=now() where id=1`);
 });
 return emailStatus(origin);
}
export async function disconnectEmail(origin:string){
 await getDb().transaction(async tx=>{
  const s=await getEmailSettings(tx,true);requireEmailProduction(origin,s);
  // Do not revoke the whole Google grant: Calendar uses the same OAuth client independently.
  await tx.execute(sql`update prayer_app.email_notification_settings set enabled=false,enabled_at=null,generation=generation+1,refresh_token_ciphertext=null,
    google_email=null,token_client_id=null,connected_by=null,connected_at=null,verified_at=null,last_error=null,last_test_at=null,updated_at=now() where id=1`);
 });
}
export async function enqueueVerificationEmail(origin:string){
 return getDb().transaction(async tx=>{
  const s=await getEmailSettings(tx,true);requireEmailProduction(origin,s);
  if(!s.refresh_token_ciphertext || s.google_email!==s.recipient || s.token_client_id!==emailConfig().clientId || !s.connected_by)throw new DomainError("GMAIL_CONNECT_REQUIRED",409);
  if(s.last_test_at && Date.now()-new Date(s.last_test_at).getTime()<60_000)throw new DomainError("EMAIL_TEST_WAIT",429);
  const pending=await rows(tx,sql`select id from prayer_app.email_notification_outbox where kind='test' and generation=${s.generation} and status in ('pending','retry','leased','sending') limit 1`);
  if(pending.length)throw new DomainError("EMAIL_TEST_WAIT",429);
  const id=randomUUID();
  await tx.execute(sql`insert into prayer_app.email_notification_outbox(id,kind,source_id,generation,recipient) values(${id}::uuid,'test',${id}::uuid,${s.generation},${s.recipient})`);
  await tx.execute(sql`update prayer_app.email_notification_settings set last_test_at=now(),last_error=null,updated_at=now() where id=1`);
  return id;
 });
}
export async function claimEmail(origin:string):Promise<{job:EmailJob;settings:EmailSettings}|null>{
 return getDb().transaction(async tx=>{
  const s=await getEmailSettings(tx);requireEmailProduction(origin,s);
  if(!s.refresh_token_ciphertext || s.google_email!==s.recipient || s.token_client_id!==emailConfig().clientId)return null;
  const [job]=await rows<EmailJob>(tx,sql`select o.*,o.visit_date::text as visit_date from prayer_app.email_notification_outbox o
    where o.generation=${s.generation} and o.recipient=${s.recipient} and o.status in ('pending','retry') and o.not_before<=now() and o.attempts<5
      and (o.kind='test' or (${s.enabled} and ${Boolean(s.verified_at)}))
      and exists(select 1 from prayer_app.users where id=${s.connected_by}::uuid and role='admin' and is_active=true)
    order by case when o.kind='test' then 0 else 1 end,o.created_at,o.id limit 1 for update of o skip locked`);
  if(!job)return null;
  const lease=randomUUID();
  await tx.execute(sql`update prayer_app.email_notification_outbox set status='leased',attempts=attempts+1,lease_token=${lease}::uuid,lease_until=now()+interval '2 minutes' where id=${job.id}::uuid`);
  return {job:{...job,attempts:job.attempts+1,lease_token:lease},settings:s};
 });
}
export async function beginEmailSend(origin:string,job:EmailJob):Promise<boolean>{
 return getDb().transaction(async tx=>{
  const s=await getEmailSettings(tx,true);requireEmailProduction(origin,s);
  if(s.generation!==job.generation || s.recipient!==job.recipient || s.google_email!==job.recipient || !s.refresh_token_ciphertext || s.token_client_id!==emailConfig().clientId || (job.kind!=="test"&&(!s.enabled||!s.verified_at)))return false;
  const result=await rows(tx,sql`update prayer_app.email_notification_outbox set status='sending'
    where id=${job.id}::uuid and status='leased' and lease_token=${job.lease_token}::uuid and lease_until>now()
    and exists(select 1 from prayer_app.users where id=${s.connected_by}::uuid and role='admin' and is_active=true) returning id`);
  return result.length===1;
 });
}
