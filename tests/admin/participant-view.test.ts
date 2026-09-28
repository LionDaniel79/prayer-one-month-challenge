import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminDashboard } from "../../components/admin/AdminDashboard";
import {
  aggregateAdminDashboard,
  type AdminDashboardData,
} from "../../src/features/admin/service";

describe("roster-driven participant view", () => {
  it("groups only provided logged-in participants by sam label", () => {
    const data = aggregateAdminDashboard([
      {
        userId: "u1",
        name: "가나다",
        position: "집사",
        phone: "010-1111-2222",
        samLabel: "1-6",
        completed: 2,
        eligible: 2,
        completedToday: true,
        role: "member",
        isActive: true,
      },
      {
        userId: "u2",
        name: "라마바",
        position: "권사",
        phone: "010-3333-4444",
        samLabel: "1-6",
        completed: 1,
        eligible: 2,
        completedToday: false,
        role: "member",
        isActive: true,
      },
    ]);

    expect(data.totals.members).toBe(2);
    expect(data.sams).toEqual([
      expect.objectContaining({ samLabel: "1-6", members: 2 }),
    ]);
  });

  it("renders participant fields in 이름, 직분, 전화번호, 샘 order", () => {
    const initial: AdminDashboardData = aggregateAdminDashboard([
      {
        userId: "u1",
        name: "가나다",
        position: "집사",
        phone: "010-1111-2222",
        samLabel: "1-6",
        completed: 1,
        eligible: 1,
        completedToday: true,
        role: "member",
        isActive: true,
      },
    ]);
    const html = renderToStaticMarkup(
      React.createElement(AdminDashboard, {
        initial,
        initialRoster: { rows: [], nextOffset: null },
      }),
    );
    const participantSection = html.slice(html.indexOf("참여자 명단"));

    const name = participantSection.indexOf(">이름<");
    const position = participantSection.indexOf(">직분<");
    const phone = participantSection.indexOf(">전화번호<");
    const sam = participantSection.indexOf(">샘<");
    expect(name).toBeGreaterThan(-1);
    expect(name).toBeLessThan(position);
    expect(position).toBeLessThan(phone);
    expect(phone).toBeLessThan(sam);
  });
});
