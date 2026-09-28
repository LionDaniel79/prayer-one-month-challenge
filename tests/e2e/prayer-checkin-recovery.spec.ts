import { expect, test } from "@playwright/test";
import { addDays, isPrayerDay } from "../../src/features/challenge/date";
import type { MemberDashboard } from "../../src/lib/types";
import { login } from "./helpers";

test.describe("prayer check-in recovery", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("a stalled save unlocks the date and retries the same intended state", async ({ page }) => {
    await login(page);
    const { dashboard } = await (await page.request.get("/api/checkins")).json() as { dashboard: MemberDashboard };
    const prayerDate = isPrayerDay(dashboard.today) ? dashboard.today : addDays(dashboard.today, -1);
    const [, month, day] = prayerDate.split("-").map(Number);
    const previouslyChecked = dashboard.completedDates.includes(prayerDate);
    const initialAction = previouslyChecked ? "기도 완료 취소" : "기도 완료 체크";
    const savedAction = previouslyChecked ? "기도 완료 체크" : "기도 완료 취소";
    const initialButton = page.getByRole("button", { name: `${month}월 ${day}일 ${initialAction}`, exact: true });
    const savedButton = page.getByRole("button", { name: `${month}월 ${day}일 ${savedAction}`, exact: true });
    const submissions: unknown[] = [];
    await page.clock.install();
    await page.route("**/api/checkins", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      submissions.push(route.request().postDataJSON());
      if (submissions.length === 1) return; // Simulate a connection that never responds.
      await route.fulfill({ json: { state: previouslyChecked ? "unchecked" : "checked" } });
    });

    await initialButton.click();
    await expect(savedButton).toBeDisabled();
    await expect(savedButton).toHaveAttribute("aria-busy", "true");
    await page.clock.fastForward(26_000);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("저장 결과를 확인하지 못했습니다");
    await expect(initialButton).toBeEnabled();
    expect(submissions).toHaveLength(1);

    await initialButton.click();
    await expect(savedButton).toBeEnabled();
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
    expect(submissions).toEqual([
      { prayerDate, checked: !previouslyChecked, challengeId: dashboard.challenge.id },
      { prayerDate, checked: !previouslyChecked, challengeId: dashboard.challenge.id },
    ]);
  });
});
