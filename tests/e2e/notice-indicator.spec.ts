import { expect, test } from "@playwright/test";
import { login, expectNoOverflow } from "./helpers";

test("new notices show ! without device notifications and clear when read", async ({ page, browser }) => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires disposable CI DB");
  await page.addInitScript(() => { Object.defineProperty(window, "Notification", { value: undefined, configurable: true }); });
  await page.setViewportSize({width:360,height:800});
  await login(page);
  const notices = (await (await page.request.get("/api/notices")).json()).notices;
  for (const notice of notices) await page.request.get(`/api/notices/${notice.id}`);
  await page.clock.install();
  await page.goto("/prayer-requests");
  const marker = page.locator('.member-nav-link[href="/notices"] .nav-badge');
  await expect(marker).toHaveCount(0);
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  let noticeId: string | undefined;
  try {
    await login(admin, "admin");
    await page.bringToFront();
    const created = await admin.request.post("/api/admin/notices", {data:{title:"앱 안 새 공지 표시 검증",body:"일회용 알림 검사",status:"published"}});
    expect(created.status()).toBe(201);
    noticeId = (await created.json()).notice.id;
    await page.clock.fastForward(30_000);
    await expect(marker).toHaveText("!");
    await expect(page.locator('.community-menu-button .nav-badge')).toBeVisible();
    await page.getByRole("button", {name:"메뉴 열기",exact:true}).click();
    await expect(marker).toBeVisible();
    await page.locator('.member-nav-link[href="/notices"]').click();
    await expect(page.getByRole("heading", {name:"공지",exact:true})).toBeVisible();
    await expect(marker).toHaveText("!");
    const link = page.getByRole("link", {name:/앱 안 새 공지 표시 검증/});
    await expect(link).toContainText("NEW");
    await page.clock.fastForward(30_000);
    expect((await (await page.request.get("/api/notices/unread-count")).json()).count).toBe(1);
    await link.click();
    await expect(page.getByRole("heading", {name:"앱 안 새 공지 표시 검증",exact:true})).toBeVisible();
    await expect(marker).toHaveCount(0);
    await expect(page.locator('.community-menu-button .nav-badge')).toHaveCount(0);
    await page.reload();
    await expect(marker).toHaveCount(0);
    await expectNoOverflow(page);
  } finally {
    if (noticeId) expect((await admin.request.delete(`/api/admin/notices/${noticeId}`)).ok()).toBe(true);
    await adminContext.close();
  }
});
