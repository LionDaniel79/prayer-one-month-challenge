import { expect, test } from "@playwright/test";

test.describe("mobile and PWA shell", () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test("login fits a narrow phone viewport without horizontal overflow", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "기도운동 1달 도전" })).toBeVisible();
    await expect(page.getByLabel("이름 (아이디)")).toBeVisible();
    await expect(page.getByLabel("전화번호 (비밀번호)")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });

  test("manifest and install icons are served", async ({ request }) => {
    const manifest = await request.get("/manifest.webmanifest");
    expect(manifest.ok()).toBe(true);
    const body = await manifest.json();
    expect(body.name).toBe("기도운동 1달 도전");
    expect(body.display).toBe("standalone");

    for (const path of [
      "/icons/prayer-192.png",
      "/icons/prayer-512.png",
      "/icons/prayer-maskable-512.png",
    ]) {
      const response = await request.get(path);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");
    }
  });
});
