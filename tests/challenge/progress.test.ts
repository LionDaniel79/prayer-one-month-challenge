import { describe, expect, it } from "vitest";
import { calculateProgress } from "../../src/features/challenge/progress";

describe("challenge progress", () => {
  it("excludes Sunday and future dates from denominator", () => {
    expect(calculateProgress({
      startDate: "2026-09-25",
      endDate: "2026-10-24",
      today: "2026-09-28",
      completedDates: ["2026-09-25", "2026-09-26"],
    })).toEqual({ completed: 2, eligible: 3, rate: 2 / 3 });
  });

  it("uses the full challenge after it ends", () => {
    const result = calculateProgress({
      startDate: "2026-09-01",
      endDate: "2026-09-05",
      today: "2026-09-20",
      completedDates: ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05"],
    });
    expect(result).toEqual({ completed: 5, eligible: 5, rate: 1 });
  });

  it("deduplicates completed dates and ignores Sunday/out-of-range dates", () => {
    const result = calculateProgress({
      startDate: "2026-09-25",
      endDate: "2026-09-30",
      today: "2026-09-30",
      completedDates: [
        "2026-09-25",
        "2026-09-25",
        "2026-09-27",
        "2026-10-01",
      ],
    });
    expect(result.completed).toBe(1);
    expect(result.eligible).toBe(5);
    expect(result.rate).toBe(0.2);
  });

  it("returns zero rate when no eligible days have arrived", () => {
    expect(calculateProgress({
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      today: "2026-09-30",
      completedDates: [],
    })).toEqual({ completed: 0, eligible: 0, rate: 0 });
  });
});
