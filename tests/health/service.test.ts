import { describe, expect, it } from "vitest";
import { classifyDatabaseError } from "../../src/features/health/service";

describe("runtime health diagnostics", () => {
  it("classifies database authentication failures without leaking secrets", () => {
    expect(classifyDatabaseError({ code: "28P01", message: "password authentication failed for secret" })).toBe("DB_AUTH_FAILED");
  });

  it("classifies DNS and timeout failures", () => {
    expect(classifyDatabaseError({ code: "ENOTFOUND" })).toBe("DB_DNS_FAILED");
    expect(classifyDatabaseError({ code: "ETIMEDOUT" })).toBe("DB_TIMEOUT");
  });

  it("uses a generic code for unknown database failures", () => {
    expect(classifyDatabaseError({ message: "postgresql://secret" })).toBe("DB_CONNECT_FAILED");
  });
});
