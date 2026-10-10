import {randomUUID,createHash} from 'node:crypto';
import postgres from 'postgres';
import {test,expect} from '@playwright/test';
import {e2eAccounts} from '../fixtures/e2e-data';
function database(){const u=new URL(process.env.DATABASE_URL??'');if(process.env.CI!=='true'||!['127.0.0.1','localhost'].includes(u.hostname)||u.pathname!=='/prayer_e2e')throw new Error('DISPOSABLE_DATABASE_REQUIRED');return postgres(u.toString(),{ssl:'require',prepare:false,max:1});}
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
test.describe('receipt queue recovery and consent state',()=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable TLS DB required');
 test('expired send leases become unknown while pre-send leases can safely retry',async()=>{
  const db=database(),rollback=new Error('ROLLBACK_EMAIL_LIFECYCLE');
  try{await db.begin(async tx=>{
   const before=(await tx`select count(*)::int as n from prayer_app.email_notification_outbox`)[0].n;
   const leased=randomUUID(),sending=randomUUID(),exhausted=randomUUID(),old=randomUUID(),expired=randomUUID();
   for(const [id,status,attempts] of [[leased,'leased',1],[sending,'sending',1],[exhausted,'leased',5]] as const){
    await tx`insert into prayer_app.email_notification_outbox(id,kind,source_id,generation,recipient,requester_name,status,attempts,lease_token,lease_until)
      values(${id},'test',${id},1,'admin@example.test','가상사용자',${status},${attempts},${randomUUID()},now()-interval '1 minute')`;
   }
   await tx`insert into prayer_app.email_notification_outbox(id,kind,source_id,generation,recipient,requester_name,status,created_at)
     values(${old},'test',${old},1,'admin@example.test','가상사용자','failed',now()-interval '8 days'),
     (${expired},'test',${expired},1,'admin@example.test','가상사용자','sent',now()-interval '31 days')`;
   const stale=hash(randomUUID()),valid=hash(randomUUID());
   await tx`insert into prayer_app.email_oauth_states(state_hash,admin_id,session_hash,generation,verifier_ciphertext,expires_at)
     values(${stale},${e2eAccounts.admin.userId},${hash('session')},1,'SYNTHETIC',now()-interval '1 minute'),
     (${valid},${e2eAccounts.admin.userId},${hash('session')},1,'SYNTHETIC',now()+interval '1 minute')`;
   await tx`select prayer_app.maintain_submission_email()`;
   const result=await tx`select id,status,recipient,requester_name from prayer_app.email_notification_outbox where id in (${leased},${sending},${exhausted},${old},${expired})`;
   expect(result.find(r=>r.id===leased)?.status).toBe('retry');expect(result.find(r=>r.id===sending)?.status).toBe('unknown');
   expect(result.find(r=>r.id===exhausted)?.status).toBe('failed');expect(result.find(r=>r.id===old)).toMatchObject({recipient:null,requester_name:null});
   expect(result.some(r=>r.id===expired)).toBe(false);
   expect((await tx`select state_hash from prayer_app.email_oauth_states where state_hash in (${stale},${valid})`).map(r=>r.state_hash)).toEqual([valid]);
   // Wrong administrator/session cannot consume a state; a matching state is single use.
   expect(await tx`delete from prayer_app.email_oauth_states where state_hash=${valid} and session_hash=${hash('wrong')} returning state_hash`).toHaveLength(0);
   expect(await tx`delete from prayer_app.email_oauth_states where state_hash=${valid} and admin_id=${e2eAccounts.member.userId} returning state_hash`).toHaveLength(0);
   expect(await tx`delete from prayer_app.email_oauth_states where state_hash=${valid} and admin_id=${e2eAccounts.admin.userId} and session_hash=${hash('session')} and expires_at>now() returning state_hash`).toHaveLength(1);
   expect(await tx`delete from prayer_app.email_oauth_states where state_hash=${valid} returning state_hash`).toHaveLength(0);
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox`)[0].n).toBe(before+4);
   throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{await db.end();}
 });
 test('retention never turns an old source event into a new notification',async()=>{
  const db=database(),rollback=new Error('ROLLBACK_OLD_EMAIL_SOURCE');
  try{await db.begin(async tx=>{
   await tx`update prayer_app.email_notification_settings set enabled=true,recipient='admin@example.test',google_email='admin@example.test',refresh_token_ciphertext='SYNTHETIC',verified_at=now(),enabled_at=now()-interval '90 days' where id=1`;
   await tx`select set_config('prayer_app.email_capture','production',true)`;
   const id=randomUUID();
   await tx`insert into prayer_app.visit_requests(id,requester_user_id,visit_date,visit_type,preferred_time,reason,attendees,location,created_at)
    values(${id},${e2eAccounts.admin.userId},'2098-03-01','personal','15:00','','','',now()-interval '40 days')`;
   await tx`update prayer_app.visit_requests set google_event_id='SYNTHETIC',calendar_sync_status='synced' where id=${id}`;
   expect(await tx`select id from prayer_app.email_notification_outbox where source_id=${id}`).toHaveLength(0);
   throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{await db.end();}
 });
});
