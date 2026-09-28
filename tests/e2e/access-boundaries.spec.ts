import { expect, test } from "@playwright/test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { login } from "./helpers";

function adminRoutes(root = "app/api/admin"): Array<{ url: string; method: string }> {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    if (statSync(path).isDirectory()) return adminRoutes(path);
    if (name !== "route.ts") return [];
    const url = "/" + path.replace(/\\/g, "/").replace(/^app\//, "").replace(/\/route\.ts$/, "").replace(/\[id\]/g, "00000000-0000-4000-8000-000000000999");
    return Array.from(readFileSync(path, "utf8").matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\(/g), (match) => ({ url, method: match[1] }));
  });
}

test("every admin HTTP handler rejects unauthenticated requests with 403", async ({ request }) => {
  expect((await request.get("/api/sams")).status()).toBe(401);
  for (const { url, method } of adminRoutes()) {
    const response = await request.fetch(url, { method, maxRedirects: 0 });
    expect.soft(response.status(), `${method} ${url}`).toBe(403);
    expect.soft(await response.json(), `${method} ${url}`).toEqual({ code: "FORBIDDEN" });
  }
});

test("every admin HTTP handler rejects ordinary members with 403", async ({ page }) => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");
  await login(page);
  expect((await page.request.get("/api/sams")).status()).toBe(200);
  for (const { url, method } of adminRoutes()) {
    const response = await page.request.fetch(url, { method, maxRedirects: 0 });
    expect.soft(response.status(), `${method} ${url}`).toBe(403);
  }
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/$/);
});
