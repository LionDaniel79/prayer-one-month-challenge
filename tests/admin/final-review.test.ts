import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDashboard } from "../../components/admin/AdminDashboard";
import { resolveChallengeEndDate, type AdminDashboardData } from "../../src/features/admin/service";

const data: AdminDashboardData = {
  challenge: null,
  totals: { members: 0, todayCompleted: 0, todayRate: 0, averageRate: 0 },
  buckets: { perfect: 0, high: 0, medium: 0, low: 0 },
  members: [],
  sams: [
    {
      samId: "s1",
      name: "사랑샘",
      leaderName: "김리더",
      isActive: true,
      members: 0,
      averageRate: 0,
      todayCompleted: 0,
      todayRate: 0,
    },
  ],
};

describe("final administrator review contracts", () => {
  it("derives a one-calendar-month end date when an explicit end date is absent", () => {
    expect(resolveChallengeEndDate("2026-09-22")).toBe("2026-10-21");
    expect(resolveChallengeEndDate("2026-09-22", "2026-10-20")).toBe("2026-10-20");
  });

  it("exposes editing for an existing sam in the administrator UI", () => {
    const html = renderToStaticMarkup(React.createElement(AdminDashboard, { initial: data }));
    expect(html).toContain("사랑샘 수정");
  });
});
