import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import { memberRoster, users } from "../../src/db/schema";

describe("member roster schema", () => {
  it("exports the roster table", () => {
    expect(getTableName(memberRoster)).toBe("member_roster");
  });

  it("links users to a roster identity", () => {
    expect(users.rosterId).toBeDefined();
  });

  it("stores an optional custom password hash on the roster", () => {
    expect(memberRoster.passwordHash).toBeDefined();
  });
});
