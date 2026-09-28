import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { login, expectNoOverflow } from "./helpers";

test("notice images stay private, survive edits and render before two lines of space", async ({page, browser, request}) => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires disposable CI DB");
  await page.setViewportSize({width: 360, height: 800});
  await login(page, "admin");
  const memberContext = await browser.newContext({viewport: {width: 360, height: 800}});
  const member = await memberContext.newPage();
  const png = await sharp({create: {width: 1200, height: 600, channels: 3, background: "#469aca"}}).png().toBuffer();
  const file = {name: "안내.png", mimeType: "image/png", buffer: png};
  const title = `이미지 공지 실제 저장 검증 ${randomUUID().slice(0, 8)}`;
  let id: string | undefined;
  try {
    await login(member);
    await page.goto("/admin/notices");
    await page.getByLabel("제목", {exact: true}).fill(title);
    await page.getByRole("textbox", {name: "내용", exact: true}).fill("첫 번째 줄\n두 번째 줄");
    await page.getByLabel("이미지 첨부 (선택)", {exact: true}).setInputFiles(file);
    await expect(page.getByAltText("첨부 이미지 미리보기")).toBeVisible();
    await expectNoOverflow(page);
    await page.route("**/api/admin/notices", async route => {
      if (route.request().method() === "POST") await route.fulfill({status: 503, contentType: "application/json", body: '{}'});
      else await route.continue();
    });
    await page.getByRole("button", {name: "임시저장", exact: true}).click();
    await expect(page.getByRole("alert").filter({hasText: "공지 저장에 실패했습니다"})).toBeVisible();
    await expect(page.getByAltText("첨부 이미지 미리보기")).toBeVisible();
    await expect(page.getByLabel("제목", {exact: true})).toHaveValue(title);
    await page.unroute("**/api/admin/notices");
    const saved = page.waitForResponse(r => r.url().endsWith("/api/admin/notices") && r.request().method() === "POST");
    await page.getByRole("button", {name: "임시저장", exact: true}).click();
    const response = await saved;
    expect(response.status()).toBe(201);
    id = (await response.json()).notice.id;
    const imagePath = `/api/notices/${id}/image`;
    expect((await request.get(imagePath)).status()).toBe(401);
    expect((await member.request.get(imagePath)).status()).toBe(404);
    expect((await page.request.get(imagePath)).headers()["content-type"]).toBe("image/webp");
    const row = page.locator(".admin-notice-row").filter({hasText: title});
    await row.getByRole("button", {name: "수정", exact: true}).click();
    await expect(page.getByAltText("첨부 이미지 미리보기")).toBeVisible();
    await page.getByRole("textbox", {name: "내용", exact: true}).fill("새 본문 첫 줄\n새 본문 둘째 줄");
    const published = page.waitForResponse(r => r.url().endsWith(`/api/admin/notices/${id}`) && r.request().method() === "PATCH");
    await page.getByRole("button", {name: "발행", exact: true}).click();
    expect((await published).status()).toBe(200);
    await member.goto(`/notices/${id}`);
    const image = member.getByAltText(`${title} 첨부 이미지`);
    await expect(image).toBeVisible();
    await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBe(1200);
    await expect(member.locator(".notice-body")).toHaveText("새 본문 첫 줄\n새 본문 둘째 줄");
    const layout = await member.locator(".notice-content").evaluate(element => {
      const img = element.querySelector("img")!;
      const body = element.querySelector(".notice-body")!;
      return {gap: body.getBoundingClientRect().top - img.getBoundingClientRect().bottom, line: parseFloat(getComputedStyle(body).lineHeight)};
    });
    expect(layout.gap).toBeCloseTo(layout.line * 2, 0);
    await expectNoOverflow(member);
    await member.screenshot({path: test.info().outputPath("notice-image-mobile.png"), fullPage: true});
    const originalImage = await member.request.get(imagePath);
    const etag = originalImage.headers().etag;
    expect((await member.request.get(imagePath, {headers: {"if-none-match": etag}})).status()).toBe(304);
    expect(originalImage.headers()["cache-control"]).toBe("private, no-cache");
    // Invalid files and member mutations cannot modify the saved notice.
    expect((await member.request.patch(`/api/admin/notices/${id}`, {multipart: {title, body: "침입", status: "published", image: file}})).status()).toBe(403);
    expect((await page.request.patch(`/api/admin/notices/${id}`, {multipart: {title, body: "잘못된 수정", status: "published", image: {...file, buffer: Buffer.from("<script>bad</script>")}}})).status()).toBe(400);
    expect((await (await member.request.get(`/api/notices/${id}`)).json()).notice.body).toBe("새 본문 첫 줄\n새 본문 둘째 줄");
    // Replace through the editor, then text-only JSON edits must preserve the new image.
    await page.reload();
    await row.getByRole("button", {name: "수정", exact: true}).click();
    const replacement = {...file, buffer: await sharp({create: {width: 400, height: 800, channels: 3, background: "#dd6688"}}).png().toBuffer()};
    await page.getByLabel("이미지 첨부 (선택)", {exact: true}).setInputFiles(replacement);
    const replaced = page.waitForResponse(r => r.url().endsWith(`/api/admin/notices/${id}`) && r.request().method() === "PATCH");
    await page.getByRole("button", {name: "발행", exact: true}).click();
    expect((await replaced).ok()).toBe(true);
    const replacedImage = await member.request.get(imagePath, {headers: {"if-none-match": etag}});
    expect(replacedImage.status()).toBe(200);
    expect((await sharp(await replacedImage.body()).metadata()).width).toBe(400);
    const payload = {title, body: "마지막 본문", status: "published"};
    expect((await page.request.patch(`/api/admin/notices/${id}`, {data: payload})).ok()).toBe(true);
    expect((await member.request.get(imagePath)).headers().etag).toBe(replacedImage.headers().etag);
    // Returning to draft revokes access even with a previously valid ETag.
    expect((await page.request.patch(`/api/admin/notices/${id}`, {data: {...payload, status: "draft"}})).ok()).toBe(true);
    expect((await member.request.get(imagePath, {headers: {"if-none-match": replacedImage.headers().etag}})).status()).toBe(404);
    await page.reload();
    await row.getByRole("button", {name: "수정", exact: true}).click();
    await page.getByRole("button", {name: "이미지 삭제", exact: true}).click();
    await expect(page.getByAltText("첨부 이미지 미리보기")).toHaveCount(0);
    const removed = page.waitForResponse(r => r.url().endsWith(`/api/admin/notices/${id}`) && r.request().method() === "PATCH");
    await page.getByRole("button", {name: "발행", exact: true}).click();
    expect((await removed).ok()).toBe(true);
    expect((await page.request.get(imagePath)).status()).toBe(404);
    await member.goto(`/notices/${id}`);
    await expect(member.locator(".notice-image")).toHaveCount(0);
    await expect(member.locator(".notice-body")).toHaveText("마지막 본문");
    // Deleting the notice removes its attachment too.
    expect((await page.request.patch(`/api/admin/notices/${id}`, {multipart: {...payload, image: file}})).ok()).toBe(true);
    expect((await page.request.delete(`/api/admin/notices/${id}`)).ok()).toBe(true);
    expect((await page.request.get(imagePath)).status()).toBe(404);
    id = undefined;
  } finally {
    if (id) await page.request.delete(`/api/admin/notices/${id}`).catch(() => {});
    await memberContext.close();
  }
});
