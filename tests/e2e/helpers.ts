import { expect, type Page } from "@playwright/test";
import { e2eAccounts } from "../fixtures/e2e-data";

export async function login(page: Page, role: keyof typeof e2eAccounts = "member") {
  const account = e2eAccounts[role];
  await page.goto("/login");
  await page.getByLabel("이름 (아이디)").fill(account.name);
  await page.getByLabel("비밀번호", { exact: true }).fill(account.phone);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "56공동체", exact: true })).toBeVisible();
}

export async function expectNoOverflow(page: Page) {
  const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflowing).toBe(false);
}
