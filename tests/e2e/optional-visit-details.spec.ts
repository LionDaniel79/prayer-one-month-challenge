import { expect, test } from "@playwright/test";
import { todayInSeoul } from "../../src/features/challenge/date";
import { expectNoOverflow, login } from "./helpers";

test.describe("optional visit details", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  for (const type of ["personal", "sam"] as const) {
    test(`submits ${type} with every text field empty`, async ({ page }) => {
      await login(page);
      await page.setViewportSize({ width: 360, height: 800 });
      const date = todayInSeoul();
      await page.route("**/api/visits/availability?*", (route) => route.fulfill({ json: { dates: [{ date, available: true }] } }));
      const submitted: unknown[] = [];
      await page.route("**/api/visits", async (route) => {
        submitted.push(route.request().postDataJSON());
        await route.fulfill({ status: 201, json: { id: "synthetic-visit", status: "ok" } });
      });
      await page.goto("/visits");
      await page.getByRole("button", { name: date + " 심방 신청 가능" }).click();
      const panel = page.getByRole("complementary", { name: "심방 신청하기" });
      if (type === "sam") await panel.getByLabel("샘심방", { exact: true }).check();
      for (const label of ["참석자 명단", "장소", "희망 시간", "심방 요청 이유"]) {
        await expect(panel.getByLabel(label + " (선택)", { exact: true })).toHaveValue("");
      }
      await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeEnabled();
      await expectNoOverflow(page);
      await panel.getByRole("button", { name: "신청", exact: true }).click();
      await expect(panel).toHaveCount(0);
      expect(submitted).toEqual([{ visitDate: date, visitType: type, attendees: "", location: "", preferredTime: "", reason: "" }]);

      // Exercise real API validation too, without connecting a production Calendar.
      const response = await page.request.post("/api/visits", { data: { visitDate: date, visitType: type } });
      expect(response.status()).toBe(409);
      expect(await response.json()).toEqual({ code: "CALENDAR_NOT_CONNECTED" });
    });
  }

  test("a stalled request releases 신청 without silently submitting it again", async ({ page }) => {
    await login(page);
    const date = todayInSeoul();
    await page.route("**/api/visits/availability?*", (route) => route.fulfill({ json: { dates: [{ date, available: true }] } }));
    let submitted = 0;
    await page.route("**/api/visits", () => { submitted++; });
    await page.goto("/visits");
    await page.getByRole("button", { name: date + " 심방 신청 가능" }).click();
    await page.clock.install();
    const panel = page.getByRole("complementary", { name: "심방 신청하기" });
    await panel.getByRole("button", { name: "신청", exact: true }).click();
    await expect(panel.getByRole("button", { name: "신청 중…" })).toBeDisabled();
    await page.clock.fastForward(26_000);
    await expect(panel.getByRole("status")).toContainText("신청 결과를 확인하지 못했습니다");
    await expect(panel.getByRole("button", { name: "신청", exact: true })).toBeEnabled();
    expect(submitted).toBe(1);
  });
});
