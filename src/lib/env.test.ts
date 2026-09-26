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
  it("rejects missing core secrets", () => {
    expect(() => parseEnv({ DATABASE_URL: "" })).toThrow();
  });

  it("accepts the required server environment", () => {
    expect(parseEnv(valid).NODE_ENV).toBe("test");
  });

  it("allows roster encryption key to be absent before roster features are activated", () => {
    const { ROSTER_ENCRYPTION_KEY, ...withoutRosterKey } = valid;
    expect(ROSTER_ENCRYPTION_KEY).toBeTruthy();
    expect(parseEnv(withoutRosterKey).ROSTER_ENCRYPTION_KEY).toBeUndefined();
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
