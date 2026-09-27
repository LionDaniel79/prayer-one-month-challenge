import { expect, test } from "@playwright/test";
import type { AdminPrayerRequestDetail } from "../../src/features/prayer-requests/types";
import { login } from "./helpers";

const fixture: AdminPrayerRequestDetail = {
  id: "00000000-0000-4000-8000-000000000491",
  requesterName: "삭제검증 성도", createdAt: "2026-09-27T02:00:00Z", status: "received",
  preview: "삭제 확인을 위한 비공개 검증 내용", content: "삭제 확인을 위한 비공개 검증 내용",
};

test.describe("administrator prayer request deletion", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("deletes a submitted request without removing the member's login", async ({ page, browser, baseURL }) => {
    await login(page);
    await page.goto("/prayer-requests");
    const content = `삭제 후 로그인 유지 검증 ${Date.now()}`;
    await page.getByLabel("기도 요청 내용").fill(content);
    const submitted = page.waitForResponse((response) => response.url().endsWith("/api/prayer-requests") && response.request().method() === "POST");
    await page.getByRole("button", { name: "전송", exact: true }).click();
    const created = await submitted;
    expect(created.status()).toBe(201);
    const { id } = await created.json() as { id: string };
    expect((await page.request.delete(`/api/admin/prayer-requests/${id}`)).status()).toBe(403);

    const adminContext = await browser.newContext({ baseURL });
    try {
      const admin = await adminContext.newPage();
      await login(admin, "admin");
      await admin.goto(`/admin/prayer-requests?id=${id}`);
      await expect(admin.locator(".admin-request-content")).toHaveText(content);
      admin.once("dialog", async (dialog) => {
        expect(dialog.message()).toContain("성도검증");
        expect(dialog.message()).toContain(content);
        await dialog.accept();
      });
      await admin.getByRole("button", { name: "기도요청 삭제", exact: true }).click();
      await expect(admin.getByRole("status")).toHaveText("기도요청을 삭제했습니다.");
      await expect(admin.locator(".admin-request-rows").getByText(content, { exact: true })).toHaveCount(0);
      expect((await admin.request.get(`/api/admin/prayer-requests/${id}`)).status()).toBe(404);
      expect((await admin.request.delete(`/api/admin/prayer-requests/${id}`)).status()).toBe(200);
      expect((await page.request.get("/api/checkins")).status()).toBe(200);
      await page.reload();
      await expect(page.getByLabel("기도 요청 내용")).toBeVisible();
    } finally {
      await adminContext.close();
    }
  });

  test("cancelling sends nothing and a failed deletion preserves the selected content", async ({ page }) => {
    await login(page, "admin");
    let deletions = 0;
    await page.route("**/api/admin/prayer-requests**", async (route) => {
      if (route.request().method() === "DELETE") {
        deletions++;
        return route.fulfill(deletions === 1
          ? { status: 503, json: { code: "UNAVAILABLE" } }
          : { json: { status: "ok" } });
      }
      return route.fulfill({ json: route.request().url().endsWith(fixture.id)
        ? { request: fixture } : { requests: [fixture] } });
    });
    await page.goto(`/admin/prayer-requests?id=${fixture.id}`);
    const remove = page.getByRole("button", { name: "기도요청 삭제", exact: true });
    await expect(remove).toBeEnabled();
    await page.locator(".admin-request-row").click();
    await expect(remove).toBeEnabled();
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toContain(fixture.requesterName);
      expect(dialog.message()).toContain(fixture.preview);
      await dialog.dismiss();
    });
    await remove.click();
    expect(deletions).toBe(0);
    await expect(page.locator(".admin-request-content")).toHaveText(fixture.content);

    page.on("dialog", (dialog) => dialog.accept());
    await remove.click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("기도요청을 삭제하지 못했습니다");
    await expect(page.locator(".admin-request-content")).toHaveText(fixture.content);
    await expect(page.locator(".admin-request-row")).toHaveCount(1);
    await expect(remove).toBeEnabled();
    await remove.click();
    await expect(page.getByRole("status")).toHaveText("기도요청을 삭제했습니다.");
    await expect(page.locator(".admin-request-row")).toHaveCount(0);
    expect(deletions).toBe(2);
  });

  test("a stalled deletion unlocks after the deadline and retries only the selected ID", async ({ page }) => {
    await login(page, "admin");
    const deletedUrls: string[] = [];
    await page.route("**/api/admin/prayer-requests**", async (route) => {
      if (route.request().method() === "DELETE") {
        deletedUrls.push(route.request().url());
        if (deletedUrls.length === 1) return;
        return route.fulfill({ json: { status: "ok" } });
      }
      return route.fulfill({ json: route.request().url().endsWith(fixture.id)
        ? { request: fixture } : { requests: [fixture] } });
    });
    await page.goto(`/admin/prayer-requests?id=${fixture.id}`);
    await page.clock.install();
    page.on("dialog", (dialog) => dialog.accept());
    const remove = page.getByRole("button", { name: "기도요청 삭제", exact: true });
    await remove.click();
    await expect(remove).toBeDisabled();
    await expect(page.getByLabel("기도요청 상태 필터")).toBeDisabled();
    await expect(page.locator(".admin-request-row")).toBeDisabled();
    await page.clock.fastForward(26_000);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("삭제 결과를 확인하지 못했습니다");
    await expect(page.locator(".admin-request-content")).toHaveText(fixture.content);
    await expect(remove).toBeEnabled();
    expect(deletedUrls).toHaveLength(1);
    await remove.click();
    await expect(page.getByRole("status")).toHaveText("기도요청을 삭제했습니다.");
    expect(deletedUrls).toHaveLength(2);
    expect(deletedUrls[0]).toBe(deletedUrls[1]);
    expect(deletedUrls[0]).toContain(`/api/admin/prayer-requests/${fixture.id}`);
  });
});
