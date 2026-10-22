import { expect, test } from "@playwright/test";
import { expectNoOverflow, login } from "./helpers";

test.describe("admin requester-comment alerts", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("counts only unseen requester comments and opens their requests beside the pending card", async ({ page, browser }, testInfo) => {
    await login(page, "admin");
    const member = await browser.newPage();
    const ids: string[] = [];
    const count = async () => (await (await page.request.get("/api/admin/dashboard")).json()).prayerRequests.unreadComments;
    try {
      await login(member);
      const baseline = await count();
      expect(typeof baseline).toBe("number");
      for (const content of ["댓글 알림 검증 첫째", "댓글 알림 검증 둘째"]) {
        const created = await member.request.post("/api/prayer-requests", { data: { content } });
        expect(created.status()).toBe(201);
        ids.push((await created.json()).id);
      }
      expect((await page.request.patch(`/api/admin/prayer-requests/${ids[0]}`, { data: { status: "completed" } })).ok()).toBe(true);
      const comment = async (index: number, content: string, asAdmin = false) => {
        const response = await (asAdmin ? page : member).request.post(`/api/prayer-requests/${ids[index]}/comments`, {
          data: { content, clientId: crypto.randomUUID(), asAdmin },
        });
        expect(response.status()).toBe(201);
        return (await response.json()).id as string;
      };
      const firstComment = await comment(0, "신청자 첫 댓글");
      await comment(0, "신청자 두 번째 댓글");
      const otherComment = await comment(1, "다른 요청의 댓글");
      const adminComment = await comment(0, "관리자 답변", true);
      expect(await count()).toBe(baseline + 3);
      expect((await page.request.patch(`/api/prayer-requests/${ids[0]}/comments`, {
        data: { throughCommentId: otherComment, asAdmin: true },
      })).status()).toBe(400);
      // A member cannot acknowledge the administrator's incoming alerts.
      expect((await member.request.patch(`/api/prayer-requests/${ids[0]}/comments`, {
        data: { throughCommentId: adminComment, asAdmin: true },
      })).status()).toBe(403);
      expect((await member.request.patch(`/api/prayer-requests/${ids[0]}/comments`, {
        data: { throughCommentId: adminComment },
      })).ok()).toBe(true);
      expect(await count()).toBe(baseline + 3);
      // A stale read acknowledges only the displayed snapshot, leaving later comments unread.
      expect((await page.request.patch(`/api/prayer-requests/${ids[0]}/comments`, {
        data: { throughCommentId: firstComment, asAdmin: true },
      })).ok()).toBe(true);
      expect(await count()).toBe(baseline + 2);

      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto("/admin");
      const alert = page.getByRole("link", { name: /댓글 알림/ });
      await expect(alert).toContainText(`${baseline + 2}건`);
      const pending = page.getByRole("link", { name: /미처리 기도요청/ });
      const [pendingBox, alertBox] = await Promise.all([pending.boundingBox(), alert.boundingBox()]);
      expect(alertBox!.x).toBeGreaterThan(pendingBox!.x);
      expect(alertBox!.y).toBe(pendingBox!.y);
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("admin-comment-alerts-mobile.png"), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: testInfo.outputPath("admin-comment-alerts-desktop.png"), fullPage: true });
      await page.setViewportSize({ width: 360, height: 800 });
      await alert.click();
      await expect(page).toHaveURL(/unreadComments=1/);
      const first = page.locator(".admin-request-row").filter({ hasText: "댓글 알림 검증 첫째" });
      await expect(first).toBeVisible();
      await expect(first.getByRole("img", { name: "미확인 신청자 댓글" })).toBeVisible();
      await first.click();
      await expect(page.getByText("신청자 두 번째 댓글", { exact: true })).toBeVisible();
      await page.getByText("관리자 답변", { exact: true }).scrollIntoViewIfNeeded();
      await expect.poll(count).toBe(baseline + 1);
      expect((await page.request.patch(`/api/prayer-requests/${ids[0]}/comments`, {
        data: { throughCommentId: firstComment, asAdmin: true },
      })).ok()).toBe(true);
      expect(await count()).toBe(baseline + 1);
      // An admin viewing the conversation must not clear the owner's separate unread cursor.
      const own = await (await member.request.get("/api/prayer-requests")).json();
      expect(own.requests.find((request: { id: string }) => request.id === ids[0]).hasUnreadComments).toBe(false);
      await comment(0, "새 관리자 답변", true);
      await page.getByRole("button", { name: "댓글 새로고침", exact: true }).click();
      await expect(page.getByText("새 관리자 답변", { exact: true })).toBeVisible();
      await expect.poll(count).toBe(baseline + 1);
      const after = await (await member.request.get("/api/prayer-requests")).json();
      expect(after.requests.find((request: { id: string }) => request.id === ids[0]).hasUnreadComments).toBe(true);
      await comment(0, "확인 후 도착한 신청자 댓글");
      await expect.poll(count).toBe(baseline + 2);
      await page.clock.install();
      await page.goto("/admin");
      await expect(alert).toContainText(`${baseline + 2}건`);
      await comment(1, "대시보드 자동 갱신 검증");
      await page.clock.fastForward(15000);
      await expect(alert).toContainText(`${baseline + 3}건`);
    } finally {
      for (const id of ids) await page.request.delete(`/api/admin/prayer-requests/${id}`);
      await member.close();
    }
  });
});
