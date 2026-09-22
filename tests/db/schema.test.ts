import { describe, expect, it } from "vitest";
import { getTableName } from "drizzle-orm";
import {
  authRateLimits,
  challenges,
  prayerCheckins,
  roleEnum,
  sams,
  sessions,
  users,
} from "../../src/db/schema";

describe("database schema", () => {
  it("exports all required prayer application tables", () => {
    expect(getTableName(challenges)).toBe("challenges");
    expect(getTableName(sams)).toBe("sams");
    expect(getTableName(users)).toBe("users");
    expect(getTableName(prayerCheckins)).toBe("prayer_checkins");
    expect(getTableName(sessions)).toBe("sessions");
    expect(getTableName(authRateLimits)).toBe("auth_rate_limits");
  });

  it("defines member/admin roles", () => {
    expect(roleEnum.enumValues).toEqual(["member", "admin"]);
  });
});
