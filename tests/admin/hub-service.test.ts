import { describe, expect, it } from "vitest";
import {
  projectPrayerRequestActivity,
  projectVisitActivity,
  mergeRecentActivities,
} from "../../src/features/admin/hub-service";

describe("admin hub activity projections", () => {
  it("never exposes prayer-request content on the dashboard", () => {
    const activity = projectPrayerRequestActivity({
      id: "p1",
      requesterName: "홍길동",
      content: "비공개 중보기도 내용",
      status: "received",
      createdAt: new Date("2026-09-26T01:00:00Z"),
    });
    expect(activity.label).toContain("홍길동");
    expect(activity).not.toHaveProperty("content");
    expect(JSON.stringify(activity)).not.toContain("비공개 중보기도 내용");
  });

  it("never exposes visit reason on the dashboard", () => {
    const activity = projectVisitActivity({
      id: "v1",
      requesterName: "김사랑",
      visitDate: "2026-10-01",
      reason: "비공개 심방 이유",
      status: "requested",
      createdAt: new Date("2026-09-26T02:00:00Z"),
    });
    expect(activity.label).toContain("김사랑");
    expect(activity).not.toHaveProperty("reason");
    expect(JSON.stringify(activity)).not.toContain("비공개 심방 이유");
  });

  it("merges recent activity newest first and limits the result", () => {
    const rows = mergeRecentActivities([
      { kind: "notice", label: "n1", href: "/admin/notices", occurredAt: "2026-09-26T01:00:00.000Z" },
      { kind: "visit", label: "v1", href: "/admin/visits", occurredAt: "2026-09-26T03:00:00.000Z" },
      { kind: "prayer_request", label: "p1", href: "/admin/prayer-requests", occurredAt: "2026-09-26T02:00:00.000Z" },
    ], 2);
    expect(rows.map((row) => row.label)).toEqual(["v1", "p1"]);
  });
});
