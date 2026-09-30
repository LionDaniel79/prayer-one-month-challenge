import { expect, test } from "@playwright/test";
import postgres from "postgres";
import { e2eAccounts } from "../fixtures/e2e-data";
import { expectNoOverflow, login } from "./helpers";

test.describe("collapsible roster and selected leader deletion", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires disposable CI DB");

  test("opens and closes the user roster while retaining search and selection on mobile", async ({ page }) => {
    await login(page, "admin");
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/admin/users");
    const roster = page.locator("details").filter({ has: page.locator("summary", { hasText: "사용자 명단" }) });
    const search = roster.getByLabel("허용 명단 검색");
    await expect(search).toBeHidden();
    await roster.locator("summary").click();
    await search.fill(e2eAccounts.member.name);
    await roster.getByRole("button", { name: "검색", exact: true }).click();
    await expect(roster.locator(".roster-row").filter({ hasText: e2eAccounts.admin.name })).toHaveCount(0);
    await roster.getByLabel(`${e2eAccounts.member.name} 선택`, { exact: true }).check();
    await expect(roster.getByRole("button", { name: "선택 삭제 (1)", exact: true })).toBeEnabled();
    await roster.locator("summary").click();
    await expect(search).toBeHidden();
    await expect(page.getByRole("heading", { name: "샘 리더 관리", exact: true })).toBeVisible();
    await roster.locator("summary").click();
    await expect(search).toHaveValue(e2eAccounts.member.name);
    await expect(roster.getByLabel(`${e2eAccounts.member.name} 선택`, { exact: true })).toBeChecked();
    await expectNoOverflow(page);
  });

  test("confirms, retries and deletes only selected leaders while preserving member identities", async ({ page }) => {
    await login(page, "admin");
    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/prayer_e2e") throw new Error("DISPOSABLE_DATABASE_REQUIRED");
    const sql = postgres(url.toString(), { ssl: "require", max: 1 });
    const names = ["삭제검증가", "삭제검증나", "유지검증다"];
    let originalSamId: string | null = null;
    try {
      for (const name of names) {
        expect((await page.request.put("/api/admin/sams", { data: { name, leaderName: `${name}리더` } })).ok()).toBe(true);
      }
      const rows = (await (await page.request.get("/api/admin/sams")).json()).rows;
      const selected = rows.filter((row: { name: string }) => names.slice(0, 2).includes(row.name));
      expect(selected).toHaveLength(2);
      const ids = selected.map((row: { id: string }) => row.id);
      const [member] = await sql`select sam_id from prayer_app.users where id = ${e2eAccounts.member.userId}`;
      originalSamId = member.sam_id;
      await sql`update prayer_app.users set sam_id = ${ids[0]} where id = ${e2eAccounts.member.userId}`;
      const usersBefore = await sql`select id, sam_id, roster_id, role, is_active from prayer_app.users order by id`;
      const rosterBefore = await (await page.request.get("/api/admin/roster")).json();

      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto("/admin/users");
      const leaders = page.getByRole("region", { name: "샘 리더 관리", exact: true });
      await leaders.locator("summary").filter({ hasText: "등록된 샘 리더" }).click();
      const all = leaders.getByLabel("샘 리더 전체 선택", { exact: true });
      await all.check();
      for (const name of names) await expect(leaders.getByLabel(`${name}샘 리더 선택`, { exact: true })).toBeChecked();
      await all.uncheck();
      for (const name of names.slice(0, 2)) await leaders.getByLabel(`${name}샘 리더 선택`, { exact: true }).check();
      await leaders.getByRole("button", { name: `${names[0]}샘 리더 수정`, exact: true }).click();
      const remove = leaders.getByRole("button", { name: "선택 삭제 (2)", exact: true });
      page.once("dialog", (dialog) => dialog.dismiss());
      await remove.click();
      expect((await (await page.request.get("/api/admin/sams")).json()).rows).toEqual(rows);

      await page.route("**/api/admin/sams", async (route) => {
        if (route.request().method() === "DELETE") await route.fulfill({ status: 503, json: { code: "SAM_LEADER_DELETE_FAILED" } });
        else await route.continue();
      });
      page.once("dialog", (dialog) => dialog.accept());
      await remove.click();
      await expect(leaders.getByRole("alert")).toContainText("삭제하지 못했습니다");
      await expect(remove).toBeEnabled();
      await expect(leaders.getByLabel(`${names[0]}샘 리더 선택`, { exact: true })).toBeChecked();
      await page.unroute("**/api/admin/sams");
      page.once("dialog", (dialog) => dialog.accept());
      await remove.click();
      await expect(leaders.getByRole("status")).toContainText("2개 샘의 리더 정보를 삭제했습니다");
      await expect(leaders.getByRole("heading", { name: "샘 리더 추가", exact: true })).toBeVisible();
      await expect(leaders.getByRole("button", { name: "선택 삭제", exact: true })).toBeDisabled();
      await expectNoOverflow(page);
      await page.reload();
      await leaders.locator("summary").filter({ hasText: "등록된 샘 리더" }).click();
      for (const name of names.slice(0, 2)) await expect(leaders.getByLabel(`${name}샘 리더 선택`, { exact: true })).toHaveCount(0);
      await expect(leaders.getByLabel(`${names[2]}샘 리더 선택`, { exact: true })).toBeVisible();
      expect(await (await page.request.get("/api/admin/roster")).json()).toEqual(rosterBefore);
      expect(await sql`select id, sam_id, roster_id, role, is_active from prayer_app.users order by id`).toEqual(usersBefore);
      expect(await sql`select leader_name from prayer_app.sams where id in ${sql(ids)}`).toEqual([{ leader_name: "" }, { leader_name: "" }]);
      expect(await (await page.request.delete("/api/admin/sams", { data: { ids } })).json()).toEqual({ status: "ok", deleted: 0 });
      // A later registration reuses the same sam identity instead of breaking references.
      expect((await page.request.put("/api/admin/sams", { data: { name: selected[0].name, leaderName: "새검증리더" } })).ok()).toBe(true);
      expect((await (await page.request.get("/api/admin/sams")).json()).rows).toContainEqual(expect.objectContaining({ id: ids[0], leaderName: "새검증리더" }));
    } finally {
      await sql`update prayer_app.users set sam_id = ${originalSamId} where id = ${e2eAccounts.member.userId}`;
      await sql`delete from prayer_app.sams where name in ${sql(names)}`;
      await sql.end();
    }
  });

  test("keeps a large selection within the server limit and allows changing the selection", async ({ page }) => {
    await login(page, "admin");
    const rows = Array.from({ length: 501 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      name: `대량검증${index + 1}`, leaderName: "검증리더", isActive: true,
    }));
    await page.route("**/api/admin/sams", (route) => route.fulfill({ json: { rows } }));
    await page.goto("/admin/users");
    const leaders = page.getByRole("region", { name: "샘 리더 관리", exact: true });
    await leaders.locator("summary").filter({ hasText: "등록된 샘 리더" }).click();
    const all = leaders.getByLabel("샘 리더 500개 선택", { exact: true });
    await all.check();
    await expect(leaders.getByRole("button", { name: "선택 삭제 (500)", exact: true })).toBeEnabled();
    const last = leaders.getByLabel("대량검증501샘 리더 선택", { exact: true });
    await expect(last).toBeDisabled();
    await leaders.getByLabel("대량검증1샘 리더 선택", { exact: true }).uncheck();
    await last.check();
    await expect(leaders.getByRole("button", { name: "선택 삭제 (500)", exact: true })).toBeEnabled();
    await all.check();
    await all.uncheck();
    await expect(leaders.getByRole("button", { name: "선택 삭제", exact: true })).toBeDisabled();
  });

  test("denies anonymous and ordinary member leader deletion", async ({ page, request }) => {
    const data = { ids: ["00000000-0000-4000-8000-000000000001"] };
    expect((await request.delete("/api/admin/sams", { data })).status()).toBe(403);
    await login(page, "member");
    expect((await page.request.delete("/api/admin/sams", { data })).status()).toBe(403);
  });
});
