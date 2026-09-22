import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://example";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
});

describe("credential authentication", () => {
  it("distinguishes people with the same name by phone credentials", async () => {
    const { authenticateCredentials } = await import("../../src/features/auth/service");
    const { hashPhonePassword, phoneLookupHash } = await import("../../src/features/auth/crypto");

    const firstHash = await hashPhonePassword("01011112222");
    const secondHash = await hashPhonePassword("01033334444");
    const records = [
      {
        id: "u1",
        displayName: "홍길동",
        normalizedName: "홍길동",
        phoneLookupHash: phoneLookupHash("01011112222"),
        phonePasswordHash: firstHash,
        samId: "s1",
        role: "member" as const,
        isActive: true,
      },
      {
        id: "u2",
        displayName: "홍길동",
        normalizedName: "홍길동",
        phoneLookupHash: phoneLookupHash("01033334444"),
        phonePasswordHash: secondHash,
        samId: "s2",
        role: "member" as const,
        isActive: true,
      },
    ];

    const repo = {
      findCredential: async (name: string, lookupHash: string) =>
        records.find((row) => row.normalizedName === name && row.phoneLookupHash === lookupHash) ?? null,
    };

    await expect(authenticateCredentials(repo, "홍길동", "01033334444")).resolves.toMatchObject({ id: "u2" });
  });

  it("does not authenticate an inactive user", async () => {
    const { authenticateCredentials } = await import("../../src/features/auth/service");
    const { hashPhonePassword, phoneLookupHash } = await import("../../src/features/auth/crypto");
    const hash = await hashPhonePassword("01012345678");
    const repo = {
      findCredential: async () => ({
        id: "u1",
        displayName: "홍길동",
        normalizedName: "홍길동",
        phoneLookupHash: phoneLookupHash("01012345678"),
        phonePasswordHash: hash,
        samId: "s1",
        role: "member" as const,
        isActive: false,
      }),
    };
    await expect(authenticateCredentials(repo, "홍길동", "01012345678")).resolves.toBeNull();
  });
});
