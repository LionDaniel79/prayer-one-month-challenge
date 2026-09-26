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

describe("safe database error details", () => {
  it("collects nested driver codes without exposing messages", async () => {
    const { safeDatabaseErrorDetails } = await import("../../src/features/health/service");
    const details = safeDatabaseErrorDetails({
      name: "AggregateError",
      message: "postgres://secret",
      errors: [
        { code: "ECONNREFUSED", message: "secret host" },
        { code: "ERR_TLS_CERT_ALTNAME_INVALID", message: "secret certificate" },
      ],
    });
    expect(details).toEqual({
      name: "AggregateError",
      codes: ["ECONNREFUSED", "ERR_TLS_CERT_ALTNAME_INVALID"],
    });
    expect(JSON.stringify(details)).not.toContain("secret");
  });
});
