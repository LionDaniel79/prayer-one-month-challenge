import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminPrayerManagement } from "../../components/admin/prayer/AdminPrayerManagement";
import { aggregateAdminDashboard } from "../../src/features/admin/service";

describe("prayer participant management controls", () => {
  const member = {
    userId: "member-1", name: "가람", position: null, phone: null, samLabel: "1-1",
    completed: 1, eligible: 1, completedToday: true,
  };
  const challenge = { id: "challenge-1", title: "가을 기도", startDate: "2026-09-01", endDate: "2026-09-30", isActive: true };

  it("provides a named participant removal action for an active challenge", () => {
    const html = renderToStaticMarkup(React.createElement(AdminPrayerManagement, {
      initial: aggregateAdminDashboard([member], challenge),
    }));
    const button = html.match(/<button[^>]*aria-label="가람 기도운동 명단에서 삭제"[^>]*>/)?.[0];
    expect(button).toBeDefined();
    expect(button).not.toContain("disabled");
  });

  it("hides participant controls and sam statistics when there is no active challenge", () => {
    const html = renderToStaticMarkup(React.createElement(AdminPrayerManagement, {
      initial: aggregateAdminDashboard([member]),
    }));
    expect(html).not.toContain('aria-label="가람 기도운동 명단에서 삭제"');
    expect(html).not.toContain("<h2>참여자 명단</h2>");
    expect(html).not.toContain("participant-table");
    expect(html).not.toContain("<h2>샘별 통계</h2>");
    expect(html).toContain("도전 설정");
  });

  it("hides participant controls and sam statistics when the prayer menu is disabled", () => {
    const html = renderToStaticMarkup(React.createElement(AdminPrayerManagement, {
      initial: aggregateAdminDashboard([member], challenge, false),
    }));
    expect(html).not.toContain('aria-label="가람 기도운동 명단에서 삭제"');
    expect(html).not.toContain("<h2>참여자 명단</h2>");
    expect(html).not.toContain("participant-table");
    expect(html).not.toContain("<h2>샘별 통계</h2>");
    expect(html).toContain("도전 설정");
  });
});
