import { expect, test } from "@playwright/test";
import postgres from "postgres";
import * as XLSX from "xlsx";
import { e2eAccounts } from "../fixtures/e2e-data";
import { expectNoOverflow, login } from "./helpers";

test.describe("administrative visit controls", () => {
  test.skip(process.env.E2E_DATABASE_READY !== "1", "Requires the disposable CI database.");

  test("specific dates can be enabled, disabled, and reset at mobile width", async ({ page }) => {
    await login(page, "admin");
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto("/admin/settings");
    const settings = page.locator("section").filter({ has: page.getByRole("heading", { name: "심방 신청 가능일", exact: true }) });
    const date = "2099-10-04";
    await settings.getByLabel("날짜", { exact: true }).fill(date);
    await settings.getByRole("button", { name: "날짜 활성화", exact: true }).click();
    const row = settings.locator(".blocked-date-row").filter({ hasText: date });
    await expect(row).toContainText("· 활성");
    expect((await (await page.request.get("/api/admin/visits/blocked-dates")).json()).dates)
      .toContainEqual(expect.objectContaining({ visitDate: date, isEnabled: true }));
    await settings.getByLabel("날짜", { exact: true }).fill(date);
    await settings.getByRole("button", { name: "날짜 비활성화", exact: true }).click();
    await expect(row).toContainText("· 비활성");
    await expectNoOverflow(page);
    await row.getByRole("button", { name: "설정 해제" }).click();
    await expect(row).toHaveCount(0);
  });

  test("imports separate leaders and deletes a cancelled visit without Google credentials", async ({ page }) => {
    await login(page, "admin");
    const rosterBefore = await (await page.request.get("/api/admin/roster")).json();
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["마을", "마을장", "샘", "샘리더"], ["", "사용하지않음", "검증샘", "검증리더A 집사"],
    ]), "리더");
    await page.goto("/admin/settings");
    await page.getByLabel("샘 리더 엑셀 파일").setInputFiles({ name: "leaders.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) });
    await page.getByRole("button", { name: "가져오기", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("1개 샘");
    expect((await (await page.request.get("/api/admin/sams")).json()).rows).toContainEqual(expect.objectContaining({ name: "검증", leaderName: "검증리더A" }));
    expect(await (await page.request.get("/api/admin/roster")).json()).toEqual(rosterBefore);

    const url = new URL(process.env.DATABASE_URL!);
    if (!["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/prayer_e2e") throw new Error("DISPOSABLE_DATABASE_REQUIRED");
    const sql = postgres(url.toString(), { ssl: "require", max: 1 });
    let id: string;
    try {
      const [row] = await sql`insert into prayer_app.visit_requests
        (requester_user_id, visit_date, visit_type, attendees, location, preferred_time, reason, status, calendar_sync_status)
        values (${e2eAccounts.member.userId}, '2099-10-05', 'personal', '검증', '검증', '오후', '비공개 검증', 'cancelled', 'synced') returning id`;
      id = row.id;
    } finally { await sql.end(); }
    const detail = await (await page.request.get(`/api/admin/visits/${id}`)).json();
    expect(detail.visit).toMatchObject({ samLabel: "검증샘", leaderName: "검증리더A" });
    await page.goto("/admin/visits");
    await page.locator(".admin-visit-row").filter({ hasText: "2099-10-05" }).click();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "신청 삭제", exact: true }).click();
    expect((await page.request.get(`/api/admin/visits/${id}`)).status()).toBe(200);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "신청 삭제", exact: true }).click();
    await expect(page.locator(".admin-visit-row").filter({ hasText: "2099-10-05" })).toHaveCount(0);
    expect((await page.request.get(`/api/admin/visits/${id}`)).status()).toBe(404);
    expect((await page.request.delete(`/api/admin/visits/${id}`)).status()).toBe(200);
  });
});
