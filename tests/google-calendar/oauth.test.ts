import { describe, expect, it } from "vitest";
import { DomainError } from "../../src/lib/http";
import {
  GOOGLE_CALENDAR_SCOPES,
  assertGoogleOAuthState,
  googleAuthorizationUrlOptions,
} from "../../src/features/google-calendar/oauth";

describe("Google Calendar OAuth policy", () => {
  it("uses event write and calendar-list readonly scopes", () => {
    expect(GOOGLE_CALENDAR_SCOPES).toContain(
      "https://www.googleapis.com/auth/calendar.events",
    );
    expect(GOOGLE_CALENDAR_SCOPES).toContain(
      "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
    );
  });

  it("requests offline consent so a refresh token can be stored", () => {
    expect(googleAuthorizationUrlOptions("state-123")).toMatchObject({
      access_type: "offline",
      prompt: "consent",
      state: "state-123",
      scope: GOOGLE_CALENDAR_SCOPES,
    });
  });

  it("accepts the exact OAuth state once compared", () => {
    expect(() => assertGoogleOAuthState("abc123", "abc123")).not.toThrow();
  });

  it("rejects a missing or mismatched OAuth state", () => {
    expect(() => assertGoogleOAuthState("", "abc123"))
      .toThrowError(new DomainError("GOOGLE_OAUTH_STATE_MISMATCH", 400));
    expect(() => assertGoogleOAuthState("wrong", "abc123"))
      .toThrowError(new DomainError("GOOGLE_OAUTH_STATE_MISMATCH", 400));
  });
});
