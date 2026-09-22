import { describe, expect, it } from "vitest";
import {
  defaultEndDate,
  eligiblePrayerDates,
  isMutablePrayerDate,
  isPrayerDay,
  todayInSeoul,
} from "../../src/features/challenge/date";

describe("challenge date rules", () => {
  it("computes a one-month inclusive challenge ending the day before next month's matching date", () => {
    expect(defaultEndDate("2026-09-22")).toBe("2026-10-21");
  });

  it("clamps month-end before subtracting one day", () => {
    expect(defaultEndDate("2027-01-31")).toBe("2027-02-27");
  });

  it("excludes Sunday and includes Monday through Saturday", () => {
    expect(isPrayerDay("2026-09-27")).toBe(false);
    expect(isPrayerDay("2026-09-28")).toBe(true);
    expect(isPrayerDay("2026-10-03")).toBe(true);
  });

  it("uses Asia/Seoul rather than server UTC around midnight", () => {
    expect(todayInSeoul(new Date("2026-09-21T14:59:59Z"))).toBe("2026-09-21");
    expect(todayInSeoul(new Date("2026-09-21T15:00:00Z"))).toBe("2026-09-22");
  });

  it("allows only today and yesterday when they are prayer days and inside challenge", () => {
    const args = {
      today: "2026-09-17" as const,
      startDate: "2026-09-01" as const,
      endDate: "2026-09-30" as const,
    };
    expect(isMutablePrayerDate({ ...args, prayerDate: "2026-09-17" })).toBe(true);
    expect(isMutablePrayerDate({ ...args, prayerDate: "2026-09-16" })).toBe(true);
    expect(isMutablePrayerDate({ ...args, prayerDate: "2026-09-15" })).toBe(false);
    expect(isMutablePrayerDate({ ...args, prayerDate: "2026-09-18" })).toBe(false);
  });

  it("never allows Sunday or dates outside challenge", () => {
    expect(isMutablePrayerDate({
      prayerDate: "2026-09-27",
      today: "2026-09-28",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    })).toBe(false);
    expect(isMutablePrayerDate({
      prayerDate: "2026-08-31",
      today: "2026-09-01",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    })).toBe(false);
  });

  it("lists eligible prayer days only through today before challenge ends", () => {
    expect(eligiblePrayerDates({
      startDate: "2026-09-25",
      endDate: "2026-10-24",
      today: "2026-09-28",
    })).toEqual(["2026-09-25", "2026-09-26", "2026-09-28"]);
  });
});
