import { describe, expect, it } from "vitest";
import {
  evaluateVisitDate,
  googleEventBlockedDates,
} from "../../src/features/visits/date-policy";

describe("visit date policy", () => {
  it("blocks one Seoul date for a normal timed event", () => {
    expect([...googleEventBlockedDates({
      status: "confirmed",
      start: { dateTime: "2026-10-03T10:00:00+09:00" },
      end: { dateTime: "2026-10-03T11:00:00+09:00" },
    })]).toEqual(["2026-10-03"]);
  });

  it("blocks both dates when a timed event crosses midnight", () => {
    expect([...googleEventBlockedDates({
      status: "confirmed",
      start: { dateTime: "2026-10-03T23:30:00+09:00" },
      end: { dateTime: "2026-10-04T00:30:00+09:00" },
    })]).toEqual(["2026-10-03", "2026-10-04"]);
  });

  it("treats an all-day Google end date as exclusive", () => {
    expect([...googleEventBlockedDates({
      status: "confirmed",
      start: { date: "2026-10-03" },
      end: { date: "2026-10-05" },
    })]).toEqual(["2026-10-03", "2026-10-04"]);
  });

  it("ignores cancelled Google events", () => {
    expect(googleEventBlockedDates({
      status: "cancelled",
      start: { date: "2026-10-03" },
      end: { date: "2026-10-04" },
    }).size).toBe(0);
  });

  it("blocks dates before today", () => {
    expect(evaluateVisitDate({
      date: "2026-09-26",
      today: "2026-09-27",
      calendarHealthy: true,
      googleBlockedDates: new Set(),
      blockedDates: new Set(),
      blockedWeekdays: new Set(),
      activeVisitDates: new Set(),
    })).toEqual({
      date: "2026-09-26",
      available: false,
      reason: "past_date",
    });
  });

  it("blocks an administrator-disabled weekday", () => {
    expect(evaluateVisitDate({
      date: "2026-10-04",
      calendarHealthy: true,
      googleBlockedDates: new Set(),
      blockedDates: new Set(),
      blockedWeekdays: new Set([0]),
      activeVisitDates: new Set(),
    })).toEqual({
      date: "2026-10-04",
      available: false,
      reason: "blocked_weekday",
    });
  });

  it("fails closed when Google Calendar health is false", () => {
    expect(evaluateVisitDate({
      date: "2026-10-05",
      calendarHealthy: false,
      googleBlockedDates: new Set(),
      blockedDates: new Set(),
      blockedWeekdays: new Set(),
      activeVisitDates: new Set(),
    })).toEqual({
      date: "2026-10-05",
      available: false,
      reason: "calendar_unavailable",
    });
  });
});
