import {randomUUID} from 'node:crypto';
import postgres from 'postgres';
import {test,expect} from '@playwright/test';
import {e2eAccounts} from '../fixtures/e2e-data';
import {login,expectNoOverflow} from './helpers';
function disposableDb(){const url=new URL(process.env.DATABASE_URL??'');if(process.env.CI!=='true'||!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/prayer_e2e')throw new Error('DISPOSABLE_DATABASE_REQUIRED');return postgres(url.toString(),{ssl:'require',prepare:false,max:1});}
const endpoint='/api/admin/email-notifications';
test.describe('private submission email notifications',()=>{
 test.skip(process.env.E2E_DATABASE_READY!=='1','Disposable TLS CI database required');
 test('outbox captures only first completed submissions and cancels unsent metadata',async()=>{
  const db=disposableDb();const rollback=new Error('ROLLBACK_SYNTHETIC_EMAIL_TEST');
  try{await db.begin(async tx=>{
   const owner=e2eAccounts.admin.userId,prayer=randomUUID(),oldPrayer=randomUUID(),visit=randomUUID(),failedVisit=randomUUID(),report=randomUUID(),sam=randomUUID();
   const [before]=await tx`select count(*)::int as n from prayer_app.email_notification_outbox`;
   await tx`insert into prayer_app.prayer_requests(id,user_id,content) values(${oldPrayer},${owner},'PRIVATE_OLD')`;
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox`)[0].n).toBe(before.n);
   await tx`update prayer_app.email_notification_settings set recipient='admin@example.test',google_email='admin@example.test',refresh_token_ciphertext='SYNTHETIC_NOT_A_TOKEN',verified_at=now(),enabled=true,enabled_at=now()-interval '1 minute' where id=1`;
   await tx`insert into prayer_app.prayer_requests(id,user_id,content) values(${prayer},${owner},'PRIVATE_PRAYER_BODY')`;
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox where source_id=${prayer}`)[0].n).toBe(1);
   await tx`update prayer_app.prayer_requests set content='PRIVATE_CHANGED' where id=${prayer}`;
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox where source_id=${prayer}`)[0].n).toBe(1);
   await tx`insert into prayer_app.sams(id,name,leader_name) values(${sam},'987-1','알림가상리더')`;
   const [period]=await tx`insert into prayer_app.pastoral_requests(year,month) values(2097,10) on conflict(year,month) do update set enabled=true returning id`;
   await tx`insert into prayer_app.pastoral_reports(id,request_id,sam_id,author_user_id,sam_name,leader_name,submitted_by,written_date,method,form,files,fingerprint)
     values(${report},${period.id},${sam},${owner},'987-1','알림가상리더','알림가상제출자','2097-10-01','form','{"other":"PRIVATE_REPORT_BODY"}'::jsonb,'[]'::jsonb,${'0'.repeat(64)})`;
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox where source_id=${report}`)[0].n).toBe(0);
   await tx`update prayer_app.pastoral_reports set submitted_at=now() where id=${report}`;
   await tx`update prayer_app.pastoral_reports set version=version+1,form='{"other":"PRIVATE_REVISION"}'::jsonb where id=${report}`;
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox where source_id=${report}`)[0].n).toBe(1);
   await tx`insert into prayer_app.visit_requests(id,requester_user_id,visit_date,visit_type,preferred_time,reason,attendees,location) values(${failedVisit},${owner},'2097-11-01','personal','15:00','PRIVATE_VISIT_REASON','PRIVATE_ATTENDEES','PRIVATE_LOCATION')`;
   await tx`update prayer_app.visit_requests set status='cancelled',calendar_sync_status='failed' where id=${failedVisit}`;
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox where source_id=${failedVisit}`)[0].n).toBe(0);
   await tx`insert into prayer_app.visit_requests(id,requester_user_id,visit_date,visit_type,preferred_time,reason) values(${visit},${owner},'2097-11-02','personal','PRIVATE_FREE_TEXT','PRIVATE_REASON')`;
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox where source_id=${visit}`)[0].n).toBe(0);
   await tx`update prayer_app.visit_requests set google_event_id='synthetic-event',calendar_sync_status='synced' where id=${visit}`;
   const queued=await tx`select * from prayer_app.email_notification_outbox where source_id in (${prayer},${report},${visit})`;
   expect(queued).toHaveLength(3);expect(JSON.stringify(queued)).not.toContain('PRIVATE_');
   expect(queued.find(r=>r.kind==='visit')?.visit_time).toBeNull();
   await tx`delete from prayer_app.prayer_requests where id=${prayer}`;
   const [cancelled]=await tx`select status,requester_name,recipient from prayer_app.email_notification_outbox where source_id=${prayer}`;
   expect(cancelled).toEqual({status:'cancelled',requester_name:null,recipient:null});
   await tx`update prayer_app.email_notification_settings set enabled=false where id=1`;
   expect((await tx`select count(*)::int as n from prayer_app.email_notification_outbox where source_id in (${report},${visit}) and status='cancelled' and requester_name is null`)[0].n).toBe(2);
   const boundaries=await tx`select relname,relrowsecurity from pg_class join pg_namespace n on n.oid=relnamespace where n.nspname='prayer_app' and relname in ('email_notification_settings','email_notification_outbox','email_oauth_states')`;
   expect(boundaries).toHaveLength(3);expect(boundaries.every(r=>r.relrowsecurity)).toBe(true);
   for(const table of ['email_notification_settings','email_notification_outbox','email_oauth_states']){
     const [permissions]=await tx`select has_table_privilege('anon',${'prayer_app.'+table},'select') as anon,has_table_privilege('authenticated',${'prayer_app.'+table},'update') as member`;
     expect(permissions).toEqual({anon:false,member:false});
   }
   throw rollback;
  });}catch(error){if(error!==rollback)throw error;}finally{await db.end();}
 });
 test('admin status is private and preview cannot connect, enable, test or dispatch real mail',async({page,request})=>{
  expect((await request.get(endpoint)).status()).toBe(403);
  await login(page,'member');expect((await page.request.get(endpoint)).status()).toBe(403);
  await page.request.post('/api/auth/logout');await login(page,'admin');
  const status=await page.request.get(endpoint);expect(status.status()).toBe(200);expect(status.headers()['cache-control']).toContain('no-store');
  const data=await status.json();expect(data.production).toBe(false);expect(data).not.toHaveProperty('refreshTokenCiphertext');
  for(const action of ['connect','test','disconnect'])expect((await page.request.post(endpoint,{data:{action}})).status()).toBe(403);
  expect((await page.request.put(endpoint,{data:{recipient:'admin@example.test',enabled:true}})).status()).toBe(403);
  expect((await request.post('/api/internal/email-notifications',{headers:{authorization:'Bearer not-a-real-token'}})).status()).toBe(403);
 });
 test('dashboard notification panel has explicit approval and save controls on mobile',async({page},info)=>{
  await login(page,'admin');
  const status={recipient:'admin@example.test',enabled:false,connected:true,googleEmail:'admin@example.test',verified:true,configured:true,production:true,counts:{pending:0,sent:0,failed:0,unknown:0},lastError:null};
  await page.route(`**${endpoint}`,async route=>{if(route.request().method()==='PUT'){const body=route.request().postDataJSON();expect(body).toEqual({recipient:'admin@example.test',enabled:true});status.enabled=true;}await route.fulfill({status:200,json:status});});
  await page.setViewportSize({width:360,height:820});await page.goto('/admin');
  const panel=page.locator('#email-notifications');await panel.locator('summary').click();
  await expect(panel.getByLabel('알림 받을 이메일')).toHaveValue('admin@example.test');
  await expect(panel).toContainText('기도제목');await expect(panel).toContainText('심방 사유');
  await panel.getByLabel('접수 이메일 알림 사용').check();await panel.getByRole('button',{name:'알림 설정 저장',exact:true}).click();
  await expect(panel).toContainText('저장했습니다');await expectNoOverflow(page);
  await page.screenshot({path:info.outputPath('email-panel-360.png'),fullPage:true});
 });
});
