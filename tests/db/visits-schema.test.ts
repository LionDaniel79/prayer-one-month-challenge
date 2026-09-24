import { describe, expect, it } from "vitest";
import {
  googleCalendarConnections,
  visitBlockedDates,
  visitBlockedWeekdays,
  visitRequests,
} from "../../src/db/schema";

describe("visit scheduling schema", () => {
  it("defines visit requests and administrator availability rules", () => {
    expect(visitRequests.visitDate).toBeDefined();
    expect(visitRequests.googleEventId).toBeDefined();
    expect(visitBlockedDates.visitDate).toBeDefined();
    expect(visitBlockedWeekdays.weekday).toBeDefined();
  });

  it("defines one encrypted Google Calendar connection", () => {
    expect(googleCalendarConnections.refreshTokenCiphertext).toBeDefined();
    expect(googleCalendarConnections.selectedCalendarId).toBeDefined();
  });
});
