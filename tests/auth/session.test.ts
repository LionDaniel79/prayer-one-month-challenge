import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL = "postgres://example";
  process.env.SESSION_SECRET = "s".repeat(32);
  process.env.PHONE_LOOKUP_PEPPER = "p".repeat(32);
});

describe("persistent session rules", () => {
  it("creates opaque tokens and hashes them before persistence", async () => {
    const { newSessionToken, sessionTokenHash } = await import("../../src/features/auth/crypto");
    const token = newSessionToken();
    expect(token.length).toBeGreaterThan(30);
    const hash = sessionTokenHash(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
  });

  it("uses a 180-day persistent cookie", async () => {
    const { SESSION_MAX_AGE_SECONDS, sessionCookieOptions } = await import("../../src/features/auth/session");
    expect(SESSION_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 180);
    expect(sessionCookieOptions("production")).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  });

  it("rolls a session only after 24 hours of use", async () => {
    const { shouldRollSession } = await import("../../src/features/auth/session");
    const base = new Date("2026-09-01T00:00:00Z");
    expect(shouldRollSession(base, new Date("2026-09-01T23:59:59Z"))).toBe(false);
    expect(shouldRollSession(base, new Date("2026-09-02T00:00:00Z"))).toBe(true);
  });
});
