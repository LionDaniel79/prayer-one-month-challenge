import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  DATABASE_URL: "postgres://example",
  SESSION_SECRET: "s".repeat(32),
  PHONE_LOOKUP_PEPPER: "p".repeat(32),
  ROSTER_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
  NODE_ENV: "test",
};

describe("parseEnv", () => {
  it("rejects missing secrets", () => {
    expect(() => parseEnv({ DATABASE_URL: "" })).toThrow();
  });

  it("accepts the required server environment", () => {
    expect(parseEnv(valid).NODE_ENV).toBe("test");
  });

  it("rejects roster encryption keys that do not decode to 32 bytes", () => {
    expect(() =>
      parseEnv({
        ...valid,
        ROSTER_ENCRYPTION_KEY: Buffer.alloc(31, 1).toString("base64"),
      }),
    ).toThrow();
  });
});
