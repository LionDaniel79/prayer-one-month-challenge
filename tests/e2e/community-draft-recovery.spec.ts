import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { login } from "./helpers";
const root="/api/community";
test.beforeEach(()=>test.skip(process.env.E2E_DATABASE_READY!=="1","Requires disposable CI DB"));
test("cancelling after a failed unsaved request returns safely to the folder",async({page})=>{
  await login(page);
  const fid=(await (await page.request.get(root+"/folders")).json()).folders[0].id;
  await page.goto(`/community?folder=${fid}&new=1`);
  await page.getByLabel("제목",{exact:true}).fill("실패 후 취소 "+randomUUID());
  await page.getByLabel("내용",{exact:true}).fill("서버에 저장되지 않은 입력");
  await page.route("**/api/community/posts",async route=>route.fulfill({status:503,contentType:"application/json",body:'{}'}));
  await page.getByRole("button",{name:"등록",exact:true}).click();
  await expect(page.locator(".community").getByRole("alert")).toContainText("다시 시도");
  page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"취소",exact:true}).click();
  await expect(page).toHaveURL(new RegExp(`folder=${fid}$`));
  await expect(page.getByRole("link",{name:"글쓰기",exact:true})).toBeVisible();
});
test("cancelling an unfinished upload cannot delete a concurrently published post",async({page})=>{
  await login(page);
  const fid=(await (await page.request.get(root+"/folders")).json()).folders[0].id;
  const title="취소 경합 보존 "+randomUUID();let id="";
  try{
    await page.goto(`/community?folder=${fid}&new=1`);
    await page.getByLabel("제목",{exact:true}).fill(title);
    await page.getByLabel("내용",{exact:true}).fill("등록 성공한 게시글은 미완료 정리로 삭제하면 안 됩니다.");
    await page.route("**/api/community/posts",async route=>{
      const response=await route.fetch();expect(response.status()).toBe(201);
      id=(await response.json()).id;await route.abort("failed");
    });
    await page.getByRole("button",{name:"등록",exact:true}).click();
    await expect(page.locator(".community").getByRole("alert")).toContainText("다시 시도");expect(id).not.toBe("");
    await page.unroute("**/api/community/posts");
    await page.route("**/api/community/**",async route=>{
      if(route.request().method()==="DELETE" && route.request().url().endsWith(id))expect((await page.request.post(`${root}/posts/${id}/publish`)).ok()).toBe(true);
      await route.continue();
    });
    page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"취소",exact:true}).click();
    await expect(page).toHaveURL(new RegExp(`post=${id}$`));
    const saved=await page.request.get(`${root}/posts/${id}`);expect(saved.status()).toBe(200);
    expect((await saved.json()).post.publishedAt).toBeTruthy();await expect(page.locator(".community-post-title")).toHaveText(title);
  }finally{if(id)await page.request.delete(`${root}/posts/${id}`);}
});
