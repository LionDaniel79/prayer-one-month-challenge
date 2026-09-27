import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe("bounded loading on slow networks", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("calendar loading times out and can be retried without changing months", async ({ page }) => {
    await login(page);
    await page.clock.install();
    await page.route("**/api/visits/availability?*", () => {});
    await page.goto("/visits");
    await expect(page.getByText("일정을 확인하고 있습니다.")).toBeVisible();
    await page.clock.fastForward(26_000);
    await expect(page.getByText("일정을 확인하고 있습니다.")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "다시 확인" })).toBeVisible();
    await page.unroute("**/api/visits/availability?*");
    await page.route("**/api/visits/availability?*", (route) => route.fulfill({ json: {
      dates: [{ date: "2026-10-08", available: true }],
    } }));
    await page.getByRole("button", { name: "다시 확인" }).click();
    await expect(page.getByRole("button", { name: "2026-10-08 심방 신청 가능" })).toBeVisible();
  });

  test("a stalled prayer submission preserves text and does not silently resend", async ({ page }) => {
    await login(page);
    await page.clock.install();
    let submissions = 0;
    await page.route("**/api/prayer-requests", () => { submissions++; });
    await page.goto("/prayer-requests");
    await page.getByLabel("기도 요청 내용").fill("느린 연결에서도 보존할 검증 내용");
    await page.getByRole("button", { name: "전송", exact: true }).click();
    await expect(page.getByRole("button", { name: "전송 중…" })).toBeDisabled();
    await page.clock.fastForward(26_000);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("전송 결과를 확인하지 못했습니다");
    await expect(page.getByLabel("기도 요청 내용")).toHaveValue("느린 연결에서도 보존할 검증 내용");
    await expect(page.getByRole("button", { name: "전송", exact: true })).toBeEnabled();
    expect(submissions).toBe(1);
  });
});
