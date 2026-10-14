import { expect, test } from "@playwright/test";
import { expectNoOverflow, login } from "./helpers";

test.describe("private prayer conversations", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("requester edits, sees praying status, reads admin comment badge, replies and completes", async ({ page, browser }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
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
      const summary = card.locator(".prayer-request-summary");
      await expect(summary.locator("time")).not.toContainText(":");
      await expect(summary).toHaveAttribute("aria-expanded", "false");
      await summary.click();
      await expect(card.getByLabel("댓글 내용")).toBeVisible();
      expect((await card.getByLabel("댓글 내용").boundingBox())?.height).toBe(90);
      await expect(card.getByRole("button", { name: /댓글 (보기|닫기)/ })).toHaveCount(0);
      await expect(card.getByText("신청자와 관리자만 볼 수 있습니다")).toHaveCount(0);
      await card.getByRole("button", { name: "수정", exact: true }).click();
      const edited = content + " 수정한 내용";
      await card.getByLabel("기도내용 수정").fill(edited);
      await card.getByRole("button", { name: "수정 저장" }).click();
      await expect(card.locator(".prayer-request-body")).toHaveText(edited);
      await summary.click();

      await admin.goto("/admin/prayer-requests");
      await admin.getByRole("button").filter({ hasText: edited }).click();
      await admin.getByRole("button", { name: "기도중", exact: true }).click();
      await expect(admin.getByRole("button", { name: "기도중", exact: true })).toBeDisabled();
      await expect(admin.locator(".admin-request-actions").getByRole("button", { name: "기도요청 삭제" })).toHaveClass(/danger-button/);
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
      await expectNoOverflow(page);
      const cells = await summary.locator(":scope > *").evaluateAll(elements => elements.map(element => {
        const { top, height } = element.getBoundingClientRect(); return top + height / 2;
      }));
      expect(Math.max(...cells) - Math.min(...cells)).toBeLessThan(2);
      await page.screenshot({ path: testInfo.outputPath("prayer-unread-mobile.png"), fullPage: true, animations: "disabled" });
      await summary.click();
      await card.getByText("관리자와 함께 기도하고 있습니다.", { exact: true }).scrollIntoViewIfNeeded();
      await expect(card.getByText("관리자와 함께 기도하고 있습니다.", { exact: true })).toBeVisible();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await card.getByLabel("댓글 내용").fill("함께 기도해 주셔서 감사합니다.");
      await card.getByRole("button", { name: "댓글 등록", exact: true }).click();
      await expect(card.getByText("함께 기도해 주셔서 감사합니다.", { exact: true })).toBeVisible();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await expect(card.getByRole("button", { name: "댓글 수정", exact: true })).toHaveCount(1);
      await card.getByRole("button", { name: "댓글 수정", exact: true }).click();
      await card.getByLabel("댓글 수정 내용").fill("함께 기도해 주셔서 정말 감사합니다.");
      await card.getByRole("button", { name: "댓글 수정 저장", exact: true }).click();
      // Assert the saved comment, not the textarea value while PATCH is pending.
      await expect(card.locator(".prayer-comment-list p").filter({ hasText: "함께 기도해 주셔서 정말 감사합니다." })).toBeVisible();
      await page.reload();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await summary.click();
      await expect(card.getByText("함께 기도해 주셔서 정말 감사합니다.", { exact: true })).toBeVisible();
      await admin.getByRole("button", { name: "댓글 새로고침" }).click();
      await expect(admin.getByText("함께 기도해 주셔서 정말 감사합니다.", { exact: true })).toBeVisible();
      await expect(admin.getByRole("button", { name: "댓글 수정", exact: true })).toHaveCount(1);
      await admin.getByRole("button", { name: "댓글 수정", exact: true }).click();
      await admin.getByLabel("댓글 수정 내용").fill("계속 함께 기도하고 있습니다.");
      await admin.getByRole("button", { name: "댓글 수정 저장", exact: true }).click();
      await expect(admin.locator(".prayer-comment-list p").filter({ hasText: "계속 함께 기도하고 있습니다." })).toBeVisible();
      await card.getByRole("button", { name: "댓글 새로고침" }).click();
      await expect(card.getByText("계속 함께 기도하고 있습니다.", { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("prayer-comments-edit-mobile.png"), fullPage: true, animations: "disabled" });
      page.once("dialog", dialog => dialog.accept());
      await card.getByRole("button", { name: "기도 완료", exact: true }).click();
      await expect(card.locator(".prayer-status")).toHaveText("완료");
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
      expect((await page.request.post(comments, { data: { content: "위조 관리자 댓글", clientId: crypto.randomUUID(), asAdmin: true } })).status()).toBe(403);
      const edit = { commentId: first.id, content: "수정된 관리자 댓글", expectedVersion: 1 };
      expect((await page.request.patch(comments, { data: edit })).status()).toBe(404);
      expect((await other.request.patch(comments, { data: edit })).status()).toBe(404);
      expect((await admin.request.patch(comments, { data: { ...edit, content: " " } })).status()).toBe(400);
      expect((await admin.request.patch(comments, { data: { ...edit, expectedVersion: 0 } })).status()).toBe(400);
      expect((await admin.request.patch(comments, { data: edit })).status()).toBe(200);
      expect((await admin.request.patch(comments, { data: edit })).status()).toBe(200);
      expect((await (await page.request.get(comments)).json()).comments[0]).toMatchObject({ content: edit.content, version: 2, editedAt: expect.any(String) });
      expect((await admin.request.patch(comments, { data: { ...edit, content: "오래된 댓글 수정" } })).status()).toBe(409);
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
      const reply = await (await page.request.post(comments, { data: { content: "신청자 답글", clientId: crypto.randomUUID(), asAdmin: false } })).json();
      expect((await admin.request.patch(comments, { data: { commentId: reply.id, content: "관리자가 타인 댓글 수정", expectedVersion: 1 } })).status()).toBe(404);
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

  test("administrator replying to their own request alerts only the requester view", async ({ page, browser }) => {
    await login(page, "admin");
    const applicantContext = await browser.newContext();
    const applicant = await applicantContext.newPage();
    await login(applicant, "admin");
    const content = "동일 계정 관리자 댓글 알림 " + Date.now();
    const { id } = await (await page.request.post("/api/prayer-requests", { data: { content } })).json();
    try {
      await applicant.goto("/prayer-requests");
      const card = applicant.getByRole("article", { name: "내 기도요청 항목" }).filter({ hasText: content });
      await expect(card).toBeVisible();
      await page.goto("/admin/prayer-requests");
      await page.getByRole("button").filter({ hasText: content }).click();
      await page.getByLabel("댓글 내용").fill("관리자 화면에서 남긴 댓글");
      await page.getByRole("button", { name: "댓글 등록", exact: true }).click();
      await expect(page.getByText("관리자 화면에서 남긴 댓글", { exact: true })).toBeVisible();
      await applicant.getByRole("button", { name: "목록 새로고침" }).click();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toBeVisible();
      await expect(page.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await card.locator(".prayer-request-summary").click();
      await card.getByText("관리자 화면에서 남긴 댓글", { exact: true }).scrollIntoViewIfNeeded();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      await card.getByLabel("댓글 내용").fill("신청자 화면에서 남긴 댓글");
      await card.getByRole("button", { name: "댓글 등록", exact: true }).click();
      await expect(card.getByText("신청자 화면에서 남긴 댓글", { exact: true })).toBeVisible();
      await applicant.reload();
      await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
      const comments = (await (await applicant.request.get("/api/prayer-requests/" + id + "/comments")).json()).comments;
      expect(comments.map((comment: { authorRole: string }) => comment.authorRole)).toEqual(["admin", "member"]);
    } finally {
      expect((await page.request.delete("/api/admin/prayer-requests/" + id)).ok()).toBe(true);
      await applicantContext.close();
    }
  });

  test("long conversations preserve missing history and only acknowledge visible newest comments", async ({ page }) => {
    await login(page);
    const id = "00000000-0000-4000-8000-000000000991";
    let newest = 100;
    let readThrough = 0;
    let deferOlder = true;
    const edits = new Map<number, { content: string; version: number; editedAt: string }>();
    let releaseOlder: (() => Promise<void>) | undefined;
    const comment = (sequence: number) => ({
      id: "00000000-0000-4000-8000-" + String(sequence).padStart(12, "0"),
      content: "검증 댓글 " + sequence, authorName: "관리자", authorRole: "admin", isOwn: sequence === 1,
      sequence, createdAt: "2026-10-11T01:00:00Z", version: 1, editedAt: null,
      ...edits.get(sequence),
    });
    await page.route("**/api/prayer-requests?*", route => route.fulfill({ json: { requests: [{
      id, content: "긴 대화 검증", status: "praying", createdAt: "2026-10-11T00:00:00Z",
      version: 1, completedByRequester: false, hasUnreadComments: readThrough < newest,
    }], hasMore: false } }));
    await page.route("**/api/prayer-requests/" + id + "/comments**", route => {
      if (route.request().method() === "PATCH") {
        const body = route.request().postDataJSON();
        if (body.commentId) {
          const sequence = Number(body.commentId.slice(-12));
          const saved = { content: body.content, version: body.expectedVersion + 1, editedAt: "2026-10-11T02:00:00Z" };
          edits.set(sequence, saved);
          return route.fulfill({ json: { status: "ok", comment: { id: body.commentId, ...saved } } });
        }
        readThrough = Math.max(readThrough, Number(body.throughCommentId.slice(-12)));
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
    await page.locator(".prayer-request-summary").click();
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
    // Editing a loaded older comment must update it even outside the latest 50.
    await page.getByRole("button", { name: "댓글 수정", exact: true }).click();
    await page.getByLabel("댓글 수정 내용").fill("오래된 댓글도 수정되었습니다");
    await page.getByRole("button", { name: "댓글 수정 저장", exact: true }).click();
    await expect(page.getByText("오래된 댓글도 수정되었습니다", { exact: true })).toBeVisible();
    await expect(page.locator(".prayer-comment-list li")).toHaveCount(250);
    // A different tab's edit outside the newest page must also refresh locally.
    edits.set(1, { content: "다른 화면에서 수정한 이전 댓글", version: 3, editedAt: "2026-10-11T03:00:00Z" });
    await page.getByRole("button", { name: "댓글 새로고침" }).click();
    await expect(page.getByText("다른 화면에서 수정한 이전 댓글", { exact: true })).toBeVisible();
    // Reading history must leave a newly arrived comment unread.
    await page.getByText("다른 화면에서 수정한 이전 댓글", { exact: true }).scrollIntoViewIfNeeded();
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
