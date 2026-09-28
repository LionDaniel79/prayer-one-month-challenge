import { describe, expect, it } from "vitest";
import {
  decryptGoogleRefreshToken,
  encryptGoogleRefreshToken,
} from "../../src/features/google-calendar/crypto";

describe("Google Calendar refresh token encryption", () => {
  const keyA = Buffer.alloc(32, 7).toString("base64");
  const keyB = Buffer.alloc(32, 9).toString("base64");

  it("round-trips without exposing the token in ciphertext", () => {
    const token = "refresh-token-sensitive-value";
    const ciphertext = encryptGoogleRefreshToken(token, keyA);

    expect(ciphertext).not.toContain(token);
    expect(decryptGoogleRefreshToken(ciphertext, keyA)).toBe(token);
  });

  it("fails closed with the wrong encryption key", () => {
    const ciphertext = encryptGoogleRefreshToken("refresh-token", keyA);
    expect(() => decryptGoogleRefreshToken(ciphertext, keyB)).toThrow();
  });

  it("rejects keys that do not decode to exactly 32 bytes", () => {
    expect(() =>
      encryptGoogleRefreshToken("refresh-token", Buffer.alloc(16).toString("base64")),
    ).toThrow("INVALID_GOOGLE_CALENDAR_ENCRYPTION_KEY");
  });
});
