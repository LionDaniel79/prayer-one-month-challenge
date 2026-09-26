import { describe, expect, it } from "vitest";
import { DomainError } from "../../src/lib/http";
import {
  assertActorNotSelectedForDeletion,
  passwordModeFromHash,
  uniqueRosterIds,
} from "../../src/features/admin/roster-service";

describe("admin roster management helpers", () => {
  it("shows whether a member still uses the initial phone password", () => {
    expect(passwordModeFromHash(null)).toBe("initial");
    expect(passwordModeFromHash("argon-hash")).toBe("custom");
  });

  it("deduplicates selected roster ids before bulk deletion", () => {
    expect(uniqueRosterIds(["r1", "r1", "r2"])).toEqual(["r1", "r2"]);
  });

  it("prevents deleting the currently signed-in administrator", () => {
    expect(() =>
      assertActorNotSelectedForDeletion(
        [
          { id: "u1", rosterId: "r1" },
          { id: "u2", rosterId: "r2" },
        ],
        "u1",
      ),
    ).toThrowError(new DomainError("CANNOT_DELETE_SELF", 409));
  });
});
