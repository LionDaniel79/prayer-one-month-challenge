import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("admin page runtime boundary", () => {
  it("loads DB-backed admin data sequentially on the single-connection pool", () => {
    const page = readFileSync("app/admin/page.tsx", "utf8");
    expect(page).not.toContain("Promise.all");
    expect(page).toMatch(/await getAdminDashboard\(\)[\s\S]*await listRosterForAdmin\(\)/);
  });

  it("renders the interactive admin dashboard client-only", () => {
    const wrapper = readFileSync(
      "components/admin/AdminDashboardNoSsr.tsx",
      "utf8",
    );
    const page = readFileSync("app/admin/page.tsx", "utf8");

    expect(wrapper).toContain('"use client"');
    expect(wrapper).toMatch(/ssr:\s*false/);
    expect(page).toContain("AdminDashboardNoSsr");
    expect(page).not.toContain("<AdminDashboard ");
  });
});
