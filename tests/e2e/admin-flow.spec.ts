import { expect, test } from "@playwright/test";
import { expectNoOverflow, login } from "./helpers";

const pages = [
  ["/admin", "대시보드"], ["/admin/prayer", "기도운동 관리"],
  ["/admin/visits", "심방 신청 관리"], ["/admin/prayer-requests", "기도요청 관리"],
  ["/admin/notices", "공지 관리"], ["/admin/users", "사용자 관리"], ["/admin/settings", "설정"],
] as const;

test.describe("database-backed administrator flows", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database, never a production session.");

  test("logs in normally and opens all seven focused management pages", async ({ page }, testInfo) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await login(page, "admin");
    for (const [path, heading] of pages) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
      await expectNoOverflow(page);
      if (path === "/admin/prayer") await expect(page.getByRole("heading", { name: "참여자 명단" })).toBeVisible();
      if (path === "/admin/users") await expect(page.getByLabel("허용 명단 검색")).toBeVisible();
    }
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "대시보드", exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("admin-desktop.png"), fullPage: true });
    expect(errors).toEqual([]);
  });

  test("mobile admin drawer navigates without horizontal overflow", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page, "admin");
    await page.goto("/admin");
    await page.getByRole("button", { name: "관리자 메뉴 열기" }).click();
    await expect(page.getByRole("navigation", { name: "관리자 메뉴", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "기도운동 관리", exact: true }).click();
    await expect(page.getByRole("heading", { name: "기도운동 관리", exact: true })).toBeVisible();
    await expect(page.locator(".admin-hub-sidebar")).not.toHaveClass(/is-open/);
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("admin-mobile.png"), fullPage: true });
  });

  test("Calendar setup reports missing configuration and invalid OAuth state safely", async ({ page }) => {
    await login(page, "admin");
    const status = await page.request.get("/api/admin/google-calendar/status");
    expect(status.status()).toBe(200);
    expect(await status.json()).toEqual({ connected: false, accountEmail: null, selectedCalendarId: null, selectedCalendarName: null });
    const connect = await page.request.get("/api/admin/google-calendar/connect", { maxRedirects: 0 });
    expect(connect.status()).toBe(503);
    expect(await connect.json()).toEqual({ code: "GOOGLE_CALENDAR_NOT_CONFIGURED" });
    const callback = await page.request.get("/api/admin/google-calendar/callback?code=synthetic&state=invalid", { maxRedirects: 0 });
    expect(callback.status()).toBe(400);
    expect(await callback.json()).toEqual({ code: "GOOGLE_OAUTH_STATE_MISMATCH" });
    const disconnect = await page.request.delete("/api/admin/google-calendar/connection");
    expect(disconnect.status()).toBe(200);
    expect(await disconnect.json()).toEqual({ status: "ok" });
  });
});
