import {
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { DomainError } from "../../lib/http";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
] as const;

export function newGoogleOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function googleAuthorizationUrlOptions(state: string) {
  return {
    access_type: "offline" as const,
    prompt: "consent" as const,
    state,
    scope: [...GOOGLE_CALENDAR_SCOPES],
  };
}

export function assertGoogleOAuthState(
  received: string | null | undefined,
  expected: string | null | undefined,
): void {
  if (!received || !expected) {
    throw new DomainError("GOOGLE_OAUTH_STATE_MISMATCH", 400);
  }

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new DomainError("GOOGLE_OAUTH_STATE_MISMATCH", 400);
  }
}
