import { describe, expect, it } from "vitest";
import {
  normalizePrayerRequestContent,
  parsePrayerRequestStatus,
} from "../../src/features/prayer-requests/service";

describe("prayer request rules", () => {
  it("rejects blank content", () => {
    expect(() => normalizePrayerRequestContent("   "))
      .toThrow("INVALID_PRAYER_REQUEST");
  });

  it("accepts content up to 10,000 characters", () => {
    expect(normalizePrayerRequestContent("가".repeat(10000))).toHaveLength(10000);
  });

  it("rejects content over 10,000 characters", () => {
    expect(() => normalizePrayerRequestContent("가".repeat(10001)))
      .toThrow("PRAYER_REQUEST_TOO_LONG");
  });

  it("accepts only the three admin statuses", () => {
    expect(parsePrayerRequestStatus("received")).toBe("received");
    expect(parsePrayerRequestStatus("praying")).toBe("praying");
    expect(parsePrayerRequestStatus("completed")).toBe("completed");
    expect(() => parsePrayerRequestStatus("deleted")).toThrow(
      "INVALID_PRAYER_REQUEST_STATUS",
    );
  });
});
