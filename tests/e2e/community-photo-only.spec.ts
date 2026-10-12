import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { expect, test } from "@playwright/test";
import { expectNoOverflow, login } from "./helpers";

const root = "/api/community";
const hash = (data: Buffer) => createHash("sha256").update(data).digest("hex");
const photo = () => sharp({ create: { width: 480, height: 320, channels: 3, background: "#afc9df" } }).png().toBuffer();
test.beforeEach(() => test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires disposable CI DB"));

test("photo-only posts publish after upload retry and can retain photos or become text-only", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await login(page);
  const folderId = (await (await page.request.get(root + "/folders")).json()).folders[0].id;
  const image = await photo();
  let id = "";
  try {
    await page.goto(`/community?folder=${folderId}&new=1`);
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("사진으로 전하는 소식");
    const body = page.getByRole("textbox", { name: "내용", exact: true });
    const publish = page.getByRole("button", { name: "등록", exact: true });
    await body.fill(" \n ");
    await expect(publish).toBeDisabled();
    await page.locator('input[type="file"]').setInputFiles({ name: "소식.png", mimeType: "image/png", buffer: image });
    await expect(publish).toBeEnabled();
    await page.route("**/api/community/posts/*/files/*/chunks/*", route => route.fulfill({ status: 503, json: {} }));
    const created = page.waitForResponse(response => response.url().endsWith(root + "/posts") && response.request().method() === "POST");
    await publish.click();
    const response = await created;
    expect(response.status()).toBe(201);
    id = (await response.json()).id;
    await expect(page.locator(".community").getByRole("alert")).toContainText("다시 시도");
    expect((await (await page.request.get(`${root}/posts/${id}`)).json()).post.publishedAt).toBeNull();
    await page.unroute("**/api/community/posts/*/files/*/chunks/*");
    await publish.click();
    await expect(page).toHaveURL(new RegExp(`post=${id}$`));
    await expect.poll(() => page.locator(".community-photo img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(page.locator(".community-post > .community-body")).toHaveCount(0);
    let saved = (await (await page.request.get(`${root}/posts/${id}`)).json()).post;
    expect(saved.body).toBe(""); expect(saved.publishedAt).toBeTruthy(); expect(saved.files).toHaveLength(1);
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("community-photo-only-mobile.png"), fullPage: true, animations: "disabled" });

    await page.getByRole("link", { name: "게시글 수정", exact: true }).click();
    await page.getByRole("textbox", { name: "제목", exact: true }).fill("사진만 유지한 수정 소식");
    await page.getByRole("button", { name: "수정 저장", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`post=${id}$`));
    await expect(page.locator(".community-post-title")).toHaveText("사진만 유지한 수정 소식");
    await page.getByRole("link", { name: "게시글 수정", exact: true }).click();
    await page.getByRole("button", { name: "소식.png 첨부 제거", exact: true }).click();
    await expect(page.getByRole("button", { name: "수정 저장", exact: true })).toBeDisabled();
    await body.fill("이번에는 글로만 소식을 전합니다.");
    await page.getByRole("button", { name: "수정 저장", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`post=${id}$`));
    await expect(page.locator(".community-post > .community-body")).toHaveText("이번에는 글로만 소식을 전합니다.");
    await expect(page.locator(".community-photos")).toHaveCount(0);
    saved = (await (await page.request.get(`${root}/posts/${id}`)).json()).post;
    expect(saved.files).toEqual([]);

    await page.getByRole("link", { name: "게시글 수정", exact: true }).click();
    await body.fill("");
    await page.locator('input[type="file"]').setInputFiles({ name: "새사진.png", mimeType: "image/png", buffer: image });
    await page.getByRole("button", { name: "수정 저장", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`post=${id}$`));
    await page.reload();
    await expect.poll(() => page.locator(".community-photo img").evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    expect((await (await page.request.get(`${root}/posts/${id}`)).json()).post.body).toBe("");
  } finally {
    if (id) expect((await page.request.delete(`${root}/posts/${id}`)).ok()).toBe(true);
  }
});

test("API rejects empty posts and edits, and photo-only publication waits for verified bytes", async ({ page }) => {
  await login(page);
  const folderId = (await (await page.request.get(root + "/folders")).json()).folders[0].id;
  const image = await photo(), document = Buffer.from("첨부 문서");
  const ids = [randomUUID(), randomUUID(), randomUUID()];
  const files = [{ name: "photo.png", size: image.length, sha256: hash(image) }, { name: "document.txt", size: document.length, sha256: hash(document) }];
  const input = { id: ids[0], folderId, title: "사진만 게시 API 검증", body: "", files };
  try {
    for (const attachments of [[], [files[1]]]) {
      const result = await page.request.post(root + "/posts", { data: { ...input, files: attachments } });
      expect(result.status()).toBe(400); expect((await result.json()).code).toBe("POST_CONTENT_REQUIRED");
    }
    expect((await page.request.post(root + "/posts", { data: input })).status()).toBe(201);
    const postUrl = `${root}/posts/${ids[0]}`;
    expect((await page.request.post(postUrl + "/publish")).status()).toBe(409);
    expect((await page.request.put(postUrl + "/files/0/chunks/0", { data: Buffer.alloc(image.length), headers: { "content-type": "application/octet-stream" } })).ok()).toBe(true);
    expect((await (await page.request.post(postUrl + "/publish")).json()).code).toBe("FILE_INTEGRITY_FAILED");
    for (const [slot, data] of [image, document].entries()) {
      expect((await page.request.put(postUrl + `/files/${slot}/chunks/0`, { data, headers: { "content-type": "application/octet-stream" } })).ok()).toBe(true);
    }
    expect((await page.request.post(postUrl + "/publish")).ok()).toBe(true);
    expect((await page.request.put(postUrl, { data: { title: input.title, body: " " } })).ok()).toBe(true);
    const stored = (await (await page.request.get(postUrl)).json()).post;
    for (const keepSlots of [[], [1]]) {
      const edit = await page.request.post(postUrl + "/edits", { data: { id: randomUUID(), baseVersion: stored.version, title: input.title, body: "", keepSlots, files: [] } });
      expect(edit.status()).toBe(400); expect((await edit.json()).code).toBe("POST_CONTENT_REQUIRED");
    }
    expect((await page.request.post(root + "/posts", { data: { ...input, id: ids[1], body: "글만으로 게시", files: [] } })).status()).toBe(201);
    expect((await page.request.post(`${root}/posts/${ids[1]}/publish`)).ok()).toBe(true);
    const emptyUpdate = await page.request.put(`${root}/posts/${ids[1]}`, { data: { title: "빈 글", body: " \n " } });
    expect(emptyUpdate.status()).toBe(400); expect((await emptyUpdate.json()).code).toBe("POST_CONTENT_REQUIRED");
    expect((await (await page.request.get(`${root}/posts/${ids[1]}`)).json()).post.body).toBe("글만으로 게시");
    // A file name and a valid hash do not prove that the attachment is a photo.
    const fakePhoto = Buffer.from("x");
    const fakeFiles = [{ name: "renamed.png", size: fakePhoto.length, sha256: hash(fakePhoto) }];
    expect((await page.request.post(root + "/posts", { data: { ...input, id: ids[2], files: fakeFiles } })).status()).toBe(201);
    const fakeUrl = `${root}/posts/${ids[2]}`;
    expect((await page.request.put(fakeUrl + "/files/0/chunks/0", { data: fakePhoto, headers: { "content-type": "application/octet-stream" } })).ok()).toBe(true);
    expect((await (await page.request.post(fakeUrl + "/publish")).json()).code).toBe("INVALID_POST_PHOTO");
    // The existing text-with-attachment workflow stays usable, but clearing its body is rejected.
    expect((await page.request.put(fakeUrl, { data: { title: "본문이 있는 첨부 글", body: "파일 설명" } })).ok()).toBe(true);
    expect((await page.request.post(fakeUrl + "/publish")).ok()).toBe(true);
    expect((await (await page.request.put(fakeUrl, { data: { title: "사진만", body: "" } })).json()).code).toBe("INVALID_POST_PHOTO");
    const fakeStored = (await (await page.request.get(fakeUrl)).json()).post;
    const editId = randomUUID();
    expect((await page.request.post(fakeUrl + "/edits", { data: { id: editId, baseVersion: fakeStored.version, title: "사진만 수정", body: "", keepSlots: [0], files: [] } })).status()).toBe(201);
    expect((await (await page.request.post(fakeUrl + `/edits/${editId}/commit`)).json()).code).toBe("INVALID_POST_PHOTO");
    expect((await (await page.request.get(fakeUrl)).json()).post.body).toBe("파일 설명");
  } finally {
    for (const id of ids) await page.request.delete(`${root}/posts/${id}`);
  }
});
