import { expect, test } from "@playwright/test";
import { todayInSeoul } from "../../src/features/challenge/date";
import type { VisitStartTimes } from "../../src/features/visits/types";
import { expectNoOverflow, login } from "./helpers";

test.describe("visit start-time guidance", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  for (const width of [360, 1280]) {
    test(`shows duration-specific start ranges and updates them without losing input at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 850 });
      await login(page);
      await page.clock.install();
      const date = todayInSeoul();
      let startTimes: VisitStartTimes | null = {
        personal: [{ start: "10:00", end: "12:30" }, { start: "15:30", end: "16:00" }],
        sam: [{ start: "10:00", end: "11:30" }],
      };
      await page.route("**/api/visits/availability?*", route => route.fulfill({ json: {
        dates: [{ date, available: true, startTimes }],
      } }));
      await page.goto("/visits");
      await page.getByRole("button", { name: date + " 심방 신청 가능" }).click();
      const panel = page.getByRole("complementary", { name: "심방 신청하기" });
      const guide = panel.locator("#visit-start-time-guidance");
      const timeInput = panel.getByLabel("희망 시간 (선택)", { exact: true });
      await expect(timeInput).toHaveAttribute("aria-describedby", "visit-start-time-guidance");
      await expect(guide).toContainText("심방 시작 기준으로 오전 10시~낮 12시 30분과 오후 3시 30분~오후 4시에 신청할 수 있습니다.");
      await timeInput.fill("오전 10시 희망");
      await guide.scrollIntoViewIfNeeded();
      await expectNoOverflow(page);
      await page.screenshot({ path: testInfo.outputPath(`personal-start-times-${width}.png`) });

      await panel.getByLabel("샘심방", { exact: true }).check();
      await expect(guide).toContainText("심방 시작 기준으로 오전 10시~오전 11시 30분에 신청할 수 있습니다.");
      await expect(guide).toContainText("샘심방 2시간");
      await expect(timeInput).toHaveValue("오전 10시 희망");

      // A changed calendar still leaves one personal start but no two-hour slot.
      startTimes = { personal: [{ start: "10:00", end: "10:00" }], sam: [] };
      await page.clock.fastForward(30_000);
      await expect(guide).toContainText("샘심방에 필요한 2시간을 확보할 수 있는 시작 시간이 없습니다.");
      await panel.getByLabel("개인심방", { exact: true }).check();
      await expect(guide).toContainText("심방 시작 기준으로 오전 10시에 신청할 수 있습니다.");
      await expect(timeInput).toHaveValue("오전 10시 희망");

      startTimes = { personal: [], sam: [] };
      await page.clock.fastForward(30_000);
      await expect(guide).toContainText("개인심방에 필요한 1시간을 확보할 수 있는 시작 시간이 없습니다.");
      startTimes = null;
      await page.clock.fastForward(30_000);
      await expect(guide).toContainText("가능 시간을 확인하지 못했습니다.");
      await expect(guide).not.toContainText("에 신청할 수 있습니다");
    });
  }
});
