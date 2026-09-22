import { describe, expect, it } from "vitest";
import { aggregateAdminDashboard } from "../../src/features/admin/service";

describe("admin statistics", () => {
  const sams = [
    { samId: "s1", name: "사랑샘", leaderName: "리더1" },
    { samId: "s2", name: "믿음샘", leaderName: "리더2" },
  ];
  const rows = [
    { userId: "a", name: "A", samId: "s1", samName: "사랑샘", completed: 10, eligible: 10, completedToday: true },
    { userId: "b", name: "B", samId: "s1", samName: "사랑샘", completed: 8, eligible: 10, completedToday: false },
    { userId: "c", name: "C", samId: "s2", samName: "믿음샘", completed: 8, eligible: 10, completedToday: true },
    { userId: "d", name: "D", samId: "s2", samName: "믿음샘", completed: 5, eligible: 10, completedToday: false },
  ];

  it("uses dense ranking with shared ranks", () => {
    const result = aggregateAdminDashboard(rows, sams);
    expect(result.members.map((member) => member.rank)).toEqual([1, 2, 2, 3]);
  });

  it("groups achievement rates without rounding the bucket boundary", () => {
    const result = aggregateAdminDashboard(rows, sams);
    expect(result.buckets).toEqual({ perfect: 1, high: 2, medium: 0, low: 1 });
  });

  it("computes total and sam averages from member progress", () => {
    const result = aggregateAdminDashboard(rows, sams);
    expect(result.totals).toMatchObject({
      members: 4,
      todayCompleted: 2,
      todayRate: 0.5,
      averageRate: 0.775,
    });
    expect(result.sams[0]).toMatchObject({
      samId: "s1",
      members: 2,
      averageRate: 0.9,
      todayCompleted: 1,
      todayRate: 0.5,
    });
  });

  it("returns zero rates for an empty population", () => {
    const result = aggregateAdminDashboard([], sams);
    expect(result.totals).toEqual({
      members: 0,
      todayCompleted: 0,
      todayRate: 0,
      averageRate: 0,
    });
  });
});
