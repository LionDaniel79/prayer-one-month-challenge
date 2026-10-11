import { expect, test } from "@playwright/test";
import { expectNoOverflow, login } from "./helpers";

test.describe("prayer request sidebar unread indicator", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("only the requester sees unread comments across all pages, and reading all clears the menu", async ({ page, browser }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page);
    const adminContext = await browser.newContext();
    const otherContext = await browser.newContext();
    const admin = await adminContext.newPage();
    const other = await otherContext.newPage();
    await login(admin, "admin");
    await login(other, "newcomer");
    await page.clock.install();
    const ids: string[] = [];
    const stamp = Date.now();
    const titles = ["메뉴 알림 이전 요청 A " + stamp, "메뉴 알림 이전 요청 B " + stamp];
    const unread = "/api/prayer-requests/unread";
    const marker = page.locator('.member-nav-link[href="/prayer-requests"] .nav-badge');
    try {
      for (const content of [...titles, ...Array.from({ length: 10 }, (_, i) => "메뉴 검증 새 요청 " + stamp + " " + i)]) {
        const created = await page.request.post("/api/prayer-requests", { data: { content } });
        expect(created.status()).toBe(201);
        ids.push((await created.json()).id);
      }
      const ownComment = await page.request.post("/api/prayer-requests/" + ids[0] + "/comments", { data: { content: "신청자의 댓글", clientId: crypto.randomUUID(), asAdmin: false } });
      expect(ownComment.status()).toBe(201);
      expect(await (await page.request.get(unread)).json()).toEqual({ hasUnread: false });
      for (const id of ids.slice(0, 2)) {
        expect((await admin.request.post("/api/prayer-requests/" + id + "/comments", { data: { content: "메뉴 알림 관리자 답글", clientId: crypto.randomUUID(), asAdmin: true } })).status()).toBe(201);
      }
      const firstPage = (await (await page.request.get("/api/prayer-requests?page=0")).json()).requests;
      expect(firstPage.some((row: { id: string }) => ids.slice(0, 2).includes(row.id))).toBe(false);
      const flag = await page.request.get(unread);
      expect(flag.headers()["cache-control"]).toContain("no-store");
      expect(await flag.json()).toEqual({ hasUnread: true });
      expect(await (await other.request.get(unread)).json()).toEqual({ hasUnread: false });
      expect(await (await admin.request.get(unread)).json()).toEqual({ hasUnread: false });

      await page.goto("/profile");
      await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
      await expect(marker).toHaveText("!");
      await expect(marker).toBeVisible();
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath("prayer-sidebar-unread-mobile.png"), fullPage: true, animations: "disabled" });
      await page.locator('.member-nav-link[href="/prayer-requests"]').click();
      await expect(marker).toHaveText("!");
      await page.getByRole("navigation", { name: "기도요청 목록 페이지" }).getByRole("button", { name: "다음", exact: true }).click();
      for (const [index, title] of titles.entries()) {
        const card = page.getByRole("article", { name: "내 기도요청 항목" }).filter({ hasText: title });
        await card.locator(".prayer-request-summary").click();
        await card.getByText("메뉴 알림 관리자 답글", { exact: true }).scrollIntoViewIfNeeded();
        await expect(card.getByRole("img", { name: "읽지 않은 관리자 댓글" })).toHaveCount(0);
        if (index === 0) await expect(marker).toHaveText("!");
      }
      // No clock advance: the successful read acknowledgement updates the menu immediately.
      await expect(marker).toHaveCount(0);
      await page.goto("/profile");
      expect((await admin.request.post("/api/prayer-requests/" + ids[0] + "/comments", { data: { content: "다른 화면에서도 새 댓글 알림", clientId: crypto.randomUUID(), asAdmin: true } })).status()).toBe(201);
      await page.clock.fastForward(15000);
      await expect(marker).toHaveText("!");
      await page.reload();
      await expect(marker).toHaveText("!");
    } finally {
      for (const id of ids) expect((await admin.request.delete("/api/admin/prayer-requests/" + id)).ok()).toBe(true);
      await Promise.all([adminContext.close(), otherContext.close()]);
    }
  });

  test("a read event during an in-flight badge request refreshes before showing stale state", async ({ page }) => {
    await login(page);
    let calls = 0;
    let release: (() => Promise<void>) | undefined;
    await page.route("**/api/prayer-requests/unread", route => {
      calls++;
      if (calls === 1) {
        release = () => route.fulfill({ json: { hasUnread: true } });
        return;
      }
      return route.fulfill({ json: { hasUnread: false } });
    });
    await page.goto("/profile");
    await expect.poll(() => !!release).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event("prayer-comments:read")));
    await release!();
    await expect.poll(() => calls).toBe(2);
    await expect(page.locator('.member-nav-link[href="/prayer-requests"] .nav-badge')).toHaveCount(0);
  });
});
