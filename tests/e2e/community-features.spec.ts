import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { login, expectNoOverflow } from "./helpers";
const root="/api/community";
const max=6*1024*1024, chunk=512*1024;
const digest=(data:Buffer)=>createHash("sha256").update(data).digest("hex");
async function folder(api:APIRequestContext,name:string){const r=await api.post(root+"/folders",{data:{name}});expect(r.status()).toBe(201);return (await r.json()).id as string;}
async function makePost(api:APIRequestContext,folderId:string,title="검증 게시글"){
  const data={id:randomUUID(),folderId,title,body:"함께 나누는 이야기",files:[]};
  expect((await api.post(root+"/posts",{data})).status()).toBe(201);
  expect((await api.post(`${root}/posts/${data.id}/publish`)).ok()).toBe(true);
  return data.id;
}
function testDb(){
  const url=new URL(process.env.DATABASE_URL??"");
  if(process.env.CI!=="true" || process.env.E2E_DATABASE_READY!=="1" || !["127.0.0.1","localhost"].includes(url.hostname) || url.pathname!=="/prayer_e2e")throw new Error("DISPOSABLE_DB_ONLY");
  return postgres(url.toString(),{ssl:"require",prepare:false,max:1});
}
test.beforeEach(()=>{test.skip(process.env.E2E_DATABASE_READY!=="1","Requires disposable CI database");});

test("two exact 6MB attachments, comments and likes work through the mobile UI",async({page,browser,request})=>{
  test.setTimeout(180000);
  const adminContext=await browser.newContext();const admin=await adminContext.newPage();
  let fid="",pid="";
  const title="첨부와 좋아요 검증 "+randomUUID().slice(0,8);
  const files=[{name:"자료 하나.pdf",mimeType:"application/pdf",buffer:Buffer.alloc(max,65)},{name:"자료 둘.txt",mimeType:"text/plain",buffer:Buffer.alloc(max,66)}];
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  const alert=page.locator(".community").getByRole("alert");
  try{
    await login(admin,"admin");fid=await folder(admin.request,"나눔 검증 "+randomUUID().slice(0,8));
    await page.setViewportSize({width:360,height:800});await login(page);
    await page.goto(`/community?folder=${fid}`);await page.getByRole("link",{name:"글쓰기",exact:true}).click();
    await page.getByLabel("제목",{exact:true}).fill(title);await page.getByLabel("내용",{exact:true}).fill("마음을 나눕니다.\n<script>텍스트로만 표시</script>");
    const picker=page.locator('input[type="file"]');
    await picker.setInputFiles([...files,{name:"셋.txt",mimeType:"text/plain",buffer:Buffer.from("third")}]);
    await expect(alert).toContainText("최대 2개");
    await picker.setInputFiles({name:"초과.pdf",mimeType:"application/pdf",buffer:Buffer.alloc(max+1)});
    await expect(alert).toContainText("6MB 이하");
    await picker.setInputFiles(files);await expect(page.locator(".community-file-row")).toHaveCount(2);
    await page.route("**/api/community/posts",async route=>{if(route.request().method()==="POST")await route.fulfill({status:503,contentType:"application/json",body:'{}'});else await route.continue();});
    await page.getByRole("button",{name:"등록",exact:true}).click();await expect(alert).toContainText("다시 시도");
    await expect(page.getByLabel("제목",{exact:true})).toHaveValue(title);await expect(page.locator(".community-file-row")).toHaveCount(2);
    await page.unroute("**/api/community/posts");
    await page.getByRole("button",{name:"등록",exact:true}).click();
    await expect(page.locator(".community-post-title")).toHaveText(title,{timeout:60000});pid=new URL(page.url()).searchParams.get("post")!;
    expect((await request.get(`${root}/posts/${pid}`)).status()).toBe(401);
    await expect(page.locator(".community-download")).toHaveCount(2);await expect(page.locator(".community-post > .community-body")).toContainText("<script>");
    await expectNoOverflow(page);
    const like=page.getByRole("button",{name:"좋아요",exact:true});
    await like.click();await expect(like).toHaveAttribute("aria-pressed","true");await expect(like.locator(".community-like-count")).toHaveText("1");
    await page.reload();await expect(like).toHaveAttribute("aria-pressed","true");
    await like.click();await expect(like).toHaveAttribute("aria-pressed","false");await expect(like.locator(".community-like-count")).toHaveText("0");
    await page.getByLabel("댓글 내용").fill("함께 응원합니다.");await page.getByRole("button",{name:"댓글 등록",exact:true}).click();
    await expect(page.locator(".community-comment")).toContainText("함께 응원합니다.");
    await page.getByRole("button",{name:"댓글 수정",exact:true}).click();await page.getByRole("textbox",{name:"댓글 수정",exact:true}).fill("함께 기도합니다.");await page.getByRole("button",{name:"댓글 수정 저장"}).click();
    await expect(page.locator(".community-comment")).toContainText("함께 기도합니다.");
    for(const file of files){
      const wait=page.waitForEvent("download");await page.getByRole("button",{name:new RegExp(file.name)}).click();
      const downloaded=await wait;expect(downloaded.suggestedFilename()).toBe(file.name);
      expect(digest(await readFile((await downloaded.path())!))).toBe(digest(file.buffer));
    }
    await page.screenshot({path:test.info().outputPath("community-mobile-post.png"),fullPage:true});
    await page.getByRole("link",{name:"게시글 수정",exact:true}).click();await page.getByLabel("제목",{exact:true}).fill(title+" 수정");await page.getByRole("button",{name:"수정 저장"}).click();
    await expect(page.locator(".community-post-title")).toHaveText(title+" 수정");await expect(page.locator(".community-download")).toHaveCount(2);
    await page.goto(`/community?folder=${fid}`);await expect(page.locator(".community-post-row")).toContainText("좋아요 0 · 댓글 1 · 첨부 2");
    await expectNoOverflow(page);await page.screenshot({path:test.info().outputPath("community-mobile-list.png"),fullPage:true});
    expect(errors).toEqual([]);
  }finally{if(pid)await admin.request.delete(`${root}/posts/${pid}`);if(fid)await admin.request.delete(`${root}/folders/${fid}`);await adminContext.close();}
});

test("likes are unique per member, retry-safe, private and cascade with posts",async({page,browser,request})=>{
  const adminContext=await browser.newContext();const admin=await adminContext.newPage();let fid="",pid="";const sql=testDb();
  try{
    await login(page);await login(admin,"admin");fid=await folder(admin.request,"좋아요 검증 "+randomUUID().slice(0,8));pid=await makePost(page.request,fid);
    const path=`${root}/posts/${pid}/like`;
    expect((await request.put(path,{data:{liked:true}})).status()).toBe(401);
    expect((await page.request.put(path,{data:{liked:"true"}})).status()).toBe(400);
    const replies=await Promise.all(Array.from({length:8},()=>page.request.put(path,{data:{liked:true}})));
    for(const reply of replies){expect(reply.ok()).toBe(true);expect(await reply.json()).toEqual({liked:true,likeCount:1});}
    expect(await (await admin.request.put(path,{data:{liked:true}})).json()).toEqual({liked:true,likeCount:2});
    for(let i=0;i<2;i++)expect(await (await page.request.put(path,{data:{liked:false}})).json()).toEqual({liked:false,likeCount:1});
    const detail=(await (await page.request.get(`${root}/posts/${pid}`)).json()).post;
    expect(detail.liked).toBe(false);expect(detail.likeCount).toBe(1);expect(detail).not.toHaveProperty("likeUsers");
    const list=await (await page.request.get(`${root}/posts?folder=${fid}`)).json();expect(list.items[0].likeCount).toBe(1);
    await page.goto(`/community?post=${pid}`);
    await page.route("**/api/community/posts/*/like",async route=>{const result=await route.fetch();expect(result.ok()).toBe(true);await route.abort("failed");});
    await page.getByRole("button",{name:"좋아요",exact:true}).click();await expect(page.locator(".community").getByRole("alert")).toContainText("다시 시도");
    await page.unroute("**/api/community/posts/*/like");await page.getByRole("button",{name:"좋아요",exact:true}).click();
    await expect(page.getByRole("button",{name:"좋아요",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.locator(".community-like-count")).toHaveText("2");
    await admin.request.delete(`${root}/posts/${pid}`);
    expect((await sql`select count(*)::int as n from prayer_app.community_post_likes where post_id=${pid}`)[0].n).toBe(0);
    expect((await page.request.put(path,{data:{liked:true}})).status()).toBe(404);pid="";
  }finally{if(pid)await admin.request.delete(`${root}/posts/${pid}`);if(fid)await admin.request.delete(`${root}/folders/${fid}`);await sql.end();await adminContext.close();}
});

test("folders, moves, deletions and comment ownership are enforced by the server",async({page,browser})=>{
  const adminContext=await browser.newContext();const admin=await adminContext.newPage();const folders:string[]=[],posts:string[]=[];const sql=testDb();
  try{
    await login(page);await login(admin,"admin");
    await admin.goto("/admin/community");await admin.locator("summary",{hasText:"폴더 관리"}).click();
    const name="폴더 만들기 "+randomUUID().slice(0,8);await admin.getByLabel("새 폴더 이름").fill(name);
    const wait=admin.waitForResponse(r=>r.url().endsWith("/api/community/folders")&&r.request().method()==="POST");await admin.getByRole("button",{name:"폴더 생성",exact:true}).click();
    const response=await wait;expect(response.status()).toBe(201);const a=(await response.json()).id;folders.push(a);
    const b=await folder(admin.request,"옮길 폴더 "+randomUUID().slice(0,8));folders.push(b);
    const pid=await makePost(page.request,a);posts.push(pid);const adminPost=await makePost(admin.request,b);posts.push(adminPost);
    expect((await page.request.post(root+"/folders",{data:{name:"금지"}})).status()).toBe(403);
    expect((await page.request.patch(`${root}/folders/${a}`,{data:{name:"금지"}})).status()).toBe(403);
    expect((await page.request.delete(`${root}/folders/${a}`)).status()).toBe(403);
    expect((await admin.request.delete(`${root}/folders/${a}`)).status()).toBe(409);
    expect((await page.request.put(`${root}/posts/${adminPost}`,{data:{title:"금지",body:"금지"}})).status()).toBe(403);
    expect((await page.request.delete(`${root}/posts/${adminPost}`)).status()).toBe(403);
    expect((await page.request.patch(`${root}/posts/${pid}/move`,{data:{folderId:b}})).status()).toBe(403);
    const comment={id:randomUUID(),body:"재시도 댓글"};
    for(let i=0;i<2;i++)expect((await page.request.post(`${root}/posts/${pid}/comments`,{data:comment})).status()).toBe(201);
    expect((await (await page.request.get(`${root}/posts/${pid}/comments`)).json()).total).toBe(1);
    const other={id:randomUUID(),body:"관리자 댓글"};expect((await admin.request.post(`${root}/posts/${pid}/comments`,{data:other})).status()).toBe(201);
    expect((await page.request.patch(`${root}/comments/${other.id}`,{data:{body:"금지"}})).status()).toBe(403);
    expect((await page.request.delete(`${root}/comments/${other.id}`)).status()).toBe(403);
    await admin.goto(`/admin/community?post=${pid}`);await admin.getByLabel("이동할 폴더").selectOption(b);await admin.getByRole("button",{name:"폴더로 이동",exact:true}).click();
    await expect(admin.locator(".community-post > a")).toContainText("옮길 폴더");
    expect((await admin.request.delete(`${root}/folders/${a}`)).ok()).toBe(true);
    await page.goto(`/community?post=${pid}`);await expect(page.locator(".community-comment")).toHaveCount(2);
    await admin.setViewportSize({width:360,height:800});await expectNoOverflow(admin);await admin.screenshot({path:test.info().outputPath("community-admin-mobile.png"),fullPage:true});
    admin.once("dialog",d=>d.dismiss());await admin.getByRole("button",{name:"게시글 삭제",exact:true}).click();expect((await page.request.get(`${root}/posts/${pid}`)).ok()).toBe(true);
    admin.once("dialog",d=>d.accept());await admin.getByRole("button",{name:"게시글 삭제",exact:true}).click();await expect(admin).toHaveURL(new RegExp(`folder=${b}`));
    expect((await sql`select count(*)::int as n from prayer_app.community_comments where post_id=${pid}`)[0].n).toBe(0);
    expect((await page.request.get(`${root}/posts/${pid}`)).status()).toBe(404);
    await page.goto("/admin/community");await expect(page).toHaveURL(/\/$/);
  }finally{for(const id of posts)await admin.request.delete(`${root}/posts/${id}`);for(const id of folders)await admin.request.delete(`${root}/folders/${id}`);await sql.end();await adminContext.close();}
});

test("unpublished uploads, digest checks and hard limits cannot be bypassed",async({page,browser,request})=>{
  const adminContext=await browser.newContext();const admin=await adminContext.newPage();let fid="";const id=randomUUID();const sql=testDb();
  try{
    await login(page);await login(admin,"admin");fid=await folder(admin.request,"파일 경계 "+randomUUID().slice(0,8));
    const buffer=Buffer.from("valid bytes");const file={name:"문서.txt",size:buffer.length,sha256:digest(buffer)};
    const data={id,folderId:fid,title:"전송 중 초안",body:"비공개 본문",files:[file]};
    expect((await page.request.post(root+"/posts",{data:{...data,files:[file,file,file]}})).status()).toBe(400);
    expect((await page.request.post(root+"/posts",{data:{...data,files:[{...file,size:max+1}]}})).status()).toBe(413);
    expect((await page.request.post(root+"/posts",{data})).status()).toBe(201);
    expect((await admin.request.get(`${root}/posts/${id}`)).status()).toBe(404);
    expect((await page.request.put(`${root}/posts/${id}/like`,{data:{liked:true}})).status()).toBe(404);
    expect((await page.request.post(`${root}/posts/${id}/comments`,{data:{id:randomUUID(),body:"불가"}})).status()).toBe(404);
    expect((await page.request.post(`${root}/posts/${id}/publish`)).status()).toBe(409);
    const path=`${root}/posts/${id}/files/0/chunks/0`;
    expect((await request.get(path)).status()).toBe(401);
    expect((await page.request.put(path,{data:Buffer.alloc(chunk+1),headers:{"content-type":"application/octet-stream"}})).status()).toBe(413);
    expect((await page.request.put(path,{data:buffer,headers:{"content-type":"application/octet-stream",origin:"https://other.example"}})).status()).toBe(403);
    expect((await page.request.put(path,{data:Buffer.alloc(buffer.length),headers:{"content-type":"application/octet-stream"}})).ok()).toBe(true);
    expect((await page.request.post(`${root}/posts/${id}/publish`)).status()).toBe(409);
    expect((await admin.request.get(path)).status()).toBe(404);
    expect((await page.request.put(path,{data:buffer,headers:{"content-type":"application/octet-stream"}})).ok()).toBe(true);
    expect((await page.request.post(`${root}/posts/${id}/publish`)).ok()).toBe(true);
    expect((await page.request.post(`${root}/posts/${id}/publish`)).ok()).toBe(true);
    expect((await page.request.post(root+"/posts",{data})).status()).toBe(201);
    expect((await (await page.request.get(`${root}/posts?folder=${fid}`)).json()).total).toBe(1);
    expect((await page.request.put(path,{data:buffer,headers:{"content-type":"application/octet-stream"}})).status()).toBe(409);
    const downloaded=await admin.request.get(path);expect(downloaded.headers()["content-type"]).toBe("application/octet-stream");expect(downloaded.headers()["cache-control"]).toContain("no-store");expect(await downloaded.body()).toEqual(buffer);
    expect((await page.request.put(`${root}/posts/${id}/files/2/chunks/0`,{data:buffer})).status()).toBe(400);
    await page.request.delete(`${root}/posts/${id}`);
    expect((await sql`select count(*)::int as n from prayer_app.community_files where post_id=${id}`)[0].n).toBe(0);
    expect((await sql`select count(*)::int as n from prayer_app.community_file_chunks where post_id=${id}`)[0].n).toBe(0);
    const privacy=await sql`select tablename, rowsecurity from pg_tables where schemaname='prayer_app' and tablename like 'community_%'`;
    expect(privacy).toHaveLength(6);expect(privacy.every(row=>row.rowsecurity===true)).toBe(true);
  }finally{await page.request.delete(`${root}/posts/${id}`);if(fid)await admin.request.delete(`${root}/folders/${fid}`);await sql.end();await adminContext.close();}
});
