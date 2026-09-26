import { expect, test } from "@playwright/test";
import type { MemberDashboard } from "../../src/lib/types";
import { addDays, isPrayerDay } from "../../src/features/challenge/date";
import { e2eChallengeId, e2eDraftNoticeId, e2ePublishedNoticeId } from "../fixtures/e2e-data";
import { expectNoOverflow, login } from "./helpers";

test.describe("database-backed member flows", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("first roster login creates a participant and persists a private session", async ({ page, context }) => {
    await login(page, "newcomer");
    await expect(page.getByText("최초검증", { exact: true })).toBeVisible();
    const session = (await context.cookies()).find((cookie) => cookie.name === "prayer_session");
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");
    expect(session?.expires).toBeGreaterThan(Date.now() / 1000 + 179 * 86400);
    await page.reload();
    await expect(page.getByText("최초검증", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect((await page.request.get("/api/checkins")).status()).toBe(401);
  });

  test("a lost successful response can be retried without undoing the saved prayer", async ({ page }) => {
    await login(page);
    const { dashboard } = await (await page.request.get("/api/checkins")).json() as { dashboard: MemberDashboard };
    const prayerDate = isPrayerDay(dashboard.today) ? dashboard.today : addDays(dashboard.today, -1);
    const [, month, day] = prayerDate.split("-").map(Number);
    const request = { prayerDate, challengeId: dashboard.challenge.id };
    expect((await page.request.post("/api/checkins", { data: { ...request, checked: false } })).ok()).toBe(true);
    await page.reload();
    const check = page.getByRole("button", { name: `${month}월 ${day}일 기도 완료 체크`, exact: true });
    await page.route("**/api/checkins", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      expect(route.request().postDataJSON()).toMatchObject({ ...request, checked: true });
      const response = await route.fetch();
      expect(response.ok()).toBe(true);
      await route.abort("failed"); // DB commit succeeded; only the response was lost.
    });
    await check.click();
    await expect(page.getByRole("alert")).toContainText("저장하지 못했습니다");
    await page.unroute("**/api/checkins");
    await expect(check).toBeEnabled();
    await check.click();
    const cancel = page.getByRole("button", { name: `${month}월 ${day}일 기도 완료 취소`, exact: true });
    await expect(cancel).toBeEnabled();
    const saved = await (await page.request.get("/api/checkins")).json() as { dashboard: MemberDashboard };
    expect(saved.dashboard.completedDates.filter((date) => date === prayerDate)).toHaveLength(1);
    await cancel.click();
    await expect(check).toBeEnabled();
    const unchecked = await (await page.request.get("/api/checkins")).json() as { dashboard: MemberDashboard };
    expect(unchecked.dashboard.completedDates).not.toContain(prayerDate);
    const stale = await page.request.post("/api/checkins", { data: { ...request, checked: true, challengeId: e2eDraftNoticeId } });
    expect(stale.status()).toBe(409);
    expect(await stale.json()).toMatchObject({ code: "CHALLENGE_CHANGED" });
    expect((await page.request.post("/api/checkins", { data: { prayerDate: addDays(dashboard.today, -3), checked: true, challengeId: e2eChallengeId } })).status()).toBe(400);
  });

  test("published notice read state persists and drafts remain private", async ({ page }) => {
    await login(page);
    const before = await (await page.request.get("/api/notices/unread-count")).json();
    expect(before.count).toBeGreaterThan(0);
    expect((await page.request.get(`/api/notices/${e2eDraftNoticeId}`)).status()).toBe(404);
    await page.goto(`/notices/${e2ePublishedNoticeId}`);
    await expect(page.getByRole("heading", { name: "검증용 공개 공지" })).toBeVisible();
    const after = await (await page.request.get("/api/notices/unread-count")).json();
    expect(after.count).toBe(before.count - 1);
    await page.reload();
    expect((await (await page.request.get("/api/notices/unread-count")).json()).count).toBe(after.count);
    expect(await (await page.request.get("/api/notices")).text()).not.toContain("검증용 비공개 초안");
  });

  test("prayer requests submit privately without exposing a member listing", async ({ page }) => {
    await login(page);
    await page.goto("/prayer-requests");
    await page.getByLabel("기도 요청 내용").fill("자동 검증용 비공개 기도 내용");
    await page.getByRole("button", { name: "전송", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText("기도요청이 전달되었습니다.");
    await expect(page.getByLabel("기도 요청 내용")).toHaveValue("");
    expect((await page.request.get("/api/prayer-requests")).status()).toBe(405);
    expect((await page.request.get("/api/admin/prayer-requests")).status()).toBe(403);
  });

  test("mobile member drawer and all four sections fit 360 pixels", async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await login(page);
    await expect(page.getByRole("heading", { name: "기도운동 1달 도전" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("member-mobile.png"), fullPage: true });
    for (const label of ["심방신청", "기도요청", "공지", "기도운동"]) {
      await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
      await page.locator(".community-sidebar").getByRole("link", { name: new RegExp("^" + label) }).click();
      await expect(page.locator(".community-sidebar")).not.toHaveClass(/is-open/);
      await expectNoOverflow(page);
    }
  });
});
