import { expect, test } from "@playwright/test";

test.describe("administrator dashboard", () => {
  test.skip(!process.env.E2E_ADMIN_READY, "Requires a seeded admin session and deployed database.");

  test("shows aggregate statistics and management controls", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: "기도운동 진행 현황" })).toBeVisible();
    await expect(page.getByText("달성률 구간")).toBeVisible();
    await expect(page.getByText("샘별 통계")).toBeVisible();
    await expect(page.getByText("개인 현황")).toBeVisible();
    await expect(page.getByRole("button", { name: "도전 설정" })).toBeVisible();
    await expect(page.getByRole("button", { name: "샘 추가" })).toBeVisible();
    await expect(page.getByRole("button", { name: "사용자 관리" })).toBeVisible();
  });
});
