import { beforeAll, describe, expect, it } from "vitest";
import {
  prepareAdminRosterValues,
  rosterAuthIdentityChanged,
} from "../../src/features/admin/roster-service";

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://example";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
  process.env.ROSTER_ENCRYPTION_KEY = Buffer.alloc(32, 11).toString("base64");
});

describe("administrator roster preparation", () => {
  it("prepares canonical identity, encrypted phone, and village-sam label", () => {
    const result = prepareAdminRosterValues({
      name: "김은희A",
      position: "집사",
      phone: "010-1234-5678",
      village: "01마을",
      sam: "06샘",
      isActive: true,
      isAdmin: false,
    });

    expect(result).toMatchObject({
      sourceName: "김은희A",
      canonicalName: "김은희",
      position: "집사",
      samLabel: "1-6",
      isActive: true,
      isAdmin: false,
    });
    expect(result.phoneLookupHash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.phoneCiphertext).not.toContain("01012345678");
  });

  it("accepts a roster member with no phone but makes the lookup fields null", () => {
    const result = prepareAdminRosterValues({
      name: "전화없음",
      position: null,
      phone: null,
      village: null,
      sam: null,
      isActive: true,
      isAdmin: false,
    });
    expect(result.phoneLookupHash).toBeNull();
    expect(result.phoneCiphertext).toBeNull();
    expect(result.samLabel).toBeNull();
  });

  it("requires session revocation when login identity or active state changes", () => {
    const before = {
      canonicalName: "김은희",
      phoneLookupHash: "a".repeat(64),
      isActive: true,
    };
    expect(rosterAuthIdentityChanged(before, before)).toBe(false);
    expect(rosterAuthIdentityChanged(before, { ...before, canonicalName: "김은정" })).toBe(true);
    expect(rosterAuthIdentityChanged(before, { ...before, phoneLookupHash: "b".repeat(64) })).toBe(true);
    expect(rosterAuthIdentityChanged(before, { ...before, isActive: false })).toBe(true);
  });
});
