import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setValidEnv(keyByte: number) {
  process.env.DATABASE_URL = "postgres://example";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
  process.env.ROSTER_ENCRYPTION_KEY = Buffer.alloc(32, keyByte).toString("base64");
  process.env.NODE_ENV = "test";
}

describe("roster phone encryption", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
    delete process.env.ROSTER_ENCRYPTION_KEY;
  });

  it("round-trips normalized phone without exposing plaintext in ciphertext", async () => {
    setValidEnv(7);
    const { encryptRosterPhone, decryptRosterPhone } =
      await import("../../src/features/roster/crypto");

    const cipher = encryptRosterPhone("01012345678");
    expect(cipher).not.toContain("01012345678");
    expect(decryptRosterPhone(cipher)).toBe("01012345678");
  });

  it("rejects tampered ciphertext", async () => {
    setValidEnv(8);
    const { encryptRosterPhone, decryptRosterPhone } =
      await import("../../src/features/roster/crypto");

    const cipher = encryptRosterPhone("01012345678");
    const last = cipher.at(-1);
    const tampered = cipher.slice(0, -1) + (last === "A" ? "B" : "A");
    expect(() => decryptRosterPhone(tampered)).toThrow("PHONE_DECRYPT_FAILED");
  });
});
