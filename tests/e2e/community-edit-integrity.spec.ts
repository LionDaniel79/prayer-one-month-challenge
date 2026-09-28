import { createHash, randomUUID } from "node:crypto";
import postgres from "postgres";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";
const root="/api/community";
const digest=(data:Buffer)=>createHash("sha256").update(data).digest("hex");
function disposableDb(){
  const url=new URL(process.env.DATABASE_URL??"");
  if(process.env.CI!=="true"||process.env.E2E_DATABASE_READY!=="1"||!["localhost","127.0.0.1"].includes(url.hostname)||url.pathname!=="/prayer_e2e")throw new Error("DISPOSABLE_DB_ONLY");
  return postgres(url.toString(),{ssl:"require",prepare:false,max:1});
}
test.beforeEach(()=>test.skip(process.env.E2E_DATABASE_READY!=="1","Requires disposable CI DB"));

test("staged edits enforce hashes and permissions, cancel safely, and commit once",async({page,browser,request})=>{
  const context=await browser.newContext();const admin=await context.newPage();const sql=disposableDb();
  await login(page);await login(admin,"admin");
  const folderId=(await(await page.request.get(root+"/folders")).json()).folders[0].id;
  const id=randomUUID();let editId=randomUUID();const data=Buffer.from("new file bytes");
  try{
    expect((await page.request.post(root+"/posts",{data:{id,folderId,title:"원본 유지 검증",body:"변경 전 본문",files:[]}})).status()).toBe(201);
    expect((await page.request.post(`${root}/posts/${id}/publish`)).ok()).toBe(true);
    const makeEdit=()=>({id:editId,baseVersion:1,title:"저장할 제목",body:"저장할 본문",keepSlots:[],files:[{name:"new.txt",size:data.length,sha256:digest(data)}]});
    expect((await page.request.post(`${root}/posts/${id}/edits`,{data:makeEdit()})).status()).toBe(201);
    let stage=`${root}/posts/${id}/edits/${editId}`;
    expect((await request.post(stage+"/commit")).status()).toBe(401);
    expect((await admin.request.delete(stage)).status()).toBe(403);
    expect((await admin.request.post(stage+"/commit")).status()).toBe(403);
    expect((await admin.request.put(stage+"/files/0/chunks/0",{data,headers:{"content-type":"application/octet-stream"}})).status()).toBe(403);
    expect((await page.request.post(stage+"/commit")).status()).toBe(409);
    expect((await page.request.put(stage+"/files/0/chunks/0",{data:Buffer.alloc(524289),headers:{"content-type":"application/octet-stream"}})).status()).toBe(413);
    expect((await page.request.put(stage+"/files/0/chunks/0",{data,headers:{"content-type":"application/octet-stream",origin:"https://other.example"}})).status()).toBe(403);
    expect((await page.request.put(stage+"/files/0/chunks/0",{data:Buffer.alloc(data.length),headers:{"content-type":"application/octet-stream"}})).ok()).toBe(true);
    const bad=await page.request.post(stage+"/commit");expect(bad.status()).toBe(409);expect((await bad.json()).code).toBe("FILE_INTEGRITY_FAILED");
    const unchanged=(await(await page.request.get(`${root}/posts/${id}`)).json()).post;
    expect(unchanged.body).toBe("변경 전 본문");expect(unchanged.files).toEqual([]);
    for(let i=0;i<2;i++)expect((await page.request.delete(stage)).ok()).toBe(true);
    expect((await sql`select count(*)::int as n from prayer_app.community_edit_chunks where edit_id=${editId}`)[0].n).toBe(0);
    editId=randomUUID();stage=`${root}/posts/${id}/edits/${editId}`;
    expect((await page.request.post(`${root}/posts/${id}/edits`,{data:makeEdit()})).status()).toBe(201);
    expect((await page.request.put(stage+"/files/0/chunks/0",{data,headers:{"content-type":"application/octet-stream"}})).ok()).toBe(true);
    const replies=await Promise.all(Array.from({length:4},()=>page.request.post(stage+"/commit")));
    for(const reply of replies)expect(reply.ok()).toBe(true);
    const saved=(await(await page.request.get(`${root}/posts/${id}`)).json()).post;
    expect(saved.version).toBe(2);expect(saved.files).toHaveLength(1);expect(saved.files[0].sha256).toBe(digest(data));
    expect(await(await page.request.get(`${root}/posts/${id}/files/0/chunks/0`)).body()).toEqual(data);
    expect((await(await page.request.delete(stage)).json()).applied).toBe(true);
    expect((await page.request.post(`${root}/posts/${id}/edits`,{data:{...makeEdit(),body:"응답 유실 뒤 달라진 입력"}})).status()).toBe(409);
    expect((await page.request.delete(`${root}/posts/${id}`)).ok()).toBe(true);
    expect((await sql`select count(*)::int as n from prayer_app.community_post_edits where post_id=${id}`)[0].n).toBe(0);
    const privileges=await sql`select tablename,rowsecurity,has_table_privilege('anon','prayer_app.'||tablename,'SELECT,INSERT,UPDATE,DELETE') as anon_access,has_table_privilege('authenticated','prayer_app.'||tablename,'SELECT,INSERT,UPDATE,DELETE') as member_access from pg_tables where schemaname='prayer_app' and tablename in ('community_post_edits','community_edit_chunks')`;
    expect(privileges).toHaveLength(2);expect(privileges.every(row=>row.rowsecurity&&!row.anon_access&&!row.member_access)).toBe(true);
  }finally{await page.request.delete(`${root}/posts/${id}`);await sql.end();await context.close();}
});

test("renamed executable images never render inline and drafts remain private",async({page,browser,request})=>{
  const context=await browser.newContext();const admin=await context.newPage();await login(page);await login(admin,"admin");
  const folderId=(await(await page.request.get(root+"/folders")).json()).folders[0].id;
  const id=randomUUID();const bytes=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  try{
    expect((await page.request.post(root+"/posts",{data:{id,folderId,title:"잘못된 사진 형식",body:"원본 다운로드는 유지",files:[{name:"renamed.png",size:bytes.length,sha256:digest(bytes)}]}})).status()).toBe(201);
    expect((await page.request.put(`${root}/posts/${id}/files/0/chunks/0`,{headers:{"content-type":"application/octet-stream"},data:bytes})).ok()).toBe(true);
    const path=`${root}/posts/${id}/files/0/image?sha=${digest(bytes)}`;
    expect((await request.get(path)).status()).toBe(401);expect((await admin.request.get(path)).status()).toBe(404);
    expect((await page.request.get(path)).status()).toBe(415);
    expect((await page.request.post(`${root}/posts/${id}/publish`)).ok()).toBe(true);
    const result=await page.request.get(path);expect(result.status()).toBe(415);expect(result.headers()["content-type"]).toContain("application/json");
    expect((await page.request.get(`${root}/posts/${id}/files/0/image?sha=${"0".repeat(64)}`)).status()).toBe(409);
    const raw=await page.request.get(`${root}/posts/${id}/files/0/chunks/0`);expect(await raw.body()).toEqual(bytes);expect(raw.headers()["content-type"]).toBe("application/octet-stream");
    let dialogs=0;page.on("dialog",async dialog=>{dialogs++;await dialog.dismiss();});
    await page.goto(`/community?post=${id}`);await expect(page.locator(".community-photo")).toContainText("사진을 표시하지 못했습니다");
    await expect(page.locator(".community-download")).toHaveCount(1);expect(dialogs).toBe(0);
  }finally{await page.request.delete(`${root}/posts/${id}`);await context.close();}
});
