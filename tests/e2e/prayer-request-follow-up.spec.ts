import { expect, test } from "@playwright/test";
import { expectNoOverflow, login } from "./helpers";

test.describe("private prayer conversations", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("requester edits, sees praying status, reads admin comment badge, replies and completes", async ({ page, browser }, testInfo) => {
    const adminContext = await browser.newContext();
    const admin = await adminContext.newPage();
    await login(admin, "admin");
    await login(page);
    let id = "";
    try {
      await page.goto("/prayer-requests");
      const content = "함께 기도할 비공개 요청 " + Date.now();
      await page.getByLabel("기도 요청 내용").fill(content);
      const saved = page.waitForResponse(response => response.url().endsWith("/api/prayer-requests") && response.request().method() === "POST");
      await page.getByRole("button", { name: "접수", exact: true }).click();
      const response = await saved;
      expect(response.status()).toBe(201);
      id = (await response.json()).id;
      const card = page.getByRole("article", { name: "내 기도요청 항목" }).filter({ hasText: content });
      await expect(card).toBeVisible();
      await card.getByRole("button", { name: "수정", exact: true }).click();
      const edited = content + " 수정한 내용";
      await card.getByLabel("기도내용 수정").fill(edited);
      await card.getByRole("button", { name: "수정 저장" }).click();
      await expect(card.locator(".prayer-request-body")).toHaveText(edited);

      await admin.goto("/admin/prayer-requests");
      await admin.getByRole("button").filter({ hasText: edited }).click();
      await admin.getByRole("button", { name: "기도중", exact: true }).click();
      await expect(admin.getByRole("button", { name: "기도중", exact: true })).toBeDisabled();
      await page.getByRole("button", { name: "목록 새로고침" }).click();
      await expect(card.locator(".prayer-status")).toHaveText("기도중");
      await admin.getByLabel("댓글 내용").fill("관리자와 함께 기도하고 있습니다.");
      await admin.getByRole("button", { name: "댓글 등록", exact: true }).click();
      await expect(admin.getByText("관리자와 함께 기도하고 있습니다.", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "목록 새로고침" }).click();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toBeVisible();
      await expect(admin.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await page.reload();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toBeVisible();
      await page.setViewportSize({ width: 360, height: 800 });
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("prayer-unread-mobile.png"), fullPage: true });
      await card.getByRole("button", { name: "댓글 보기" }).click();
      await card.getByText("관리자와 함께 기도하고 있습니다.", { exact: true }).scrollIntoViewIfNeeded();
      await expect(card.getByText("관리자와 함께 기도하고 있습니다.", { exact: true })).toBeVisible();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await card.getByLabel("댓글 내용").fill("함께 기도해 주셔서 감사합니다.");
      await card.getByRole("button", { name: "댓글 등록", exact: true }).click();
      await expect(card.getByText("함께 기도해 주셔서 감사합니다.", { exact: true })).toBeVisible();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await page.reload();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await admin.getByRole("button", { name: "댓글 새로고침" }).click();
      await expect(admin.getByText("함께 기도해 주셔서 감사합니다.", { exact: true })).toBeVisible();
      page.once("dialog", dialog => dialog.accept());
      await card.getByRole("button", { name: "기도 완료", exact: true }).click();
      await expect(card.locator(".prayer-status")).toHaveText("완료 · 내가 완료");
      await admin.getByRole("button", { name: "목록 새로고침" }).click();
      await expect(admin.getByRole("button").filter({ hasText: edited })).toContainText("신청자 완료");
      await expect(admin.getByText(/신청자가 기도 완료로 표시했습니다/)).toBeVisible();
      await admin.screenshot({ path: testInfo.outputPath("prayer-applicant-completed.png"), fullPage: true });
    } finally {
      if (id) expect((await admin.request.delete("/api/admin/prayer-requests/" + id)).ok()).toBe(true);
      await adminContext.close();
    }
  });

  test("authorization, stale edits, read cursors, comment retries and private headers hold at the real API", async ({ page, browser }) => {
    const adminContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const anonymous = await browser.newContext();
    const admin = await adminContext.newPage();
    const other = await otherContext.newPage();
    await login(page);
    await login(admin, "admin");
    await login(other, "newcomer");
    const created = await page.request.post("/api/prayer-requests", { data: { content: "권한 및 읽음 상태 검증 " + Date.now() } });
    const { id } = await created.json();
    const item = "/api/prayer-requests/" + id;
    const comments = item + "/comments";
    try {
      expect((await anonymous.request.get("/api/prayer-requests")).status()).toBe(401);
      for (const operation of [
        () => other.request.patch(item, { data: { content: "타인 수정", expectedVersion: 1 } }),
        () => other.request.patch(item, { data: { complete: true } }),
        () => other.request.get(comments),
        () => other.request.post(comments, { data: { content: "타인 댓글", clientId: crypto.randomUUID() } }),
        () => other.request.patch(comments, { data: { throughCommentId: crypto.randomUUID() } }),
      ]) expect((await operation()).status()).toBe(404);
      expect((await (await other.request.get("/api/prayer-requests")).json()).requests.some((row: { id: string }) => row.id === id)).toBe(false);
      expect((await page.request.patch(item, { data: { status: "praying" } })).status()).toBe(400);
      expect((await page.request.patch(item, { headers: { origin: "https://foreign.test" }, data: { complete: true } })).status()).toBe(403);
      expect((await page.request.get(comments)).headers()["cache-control"]).toContain("no-store");
      expect((await admin.request.patch(item, { data: { complete: true } })).status()).toBe(404);
      await admin.request.patch("/api/admin/prayer-requests/" + id, { data: { status: "praying" } });
      expect((await page.request.patch(item, { data: { content: "오래된 수정", expectedVersion: 1 } })).status()).toBe(409);
      const own = async () => (await (await page.request.get("/api/prayer-requests")).json()).requests.find((row: { id: string }) => row.id === id);
      expect(await own()).toMatchObject({ status: "praying", version: 2, hasUnreadComments: false });
      const payload = { content: "첫 번째 관리자 댓글", clientId: crypto.randomUUID() };
      const first = await (await admin.request.post(comments, { data: payload })).json();
      const retry = await (await admin.request.post(comments, { data: payload })).json();
      expect(retry.id).toBe(first.id);
      expect((await (await page.request.get(comments)).json()).comments).toHaveLength(1);
      expect(await own()).toMatchObject({ hasUnreadComments: true });
      // Viewing as administrator cannot clear the owner's unread state.
      await admin.request.get(comments);
      expect((await admin.request.patch(comments, { data: { throughCommentId: first.id } })).status()).toBe(404);
      const second = await (await admin.request.post(comments, { data: { content: "늦게 도착한 댓글", clientId: crypto.randomUUID() } })).json();
      await page.request.patch(comments, { data: { throughCommentId: first.id } });
      expect(await own()).toMatchObject({ hasUnreadComments: true });
      await page.request.patch(comments, { data: { throughCommentId: second.id } });
      expect(await own()).toMatchObject({ hasUnreadComments: false });
      // A stale acknowledgement must never move the cursor backwards.
      await page.request.patch(comments, { data: { throughCommentId: first.id } });
      expect(await own()).toMatchObject({ hasUnreadComments: false });
      await page.request.post(comments, { data: { content: "신청자 답글", clientId: crypto.randomUUID() } });
      expect(await own()).toMatchObject({ hasUnreadComments: false });
      expect((await page.request.post(comments, { data: { content: "가".repeat(2001), clientId: crypto.randomUUID() } })).status()).toBe(400);
      await page.request.patch(item, { data: { complete: true } });
      await page.request.patch(item, { data: { complete: true } });
      expect(await own()).toMatchObject({ status: "completed", completedByRequester: true, version: 3 });
      await admin.request.patch("/api/admin/prayer-requests/" + id, { data: { status: "praying" } });
      expect(await own()).toMatchObject({ status: "praying", completedByRequester: false });
    } finally {
      expect((await admin.request.delete("/api/admin/prayer-requests/" + id)).ok()).toBe(true);
      await Promise.all([adminContext.close(), otherContext.close(), anonymous.close()]);
    }
  });

  test("long conversations preserve missing history and only acknowledge visible newest comments", async ({ page }) => {
    await login(page);
    const id = "00000000-0000-4000-8000-000000000991";
    let newest = 100;
    let readThrough = 0;
    let deferOlder = true;
    let releaseOlder: (() => Promise<void>) | undefined;
    const comment = (sequence: number) => ({
      id: "00000000-0000-4000-8000-" + String(sequence).padStart(12, "0"),
      content: "검증 댓글 " + sequence, authorName: "관리자", authorRole: "admin", isOwn: false,
      sequence, createdAt: "2026-10-11T01:00:00Z",
    });
    await page.route("**/api/prayer-requests?*", route => route.fulfill({ json: { requests: [{
      id, content: "긴 대화 검증", status: "praying", createdAt: "2026-10-11T00:00:00Z",
      version: 1, completedByRequester: false, hasUnreadComments: readThrough < newest,
    }], hasMore: false } }));
    await page.route("**/api/prayer-requests/" + id + "/comments**", route => {
      if (route.request().method() === "PATCH") {
        readThrough = Math.max(readThrough, Number(route.request().postDataJSON().throughCommentId.slice(-12)));
        return route.fulfill({ json: { status: "ok" } });
      }
      const before = Number(new URL(route.request().url()).searchParams.get("before") ?? newest + 1);
      const end = Math.min(newest, before - 1);
      const start = Math.max(1, end - 49);
      const json = { comments: Array.from({ length: end - start + 1 }, (_, i) => comment(start + i)), hasMore: start > 1 };
      if (before === 51 && deferOlder) {
        deferOlder = false;
        releaseOlder = () => route.fulfill({ json });
        return;
      }
      return route.fulfill({ json });
    });
    await page.goto("/prayer-requests");
    await page.getByRole("button", { name: "댓글 보기" }).click();
    await page.getByText("검증 댓글 100", { exact: true }).scrollIntoViewIfNeeded();
    await expect.poll(() => readThrough).toBe(100);
    await page.getByRole("button", { name: "이전 댓글 보기" }).click();
    await expect.poll(() => !!releaseOlder).toBe(true);
    newest = 250;
    await page.getByRole("button", { name: "댓글 새로고침" }).click();
    await expect(page.locator(".prayer-comment-list li")).toHaveCount(50);
    await expect(page.getByText("검증 댓글 250", { exact: true })).toBeAttached();
    await releaseOlder!();
    await expect(page.getByRole("button", { name: "이전 댓글 보기" })).toBeEnabled();
    await expect(page.locator(".prayer-comment-list li")).toHaveCount(50);
    for (const count of [100, 150, 200, 250]) {
      await page.getByRole("button", { name: "이전 댓글 보기" }).click();
      await expect(page.locator(".prayer-comment-list li")).toHaveCount(count);
    }
    await expect(page.getByText("검증 댓글 150", { exact: true })).toBeAttached();
    await expect(page.getByRole("button", { name: "이전 댓글 보기" })).toHaveCount(0);
    // Reading history must leave a newly arrived comment unread.
    await page.getByText("검증 댓글 1", { exact: true }).scrollIntoViewIfNeeded();
    newest = 251;
    const beforeRefresh = readThrough;
    await page.getByRole("button", { name: "댓글 새로고침" }).click();
    await expect(page.getByText("검증 댓글 251", { exact: true })).toBeAttached();
    await page.getByRole("button", { name: "목록 새로고침" }).click();
    await expect(page.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toBeVisible();
    expect(readThrough).toBe(beforeRefresh);
    await page.getByText("검증 댓글 251", { exact: true }).scrollIntoViewIfNeeded();
    await expect.poll(() => readThrough).toBe(251);
    await expect(page.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
  });
});
