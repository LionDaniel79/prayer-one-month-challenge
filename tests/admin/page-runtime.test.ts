import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin page runtime boundary", () => {
  it("keeps server rendering limited to authentication", () => {
    const page = readFileSync("app/admin/page.tsx", "utf8");
    expect(page).not.toContain("getAdminDashboard");
    expect(page).not.toContain("listRosterForAdmin");
    expect(page).toContain("AdminDashboardLoader");
  });

  it("loads admin data through authenticated APIs after the page mounts", () => {
    const loader = readFileSync(
      "components/admin/AdminDashboardLoader.tsx",
      "utf8",
    );

    expect(loader).toContain('"use client"');
    expect(loader).toContain('fetch("/api/admin/dashboard"');
    expect(loader).toContain('fetch("/api/admin/roster"');
    expect(loader).toContain("관리자 데이터를 불러오지 못했습니다");
  });
});
