import { describe, expect, it } from "vitest";
import type { MemberDashboard } from "../../src/lib/types";
import {
  optimisticToggleDashboard,
  reconcileCheckinState,
} from "../../src/features/checkins/optimistic";

const baseDashboard: MemberDashboard = {
  today: "2026-09-23",
  user: { displayName: "테스트", position: "집사", samLabel: "1-6" },
  challenge: {
    id: "challenge-1",
    title: "기도운동 1달 도전",
    startDate: "2026-09-01",
    endDate: "2026-09-30",
  },
  completedDates: [],
  progress: { completed: 0, eligible: 20, rate: 0 },
};

describe("optimistic prayer check-in state", () => {
  it("shows a check and progress immediately before any server response", () => {
    const next = optimisticToggleDashboard(baseDashboard, "2026-09-23");
    expect(next.completedDates).toContain("2026-09-23");
    expect(next.progress.completed).toBe(1);
    expect(next.progress.rate).toBeGreaterThan(0);
  });

  it("rolls back only the failed date while preserving another optimistic date", () => {
    const first = optimisticToggleDashboard(baseDashboard, "2026-09-23");
    const second = optimisticToggleDashboard(first, "2026-09-22");

    const rolledBackFirst = reconcileCheckinState(
      second,
      "2026-09-23",
      "unchecked",
    );

    expect(rolledBackFirst.completedDates).not.toContain("2026-09-23");
    expect(rolledBackFirst.completedDates).toContain("2026-09-22");
    expect(rolledBackFirst.progress.completed).toBe(1);
  });

  it("reconciles server state without replacing unrelated dates", () => {
    const optimistic = optimisticToggleDashboard(
      optimisticToggleDashboard(baseDashboard, "2026-09-22"),
      "2026-09-23",
    );

    const serverSaysChecked = reconcileCheckinState(
      optimistic,
      "2026-09-22",
      "checked",
    );

    expect(serverSaysChecked.completedDates).toEqual([
      "2026-09-22",
      "2026-09-23",
    ]);
  });

  it("can optimistically uncheck an existing date", () => {
    const checked: MemberDashboard = {
      ...baseDashboard,
      completedDates: ["2026-09-23"],
    };
    const next = optimisticToggleDashboard(checked, "2026-09-23");
    expect(next.completedDates).not.toContain("2026-09-23");
  });
});
