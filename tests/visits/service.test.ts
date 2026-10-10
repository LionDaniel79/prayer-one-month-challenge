import { afterEach, describe, expect, it, vi } from "vitest";
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
    async getBookingPeriod() { return { startDate: null, endDate: null }; },
    async listBlockedDates() { return []; },
    async listEnabledDates() { return []; },
    async listBlockedWeekdays() { return []; },
    async listActiveVisitDates() { return []; },
    async isDateBlocked() { return false; },
    async isDateEnabled() { return false; },
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
  afterEach(() => vi.useRealTimers());

  it("limits availability to the inclusive booking period, including enabled dates", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-27T03:00:00Z"));
    const dates = await getMonthAvailability("2026-10", provider(), repository({
      async getBookingPeriod() { return { startDate: "2026-10-02", endDate: "2026-10-30" }; },
      async listEnabledDates() { return ["2026-10-01", "2026-10-31"]; },
    }));
    expect(dates[0]).toMatchObject({ available: false, reason: "outside_booking_period" });
    expect(dates[1].available).toBe(true);
    expect(dates[29].available).toBe(true);
    expect(dates[30]).toMatchObject({ available: false, reason: "outside_booking_period" });
  });

  it.each(["2026-09-30", "2026-12-01"])("rejects %s outside the booking period before Google or writes", async (visitDate) => {
    const listEvents = vi.fn(async () => []);
    const createPending = vi.fn(async () => ({ id: "v1", status: "requested" as const }));
    await expect(submitVisitRequest({ requesterUserId: "u1", visitDate, visitType: "personal", attendees: "", location: "", preferredTime: "", reason: "" },
      provider({ listEvents }), repository({
        async getBookingPeriod() { return { startDate: "2026-10-01", endDate: "2026-11-30" }; },
        async isDateEnabled() { return true; }, createPending,
      }), "2026-09-01")).rejects.toMatchObject({ code: "VISIT_OUTSIDE_BOOKING_PERIOD", status: 409 });
    expect(listEvents).not.toHaveBeenCalled();
    expect(createPending).not.toHaveBeenCalled();
  });

  it("loads independent availability inputs together", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T00:00:00Z"));
    let release!: (value: []) => void;
    const started: string[] = [];
    const pending = getMonthAvailability("2026-10", provider({
      listEvents: () => new Promise<[]>((resolve) => { release = resolve; }),
    }), repository({
      async listBlockedDates() { started.push("dates"); return ["2026-10-08"]; },
      async listBlockedWeekdays() { started.push("weekdays"); return []; },
      async listActiveVisitDates() { started.push("visits"); return []; },
    }));
    const concurrent = [...started];
    release([]);
    const dates = await pending;
    expect(concurrent).toEqual(["dates", "weekdays", "visits"]);
    expect(dates.find((day) => day.date === "2026-10-08")).toMatchObject({ available: false, reason: "blocked_date" });
  });

  it("stops waiting for a hung calendar and never opens booking dates", async () => {
    vi.useFakeTimers();
    let settled = false;
    const pending = getMonthAvailability("2026-10", provider({
      listEvents: () => new Promise(() => {}),
    }), repository()).then((dates) => { settled = true; return dates; });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(settled).toBe(true);
    const dates = await pending;
    expect(dates.every((date) => !date.available && date.reason === "calendar_unavailable")).toBe(true);
  });

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

  it("rejects a past date even when availability is bypassed", async () => {
    let calendarRead = false;
    await expect(
      submitVisitRequest(
        {
          requesterUserId: "u1",
          visitDate: "2026-09-26",
          visitType: "personal",
          attendees: "홍길동",
          location: "교회",
          preferredTime: "오후",
          reason: "상담 요청",
        },
        provider({
          async listEvents() {
            calendarRead = true;
            return [];
          },
        }),
        repository(),
        "2026-09-27",
      ),
    ).rejects.toMatchObject({
      code: "VISIT_DATE_UNAVAILABLE",
      status: 409,
    });
    expect(calendarRead).toBe(false);
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
        "2026-10-01",
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
        "2026-10-01",
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
      "2026-10-01",
    );

    expect(JSON.stringify(calendarInput)).not.toContain("민감한 심방 이유");
  });

  it("allows an enabled date over weekday and Google events, retaining the duplicate guard and leader", async () => {
    const input = { requesterUserId: "u1", visitDate: "2026-10-04", visitType: "sam" as const,
      attendees: "검증", location: "교회", preferredTime: "오후", reason: "비공개" };
    const create = vi.fn(async (_input: VisitCalendarEventInput) => ({ eventId: "g1" }));
    const calendar = provider({ createVisitEvent: create, async listEvents() {
      return [{ id: "busy", start: { date: "2026-10-04" }, end: { date: "2026-10-05" } }];
    } });
    const repo = repository({ async isDateEnabled() { return true; }, async isWeekdayBlocked() { return true; },
      async getRequester() { return { id: "u1", displayName: "검증", samLabel: "1-2", leaderName: "검증리더A" }; } });
    await submitVisitRequest(input, calendar, repo, "2026-09-27");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ samLabel: "1-2", leaderName: "검증리더A" }));
    expect(create.mock.calls[0][0]).not.toHaveProperty("reason");
    await expect(submitVisitRequest(input, calendar, { ...repo, async hasActiveVisit() { return true; } }, "2026-09-27"))
      .rejects.toMatchObject({ code: "VISIT_ALREADY_EXISTS" });
    expect(create).toHaveBeenCalledTimes(1);
    await expect(submitVisitRequest(input, provider({ async listEvents() { throw new Error("offline"); } }), repo, "2026-09-27"))
      .rejects.toMatchObject({ code: "CALENDAR_AVAILABILITY_UNAVAILABLE" });
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
      "2026-10-01",
    );

    expect(capturedStatus).toBe("requested");
    expect(result).toEqual({ id: "v1" });
  });
});
