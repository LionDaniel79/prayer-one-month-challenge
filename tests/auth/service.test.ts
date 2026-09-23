import { describe, expect, it } from "vitest";
import { canonicalizeRosterName } from "../../src/features/roster/normalize";

describe("roster authentication migration", () => {
  it("uses the roster canonical name rule for login identity", () => {
    expect(canonicalizeRosterName("김은희B")).toBe("김은희");
  });
});
