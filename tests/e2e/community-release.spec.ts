import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { login, expectNoOverflow } from "./helpers";
const root="/api/community";
test.beforeEach(()=>test.skip(process.env.E2E_DATABASE_READY!=="1","Requires disposable CI DB"));

test("draft-only deletion is private, idempotent and preserves published posts",async({page,browser,request})=>{
  const context=await browser.newContext();const admin=await context.newPage();const ids:string[]=[];
  try{
    await login(page);await login(admin,"admin");
    const folderId=(await (await page.request.get(root+"/folders")).json()).folders[0].id;
    const id=randomUUID();ids.push(id);
    expect((await admin.request.post(root+"/posts",{data:{id,folderId,title:"초안 보존 검사",body:"관리자의 미완료 글",files:[]}})).status()).toBe(201);
    expect((await request.delete(`${root}/drafts/${id}`)).status()).toBe(401);
    expect((await page.request.delete(`${root}/drafts/${id}`)).status()).toBe(403);
    expect((await admin.request.get(`${root}/posts/${id}`)).status()).toBe(200);
    expect((await admin.request.post(`${root}/posts/${id}/publish`)).status()).toBe(200);
    expect(await (await admin.request.delete(`${root}/drafts/${id}`)).json()).toEqual({id,published:true});
    expect((await admin.request.get(`${root}/posts/${id}`)).status()).toBe(200);
    const own=randomUUID();ids.push(own);
    expect((await page.request.post(root+"/posts",{data:{id:own,folderId,title:"내 미완료 글",body:"등록 전",files:[]}})).status()).toBe(201);
    for(let i=0;i<2;i++)expect(await (await page.request.delete(`${root}/drafts/${own}`)).json()).toEqual({id:own,published:false});
    expect((await page.request.get(`${root}/posts/${own}`)).status()).toBe(404);
  }finally{for(const id of ids)await admin.request.delete(`/api/admin/community/posts/${id}`);await context.close();}
});

test("community layouts fit small phones and desktop with working likes",async({page})=>{
  await page.setViewportSize({width:360,height:800});await login(page,"admin");
  const folders=await (await page.request.get(root+"/folders")).json();const folderId=folders.folders[0].id;
  const id=randomUUID();
  try{
    expect((await page.request.post(root+"/posts",{data:{id,folderId,title:"함께 나누는 감사의 이야기",body:"오늘도 함께 기도할 수 있어서 감사합니다.\n서로의 소식과 따뜻한 마음을 나누어 주세요.",files:[]}})).status()).toBe(201);
    expect((await page.request.post(`${root}/posts/${id}/publish`)).ok()).toBe(true);
    await page.goto(`/community?post=${id}`);
    const like=page.getByRole("button",{name:"좋아요",exact:true});await like.click();await expect(like).toHaveAttribute("aria-pressed","true");
    for(const width of [320,360,1280]){
      await page.setViewportSize({width,height:900});
      await page.goto(`/community?post=${id}`);await expect(page.locator(".community-post-title")).toBeVisible();await expect(like).toHaveAttribute("aria-pressed","true");
      await expectNoOverflow(page);await page.screenshot({path:test.info().outputPath(`community-post-${width}.png`),fullPage:true,animations:"disabled"});
      await page.goto(`/community?folder=${folderId}`);await expect(page.locator(`.community-post-row[href="/community?post=${id}"]`)).toContainText("함께 나누는 감사의 이야기");
      await expectNoOverflow(page);await page.screenshot({path:test.info().outputPath(`community-board-${width}.png`),fullPage:true,animations:"disabled"});
    }
    await page.setViewportSize({width:360,height:800});await page.goto("/admin/community");
    await page.locator("summary",{hasText:"폴더 관리"}).click();await expect(page.getByLabel("새 폴더 이름")).toBeVisible();
    await expectNoOverflow(page);await page.screenshot({path:test.info().outputPath("community-folders-admin-360.png"),fullPage:true,animations:"disabled"});
    await page.goto(`/community?folder=${folderId}&new=1`);await expect(page.getByLabel("제목",{exact:true})).toBeVisible();
    await expectNoOverflow(page);await page.screenshot({path:test.info().outputPath("community-editor-360.png"),fullPage:true,animations:"disabled"});
  }finally{await page.request.delete(`${root}/posts/${id}`);}
});
