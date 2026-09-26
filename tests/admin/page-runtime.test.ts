import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin page runtime boundary", () => {
  it("keeps server rendering free of dashboard data queries", () => {
    const page = readFileSync("app/admin/page.tsx", "utf8");
    expect(page).not.toContain("getAdminDashboard");
    expect(page).not.toContain("listRosterForAdmin");
    expect(page).not.toContain("getAdminHubDashboard");
    expect(page).toContain("AdminHubDashboardLoader");
  });

  it("loads only the lightweight admin hub API after mount", () => {
    const loader = readFileSync(
      "components/admin/AdminHubDashboardLoader.tsx",
      "utf8",
    );
    expect(loader).toContain('"use client"');
    expect(loader).toContain('"/api/admin/dashboard"');
    expect(loader).not.toContain('"/api/admin/roster"');
    expect(loader).toContain("관리자 대시보드를 불러오지 못했습니다");
  });
});
