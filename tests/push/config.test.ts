import { describe, expect, it } from "vitest";
import { parseEnv } from "../../src/lib/env";

const base = {
  DATABASE_URL: "postgres://example",
  SESSION_SECRET: "s".repeat(32),
  PHONE_LOOKUP_PEPPER: "p".repeat(32),
  NODE_ENV: "test",
};

describe("web push environment", () => {
  it("keeps VAPID config optional before push is configured", () => {
    const parsed = parseEnv(base);
    expect(parsed.WEB_PUSH_VAPID_PUBLIC_KEY).toBeUndefined();
    expect(parsed.WEB_PUSH_VAPID_PRIVATE_KEY).toBeUndefined();
    expect(parsed.WEB_PUSH_SUBJECT).toBeUndefined();
  });

  it("retains configured VAPID values for push operations", () => {
    const parsed = parseEnv({
      ...base,
      WEB_PUSH_VAPID_PUBLIC_KEY: "public-key",
      WEB_PUSH_VAPID_PRIVATE_KEY: "private-key",
      WEB_PUSH_SUBJECT: "mailto:admin@example.com",
    });
    expect(parsed.WEB_PUSH_VAPID_PUBLIC_KEY).toBe("public-key");
    expect(parsed.WEB_PUSH_VAPID_PRIVATE_KEY).toBe("private-key");
    expect(parsed.WEB_PUSH_SUBJECT).toBe("mailto:admin@example.com");
  });
});
