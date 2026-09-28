import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, test, type APIRequestContext } from "@playwright/test";
import { login, expectNoOverflow } from "./helpers";
const root = "/api/community";
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
test.beforeEach(() => test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires disposable CI DB"));
async function post(api: APIRequestContext, folderId: string, title: string, files: {name: string; data: Buffer}[] = []) {
  const id = randomUUID();
  expect((await api.post(root + "/posts", {data: {id, folderId, title, body: "원래 본문", files: files.map(f => ({name: f.name, size: f.data.length, sha256: hash(f.data)}))}})).status()).toBe(201);
  for (let slot = 0; slot < files.length; slot++) for (let start = 0, i = 0; start < files[slot].data.length; start += 524288, i++) {
    expect((await api.put(`${root}/posts/${id}/files/${slot}/chunks/${i}`, {headers: {"content-type": "application/octet-stream"}, data: files[slot].data.subarray(start, start + 524288)})).ok()).toBe(true);
  }
  expect((await api.post(`${root}/posts/${id}/publish`)).ok()).toBe(true);
  return id;
}

test("administrator member mode and management mode have different post controls", async ({page, browser}) => {
  const context = await browser.newContext(); const member = await context.newPage(); const ids: string[] = [];
  await login(page, "admin"); await login(member);
  const folderId = (await (await page.request.get(root + "/folders")).json()).folders[0].id;
  try {
    ids.push(await post(member.request, folderId, "다른 성도의 글"));
    ids.push(await post(page.request, folderId, "관리자 본인 글"));
    await page.goto("/community");
    await expect(page.locator(".community-folder-management")).toHaveCount(0);
    const card = page.locator(".community-folder").first();
    const icon = await card.locator(".community-folder-symbol").boundingBox();
    const name = await card.locator("strong").boundingBox();
    expect(Math.abs(icon!.y + icon!.height/2 - name!.y - name!.height/2)).toBeLessThan(8);
    await page.goto(`/community?folder=${folderId}`);
    await expect(page.getByRole("link", {name: "전체 폴더", exact: true})).toHaveCount(1);
    for (const id of ids) {
      await page.goto(`/community?post=${id}`);
      await expect(page.locator(".community-move")).toHaveCount(0);
      await expect(page.getByRole("link", {name: "게시글 수정", exact: true})).toHaveCount(id === ids[1] ? 1 : 0);
      await expect(page.getByRole("button", {name: "게시글 삭제", exact: true})).toHaveCount(id === ids[1] ? 1 : 0);
      await page.goto(`/admin/community?post=${id}&edit=1`);
      await expect(page.locator(".community-editor")).toHaveCount(0);
      await expect(page.getByRole("link", {name: "게시글 수정", exact: true})).toHaveCount(0);
      await expect(page.getByRole("button", {name: "게시글 삭제", exact: true})).toBeVisible();
      await expect(page.getByLabel("이동할 폴더")).toBeVisible();
    }
    expect((await page.request.put(`${root}/posts/${ids[0]}`, {data: {title: "금지", body: "금지"}})).status()).toBe(403);
    expect((await page.request.delete(`${root}/posts/${ids[0]}`)).status()).toBe(403);
    await page.setViewportSize({width: 360, height: 900});
    await page.goto("/admin/community"); await page.locator("summary", {hasText: "폴더 관리"}).click();
    await expect(page.getByLabel("새 폴더 이름")).toBeVisible(); await expectNoOverflow(page);
    await page.screenshot({path: test.info().outputPath("folder-management-360.png"), fullPage: true, animations: "disabled"});
  } finally { for (const id of ids) await page.request.delete(`/api/admin/community/posts/${id}`); await context.close(); }
});

test("folder order is saved, authorized, stale-safe and reflected in member mode", async ({page, browser, request}) => {
  const context = await browser.newContext(); const member = await context.newPage();
  await login(page, "admin"); await login(member); const made: string[] = [];
  try {
    for (const name of ["순서검사 A", "순서검사 B"]) {
      const response = await page.request.post(root + "/folders", {data: {name: name + randomUUID().slice(0,8)}});
      made.push((await response.json()).id);
    }
    const before = (await (await page.request.get(root + "/folders")).json()).folders;
    const oldIds = before.map((f: {id: string}) => f.id); const ids = [...oldIds].reverse();
    expect((await request.patch(root + "/folders/order", {data: {ids, expectedIds: oldIds}})).status()).toBe(401);
    expect((await member.request.patch(root + "/folders/order", {data: {ids, expectedIds: oldIds}})).status()).toBe(403);
    expect((await page.request.patch(root + "/folders/order", {data: {ids: [ids[0], ids[0]], expectedIds: oldIds}})).status()).toBe(400);
    expect((await page.request.patch(root + "/folders/order", {data: {ids, expectedIds: oldIds}})).ok()).toBe(true);
    expect((await page.request.patch(root + "/folders/order", {data: {ids: oldIds, expectedIds: oldIds}})).status()).toBe(409);
    await page.goto("/admin/community"); await page.locator("summary", {hasText: "폴더 관리"}).click();
    const firstName = before.find((f: {id: string}) => f.id === ids[0]).name;
    await page.getByRole("button", {name: `${firstName} 아래로`, exact: true}).click();
    const expected = [...ids]; [expected[0], expected[1]] = [expected[1], expected[0]];
    await expect.poll(async () => (await (await page.request.get(root + "/folders")).json()).folders.map((f: {id: string}) => f.id)).toEqual(expected);
    await member.goto("/community");
    await expect(member.locator(".community-folder").first()).toHaveAttribute("href", `/community?folder=${expected[0]}`);
  } finally { for (const id of made) await page.request.delete(`${root}/folders/${id}`); await context.close(); }
});

test("photos precede body and attachment edits remain atomic and retry-safe", async ({page, browser, request}) => {
  const context = await browser.newContext(); const other = await context.newPage();
  await login(page); await login(other, "admin");
  const folderId = (await (await page.request.get(root + "/folders")).json()).folders[0].id;
  const image = await sharp({create: {width: 640, height: 480, channels: 3, background: "#aabbcc"}}).png().toBuffer();
  const id = await post(page.request, folderId, "사진과 첨부 변경", [{name: "사진.png", data: image}, {name: "기존.txt", data: Buffer.from("보존 전 자료")}]);
  try {
    await page.request.put(`${root}/posts/${id}/like`, {data: {liked: true}});
    await page.request.post(`${root}/posts/${id}/comments`, {data: {id: randomUUID(), body: "보존할 댓글"}});
    await page.setViewportSize({width: 360, height: 900}); await page.goto(`/community?post=${id}`);
    const photo = page.locator(".community-photo img"); await expect(photo).toHaveCount(1);
    await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    const imageBox = await photo.boundingBox(); const bodyBox = await page.locator(".community-post > .community-body").boundingBox();
    expect(bodyBox!.y - imageBox!.y - imageBox!.height).toBeGreaterThanOrEqual(55);
    const src = await photo.getAttribute("src"); expect((await request.get(src!)).status()).toBe(401);
    const preview = await page.request.get(src!); expect(preview.headers()["content-type"]).toContain("image/webp");
    await expectNoOverflow(page); await page.screenshot({path: test.info().outputPath("photo-before-body-360.png"), fullPage: true, animations: "disabled"});
    await page.getByRole("link", {name: "게시글 수정", exact: true}).click();
    await page.getByRole("button", {name: "기존.txt 첨부 제거", exact: true}).click();
    const replacement = Buffer.alloc(6291456, 67);
    await page.locator('input[type="file"]').setInputFiles({name: "새자료.txt", mimeType: "text/plain", buffer: replacement});
    // Match the textbox's accessible name, not a wrapping label's textarea textContent.
    await page.getByRole("textbox", {name: "내용", exact: true}).fill("수정한 본문");
    await page.route("**/edits/*/files/*/chunks/*", route => route.fulfill({status: 503, contentType: "application/json", body: "{}"}));
    await page.getByRole("button", {name: "수정 저장", exact: true}).click();
    await expect(page.locator(".community").getByRole("alert")).toContainText("다시 시도");
    const unchanged = (await (await other.request.get(`${root}/posts/${id}`)).json()).post;
    expect(unchanged.body).toBe("원래 본문"); expect(unchanged.files.map((f: {name: string}) => f.name)).toEqual(["사진.png", "기존.txt"]);
    await page.unroute("**/edits/*/files/*/chunks/*");
    await page.route("**/edits/*/commit", async route => {const response = await route.fetch(); expect(response.ok()).toBe(true); await route.abort("failed");});
    await page.getByRole("button", {name: "수정 저장", exact: true}).click();
    await expect(page.locator(".community").getByRole("alert")).toContainText("다시 시도");
    await page.unroute("**/edits/*/commit"); await page.getByRole("button", {name: "수정 저장", exact: true}).click();
    await expect(page).toHaveURL(new RegExp(`post=${id}$`));
    const saved = (await (await page.request.get(`${root}/posts/${id}`)).json()).post;
    expect(saved.body).toBe("수정한 본문"); expect(saved.files.map((f: {name: string}) => f.name)).toEqual(["사진.png", "새자료.txt"]);
    expect(saved.files[0].sha256).toBe(hash(image)); expect(saved.files[1].sha256).toBe(hash(replacement)); expect(saved.likeCount).toBe(1); expect(saved.version).toBe(2);
    await expect(page.locator(".community-comment")).toContainText("보존할 댓글");
    await page.getByRole("link", {name: "게시글 수정", exact: true}).click();
    for (const name of ["사진.png", "새자료.txt"]) await page.getByRole("button", {name: `${name} 첨부 제거`, exact: true}).click();
    await page.getByRole("button", {name: "수정 저장", exact: true}).click();
    await expect(page).toHaveURL(new RegExp(`post=${id}$`)); await expect(page.locator(".community-download")).toHaveCount(0);
  } finally { await page.request.delete(`${root}/posts/${id}`); await context.close(); }
});

test("edit sessions reject nonauthors, stale versions and excess retained plus new files", async ({page, browser, request}) => {
  const context = await browser.newContext(); const admin = await context.newPage(); await login(page); await login(admin, "admin");
  const folderId = (await (await page.request.get(root + "/folders")).json()).folders[0].id;
  const id = await post(page.request, folderId, "수정 권한 검사", [{name: "하나.txt", data: Buffer.from("1")}, {name: "둘.txt", data: Buffer.from("2")}]);
  try {
    const original = (await (await page.request.get(`${root}/posts/${id}`)).json()).post;
    const data = {id: randomUUID(), baseVersion: original.version, title: "수정 권한 검사", body: "새 본문", keepSlots: [0,1], files: []};
    expect((await request.post(`${root}/posts/${id}/edits`, {data})).status()).toBe(401);
    expect((await admin.request.post(`${root}/posts/${id}/edits`, {data})).status()).toBe(403);
    expect((await page.request.post(`${root}/posts/${id}/edits`, {data: {...data, files: [{name: "셋.txt", size: 1, sha256: hash(Buffer.from("3"))}]}})).status()).toBe(400);
    expect((await page.request.post(`${root}/posts/${id}/edits`, {data})).status()).toBe(201);
    expect((await page.request.put(`${root}/posts/${id}`, {data: {title: "다른 창 수정", body: "더 최신 본문"}})).ok()).toBe(true);
    expect((await page.request.post(`${root}/posts/${id}/edits/${data.id}/commit`)).status()).toBe(409);
    const newer = (await (await page.request.get(`${root}/posts/${id}`)).json()).post; expect(newer.body).toBe("더 최신 본문"); expect(newer.files).toHaveLength(2);
    expect((await page.request.delete(`${root}/posts/${id}/edits/${data.id}`)).ok()).toBe(true);
  } finally { await page.request.delete(`${root}/posts/${id}`); await context.close(); }
});
