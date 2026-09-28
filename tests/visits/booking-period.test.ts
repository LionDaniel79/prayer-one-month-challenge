import { describe, expect, it } from "vitest";
import { BookingPeriodInput, withinBookingPeriod } from "../../src/features/visits/booking-period";

describe("visit booking period", () => {
  const period = { startDate: "2026-10-01", endDate: "2026-11-30" };
  it("includes both endpoints and permits an unlimited period", () => {
    expect(withinBookingPeriod("2026-10-01", period)).toBe(true);
    expect(withinBookingPeriod("2026-11-30", period)).toBe(true);
    expect(withinBookingPeriod("2026-09-30", period)).toBe(false);
    expect(withinBookingPeriod("2026-12-01", period)).toBe(false);
    expect(BookingPeriodInput.safeParse({ startDate: "2026-10-01", endDate: "2026-10-01" }).success).toBe(true);
    expect(withinBookingPeriod("2099-01-01", { startDate: null, endDate: null })).toBe(true);
  });
  it.each([
    {}, { startDate: "2026-10-01", endDate: null }, { startDate: null, endDate: "2026-10-01" },
    { startDate: "2026-11-01", endDate: "2026-10-01" },
    { startDate: "2026-02-30", endDate: "2026-10-01" },
    { startDate: "", endDate: "" },
  ])("rejects incomplete, invalid, and reversed date inputs: %j", (input) => {
    expect(BookingPeriodInput.safeParse(input).success).toBe(false);
  });
});
