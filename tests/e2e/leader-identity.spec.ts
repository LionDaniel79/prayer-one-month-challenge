import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import * as XLSX from "xlsx";
import { expect, test, type Page } from "@playwright/test";
import { encryptRosterPhone } from "../../src/features/roster/crypto";
import { phoneLookupHash } from "../../src/features/auth/crypto";
import { login, expectNoOverflow } from "./helpers";

const resolve="/api/admin/sams/resolve-leader", heads="/api/admin/sams/village-leaders";
test.describe("stable leader roster identity",()=>{
  test.skip(process.env.E2E_DATABASE_READY!=="1","Requires disposable TLS DB");
  let db:ReturnType<typeof postgres>;
  const samId=randomUUID(),uniqueSam=randomUUID();
  const a={id:randomUUID(),source:"동명검증A",name:"동명검증",phone:"01000000801",sam:"971-1",village:"971"};
  const b={id:randomUUID(),source:"동명검증B",name:"동명검증",phone:"01000000802",sam:"972-1",village:"972"};
  const c={id:randomUUID(),source:"유일검증",name:"유일검증",phone:"01000000803",sam:"971-2",village:"971"};
  const original=[a,b,c];
  async function member(page:Page,person:typeof a){await page.goto('/login');await page.getByLabel('이름 (아이디)').fill(person.name);await page.getByLabel('비밀번호',{exact:true}).fill(person.phone);await page.getByRole('button',{name:'로그인',exact:true}).click();await expect(page).toHaveURL(/\/$/);}
  test.beforeAll(async()=>{
    const url=new URL(process.env.DATABASE_URL??"");if(process.env.CI!=="true"||!["127.0.0.1","localhost"].includes(url.hostname)||url.pathname!=="/prayer_e2e")throw Error("LOCAL_DISPOSABLE_DB_ONLY");
    db=postgres(url.toString(),{ssl:"require",prepare:false,max:1});
    for(const p of original)await db`insert into prayer_app.member_roster(id,source_name,canonical_name,village,sam_label,phone_lookup_hash,phone_ciphertext,source) values(${p.id},${p.source},${p.name},${p.village},${p.sam},${phoneLookupHash(p.phone)},${encryptRosterPhone(p.phone)},'manual')`;
    await db`insert into prayer_app.sams(id,name,leader_name) values(${samId},'971-1',${a.name}),(${uniqueSam},'971-2',${c.name})`;
  });
  test.beforeEach(async()=>{
    await db`delete from prayer_app.village_leaders where village in ('971','972')`;
    await db`update prayer_app.sams set leader_name=${a.name},leader_roster_id=null,leader_binding_locked=false where id=${samId}`;
    await db`update prayer_app.sams set leader_name=${c.name},leader_roster_id=null,leader_binding_locked=false where id=${uniqueSam}`;
    for(const p of original)await db`update prayer_app.member_roster set source_name=${p.source},canonical_name=${p.name},village=${p.village},sam_label=${p.sam},is_active=true where id=${p.id}`;
  });
  test.afterAll(async()=>{if(!db)return;try{await db`delete from prayer_app.village_leaders where village in ('971','972')`;await db`delete from prayer_app.sams where id in (${samId},${uniqueSam})`;for(const p of original){await db`delete from prayer_app.users where roster_id=${p.id}`;await db`delete from prayer_app.member_roster where id=${p.id}`;}}finally{await db.end();}});

  test("migration auto-links globally unique matches but leaves duplicate names unassigned",async()=>{
    await db`insert into prayer_app.village_leaders(name,village,leader_name) values('971마을장','971',${a.name})`;
    const sql=await readFile('drizzle/20260930090000_leader_roster_identity.sql','utf8');
    await db.unsafe(sql.slice(sql.indexOf('-- Session-local helpers')));
    expect((await db`select leader_roster_id from prayer_app.sams where id=${uniqueSam}`)[0].leader_roster_id).toBe(c.id);
    expect((await db`select leader_roster_id from prayer_app.sams where id=${samId}`)[0].leader_roster_id).toBeNull();
    expect((await db`select leader_roster_id from prayer_app.village_leaders where village='971'`)[0].leader_roster_id).toBeNull();
  });
  test("duplicates alone display choices, mask phone, require selection and grant first-login ID",async({page,browser},info)=>{
    await login(page,'admin');
    const input={kind:'village',name:'971마을장',leaderName:a.name};
    const r=await page.request.post(resolve,{data:input});expect(r.ok()).toBe(true);const text=await r.text();const data=JSON.parse(text);
    expect(data.state).toBe('ambiguous');expect(data.rosterId).toBeNull();expect(data.candidateCount).toBe(2);
    expect(text).not.toContain(a.phone);expect(text).not.toContain('ciphertext');expect(text).not.toContain('phone_lookup');
    expect(data.candidates.find((p:{id:string})=>p.id===a.id).phoneSuffix).toBe('0801');
    expect((await page.request.put(heads,{data:input})).status()).toBe(409);
    expect((await page.request.put(heads,{data:{...input,leaderRosterId:b.id}})).status()).toBe(409);
    expect((await page.request.put(heads,{data:{...input,leaderRosterId:randomUUID()}})).status()).toBe(409);
    await page.goto('/admin/users');const panel=page.getByRole('region',{name:'마을장 관리'});
    await panel.getByLabel('마을장',{exact:true}).fill('971마을장');await panel.getByLabel('마을장 이름',{exact:true}).fill(a.name);
    await expect(panel.getByRole('group',{name:'동명이인 확인'})).toBeVisible();await expect(panel.getByRole('button',{name:'마을장 저장',exact:true})).toBeDisabled();
    await expect(panel.getByRole('radio',{name:new RegExp(b.source)})).toBeDisabled();
    await panel.getByRole('radio',{name:new RegExp(a.source)}).check();
    await page.setViewportSize({width:360,height:900});await expectNoOverflow(page);await page.screenshot({path:info.outputPath('duplicate-leader-selection-360.png'),fullPage:true});
    await panel.getByRole('button',{name:'마을장 저장',exact:true}).click();await expect(panel.getByText('마을장 정보를 저장했습니다.',{exact:true})).toBeVisible();
    const context=await browser.newContext(),other=await context.newPage();
    try{await member(other,a);expect((await (await other.request.get('/api/pastoral/status')).json()).visible).toBe(true);await expect(other.getByRole('link',{name:/목양지/})).toBeVisible();await other.request.post('/api/auth/logout');await member(other,b);expect((await (await other.request.get('/api/pastoral/status')).json()).visible).toBe(false);}finally{await context.close();}
    await page.reload();const row=(await (await page.request.get(heads)).json()).rows.find((x:{name:string})=>x.name==='971마을장');expect(row.leaderRosterId).toBe(a.id);expect(row.bindingState).toBe('linked');
  });
  test("unique name has no choice UI, automatically links; pinned role survives namesake addition and rename",async({page})=>{
    await login(page,'admin');await page.goto('/admin/users');const panel=page.getByRole('region',{name:'마을장 관리'});
    await panel.getByLabel('마을장',{exact:true}).fill('971마을장');await panel.getByLabel('마을장 이름',{exact:true}).fill(c.name);
    await expect(panel.getByText(/별도 선택은 필요 없습니다/)).toBeVisible();await expect(panel.getByRole('radio')).toHaveCount(0);
    await panel.getByRole('button',{name:'마을장 저장',exact:true}).click();await expect(panel.getByText('마을장 정보를 저장했습니다.',{exact:true})).toBeVisible();
    await db`update prayer_app.member_roster set canonical_name=${c.name},source_name=${c.name+'A'} where id=${a.id}`;
    await db`update prayer_app.member_roster set source_name='바뀐표시이름',canonical_name='바뀐표시이름' where id=${c.id}`;
    expect((await page.request.put(heads,{data:{name:'971마을장',leaderName:c.name}})).status()).toBe(200);
    expect((await db`select leader_roster_id from prayer_app.village_leaders where village='971'`)[0].leader_roster_id).toBe(c.id);
    await db`update prayer_app.member_roster set is_active=false where id=${c.id}`;
    expect((await (await page.request.get(heads)).json()).rows.find((x:{name:string})=>x.name==='971마을장').bindingState).toBe('unavailable');
  });
  test("sam saves enforce conditional selection and same-name imports preserve the chosen ID",async({page})=>{
    await login(page,'admin');const input={name:'971-1',leaderName:a.name};
    expect((await page.request.put('/api/admin/sams',{data:input})).status()).toBe(409);
    expect((await page.request.put('/api/admin/sams',{data:{...input,leaderRosterId:b.id}})).status()).toBe(409);
    expect((await page.request.put('/api/admin/sams',{data:{...input,leaderRosterId:a.id}})).status()).toBe(200);
    const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['샘','샘리더'],['971-1',a.name],['971-2',c.name]]),'가상리더');
    const file=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
    expect((await page.request.post('/api/admin/sams/import',{multipart:{file:{name:'가상리더.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file}}})).status()).toBe(200);
    const rows=(await (await page.request.get('/api/admin/sams')).json()).rows;
    expect(rows.find((r:{id:string})=>r.id===samId).leaderRosterId).toBe(a.id);expect(rows.find((r:{id:string})=>r.id===uniqueSam).leaderRosterId).toBe(c.id);
    // A stale choice cannot override current membership checks.
    await db`update prayer_app.member_roster set sam_label='972-1' where id=${a.id}`;
    expect((await page.request.put('/api/admin/sams',{data:{...input,leaderRosterId:a.id}})).status()).toBe(409);
  });
  test("unresolved duplicate bulk import stays pending; candidates are admin-only and cross-site writes denied",async({page,request})=>{
    await login(page,'admin');const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['샘','샘리더'],['971-1',a.name]]),'가상리더');
    expect((await page.request.post('/api/admin/sams/import',{multipart:{file:{name:'검증.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:XLSX.write(book,{type:'buffer',bookType:'xlsx'})}}})).status()).toBe(200);
    expect((await (await page.request.get('/api/admin/sams')).json()).rows.find((r:{id:string})=>r.id===samId).bindingState).toBe('ambiguous');
    expect((await page.request.post(resolve,{headers:{origin:'https://other.example'},data:{kind:'sam',name:'971-1',leaderName:a.name}})).status()).toBe(403);
    expect((await request.post(resolve,{data:{kind:'sam',name:'971-1',leaderName:a.name}})).status()).toBe(403);
    await page.request.post('/api/auth/logout');await login(page);expect((await page.request.post(resolve,{data:{kind:'sam',name:'971-1',leaderName:a.name}})).status()).toBe(403);
  });
  test("deleting a linked roster row clears only the ID and never reassigns its role",async({page})=>{
    await login(page,'admin');const input={name:'971-2',leaderName:c.name};
    expect((await page.request.put('/api/admin/sams',{data:input})).status()).toBe(200);
    const replacement=randomUUID();
    try{
      await db`delete from prayer_app.member_roster where id=${c.id}`;
      await db`insert into prayer_app.member_roster(id,source_name,canonical_name,village,sam_label,source) values(${replacement},${c.name},${c.name},'971','971-2','manual')`;
      expect((await page.request.put('/api/admin/sams',{data:input})).status()).toBe(200);
      const [entry]=await db`select leader_roster_id,leader_binding_locked from prayer_app.sams where id=${uniqueSam}`;
      expect(entry).toEqual({leader_roster_id:null,leader_binding_locked:true});
    }finally{await db`delete from prayer_app.member_roster where id=${replacement}`;}
  });

});
