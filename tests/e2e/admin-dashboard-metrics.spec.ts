import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { encryptRosterPhone } from "../../src/features/roster/crypto";
import { hashPhonePassword, normalizeName, phoneLookupHash } from "../../src/features/auth/crypto";
import { seoulToday } from "../../src/features/pastoral/policy";
import { e2eAccounts } from "../fixtures/e2e-data";
import { login, expectNoOverflow } from "./helpers";

function disposableDb() {
  const url=new URL(process.env.DATABASE_URL ?? "");
  if(process.env.CI!=="true" || !["localhost","127.0.0.1"].includes(url.hostname) || url.pathname!=="/prayer_e2e") throw new Error("DISPOSABLE_DATABASE_REQUIRED");
  return postgres(url.toString(),{ssl:"require",prepare:false,max:1});
}
const form = (other="") => ({noMeeting:false,noMeetingReason:"",meetings:[],sharing:[],news:[],leaderPrayer:"",other});

test.describe("administrator metrics and review lifecycle",()=>{
  test.skip(process.env.E2E_DATABASE_READY!=="1","Disposable TLS CI database required");

  test("registered/precreated is inactive until successful login; login is independent of prayer and survives logout",async({page,browser,baseURL})=>{
    const db=disposableDb();const rosterId=randomUUID(), userId=randomUUID(), samId=randomUUID();
    const name="로그인집계검증",phone="01000000741";
    const member=await browser.newContext({baseURL});
    try {
      await login(page,"admin");
      const before=await (await page.request.get("/api/admin/dashboard")).json();
      await db`insert into prayer_app.sams(id,name,leader_name) values(${samId},'988-1','')`;
      const lookup=phoneLookupHash(phone);
      await db`insert into prayer_app.member_roster(id,source_name,canonical_name,phone_lookup_hash,phone_ciphertext,village,sam,sam_label,source)
        values(${rosterId},${name},${name},${lookup},${encryptRosterPhone(phone)},'988','1','988-1','manual')`;
      // A bootstrap/import can create a user without this person ever logging in.
      await db`insert into prayer_app.users(id,roster_id,display_name,normalized_name,phone_lookup_hash,phone_password_hash,sam_id)
        values(${userId},${rosterId},${name},${normalizeName(name)},${lookup},${await hashPhonePassword(phone)},${samId})`;
      const listed=async()=> (await (await page.request.get(`/api/admin/roster?q=${encodeURIComponent(name)}`)).json()).rows;
      expect((await listed())[0].joined).toBe(false);
      const registered=await (await page.request.get("/api/admin/dashboard")).json();
      expect(registered.users).toEqual({registered:before.users.registered+1,active:before.users.active});
      expect(registered.prayer.participants).toBe(before.prayer.participants);
      expect((await member.request.post("/api/auth/login",{data:{name,password:"incorrect"}})).status()).toBe(401);
      expect((await listed())[0].joined).toBe(false);
      expect((await member.request.post("/api/auth/login",{data:{name,password:phone}})).status()).toBe(200);
      expect((await member.request.get("/api/profile")).status()).toBe(200);
      expect((await listed())[0].joined).toBe(true);
      const [first]=await db`select first_login_at from prayer_app.users where id=${userId}`;
      expect(first.first_login_at).not.toBeNull();
      const active=await (await page.request.get("/api/admin/dashboard")).json();
      expect(active.users.active).toBe(before.users.active+1);
      expect(active.prayer.participants).toBe(before.prayer.participants);
      const participants=await (await page.request.get("/api/admin/prayer")).json();
      expect(participants.members.some((r:{userId:string})=>r.userId===userId)).toBe(false);
      expect((await member.request.post("/api/auth/logout")).status()).toBe(200);
      expect((await listed())[0].joined).toBe(true);
      expect((await member.request.post("/api/auth/login",{data:{name,password:phone}})).status()).toBe(200);
      expect((await db`select first_login_at from prayer_app.users where id=${userId}`)[0].first_login_at).toEqual(first.first_login_at);
      // Permission to log in is separate from the historical activity label.
      await db`update prayer_app.users set is_active=false where id=${userId}`;
      await db`update prayer_app.member_roster set is_active=false where id=${rosterId}`;
      expect((await listed())[0]).toMatchObject({joined:true,isActive:false});
      expect((await (await page.request.get("/api/admin/dashboard")).json()).users.active).toBe(active.users.active);
      await page.goto("/admin/users");
      await page.locator("summary",{hasText:"사용자 명단"}).click();
      await page.getByLabel("허용 명단 검색").fill(name);
      await page.getByRole("button",{name:"검색",exact:true}).click();
      await expect(page.locator(".roster-row").filter({hasText:name})).toContainText("활성 · 로그인 제한");
      await expect(page.getByRole("option",{name:"활성",exact:true})).toHaveCount(1);
      await expect(page.getByRole("option",{name:"비활성",exact:true})).toHaveCount(1);
    } finally {
      await member.close();
      await db`delete from prayer_app.users where id=${userId}`;
      await db`delete from prayer_app.member_roster where id=${rosterId}`;
      await db`delete from prayer_app.sams where id=${samId}`;
      await db.end();
    }
  });

  test("recent activities are newest first, ten per page, selectable and private",async({page,request},info)=>{
    const db=disposableDb();const ids=Array.from({length:23},()=>randomUUID());
    try {
      await login(page,"admin");
      for(let i=0;i<ids.length;i++)await db`insert into prayer_app.notices(id,title,body,status,author_user_id,published_at)
        values(${ids[i]},${`집계활동${String(i).padStart(2,'0')}`},'PRIVATE_ACTIVITY_BODY','published',${e2eAccounts.admin.userId},'2099-01-01'::timestamptz + ${i}*interval '1 second')`;
      const get=async(n:number)=>{const r=await page.request.get(`/api/admin/dashboard?page=${n}`);expect(r.status()).toBe(200);expect(r.headers()['cache-control']).toContain('no-store');return r.json();};
      const first=await get(1),second=await get(2),third=await get(3);
      expect(first.recentActivity).toHaveLength(10);expect(second.recentActivity).toHaveLength(10);
      const combined=[...first.recentActivity,...second.recentActivity,...third.recentActivity].filter((r:{label:string})=>r.label.includes('집계활동'));
      expect(combined.map((r:{href:string})=>r.href)).toEqual([...ids].reverse().map(id=>`/admin/notices?id=${id}`));
      expect(JSON.stringify(first)).not.toContain('PRIVATE_ACTIVITY_BODY');
      const last=await get(100000);expect(last.activityPagination.page).toBe(last.activityPagination.pages);
      expect(last.recentActivity.length).toBeLessThanOrEqual(10);
      for(const input of ['0','-1','1.2','bad','100001'])expect((await page.request.get(`/api/admin/dashboard?page=${input}`)).status()).toBe(400);
      expect((await request.get('/api/admin/dashboard')).status()).toBe(403);
      await page.setViewportSize({width:360,height:820});await page.goto('/admin');
      const activity=page.locator('.admin-activity-list');
      await expect(activity.locator('a')).toHaveCount(10);
      await expect(activity.locator('a').first()).toContainText('집계활동22');
      const pager=page.getByRole('navigation',{name:'최근 활동 페이지'});
      await pager.getByRole('button',{name:'다음',exact:true}).click();
      await expect(pager).toContainText('2 /');await expect(activity.locator('a').first()).toContainText('집계활동12');
      await expect(activity.locator('a')).toHaveCount(10);
      await pager.getByRole('button',{name:'이전',exact:true}).click();
      await expect(activity.locator('a').first()).toContainText('집계활동22');
      await expect(page.getByText('이번 주 확정 심방',{exact:true})).toHaveCount(0);
      await expect(page.locator('.admin-summary-card').filter({hasText:'목양지 미확인'})).toBeVisible();
      await expectNoOverflow(page);await page.screenshot({path:info.outputPath('dashboard-360.png'),fullPage:true});
      await page.setViewportSize({width:1280,height:900});await expectNoOverflow(page);
      await page.screenshot({path:info.outputPath('dashboard-1280.png'),fullPage:true});
      const links=await page.getByRole('navigation',{name:'관리자 메뉴',exact:true}).getByRole('link').allTextContents();
      expect(links.indexOf('공지 관리')).toBeLessThan(links.indexOf('기도운동 관리'));
    } finally {await db`delete from prayer_app.notices where id in ${db(ids)}`;await db.end();}
  });

  test("completed pastoral reports enter activity; only exact-version admin detail confirmation clears unread, editing restores it",async({page,browser,baseURL,request},info)=>{
    const db=disposableDb();const id=randomUUID(),draftId=randomUUID(),samId=randomUUID();
    const today=seoulToday(),year=Number(today.slice(0,4)),month=Number(today.slice(5,7));
    const member=await browser.newContext({baseURL});
    let requestId='';let createdRequest=false;let originalEnabled=true;
    try {
      await login(page,'admin');
      const getHub=async()=>{const r=await page.request.get('/api/admin/dashboard');expect(r.status()).toBe(200);return r.json();};
      const before=await getHub();
      const [existing]=await db`select id,enabled from prayer_app.pastoral_requests where year=${year} and month=${month}`;
      if(existing){requestId=existing.id;originalEnabled=existing.enabled;await db`update prayer_app.pastoral_requests set enabled=true where id=${requestId}`;}
      else {requestId=randomUUID();createdRequest=true;await db`insert into prayer_app.pastoral_requests(id,year,month) values(${requestId},${year},${month})`;}
      await db`insert into prayer_app.sams(id,name,leader_name) values(${samId},'989-1','집계리더검증')`;
      const payload={id,requestId,samId,writtenDate:today,method:'form',form:form('PRIVATE_REPORT_BODY'),files:[]};
      expect((await page.request.post('/api/pastoral/reports',{data:payload})).status()).toBe(201);
      expect((await page.request.post('/api/pastoral/reports',{data:{...payload,id:draftId}})).status()).toBe(201);
      expect((await getHub()).pastoral.unreviewed).toBe(before.pastoral.unreviewed);
      expect((await page.request.post(`/api/admin/pastoral/reports/${id}/review`,{data:{expectedVersion:0}})).status()).toBe(409);
      expect((await page.request.post(`/api/pastoral/reports/${id}/publish`)).status()).toBe(200);
      const submitted=await getHub();expect(submitted.pastoral.unreviewed).toBe(before.pastoral.unreviewed+1);
      expect(submitted.recentActivity.some((r:{kind:string;href:string})=>r.kind==='pastoral_report' && r.href.endsWith(id))).toBe(true);
      expect(JSON.stringify(submitted)).not.toContain('PRIVATE_REPORT_BODY');
      const detail=async()=> (await (await page.request.get(`/api/pastoral/reports/${id}`)).json()).report;
      expect((await detail()).isReviewed).toBe(false);
      expect((await page.request.get(`/api/pastoral/reports/${id}/txt`)).status()).toBe(200);
      expect((await detail()).isReviewed).toBe(false); // GET/download/list are read-only.
      const endpoint=`/api/admin/pastoral/reports/${id}/review`;
      expect((await request.post(endpoint,{data:{expectedVersion:0}})).status()).toBe(403);
      expect((await member.request.post('/api/auth/login',{data:{name:e2eAccounts.member.name,password:e2eAccounts.member.phone}})).status()).toBe(200);
      expect((await member.request.post(endpoint,{data:{expectedVersion:0}})).status()).toBe(403);
      expect((await page.request.post(endpoint,{headers:{origin:'https://invalid.example'},data:{expectedVersion:0}})).status()).toBe(403);
      expect((await page.request.post(endpoint,{data:{expectedVersion:-1}})).status()).toBe(400);
      const immutable=await db`select form,files,submitted_at,version,author_user_id from prayer_app.pastoral_reports where id=${id}`;
      // Simulate acknowledgement failing: details remain readable and dashboard remains unread.
      await page.route(`**${endpoint}`,r=>r.fulfill({status:503,json:{code:'PASTORAL_UNAVAILABLE'}}));
      await page.goto(`/admin/pastoral-reports?id=${id}`);
      await expect(page.locator('.pastoral-detail')).toContainText('PRIVATE_REPORT_BODY');
      await expect(page.getByRole('button',{name:'확인 다시 저장',exact:true})).toBeVisible();
      expect((await getHub()).pastoral.unreviewed).toBe(submitted.pastoral.unreviewed);
      await page.unroute(`**${endpoint}`);
      await page.getByRole('button',{name:'확인 다시 저장',exact:true}).click();
      await expect(page.locator('.pastoral-detail')).toContainText('관리자 확인 완료');
      expect((await getHub()).pastoral.unreviewed).toBe(before.pastoral.unreviewed);
      const review=await db`select reviewed_version,reviewed_at,reviewed_by from prayer_app.pastoral_reports where id=${id}`;
      expect((await page.request.post(endpoint,{data:{expectedVersion:0}})).status()).toBe(200);
      expect(await db`select reviewed_version,reviewed_at,reviewed_by from prayer_app.pastoral_reports where id=${id}`).toEqual(review);
      expect(await db`select form,files,submitted_at,version,author_user_id from prayer_app.pastoral_reports where id=${id}`).toEqual(immutable);
      const editId=randomUUID();
      expect((await page.request.post(`/api/admin/pastoral/reports/${id}/edits`,{data:{id:editId,expectedVersion:0,writtenDate:today,method:'form',form:form('REVISED_PRIVATE_BODY'),files:[],keepSlots:[]}})).status()).toBe(201);
      expect((await page.request.post(`/api/admin/pastoral/reports/${id}/edits/${editId}/publish`)).status()).toBe(200);
      expect((await detail()).isReviewed).toBe(false);
      expect((await getHub()).pastoral.unreviewed).toBe(before.pastoral.unreviewed+1);
      expect((await page.request.post(endpoint,{data:{expectedVersion:0}})).status()).toBe(409);
      expect((await detail()).isReviewed).toBe(false);
      await page.goto('/admin/pastoral-reports?unreviewed=1');
      const history=page.locator('.pastoral-history');
      await expect(history.getByRole('checkbox',{name:'미확인 목양지만 보기'})).toBeChecked();
      await history.getByRole('button',{name:/989-1.*목양지 보기/}).click();
      await expect(page.locator('.pastoral-detail')).toContainText('REVISED_PRIVATE_BODY');
      await expect(page.locator('.pastoral-detail')).toContainText('관리자 확인 완료');
      await expect(page.locator('.pastoral-detail').getByText('제출일시',{exact:true})).toHaveCount(0);
      await expect(page.locator('.pastoral-detail').getByText('제출 방법',{exact:true})).toHaveCount(0);
      await page.setViewportSize({width:360,height:820});await expectNoOverflow(page);
      await page.screenshot({path:info.outputPath('pastoral-reviewed-360.png'),fullPage:true});
      expect((await getHub()).pastoral.unreviewed).toBe(before.pastoral.unreviewed);
      expect((await page.request.delete(`/api/admin/pastoral/reports/${id}/submission`,{data:{expectedVersion:1}})).status()).toBe(200);
      expect((await getHub()).recentActivity.some((r:{href:string})=>r.href.endsWith(id))).toBe(false);
    } finally {
      await member.close();
      await db`delete from prayer_app.pastoral_reports where id in (${id},${draftId})`;
      await db`delete from prayer_app.sams where id=${samId}`;
      if(requestId){if(createdRequest)await db`delete from prayer_app.pastoral_requests where id=${requestId}`;else await db`update prayer_app.pastoral_requests set enabled=${originalEnabled} where id=${requestId}`;}
      await db.end();
    }
  });
});
