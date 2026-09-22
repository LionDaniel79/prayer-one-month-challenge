import { describe, expect, it } from "vitest";
import { nextFailureState } from "../../src/features/auth/rate-limit";

describe("login failure throttling", () => {
  it("blocks on the eighth failure for 15 minutes", () => {
    const now = new Date("2026-09-01T00:00:00Z");
    let state = null;
    for (let i = 0; i < 8; i += 1) {
      state = nextFailureState(state, now);
    }
    expect(state?.failureCount).toBe(8);
    expect(state?.blockedUntil?.toISOString()).toBe("2026-09-01T00:15:00.000Z");
  });

  it("starts a fresh window after 15 minutes", () => {
    const first = new Date("2026-09-01T00:00:00Z");
    const state = nextFailureState(null, first);
    const later = new Date("2026-09-01T00:15:01Z");
    expect(nextFailureState(state, later)).toMatchObject({
      failureCount: 1,
      blockedUntil: null,
    });
  });
});
