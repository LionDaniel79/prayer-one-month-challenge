import { describe, expect, it } from "vitest";
import { resolveChallengeEndDate } from "../../src/features/admin/service";

describe("final administrator review contracts", () => {
  it("derives a one-calendar-month end date when an explicit end date is absent", () => {
    expect(resolveChallengeEndDate("2026-09-22")).toBe("2026-10-21");
    expect(resolveChallengeEndDate("2026-09-22", "2026-10-20")).toBe("2026-10-20");
  });
});
