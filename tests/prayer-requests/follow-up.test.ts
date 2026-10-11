import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("../../src/db/client", () => ({ getDb: vi.fn() }));
import * as service from "../../src/features/prayer-requests/service";

describe("private prayer follow-up", () => {
  it("accepts a trimmed comment and rejects empty or oversized comments", () => {
    expect(service.normalizePrayerComment("  함께 기도합니다.  ")).toBe("함께 기도합니다.");
    expect(() => service.normalizePrayerComment(" \n ")).toThrow("INVALID_PRAYER_COMMENT");
    expect(() => service.normalizePrayerComment("가".repeat(2001))).toThrow("INVALID_PRAYER_COMMENT");
  });
  it("permits only the requester and administrators to read a conversation", () => {
    expect(() => service.assertPrayerAccess("owner", { id: "owner", role: "member" })).not.toThrow();
    expect(() => service.assertPrayerAccess("owner", { id: "admin", role: "admin" })).not.toThrow();
    expect(() => service.assertPrayerAccess("owner", { id: "other", role: "member" })).toThrow("PRAYER_REQUEST_NOT_FOUND");
  });
});
