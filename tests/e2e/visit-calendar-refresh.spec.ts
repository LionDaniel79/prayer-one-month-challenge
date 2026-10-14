import { expect, test } from "@playwright/test";
import { todayInSeoul } from "../../src/features/challenge/date";
import { expectNoOverflow, login } from "./helpers";

test.describe("booked dates in the member visit calendar", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("an open calendar refreshes bookings and preserves the draft while preventing submission", async ({ page }, testInfo) => {
    await login(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.clock.install();
    const date = todayInSeoul();
    let booked = false;
    let offline = false;
    await page.route("**/api/visits/availability?*", (route) => route.fulfill(offline
      ? { status: 503, json: { code: "CALENDAR_AVAILABILITY_UNAVAILABLE" } }
      : { json: { dates: [{ date, available: !booked, reason: booked ? "existing_visit" : undefined }] } }));
    await page.goto("/visits");
    await page.getByRole("button", { name: date + " 심방 신청 가능" }).click();
    const panel = page.getByRole("complementary", { name: "심방 신청하기" });
    await panel.getByLabel("장소 (선택)", { exact: true }).fill("작성 중인 장소");

    // Another person's booking becomes visible without navigation or reloading.
    booked = true;
    await page.clock.fastForward(30_000);
    await expect(page.getByRole("button", { name: date + " 심방 신청 있음" })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeDisabled();
    await expect(panel.getByLabel("장소 (선택)", { exact: true })).toHaveValue("작성 중인 장소");
    await expect(panel.getByRole("status")).toContainText("다른 날짜를 선택");
    await expectNoOverflow(page);
    await page.screenshot({ path: testInfo.outputPath("booked-date-mobile.png"), fullPage: true });

    // A cancellation is reflected as soon as the user returns to the page.
    booked = false;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("button", { name: date + " 심방 신청 가능" })).toBeEnabled();
    await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeEnabled();

    // A failed refresh must not leave a stale selection open for submission.
    offline = true;
    await page.clock.fastForward(30_000);
    await expect(page.getByText("일정을 확인하기 어렵습니다. 잠시 후 다시 시도해 주세요.")).toBeVisible();
    await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeDisabled();
    offline = false;
    await page.getByRole("button", { name: "다시 확인", exact: true }).click();
    await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeEnabled();
  });

  test("a submission conflict refreshes the date immediately without resubmitting", async ({ page }) => {
    await login(page);
    const date = todayInSeoul();
    let booked = false;
    let submitted = 0;
    await page.route("**/api/visits/availability?*", (route) => route.fulfill({
      json: { dates: [{ date, available: !booked, reason: booked ? "existing_visit" : undefined }] },
    }));
    await page.route("**/api/visits", async (route) => {
      submitted++;
      booked = true;
      await route.fulfill({ status: 409, json: { code: "VISIT_ALREADY_EXISTS" } });
    });
    await page.goto("/visits");
    await page.getByRole("button", { name: date + " 심방 신청 가능" }).click();
    const panel = page.getByRole("complementary", { name: "심방 신청하기" });
    await panel.getByRole("button", { name: "신청", exact: true }).click();
    await expect(page.getByRole("button", { name: date + " 심방 신청 있음" })).toBeDisabled();
    await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeDisabled();
    expect(submitted).toBe(1);
  });

  test("browsing another month keeps the selected date usable and continues checking it", async ({ page }) => {
    await login(page);
    await page.clock.install();
    const date = todayInSeoul();
    const month = date.slice(0, 7);
    const [year, monthNumber] = month.split("-").map(Number);
    const nextDate = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
    let booked = false;
    await page.route("**/api/visits/availability?*", (route) => {
      const requestedMonth = new URL(route.request().url()).searchParams.get("month");
      return route.fulfill({ json: { dates: requestedMonth === month
        ? [{ date, available: !booked, reason: booked ? "existing_visit" : undefined }]
        : [{ date: nextDate, available: true }] } });
    });
    await page.goto("/visits");
    await page.getByRole("button", { name: date + " 심방 신청 가능" }).click();
    const panel = page.getByRole("complementary", { name: "심방 신청하기" });
    await panel.getByLabel("장소 (선택)", { exact: true }).fill("다른 달을 보아도 보존할 장소");
    await page.getByRole("button", { name: "다음 달", exact: true }).click();
    await expect(page.getByRole("button", { name: nextDate + " 심방 신청 가능" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeEnabled();
    booked = true;
    await page.clock.fastForward(30_000);
    await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeDisabled();
    await expect(panel.getByLabel("장소 (선택)", { exact: true })).toHaveValue("다른 달을 보아도 보존할 장소");
    await expect(page.getByRole("button", { name: nextDate + " 심방 신청 가능" })).toBeEnabled();
  });
});
