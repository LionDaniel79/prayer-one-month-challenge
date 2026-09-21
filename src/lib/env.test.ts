import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

describe("parseEnv", () => {
  it("rejects missing secrets", () => {
    expect(() => parseEnv({ DATABASE_URL: "" })).toThrow();
  });

  it("accepts the required server environment", () => {
    expect(
      parseEnv({
        DATABASE_URL: "postgres://example",
        SESSION_SECRET: "s".repeat(32),
        PHONE_LOOKUP_PEPPER: "p".repeat(32),
        NODE_ENV: "test",
      }).NODE_ENV,
    ).toBe("test");
  });
});
