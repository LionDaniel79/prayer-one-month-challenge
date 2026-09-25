import { describe, expect, it } from "vitest";
import { DomainError } from "../../src/lib/http";
import type {
  CalendarProvider,
  VisitCalendarEventInput,
} from "../../src/features/visits/calendar-provider";
import {
  getMonthAvailability,
  submitVisitRequest,
  type VisitRepository,
} from "../../src/features/visits/service";

function provider(overrides: Partial<CalendarProvider> = {}): CalendarProvider {
  return {
    async listEvents() { return []; },
    async createVisitEvent(input: VisitCalendarEventInput) {
      return { eventId: "g1" };
    },
    async updateVisitEvent() {},
    async deleteVisitEvent() {},
    ...overrides,
  };
}

function repository(overrides: Partial<VisitRepository> = {}): VisitRepository {
  return {
    async listBlockedDates() { return []; },
    async listBlockedWeekdays() { return []; },
    async listActiveVisitDates() { return []; },
    async isDateBlocked() { return false; },
    async isWeekdayBlocked() { return false; },
    async hasActiveVisit() { return false; },
    async getRequester(userId) {
      return { id: userId, displayName: "홍길동" };
    },
    async createPending() {
      return { id: "v1", status: "requested" };
    },
    async markSynced() {},
    async cancelAfterSyncFailure() {},
    ...overrides,
  };
}

describe("visit booking service", () => {
  it("fails closed for a month when Google availability cannot be read", async () => {
    const calendar = provider({
      async listEvents() {
        throw new Error("calendar down");
      },
    });

    const result = await getMonthAvailability(
      "2026-10",
      calendar,
      repository(),
    );

    expect(result).toHaveLength(31);
    expect(result.every((day) =>
      !day.available && day.reason === "calendar_unavailable"
    )).toBe(true);
  });

  it("rechecks the selected date before creating a request", async () => {
    let created = false;
    const repo = repository({
      async hasActiveVisit(date) {
        expect(date).toBe("2026-10-08");
        return true;
      },
      async createPending() {
        created = true;
        return { id: "v1", status: "requested" };
      },
    });

    await expect(
      submitVisitRequest(
        {
          requesterUserId: "u1",
          visitDate: "2026-10-08",
          visitType: "personal",
          attendees: "홍길동",
          location: "교회",
          preferredTime: "오후",
          reason: "상담 요청",
        },
        provider(),
        repo,
      ),
    ).rejects.toMatchObject({
      code: "VISIT_ALREADY_EXISTS",
      status: 409,
    });
    expect(created).toBe(false);
  });

  it("maps a database unique race to VISIT_ALREADY_EXISTS", async () => {
    const repo = repository({
      async createPending() {
        throw Object.assign(new Error("duplicate"), { code: "23505" });
      },
    });

    await expect(
      submitVisitRequest(
        {
          requesterUserId: "u1",
          visitDate: "2026-10-08",
          visitType: "personal",
          attendees: "홍길동",
          location: "교회",
          preferredTime: "오후",
          reason: "상담 요청",
        },
        provider(),
        repo,
      ),
    ).rejects.toEqual(new DomainError("VISIT_ALREADY_EXISTS", 409));
  });

  it("never sends the private visit reason to Calendar", async () => {
    let calendarInput: VisitCalendarEventInput | null = null;
    const calendar = provider({
      async createVisitEvent(input) {
        calendarInput = input;
        return { eventId: "g1" };
      },
    });

    await submitVisitRequest(
      {
        requesterUserId: "u1",
        visitDate: "2026-10-08",
        visitType: "sam",
        attendees: "홍길동, 김사랑",
        location: "가정",
        preferredTime: "오후 3시 이후",
        reason: "민감한 심방 이유",
      },
      calendar,
      repository(),
    );

    expect(JSON.stringify(calendarInput)).not.toContain("민감한 심방 이유");
  });

  it("creates member requests in requested state", async () => {
    let capturedStatus = "";
    const repo = repository({
      async createPending(input) {
        capturedStatus = input.status;
        return { id: "v1", status: "requested" };
      },
    });

    const result = await submitVisitRequest(
      {
        requesterUserId: "u1",
        visitDate: "2026-10-08",
        visitType: "personal",
        attendees: "홍길동",
        location: "교회",
        preferredTime: "오후",
        reason: "요청",
      },
      provider(),
      repo,
    );

    expect(capturedStatus).toBe("requested");
    expect(result).toEqual({ id: "v1" });
  });
});
