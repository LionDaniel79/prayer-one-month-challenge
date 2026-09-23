import { describe, expect, it } from "vitest";
import {
  isLoginEligibleRoster,
  type RosterCredential,
} from "../../src/features/roster/repository";

const base: RosterCredential = {
  id: "r1",
  canonicalName: "김은희",
  position: "집사",
  phoneLookupHash: "a".repeat(64),
  village: "1",
  sam: "6",
  samLabel: "1-6",
  isActive: true,
  isAdmin: false,
};

describe("roster credential eligibility", () => {
  it("matches exact canonical name and lookup hash", () => {
    expect(isLoginEligibleRoster(base, "김은희", "a".repeat(64))).toBe(true);
  });

  it("rejects inactive roster rows", () => {
    expect(isLoginEligibleRoster({ ...base, isActive: false }, "김은희", "a".repeat(64))).toBe(false);
  });

  it("rejects rows without a phone lookup hash", () => {
    expect(isLoginEligibleRoster({ ...base, phoneLookupHash: null }, "김은희", "a".repeat(64))).toBe(false);
  });

  it("distinguishes same-name people by phone hash", () => {
    expect(isLoginEligibleRoster(base, "김은희", "b".repeat(64))).toBe(false);
  });
});
